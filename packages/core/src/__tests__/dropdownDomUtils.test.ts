// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import {
  activeRowKeyDown,
  computeMenuPosition,
  computeSubmenuPosition,
  rovingFocusTarget,
  watchMedia,
} from '../dropdownDomUtils'

describe('computeMenuPosition', () => {
  const anchor = { top: 100, bottom: 120, left: 200, right: 280 }
  const size = { width: 180, height: 150 }

  it('opens below the anchor, left-aligned', () => {
    expect(computeMenuPosition(anchor, size, 1440, 900)).toEqual({ left: 200, top: 120 })
  })

  it('slides back inside the right edge', () => {
    const nearRight = { ...anchor, left: 1350, right: 1430 }
    expect(computeMenuPosition(nearRight, size, 1440, 900)).toEqual({ left: 1252, top: 120 })
  })

  it('keeps the left margin when the anchor is scrolled off to the left', () => {
    const offLeft = { ...anchor, left: -50, right: 30 }
    expect(computeMenuPosition(offLeft, size, 1440, 900).left).toBe(8)
  })

  it('flips above the anchor when it does not fit below', () => {
    const low = { top: 800, bottom: 820, left: 200, right: 280 }
    expect(computeMenuPosition(low, size, 1440, 900)).toEqual({ left: 200, top: 650 })
  })

  it('stays inside the top margin when it fits neither way', () => {
    const tiny = { top: 60, bottom: 80, left: 200, right: 280 }
    expect(computeMenuPosition(tiny, size, 1440, 200).top).toBe(8)
  })
})

describe('computeSubmenuPosition', () => {
  const trigger = { top: 100, bottom: 130, left: 100, right: 280 }

  it('opens to the right when it fits', () => {
    expect(computeSubmenuPosition(trigger, { width: 200, height: 100 }, 1440, 900).left).toBe(280)
  })

  it('flips to the left when the right side is too narrow', () => {
    const nearRight = { ...trigger, left: 1100, right: 1280 }
    expect(computeSubmenuPosition(nearRight, { width: 200, height: 100 }, 1440, 900).left).toBe(900)
  })

  it('stays on screen when it fits neither side', () => {
    expect(computeSubmenuPosition(trigger, { width: 330, height: 100 }, 390, 844).left).toBe(8)
  })
})

describe('watchMedia', () => {
  it('reports no match where matchMedia is missing', () => {
    const seen: boolean[] = []
    const stop = watchMedia('(max-width: 479px)', (m) => seen.push(m))
    expect(seen).toEqual([false])
    stop()
  })
})

describe('rovingFocusTarget', () => {
  const [search, a, b, c] = ['input', 'button', 'button', 'button'].map((t) =>
    document.createElement(t),
  )
  const all = [search, a, b, c]
  const rows = [a, b, c]

  it('moves to the neighbor on ↑/↓', () => {
    expect(rovingFocusTarget('ArrowDown', all, a)).toBe(b)
    expect(rovingFocusTarget('ArrowUp', all, a)).toBe(search)
  })

  it("doesn't wrap at either end", () => {
    expect(rovingFocusTarget('ArrowUp', all, search)).toBeNull()
    expect(rovingFocusTarget('ArrowDown', all, c)).toBeNull()
  })

  it('Home/End jump within homeEnd, skipping the search box', () => {
    expect(rovingFocusTarget('Home', all, c, rows)).toBe(a)
    expect(rovingFocusTarget('End', all, search, rows)).toBe(c)
    expect(rovingFocusTarget('Home', all, c)).toBe(search)
  })

  it('returns null when focus stays, for other keys, or for a foreign element', () => {
    expect(rovingFocusTarget('Home', all, a, rows)).toBeNull()
    expect(rovingFocusTarget('End', all, search, [])).toBeNull()
    expect(rovingFocusTarget('Enter', all, a)).toBeNull()
    expect(rovingFocusTarget('ArrowDown', all, document.createElement('div'))).toBeNull()
    expect(rovingFocusTarget('ArrowDown', all, null)).toBeNull()
  })
})

describe('activeRowKeyDown', () => {
  const press = (key: string, altKey = false) => ({ key, altKey, preventDefault: vi.fn() })

  it('Alt+↑/↓ moves by ∓1 and prevents the default', () => {
    const move = vi.fn()
    const e = press('ArrowDown', true)
    activeRowKeyDown(e, move, vi.fn())
    expect(move).toHaveBeenCalledWith(1)
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it("Alt+↑ doesn't prevent the default when the row can't move or has no neighbor", () => {
    const e = press('ArrowUp', true)
    activeRowKeyDown(e, undefined, vi.fn())
    activeRowKeyDown(e, () => false, vi.fn())
    expect(e.preventDefault).not.toHaveBeenCalled()
  })

  it('Delete/Backspace removes, Enter/Space activates, all default-prevented', () => {
    const remove = vi.fn()
    const activate = vi.fn()
    for (const key of ['Delete', 'Backspace', 'Enter', ' ']) {
      const e = press(key)
      activeRowKeyDown(e, undefined, remove, activate)
      expect(e.preventDefault).toHaveBeenCalled()
    }
    expect(remove).toHaveBeenCalledTimes(2)
    expect(activate).toHaveBeenCalledTimes(2)
  })

  it('ignores a plain arrow key', () => {
    const e = press('ArrowUp')
    activeRowKeyDown(e, vi.fn(), vi.fn())
    expect(e.preventDefault).not.toHaveBeenCalled()
  })
})
