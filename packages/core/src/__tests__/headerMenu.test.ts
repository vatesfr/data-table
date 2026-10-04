import { describe, it, expect } from 'vitest'
import { getHeaderMenuItems, moveMenuIndex } from '../headerMenu'

describe('getHeaderMenuItems', () => {
  it('offers filter, group and hide when the column supports them', () => {
    expect(getHeaderMenuItems({ key: 'dept', groupable: true }, [], 3)).toEqual([
      'filter',
      'group',
      'hide',
    ])
  })

  it('leaves out grouping for a non-groupable or already grouped column', () => {
    expect(getHeaderMenuItems({ key: 'name' }, [], 3)).toEqual(['filter', 'hide'])
    expect(getHeaderMenuItems({ key: 'dept', groupable: true }, ['dept'], 3)).toEqual([
      'filter',
      'hide',
    ])
  })

  it('never hides the last visible column', () => {
    expect(getHeaderMenuItems({ key: 'name', filterable: false }, [], 1)).toEqual([])
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
