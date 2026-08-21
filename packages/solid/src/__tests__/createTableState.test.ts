import { describe, it, expect } from 'vitest'
import { createRoot, createSignal } from 'solid-js'
import { createTableState } from '../createTableState'
import type { ColumnDef } from '../types'

interface Row {
  id: number
  name: string
  score: number
}

const COLS: ColumnDef<Row>[] = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name', filterable: true },
  { key: 'score', label: 'Score', filterable: true, type: 'number' },
]

const ROWS: Row[] = [
  { id: 1, name: 'Alice', score: 90 },
  { id: 2, name: 'Bob', score: 60 },
  { id: 3, name: 'Clara', score: 80 },
  { id: 4, name: 'David', score: 70 },
]

// Runs `fn` inside a Solid reactive root, disposing it afterward — the Solid-equivalent of
// React's renderHook: createSignal/createMemo work outside a root, but a root is what lets
// memos actually be cleaned up rather than leaking (and silences Solid's "computations created
// outside a `createRoot` will never be disposed" warning). Unlike React's `act(...)`, no
// wrapping is needed around individual state updates — Solid signals update synchronously, and
// a createMemo's getter always reflects the latest value the moment it's called, with no
// re-render to wait for.
function withRoot<T>(fn: () => T): T {
  return createRoot((dispose) => {
    const result = fn()
    dispose()
    return result
  })
}

describe('createTableState — initial state', () => {
  it('exposes all rows in processedData and selectedRows is empty', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      expect(table.processedData()).toEqual(ROWS)
      expect(table.selection.rows()).toEqual([])
    })
  })

  it('defaults to all columns visible', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      expect(table.columns.active()).toHaveLength(3)
    })
  })

  it('respects defaultVisibleColumns', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS, { defaultVisibleColumns: ['id', 'name'] })
      expect(table.columns.active().map((c) => c.key)).toEqual(['id', 'name'])
    })
  })

  it('defaults pageSize to 0 (no pagination, all rows on one page)', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      expect(table.pagedData()).toHaveLength(4)
    })
  })

  it('respects defaultPageSize', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS, { defaultPageSize: 2 })
      expect(table.pagedData()).toHaveLength(2)
      expect(table.pagination.numPages()).toBe(2)
    })
  })

  it('page self-clamps when numPages shrinks without an explicit setPage call', () => {
    withRoot(() => {
      // e.g. a group being collapsed, or (as reproduced here) data shrinking via setData —
      // nothing calls setPage, so pagination.page must reflect the new, smaller numPages on
      // its own rather than reporting a stale out-of-range page number.
      const table = createTableState(ROWS, COLS, { defaultPageSize: 2 })
      table.pagination.setPage(2)
      expect(table.pagination.page()).toBe(2)
      table.setData(ROWS.slice(0, 2))
      expect(table.pagination.numPages()).toBe(1)
      expect(table.pagination.page()).toBe(1)
    })
  })
})

describe('createTableState — row selection', () => {
  it('toggleRowSelection adds and removes by object identity', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.selection.toggle(ROWS[0])
      expect(table.selection.rows()).toEqual([ROWS[0]])
      table.selection.toggle(ROWS[0])
      expect(table.selection.rows()).toEqual([])
    })
  })

  it('selectedRows only reflects rows present in processedData', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.selection.toggle(ROWS[0]) // Alice
      table.selection.toggle(ROWS[1]) // Bob
      table.filter.cycleValue('name', 'Alice')
      expect(table.selection.rows()).toEqual([ROWS[0]])
      table.filter.clear()
      expect(table.selection.rows()).toEqual([ROWS[0], ROWS[1]])
    })
  })

  it('toggleSelectAll selects all when none are selected, deselects when any are', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.selection.toggleAll(ROWS)
      expect(table.selection.rows()).toEqual(ROWS)
      table.selection.toggleAll(ROWS)
      expect(table.selection.rows()).toEqual([])
    })
  })

  it('shift-click range selection selects the contiguous run from the anchor', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.selection.toggle(ROWS[0]) // anchor = Alice
      table.selection.toggle(ROWS[2], true) // shift-click Clara
      expect(table.selection.rows()).toEqual([ROWS[0], ROWS[1], ROWS[2]])
    })
  })

  it('clearSelection empties selection and resets the anchor', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.selection.toggle(ROWS[0])
      table.selection.clear()
      expect(table.selection.rows()).toEqual([])
    })
  })
})

describe('createTableState — getRowId (selection identity)', () => {
  it('without getRowId, setData with new row objects silently drops selection', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.selection.toggle(ROWS[0])
      expect(table.selection.rows()).toEqual([ROWS[0]])
      table.setData(ROWS.map((r) => ({ ...r })))
      expect(table.selection.rows()).toEqual([])
    })
  })

  it('with getRowId, selection survives setData producing new row objects', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS, { getRowId: (r) => r.id })
      table.selection.toggle(ROWS[0]) // Alice, id 1
      const refetched = ROWS.map((r) => ({ ...r }))
      table.setData(refetched)
      expect(table.selection.rows()).toEqual([refetched[0]])
      // The raw selection Set itself is reconciled too, not just selectedRows' derived view.
      expect([...table.selection.all()]).toEqual([refetched[0]])
    })
  })

  it('with getRowId, a row no longer present after setData is dropped from selection', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS, { getRowId: (r) => r.id })
      table.selection.toggle(ROWS[0]) // Alice, id 1
      table.setData(ROWS.slice(1).map((r) => ({ ...r })))
      expect(table.selection.rows()).toEqual([])
    })
  })

  it('with getRowId, toggleRowSelection on a fresh-object row with a selected id deselects it', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS, { getRowId: (r) => r.id })
      table.selection.toggle(ROWS[0]) // Alice, id 1
      const refetched = ROWS.map((r) => ({ ...r }))
      table.setData(refetched)
      table.selection.toggle(refetched[0]) // same id, different reference
      expect(table.selection.rows()).toEqual([])
    })
  })

  it('with getRowId, toggleSelectAll treats a stale-reference id as already selected', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS, { getRowId: (r) => r.id })
      table.selection.toggle(ROWS[0]) // Alice, id 1
      const refetched = ROWS.map((r) => ({ ...r }))
      table.setData(refetched)
      table.selection.toggleAll(refetched)
      expect(table.selection.rows()).toEqual([])
    })
  })
})

describe('createTableState — sorting', () => {
  it('toggleSort cycles asc -> desc -> none', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.sort.toggle('score')
      expect(table.sort.entries()).toEqual([{ key: 'score', dir: 'asc' }])
      expect(table.processedData().map((r) => r.name)).toEqual(['Bob', 'David', 'Clara', 'Alice'])
      table.sort.toggle('score')
      expect(table.sort.entries()).toEqual([{ key: 'score', dir: 'desc' }])
      table.sort.toggle('score')
      expect(table.sort.entries()).toEqual([])
    })
  })

  it('replaceSort discards every other active sort', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.sort.toggle('name')
      table.sort.replace('score')
      expect(table.sort.entries()).toEqual([{ key: 'score', dir: 'asc' }])
    })
  })

  it('appendOrToggleSort adds to the existing multi-sort instead of replacing it', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.sort.toggle('name')
      table.sort.appendOrToggle('score')
      expect(table.sort.entries().map((s) => s.key)).toEqual(['name', 'score'])
    })
  })

  it('removeSort drops a single entry from a multi-sort', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.sort.toggle('name')
      table.sort.appendOrToggle('score')
      table.sort.remove('name')
      expect(table.sort.entries()).toEqual([{ key: 'score', dir: 'asc' }])
    })
  })
})

describe('createTableState — filtering', () => {
  it('cycleFilterValue cycles neutral -> include -> exclude -> neutral', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.filter.cycleValue('name', 'Alice')
      expect(table.processedData()).toEqual([ROWS[0]])
      table.filter.cycleValue('name', 'Alice')
      expect(table.filter.exclude().name).toEqual(new Set(['Alice']))
      expect(table.processedData()).toEqual([ROWS[1], ROWS[2], ROWS[3]])
      table.filter.cycleValue('name', 'Alice')
      expect(table.processedData()).toEqual(ROWS)
    })
  })

  it('setRangeFilter narrows by min/max and resets page to 1', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS, { defaultPageSize: 1 })
      table.pagination.setPage(2)
      table.filter.setRange('score', 'min', '75')
      expect(table.pagination.page()).toBe(1)
      expect(table.processedData().map((r) => r.name)).toEqual(['Alice', 'Clara'])
    })
  })

  it('clearColumnFilter only clears the requested kind, not sibling filters on the same column', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.filter.cycleValue('name', 'Alice')
      table.filter.cycleValue('name', 'Alice') // -> exclude
      table.filter.cycleValue('name', 'Bob') // -> include
      table.filter.clearColumn('name', 'exclude')
      expect(table.filter.include().name).toEqual(new Set(['Bob']))
      expect(table.filter.exclude().name).toEqual(new Set())
    })
  })

  it('activeFilterCount reflects include, exclude, and range filters together', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      expect(table.filter.activeCount()).toBe(0)
      table.filter.cycleValue('name', 'Alice')
      table.filter.setRange('score', 'min', '50')
      expect(table.filter.activeCount()).toBe(2)
    })
  })
})

describe('createTableState — grouping', () => {
  it('toggleGroup removes the grouped column from activeColumns', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.group.toggle('score')
      expect(table.columns.active().map((c) => c.key)).toEqual(['id', 'name'])
      table.group.toggle('score')
      expect(table.columns.active().map((c) => c.key)).toEqual(['id', 'name', 'score'])
    })
  })

  it('keepVisibleWhenGrouped keeps a grouped column in activeColumns', () => {
    withRoot(() => {
      const COLS_WITH_KEEP: ColumnDef<Row>[] = [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name', keepVisibleWhenGrouped: true },
        { key: 'score', label: 'Score', type: 'number' },
      ]
      const table = createTableState(ROWS, COLS_WITH_KEEP)
      table.group.toggle('score')
      expect(table.columns.active().map((c) => c.key)).not.toContain('score')
      table.group.toggle('score')
      table.group.toggle('name')
      expect(table.columns.active().map((c) => c.key)).toContain('name')
      table.group.remove('name')
      expect(table.columns.active().map((c) => c.key)).toContain('name')
    })
  })
})

describe('createTableState — search', () => {
  it('setSearchQuery narrows processedData and resets page to 1', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS, { defaultPageSize: 1 })
      table.pagination.setPage(2)
      table.search.setQuery('ali')
      expect(table.pagination.page()).toBe(1)
      expect(table.processedData()).toEqual([ROWS[0]])
    })
  })
})

describe('createTableState — clearAll', () => {
  it('resets sorts, filters, groupBy, and search together', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.sort.toggle('score')
      table.filter.cycleValue('name', 'Alice')
      table.group.toggle('name')
      table.search.setQuery('a')
      table.clearAll()
      expect(table.sort.entries()).toEqual([])
      expect(table.filter.include()).toEqual({})
      expect(table.group.by()).toEqual([])
      expect(table.search.query()).toBe('')
      expect(table.processedData()).toEqual(ROWS)
    })
  })
})

describe('createTableState — view state persistence', () => {
  it('getViewState/setViewState round-trips a non-default view', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.sort.toggle('score')
      table.filter.cycleValue('name', 'Alice')
      table.search.setQuery('a')
      const view = table.getViewState()

      const table2 = createTableState(ROWS, COLS)
      table2.setViewState(view)
      expect(table2.sort.entries()).toEqual([{ key: 'score', dir: 'asc' }])
      expect(table2.filter.include().name).toEqual(new Set(['Alice']))
      expect(table2.search.query()).toBe('a')
    })
  })

  it('getViewState omits fields that are at their default', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      expect(table.getViewState()).toEqual({})
    })
  })
})

describe('createTableState — setData/setColumns (no consumer render loop)', () => {
  it('setData updates processedData reactively', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      const more = [...ROWS, { id: 5, name: 'Eve', score: 100 }]
      table.setData(more)
      expect(table.processedData()).toEqual(more)
    })
  })

  it('setColumns updates activeColumns reactively', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.columns.set([{ key: 'id', label: 'ID' }])
      expect(table.columns.active().map((c) => c.key)).toEqual(['id'])
    })
  })

  it('setColumns with a fully disjoint key set keeps every new column visible, instead of filtering all of them out', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      const newCols: ColumnDef<Row>[] = [
        { key: 'sku', label: 'SKU' },
        { key: 'qty', label: 'Qty', type: 'number' },
      ]
      table.columns.set(newCols)
      expect(table.columns.active().map((c) => c.key)).toEqual(['sku', 'qty'])
    })
  })

  it("setColumns preserves an existing column's hidden state and defaults a genuinely new column to visible", () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.columns.toggleVisibility('score') // hide it
      table.columns.set([...COLS, { key: 'extra', label: 'Extra' }])
      expect(table.columns.active().map((c) => c.key)).toEqual(['id', 'name', 'extra'])
    })
  })
})

describe('createTableState — accessor inputs for data/columns', () => {
  it('tracks a data accessor reactively, with no explicit setData call needed', () => {
    // Deliberately not using withRoot here: mutating the signal from *inside* the same
    // createRoot call that constructs the table would nest it inside that call's own still-open
    // update transaction, where Solid defers a render effect's re-run rather than flushing it
    // synchronously (only pure computations — memos — flush synchronously while nested; this is
    // exactly the "createMemo's getter always reflects the latest value" guarantee this file's
    // own top comment describes, which does not extend to effects). Mutating after the root's
    // own initial setup call has already returned — as any real, later signal write from an
    // event handler naturally would — flushes synchronously instead, so this is the realistic
    // shape rather than a workaround.
    const [rows, setRows] = createSignal(ROWS)
    let table!: ReturnType<typeof createTableState<Row>>
    let dispose!: () => void
    createRoot((d) => {
      dispose = d
      table = createTableState(rows, COLS)
    })
    expect(table.processedData()).toEqual(ROWS)
    const more = [...ROWS, { id: 5, name: 'Eve', score: 100 }]
    setRows(more)
    expect(table.processedData()).toEqual(more)
    dispose()
  })

  it('tracks a columns accessor reactively, reconciling visibleCols the same way setColumns does', () => {
    const [cols, setCols] = createSignal<ColumnDef<Row>[]>(COLS)
    let table!: ReturnType<typeof createTableState<Row>>
    let dispose!: () => void
    createRoot((d) => {
      dispose = d
      table = createTableState(ROWS, cols)
    })
    expect(table.columns.active()).toHaveLength(3)
    setCols([{ key: 'sku', label: 'SKU' }])
    expect(table.columns.active().map((c) => c.key)).toEqual(['sku'])
    dispose()
  })

  it('a plain array argument is a one-time initial value, not tracked afterward', () => {
    withRoot(() => {
      // Passing ROWS directly (not an accessor) is exactly today's existing behavior: mutating
      // it externally has no effect on the table, since it was only ever read once at construction.
      const table = createTableState(ROWS, COLS)
      const externalCopy = [...ROWS]
      externalCopy.push({ id: 5, name: 'Eve', score: 100 })
      expect(table.processedData()).toEqual(ROWS)
    })
  })
})

describe('createTableState — accessor input for options (labels/defaultGroupsCollapsed/getRowId stay live)', () => {
  it('a plain options object is captured once, matching pre-existing behavior', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS, { labels: { rowCount: () => 'frozen' } })
      expect(table.labels().rowCount(0, 0)).toBe('frozen')
    })
  })

  it('tracks labels reactively when options is given as an Accessor', () => {
    const [labels, setLabels] = createSignal({ rowCount: (): string => 'v1' })
    let table!: ReturnType<typeof createTableState<Row>>
    let dispose!: () => void
    createRoot((d) => {
      dispose = d
      table = createTableState(ROWS, COLS, () => ({ labels: labels() }))
    })
    expect(table.labels().rowCount(0, 0)).toBe('v1')
    setLabels({ rowCount: () => 'v2' })
    expect(table.labels().rowCount(0, 0)).toBe('v2')
    dispose()
  })

  it('tracks defaultGroupsCollapsed reactively when options is given as an Accessor', () => {
    const [defaultGroupsCollapsed, setDefaultGroupsCollapsed] = createSignal(true)
    let table!: ReturnType<typeof createTableState<Row>>
    let dispose!: () => void
    createRoot((d) => {
      dispose = d
      table = createTableState(ROWS, COLS, () => ({
        defaultGroupsCollapsed: defaultGroupsCollapsed(),
      }))
    })
    expect(table.group.defaultCollapsed()).toBe(true)
    setDefaultGroupsCollapsed(false)
    expect(table.group.defaultCollapsed()).toBe(false)
    dispose()
  })

  it('tracks getRowId reactively when options is given as an Accessor', () => {
    const [getRowId, setGetRowId] = createSignal<((row: Row) => string | number) | undefined>(
      undefined,
    )
    let table!: ReturnType<typeof createTableState<Row>>
    let dispose!: () => void
    createRoot((d) => {
      dispose = d
      table = createTableState(ROWS, COLS, () => ({ getRowId: getRowId() }))
    })
    // Without getRowId, selection tracks by object identity — a fresh object with the same `id`
    // does not count as already selected.
    table.selection.toggle(ROWS[0])
    expect(table.selection.rows()).toEqual([ROWS[0]])
    setGetRowId(() => (row: Row) => row.id)
    // Now that getRowId is live, toggling a *different* object sharing id 1 is recognized as the
    // same row and deselects it instead of adding a second entry.
    table.selection.toggle({ ...ROWS[0] })
    expect(table.selection.rows()).toEqual([])
    dispose()
  })
})
