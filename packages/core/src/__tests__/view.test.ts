import { describe, it, expect } from 'vitest'
import {
  encodeViewState,
  decodeViewState,
  resolveViewState,
  buildViewStateSnapshot,
  type TableViewState,
  type ViewStateSnapshotInput,
} from '../view'
import type { ColumnDefBase } from '../types'

const COLS: ColumnDefBase[] = [
  { key: 'name', label: 'Name' },
  { key: 'dept', label: 'Dept' },
  { key: 'score', label: 'Score', defaultSortDir: 'desc' },
]

describe('encodeViewState / decodeViewState', () => {
  it('round-trips a full view', () => {
    const view: TableViewState = {
      visibleCols: ['name', 'dept'],
      columnOrder: ['dept', 'name', 'salary'],
      sorts: [{ key: 'salary', dir: 'desc' }],
      filters: { dept: ['Eng', 'HR'] },
      excludeFilters: { tags: ['RPG'] },
      filterModes: { tags: 'and' },
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
      excludeFilters: { tags: [] },
      filterModes: {},
      rangeFilters: { salary: { min: '', max: '' } },
      page: 1,
      pageSize: 0,
      searchQuery: '',
    }
    expect(decodeViewState(encodeViewState(view))).toEqual({})
  })

  it('round-trips both "and" and "or" filterModes entries', () => {
    const view: TableViewState = { filterModes: { tags: 'and', category: 'or' } }
    expect(decodeViewState(encodeViewState(view))).toEqual(view)
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

describe('resolveViewState', () => {
  it('defaults every field to empty when no view or initialViewState is given', () => {
    const r = resolveViewState({}, COLS)
    expect([...r.visibleCols]).toEqual(['name', 'dept', 'score'])
    expect(r.columnOrder).toEqual([])
    expect(r.sorts).toEqual([])
    expect(r.groupBy).toEqual([])
    expect(r.page).toBe(1)
    expect(r.pageSize).toBe(0)
    expect(r.searchQuery).toBe('')
  })

  it('falls back to initialViewState for a field the view omits', () => {
    const initialViewState: TableViewState = {
      visibleCols: ['name', 'score'],
      sorts: [{ key: 'score', dir: 'desc' }],
      pageSize: 20,
    }
    const r = resolveViewState({}, COLS, initialViewState)
    expect([...r.visibleCols]).toEqual(['name', 'score'])
    expect(r.sorts).toEqual([{ key: 'score', dir: 'desc' }])
    expect(r.pageSize).toBe(20)
  })

  it('lets an explicit view field win over initialViewState', () => {
    const initialViewState: TableViewState = {
      pageSize: 20,
      sorts: [{ key: 'score', dir: 'desc' }],
    }
    const r = resolveViewState(
      { pageSize: 50, sorts: [{ key: 'name', dir: 'asc' }] },
      COLS,
      initialViewState,
    )
    expect(r.pageSize).toBe(50)
    expect(r.sorts).toEqual([{ key: 'name', dir: 'asc' }])
  })

  it('falls back to all columns when initialViewState.visibleCols references stale/removed keys', () => {
    const r = resolveViewState({}, COLS, { visibleCols: ['gone'] })
    expect([...r.visibleCols]).toEqual(['name', 'dept', 'score'])
  })

  it("inserts a matching sort entry (using the column's defaultSortDir) for a groupBy column resolved from initialViewState", () => {
    const r = resolveViewState({}, COLS, { groupBy: ['score'] })
    expect(r.sorts).toEqual([{ key: 'score', dir: 'desc' }])
  })

  it('keeps an explicit initialViewState sort direction for a grouped column instead of overriding it', () => {
    const r = resolveViewState({}, COLS, {
      groupBy: ['score'],
      sorts: [{ key: 'score', dir: 'asc' }],
    })
    expect(r.sorts).toEqual([{ key: 'score', dir: 'asc' }])
  })

  it('inserts group sorts ahead of ungrouped sorts, in groupBy order', () => {
    const r = resolveViewState({}, COLS, {
      groupBy: ['dept'],
      sorts: [{ key: 'name', dir: 'asc' }],
    })
    expect(r.sorts).toEqual([
      { key: 'dept', dir: 'asc' },
      { key: 'name', dir: 'asc' },
    ])
  })

  it('does not auto-insert a group sort when view.groupBy is given explicitly', () => {
    const r = resolveViewState({ groupBy: ['score'] }, COLS)
    expect(r.sorts).toEqual([])
  })

  it('respects an explicit view.sorts alongside an explicit view.groupBy with no auto-insert', () => {
    const r = resolveViewState({ groupBy: ['score'], sorts: [{ key: 'name', dir: 'asc' }] }, COLS)
    expect(r.sorts).toEqual([{ key: 'name', dir: 'asc' }])
  })
})

describe('buildViewStateSnapshot', () => {
  function snapshotFrom(view: TableViewState, initialViewState?: TableViewState): TableViewState {
    const resolved = resolveViewState(view, COLS, initialViewState)
    const input: ViewStateSnapshotInput = { ...resolved, columns: COLS, initialViewState }
    return buildViewStateSnapshot(input)
  }

  it('omits every field for a freshly-constructed table with no initialViewState', () => {
    expect(snapshotFrom({})).toEqual({})
  })

  it('omits fields that already match a non-empty initialViewState', () => {
    const initialViewState: TableViewState = {
      visibleCols: ['name', 'score'],
      pageSize: 20,
      sorts: [{ key: 'score', dir: 'desc' }],
    }
    expect(snapshotFrom({}, initialViewState)).toEqual({})
  })

  it('reports a field once it diverges from initialViewState', () => {
    const initialViewState: TableViewState = { pageSize: 20 }
    expect(snapshotFrom({ pageSize: 50 }, initialViewState)).toEqual({ pageSize: 50 })
  })

  it('reports visibleCols only once it differs from initialViewState, not from "all columns"', () => {
    const initialViewState: TableViewState = { visibleCols: ['name', 'score'] }
    // Freshly resolved from the same initialViewState — this used to incorrectly show up in the
    // snapshot, since the pre-`initialViewState` implementation compared against every column
    // instead of the actual construction default.
    expect(snapshotFrom({}, initialViewState)).toEqual({})
    expect(snapshotFrom({ visibleCols: ['name'] }, initialViewState)).toEqual({
      visibleCols: ['name'],
    })
  })

  it('omits a groupBy-synced sort the same way whether it came from initialViewState or was written out explicitly', () => {
    const initialViewState: TableViewState = { groupBy: ['dept'] }
    const changed: TableViewState = {
      groupBy: ['dept'],
      sorts: [{ key: 'dept', dir: 'asc' }],
      page: 2,
    }
    expect(snapshotFrom(changed, initialViewState)).toEqual({ page: 2 })
  })
})
