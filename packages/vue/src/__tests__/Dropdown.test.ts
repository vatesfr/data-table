import { describe, it, expect, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import Dropdown from '../components/Dropdown.vue'

// jsdom has no layout: the panel (the [data-body] parent) sits at `naturalLeft` plus its translateX
let naturalLeft = 900
const stubLayout = () =>
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (!this.querySelector(':scope > [data-body]'))
      return { top: 0, bottom: 0, left: 0, right: 0 } as DOMRect
    const dx = Number(/translateX\((-?[\d.]+)px\)/.exec(this.style.transform)?.[1] ?? 0)
    const left = naturalLeft + dx
    return { top: 40, bottom: 140, left, right: left + 300, width: 300 } as DOMRect
  })

describe('Dropdown viewport clamping', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    naturalLeft = 900
  })

  it('re-clamps an open panel whose trigger moves', async () => {
    stubLayout()
    const wrapper = mount(Dropdown, {
      slots: { trigger: '<button>Open</button>', default: '<div data-body>Items</div>' },
      attachTo: document.body,
    })
    await wrapper.find('button').trigger('click')
    await nextTick()
    const panel = wrapper.find('[data-body]').element.parentElement!
    // jsdom's innerWidth is 1024: the right edge stops 8 px short of it
    expect(panel.style.transform).toBe('translateX(-184px)')

    naturalLeft = 950
    document.body.append(document.createElement('span'))
    await vi.waitFor(() => expect(panel.style.transform).toBe('translateX(-234px)'))
    wrapper.unmount()
  })
})
