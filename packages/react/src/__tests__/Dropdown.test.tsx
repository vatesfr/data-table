import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Dropdown } from '../components/Dropdown'

// jsdom has no layout: the panel (the [data-body] parent) sits at `naturalLeft` plus its translateX
let naturalLeft = 900
let naturalTop = 40
const translateX = (transform: string) =>
  Number(/translateX\((-?[\d.]+)px\)/.exec(transform)?.[1] ?? 0)
const stubLayout = () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (!this.querySelector(':scope > [data-body]'))
      return { top: 0, bottom: 0, left: 0, right: 0 } as DOMRect
    const left = naturalLeft + translateX(this.style.transform)
    return {
      top: naturalTop,
      bottom: naturalTop + 100,
      left,
      right: left + 300,
      width: 300,
    } as DOMRect
  })
  // Absent from jsdom; its computed `transform` is the inline one, rendered without transition
  vi.stubGlobal(
    'DOMMatrixReadOnly',
    class {
      m41: number
      constructor(transform: string) {
        this.m41 = translateX(transform)
      }
    },
  )
}

describe('Dropdown viewport clamping', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    naturalLeft = 900
    naturalTop = 40
  })

  it('opens upward with dt-dd--up when the panel would overflow the viewport bottom', () => {
    stubLayout()
    // jsdom's innerHeight is 768
    naturalTop = 700
    const dropdown = (open: boolean) => (
      <Dropdown trigger={<button>Open</button>} open={open} setOpen={() => {}}>
        <div data-body>Items</div>
      </Dropdown>
    )
    const { container, rerender } = render(dropdown(true))
    const panel = () => container.querySelector('[data-body]')!.parentElement!
    expect(panel().classList.contains('dt-dd--up')).toBe(true)
    rerender(dropdown(false))
    naturalTop = 40
    rerender(dropdown(true))
    expect(panel().classList.contains('dt-dd--up')).toBe(false)
  })

  it('gives the panel the dt-dd class shared with the other adapters', () => {
    const { container } = render(
      <Dropdown trigger={<button>Open</button>} open setOpen={() => {}}>
        <div data-body>Items</div>
      </Dropdown>,
    )
    expect(container.querySelector('[data-body]')!.parentElement!.className).toBe('dt-dd')
  })

  it('re-clamps an open panel whose trigger moves', async () => {
    stubLayout()
    const { container } = render(
      <Dropdown trigger={<button>Open</button>} open setOpen={() => {}}>
        <div data-body>Items</div>
      </Dropdown>,
    )
    const panel = container.querySelector<HTMLElement>('[data-body]')!.parentElement!
    // jsdom's innerWidth is 1024: the right edge stops 8 px short of it
    expect(panel.style.transform).toBe('translateX(-184px)')

    naturalLeft = 950
    document.body.append(document.createElement('span'))
    await vi.waitFor(() => expect(panel.style.transform).toBe('translateX(-234px)'))
  })
})
