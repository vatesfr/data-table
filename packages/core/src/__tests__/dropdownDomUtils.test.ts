import { describe, it, expect } from 'vitest'
import { computeMenuPosition } from '../dropdownDomUtils'

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
