// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { trackWrapWidth } from '../tableWrap'

describe('trackWrapWidth', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps --dt-wrap-width at the visible width, until cleaned up', () => {
    let notify = () => {}
    const disconnect = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notify = callback
        }
        observe() {}
        disconnect = disconnect
      },
    )
    const wrap = document.createElement('div')
    let width = 390
    Object.defineProperty(wrap, 'clientWidth', { get: () => width })

    const stop = trackWrapWidth(wrap)
    notify()
    expect(wrap.style.getPropertyValue('--dt-wrap-width')).toBe('390px')
    width = 320
    notify()
    expect(wrap.style.getPropertyValue('--dt-wrap-width')).toBe('320px')
    stop()
    expect(disconnect).toHaveBeenCalled()
  })

  it('does nothing without ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const wrap = document.createElement('div')
    trackWrapWidth(wrap)()
    expect(wrap.style.getPropertyValue('--dt-wrap-width')).toBe('')
  })
})
