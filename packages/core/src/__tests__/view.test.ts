import { describe, it, expect } from 'vitest'
import { encodeViewState, decodeViewState, type TableViewState } from '../view'

describe('encodeViewState / decodeViewState', () => {
  it('round-trips a full view', () => {
    const view: TableViewState = {
      visibleCols: ['name', 'dept'],
      columnOrder: ['dept', 'name', 'salary'],
      sorts: [{ key: 'salary', dir: 'desc' }],
      filters: { dept: ['Eng', 'HR'] },
      rangeFilters: { salary: { min: '50000', max: '' } },
      groupBy: ['dept'],
      collapsedGroups: ['Eng'],
      page: 3,
      pageSize: 20,
      searchQuery: 'café',
    }
    expect(decodeViewState(encodeViewState(view))).toEqual(view)
  })

  it('round-trips an empty view', () => {
    expect(decodeViewState(encodeViewState({}))).toEqual({})
  })

  it('omits fields at their default value', () => {
    const view: TableViewState = {
      columnOrder: [],
      sorts: [],
      filters: { dept: [] },
      rangeFilters: { salary: { min: '', max: '' } },
      page: 1,
      pageSize: 0,
      searchQuery: '',
    }
    expect(decodeViewState(encodeViewState(view))).toEqual({})
  })

  it('produces a short URL-safe string', () => {
    const encoded = encodeViewState({ sorts: [{ key: 'price', dir: 'desc' }] })
    expect(encoded).toMatch(/^[A-Za-z0-9\-_]+$/)
    expect(encoded.length).toBeLessThan(40)
  })

  it('returns undefined for malformed input', () => {
    expect(decodeViewState('not valid base64url!!!')).toBeUndefined()
    expect(decodeViewState('')).toBeUndefined()
  })
})
