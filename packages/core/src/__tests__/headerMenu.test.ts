// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { getHeaderMenuItems, moveMenuIndex, onMenuDismiss } from '../headerMenu'

describe('getHeaderMenuItems', () => {
  it('offers filter, group and hide when the column supports them', () => {
    expect(getHeaderMenuItems({ key: 'dept', groupable: true }, [], 3, false)).toEqual([
      'filter',
      'group',
      'hide',
    ])
  })

  it('leaves out grouping for a non-groupable column', () => {
    expect(getHeaderMenuItems({ key: 'name' }, [], 3, false)).toEqual(['filter', 'hide'])
  })

  it('offers removing the group instead once grouped', () => {
    expect(getHeaderMenuItems({ key: 'dept', groupable: true }, ['dept'], 3, false)).toEqual([
      'filter',
      'ungroup',
      'hide',
    ])
  })

  it('never hides the last visible column', () => {
    expect(getHeaderMenuItems({ key: 'name', filterable: false }, [], 1, false)).toEqual([])
  })
})

describe('getHeaderMenuItems — clear filter', () => {
  it('offers clearing right after Filter while the column is filtered', () => {
    expect(getHeaderMenuItems({ key: 'name' }, [], 3, true)).toEqual(['filter', 'clear', 'hide'])
  })
})

describe('moveMenuIndex', () => {
  it('wraps ↑ and ↓', () => {
    expect(moveMenuIndex('ArrowDown', 2, 3)).toBe(0)
    expect(moveMenuIndex('ArrowUp', 0, 3)).toBe(2)
  })

  it('jumps with Home and End', () => {
    expect(moveMenuIndex('Home', 1, 3)).toBe(0)
    expect(moveMenuIndex('End', 1, 3)).toBe(2)
  })

  it('ignores other keys', () => {
    expect(moveMenuIndex('Enter', 1, 3)).toBeNull()
  })
})

describe('onMenuDismiss', () => {
  function setup() {
    const trigger = document.createElement('button')
    const menu = document.createElement('div')
    const page = document.createElement('div')
    document.body.append(trigger, menu, page)
    let left = 100
    trigger.getBoundingClientRect = () => new DOMRect(left, 50, 24, 24)
    const close = vi.fn()
    const stop = onMenuDismiss(
      () => trigger,
      () => menu,
      close,
    )
    return { menu, page, close, stop, moveTrigger: (x: number) => (left = x) }
  }

  it('closes on a mousedown outside the menu and its trigger', () => {
    const { menu, page, close, stop } = setup()
    menu.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(close).not.toHaveBeenCalled()
    page.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(close).toHaveBeenCalledOnce()
    stop()
  })

  // The browser reports a scroll after it happened: one done just before opening (scrolling the
  // trigger into view on click or focus) must not close the menu it opened
  it('ignores a scroll that left the trigger where it was when the menu opened', () => {
    const { page, close, stop } = setup()
    page.dispatchEvent(new Event('scroll'))
    expect(close).not.toHaveBeenCalled()
    stop()
  })

  it('closes on a scroll that moved the trigger, as the fixed menu does not follow it', () => {
    const { page, close, stop, moveTrigger } = setup()
    moveTrigger(40)
    page.dispatchEvent(new Event('scroll'))
    expect(close).toHaveBeenCalledOnce()
    stop()
  })

  it('ignores a scroll inside the menu', () => {
    const { menu, close, stop, moveTrigger } = setup()
    moveTrigger(40)
    menu.dispatchEvent(new Event('scroll'))
    expect(close).not.toHaveBeenCalled()
    stop()
  })
})
