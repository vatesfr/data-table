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
import { encodeRawView } from './encodeRawView'

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

describe('resolveViewState with wrongly typed input (#44)', () => {
  // Views from a hand-edited URL, stale storage or plain JS can break `TableViewState`'s types.
  const bad = (v: unknown) => v as TableViewState

  it.each([
    { filters: { name: 5 } },
    { filters: { name: 'ab' } },
    { filters: [['name', ['a']]] },
    { filters: null },
    { excludeFilters: { name: 5 } },
    { collapsedGroups: 3 },
    { visibleCols: 'x' },
    { columnOrder: 'x' },
    { groupBy: 'x' },
    { sorts: 'x' },
    { sorts: [{ key: 'name', dir: 'up' }] },
    { filterModes: { name: 'xor' } },
    { rangeFilters: { name: 5 } },
    { rangeFilters: { name: { min: 1, max: '' } } },
    { page: 'x' },
    { page: NaN },
    { pageSize: 'x' },
    { pageSize: Infinity },
    { searchQuery: 5 },
  ])('ignores %o', (view) => {
    expect(resolveViewState(bad(view), COLS)).toEqual(resolveViewState({}, COLS))
  })

  it('keeps a "__proto__" key as an ordinary entry', () => {
    const view = JSON.parse('{"rangeFilters":{"__proto__":{"min":"1","max":"2"}}}')
    const r = resolveViewState(view, COLS)
    expect(Object.getPrototypeOf(r.rangeFilters)).toBe(Object.prototype)
    expect(Object.keys(r.rangeFilters)).toEqual(['__proto__'])
  })

  it('treats a non-object view as empty', () => {
    expect(resolveViewState(bad(null), COLS)).toEqual(resolveViewState({}, COLS))
    expect(resolveViewState(bad('x'), COLS)).toEqual(resolveViewState({}, COLS))
  })

  it('falls back to initialViewState for a wrongly typed field', () => {
    const r = resolveViewState(bad({ page: 'x', groupBy: 'x' }), COLS, {
      page: 3,
      groupBy: ['score'],
    })
    expect(r.page).toBe(3)
    expect(r.groupBy).toEqual(['score'])
    expect(r.sorts).toEqual([{ key: 'score', dir: 'desc' }])
  })

  it('keeps valid fields and entries next to wrongly typed ones', () => {
    const r = resolveViewState(
      bad({
        filters: { name: 5, dept: ['a', 7] },
        sorts: [5, { key: 'name', dir: 'asc' }],
        rangeFilters: { name: null, score: { min: '1', max: '' } },
        visibleCols: ['name', 3],
        searchQuery: 'q',
        page: 'x',
      }),
      COLS,
    )
    expect(r.filters).toEqual({ dept: new Set(['a']) })
    expect(r.sorts).toEqual([{ key: 'name', dir: 'asc' }])
    expect(r.rangeFilters).toEqual({ score: { min: '1', max: '' } })
    expect(r.visibleCols).toEqual(new Set(['name']))
    expect(r.searchQuery).toBe('q')
    expect(r.page).toBe(1)
  })

  it('floors and clamps page and pageSize like setPage/setPageSize', () => {
    expect(resolveViewState({ page: 0, pageSize: -5 }, COLS)).toMatchObject({
      page: 1,
      pageSize: 0,
    })
    expect(resolveViewState({ page: 2.7, pageSize: 20.5 }, COLS)).toMatchObject({
      page: 2,
      pageSize: 20,
    })
  })

  it('ignores a wrongly typed initialViewState field', () => {
    expect(resolveViewState({}, COLS, bad({ filters: { name: 5 }, page: 'x' }))).toEqual(
      resolveViewState({}, COLS),
    )
    const input: ViewStateSnapshotInput = {
      ...resolveViewState({}, COLS),
      columns: COLS,
      initialViewState: bad({ collapsedGroups: 3 }),
    }
    expect(buildViewStateSnapshot(input)).toEqual({})
  })

  it('applies the valid fields of a decoded URL payload', () => {
    const view = decodeViewState(encodeRawView('{"f":[["name",5]],"q":"abc"}'))
    const r = resolveViewState(view!, COLS)
    expect(r.filters).toEqual({})
    expect(r.searchQuery).toBe('abc')
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
