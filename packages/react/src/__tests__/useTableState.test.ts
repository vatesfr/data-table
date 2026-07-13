import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTableState } from '../useTableState'
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

describe('useTableState — initial state', () => {
  it('exposes all rows in processedData and selectedRows is empty', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    expect(result.current.processedData).toEqual(ROWS)
    expect(result.current.selectedRows).toEqual([])
  })

  it('defaults to all columns visible', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    expect(result.current.activeColumns).toHaveLength(3)
  })

  it('respects defaultVisibleColumns', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, ['id', 'name']))
    expect(result.current.activeColumns.map((c) => c.key)).toEqual(['id', 'name'])
  })

  it('defaults pageSize to 0 (no pagination, all rows on one page)', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    expect(result.current.pagedData).toHaveLength(4)
  })

  it('respects defaultPageSize', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, undefined, undefined, 2))
    expect(result.current.pagedData).toHaveLength(2)
    expect(result.current.numPages).toBe(2)
  })
})

describe('useTableState — row selection', () => {
  it('toggleRowSelection adds and removes by object identity', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.toggleRowSelection(ROWS[0])
    })
    expect(result.current.selectedRows).toEqual([ROWS[0]])
    act(() => {
      result.current.toggleRowSelection(ROWS[0])
    })
    expect(result.current.selectedRows).toEqual([])
  })

  it('selectedRows only reflects rows present in processedData', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.toggleRowSelection(ROWS[0]) // Alice
      result.current.toggleRowSelection(ROWS[1]) // Bob
    })
    // Filter down to Alice only — Bob disappears from selectedRows but stays in selection
    act(() => {
      result.current.toggleFilter('name', 'Alice')
    })
    expect(result.current.selectedRows).toEqual([ROWS[0]])
    // Clearing the filter brings Bob back into selectedRows
    act(() => {
      result.current.clearFilters()
    })
    expect(result.current.selectedRows).toEqual([ROWS[0], ROWS[1]])
  })

  it('toggleSelectAll selects all when none are selected', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.toggleSelectAll(ROWS)
    })
    expect(result.current.selectedRows).toHaveLength(4)
  })

  it('toggleSelectAll deselects all when all are selected', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.toggleSelectAll(ROWS)
    })
    act(() => {
      result.current.toggleSelectAll(ROWS)
    })
    expect(result.current.selectedRows).toEqual([])
  })

  it('toggleSelectAll selects all when only some are selected (partial)', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.toggleRowSelection(ROWS[0])
    })
    act(() => {
      result.current.toggleSelectAll(ROWS)
    })
    expect(result.current.selectedRows).toHaveLength(4)
  })

  it('toggleSelectAll with empty array is a no-op', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.toggleRowSelection(ROWS[0])
    })
    act(() => {
      result.current.toggleSelectAll([])
    })
    expect(result.current.selectedRows).toHaveLength(1)
  })

  it('clearSelection empties the selection', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.toggleSelectAll(ROWS)
    })
    act(() => {
      result.current.clearSelection()
    })
    expect(result.current.selectedRows).toEqual([])
  })

  it('shift-click toggleRowSelection selects the range between the last click and the target', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.toggleRowSelection(ROWS[0]) // anchor = Alice
    })
    act(() => {
      result.current.toggleRowSelection(ROWS[2], true) // shift-click Clara
    })
    expect(result.current.selectedRows).toEqual([ROWS[0], ROWS[1], ROWS[2]])
  })

  it('shift-click deselects the range when the clicked row is already selected', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.toggleSelectAll(ROWS) // all four selected
    })
    act(() => {
      result.current.toggleRowSelection(ROWS[0]) // anchor = Alice, now deselected
    })
    act(() => {
      result.current.toggleRowSelection(ROWS[0]) // re-select Alice, anchor stays Alice
    })
    act(() => {
      result.current.toggleRowSelection(ROWS[2], true) // shift-click already-selected Clara
    })
    // Clara was selected, so the whole range [Alice, Bob, Clara] gets deselected; David stays.
    expect(result.current.selectedRows).toEqual([ROWS[3]])
  })

  it('shift-click with no prior anchor falls back to a plain toggle', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.toggleRowSelection(ROWS[2], true)
    })
    expect(result.current.selectedRows).toEqual([ROWS[2]])
  })
})

describe('useTableState — column visibility', () => {
  it('toggleColVisibility hides a column', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.toggleColVisibility('name')
    })
    expect(result.current.activeColumns.map((c) => c.key)).not.toContain('name')
  })

  it('toggleColVisibility shows a hidden column', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, ['id']))
    act(() => {
      result.current.toggleColVisibility('name')
    })
    expect(result.current.activeColumns.map((c) => c.key)).toContain('name')
  })

  it('cannot hide the last visible column', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, ['id']))
    act(() => {
      result.current.toggleColVisibility('id')
    })
    expect(result.current.activeColumns.map((c) => c.key)).toContain('id')
  })
})

describe('useTableState — column ordering', () => {
  it('defaults to natural column order', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    expect(result.current.orderedColumns.map((c) => c.key)).toEqual(['id', 'name', 'score'])
  })

  it('moveColumn reorders by drag-and-drop semantics (insert before target)', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.moveColumn('score', 'id')
    })
    expect(result.current.orderedColumns.map((c) => c.key)).toEqual(['score', 'id', 'name'])
    expect(result.current.activeColumns.map((c) => c.key)).toEqual(['score', 'id', 'name'])
  })

  it('moveColumnBy swaps with the neighbor in the given direction', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.moveColumnBy('id', 1)
    })
    expect(result.current.orderedColumns.map((c) => c.key)).toEqual(['name', 'id', 'score'])
  })

  it('moveColumnBy is a no-op past the boundary', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.moveColumnBy('id', -1)
    })
    expect(result.current.orderedColumns.map((c) => c.key)).toEqual(['id', 'name', 'score'])
  })

  it('preserves order across visibility toggles', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.moveColumn('score', 'id')
      result.current.toggleColVisibility('name')
    })
    expect(result.current.activeColumns.map((c) => c.key)).toEqual(['score', 'id'])
    act(() => {
      result.current.toggleColVisibility('name')
    })
    expect(result.current.activeColumns.map((c) => c.key)).toEqual(['score', 'id', 'name'])
  })
})

describe('useTableState — pagination', () => {
  it('setPage navigates between pages', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, undefined, undefined, 2))
    act(() => {
      result.current.setPage(2)
    })
    expect(result.current.page).toBe(2)
    expect(result.current.pagedData).toEqual([ROWS[2], ROWS[3]])
  })

  it('setPage clamps to numPages', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, undefined, undefined, 2))
    act(() => {
      result.current.setPage(100)
    })
    expect(result.current.page).toBe(2)
  })

  it('setPage clamps to 1 at minimum', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, undefined, undefined, 2))
    act(() => {
      result.current.setPage(-5)
    })
    expect(result.current.page).toBe(1)
  })

  it('setPageSize resets page to 1', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, undefined, undefined, 2))
    act(() => {
      result.current.setPage(2)
    })
    act(() => {
      result.current.setPageSize(3)
    })
    expect(result.current.page).toBe(1)
  })
})

describe('useTableState — filters reset page', () => {
  it('toggleFilter resets page to 1', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, undefined, undefined, 2))
    act(() => {
      result.current.setPage(2)
    })
    act(() => {
      result.current.toggleFilter('name', 'Alice')
    })
    expect(result.current.page).toBe(1)
  })

  it('setRangeFilter resets page to 1', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, undefined, undefined, 2))
    act(() => {
      result.current.setPage(2)
    })
    act(() => {
      result.current.setRangeFilter('score', 'min', '70')
    })
    expect(result.current.page).toBe(1)
  })

  it('toggleFilterAll resets page to 1', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, undefined, undefined, 2))
    act(() => {
      result.current.setPage(2)
    })
    act(() => {
      result.current.toggleFilterAll('name', ['Alice', 'Bob'])
    })
    expect(result.current.page).toBe(1)
  })
})

describe('useTableState — toggleFilterAll', () => {
  it('selects all given values when none are selected', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.toggleFilterAll('name', ['Alice', 'Bob'])
    })
    expect(result.current.filters['name']?.has('Alice')).toBe(true)
    expect(result.current.filters['name']?.has('Bob')).toBe(true)
  })

  it('deselects all given values when all are already selected', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.toggleFilterAll('name', ['Alice', 'Bob'])
    })
    act(() => {
      result.current.toggleFilterAll('name', ['Alice', 'Bob'])
    })
    expect(result.current.filters['name']?.size ?? 0).toBe(0)
  })

  it('only affects the given values, leaving other selections for the same key untouched', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.toggleFilter('name', 'Clara')
      result.current.toggleFilterAll('name', ['Alice', 'Bob'])
    })
    expect(result.current.filters['name']?.has('Clara')).toBe(true)
    expect(result.current.filters['name']?.has('Alice')).toBe(true)
    expect(result.current.filters['name']?.has('Bob')).toBe(true)
  })
})

describe('useTableState — setFilterValues', () => {
  it('adds the given values unconditionally when selected is true', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.setFilterValues('name', ['Alice', 'Bob'], true)
    })
    expect(result.current.filters['name']?.has('Alice')).toBe(true)
    expect(result.current.filters['name']?.has('Bob')).toBe(true)
  })

  it('removes the given values unconditionally when selected is false', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.setFilterValues('name', ['Alice', 'Bob', 'Clara'], true)
    })
    act(() => {
      result.current.setFilterValues('name', ['Alice', 'Bob'], false)
    })
    expect(result.current.filters['name']?.has('Alice')).toBe(false)
    expect(result.current.filters['name']?.has('Bob')).toBe(false)
    expect(result.current.filters['name']?.has('Clara')).toBe(true)
  })
})

describe('useTableState — filters reset page (clearFilters)', () => {
  it('clearFilters resets page to 1', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, undefined, undefined, 2))
    act(() => {
      result.current.setPage(2)
    })
    act(() => {
      result.current.clearFilters()
    })
    expect(result.current.page).toBe(1)
  })
})

describe('useTableState — search', () => {
  it('defaults searchQuery to empty string', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    expect(result.current.searchQuery).toBe('')
  })

  it('setSearchQuery filters processedData', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.setSearchQuery('ali')
    })
    expect(result.current.processedData.map((r) => r.name)).toEqual(['Alice'])
  })

  it('setSearchQuery resets page to 1', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS, undefined, undefined, 2))
    act(() => {
      result.current.setPage(2)
    })
    act(() => {
      result.current.setSearchQuery('a')
    })
    expect(result.current.page).toBe(1)
  })

  it('clearAll resets searchQuery', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.setSearchQuery('alice')
    })
    act(() => {
      result.current.clearAll()
    })
    expect(result.current.searchQuery).toBe('')
    expect(result.current.processedData).toHaveLength(4)
  })
})

interface Game {
  id: number
  name: string
  tags: string[]
}

const GAME_COLS: ColumnDef<Game>[] = [
  { key: 'name', label: 'Name' },
  { key: 'tags', label: 'Tags', filterable: true, groupable: true },
]

const GAMES: Game[] = [
  { id: 1, name: 'Game A', tags: ['Action', 'RPG'] },
  { id: 2, name: 'Game B', tags: ['Action', 'Adventure'] },
]

const GAMES_WITH_EMPTY: Game[] = [...GAMES, { id: 3, name: 'Game C', tags: [] }]

describe('useTableState — multi-value (array) columns', () => {
  it('stringValueMap flattens array values into individual filter options', () => {
    const { result } = renderHook(() => useTableState(GAMES, GAME_COLS))
    expect(result.current.stringValueMap['tags']).toEqual(['Action', 'Adventure', 'RPG'])
  })

  it('stringValueCounts tallies how many rows have each value', () => {
    const { result } = renderHook(() => useTableState(GAMES, GAME_COLS))
    expect(result.current.stringValueCounts['tags']?.get('Action')).toBe(2)
    expect(result.current.stringValueCounts['tags']?.get('RPG')).toBe(1)
  })

  it("stringValueCounts for a column ignores that column's own active filter (faceted)", () => {
    const { result } = renderHook(() => useTableState(GAMES, GAME_COLS))
    act(() => {
      result.current.toggleFilter('tags', 'RPG')
    })
    expect(result.current.stringValueCounts['tags']?.get('Action')).toBe(2)
  })

  it('toggleFilter matches rows whose array contains the selected value', () => {
    const { result } = renderHook(() => useTableState(GAMES, GAME_COLS))
    act(() => {
      result.current.toggleFilter('tags', 'RPG')
    })
    expect(result.current.processedData.map((g) => g.name)).toEqual(['Game A'])
  })

  it('groupedData fans a row into one group per array item', () => {
    const { result } = renderHook(() => useTableState(GAMES, GAME_COLS))
    act(() => {
      result.current.toggleGroup('tags')
    })
    expect(result.current.groupedData.map((g) => g.key).sort()).toEqual([
      'Action',
      'Adventure',
      'RPG',
    ])
  })

  it('stringValueMap lists a "(none)" entry for rows with an empty array', () => {
    const { result } = renderHook(() => useTableState(GAMES_WITH_EMPTY, GAME_COLS))
    expect(result.current.stringValueMap['tags']).toEqual(['(none)', 'Action', 'Adventure', 'RPG'])
  })

  it('groupedData buckets rows with an empty array under "(none)"', () => {
    const { result } = renderHook(() => useTableState(GAMES_WITH_EMPTY, GAME_COLS))
    act(() => {
      result.current.toggleGroup('tags')
    })
    const noneGroup = result.current.groupedData.find((g) => g.key === '(none)')
    expect(noneGroup?.rows.map((r) => r.name)).toEqual(['Game C'])
  })

  it('uses a custom emptyValue label when provided', () => {
    const { result } = renderHook(() =>
      useTableState(GAMES_WITH_EMPTY, GAME_COLS, undefined, { emptyValue: 'N/A' }),
    )
    expect(result.current.stringValueMap['tags']).toContain('N/A')
    act(() => {
      result.current.toggleGroup('tags')
    })
    expect(result.current.groupedData.map((g) => g.key)).toContain('N/A')
  })
})

describe('useTableState — computed columns', () => {
  const COMPUTED_COLS: ColumnDef<Row>[] = [
    ...COLS,
    {
      key: 'grade',
      label: 'Grade',
      groupable: true,
      value: (row) => (row.score >= 80 ? 'A' : 'B'),
    },
  ]

  it('sorts by a computed column value', () => {
    const { result } = renderHook(() => useTableState(ROWS, COMPUTED_COLS))
    act(() => {
      result.current.toggleSort('grade')
    })
    expect(result.current.processedData.map((r) => r.name)).toEqual([
      'Alice',
      'Clara',
      'Bob',
      'David',
    ])
  })

  it('groups by a computed column value', () => {
    const { result } = renderHook(() => useTableState(ROWS, COMPUTED_COLS))
    act(() => {
      result.current.toggleGroup('grade')
    })
    expect(result.current.groupedData.find((g) => g.key === 'A')?.rows.map((r) => r.name)).toEqual([
      'Alice',
      'Clara',
    ])
    expect(result.current.groupedData.find((g) => g.key === 'B')?.rows.map((r) => r.name)).toEqual([
      'Bob',
      'David',
    ])
  })
})

describe('useTableState — view state', () => {
  it('getViewState omits fields still at their default', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    expect(result.current.getViewState()).toEqual({})
  })

  it('getViewState captures changes made through actions', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.toggleSort('score')
      result.current.toggleFilter('name', 'Alice')
      result.current.setPage(1)
    })
    expect(result.current.getViewState()).toEqual({
      sorts: [{ key: 'score', dir: 'asc' }],
      filters: { name: ['Alice'] },
    })
  })

  it('setViewState applies a snapshot and getViewState round-trips it', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    const view = {
      sorts: [{ key: 'score', dir: 'desc' as const }],
      groupBy: ['name'],
      searchQuery: 'a',
    }
    act(() => {
      result.current.setViewState(view)
    })
    expect(result.current.sorts).toEqual(view.sorts)
    expect(result.current.groupBy).toEqual(view.groupBy)
    expect(result.current.searchQuery).toBe('a')
    expect(result.current.getViewState()).toEqual(view)
  })

  it('setViewState resets fields absent from the given view', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.toggleSort('score')
      result.current.setSearchQuery('a')
    })
    act(() => {
      result.current.setViewState({ groupBy: ['name'] })
    })
    expect(result.current.sorts).toEqual([])
    expect(result.current.searchQuery).toBe('')
    expect(result.current.groupBy).toEqual(['name'])
  })

  it('setViewState falls back to default visible columns when given stale keys', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.setViewState({ visibleCols: ['nonexistent'] })
    })
    expect(result.current.activeColumns.map((c) => c.key)).toEqual(['id', 'name', 'score'])
  })

  it('getViewState captures columnOrder and setViewState round-trips it', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.moveColumn('score', 'id')
    })
    const view = result.current.getViewState()
    expect(view.columnOrder).toEqual(['score', 'id', 'name'])
    act(() => {
      result.current.setViewState({})
    })
    expect(result.current.orderedColumns.map((c) => c.key)).toEqual(['id', 'name', 'score'])
    act(() => {
      result.current.setViewState(view)
    })
    expect(result.current.orderedColumns.map((c) => c.key)).toEqual(['score', 'id', 'name'])
  })

  it('setViewState drops stale keys from columnOrder', () => {
    const { result } = renderHook(() => useTableState(ROWS, COLS))
    act(() => {
      result.current.setViewState({ columnOrder: ['score', 'ghost', 'id', 'name'] })
    })
    expect(result.current.orderedColumns.map((c) => c.key)).toEqual(['score', 'id', 'name'])
  })
})
