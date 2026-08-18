import { describe, it, expect } from 'vitest'
import { createRoot } from 'solid-js'
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
      expect(table.selectedRows()).toEqual([])
    })
  })

  it('defaults to all columns visible', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      expect(table.activeColumns()).toHaveLength(3)
    })
  })

  it('respects defaultVisibleColumns', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS, { defaultVisibleColumns: ['id', 'name'] })
      expect(table.activeColumns().map((c) => c.key)).toEqual(['id', 'name'])
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
      expect(table.numPages()).toBe(2)
    })
  })
})

describe('createTableState — row selection', () => {
  it('toggleRowSelection adds and removes by object identity', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.toggleRowSelection(ROWS[0])
      expect(table.selectedRows()).toEqual([ROWS[0]])
      table.toggleRowSelection(ROWS[0])
      expect(table.selectedRows()).toEqual([])
    })
  })

  it('selectedRows only reflects rows present in processedData', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.toggleRowSelection(ROWS[0]) // Alice
      table.toggleRowSelection(ROWS[1]) // Bob
      table.cycleFilterValue('name', 'Alice')
      expect(table.selectedRows()).toEqual([ROWS[0]])
      table.clearFilters()
      expect(table.selectedRows()).toEqual([ROWS[0], ROWS[1]])
    })
  })

  it('toggleSelectAll selects all when none are selected, deselects when any are', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.toggleSelectAll(ROWS)
      expect(table.selectedRows()).toEqual(ROWS)
      table.toggleSelectAll(ROWS)
      expect(table.selectedRows()).toEqual([])
    })
  })

  it('shift-click range selection selects the contiguous run from the anchor', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.toggleRowSelection(ROWS[0]) // anchor = Alice
      table.toggleRowSelection(ROWS[2], true) // shift-click Clara
      expect(table.selectedRows()).toEqual([ROWS[0], ROWS[1], ROWS[2]])
    })
  })

  it('clearSelection empties selection and resets the anchor', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.toggleRowSelection(ROWS[0])
      table.clearSelection()
      expect(table.selectedRows()).toEqual([])
    })
  })
})

describe('createTableState — sorting', () => {
  it('toggleSort cycles asc -> desc -> none', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.toggleSort('score')
      expect(table.sorts()).toEqual([{ key: 'score', dir: 'asc' }])
      expect(table.processedData().map((r) => r.name)).toEqual(['Bob', 'David', 'Clara', 'Alice'])
      table.toggleSort('score')
      expect(table.sorts()).toEqual([{ key: 'score', dir: 'desc' }])
      table.toggleSort('score')
      expect(table.sorts()).toEqual([])
    })
  })

  it('replaceSort discards every other active sort', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.toggleSort('name')
      table.replaceSort('score')
      expect(table.sorts()).toEqual([{ key: 'score', dir: 'asc' }])
    })
  })

  it('appendOrToggleSort adds to the existing multi-sort instead of replacing it', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.toggleSort('name')
      table.appendOrToggleSort('score')
      expect(table.sorts().map((s) => s.key)).toEqual(['name', 'score'])
    })
  })

  it('removeSort drops a single entry from a multi-sort', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.toggleSort('name')
      table.appendOrToggleSort('score')
      table.removeSort('name')
      expect(table.sorts()).toEqual([{ key: 'score', dir: 'asc' }])
    })
  })
})

describe('createTableState — filtering', () => {
  it('cycleFilterValue cycles neutral -> include -> exclude -> neutral', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.cycleFilterValue('name', 'Alice')
      expect(table.processedData()).toEqual([ROWS[0]])
      table.cycleFilterValue('name', 'Alice')
      expect(table.excludeFilters().name).toEqual(new Set(['Alice']))
      expect(table.processedData()).toEqual([ROWS[1], ROWS[2], ROWS[3]])
      table.cycleFilterValue('name', 'Alice')
      expect(table.processedData()).toEqual(ROWS)
    })
  })

  it('setRangeFilter narrows by min/max and resets page to 1', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS, { defaultPageSize: 1 })
      table.setPage(2)
      table.setRangeFilter('score', 'min', '75')
      expect(table.page()).toBe(1)
      expect(table.processedData().map((r) => r.name)).toEqual(['Alice', 'Clara'])
    })
  })

  it('clearColumnFilter only clears the requested kind, not sibling filters on the same column', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.cycleFilterValue('name', 'Alice')
      table.cycleFilterValue('name', 'Alice') // -> exclude
      table.cycleFilterValue('name', 'Bob') // -> include
      table.clearColumnFilter('name', 'exclude')
      expect(table.filters().name).toEqual(new Set(['Bob']))
      expect(table.excludeFilters().name).toEqual(new Set())
    })
  })

  it('activeFilterCount reflects include, exclude, and range filters together', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      expect(table.activeFilterCount()).toBe(0)
      table.cycleFilterValue('name', 'Alice')
      table.setRangeFilter('score', 'min', '50')
      expect(table.activeFilterCount()).toBe(2)
    })
  })
})

describe('createTableState — grouping', () => {
  it('toggleGroup removes the grouped column from activeColumns', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.toggleGroup('score')
      expect(table.activeColumns().map((c) => c.key)).toEqual(['id', 'name'])
      table.toggleGroup('score')
      expect(table.activeColumns().map((c) => c.key)).toEqual(['id', 'name', 'score'])
    })
  })
})

describe('createTableState — search', () => {
  it('setSearchQuery narrows processedData and resets page to 1', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS, { defaultPageSize: 1 })
      table.setPage(2)
      table.setSearchQuery('ali')
      expect(table.page()).toBe(1)
      expect(table.processedData()).toEqual([ROWS[0]])
    })
  })
})

describe('createTableState — clearAll', () => {
  it('resets sorts, filters, groupBy, and search together', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.toggleSort('score')
      table.cycleFilterValue('name', 'Alice')
      table.toggleGroup('name')
      table.setSearchQuery('a')
      table.clearAll()
      expect(table.sorts()).toEqual([])
      expect(table.filters()).toEqual({})
      expect(table.groupBy()).toEqual([])
      expect(table.searchQuery()).toBe('')
      expect(table.processedData()).toEqual(ROWS)
    })
  })
})

describe('createTableState — view state persistence', () => {
  it('getViewState/setViewState round-trips a non-default view', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      table.toggleSort('score')
      table.cycleFilterValue('name', 'Alice')
      table.setSearchQuery('a')
      const view = table.getViewState()

      const table2 = createTableState(ROWS, COLS)
      table2.setViewState(view)
      expect(table2.sorts()).toEqual([{ key: 'score', dir: 'asc' }])
      expect(table2.filters().name).toEqual(new Set(['Alice']))
      expect(table2.searchQuery()).toBe('a')
    })
  })

  it('getViewState omits fields that are at their default', () => {
    withRoot(() => {
      const table = createTableState(ROWS, COLS)
      expect(table.getViewState()).toEqual({})
    })
  })
})

describe('createTableState — setData/setColumns (vanilla-specific: no consumer render loop)', () => {
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
      table.setColumns([{ key: 'id', label: 'ID' }])
      expect(table.activeColumns().map((c) => c.key)).toEqual(['id'])
    })
  })
})
