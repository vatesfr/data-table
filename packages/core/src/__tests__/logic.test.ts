import { describe, it, expect } from 'vitest'
import {
  processData,
  searchData,
  groupData,
  computeStringValues,
  filterValuesBySearch,
  computeAggregate,
  getColumnValue,
  paginateData,
  calcTotalPages,
  toggleSort,
  toggleFilter,
  toggleFilterAll,
  toggleGroupBy,
  toggleCollapse,
  getSortIcon,
  getSortIndex,
  countActiveFilters,
  getOrderedColumns,
  reorderColumn,
  moveColumnBy,
} from '../logic'

interface Row {
  id: number
  name: string
  dept: string
  salary: number
}

const ROWS: Row[] = [
  { id: 1, name: 'Alice', dept: 'Eng', salary: 90000 },
  { id: 2, name: 'Bob', dept: 'HR', salary: 60000 },
  { id: 3, name: 'Clara', dept: 'Eng', salary: 110000 },
  { id: 4, name: 'David', dept: 'HR', salary: 70000 },
]

interface Game {
  id: number
  name: string
  tags: string[]
}

const GAMES: Game[] = [
  { id: 1, name: 'Game A', tags: ['Action', 'RPG'] },
  { id: 2, name: 'Game B', tags: ['Action', 'Adventure'] },
  { id: 3, name: 'Game C', tags: ['RPG'] },
]

const GAMES_WITH_EMPTY: Game[] = [...GAMES, { id: 4, name: 'Game D', tags: [] }]

const COLS_FOR_SEARCH = [
  { key: 'name' as const, label: 'Name' },
  { key: 'dept' as const, label: 'Dept' },
]

// ─── getColumnValue ─────────────────────────────────────────────────────────

describe('getColumnValue', () => {
  it('reads row[key] when value is unset', () => {
    const col = { key: 'name' as const, label: 'Name' }
    expect(getColumnValue(col, ROWS[0])).toBe('Alice')
  })

  it('reads the aliased property when value is a function', () => {
    const col = { key: 'employee', label: 'Employee', value: (row: Row) => row.name }
    expect(getColumnValue(col, ROWS[0])).toBe('Alice')
  })

  it('calls the function with the full row when value is a function', () => {
    const col = { key: 'salaryK', label: 'Salary (K)', value: (row: Row) => row.salary / 1000 }
    expect(getColumnValue(col, ROWS[0])).toBe(90)
  })
})

// ─── searchData ───────────────────────────────────────────────────────────────

describe('searchData', () => {
  it('returns all rows when query is empty', () => {
    expect(searchData(ROWS, '', COLS_FOR_SEARCH)).toEqual(ROWS)
  })

  it('matches substring case-insensitively', () => {
    const result = searchData(ROWS, 'ali', COLS_FOR_SEARCH)
    expect(result.map((r) => r.name)).toEqual(['Alice'])
  })

  it('matches across any column', () => {
    const result = searchData(ROWS, 'eng', COLS_FOR_SEARCH)
    expect(result.map((r) => r.name)).toEqual(['Alice', 'Clara'])
  })

  it('returns empty when no match', () => {
    expect(searchData(ROWS, 'zzz', COLS_FOR_SEARCH)).toHaveLength(0)
  })

  it('uses col.format when available', () => {
    const cols = [{ key: 'salary' as const, label: 'Salary', format: (v: unknown) => `$${v}` }]
    const result = searchData(ROWS, '$90000', cols)
    expect(result.map((r) => r.name)).toEqual(['Alice'])
  })

  it('passes the full row as the second argument to col.format', () => {
    const cols = [
      {
        key: 'salary' as const,
        label: 'Salary',
        format: (v: unknown, row: Row) => `${row.name}:${v}`,
      },
    ]
    const result = searchData(ROWS, 'clara:110000', cols)
    expect(result.map((r) => r.name)).toEqual(['Clara'])
  })

  it('matches against a computed column value', () => {
    const cols = [{ key: 'salaryK', label: 'Salary (K)', value: (row: Row) => row.salary / 1000 }]
    const result = searchData(ROWS, '110', cols)
    expect(result.map((r) => r.name)).toEqual(['Clara'])
  })
})

// ─── computeAggregate ─────────────────────────────────────────────────────────

describe('computeAggregate', () => {
  const salaryCol = { key: 'salary' as const, label: 'Salary', aggregate: 'sum' as const }

  it('returns undefined when aggregate is not set', () => {
    expect(computeAggregate({ key: 'name' as const, label: 'Name' }, ROWS)).toBeUndefined()
  })

  it('computes sum', () => {
    expect(computeAggregate(salaryCol, ROWS)).toBe(330000)
  })

  it('computes count', () => {
    const col = { key: 'salary' as const, label: 'Salary', aggregate: 'count' as const }
    expect(computeAggregate(col, ROWS)).toBe(4)
  })

  it('computes avg', () => {
    const col = { key: 'salary' as const, label: 'Salary', aggregate: 'avg' as const }
    expect(computeAggregate(col, ROWS)).toBe(82500)
  })

  it('computes min', () => {
    const col = { key: 'salary' as const, label: 'Salary', aggregate: 'min' as const }
    expect(computeAggregate(col, ROWS)).toBe(60000)
  })

  it('computes max', () => {
    const col = { key: 'salary' as const, label: 'Salary', aggregate: 'max' as const }
    expect(computeAggregate(col, ROWS)).toBe(110000)
  })

  it('returns undefined for empty rows (numeric aggregates)', () => {
    const col = { key: 'salary' as const, label: 'Salary', aggregate: 'sum' as const }
    expect(computeAggregate(col, [])).toBeUndefined()
  })

  it('calls a custom aggregate function', () => {
    const col = {
      key: 'salary' as const,
      label: 'Salary',
      aggregate: (rows: Row[]) => rows.length * 2,
    }
    expect(computeAggregate(col, ROWS)).toBe(8)
  })

  it('sums a computed column value', () => {
    const col = {
      key: 'salaryK',
      label: 'Salary (K)',
      value: (row: Row) => row.salary / 1000,
      aggregate: 'sum' as const,
    }
    expect(computeAggregate(col, ROWS)).toBe(330)
  })
})

// ─── processData ─────────────────────────────────────────────────────────────

describe('processData', () => {
  it('returns all rows when no filters or sorts', () => {
    expect(processData(ROWS, {}, {}, [])).toEqual(ROWS)
  })

  it('filters by a string checklist', () => {
    const result = processData(ROWS, { dept: new Set(['Eng']) }, {}, [])
    expect(result.map((r) => r.name)).toEqual(['Alice', 'Clara'])
  })

  it('ignores an empty filter set (shows all)', () => {
    const result = processData(ROWS, { dept: new Set() }, {}, [])
    expect(result).toHaveLength(4)
  })

  it('filters by multiple columns (AND logic)', () => {
    const result = processData(ROWS, { dept: new Set(['Eng']), name: new Set(['Clara']) }, {}, [])
    expect(result.map((r) => r.name)).toEqual(['Clara'])
  })

  it('applies a numeric range min filter', () => {
    const result = processData(ROWS, {}, { salary: { min: '80000', max: '' } }, [])
    expect(result.map((r) => r.name)).toEqual(['Alice', 'Clara'])
  })

  it('applies a numeric range max filter', () => {
    const result = processData(ROWS, {}, { salary: { min: '', max: '65000' } }, [])
    expect(result.map((r) => r.name)).toEqual(['Bob'])
  })

  it('applies min and max together', () => {
    const result = processData(ROWS, {}, { salary: { min: '65000', max: '95000' } }, [])
    expect(result.map((r) => r.name)).toEqual(['Alice', 'David'])
  })

  it('range-filters using a computed column value', () => {
    const cols = [{ key: 'salaryK', label: 'Salary (K)', value: (row: Row) => row.salary / 1000 }]
    const result = processData(ROWS, {}, { salaryK: { min: '65', max: '95' } }, [], cols)
    expect(result.map((r) => r.name)).toEqual(['Alice', 'David'])
  })

  it('sorts ascending by string column', () => {
    const result = processData(ROWS, {}, {}, [{ key: 'name', dir: 'asc' }])
    expect(result.map((r) => r.name)).toEqual(['Alice', 'Bob', 'Clara', 'David'])
  })

  it('sorts descending by string column', () => {
    const result = processData(ROWS, {}, {}, [{ key: 'name', dir: 'desc' }])
    expect(result.map((r) => r.name)).toEqual(['David', 'Clara', 'Bob', 'Alice'])
  })

  it('sorts ascending by numeric column', () => {
    const result = processData(ROWS, {}, {}, [{ key: 'salary', dir: 'asc' }])
    expect(result.map((r) => r.salary)).toEqual([60000, 70000, 90000, 110000])
  })

  it('sorts using a computed column value', () => {
    const cols = [{ key: 'salaryK', label: 'Salary (K)', value: (row: Row) => row.salary / 1000 }]
    const result = processData(ROWS, {}, {}, [{ key: 'salaryK', dir: 'asc' }], cols)
    expect(result.map((r) => r.name)).toEqual(['Bob', 'David', 'Alice', 'Clara'])
  })

  it('applies sort after filter', () => {
    const result = processData(ROWS, { dept: new Set(['Eng']) }, {}, [
      { key: 'salary', dir: 'desc' },
    ])
    expect(result.map((r) => r.name)).toEqual(['Clara', 'Alice'])
  })

  it('matches array-valued columns by intersection (or semantics, default)', () => {
    const result = processData(GAMES, { tags: new Set(['Action']) }, {}, [])
    expect(result.map((r) => r.name)).toEqual(['Game A', 'Game B'])
  })

  it('matches array-valued columns with any selected value (or semantics)', () => {
    const result = processData(GAMES, { tags: new Set(['Adventure', 'RPG']) }, {}, [])
    expect(result.map((r) => r.name)).toEqual(['Game A', 'Game B', 'Game C'])
  })

  it('requires all selected values for and semantics', () => {
    const cols = [{ key: 'tags' as const, label: 'Tags', multiMode: 'and' as const }]
    const result = processData(GAMES, { tags: new Set(['Action', 'RPG']) }, {}, [], cols)
    expect(result.map((r) => r.name)).toEqual(['Game A'])
  })

  it('matches rows with an empty array against the "(none)" bucket by default', () => {
    const result = processData(GAMES_WITH_EMPTY, { tags: new Set(['(none)']) }, {}, [])
    expect(result.map((r) => r.name)).toEqual(['Game D'])
  })

  it('matches rows with an empty array against a custom emptyLabel', () => {
    const result = processData(GAMES_WITH_EMPTY, { tags: new Set(['N/A']) }, {}, [], [], 'N/A')
    expect(result.map((r) => r.name)).toEqual(['Game D'])
  })
})

// ─── groupData ───────────────────────────────────────────────────────────────

describe('groupData', () => {
  it('returns a single null-key group when groupBy is empty', () => {
    const result = groupData(ROWS, [])
    expect(result).toEqual([{ key: null, keyParts: [], rows: ROWS }])
  })

  it('groups rows by a single column', () => {
    const result = groupData(ROWS, ['dept'])
    expect(result).toHaveLength(2)
    expect(result.find((g) => g.key === 'Eng')?.rows).toHaveLength(2)
    expect(result.find((g) => g.key === 'HR')?.rows).toHaveLength(2)
  })

  it('groups by a computed column value', () => {
    const cols = [
      {
        key: 'band',
        label: 'Band',
        value: (row: Row) => (row.salary >= 90000 ? 'High' : 'Low'),
      },
    ]
    const result = groupData(ROWS, ['band'], cols)
    expect(result.find((g) => g.key === 'High')?.rows.map((r) => r.name)).toEqual([
      'Alice',
      'Clara',
    ])
    expect(result.find((g) => g.key === 'Low')?.rows.map((r) => r.name)).toEqual(['Bob', 'David'])
  })

  it('builds composite keys for multi-column grouping', () => {
    const result = groupData(ROWS, ['dept', 'name'])
    expect(result.map((g) => g.key)).toContain('Eng › Alice')
    expect(result.map((g) => g.key)).toContain('HR › Bob')
  })

  it('exposes keyParts aligned with groupBy for each group', () => {
    const result = groupData(ROWS, ['dept', 'name'])
    const eng = result.find((g) => g.key === 'Eng › Alice')
    expect(eng?.keyParts).toEqual(['Eng', 'Alice'])
  })

  it('fans an array-valued column out into one group per item', () => {
    const result = groupData(GAMES, ['tags'])
    expect(result.map((g) => g.key).sort()).toEqual(['Action', 'Adventure', 'RPG'])
    expect(result.find((g) => g.key === 'Action')?.rows.map((r) => r.name)).toEqual([
      'Game A',
      'Game B',
    ])
    expect(result.find((g) => g.key === 'RPG')?.rows.map((r) => r.name)).toEqual([
      'Game A',
      'Game C',
    ])
  })

  it('cross-products an array-valued column with another groupBy column', () => {
    const gamesWithDev = GAMES.map((g) => ({ ...g, dev: g.id === 2 ? 'Studio B' : 'Studio A' }))
    const result = groupData(gamesWithDev, ['dev', 'tags'])
    expect(result.map((g) => g.key).sort()).toEqual(
      ['Studio A › Action', 'Studio A › RPG', 'Studio B › Action', 'Studio B › Adventure'].sort(),
    )
  })

  it('buckets rows with an empty array under a "(none)" group by default', () => {
    const result = groupData(GAMES_WITH_EMPTY, ['tags'])
    expect(result.map((g) => g.key).sort()).toEqual(['(none)', 'Action', 'Adventure', 'RPG'])
    expect(result.find((g) => g.key === '(none)')?.rows.map((r) => r.name)).toEqual(['Game D'])
  })

  it('uses a custom emptyLabel for rows with an empty array', () => {
    const result = groupData(GAMES_WITH_EMPTY, ['tags'], [], 'N/A')
    expect(result.map((g) => g.key)).toContain('N/A')
    expect(result.find((g) => g.key === 'N/A')?.rows.map((r) => r.name)).toEqual(['Game D'])
  })
})

// ─── computeStringValues ─────────────────────────────────────────────────────

describe('computeStringValues', () => {
  const COLS = [
    { key: 'name' as const, label: 'Name', type: 'string' as const },
    { key: 'dept' as const, label: 'Dept', type: 'string' as const },
    { key: 'salary' as const, label: 'Salary', type: 'number' as const },
  ]

  it('returns sorted unique string values per filterable string column', () => {
    const result = computeStringValues(ROWS, COLS)
    expect(result['dept']).toEqual(['Eng', 'HR'])
    expect(result['name']).toEqual(['Alice', 'Bob', 'Clara', 'David'])
  })

  it('excludes numeric columns from the map', () => {
    const result = computeStringValues(ROWS, COLS)
    expect(result['salary']).toBeUndefined()
  })

  it('excludes columns with filterable: false', () => {
    const cols = [{ key: 'id' as const, label: 'ID', type: 'number' as const, filterable: false }]
    const result = computeStringValues(ROWS, cols)
    expect(result['id']).toBeUndefined()
  })

  it('flattens and dedupes array-valued columns instead of stringifying the whole array', () => {
    const cols = [{ key: 'tags' as const, label: 'Tags' }]
    const result = computeStringValues(GAMES, cols)
    expect(result['tags']).toEqual(['Action', 'Adventure', 'RPG'])
  })

  it('lists a "(none)" entry for rows with an empty array, by default', () => {
    const cols = [{ key: 'tags' as const, label: 'Tags' }]
    const result = computeStringValues(GAMES_WITH_EMPTY, cols)
    expect(result['tags']).toEqual(['(none)', 'Action', 'Adventure', 'RPG'])
  })

  it('uses a custom emptyLabel for rows with an empty array', () => {
    const cols = [{ key: 'tags' as const, label: 'Tags' }]
    const result = computeStringValues(GAMES_WITH_EMPTY, cols, 'N/A')
    expect(result['tags']).toContain('N/A')
  })

  it('collects values from a computed column', () => {
    const cols = [
      { key: 'band', label: 'Band', value: (row: Row) => (row.salary >= 90000 ? 'High' : 'Low') },
    ]
    const result = computeStringValues(ROWS, cols)
    expect(result['band']).toEqual(['High', 'Low'])
  })
})

// ─── filterValuesBySearch ───────────────────────────────────────────────────

describe('filterValuesBySearch', () => {
  const VALUES = ['Larian Studios', 'Larva Interactive', 'Valve', 'CD Projekt Red']

  it('returns all values when the term is empty', () => {
    expect(filterValuesBySearch(VALUES, '')).toEqual(VALUES)
  })

  it('filters case-insensitively by substring', () => {
    expect(filterValuesBySearch(VALUES, 'lar')).toEqual(['Larian Studios', 'Larva Interactive'])
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterValuesBySearch(VALUES, 'zzz')).toEqual([])
  })
})

// ─── paginateData ─────────────────────────────────────────────────────────────

describe('paginateData', () => {
  it('returns all rows when pageSize is 0 (pagination disabled)', () => {
    expect(paginateData(ROWS, 1, 0)).toEqual(ROWS)
  })

  it('returns the first page', () => {
    const result = paginateData(ROWS, 1, 2)
    expect(result.map((r) => r.id)).toEqual([1, 2])
  })

  it('returns the second page', () => {
    const result = paginateData(ROWS, 2, 2)
    expect(result.map((r) => r.id)).toEqual([3, 4])
  })

  it('returns a partial last page', () => {
    const result = paginateData(ROWS, 2, 3)
    expect(result.map((r) => r.id)).toEqual([4])
  })

  it('returns empty array when page is beyond the data', () => {
    const result = paginateData(ROWS, 10, 2)
    expect(result).toEqual([])
  })
})

// ─── calcTotalPages ───────────────────────────────────────────────────────────

describe('calcTotalPages', () => {
  it('returns 1 when pageSize is 0 (pagination disabled)', () => {
    expect(calcTotalPages(100, 0)).toBe(1)
  })

  it('returns correct count for evenly divisible dataset', () => {
    expect(calcTotalPages(4, 2)).toBe(2)
  })

  it('rounds up for a partial last page', () => {
    expect(calcTotalPages(5, 2)).toBe(3)
  })

  it('returns 1 for an empty dataset', () => {
    expect(calcTotalPages(0, 10)).toBe(1)
  })

  it('returns 1 when dataset is smaller than pageSize', () => {
    expect(calcTotalPages(3, 10)).toBe(1)
  })
})

// ─── toggleSort ──────────────────────────────────────────────────────────────

describe('toggleSort', () => {
  it('adds asc sort when key not present', () => {
    expect(toggleSort([], 'name')).toEqual([{ key: 'name', dir: 'asc' }])
  })

  it('flips asc to desc', () => {
    const result = toggleSort([{ key: 'name', dir: 'asc' }], 'name')
    expect(result).toEqual([{ key: 'name', dir: 'desc' }])
  })

  it('removes sort when already desc', () => {
    const result = toggleSort([{ key: 'name', dir: 'desc' }], 'name')
    expect(result).toEqual([])
  })

  it('appends new sort without touching existing ones', () => {
    const existing = [{ key: 'dept', dir: 'asc' as const }]
    const result = toggleSort(existing, 'name')
    expect(result).toHaveLength(2)
    expect(result[0].key).toBe('dept')
  })
})

// ─── toggleFilter ─────────────────────────────────────────────────────────────

describe('toggleFilter', () => {
  it('adds a value when not present', () => {
    const result = toggleFilter({}, 'dept', 'Eng')
    expect(result['dept'].has('Eng')).toBe(true)
  })

  it('removes a value when already present', () => {
    const result = toggleFilter({ dept: new Set(['Eng']) }, 'dept', 'Eng')
    expect(result['dept'].has('Eng')).toBe(false)
  })

  it('preserves other keys', () => {
    const initial = { name: new Set(['Alice']) }
    const result = toggleFilter(initial, 'dept', 'Eng')
    expect(result['name'].has('Alice')).toBe(true)
  })
})

// ─── toggleFilterAll ─────────────────────────────────────────────────────────

describe('toggleFilterAll', () => {
  it('selects all given values when none are selected', () => {
    const result = toggleFilterAll({}, 'dept', ['Eng', 'HR'])
    expect([...result['dept']]).toEqual(['Eng', 'HR'])
  })

  it('selects all given values when only some are selected', () => {
    const result = toggleFilterAll({ dept: new Set(['Eng']) }, 'dept', ['Eng', 'HR'])
    expect([...result['dept']].sort()).toEqual(['Eng', 'HR'])
  })

  it('deselects all given values when all are already selected', () => {
    const result = toggleFilterAll({ dept: new Set(['Eng', 'HR']) }, 'dept', ['Eng', 'HR'])
    expect(result['dept'].size).toBe(0)
  })

  it('only affects the given values, not other selected values for the same key', () => {
    const result = toggleFilterAll({ dept: new Set(['Eng', 'Sales']) }, 'dept', ['Eng', 'HR'])
    expect([...result['dept']].sort()).toEqual(['Eng', 'HR', 'Sales'])
  })

  it('is a no-op for an empty values array', () => {
    const result = toggleFilterAll({ dept: new Set(['Eng']) }, 'dept', [])
    expect([...result['dept']]).toEqual(['Eng'])
  })

  it('preserves other keys', () => {
    const initial = { name: new Set(['Alice']) }
    const result = toggleFilterAll(initial, 'dept', ['Eng'])
    expect(result['name'].has('Alice')).toBe(true)
  })
})

// ─── toggleGroupBy ────────────────────────────────────────────────────────────

describe('toggleGroupBy', () => {
  it('adds key when not present', () => {
    expect(toggleGroupBy([], 'dept')).toEqual(['dept'])
  })

  it('removes key when already present', () => {
    expect(toggleGroupBy(['dept'], 'dept')).toEqual([])
  })

  it('preserves other keys', () => {
    expect(toggleGroupBy(['dept', 'name'], 'dept')).toEqual(['name'])
  })
})

// ─── toggleCollapse ───────────────────────────────────────────────────────────

describe('toggleCollapse', () => {
  it('adds key when not collapsed', () => {
    const result = toggleCollapse(new Set(), 'Eng')
    expect(result.has('Eng')).toBe(true)
  })

  it('removes key when already collapsed', () => {
    const result = toggleCollapse(new Set(['Eng']), 'Eng')
    expect(result.has('Eng')).toBe(false)
  })
})

// ─── getSortIcon / getSortIndex ───────────────────────────────────────────────

describe('getSortIcon', () => {
  it('returns ↕ when column not sorted', () => {
    expect(getSortIcon([], 'name')).toBe('↕')
  })

  it('returns ↑ for asc', () => {
    expect(getSortIcon([{ key: 'name', dir: 'asc' }], 'name')).toBe('↑')
  })

  it('returns ↓ for desc', () => {
    expect(getSortIcon([{ key: 'name', dir: 'desc' }], 'name')).toBe('↓')
  })
})

describe('getSortIndex', () => {
  it('returns null when column not sorted', () => {
    expect(getSortIndex([], 'name')).toBeNull()
  })

  it('returns 1-based position', () => {
    const sorts = [
      { key: 'dept', dir: 'asc' as const },
      { key: 'name', dir: 'asc' as const },
    ]
    expect(getSortIndex(sorts, 'dept')).toBe(1)
    expect(getSortIndex(sorts, 'name')).toBe(2)
  })
})

// ─── getOrderedColumns ────────────────────────────────────────────────────────

describe('getOrderedColumns', () => {
  const COLS = [
    { key: 'name' as const, label: 'Name' },
    { key: 'dept' as const, label: 'Dept' },
    { key: 'salary' as const, label: 'Salary' },
  ]

  it('returns columns unchanged when order is empty', () => {
    expect(getOrderedColumns(COLS, [])).toEqual(COLS)
  })

  it('sorts columns per the given order', () => {
    const result = getOrderedColumns(COLS, ['salary', 'name', 'dept'])
    expect(result.map((c) => c.key)).toEqual(['salary', 'name', 'dept'])
  })

  it('appends columns missing from order at the end, in original relative order', () => {
    const result = getOrderedColumns(COLS, ['salary'])
    expect(result.map((c) => c.key)).toEqual(['salary', 'name', 'dept'])
  })

  it('drops stale keys from order that no longer match a column', () => {
    const result = getOrderedColumns(COLS, ['ghost', 'salary', 'name', 'dept'])
    expect(result.map((c) => c.key)).toEqual(['salary', 'name', 'dept'])
  })
})

// ─── reorderColumn ────────────────────────────────────────────────────────────

describe('reorderColumn', () => {
  it('moves dragKey to just before targetKey', () => {
    expect(reorderColumn(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b'])
  })

  it('moves dragKey later when targetKey is after it', () => {
    expect(reorderColumn(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'a', 'c'])
  })

  it('is a no-op when dragKey equals targetKey', () => {
    expect(reorderColumn(['a', 'b', 'c'], 'b', 'b')).toEqual(['a', 'b', 'c'])
  })

  it('returns order unchanged when targetKey is not present', () => {
    expect(reorderColumn(['a', 'b', 'c'], 'a', 'ghost')).toEqual(['a', 'b', 'c'])
  })
})

// ─── moveColumnBy ─────────────────────────────────────────────────────────────

describe('moveColumnBy', () => {
  it('swaps key with the next neighbor when delta is +1', () => {
    expect(moveColumnBy(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c'])
  })

  it('swaps key with the previous neighbor when delta is -1', () => {
    expect(moveColumnBy(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b'])
  })

  it('is a no-op when already at the start', () => {
    expect(moveColumnBy(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c'])
  })

  it('is a no-op when already at the end', () => {
    expect(moveColumnBy(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c'])
  })

  it('is a no-op when key is not present', () => {
    expect(moveColumnBy(['a', 'b', 'c'], 'ghost', 1)).toEqual(['a', 'b', 'c'])
  })
})

// ─── countActiveFilters ───────────────────────────────────────────────────────

describe('countActiveFilters', () => {
  it('returns 0 when no filters', () => {
    expect(countActiveFilters({}, {})).toBe(0)
  })

  it('counts columns with non-empty value sets', () => {
    const filters = { dept: new Set(['Eng']), name: new Set<string>() }
    expect(countActiveFilters(filters, {})).toBe(1)
  })

  it('counts range filters with at least one bound set', () => {
    const range = { salary: { min: '50000', max: '' } }
    expect(countActiveFilters({}, range)).toBe(1)
  })

  it('counts both filter types together', () => {
    const filters = { dept: new Set(['Eng']) }
    const range = { salary: { min: '50000', max: '' } }
    expect(countActiveFilters(filters, range)).toBe(2)
  })
})
