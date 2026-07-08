import { describe, it, expect } from 'vitest'
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
    const { processedData, selectedRows } = useTableState(ROWS, COLS)
    expect(processedData.value).toEqual(ROWS)
    expect(selectedRows.value).toEqual([])
  })

  it('defaults to all columns visible', () => {
    const { activeColumns } = useTableState(ROWS, COLS)
    expect(activeColumns.value).toHaveLength(3)
  })

  it('respects defaultVisibleColumns option', () => {
    const { activeColumns } = useTableState(ROWS, COLS, { defaultVisibleColumns: ['id', 'name'] })
    expect(activeColumns.value.map((c) => c.key)).toEqual(['id', 'name'])
  })

  it('defaults pageSize to 0 (no pagination, all rows on one page)', () => {
    const { pagedData } = useTableState(ROWS, COLS)
    expect(pagedData.value).toHaveLength(4)
  })

  it('respects defaultPageSize option', () => {
    const { pagedData, numPages } = useTableState(ROWS, COLS, { defaultPageSize: 2 })
    expect(pagedData.value).toHaveLength(2)
    expect(numPages.value).toBe(2)
  })
})

describe('useTableState — row selection', () => {
  it('toggleRowSelection adds and removes by object identity', () => {
    const { selectedRows, toggleRowSelection } = useTableState(ROWS, COLS)
    toggleRowSelection(ROWS[0])
    expect(selectedRows.value).toEqual([ROWS[0]])
    toggleRowSelection(ROWS[0])
    expect(selectedRows.value).toEqual([])
  })

  it('selectedRows only reflects rows present in processedData', () => {
    const { selectedRows, toggleRowSelection, toggleFilter, clearFilters } = useTableState(
      ROWS,
      COLS,
    )
    toggleRowSelection(ROWS[0]) // Alice
    toggleRowSelection(ROWS[1]) // Bob
    // Filter down to Alice only — Bob disappears from selectedRows but stays in selection
    toggleFilter('name', 'Alice')
    expect(selectedRows.value).toEqual([ROWS[0]])
    // Clearing the filter brings Bob back into selectedRows
    clearFilters()
    expect(selectedRows.value).toEqual([ROWS[0], ROWS[1]])
  })

  it('toggleSelectAll selects all when none are selected', () => {
    const { selectedRows, toggleSelectAll } = useTableState(ROWS, COLS)
    toggleSelectAll(ROWS)
    expect(selectedRows.value).toHaveLength(4)
  })

  it('toggleSelectAll deselects all when all are selected', () => {
    const { selectedRows, toggleSelectAll } = useTableState(ROWS, COLS)
    toggleSelectAll(ROWS)
    toggleSelectAll(ROWS)
    expect(selectedRows.value).toEqual([])
  })

  it('toggleSelectAll selects all when only some are selected (partial)', () => {
    const { selectedRows, toggleRowSelection, toggleSelectAll } = useTableState(ROWS, COLS)
    toggleRowSelection(ROWS[0])
    toggleSelectAll(ROWS)
    expect(selectedRows.value).toHaveLength(4)
  })

  it('toggleSelectAll with empty array is a no-op', () => {
    const { selectedRows, toggleRowSelection, toggleSelectAll } = useTableState(ROWS, COLS)
    toggleRowSelection(ROWS[0])
    toggleSelectAll([])
    expect(selectedRows.value).toHaveLength(1)
  })

  it('clearSelection empties the selection', () => {
    const { selectedRows, toggleSelectAll, clearSelection } = useTableState(ROWS, COLS)
    toggleSelectAll(ROWS)
    clearSelection()
    expect(selectedRows.value).toEqual([])
  })
})

describe('useTableState — column visibility', () => {
  it('toggleColVisibility hides a column', () => {
    const { activeColumns, toggleColVisibility } = useTableState(ROWS, COLS)
    toggleColVisibility('name')
    expect(activeColumns.value.map((c) => c.key)).not.toContain('name')
  })

  it('toggleColVisibility shows a hidden column', () => {
    const { activeColumns, toggleColVisibility } = useTableState(ROWS, COLS, {
      defaultVisibleColumns: ['id'],
    })
    toggleColVisibility('name')
    expect(activeColumns.value.map((c) => c.key)).toContain('name')
  })

  it('cannot hide the last visible column', () => {
    const { activeColumns, toggleColVisibility } = useTableState(ROWS, COLS, {
      defaultVisibleColumns: ['id'],
    })
    toggleColVisibility('id')
    expect(activeColumns.value.map((c) => c.key)).toContain('id')
  })
})

describe('useTableState — pagination', () => {
  it('setPage navigates between pages', () => {
    const { page, pagedData, setPage } = useTableState(ROWS, COLS, { defaultPageSize: 2 })
    setPage(2)
    expect(page.value).toBe(2)
    expect(pagedData.value).toEqual([ROWS[2], ROWS[3]])
  })

  it('setPage clamps to numPages', () => {
    const { page, setPage } = useTableState(ROWS, COLS, { defaultPageSize: 2 })
    setPage(100)
    expect(page.value).toBe(2)
  })

  it('setPage clamps to 1 at minimum', () => {
    const { page, setPage } = useTableState(ROWS, COLS, { defaultPageSize: 2 })
    setPage(-5)
    expect(page.value).toBe(1)
  })

  it('setPageSize resets page to 1', () => {
    const { page, setPage, setPageSize } = useTableState(ROWS, COLS, { defaultPageSize: 2 })
    setPage(2)
    setPageSize(3)
    expect(page.value).toBe(1)
  })
})

describe('useTableState — filters reset page', () => {
  it('toggleFilter resets page to 1', () => {
    const { page, setPage, toggleFilter } = useTableState(ROWS, COLS, { defaultPageSize: 2 })
    setPage(2)
    toggleFilter('name', 'Alice')
    expect(page.value).toBe(1)
  })

  it('setRangeFilter resets page to 1', () => {
    const { page, setPage, setRangeFilter } = useTableState(ROWS, COLS, { defaultPageSize: 2 })
    setPage(2)
    setRangeFilter('score', 'min', '70')
    expect(page.value).toBe(1)
  })

  it('clearFilters resets page to 1', () => {
    const { page, setPage, clearFilters } = useTableState(ROWS, COLS, { defaultPageSize: 2 })
    setPage(2)
    clearFilters()
    expect(page.value).toBe(1)
  })
})

describe('useTableState — search', () => {
  it('defaults searchQuery to empty string', () => {
    const { searchQuery } = useTableState(ROWS, COLS)
    expect(searchQuery.value).toBe('')
  })

  it('setSearchQuery filters processedData', () => {
    const { processedData, setSearchQuery } = useTableState(ROWS, COLS)
    setSearchQuery('ali')
    expect(processedData.value.map((r) => r.name)).toEqual(['Alice'])
  })

  it('setSearchQuery resets page to 1', () => {
    const { page, setPage, setSearchQuery } = useTableState(ROWS, COLS, { defaultPageSize: 2 })
    setPage(2)
    setSearchQuery('a')
    expect(page.value).toBe(1)
  })

  it('clearAll resets searchQuery', () => {
    const { searchQuery, processedData, setSearchQuery, clearAll } = useTableState(ROWS, COLS)
    setSearchQuery('alice')
    clearAll()
    expect(searchQuery.value).toBe('')
    expect(processedData.value).toHaveLength(4)
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
    const { stringValueMap } = useTableState(GAMES, GAME_COLS)
    expect(stringValueMap.value['tags']).toEqual(['Action', 'Adventure', 'RPG'])
  })

  it('toggleFilter matches rows whose array contains the selected value', () => {
    const { processedData, toggleFilter } = useTableState(GAMES, GAME_COLS)
    toggleFilter('tags', 'RPG')
    expect(processedData.value.map((g) => g.name)).toEqual(['Game A'])
  })

  it('groupedData fans a row into one group per array item', () => {
    const { groupedData, toggleGroup } = useTableState(GAMES, GAME_COLS)
    toggleGroup('tags')
    expect(groupedData.value.map((g) => g.key).sort()).toEqual(['Action', 'Adventure', 'RPG'])
  })

  it('stringValueMap lists a "(none)" entry for rows with an empty array', () => {
    const { stringValueMap } = useTableState(GAMES_WITH_EMPTY, GAME_COLS)
    expect(stringValueMap.value['tags']).toEqual(['(none)', 'Action', 'Adventure', 'RPG'])
  })

  it('groupedData buckets rows with an empty array under "(none)"', () => {
    const { groupedData, toggleGroup } = useTableState(GAMES_WITH_EMPTY, GAME_COLS)
    toggleGroup('tags')
    const noneGroup = groupedData.value.find((g) => g.key === '(none)')
    expect(noneGroup?.rows.map((r) => r.name)).toEqual(['Game C'])
  })

  it('uses a custom emptyValue label when provided', () => {
    const { stringValueMap, groupedData, toggleGroup } = useTableState(
      GAMES_WITH_EMPTY,
      GAME_COLS,
      { labels: { emptyValue: 'N/A' } },
    )
    expect(stringValueMap.value['tags']).toContain('N/A')
    toggleGroup('tags')
    expect(groupedData.value.map((g) => g.key)).toContain('N/A')
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
    const { processedData, toggleSort } = useTableState(ROWS, COMPUTED_COLS)
    toggleSort('grade')
    expect(processedData.value.map((r) => r.name)).toEqual(['Alice', 'Clara', 'Bob', 'David'])
  })

  it('groups by a computed column value', () => {
    const { groupedData, toggleGroup } = useTableState(ROWS, COMPUTED_COLS)
    toggleGroup('grade')
    expect(groupedData.value.find((g) => g.key === 'A')?.rows.map((r) => r.name)).toEqual([
      'Alice',
      'Clara',
    ])
    expect(groupedData.value.find((g) => g.key === 'B')?.rows.map((r) => r.name)).toEqual([
      'Bob',
      'David',
    ])
  })
})
