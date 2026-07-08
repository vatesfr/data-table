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
