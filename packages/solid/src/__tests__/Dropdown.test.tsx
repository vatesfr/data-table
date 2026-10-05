import { describe, it, expect, afterEach, vi } from 'vitest'
import { render } from 'solid-js/web'
import { Dropdown } from '../components/Dropdown'

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
  let dispose: (() => void) | undefined
  afterEach(() => {
    dispose?.()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    naturalLeft = 900
  })

  it('re-clamps an open panel whose trigger moves', async () => {
    stubLayout()
    const container = document.createElement('div')
    document.body.appendChild(container)
    dispose = render(
      () => (
        <Dropdown isOpen trigger={<button>Open</button>} onToggle={() => {}} onClose={() => {}}>
          <div data-body>Items</div>
        </Dropdown>
      ),
      container,
    )
    const panel = container.querySelector<HTMLElement>('[data-body]')!.parentElement!
    // jsdom's innerWidth is 1024: the right edge stops 8 px short of it
    await vi.waitFor(() => expect(panel.style.transform).toBe('translateX(-184px)'))

    naturalLeft = 950
    document.body.append(document.createElement('span'))
    await vi.waitFor(() => expect(panel.style.transform).toBe('translateX(-234px)'))
  })
})
