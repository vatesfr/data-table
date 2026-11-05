import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { SortEntry } from '../types'
import { LABELS_EN } from '../locales'
import {
  clampInt,
  rowText,
  filterData,
  sortData,
  searchData,
  buildSearchIndex,
  groupData,
  sortWithinGroups,
  getVisibleRows,
  paginateVisibleGroups,
  paginateVisibleItems,
  planRowNav,
  pageSizeOptions,
  showsPager,
  isSameVisibleItem,
  indexOfVisibleItem,
  computeStringValues,
  computeStringValueCounts,
  filterValuesBySearch,
  tableStatus,
  normalizeForSearch,
  filterValuesByCount,
  filterValuesByRange,
  computeValueBounds,
  computeDateTree,
  getDateTreeNodeState,
  sumDateTreeNodeCount,
  findDateTreeNode,
  computeAggregate,
  getColumnAlign,
  getColumnValue,
  cellText,
  groupText,
  paginateData,
  computeTotalPages,
  toggleSort,
  replaceSort,
  summarizeFilterValues,
  formatFilterValue,
  appendOrToggleSort,
  toggleFilterAll,
  setFilterValues,
  toggleExcludeAll,
  cycleFilterValue,
  clearExcludeValues,
  setFilterMode,
  columnHasActiveFilter,
  orderFilterColumnsByActive,
  filterOpenState,
  applyColumnOrderSnapshot,
  isMultiValueColumn,
  selectRange,
  isRowSelected,
  getSelectedRows,
  toggleRowInSelection,
  toggleAllInSelection,
  reconcileSelection,
  compareInOrder,
  remapRow,
  remapFocusTarget,
  isSameRow,
  isNewRowFocusTarget,
  selectDateRange,
  toggleGroupBy,
  insertGroupSort,
  reorderGroupSorts,
  toggleCollapse,
  resolveFocusTarget,
  isGroupCollapsed,
  getSortIcon,
  getSortIndex,
  countActiveFilters,
  getOrderedColumns,
  groupColumnsByCategory,
  addableLists,
  columnsDropdownLists,
  columnMatchesSearch,
  reconcileVisibleColumns,
  reorderColumn,
  moveColumnBy,
  moveVisibleColumnBy,
  moveSortBy,
  reorderSort,
  sortFilterValues,
  cycleValueSort,
  nextValueSort,
  toggleSortDir,
  getValueSortIcon,
  getDateSortIcon,
  computeVirtualRange,
  getVirtualScrollTarget,
  bucketNumericRange,
  formatNumericRange,
  numericRangeGroup,
  bucketDatePart,
  formatDatePart,
  datePartGroup,
  bucketLogRange,
  formatLogRange,
  logRangeGroup,
  compareMissingLast,
  rangeInputProps,
  matchingRangePreset,
  rangePresetFilter,
  rangeChipText,
  formatRangeBound,
  computeRangeSliderGeometry,
} from '../logic'
import type { VisibleItem } from '../logic'

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

describe('getColumnAlign', () => {
  it("right-aligns number columns by default, and `align: 'end'` columns", () => {
    expect(getColumnAlign({ key: 'n', label: 'N', type: 'number' })).toBe('end')
    expect(getColumnAlign({ key: 's', label: 'S', align: 'end' })).toBe('end')
  })

  it("leaves other columns, and `align: 'start'` number columns, unstyled", () => {
    expect(getColumnAlign({ key: 's', label: 'S' })).toBeUndefined()
    expect(getColumnAlign({ key: 'd', label: 'D', type: 'date' })).toBeUndefined()
    expect(getColumnAlign({ key: 'n', label: 'N', type: 'number', align: 'start' })).toBeUndefined()
  })
})

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

describe('cellText', () => {
  it('uses format, ignoring render', () => {
    const col = { key: 'salary', label: 'Salary', format: (v: unknown) => `$${v}` }
    expect(cellText(col, ROWS[0])).toBe('$90000')
  })

  it('joins array values and blanks missing ones', () => {
    expect(cellText({ key: 'tags', label: 'Tags' }, { tags: ['a', 'b'] })).toBe('a, b')
    expect(cellText({ key: 'nope', label: 'Nope' }, ROWS[0])).toBe('')
  })
})

describe('rowText', () => {
  it("is the first column's text that isn't empty", () => {
    const avatar = { key: 'avatar', label: 'Avatar', value: () => null }
    const name = { key: 'name', label: 'Name' }
    expect(rowText([avatar, name], ROWS[0])).toBe(cellText(name, ROWS[0]))
    expect(rowText([avatar], ROWS[0])).toBe('')
  })
})

describe('groupText', () => {
  const cols = [
    { key: 'dept', label: 'Dept' },
    {
      key: 'salary',
      label: 'Salary',
      groupValue: (v: unknown) => Math.floor((v as number) / 50000) * 50000,
      groupFormat: (k: string) => `${k}+`,
    },
    { key: 'tags', label: 'Tags' },
  ]

  it('joins every level, bucketed ones through groupFormat', () => {
    expect(groupText(cols, ['dept', 'salary'], ['Eng', '50000'], ROWS[0])).toBe('Eng › 50000+')
  })

  it("names a multi-value group by its own keyPart, not the row's whole array", () => {
    expect(groupText(cols, ['tags'], ['b'], { tags: ['a', 'b'] })).toBe('b')
  })

  it('falls back to the keyPart for an unknown column', () => {
    expect(groupText(cols, ['gone'], ['x'], ROWS[0])).toBe('x')
  })
})

// ─── searchData ───────────────────────────────────────────────────────────────

describe('searchData', () => {
  const search = <TRow extends object>(
    rows: TRow[],
    query: string,
    cols: Parameters<typeof buildSearchIndex<TRow>>[1],
  ) => searchData(rows, query, buildSearchIndex(rows, cols))

  it('returns all rows when query is empty', () => {
    expect(search(ROWS, '', COLS_FOR_SEARCH)).toEqual(ROWS)
  })

  it('matches substring case-insensitively', () => {
    const result = search(ROWS, 'ali', COLS_FOR_SEARCH)
    expect(result.map((r) => r.name)).toEqual(['Alice'])
  })

  it('matches across any column', () => {
    const result = search(ROWS, 'eng', COLS_FOR_SEARCH)
    expect(result.map((r) => r.name)).toEqual(['Alice', 'Clara'])
  })

  it('returns empty when no match', () => {
    expect(search(ROWS, 'zzz', COLS_FOR_SEARCH)).toHaveLength(0)
  })

  it('uses col.format when available', () => {
    const cols = [{ key: 'salary' as const, label: 'Salary', format: (v: unknown) => `$${v}` }]
    const result = search(ROWS, '$90000', cols)
    expect(result.map((r) => r.name)).toEqual(['Alice'])
  })

  it('passes the full row as the second argument to col.format', () => {
    const cols = [
      {
        key: 'salary' as const,
        label: 'Salary',
        format: (v: unknown, row?: Row) => `${row?.name}:${v}`,
      },
    ]
    const result = search(ROWS, 'clara:110000', cols)
    expect(result.map((r) => r.name)).toEqual(['Clara'])
  })

  it('matches against a computed column value', () => {
    const cols = [{ key: 'salaryK', label: 'Salary (K)', value: (row: Row) => row.salary / 1000 }]
    const result = search(ROWS, '110', cols)
    expect(result.map((r) => r.name)).toEqual(['Clara'])
  })

  it('ignores diacritics on both the row value and the query', () => {
    const cols = [{ key: 'name' as const, label: 'Name' }]
    const rows = [{ name: 'Öoo' }, { name: 'Zoe' }]
    expect(search(rows, 'ooo', cols).map((r) => r.name)).toEqual(['Öoo'])
    expect(search(rows, 'ÖOO', cols).map((r) => r.name)).toEqual(['Öoo'])
  })

  it('excludes a column marked searchable: false', () => {
    const cols = [
      { key: 'name' as const, label: 'Name' },
      { key: 'dept' as const, label: 'Dept', searchable: false },
    ]
    expect(search(ROWS, 'eng', cols)).toHaveLength(0)
    expect(search(ROWS, 'ali', cols).map((r) => r.name)).toEqual(['Alice'])
  })

  it('does not match across two cells', () => {
    // 'Alice' + 'Eng'
    expect(search(ROWS, 'ceeng', COLS_FOR_SEARCH)).toHaveLength(0)
  })

  it('searches any subset of the indexed rows, keeping their order', () => {
    const index = buildSearchIndex(ROWS, COLS_FOR_SEARCH)
    const reversed = [...ROWS].reverse()
    expect(searchData(reversed, 'eng', index).map((r) => r.name)).toEqual(['Clara', 'Alice'])
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

  it('ignores missing values instead of counting them as 0', () => {
    const rows = [{ n: 10 }, { n: null }, { n: '' }, { n: undefined }, { n: 20 }]
    const agg = (aggregate: 'avg' | 'min' | 'max') =>
      computeAggregate({ key: 'n' as const, label: 'N', aggregate }, rows)
    expect(agg('avg')).toBe(15)
    expect(agg('min')).toBe(10)
    expect(agg('max')).toBe(20)
  })

  it('handles groups too large to spread into Math.min/max', () => {
    const rows = Array.from({ length: 300_000 }, (_, i) => ({ n: i }))
    expect(
      computeAggregate({ key: 'n' as const, label: 'N', aggregate: 'min' as const }, rows),
    ).toBe(0)
    expect(
      computeAggregate({ key: 'n' as const, label: 'N', aggregate: 'max' as const }, rows),
    ).toBe(299_999)
  })
})

// ─── compareMissingLast ────────────────────────────────────────────────────────

describe('compareInOrder', () => {
  const TIERS = ['Bronze', 'Silver', 'Gold']

  it('ranks values by their index in order, unknown ones after and tied', () => {
    const values = ['Gold', 'Tin', 'Bronze', 'Silver', 'Lead']
    expect([...values].sort(compareInOrder(TIERS))).toEqual([
      'Bronze',
      'Silver',
      'Gold',
      'Tin',
      'Lead',
    ])
  })

  it('keeps unknown values last in both directions inside compareMissingLast', () => {
    const cmp = compareMissingLast(compareInOrder(TIERS), (v) => !TIERS.includes(v as string))
    expect(cmp('Tin', 'Bronze', 'desc')).toBeLessThan(0)
    expect(cmp('Tin', 'Bronze', 'asc')).toBeGreaterThan(0)
  })
})

describe('compareMissingLast', () => {
  // compareMissingLast's return value is meant to be fed through the same "negate for desc"
  // flip every sort call site already applies (dir === 'asc' ? cmp : -cmp) — it pre-cancels
  // that upcoming flip for a missing value, so it isn't itself the final comparison result.
  // applyDir mirrors that flip, the same way sortData/sortWithinGroups/sortFilterValues do.
  const applyDir = (cmp: number, dir: 'asc' | 'desc') => (dir === 'asc' ? cmp : -cmp)

  it('pins null/undefined/empty-string values last, after the caller applies its own dir flip', () => {
    const compare = compareMissingLast()
    expect(applyDir(compare(null, 5, 'asc'), 'asc')).toBeGreaterThan(0)
    expect(applyDir(compare(null, 5, 'desc'), 'desc')).toBeGreaterThan(0)
    expect(applyDir(compare(5, undefined, 'asc'), 'asc')).toBeLessThan(0)
    expect(applyDir(compare(5, undefined, 'desc'), 'desc')).toBeLessThan(0)
    expect(applyDir(compare('', 'x', 'asc'), 'asc')).toBeGreaterThan(0)
    expect(applyDir(compare('', 'x', 'desc'), 'desc')).toBeGreaterThan(0)
  })

  it('treats two missing values as equal', () => {
    const compare = compareMissingLast()
    expect(compare(null, undefined, 'asc')).toBe(0)
    expect(compare('', '', 'desc')).toBe(0)
  })

  it('defers to the default numeric-or-lexicographic comparator for non-missing values', () => {
    const compare = compareMissingLast()
    expect(compare(1, 2, 'asc')).toBeLessThan(0)
    expect(compare('b', 'a', 'asc')).toBeGreaterThan(0)
  })

  it('accepts a custom compare for the non-missing case', () => {
    const compare = compareMissingLast((a, b) => Number(b) - Number(a))
    expect(compare(1, 2, 'asc')).toBeGreaterThan(0) // inverted vs. the default
  })

  it('accepts a custom isMissing predicate', () => {
    const compare = compareMissingLast(
      (a, b) => Number(a) - Number(b),
      (v) => v === -1,
    )
    expect(compare(-1, 5, 'asc')).toBeGreaterThan(0)
    expect(compare(0, 5, 'asc')).toBeLessThan(0) // 0 isn't "missing" per the custom predicate
  })
})

// ─── filterData / sortData ──────────────────────────────────────────────────

describe('filterData / sortData', () => {
  it('returns all rows when no filters or sorts', () => {
    expect(filterData(ROWS, {}, {}, [])).toEqual(ROWS)
  })

  it('sortData returns its input as is when no sort is active', () => {
    expect(sortData(ROWS, [], [])).toBe(ROWS)
  })

  // Adapters sort once and filter the sorted rows so a keystroke never re-sorts: this must give
  // the same rows in the same order as filtering first, ties included.
  it('filtering sorted rows equals sorting filtered rows', () => {
    const cols = [
      { key: 'score', label: 'Score', type: 'number' as const },
      { key: 'tags', label: 'Tags' },
    ]
    const rows = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      score: (i * 7) % 5,
      tier: ['b', 'a', 'c'][i % 3],
      tags: [['x'], ['y'], ['x', 'z'], []][i % 4],
    }))
    const filters = { tags: new Set(['x']) }
    const ranges = { score: { min: '1', max: '' } }
    const sorts: SortEntry[] = [
      { key: 'tier', dir: 'desc' },
      { key: 'score', dir: 'asc' },
    ]
    expect(filterData(sortData(rows, sorts, cols), filters, ranges, cols)).toEqual(
      sortData(filterData(rows, filters, ranges, cols), sorts, cols),
    )
  })

  it('filters by a string checklist', () => {
    const result = filterData(ROWS, { dept: new Set(['Eng']) }, {}, [])
    expect(result.map((r) => r.name)).toEqual(['Alice', 'Clara'])
  })

  it('ignores an empty filter set (shows all)', () => {
    const result = filterData(ROWS, { dept: new Set() }, {}, [])
    expect(result).toHaveLength(4)
  })

  it('filters by multiple columns (AND logic)', () => {
    const result = filterData(ROWS, { dept: new Set(['Eng']), name: new Set(['Clara']) }, {}, [])
    expect(result.map((r) => r.name)).toEqual(['Clara'])
  })

  it('applies a numeric range min filter', () => {
    const result = filterData(ROWS, {}, { salary: { min: '80000', max: '' } }, [])
    expect(result.map((r) => r.name)).toEqual(['Alice', 'Clara'])
  })

  it('applies a numeric range max filter', () => {
    const result = filterData(ROWS, {}, { salary: { min: '', max: '65000' } }, [])
    expect(result.map((r) => r.name)).toEqual(['Bob'])
  })

  it('applies min and max together', () => {
    const result = filterData(ROWS, {}, { salary: { min: '65000', max: '95000' } }, [])
    expect(result.map((r) => r.name)).toEqual(['Alice', 'David'])
  })

  it('range-filters using a computed column value', () => {
    const cols = [{ key: 'salaryK', label: 'Salary (K)', value: (row: Row) => row.salary / 1000 }]
    const result = filterData(ROWS, {}, { salaryK: { min: '65', max: '95' } }, cols)
    expect(result.map((r) => r.name)).toEqual(['Alice', 'David'])
  })

  it('a range bound excludes missing values: null, undefined and empty are not 0 (issue #47)', () => {
    const cols = [
      { key: 'hours', label: 'Hours', type: 'number' as const },
      { key: 'd', label: 'Date', type: 'date' as const },
    ]
    const rows = [
      { name: 'zero', hours: 0, d: '2026-01-01' },
      { name: 'null', hours: null, d: null },
      { name: 'undefined', hours: undefined, d: undefined },
      { name: 'empty', hours: '', d: '' },
    ]
    const names = (ranges: Record<string, { min: string; max: string }>) =>
      filterData(rows, {}, ranges, cols).map((r) => r.name)
    expect(names({ hours: { min: '', max: '5' } })).toEqual(['zero'])
    expect(names({ hours: { min: '0', max: '' } })).toEqual(['zero'])
    expect(names({ d: { min: '1970-01-01', max: '' } })).toEqual(['zero'])
  })

  it('sorts missing number and date values together, apart from 0 and 1970 (issue #47)', () => {
    const cols = [
      { key: 'n', label: 'N', type: 'number' as const },
      { key: 'd', label: 'Date', type: 'date' as const },
    ]
    const rows = [
      { id: 'null', n: null, d: null },
      { id: 'zero', n: 0, d: '1970-01-01' },
      { id: 'empty', n: '', d: '' },
      { id: 'ten', n: 10, d: '2026-01-01' },
      { id: 'undefined', n: undefined, d: undefined },
    ]
    const ids = (key: string, dir: 'asc' | 'desc') =>
      sortData(rows, [{ key, dir }], cols).map((r) => r.id)
    const missing = ['null', 'empty', 'undefined']
    expect(ids('n', 'asc')).toEqual(['zero', 'ten', ...missing])
    expect(ids('n', 'desc')).toEqual([...missing, 'ten', 'zero'])
    expect(ids('d', 'asc')).toEqual(['zero', 'ten', ...missing])
  })

  it('sorts ascending by string column', () => {
    const result = sortData(ROWS, [{ key: 'name', dir: 'asc' }], [])
    expect(result.map((r) => r.name)).toEqual(['Alice', 'Bob', 'Clara', 'David'])
  })

  it('sorts descending by string column', () => {
    const result = sortData(ROWS, [{ key: 'name', dir: 'desc' }], [])
    expect(result.map((r) => r.name)).toEqual(['David', 'Clara', 'Bob', 'Alice'])
  })

  it('sorts ascending by numeric column', () => {
    const result = sortData(ROWS, [{ key: 'salary', dir: 'asc' }], [])
    expect(result.map((r) => r.salary)).toEqual([60000, 70000, 90000, 110000])
  })

  it('sorts using a computed column value', () => {
    const cols = [{ key: 'salaryK', label: 'Salary (K)', value: (row: Row) => row.salary / 1000 }]
    const result = sortData(ROWS, [{ key: 'salaryK', dir: 'asc' }], cols)
    expect(result.map((r) => r.name)).toEqual(['Bob', 'David', 'Alice', 'Clara'])
  })

  it('sorts using a column compare, not numerically or alphabetically (issue #15)', () => {
    const TIER_ORDER = ['bronze', 'silver', 'gold']
    interface Tiered {
      id: number
      tier: string
    }
    const rows: Tiered[] = [
      { id: 1, tier: 'Gold' },
      { id: 2, tier: 'Bronze' },
      { id: 3, tier: 'Silver' },
    ]
    const cols = [
      {
        key: 'tier' as const,
        label: 'Tier',
        compare: (a: unknown, b: unknown) =>
          TIER_ORDER.indexOf(String(a).toLowerCase()) - TIER_ORDER.indexOf(String(b).toLowerCase()),
      },
    ]
    const result = sortData(rows, [{ key: 'tier', dir: 'asc' }], cols)
    expect(result.map((r) => r.tier)).toEqual(['Bronze', 'Silver', 'Gold'])
  })

  it('compare overrides type: number coercion when both are set', () => {
    interface Tiered {
      id: number
      tier: number
    }
    const rows: Tiered[] = [
      { id: 1, tier: 3 },
      { id: 2, tier: 1 },
      { id: 3, tier: 2 },
    ]
    // Deliberately inverted vs. the numeric value, so a passing test proves `compare` (not the
    // `type: 'number'` coercion) drove the order.
    const cols = [
      {
        key: 'tier' as const,
        label: 'Tier',
        type: 'number' as const,
        compare: (a: unknown, b: unknown) => Number(b) - Number(a),
      },
    ]
    const result = sortData(rows, [{ key: 'tier', dir: 'asc' }], cols)
    expect(result.map((r) => r.tier)).toEqual([3, 2, 1])
  })

  it('compare receives the active dir, letting compareMissingLast pin missing values last in both sort directions (issue #15)', () => {
    interface Row2 {
      id: number
      score: number | null
    }
    const rows: Row2[] = [
      { id: 1, score: null },
      { id: 2, score: 30 },
      { id: 3, score: 10 },
      { id: 4, score: null },
      { id: 5, score: 20 },
    ]
    const cols = [{ key: 'score' as const, label: 'Score', compare: compareMissingLast() }]

    const asc = sortData(rows, [{ key: 'score', dir: 'asc' }], cols)
    expect(asc.map((r) => r.score)).toEqual([10, 20, 30, null, null])

    const desc = sortData(rows, [{ key: 'score', dir: 'desc' }], cols)
    expect(desc.map((r) => r.score)).toEqual([30, 20, 10, null, null])
  })

  it('compareMissingLast falls through to the next sort key when both sides are missing', () => {
    interface Row2 {
      id: number
      score: number | null
      name: string
    }
    const rows: Row2[] = [
      { id: 1, score: null, name: 'Zed' },
      { id: 2, score: 10, name: 'Bob' },
      { id: 3, score: null, name: 'Alice' },
    ]
    const cols = [{ key: 'score' as const, label: 'Score', compare: compareMissingLast() }]
    const result = sortData(
      rows,
      [
        { key: 'score', dir: 'asc' },
        { key: 'name', dir: 'asc' },
      ],
      cols,
    )
    expect(result.map((r) => r.name)).toEqual(['Bob', 'Alice', 'Zed'])
  })

  it('applies sort after filter', () => {
    const result = sortData(
      filterData(ROWS, { dept: new Set(['Eng']) }, {}, []),
      [{ key: 'salary', dir: 'desc' }],
      [],
    )
    expect(result.map((r) => r.name)).toEqual(['Clara', 'Alice'])
  })

  it('matches array-valued columns by intersection (or semantics, default)', () => {
    const result = filterData(GAMES, { tags: new Set(['Action']) }, {}, [])
    expect(result.map((r) => r.name)).toEqual(['Game A', 'Game B'])
  })

  it('matches array-valued columns with any selected value (or semantics)', () => {
    const result = filterData(GAMES, { tags: new Set(['Adventure', 'RPG']) }, {}, [])
    expect(result.map((r) => r.name)).toEqual(['Game A', 'Game B', 'Game C'])
  })

  it('requires all selected values for and semantics', () => {
    const cols = [{ key: 'tags' as const, label: 'Tags', multiMode: 'and' as const }]
    const result = filterData(GAMES, { tags: new Set(['Action', 'RPG']) }, {}, cols)
    expect(result.map((r) => r.name)).toEqual(['Game A'])
  })

  it("filterModes overrides col.multiMode's default for the given key", () => {
    // No `multiMode` on the column at all — the override is what supplies 'and' here.
    const result = filterData(
      GAMES,
      { tags: new Set(['Action', 'RPG']) },
      {},
      [],
      '(none)',
      {},
      { tags: 'and' },
    )
    expect(result.map((r) => r.name)).toEqual(['Game A'])
  })

  it('filterModes can override a column-level "and" default back to "or"', () => {
    const cols = [{ key: 'tags' as const, label: 'Tags', multiMode: 'and' as const }]
    const result = filterData(
      GAMES,
      { tags: new Set(['Adventure', 'RPG']) },
      {},
      cols,
      '(none)',
      {},
      { tags: 'or' },
    )
    expect(result.map((r) => r.name)).toEqual(['Game A', 'Game B', 'Game C'])
  })

  it('matches rows with an empty array against the "(none)" bucket by default', () => {
    const result = filterData(GAMES_WITH_EMPTY, { tags: new Set(['(none)']) }, {}, [])
    expect(result.map((r) => r.name)).toEqual(['Game D'])
  })

  it('matches rows with an empty array against a custom emptyLabel', () => {
    const result = filterData(GAMES_WITH_EMPTY, { tags: new Set(['N/A']) }, {}, [], 'N/A')
    expect(result.map((r) => r.name)).toEqual(['Game D'])
  })

  it('excludeFilters drops a row as soon as it has any excluded value', () => {
    const result = filterData(GAMES, {}, {}, [], '(none)', { tags: new Set(['RPG']) })
    expect(result.map((r) => r.name)).toEqual(['Game B'])
  })

  it('excludeFilters composes with multiple excluded values as a NOR (row must have none of them)', () => {
    const result = filterData(GAMES, {}, {}, [], '(none)', {
      tags: new Set(['RPG', 'Adventure']),
    })
    expect(result.map((r) => r.name)).toEqual([])
  })

  it('excludeFilters ignores col.multiMode (exclude is always "has none of", not "and"/"or")', () => {
    const cols = [{ key: 'tags' as const, label: 'Tags', multiMode: 'and' as const }]
    const result = filterData(GAMES, {}, {}, cols, '(none)', { tags: new Set(['Action']) })
    expect(result.map((r) => r.name)).toEqual(['Game C'])
  })

  it('composes include filters and excludeFilters together', () => {
    const result = filterData(GAMES, { tags: new Set(['Action']) }, {}, [], '(none)', {
      tags: new Set(['Adventure']),
    })
    expect(result.map((r) => r.name)).toEqual(['Game A'])
  })

  // Regression test: the include/exclude passes used to spread the filter Set to an array and
  // check membership via `rowValues.includes(v)` per candidate value — an O(rows × set size ×
  // rowValues.length) shape that stayed correct but became a multi-second stall once the set held
  // thousands of entries (found profiling the huge-dataset demo's checked-by-default checklist —
  // see docs/filter-dropdown.md's "Filter dropdown" — whose own "select all"/"Others" narrow a high-cardinality
  // column by excluding most of its distinct values in one action). These don't assert timing
  // (flaky in CI); `npm run bench:ab` covers the actual performance shape. Correctness only, with a
  // set large enough that a reintroduced O(rows × set size) scan would be easy to notice manually.
  it('a large include set still narrows correctly (large-Set correctness, not just a couple of values)', () => {
    const decoys = Array.from({ length: 2000 }, (_, i) => `Decoy ${i}`)
    const result = filterData(ROWS, { name: new Set([...decoys, 'Clara']) }, {}, [])
    expect(result.map((r) => r.name)).toEqual(['Clara'])
  })

  it('a large exclude set still narrows correctly (large-Set correctness, not just a couple of values)', () => {
    const decoys = Array.from({ length: 2000 }, (_, i) => `Decoy ${i}`)
    const result = filterData(ROWS, {}, {}, [], '(none)', {
      name: new Set([...decoys, 'Clara']),
    })
    expect(result.map((r) => r.name).sort()).toEqual(['Alice', 'Bob', 'David'])
  })

  it('a large "and"-mode multi-value include set still narrows correctly', () => {
    const cols = [{ key: 'tags' as const, label: 'Tags', multiMode: 'and' as const }]
    const decoys = Array.from({ length: 2000 }, (_, i) => `Decoy ${i}`)
    const result = filterData(GAMES, { tags: new Set([...decoys, 'Action', 'RPG']) }, {}, cols)
    expect(result.map((r) => r.name)).toEqual([])
  })

  it('sorts a date column chronologically, not as plain strings', () => {
    const cols = [{ key: 'd' as const, label: 'Date', type: 'date' as const }]
    const rows = [
      { id: 1, d: '1 Jan, 2020' },
      { id: 2, d: '5 Dec, 2019' },
      { id: 3, d: '23 Apr, 2020' },
      { id: 4, d: '9 Sep, 2020' },
    ]
    const result = sortData(rows, [{ key: 'd', dir: 'asc' }], cols)
    expect(result.map((r) => r.id)).toEqual([2, 1, 3, 4])
  })

  it('sorts a date column using a custom parseDate instead of new Date', () => {
    const cols = [
      {
        key: 'd' as const,
        label: 'Date',
        type: 'date' as const,
        parseDate: (v: string) => {
          const [d, m, y] = v.split('/').map(Number)
          return new Date(y, m - 1, d).getTime()
        },
      },
    ]
    // DD/MM/YYYY: default new Date(v) would read these as MM/DD and sort id 2 before id 1.
    const rows = [
      { id: 1, d: '20/05/2023' },
      { id: 2, d: '06/06/2023' },
    ]
    const result = sortData(rows, [{ key: 'd', dir: 'asc' }], cols)
    expect(result.map((r) => r.id)).toEqual([1, 2])
  })

  it('falls back to string comparison when a date value fails to parse', () => {
    const cols = [{ key: 'd' as const, label: 'Date', type: 'date' as const }]
    const rows = [
      { id: 1, d: 'not a date' },
      { id: 2, d: '2020-01-01' },
    ]
    const result = sortData(rows, [{ key: 'd', dir: 'asc' }], cols)
    expect(result.map((r) => r.id)).toEqual([2, 1])
  })

  it('applies a date range min filter, parsed chronologically not as strings', () => {
    const cols = [{ key: 'd' as const, label: 'Date', type: 'date' as const }]
    const rows = [
      { id: 1, d: '2020-01-01' },
      { id: 2, d: '2020-06-15' },
      { id: 3, d: '2021-03-10' },
    ]
    const result = filterData(rows, {}, { d: { min: '2020-06-01', max: '' } }, cols)
    expect(result.map((r) => r.id)).toEqual([2, 3])
  })

  it('applies a date range max filter', () => {
    const cols = [{ key: 'd' as const, label: 'Date', type: 'date' as const }]
    const rows = [
      { id: 1, d: '2020-01-01' },
      { id: 2, d: '2020-06-15' },
      { id: 3, d: '2021-03-10' },
    ]
    const result = filterData(rows, {}, { d: { min: '', max: '2020-06-15' } }, cols)
    expect(result.map((r) => r.id)).toEqual([1, 2])
  })

  it("applies a date range using the column's own parseDate for row values, but the default ISO parser for the bounds themselves", () => {
    const cols = [
      {
        key: 'd' as const,
        label: 'Date',
        type: 'date' as const,
        // DD/MM/YYYY: default new Date(v) would misread these as MM/DD.
        parseDate: (v: string) => {
          const [d, m, y] = v.split('/').map(Number)
          return new Date(y, m - 1, d).getTime()
        },
      },
    ]
    const rows = [
      { id: 1, d: '20/05/2023' }, // 2023-05-20
      { id: 2, d: '06/06/2023' }, // 2023-06-06
    ]
    // Bounds are always ISO (what a native <input type="date"> produces), never the column's own
    // DD/MM/YYYY format.
    const result = filterData(rows, {}, { d: { min: '2023-06-01', max: '' } }, cols)
    expect(result.map((r) => r.id)).toEqual([2])
  })

  it('sorts a type: "number" column numerically even when values are numeric strings', () => {
    // Regression, same bug class as date sort (issue #10): a numeric string like "1200" must
    // not be compared as a plain string, where "1200" < "80" alphabetically.
    const cols = [{ key: 'n' as const, label: 'N', type: 'number' as const }]
    const rows = [
      { id: 1, n: '1200' },
      { id: 2, n: '80' },
      { id: 3, n: '950' },
    ]
    const result = sortData(rows, [{ key: 'n', dir: 'asc' }], cols)
    expect(result.map((r) => r.id)).toEqual([2, 3, 1])
  })

  it('falls back to string comparison when a type: "number" value fails to parse', () => {
    const cols = [{ key: 'n' as const, label: 'N', type: 'number' as const }]
    const rows = [
      { id: 1, n: 'not a number' },
      { id: 2, n: '5' },
    ]
    const result = sortData(rows, [{ key: 'n', dir: 'asc' }], cols)
    expect(result.map((r) => r.id)).toEqual([2, 1])
  })
})

// ─── groupData ───────────────────────────────────────────────────────────────

describe('groupData', () => {
  it('returns a single null-key group when groupBy is empty', () => {
    const result = groupData(ROWS, [], [])
    expect(result).toEqual([{ key: null, keyParts: [], rows: ROWS }])
  })

  it('groups rows by a single column', () => {
    const result = groupData(ROWS, ['dept'], [])
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
    const result = groupData(ROWS, ['dept', 'name'], [])
    expect(result.map((g) => g.key)).toContain('Eng › Alice')
    expect(result.map((g) => g.key)).toContain('HR › Bob')
  })

  it('exposes keyParts aligned with groupBy for each group', () => {
    const result = groupData(ROWS, ['dept', 'name'], [])
    const eng = result.find((g) => g.key === 'Eng › Alice')
    expect(eng?.keyParts).toEqual(['Eng', 'Alice'])
  })

  it('groups a missing scalar value under an empty key', () => {
    const rows = [{ dept: 'Eng' }, { dept: undefined }, { dept: null }]
    const result = groupData(rows, ['dept'], [])
    expect(result.map((g) => [g.key, g.keyParts, g.rows.length])).toEqual([
      ['Eng', ['Eng'], 1],
      ['', [''], 2],
    ])
  })

  it('fans an array-valued column out into one group per item', () => {
    const result = groupData(GAMES, ['tags'], [])
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
    const result = groupData(gamesWithDev, ['dev', 'tags'], [])
    expect(result.map((g) => g.key).sort()).toEqual(
      ['Studio A › Action', 'Studio A › RPG', 'Studio B › Action', 'Studio B › Adventure'].sort(),
    )
  })

  it('buckets rows with an empty array under a "(none)" group by default', () => {
    const result = groupData(GAMES_WITH_EMPTY, ['tags'], [])
    expect(result.map((g) => g.key).sort()).toEqual(['(none)', 'Action', 'Adventure', 'RPG'])
    expect(result.find((g) => g.key === '(none)')?.rows.map((r) => r.name)).toEqual(['Game D'])
  })

  it('uses a custom emptyLabel for rows with an empty array', () => {
    const result = groupData(GAMES_WITH_EMPTY, ['tags'], [], 'N/A')
    expect(result.map((g) => g.key)).toContain('N/A')
    expect(result.find((g) => g.key === 'N/A')?.rows.map((r) => r.name)).toEqual(['Game D'])
  })

  it('buckets rows by groupValue instead of the exact raw value', () => {
    const cols = [
      {
        key: 'salary',
        label: 'Salary',
        type: 'number' as const,
        groupValue: bucketNumericRange(20000),
      },
    ]
    const result = groupData(ROWS, ['salary'], cols)
    // 90000, 60000, 110000, 70000 -> buckets 80000, 60000, 100000, 60000
    expect(result.map((g) => g.key).sort()).toEqual(['100000', '60000', '80000'])
    expect(result.find((g) => g.key === '60000')?.rows.map((r) => r.name)).toEqual(['Bob', 'David'])
  })

  it('leaves other columns ungrouped by exact value when only one groupBy column has groupValue', () => {
    const cols = [
      { key: 'dept', label: 'Dept' },
      {
        key: 'salary',
        label: 'Salary',
        type: 'number' as const,
        groupValue: bucketNumericRange(50000),
      },
    ]
    const result = groupData(ROWS, ['dept', 'salary'], cols)
    expect(result.map((g) => g.key).sort()).toEqual(['Eng › 100000', 'Eng › 50000', 'HR › 50000'])
  })

  it('preserves true first-seen order for numeric-looking bucket keys, instead of a plain object silently re-sorting them ascending', () => {
    // A canonical non-negative integer string (e.g. a numericRangeGroup bucket key like '80000')
    // is a JS "array index" key — a plain `Record<string, ...>` would enumerate those ascending
    // regardless of insertion order, making an unsorted numeric-bucketed group look permanently
    // pre-sorted. Rows here are deliberately out of bucket order (80000, 100000, then back to
    // 60000) so an object-based implementation and a Map-based one disagree on the result.
    const rows = [
      { name: 'A', salary: 92000 }, // bucket 80000
      { name: 'B', salary: 105000 }, // bucket 100000
      { name: 'C', salary: 78000 }, // bucket 60000
    ]
    const cols = [
      {
        key: 'salary',
        label: 'Salary',
        type: 'number' as const,
        groupValue: bucketNumericRange(20000),
      },
    ]
    const result = groupData(rows, ['salary'], cols)
    expect(result.map((g) => g.key)).toEqual(['80000', '100000', '60000'])
  })
})

// ─── sortWithinGroups ────────────────────────────────────────────────────────

describe('sortWithinGroups', () => {
  interface ScoredGame {
    id: number
    name: string
    tags: string[]
    score: number
  }

  const SCORED_GAMES: ScoredGame[] = [
    { id: 1, name: 'Game A', tags: ['Action', 'RPG'], score: 90 },
    { id: 2, name: 'Game B', tags: ['Action', 'Adventure'], score: 70 },
    { id: 3, name: 'Game C', tags: ['RPG'], score: 80 },
    { id: 4, name: 'Game D', tags: ['Action'], score: 60 },
  ]

  it("sorts rows within each group by the secondary key, ignoring the grouped multi-value column's own whole-array comparison (issue #12)", () => {
    const groups = groupData(SCORED_GAMES, ['tags'], [])
    const sorted = sortWithinGroups(
      groups,
      [
        { key: 'tags', dir: 'asc' },
        { key: 'score', dir: 'asc' },
      ],
      ['tags'],
      [],
    )
    expect(sorted.find((g) => g.key === 'Action')?.rows.map((r) => r.name)).toEqual([
      'Game D',
      'Game B',
      'Game A',
    ]) // 60, 70, 90
  })

  it('respects a descending direction on the remaining sort key', () => {
    const groups = groupData(SCORED_GAMES, ['tags'], [])
    const sorted = sortWithinGroups(groups, [{ key: 'score', dir: 'desc' }], ['tags'], [])
    expect(sorted.find((g) => g.key === 'Action')?.rows.map((r) => r.name)).toEqual([
      'Game A',
      'Game B',
      'Game D',
    ]) // 90, 70, 60
  })

  it('reorders the groups themselves ascending by their own key when the sort key is the groupBy column (issue #12)', () => {
    const groups = groupData(SCORED_GAMES, ['tags'], [])
    const sorted = sortWithinGroups(groups, [{ key: 'tags', dir: 'asc' }], ['tags'], [])
    expect(sorted.map((g) => g.key)).toEqual(['Action', 'Adventure', 'RPG'])
  })

  it('reorders the groups themselves descending when dir is desc', () => {
    const groups = groupData(SCORED_GAMES, ['tags'], [])
    const sorted = sortWithinGroups(groups, [{ key: 'tags', dir: 'desc' }], ['tags'], [])
    expect(sorted.map((g) => g.key)).toEqual(['RPG', 'Adventure', 'Action'])
  })

  it('orders groups numerically, not lexicographically, for a type: number groupBy column', () => {
    interface Tiered {
      id: number
      tier: number
    }
    const rows: Tiered[] = [
      { id: 1, tier: 10 },
      { id: 2, tier: 2 },
      { id: 3, tier: 3 },
    ]
    const cols = [{ key: 'tier', label: 'Tier', type: 'number' as const }]
    const groups = groupData(rows, ['tier'], cols)
    const sorted = sortWithinGroups(groups, [{ key: 'tier', dir: 'asc' }], ['tier'], cols)
    expect(sorted.map((g) => g.key)).toEqual(['2', '3', '10'])
  })

  it('orders groups by a groupBy column compare, not numerically or lexicographically (issue #15)', () => {
    const TIER_ORDER = ['bronze', 'silver', 'gold']
    interface Tiered {
      id: number
      tier: string
    }
    const rows: Tiered[] = [
      { id: 1, tier: 'Gold' },
      { id: 2, tier: 'Bronze' },
      { id: 3, tier: 'Silver' },
    ]
    const cols = [
      {
        key: 'tier',
        label: 'Tier',
        compare: (a: unknown, b: unknown) =>
          TIER_ORDER.indexOf(String(a).toLowerCase()) - TIER_ORDER.indexOf(String(b).toLowerCase()),
      },
    ]
    const groups = groupData(rows, ['tier'], cols)
    const sorted = sortWithinGroups(groups, [{ key: 'tier', dir: 'asc' }], ['tier'], cols)
    expect(sorted.map((g) => g.key)).toEqual(['Bronze', 'Silver', 'Gold'])
  })

  it('compareMissingLast pins a groupBy column\'s "(none)" group last in both directions (issue #15)', () => {
    interface Tagged {
      id: number
      tags: string[]
    }
    const rows: Tagged[] = [
      { id: 1, tags: ['RPG'] },
      { id: 2, tags: [] },
      { id: 3, tags: ['Action'] },
    ]
    const cols = [
      {
        key: 'tags',
        label: 'Tags',
        compare: compareMissingLast(undefined, (v: unknown) => v === '(none)'),
      },
    ]
    const groups = groupData(rows, ['tags'], cols)

    const asc = sortWithinGroups(groups, [{ key: 'tags', dir: 'asc' }], ['tags'], cols)
    expect(asc.map((g) => g.key)).toEqual(['Action', 'RPG', '(none)'])

    const desc = sortWithinGroups(groups, [{ key: 'tags', dir: 'desc' }], ['tags'], cols)
    expect(desc.map((g) => g.key)).toEqual(['RPG', 'Action', '(none)'])
  })

  it('returns the groups unchanged when sorts is empty', () => {
    const groups = groupData(SCORED_GAMES, ['tags'], [])
    expect(sortWithinGroups(groups, [], ['tags'], [])).toBe(groups)
  })

  it('returns the groups unchanged when ungrouped, since sortData already sorted the rows', () => {
    const groups = groupData(SCORED_GAMES, [], [])
    expect(sortWithinGroups(groups, [{ key: 'score', dir: 'desc' }], [], [])).toBe(groups)
  })

  it('orders bucketed groups (groupValue) numerically off the bucket key, not lexicographically', () => {
    interface Priced {
      id: number
      price: number
    }
    // Unbucketed, these would sort '0','100','20' lexicographically (wrong order) if compared
    // as plain strings — groupValue's bucket key still goes through the same type-aware
    // comparison a normal type: 'number' groupBy column gets, so no separate sort key is needed.
    const rows: Priced[] = [
      { id: 1, price: 105 },
      { id: 2, price: 5 },
      { id: 3, price: 25 },
    ]
    const cols = [
      {
        key: 'price',
        label: 'Price',
        type: 'number' as const,
        groupValue: bucketNumericRange(20),
      },
    ]
    const groups = groupData(rows, ['price'], cols)
    const sorted = sortWithinGroups(groups, [{ key: 'price', dir: 'asc' }], ['price'], cols)
    expect(sorted.map((g) => g.key)).toEqual(['0', '20', '100'])
  })

  it("nests multi-level groups by groupBy's own order, not by the entries' relative order within sorts", () => {
    interface Employee {
      name: string
      dept: string
      role: string
    }
    const rows: Employee[] = [
      { name: 'A', dept: 'Eng', role: 'Lead' },
      { name: 'B', dept: 'HR', role: 'Lead' },
      { name: 'C', dept: 'Eng', role: 'IC' },
      { name: 'D', dept: 'HR', role: 'IC' },
    ]
    const groups = groupData(rows, ['dept', 'role'], [])
    // `sorts` lists role before dept — if nesting followed sorts-array order (the pre-fix
    // behavior), this would nest by role first. groupBy still says dept nests outer.
    const sorted = sortWithinGroups(
      groups,
      [
        { key: 'role', dir: 'asc' },
        { key: 'dept', dir: 'asc' },
      ],
      ['dept', 'role'],
      [],
    )
    expect(sorted.map((g) => g.key)).toEqual(['Eng › IC', 'Eng › Lead', 'HR › IC', 'HR › Lead'])
  })

  it('skips a groupBy level with no matching sort entry, falling through to the next level', () => {
    interface Employee {
      name: string
      dept: string
      role: string
    }
    const rows: Employee[] = [
      { name: 'A', dept: 'Eng', role: 'Lead' },
      { name: 'B', dept: 'HR', role: 'Lead' },
      { name: 'C', dept: 'Eng', role: 'IC' },
    ]
    const groups = groupData(rows, ['dept', 'role'], [])
    // No entry for 'dept' — only 'role' governs nesting, dept order stays whatever groupData
    // produced (first-seen).
    const sorted = sortWithinGroups(groups, [{ key: 'role', dir: 'asc' }], ['dept', 'role'], [])
    expect(sorted.map((g) => g.key)).toEqual(['Eng › IC', 'Eng › Lead', 'HR › Lead'])
  })
})

// ─── bucketNumericRange / formatNumericRange ─────────────────────────────────

describe('bucketNumericRange', () => {
  it('rounds down to the start of the step-wide range', () => {
    const bucket = bucketNumericRange(10)
    expect(bucket(47)).toBe(40)
    expect(bucket(40)).toBe(40)
    expect(bucket(0)).toBe(0)
  })

  it('returns null for a non-numeric value', () => {
    expect(bucketNumericRange(10)('abc')).toBeNull()
  })

  it('returns null for a missing value, instead of coercing it to 0', () => {
    expect(bucketNumericRange(10)(null)).toBeNull()
    expect(bucketNumericRange(10)(undefined)).toBeNull()
  })
})

describe('formatNumericRange', () => {
  it('formats a bucket key as "<lower>–<upper><unit>"', () => {
    expect(formatNumericRange(10, '%')('40')).toBe('40–50%')
    expect(formatNumericRange(10)('40')).toBe('40–50')
  })

  it('returns the raw key unchanged when it is not numeric', () => {
    expect(formatNumericRange(10)('abc')).toBe('abc')
  })

  it('renders the missing-value bucket key as missingLabel', () => {
    expect(formatNumericRange(10)('')).toBe('(none)')
    expect(formatNumericRange(10, '', 'Unknown')('')).toBe('Unknown')
  })
})

describe('numericRangeGroup', () => {
  it('returns a matched groupValue/groupFormat pair', () => {
    const { groupValue, groupFormat } = numericRangeGroup(10, '%')
    expect(groupValue(47)).toBe(40)
    expect(groupFormat(String(groupValue(47)))).toBe('40–50%')
    expect(groupValue(null)).toBeNull()
    expect(groupFormat('')).toBe('(none)')
  })
})

// ─── bucketDatePart / formatDatePart ──────────────────────────────────────────

describe('bucketDatePart', () => {
  it('truncates a date to the start of its month', () => {
    expect(bucketDatePart('month')('2024-05-14')).toBe('2024-05-01')
  })

  it('truncates a date to the start of its year', () => {
    expect(bucketDatePart('year')('2024-05-14')).toBe('2024-01-01')
  })

  it('keeps the full date for day granularity', () => {
    expect(bucketDatePart('day')('2024-05-14')).toBe('2024-05-14')
  })

  it('returns the raw value unchanged when it does not parse as a date', () => {
    expect(bucketDatePart('month')('not-a-date')).toBe('not-a-date')
  })

  it('returns null for a missing value, instead of the literal text "null"', () => {
    expect(bucketDatePart('month')(null)).toBeNull()
    expect(bucketDatePart('month')(undefined)).toBeNull()
  })
})

describe('formatDatePart', () => {
  it('formats a month bucket key as a human month/year label', () => {
    expect(formatDatePart('month')('2024-05-01')).toBe(
      new Date(2024, 4, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    )
  })

  it('formats a year bucket key as just the year', () => {
    expect(formatDatePart('year')('2024-01-01')).toBe('2024')
  })

  it('returns the raw key unchanged when it does not parse as a date', () => {
    expect(formatDatePart('month')('not-a-date')).toBe('not-a-date')
  })

  it('renders the missing-value bucket key as missingLabel', () => {
    expect(formatDatePart('month')('')).toBe('(none)')
    expect(formatDatePart('month', 'Unknown')('')).toBe('Unknown')
  })
})

describe('datePartGroup', () => {
  it('returns a matched groupValue/groupFormat pair', () => {
    const { groupValue, groupFormat } = datePartGroup('month')
    expect(groupValue('2024-05-14')).toBe('2024-05-01')
    expect(groupFormat(groupValue('2024-05-14') as string)).toBe(
      new Date(2024, 4, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    )
    expect(groupValue(null)).toBeNull()
    expect(groupFormat('')).toBe('(none)')
  })
})

// ─── bucketLogRange / formatLogRange ──────────────────────────────────────────

describe('bucketLogRange', () => {
  it('buckets by plain order of magnitude with the default divisions ([1])', () => {
    const bucket = bucketLogRange()
    expect(bucket(1)).toBe(1)
    expect(bucket(9)).toBe(1)
    expect(bucket(10)).toBe(10)
    expect(bucket(99)).toBe(10)
    expect(bucket(100)).toBe(100)
  })

  it('supports a half-decade "1-3-10" grid via divisions', () => {
    const bucket = bucketLogRange({ divisions: [1, 3] })
    expect(bucket(1)).toBe(1)
    expect(bucket(2.9)).toBe(1)
    expect(bucket(3)).toBe(3)
    expect(bucket(9)).toBe(3)
    expect(bucket(10)).toBe(10)
    expect(bucket(29)).toBe(10)
    expect(bucket(30)).toBe(30)
  })

  it('supports a different base, e.g. octaves (base 2)', () => {
    const bucket = bucketLogRange({ base: 2, min: 1 })
    expect(bucket(1)).toBe(1)
    expect(bucket(3)).toBe(2)
    expect(bucket(4)).toBe(4)
    expect(bucket(1023)).toBe(512)
    expect(bucket(1024)).toBe(1024)
  })

  it('collapses values below min into a distinct sentinel bucket, not the missing-value one', () => {
    const bucket = bucketLogRange({ min: 1 })
    expect(bucket(0.5)).toBe(-Infinity)
    expect(bucket(0)).toBe(-Infinity)
    expect(bucket(-5)).toBe(-Infinity)
    expect(bucket(null)).toBeNull()
    expect(bucket(0.5)).not.toBe(bucket(null))
  })

  it('min: 0 opts out of the collapse bucket for any positive value, extending the grid down toward zero', () => {
    const bucket = bucketLogRange({ min: 0 })
    expect(bucket(0.5)).toBe(0.1)
    expect(bucket(0.05)).toBe(0.01)
    // zero/negative still have no log-scale bucket to extend into, regardless of min
    expect(bucket(0)).toBe(-Infinity)
    expect(bucket(-5)).toBe(-Infinity)
  })

  it('returns null for a missing or non-numeric value', () => {
    const bucket = bucketLogRange()
    expect(bucket(null)).toBeNull()
    expect(bucket(undefined)).toBeNull()
    expect(bucket('abc')).toBeNull()
  })
})

describe('formatLogRange', () => {
  it('formats a bucket key as "<lower>–<upper><unit>"', () => {
    const format = formatLogRange({ divisions: [1, 3] })
    expect(format('1')).toBe('1–3')
    expect(format('3')).toBe('3–10')
    expect(format('30')).toBe('30–100')
  })

  it('applies k/M magnitude suffixes', () => {
    const format = formatLogRange()
    expect(format('1000')).toBe('1k–10k')
    expect(format('1000000')).toBe('1M–10M')
  })

  it('formats the below-min bucket as "<<min><unit>"', () => {
    expect(formatLogRange({ min: 1 }, 'h')('-Infinity')).toBe('<1h')
  })

  it('renders the missing-value bucket key as missingLabel', () => {
    expect(formatLogRange()('')).toBe('(none)')
  })
})

describe('logRangeGroup', () => {
  it('returns a matched groupValue/groupFormat pair', () => {
    const { groupValue, groupFormat } = logRangeGroup({ divisions: [1, 3] }, 'h')
    expect(groupValue(7)).toBe(3)
    expect(groupFormat(String(groupValue(7)))).toBe('3–10h')
    expect(groupValue(null)).toBeNull()
    expect(groupFormat('')).toBe('(none)')
  })
})

// ─── getVisibleRows ──────────────────────────────────────────────────────────

describe('getVisibleRows', () => {
  it('flattens an ungrouped result (single null-key group) as-is, with no group header items', () => {
    const groups = groupData(ROWS, [], [])
    expect(getVisibleRows(groups, new Set())).toEqual(
      ROWS.map((row) => ({ kind: 'row', row, groupKey: null })),
    )
  })

  it('includes one group header item per group plus its rows in order when none are collapsed', () => {
    const groups = groupData(ROWS, ['dept'], [])
    const visible = getVisibleRows(groups, new Set())
    const headerKeys = visible.filter((i) => i.kind === 'group').map((i) => i.key)
    expect(headerKeys.sort()).toEqual(['Eng', 'HR'])
    expect(
      visible
        .filter((i) => i.kind === 'row')
        .map((i) => i.row.name)
        .sort(),
    ).toEqual(ROWS.map((r) => r.name).sort())
  })

  it("omits a collapsed group's rows but keeps its header item reachable", () => {
    const groups = groupData(ROWS, ['dept'], [])
    const visible = getVisibleRows(groups, new Set(['Eng']))
    expect(visible.some((i) => i.kind === 'group' && i.key === 'Eng')).toBe(true)
    expect(visible.some((i) => i.kind === 'row' && i.row.dept === 'Eng')).toBe(false)
    expect(visible.filter((i) => i.kind === 'row' && i.row.dept === 'HR')).toHaveLength(2)
  })

  it('collapses every group by default when defaultCollapsed is true, except those toggled back open', () => {
    const groups = groupData(ROWS, ['dept'], [])
    const visible = getVisibleRows(groups, new Set(['Eng']), true)
    expect(visible.some((i) => i.kind === 'row' && i.row.dept === 'Eng')).toBe(true)
    expect(visible.some((i) => i.kind === 'row' && i.row.dept === 'HR')).toBe(false)
  })
})

// ─── paginateVisibleGroups ───────────────────────────────────────────────────

describe('paginateVisibleGroups', () => {
  // groupData(ROWS, ['dept']) => Eng:[Alice, Clara], HR:[Bob, David] (first-seen order)
  it("splits an expanded group's rows across pages and repeats its header as 'continued'", () => {
    const groupedFull = groupData(ROWS, ['dept'], [])
    const visible = getVisibleRows(groupedFull, new Set())
    // visible = [group Eng, row Alice, row Clara, group HR, row Bob, row David] (6 items)

    const page1 = paginateVisibleGroups(groupedFull, visible, new Set(), false, 1, 2)
    expect(page1).toEqual([
      { key: 'Eng', keyParts: ['Eng'], rows: [ROWS[0]], continued: false, sampleRow: ROWS[0] },
    ])

    const page2 = paginateVisibleGroups(groupedFull, visible, new Set(), false, 2, 2)
    expect(page2).toEqual([
      { key: 'Eng', keyParts: ['Eng'], rows: [ROWS[2]], continued: true, sampleRow: ROWS[0] },
      { key: 'HR', keyParts: ['HR'], rows: [], continued: false, sampleRow: ROWS[1] },
    ])

    const page3 = paginateVisibleGroups(groupedFull, visible, new Set(), false, 3, 2)
    expect(page3).toEqual([
      {
        key: 'HR',
        keyParts: ['HR'],
        rows: [ROWS[1], ROWS[3]],
        continued: true,
        sampleRow: ROWS[1],
      },
    ])
  })

  it("backfills a collapsed group's rows from the full group instead of its (empty) visible slice", () => {
    const groupedFull = groupData(ROWS, ['dept'], [])
    const collapsedGroups = new Set(['Eng'])
    const visible = getVisibleRows(groupedFull, collapsedGroups)
    // visible = [group Eng (collapsed, no rows), group HR, row Bob, row David] (4 items)

    const chunks = paginateVisibleGroups(groupedFull, visible, collapsedGroups, false, 1, 10)
    expect(chunks).toEqual([
      {
        key: 'Eng',
        keyParts: ['Eng'],
        rows: [ROWS[0], ROWS[2]],
        continued: false,
        sampleRow: ROWS[0],
      },
      {
        key: 'HR',
        keyParts: ['HR'],
        rows: [ROWS[1], ROWS[3]],
        continued: false,
        sampleRow: ROWS[1],
      },
    ])
  })

  it('reduces to plain data-row pagination with a single null-key chunk when ungrouped', () => {
    const groupedFull = groupData(ROWS, [], [])
    const visible = getVisibleRows(groupedFull, new Set())
    const page1 = paginateVisibleGroups(groupedFull, visible, new Set(), false, 1, 2)
    expect(page1).toEqual([
      {
        key: null,
        keyParts: [],
        rows: [ROWS[0], ROWS[1]],
        continued: false,
        sampleRow: ROWS[0],
      },
    ])
  })

  it('counts header rows toward the page budget: numPages grows with an expanded group, shrinks when collapsed', () => {
    const groupedFull = groupData(ROWS, ['dept'], [])
    const expanded = getVisibleRows(groupedFull, new Set())
    const collapsed = getVisibleRows(groupedFull, new Set(['Eng', 'HR']))
    expect(computeTotalPages(expanded.length, 2)).toBe(3) // 6 items (2 headers + 4 rows) / 2
    expect(computeTotalPages(collapsed.length, 2)).toBe(1) // 2 header-only items
  })
})

// ─── paginateVisibleItems ────────────────────────────────────────────────────

describe('paginateVisibleItems', () => {
  it("prepends a synthetic continuation header when a page's slice starts mid-group", () => {
    const groupedFull = groupData(ROWS, ['dept'], [])
    const visible = getVisibleRows(groupedFull, new Set())
    const page2 = paginateVisibleItems(visible, 2, 2)
    expect(page2).toEqual([
      { kind: 'group', key: 'Eng' },
      { kind: 'row', row: ROWS[2], groupKey: 'Eng' },
      { kind: 'group', key: 'HR' },
    ])
  })

  it('does not prepend anything when a page starts on a real header or ungrouped data', () => {
    const groupedFull = groupData(ROWS, ['dept'], [])
    const visible = getVisibleRows(groupedFull, new Set())
    const page1 = paginateVisibleItems(visible, 1, 2)
    expect(page1[0]).toEqual({ kind: 'group', key: 'Eng' })

    const ungrouped = getVisibleRows(groupData(ROWS, [], []), new Set())
    const ungroupedPage2 = paginateVisibleItems(ungrouped, 2, 2)
    expect(ungroupedPage2).toEqual([
      { kind: 'row', row: ROWS[2], groupKey: null },
      { kind: 'row', row: ROWS[3], groupKey: null },
    ])
  })
})

// ─── planRowNav ───────────────────────────────────────────────────────────────

describe('planRowNav', () => {
  // Group G with rows a, b, c; pageSize 2 -> pages [G, a] [b, c] (page 2 gets a continued G).
  const [a, b, c] = [{ n: 'a' }, { n: 'b' }, { n: 'c' }]
  const G = { kind: 'group', key: 'G' } as const
  const visible: VisibleItem<{ n: string }>[] = [
    G,
    { kind: 'row', row: a, groupKey: 'G' },
    { kind: 'row', row: b, groupKey: 'G' },
    { kind: 'row', row: c, groupKey: 'G' },
  ]
  const ctx = (page: number, over: Partial<Parameters<typeof planRowNav>[2]> = {}) => ({
    visibleItems: visible,
    navigableItems: paginateVisibleItems(visible, page, 2),
    page,
    numPages: 2,
    pageSize: 2,
    selectable: true,
    rowClickable: false,
    ...over,
  })
  const key = (
    k: string,
    mods: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean } = {},
  ) => ({
    key: k,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    ...mods,
  })
  const row = (r: { n: string }) => ({ kind: 'row', row: r }) as const

  it('ArrowDown focuses the next item, Shift extending the selection to it', () => {
    expect(planRowNav(key('ArrowDown', { shiftKey: true }), G, ctx(1))).toEqual({
      kind: 'focus',
      item: visible[1],
      page: undefined,
      extend: a,
    })
  })

  it("an arrow at a page's edge crosses to the adjacent page's near end", () => {
    expect(planRowNav(key('ArrowDown'), row(a), ctx(1))).toEqual({
      kind: 'focus',
      item: G, // page 2 repeats the continued group's header
      page: 2,
      extend: undefined,
    })
    expect(planRowNav(key('ArrowUp'), G, ctx(2))).toMatchObject({ item: visible[1], page: 1 })
  })

  it('crosses to no page whose items are all non-navigable rows', () => {
    const rows: VisibleItem<{ n: string }>[] = [a, b].map((r) => ({ kind: 'row', row: r }))
    const plain = { visibleItems: rows, numPages: 2, pageSize: 1, selectable: false }
    const nav = { ...plain, navigableItems: [], page: 1, rowClickable: false }
    expect(planRowNav(key('ArrowDown'), rows[0], nav)).toBeNull()
  })

  it('returns null where there is nowhere to go, so the page keeps the key', () => {
    expect(planRowNav(key('ArrowUp'), G, ctx(1))).toBeNull()
    expect(planRowNav(key('Home'), G, ctx(1))).toBeNull()
    expect(planRowNav(key('Home', { ctrlKey: true }), G, ctx(1))).toBeNull()
    expect(planRowNav(key('ArrowDown'), row(c), ctx(2))).toBeNull()
  })

  it('plain End stays on the page; Ctrl+End crosses to the last page', () => {
    expect(planRowNav(key('End'), G, ctx(1))).toMatchObject({ item: visible[1], page: undefined })
    expect(planRowNav(key('End', { ctrlKey: true }), G, ctx(1))).toMatchObject({
      item: visible[3],
      page: 2,
    })
    expect(planRowNav(key('Home', { metaKey: true }), row(c), ctx(2))).toMatchObject({
      item: G,
      page: 1,
    })
  })

  it('Shift extends nothing when rows are not selectable', () => {
    const plan = planRowNav(key('End', { shiftKey: true }), G, ctx(1, { selectable: false }))
    expect(plan).toMatchObject({ kind: 'focus', extend: undefined })
  })

  it('Space toggles a row or a group selection, only when selectable', () => {
    expect(planRowNav(key(' '), row(a), ctx(1))).toEqual({ kind: 'toggleRow', row: a })
    expect(planRowNav(key(' '), G, ctx(1))).toEqual({ kind: 'toggleGroupSelection', key: 'G' })
    expect(planRowNav(key(' '), row(a), ctx(1, { selectable: false }))).toBeNull()
  })

  it('Enter collapses a group, or clicks a row only when rows are clickable', () => {
    expect(planRowNav(key('Enter'), G, ctx(1))).toEqual({ kind: 'toggleCollapse', key: 'G' })
    expect(planRowNav(key('Enter'), row(a), ctx(1))).toBeNull()
    expect(planRowNav(key('Enter'), row(a), ctx(1, { rowClickable: true }))).toEqual({
      kind: 'rowClick',
      row: a,
    })
  })
})

// ─── pageSizeOptions ─────────────────────────────────────────────────────────

describe('pageSizeOptions', () => {
  it('returns the default choices when pageSize is already one of them', () => {
    expect(pageSizeOptions(20, 20)).toEqual([10, 20, 50, 100])
  })

  it('inserts a custom pageSize in sorted order when absent from the defaults', () => {
    expect(pageSizeOptions(5, 5)).toEqual([5, 10, 20, 50, 100])
    expect(pageSizeOptions(30, 30)).toEqual([10, 20, 30, 50, 100])
    expect(pageSizeOptions(200, 200)).toEqual([10, 20, 50, 100, 200])
  })

  // U27: dropping the starting size once another was picked could hide the whole pager
  it('keeps the starting page size among the choices', () => {
    expect(pageSizeOptions(10, 5)).toEqual([5, 10, 20, 50, 100])
    expect(pageSizeOptions(30, 5)).toEqual([5, 10, 20, 30, 50, 100])
    expect(pageSizeOptions(5, 5)).toEqual([5, 10, 20, 50, 100])
  })
})

describe('tableStatus', () => {
  it('reads the shown and total row counts, with the page once there are several', () => {
    expect(tableStatus(LABELS_EN, 12, 40, 1, 1)).toBe('12 / 40 rows')
    expect(tableStatus(LABELS_EN, 12, 40, 2, 3)).toBe('12 / 40 rows, Page 2 of 3')
  })

  it('says no row matches, or that there are no rows at all', () => {
    expect(tableStatus(LABELS_EN, 0, 40, 1, 1)).toBe('No matching rows')
    expect(tableStatus(LABELS_EN, 0, 0, 1, 1)).toBe('No rows')
  })
})

describe('showsPager', () => {
  it('shows the pager only when the smallest page size splits the items into pages', () => {
    expect(showsPager(10, [10, 20, 50, 100])).toBe(false)
    expect(showsPager(11, [10, 20, 50, 100])).toBe(true)
    expect(showsPager(6, [5, 10, 20, 50, 100])).toBe(true)
  })
})

// ─── isGroupCollapsed ─────────────────────────────────────────────────────────

describe('isGroupCollapsed', () => {
  it('defaults to expanded, treating collapsedGroups as the set of collapsed keys', () => {
    expect(isGroupCollapsed(new Set(), 'Eng')).toBe(false)
    expect(isGroupCollapsed(new Set(['Eng']), 'Eng')).toBe(true)
  })

  it('inverts to collapsed-by-default when defaultCollapsed is true, treating collapsedGroups as toggled-open keys', () => {
    expect(isGroupCollapsed(new Set(), 'Eng', true)).toBe(true)
    expect(isGroupCollapsed(new Set(['Eng']), 'Eng', true)).toBe(false)
  })
})

describe('isSameVisibleItem / indexOfVisibleItem', () => {
  it('matches row items by object identity, not structural equality', () => {
    const row = ROWS[0]
    const copy = { ...row }
    expect(isSameVisibleItem({ kind: 'row', row }, { kind: 'row', row })).toBe(true)
    expect(isSameVisibleItem({ kind: 'row', row }, { kind: 'row', row: copy })).toBe(false)
  })

  it('matches group items by key', () => {
    expect(isSameVisibleItem({ kind: 'group', key: 'Eng' }, { kind: 'group', key: 'Eng' })).toBe(
      true,
    )
    expect(isSameVisibleItem({ kind: 'group', key: 'Eng' }, { kind: 'group', key: 'HR' })).toBe(
      false,
    )
  })

  it('never matches across kinds', () => {
    expect(isSameVisibleItem({ kind: 'group', key: 'Eng' }, { kind: 'row', row: ROWS[0] })).toBe(
      false,
    )
  })

  it('indexOfVisibleItem finds the matching item, or -1 for null/absent target', () => {
    const groups = groupData(ROWS, ['dept'], [])
    const items = getVisibleRows(groups, new Set())
    expect(indexOfVisibleItem(items, null)).toBe(-1)
    expect(indexOfVisibleItem(items, { kind: 'group', key: 'Eng' })).toBeGreaterThanOrEqual(0)
    expect(indexOfVisibleItem(items, { kind: 'row', row: ROWS[0] })).toBeGreaterThanOrEqual(0)
    expect(indexOfVisibleItem(items, { kind: 'group', key: 'Nope' })).toBe(-1)
  })
})

// ─── computeStringValues ─────────────────────────────────────────────────────

describe('computeStringValues', () => {
  const COLS = [
    { key: 'name' as const, label: 'Name', type: 'string' as const },
    { key: 'dept' as const, label: 'Dept', type: 'string' as const },
  ]

  it('returns the sorted unique string values of one column', () => {
    expect(computeStringValues(ROWS, COLS[1])).toEqual(['Eng', 'HR'])
    expect(computeStringValues(ROWS, COLS[0])).toEqual(['Alice', 'Bob', 'Clara', 'David'])
  })

  it('flattens and dedupes array-valued columns instead of stringifying the whole array', () => {
    const cols = [{ key: 'tags' as const, label: 'Tags' }]
    const result = computeStringValues(GAMES, cols[0])
    expect(result).toEqual(['Action', 'Adventure', 'RPG'])
  })

  it('lists a "(none)" entry for rows with an empty array, by default', () => {
    const cols = [{ key: 'tags' as const, label: 'Tags' }]
    const result = computeStringValues(GAMES_WITH_EMPTY, cols[0])
    expect(result).toEqual(['(none)', 'Action', 'Adventure', 'RPG'])
  })

  it('uses a custom emptyLabel for rows with an empty array', () => {
    const cols = [{ key: 'tags' as const, label: 'Tags' }]
    const result = computeStringValues(GAMES_WITH_EMPTY, cols[0], 'N/A')
    expect(result).toContain('N/A')
  })

  it('collects values from a computed column', () => {
    const cols = [
      { key: 'band', label: 'Band', value: (row: Row) => (row.salary >= 90000 ? 'High' : 'Low') },
    ]
    const result = computeStringValues(ROWS, cols[0])
    expect(result).toEqual(['High', 'Low'])
  })

  it('includes date columns (fed into computeDateTree by the filter UI, not excluded like number)', () => {
    const cols = [{ key: 'released' as const, label: 'Released', type: 'date' as const }]
    const games = [
      { released: '2023-05-14' },
      { released: '2021-01-02' },
      { released: '2023-05-14' },
    ]
    const result = computeStringValues(games, cols[0])
    expect(result).toEqual(['2021-01-02', '2023-05-14'])
  })

  it('orders values by a column compare instead of alphabetically (issue #15)', () => {
    const TIER_ORDER = ['bronze', 'silver', 'gold']
    const cols = [
      {
        key: 'tier',
        label: 'Tier',
        compare: (a: unknown, b: unknown) =>
          TIER_ORDER.indexOf(String(a).toLowerCase()) - TIER_ORDER.indexOf(String(b).toLowerCase()),
      },
    ]
    const rows = [{ tier: 'Gold' }, { tier: 'Bronze' }, { tier: 'Silver' }]
    const result = computeStringValues(rows, cols[0])
    expect(result).toEqual(['Bronze', 'Silver', 'Gold'])
  })

  it('compareMissingLast pins the empty-string stand-in for a missing scalar at the end (issue #15)', () => {
    const cols = [{ key: 'dept', label: 'Dept', compare: compareMissingLast() }]
    const rows = [{ dept: 'Eng' }, { dept: '' }, { dept: 'HR' }]
    const result = computeStringValues(rows, cols[0])
    expect(result).toEqual(['Eng', 'HR', ''])
  })
})

// ─── computeStringValueCounts ───────────────────────────────────────────────

describe('computeStringValueCounts', () => {
  const COLS = [
    { key: 'name' as const, label: 'Name', type: 'string' as const },
    { key: 'dept' as const, label: 'Dept', type: 'string' as const },
    { key: 'salary' as const, label: 'Salary', type: 'number' as const },
  ]
  const [NAME, DEPT, SALARY] = COLS
  const TAGS = { key: 'tags' as const, label: 'Tags' }
  const GAME_NAME = { key: 'name' as const, label: 'Name' }
  const RELEASED = { key: 'released' as const, label: 'Released', type: 'date' as const }

  it('counts how many rows have each value, with no filters active', () => {
    const result = computeStringValueCounts(ROWS, DEPT, {}, {}, COLS)
    expect(result.get('Eng')).toBe(2)
    expect(result.get('HR')).toBe(2)
  })

  it('returns no counts for a numeric column', () => {
    expect(computeStringValueCounts(ROWS, SALARY, {}, {}, COLS).size).toBe(0)
  })

  it("does not narrow a column's own counts by its own active filter", () => {
    const filters = { dept: new Set(['Eng']) }
    const result = computeStringValueCounts(ROWS, DEPT, filters, {}, COLS)
    expect(result.get('Eng')).toBe(2)
    expect(result.get('HR')).toBe(2)
  })

  it("narrows a column's counts by other columns' active filters (faceted)", () => {
    const filters = { dept: new Set(['Eng']) }
    const result = computeStringValueCounts(ROWS, NAME, filters, {}, COLS)
    // Only Alice/Clara (Eng) remain when computing name counts, since dept's filter is "other".
    expect(result.get('Alice')).toBe(1)
    expect(result.get('Bob')).toBeUndefined()
  })

  it('flattens and dedupes array-valued columns, tallying per item', () => {
    const result = computeStringValueCounts(GAMES, TAGS, {}, {}, [TAGS])
    expect(result.get('Action')).toBe(2)
    expect(result.get('RPG')).toBe(2)
    expect(result.get('Adventure')).toBe(1)
  })

  it('counts rows with an empty array under the emptyLabel bucket', () => {
    const result = computeStringValueCounts(GAMES_WITH_EMPTY, TAGS, {}, {}, [TAGS], 'N/A')
    expect(result.get('N/A')).toBe(1)
  })

  it('includes date columns', () => {
    const games = [{ released: '2023-05-14' }, { released: '2023-05-14' }]
    const result = computeStringValueCounts(games, RELEASED, {}, {}, [RELEASED])
    expect(result.get('2023-05-14')).toBe(2)
  })

  it("does not narrow a column's own counts by its own excludeFilters entry", () => {
    const result = computeStringValueCounts(GAMES, TAGS, {}, {}, [TAGS], '(none)', {
      tags: new Set(['RPG']),
    })
    expect(result.get('RPG')).toBe(2)
  })

  it("narrows a column's counts by other columns' excludeFilters (faceted)", () => {
    // Excluding 'RPG' drops Game A and Game C, leaving only Game B for name counts.
    const result = computeStringValueCounts(GAMES, GAME_NAME, {}, {}, [GAME_NAME, TAGS], '(none)', {
      tags: new Set(['RPG']),
    })
    expect(result.get('Game B')).toBe(1)
    expect(result.get('Game A')).toBeUndefined()
  })

  it("narrows a column's counts by another column's filterModes override (faceted)", () => {
    const cols = [GAME_NAME, TAGS]
    const filters = { tags: new Set(['Action', 'RPG']) }
    // Default 'or': every game has at least one of Action/RPG, so all three remain.
    const orResult = computeStringValueCounts(GAMES, GAME_NAME, filters, {}, cols)
    expect(orResult.get('Game A')).toBe(1)
    expect(orResult.get('Game B')).toBe(1)
    expect(orResult.get('Game C')).toBe(1)
    // filterModes overrides tags to 'and': only Game A has both, so it's the only one left.
    const andResult = computeStringValueCounts(
      GAMES,
      GAME_NAME,
      filters,
      {},
      cols,
      '(none)',
      {},
      {
        tags: 'and',
      },
    )
    expect(andResult.get('Game A')).toBe(1)
    expect(andResult.get('Game B')).toBeUndefined()
    expect(andResult.get('Game C')).toBeUndefined()
  })

  it("does not narrow a date column's own counts by its own active rangeFilters entry", () => {
    const games = [{ released: '2023-05-14' }, { released: '2024-01-01' }]
    const rangeFilters = { released: { min: '2023-01-01', max: '2023-12-31' } }
    const result = computeStringValueCounts(games, RELEASED, {}, rangeFilters, [RELEASED])
    // The column's own range must not narrow its own checklist.
    expect(result.get('2023-05-14')).toBe(1)
    expect(result.get('2024-01-01')).toBe(1)
  })

  it("narrows a column's counts by another column's active rangeFilters entry (faceted)", () => {
    const games = [
      { name: 'Game A', released: '2023-05-14' },
      { name: 'Game B', released: '2024-01-01' },
    ]
    const rangeFilters = { released: { min: '2023-01-01', max: '2023-12-31' } }
    const result = computeStringValueCounts(games, GAME_NAME, {}, rangeFilters, [
      GAME_NAME,
      RELEASED,
    ])
    expect(result.get('Game A')).toBe(1)
    expect(result.get('Game B')).toBeUndefined()
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

  it('ignores diacritics on both the value and the term', () => {
    expect(filterValuesBySearch(['Öoo', 'Zoe'], 'ooo')).toEqual(['Öoo'])
  })
})

describe('normalizeForSearch', () => {
  it('lowercases plain ASCII', () => {
    expect(normalizeForSearch('Hello World 42')).toBe('hello world 42')
  })

  it('strips diacritics from non-ASCII text, including mixed and control characters', () => {
    expect(normalizeForSearch('Crème Brûlée')).toBe('creme brulee')
    expect(normalizeForSearch('A\tÉ\n')).toBe('a\te\n')
  })
})

// ─── filterValuesByCount ────────────────────────────────────────────────────

describe('filterValuesByCount', () => {
  const VALUES = ['Action', 'Adventure', 'RPG']

  it('drops values with a count of 0', () => {
    const counts = new Map([
      ['Action', 2],
      ['RPG', 1],
    ])
    expect(filterValuesByCount(VALUES, counts, new Set())).toEqual(['Action', 'RPG'])
  })

  it('drops values missing from the counts map entirely', () => {
    const counts = new Map([['Action', 2]])
    expect(filterValuesByCount(VALUES, counts, new Set())).toEqual(['Action'])
  })

  it('keeps a selected value even at a count of 0', () => {
    const counts = new Map([['Action', 2]])
    expect(filterValuesByCount(VALUES, counts, new Set(['Adventure']))).toEqual([
      'Action',
      'Adventure',
    ])
  })
})

// ─── filterValuesByRange ────────────────────────────────────────────────────

describe('filterValuesByRange', () => {
  const VALUES = ['2020-01-01', '2020-06-15', '2021-03-10', 'not a date']

  it('returns all values when no range is given', () => {
    expect(filterValuesByRange(VALUES, undefined)).toEqual(VALUES)
  })

  it('returns all values when the range has no bounds set', () => {
    expect(filterValuesByRange(VALUES, { min: '', max: '' })).toEqual(VALUES)
  })

  it('narrows to values on or after min, dropping unparseable values', () => {
    expect(filterValuesByRange(VALUES, { min: '2020-06-01', max: '' })).toEqual([
      '2020-06-15',
      '2021-03-10',
    ])
  })

  it('narrows to values on or before max, dropping unparseable values', () => {
    expect(filterValuesByRange(VALUES, { min: '', max: '2020-06-15' })).toEqual([
      '2020-01-01',
      '2020-06-15',
    ])
  })

  it('narrows by both bounds together', () => {
    expect(filterValuesByRange(VALUES, { min: '2020-02-01', max: '2020-12-31' })).toEqual([
      '2020-06-15',
    ])
  })

  it('uses a custom parseDate for the values, but the default ISO parser for the bounds', () => {
    const parseDate = (v: string) => {
      const [d, m, y] = v.split('/').map(Number)
      return new Date(y, m - 1, d).getTime()
    }
    // DD/MM/YYYY: default new Date(v) would misread these as MM/DD.
    const values = ['20/05/2023', '06/06/2023']
    expect(filterValuesByRange(values, { min: '2023-06-01', max: '' }, parseDate)).toEqual([
      '06/06/2023',
    ])
  })
})

// ─── computeValueBounds ─────────────────────────────────────────────────────

describe('computeValueBounds', () => {
  it('returns the min/max of a number column', () => {
    const col = { key: 'salary', label: 'Salary', type: 'number' as const }
    expect(computeValueBounds(ROWS, col)).toEqual({ min: 60000, max: 110000 })
  })

  it('returns the min/max of a date column via parseDate', () => {
    const col = { key: 'd', label: 'Date', type: 'date' as const }
    const rows = [
      { id: 1, d: '2020-06-15' },
      { id: 2, d: '2019-01-01' },
      { id: 3, d: '2021-03-10' },
    ]
    expect(computeValueBounds(rows, col)).toEqual({
      min: new Date(2019, 0, 1).getTime(),
      max: new Date(2021, 2, 10).getTime(),
    })
  })

  it('ignores rows with an unparseable value', () => {
    const col = { key: 'n', label: 'N', type: 'number' as const }
    const rows = [
      { id: 1, n: '10' },
      { id: 2, n: 'not a number' },
      { id: 3, n: '30' },
    ]
    expect(computeValueBounds(rows, col)).toEqual({ min: 10, max: 30 })
  })

  it('ignores missing values rather than reading them as 0 or 1970 (issue #47)', () => {
    const rows = [
      { n: 10, d: '2020-01-01' },
      { n: null, d: null },
      { n: '', d: '' },
      { n: 30, d: '2021-01-01' },
    ]
    expect(computeValueBounds(rows, { key: 'n', label: 'N', type: 'number' })).toEqual({
      min: 10,
      max: 30,
    })
    expect(computeValueBounds(rows, { key: 'd', label: 'D', type: 'date' })).toEqual({
      min: new Date(2020, 0, 1).getTime(),
      max: new Date(2021, 0, 1).getTime(),
    })
  })

  it('returns null when no row has a parseable value', () => {
    const col = { key: 'n', label: 'N', type: 'number' as const }
    expect(computeValueBounds([{ n: 'nope' }], col)).toBeNull()
  })

  it('returns null for an empty dataset', () => {
    const col = { key: 'n', label: 'N', type: 'number' as const }
    expect(computeValueBounds([], col)).toBeNull()
  })
})

// ─── sortFilterValues ───────────────────────────────────────────────────────

describe('sortFilterValues', () => {
  const VALUES = ['Charlie', 'Alice', 'Bob']
  const COUNTS = new Map([
    ['Charlie', 3],
    ['Alice', 1],
    ['Bob', 3],
  ])

  it('sorts alphabetically ascending', () => {
    expect(sortFilterValues(VALUES, COUNTS, { by: 'alpha', dir: 'asc' })).toEqual([
      'Alice',
      'Bob',
      'Charlie',
    ])
  })

  it('sorts alphabetically descending', () => {
    expect(sortFilterValues(VALUES, COUNTS, { by: 'alpha', dir: 'desc' })).toEqual([
      'Charlie',
      'Bob',
      'Alice',
    ])
  })

  it('sorts by count descending, tie-breaking alphabetically', () => {
    expect(sortFilterValues(VALUES, COUNTS, { by: 'count', dir: 'desc' })).toEqual([
      'Bob',
      'Charlie',
      'Alice',
    ])
  })

  it('sorts by count ascending, tie-breaking alphabetically', () => {
    expect(sortFilterValues(VALUES, COUNTS, { by: 'count', dir: 'asc' })).toEqual([
      'Alice',
      'Bob',
      'Charlie',
    ])
  })

  it('treats a value missing from counts as 0', () => {
    const result = sortFilterValues(['Zed', 'Alice'], new Map([['Alice', 1]]), {
      by: 'count',
      dir: 'asc',
    })
    expect(result).toEqual(['Zed', 'Alice'])
  })

  it('does not mutate the input array', () => {
    const original = [...VALUES]
    sortFilterValues(VALUES, COUNTS, { by: 'alpha', dir: 'desc' })
    expect(VALUES).toEqual(original)
  })

  it('uses a custom compare in alpha mode instead of localeCompare (issue #15)', () => {
    const tiers = ['Gold', 'Bronze', 'Silver']
    const TIER_ORDER = ['bronze', 'silver', 'gold']
    const compare = (a: string, b: string) =>
      TIER_ORDER.indexOf(a.toLowerCase()) - TIER_ORDER.indexOf(b.toLowerCase())
    expect(sortFilterValues(tiers, new Map(), { by: 'alpha', dir: 'asc' }, compare)).toEqual([
      'Bronze',
      'Silver',
      'Gold',
    ])
  })

  it('uses a custom compare as the count-mode tie-break instead of localeCompare (issue #15)', () => {
    const tiers = ['Gold', 'Bronze', 'Silver']
    const counts = new Map([
      ['Gold', 1],
      ['Bronze', 1],
      ['Silver', 1],
    ])
    const TIER_ORDER = ['bronze', 'silver', 'gold']
    const compare = (a: string, b: string) =>
      TIER_ORDER.indexOf(a.toLowerCase()) - TIER_ORDER.indexOf(b.toLowerCase())
    expect(sortFilterValues(tiers, counts, { by: 'count', dir: 'desc' }, compare)).toEqual([
      'Bronze',
      'Silver',
      'Gold',
    ])
  })

  it('compareMissingLast pins matching values last in alpha mode, in both directions (issue #15)', () => {
    const values = ['Charlie', '', 'Alice']
    const compare = compareMissingLast()
    expect(sortFilterValues(values, COUNTS, { by: 'alpha', dir: 'asc' }, compare)).toEqual([
      'Alice',
      'Charlie',
      '',
    ])
    expect(sortFilterValues(values, COUNTS, { by: 'alpha', dir: 'desc' }, compare)).toEqual([
      'Charlie',
      'Alice',
      '',
    ])
  })

  it('compareMissingLast pins matching values last as the count-mode tie-break too', () => {
    const values = ['Charlie', '', 'Alice']
    const counts = new Map([
      ['Charlie', 1],
      ['', 1],
      ['Alice', 1],
    ])
    const compare = compareMissingLast()
    expect(sortFilterValues(values, counts, { by: 'count', dir: 'desc' }, compare)).toEqual([
      'Alice',
      'Charlie',
      '',
    ])
  })
})

// ─── cycleValueSort ─────────────────────────────────────────────────────────

describe('cycleValueSort', () => {
  it('cycles alpha-asc → alpha-desc → count-desc → count-asc → alpha-asc', () => {
    let sort: { by: 'alpha' | 'count'; dir: 'asc' | 'desc' } = { by: 'alpha', dir: 'asc' }
    sort = cycleValueSort(sort)
    expect(sort).toEqual({ by: 'alpha', dir: 'desc' })
    sort = cycleValueSort(sort)
    expect(sort).toEqual({ by: 'count', dir: 'desc' })
    sort = cycleValueSort(sort)
    expect(sort).toEqual({ by: 'count', dir: 'asc' })
    sort = cycleValueSort(sort)
    expect(sort).toEqual({ by: 'alpha', dir: 'asc' })
  })
})

describe('nextValueSort', () => {
  it('cycles a checklist and only flips the date tree', () => {
    expect(nextValueSort({ key: 's', label: 'S' }, { by: 'alpha', dir: 'desc' })).toEqual({
      by: 'count',
      dir: 'desc',
    })
    expect(
      nextValueSort({ key: 'd', label: 'D', type: 'date' }, { by: 'alpha', dir: 'desc' }),
    ).toEqual({
      by: 'alpha',
      dir: 'asc',
    })
  })
})

// ─── toggleSortDir ──────────────────────────────────────────────────────────

describe('toggleSortDir', () => {
  it('flips asc to desc', () => {
    expect(toggleSortDir('asc')).toBe('desc')
  })

  it('flips desc to asc', () => {
    expect(toggleSortDir('desc')).toBe('asc')
  })
})

// ─── getValueSortIcon / getDateSortIcon ────────────────────────────────────

describe('getValueSortIcon', () => {
  it('renders alpha-asc', () => {
    expect(getValueSortIcon({ by: 'alpha', dir: 'asc' })).toBe('ABC ↑')
  })

  it('renders alpha-desc', () => {
    expect(getValueSortIcon({ by: 'alpha', dir: 'desc' })).toBe('ABC ↓')
  })

  it('renders count-desc', () => {
    expect(getValueSortIcon({ by: 'count', dir: 'desc' })).toBe('# ↓')
  })

  it('renders count-asc', () => {
    expect(getValueSortIcon({ by: 'count', dir: 'asc' })).toBe('# ↑')
  })
})

describe('getDateSortIcon', () => {
  it('renders asc', () => {
    expect(getDateSortIcon('asc')).toBe('↑')
  })

  it('renders desc', () => {
    expect(getDateSortIcon('desc')).toBe('↓')
  })
})

// ─── computeDateTree ────────────────────────────────────────────────────────

describe('computeDateTree', () => {
  it('groups values into a Year › Month › Day tree, sorted at every level', () => {
    const tree = computeDateTree(['2023-05-14', '2021-01-02', '2023-01-30'])
    expect(tree.map((n) => n.key)).toEqual(['2021', '2023'])
    const y2023 = tree[1]
    expect(y2023.children.map((n) => n.key)).toEqual(['01', '05'])
    expect(y2023.children[0].children.map((n) => n.key)).toEqual(['30'])
  })

  it('rolls up values from leaves to their ancestor month/year nodes', () => {
    const tree = computeDateTree(['2023-05-14', '2023-05-20'])
    const year = tree[0]
    expect(year.values).toEqual(['2023-05-14', '2023-05-20'])
    expect(year.children[0].values).toEqual(['2023-05-14', '2023-05-20'])
  })

  it('groups multiple raw values landing on the same day under one day leaf', () => {
    // Local times: a UTC 18:00 is the next day east of UTC+6.
    const tree = computeDateTree(['2023-05-14T09:00', '2023-05-14T18:00'])
    const day = tree[0].children[0].children[0]
    expect(day.values).toEqual(['2023-05-14T09:00', '2023-05-14T18:00'])
  })

  it('buckets unparseable values under a trailing emptyLabel leaf instead of dropping them', () => {
    const tree = computeDateTree(['2023-05-14', 'not-a-date'], 'N/A')
    expect(tree[tree.length - 1]).toEqual({
      key: 'N/A',
      path: 'N/A',
      values: ['not-a-date'],
      children: [],
    })
  })

  it('returns an empty array for an empty input', () => {
    expect(computeDateTree([])).toEqual([])
  })

  it('orders years/months/days ascending by default', () => {
    const tree = computeDateTree(['2023-05-14', '2021-01-02', '2023-01-30'])
    expect(tree.map((n) => n.key)).toEqual(['2021', '2023'])
    expect(tree[1].children.map((n) => n.key)).toEqual(['01', '05'])
  })

  it('orders years/months/days descending when dir is "desc"', () => {
    const tree = computeDateTree(['2023-05-14', '2021-01-02', '2023-01-30'], '(none)', 'desc')
    expect(tree.map((n) => n.key)).toEqual(['2023', '2021'])
    expect(tree[0].children.map((n) => n.key)).toEqual(['05', '01'])
    expect(tree[0].children[0].children.map((n) => n.key)).toEqual(['14'])
  })

  it('keeps the trailing emptyLabel leaf last regardless of dir', () => {
    const tree = computeDateTree(['2023-05-14', '2021-01-02', 'not-a-date'], '(none)', 'desc')
    expect(tree[tree.length - 1].key).toBe('(none)')
    expect(tree.map((n) => n.key)).toEqual(['2023', '2021', '(none)'])
  })

  it('uses a custom parseDate to resolve an otherwise-ambiguous format', () => {
    // "05/06/2023" is ambiguous (MM/DD vs DD/DD); a custom parser can pin it to DD/MM/YYYY,
    // which `new Date(v)` (the default) would instead read as month 5, day 6.
    const parseDate = (v: string) => {
      const [d, m, y] = v.split('/').map(Number)
      return new Date(y, m - 1, d).getTime()
    }
    const tree = computeDateTree(['05/06/2023', '01/01/2023'], '(none)', 'asc', parseDate)
    expect(tree[0].children.map((n) => n.key)).toEqual(['01', '06'])
  })
})

// ─── getDateTreeNodeState ───────────────────────────────────────────────────

describe('getDateTreeNodeState', () => {
  const node = computeDateTree(['2023-05-14', '2023-05-20'])[0].children[0] // 2023-05, 2 leaves

  it('is unchecked when none of the node values are selected', () => {
    expect(getDateTreeNodeState(node, new Set())).toBe('unchecked')
  })

  it('is checked when every node value is selected', () => {
    expect(getDateTreeNodeState(node, new Set(['2023-05-14', '2023-05-20']))).toBe('checked')
  })

  it('is indeterminate when only some node values are selected', () => {
    expect(getDateTreeNodeState(node, new Set(['2023-05-14']))).toBe('indeterminate')
  })
})

// ─── sumDateTreeNodeCount ───────────────────────────────────────────────────

describe('sumDateTreeNodeCount', () => {
  it('sums the facet counts of every raw value under a node', () => {
    const node = computeDateTree(['2023-05-14', '2023-05-20'])[0].children[0]
    const counts = new Map([
      ['2023-05-14', 3],
      ['2023-05-20', 1],
    ])
    expect(sumDateTreeNodeCount(node, counts)).toBe(4)
  })

  it('treats a value missing from the counts map as 0', () => {
    const node = computeDateTree(['2023-05-14'])[0].children[0]
    expect(sumDateTreeNodeCount(node, new Map())).toBe(0)
  })
})

// ─── findDateTreeNode ───────────────────────────────────────────────────────

describe('findDateTreeNode', () => {
  const tree = computeDateTree(['2023-05-14', '2021-01-02'])

  it('finds a year node by path', () => {
    expect(findDateTreeNode(tree, '2021')?.key).toBe('2021')
  })

  it('finds a nested day node by its full path', () => {
    expect(findDateTreeNode(tree, '2023-05-14')?.values).toEqual(['2023-05-14'])
  })

  it('returns undefined for an unknown path', () => {
    expect(findDateTreeNode(tree, '1999-01-01')).toBeUndefined()
  })
})

describe('selectDateRange', () => {
  const values = [
    '2021-01-02',
    '2023-02-10',
    '2023-05-14',
    '2023-05-20',
    '2023-06-01',
    '2024-06-15',
    '2024-07-01',
  ]
  const tree = computeDateTree(values)
  const node = (path: string) => findDateTreeNode(tree, path)!

  it('selects the leaf values between two day nodes', () => {
    const result = selectDateRange(values, node('2023-05-14'), node('2023-05-20'))
    expect(result.sort()).toEqual(['2023-05-14', '2023-05-20'])
  })

  it('selects every value chronologically between two month nodes, excluding a later sibling month', () => {
    // Regression: ranging 2023-02 → 2024-06 must not pull in 2024-07 just because the "2024"
    // year row would sit visually between them if the tree were rendered/expanded — the range
    // is a chronological interval, not a sweep over rendered rows.
    const result = selectDateRange(values, node('2023-02'), node('2024-06'))
    expect(result.sort()).toEqual([
      '2023-02-10',
      '2023-05-14',
      '2023-05-20',
      '2023-06-01',
      '2024-06-15',
    ])
  })

  it('is order-independent — clicking the later node first gives the same interval', () => {
    const result = selectDateRange(values, node('2024-06'), node('2023-02'))
    expect(result.sort()).toEqual([
      '2023-02-10',
      '2023-05-14',
      '2023-05-20',
      '2023-06-01',
      '2024-06-15',
    ])
  })

  it('spans a full year when one endpoint is a year node', () => {
    const result = selectDateRange(values, node('2021'), node('2023-05'))
    expect(result.sort()).toEqual(['2021-01-02', '2023-02-10', '2023-05-14', '2023-05-20'])
  })

  it('excludes values that fall outside the interval', () => {
    const result = selectDateRange(values, node('2023-05-14'), node('2023-05-20'))
    expect(result).not.toContain('2024-07-01')
    expect(result).not.toContain('2021-01-02')
  })

  it('uses a custom parseDate to resolve an otherwise-ambiguous format', () => {
    const parseDate = (v: string) => {
      const [d, m, y] = v.split('/').map(Number)
      return new Date(y, m - 1, d).getTime()
    }
    const ddmm = ['01/01/2023', '06/05/2023', '20/05/2023', '01/06/2023']
    const tree = computeDateTree(ddmm, '(none)', 'asc', parseDate)
    const find = (path: string) => findDateTreeNode(tree, path)!
    // 06/05/2023 and 20/05/2023 are DD/MM (May), which the default new Date(v) would misread
    // as MM/DD (June); the custom parser keeps them grouped under the "05" (May) month node.
    const result = selectDateRange(ddmm, find('2023-05'), find('2023-05'), parseDate)
    expect(result.sort()).toEqual(['06/05/2023', '20/05/2023'])
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

  it('returns all rows instead of an empty slice when pageSize is NaN', () => {
    expect(paginateData(ROWS, 1, NaN)).toEqual(ROWS)
  })

  it('falls back to page 1 when page is NaN', () => {
    const result = paginateData(ROWS, NaN, 2)
    expect(result.map((r) => r.id)).toEqual([1, 2])
  })
})

// ─── computeTotalPages ───────────────────────────────────────────────────────────

describe('clampInt', () => {
  it('floors and clamps a finite number', () => {
    expect(clampInt(2.7, 1)).toBe(2)
    expect(clampInt(-5, 0)).toBe(0)
    expect(clampInt(9, 1, 3)).toBe(3)
  })

  it('returns undefined for a non-finite or non-number value', () => {
    expect(clampInt(NaN, 1)).toBeUndefined()
    expect(clampInt(Infinity, 0)).toBeUndefined()
    expect(clampInt('2', 1)).toBeUndefined()
  })
})

describe('computeTotalPages', () => {
  it('returns 1 when pageSize is 0 (pagination disabled)', () => {
    expect(computeTotalPages(100, 0)).toBe(1)
  })

  it('returns correct count for evenly divisible dataset', () => {
    expect(computeTotalPages(4, 2)).toBe(2)
  })

  it('rounds up for a partial last page', () => {
    expect(computeTotalPages(5, 2)).toBe(3)
  })

  it('returns 1 for an empty dataset', () => {
    expect(computeTotalPages(0, 10)).toBe(1)
  })

  it('returns 1 when dataset is smaller than pageSize', () => {
    expect(computeTotalPages(3, 10)).toBe(1)
  })

  it('returns 1 (not NaN) when pageSize is NaN', () => {
    expect(computeTotalPages(100, NaN)).toBe(1)
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

  it('adds a desc sort fresh when defaultDir is desc', () => {
    expect(toggleSort([], 'updatedAt', 'desc')).toEqual([{ key: 'updatedAt', dir: 'desc' }])
  })

  it('flips desc to asc when defaultDir is desc (cycle reversed)', () => {
    const result = toggleSort([{ key: 'updatedAt', dir: 'desc' }], 'updatedAt', 'desc')
    expect(result).toEqual([{ key: 'updatedAt', dir: 'asc' }])
  })

  it('removes sort when already asc and defaultDir is desc', () => {
    const result = toggleSort([{ key: 'updatedAt', dir: 'asc' }], 'updatedAt', 'desc')
    expect(result).toEqual([])
  })
})

// ─── replaceSort ──────────────────────────────────────────────────────────────

describe('replaceSort with an exact dir', () => {
  it('applies it without cycling, keeping group sorts first', () => {
    const sorts: SortEntry[] = [{ key: 'name', dir: 'desc' }]
    expect(replaceSort(sorts, 'name', 'asc', [], 'desc')).toEqual([{ key: 'name', dir: 'desc' }])
    const grouped: SortEntry[] = [
      { key: 'dept', dir: 'asc' },
      { key: 'name', dir: 'asc' },
    ]
    expect(replaceSort(grouped, 'score', 'asc', ['dept'], 'desc')).toEqual([
      { key: 'dept', dir: 'asc' },
      { key: 'score', dir: 'desc' },
    ])
  })

  it("sets a grouped column's direction in place", () => {
    const sorts: SortEntry[] = [
      { key: 'dept', dir: 'asc' },
      { key: 'name', dir: 'asc' },
    ]
    expect(replaceSort(sorts, 'dept', 'asc', ['dept'], 'desc')).toEqual([
      { key: 'dept', dir: 'desc' },
      { key: 'name', dir: 'asc' },
    ])
  })
})

describe('replaceSort', () => {
  it('sets a fresh asc sort when nothing is sorted', () => {
    expect(replaceSort([], 'name')).toEqual([{ key: 'name', dir: 'asc' }])
  })

  it('replaces a multi-sort with a fresh single asc sort', () => {
    const existing = [
      { key: 'dept', dir: 'asc' as const },
      { key: 'name', dir: 'desc' as const },
    ]
    expect(replaceSort(existing, 'name')).toEqual([{ key: 'name', dir: 'asc' }])
  })

  it('replaces a different single sort with a fresh asc sort', () => {
    expect(replaceSort([{ key: 'dept', dir: 'desc' }], 'name')).toEqual([
      { key: 'name', dir: 'asc' },
    ])
  })

  it('cycles asc to desc when key is already the sole sort', () => {
    expect(replaceSort([{ key: 'name', dir: 'asc' }], 'name')).toEqual([
      { key: 'name', dir: 'desc' },
    ])
  })

  it('removes the sort when key is already the sole desc sort', () => {
    expect(replaceSort([{ key: 'name', dir: 'desc' }], 'name')).toEqual([])
  })

  it('sets a fresh desc sort when defaultDir is desc', () => {
    expect(replaceSort([], 'updatedAt', 'desc')).toEqual([{ key: 'updatedAt', dir: 'desc' }])
  })

  it('cycles desc to asc when key is already the sole sort and defaultDir is desc', () => {
    expect(replaceSort([{ key: 'updatedAt', dir: 'desc' }], 'updatedAt', 'desc')).toEqual([
      { key: 'updatedAt', dir: 'asc' },
    ])
  })

  it("keeps a grouped column's sort entry untouched instead of discarding it (issue #17)", () => {
    const existing = [
      { key: 'dept', dir: 'asc' as const },
      { key: 'name', dir: 'desc' as const },
    ]
    // Clicking "score"'s header shouldn't wipe dept's group-ordering sort, since dept has no
    // header of its own to reclick once grouped.
    expect(replaceSort(existing, 'score', 'asc', ['dept'])).toEqual([
      { key: 'dept', dir: 'asc' },
      { key: 'score', dir: 'asc' },
    ])
  })

  it('still cycles the sole non-group sort in place, leaving the group entry alone', () => {
    const existing = [
      { key: 'dept', dir: 'asc' as const },
      { key: 'name', dir: 'asc' as const },
    ]
    expect(replaceSort(existing, 'name', 'asc', ['dept'])).toEqual([
      { key: 'dept', dir: 'asc' },
      { key: 'name', dir: 'desc' },
    ])
  })

  it("cycles a grouped column's own entry in place instead of duplicating it (reachable via keepVisibleWhenGrouped)", () => {
    // A grouped column normally has no header to click, but keepVisibleWhenGrouped keeps one —
    // the group/rest split above must not re-append a second entry for a key it already holds.
    const sorts = [{ key: 'dept', dir: 'asc' as const }]
    expect(replaceSort(sorts, 'dept', 'asc', ['dept'])).toEqual([{ key: 'dept', dir: 'desc' }])
  })

  it("cycling a grouped column's own entry to none leaves every other group level untouched", () => {
    const sorts = [
      { key: 'dept', dir: 'desc' as const },
      { key: 'role', dir: 'asc' as const },
    ]
    expect(replaceSort(sorts, 'dept', 'asc', ['dept', 'role'])).toEqual([
      { key: 'role', dir: 'asc' },
    ])
  })
})

describe('insertGroupSort', () => {
  it('inserts a fresh asc entry when the grouped column had no sort', () => {
    expect(insertGroupSort([], [], 'dept')).toEqual([{ key: 'dept', dir: 'asc' }])
  })

  it("places the new entry after previously grouped columns' entries but before other columns'", () => {
    const sorts = [
      { key: 'region', dir: 'asc' as const },
      { key: 'name', dir: 'desc' as const },
    ]
    expect(insertGroupSort(sorts, ['region'], 'dept')).toEqual([
      { key: 'region', dir: 'asc' },
      { key: 'dept', dir: 'asc' },
      { key: 'name', dir: 'desc' },
    ])
  })

  it('keeps an existing manual direction, only repositioning the entry', () => {
    const sorts = [
      { key: 'name', dir: 'asc' as const },
      { key: 'dept', dir: 'desc' as const },
    ]
    expect(insertGroupSort(sorts, [], 'dept')).toEqual([
      { key: 'dept', dir: 'desc' },
      { key: 'name', dir: 'asc' },
    ])
  })

  it('uses the given default direction for a genuinely new entry', () => {
    expect(insertGroupSort([], [], 'updatedAt', 'desc')).toEqual([
      { key: 'updatedAt', dir: 'desc' },
    ])
  })
})

describe('reorderGroupSorts', () => {
  it("reorders group columns' sort entries to follow groupBy's new order", () => {
    const sorts = [
      { key: 'region', dir: 'asc' as const },
      { key: 'dept', dir: 'desc' as const },
      { key: 'name', dir: 'asc' as const },
    ]
    expect(reorderGroupSorts(sorts, ['dept', 'region'])).toEqual([
      { key: 'dept', dir: 'desc' },
      { key: 'region', dir: 'asc' },
      { key: 'name', dir: 'asc' },
    ])
  })

  it('skips a groupBy key with no matching sort entry', () => {
    const sorts = [{ key: 'region', dir: 'asc' as const }]
    expect(reorderGroupSorts(sorts, ['dept', 'region'])).toEqual([{ key: 'region', dir: 'asc' }])
  })

  it('leaves non-group entries in their original relative position, after the group block', () => {
    const sorts = [
      { key: 'name', dir: 'asc' as const },
      { key: 'dept', dir: 'desc' as const },
      { key: 'region', dir: 'asc' as const },
    ]
    expect(reorderGroupSorts(sorts, ['region', 'dept'])).toEqual([
      { key: 'region', dir: 'asc' },
      { key: 'dept', dir: 'desc' },
      { key: 'name', dir: 'asc' },
    ])
  })
})

// ─── appendOrToggleSort ─────────────────────────────────────────────────────────

describe('appendOrToggleSort', () => {
  it('appends a fresh asc sort when key is not present', () => {
    expect(appendOrToggleSort([], 'name')).toEqual([{ key: 'name', dir: 'asc' }])
  })

  it('appends without touching existing entries', () => {
    const existing = [{ key: 'dept', dir: 'asc' as const }]
    const result = appendOrToggleSort(existing, 'name')
    expect(result).toEqual([
      { key: 'dept', dir: 'asc' },
      { key: 'name', dir: 'asc' },
    ])
  })

  it('flips asc to desc in place when key is already present', () => {
    const existing = [
      { key: 'dept', dir: 'asc' as const },
      { key: 'name', dir: 'asc' as const },
    ]
    expect(appendOrToggleSort(existing, 'name')).toEqual([
      { key: 'dept', dir: 'asc' },
      { key: 'name', dir: 'desc' },
    ])
  })

  it('flips desc back to asc instead of removing the entry', () => {
    expect(appendOrToggleSort([{ key: 'name', dir: 'desc' }], 'name')).toEqual([
      { key: 'name', dir: 'asc' },
    ])
  })

  it('never removes an entry, even after repeated calls', () => {
    let sorts = appendOrToggleSort([], 'name')
    sorts = appendOrToggleSort(sorts, 'name')
    sorts = appendOrToggleSort(sorts, 'name')
    expect(sorts).toHaveLength(1)
    expect(sorts[0].key).toBe('name')
  })

  it('appends a fresh desc sort when defaultDir is desc', () => {
    expect(appendOrToggleSort([], 'updatedAt', 'desc')).toEqual([{ key: 'updatedAt', dir: 'desc' }])
  })
})

// ─── toggleFilterAll ─────────────────────────────────────────────────────────

describe('toggleFilterAll', () => {
  it('selects all given values when none are selected', () => {
    const result = toggleFilterAll({}, 'dept', ['Eng', 'HR'])
    expect([...result['dept']]).toEqual(['Eng', 'HR'])
  })

  it('deselects all given values when only some are selected', () => {
    const result = toggleFilterAll({ dept: new Set(['Eng']) }, 'dept', ['Eng', 'HR'])
    expect(result['dept'].size).toBe(0)
  })

  it('deselects all given values when all are already selected', () => {
    const result = toggleFilterAll({ dept: new Set(['Eng', 'HR']) }, 'dept', ['Eng', 'HR'])
    expect(result['dept'].size).toBe(0)
  })

  it('only affects the given values, not other selected values for the same key', () => {
    const result = toggleFilterAll({ dept: new Set(['Eng', 'Sales']) }, 'dept', ['Eng', 'HR'])
    expect([...result['dept']].sort()).toEqual(['Sales'])
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

describe('setFilterValues', () => {
  it('adds all given values when selected is true', () => {
    const result = setFilterValues({}, 'dept', ['Eng', 'HR'], true)
    expect([...result['dept']].sort()).toEqual(['Eng', 'HR'])
  })

  it('does not deselect values already selected when selected is true', () => {
    const result = setFilterValues({ dept: new Set(['Eng', 'Sales']) }, 'dept', ['Eng', 'HR'], true)
    expect([...result['dept']].sort()).toEqual(['Eng', 'HR', 'Sales'])
  })

  it('removes all given values when selected is false, regardless of prior state', () => {
    const result = setFilterValues(
      { dept: new Set(['Eng', 'HR', 'Sales']) },
      'dept',
      ['Eng', 'HR'],
      false,
    )
    expect([...result['dept']]).toEqual(['Sales'])
  })

  it('preserves other keys', () => {
    const initial = { name: new Set(['Alice']) }
    const result = setFilterValues(initial, 'dept', ['Eng'], true)
    expect(result['name'].has('Alice')).toBe(true)
  })
})

// ─── toggleExcludeAll ─────────────────────────────────────────────────────────

describe('toggleExcludeAll', () => {
  it('excludes all given values (unchecks them) when none are currently excluded', () => {
    const result = toggleExcludeAll({}, 'dept', ['Eng', 'HR'])
    expect([...result['dept']].sort()).toEqual(['Eng', 'HR'])
  })

  it('excludes all given values (unchecks them) when only some are currently excluded', () => {
    // Mirrors toggleFilterAll's own "deselects all when only some are selected" — here "checked"
    // means "not excluded", so a partial (indeterminate) checked state also clears (unchecks/
    // excludes) on click, same Gmail convention, read through the opposite polarity.
    const result = toggleExcludeAll({ dept: new Set(['Eng']) }, 'dept', ['Eng', 'HR'])
    expect([...result['dept']].sort()).toEqual(['Eng', 'HR'])
  })

  it('only affects the given values, not other excluded values for the same key', () => {
    const result = toggleExcludeAll({ dept: new Set(['Eng', 'Sales']) }, 'dept', ['Eng', 'HR'])
    expect([...result['dept']].sort()).toEqual(['Eng', 'HR', 'Sales'])
  })

  it('preserves other keys', () => {
    const initial = { name: new Set(['Alice']) }
    const result = toggleExcludeAll(initial, 'dept', ['Eng'])
    expect(result['name'].has('Alice')).toBe(true)
  })
})

// ─── cycleFilterValue ─────────────────────────────────────────────────────────

describe('cycleFilterValue', () => {
  it('cycles a neutral value to included', () => {
    const { filters, excludeFilters } = cycleFilterValue({}, {}, 'tags', 'RPG')
    expect(filters['tags'].has('RPG')).toBe(true)
    expect(excludeFilters['tags']?.has('RPG') ?? false).toBe(false)
  })

  it('cycles an included value to excluded', () => {
    const { filters, excludeFilters } = cycleFilterValue(
      { tags: new Set(['RPG']) },
      {},
      'tags',
      'RPG',
    )
    expect(filters['tags'].has('RPG')).toBe(false)
    expect(excludeFilters['tags'].has('RPG')).toBe(true)
  })

  it('cycles an excluded value back to neutral', () => {
    const { filters, excludeFilters } = cycleFilterValue(
      {},
      { tags: new Set(['RPG']) },
      'tags',
      'RPG',
    )
    expect(filters['tags']?.has('RPG') ?? false).toBe(false)
    expect(excludeFilters['tags'].has('RPG')).toBe(false)
  })

  it('never leaves a value in both sets at once', () => {
    let state = {
      filters: {} as Record<string, Set<string>>,
      excludeFilters: {} as Record<string, Set<string>>,
    }
    for (let i = 0; i < 3; i++)
      state = cycleFilterValue(state.filters, state.excludeFilters, 'tags', 'RPG')
    // after 3 cycles: neutral -> include -> exclude -> neutral
    expect(state.filters['tags']?.has('RPG') ?? false).toBe(false)
    expect(state.excludeFilters['tags']?.has('RPG') ?? false).toBe(false)
  })

  it('preserves other values already selected for the same key', () => {
    const { filters } = cycleFilterValue({ tags: new Set(['Action']) }, {}, 'tags', 'RPG')
    expect(filters['tags'].has('Action')).toBe(true)
    expect(filters['tags'].has('RPG')).toBe(true)
  })

  it('preserves other keys', () => {
    const { filters, excludeFilters } = cycleFilterValue(
      { name: new Set(['Alice']) },
      { dept: new Set(['HR']) },
      'tags',
      'RPG',
    )
    expect(filters['name'].has('Alice')).toBe(true)
    expect(excludeFilters['dept'].has('HR')).toBe(true)
  })
})

// ─── clearExcludeValues ───────────────────────────────────────────────────────

describe('clearExcludeValues', () => {
  it('removes the given values from the exclude set for key', () => {
    const result = clearExcludeValues({ tags: new Set(['RPG', 'Action']) }, 'tags', ['RPG'])
    expect([...result['tags']]).toEqual(['Action'])
  })

  it('is a no-op when the key has no exclude entry yet', () => {
    const result = clearExcludeValues({}, 'tags', ['RPG'])
    expect(result['tags'].size).toBe(0)
  })

  it('preserves other keys', () => {
    const initial = { dept: new Set(['HR']) }
    const result = clearExcludeValues(initial, 'tags', ['RPG'])
    expect(result['dept'].has('HR')).toBe(true)
  })
})

// ─── setFilterMode ──────────────────────────────────────────────────────────

describe('setFilterMode', () => {
  it('sets a key with no prior entry', () => {
    const result = setFilterMode({}, 'tags', 'and')
    expect(result['tags']).toBe('and')
  })

  it('overwrites an existing entry', () => {
    const once = setFilterMode({}, 'tags', 'and')
    const twice = setFilterMode(once, 'tags', 'or')
    expect(twice['tags']).toBe('or')
  })

  it('setting the same mode twice is idempotent', () => {
    const once = setFilterMode({}, 'tags', 'and')
    const twice = setFilterMode(once, 'tags', 'and')
    expect(twice['tags']).toBe('and')
  })

  it('preserves other keys', () => {
    const result = setFilterMode({ dept: 'and' }, 'tags', 'and')
    expect(result['dept']).toBe('and')
    expect(result['tags']).toBe('and')
  })
})

// ─── columnHasActiveFilter ──────────────────────────────────────────────────

describe('columnHasActiveFilter', () => {
  it('is false with no filters at all', () => {
    expect(columnHasActiveFilter('dept', {}, {}, {})).toBe(false)
  })

  it('is true when the column has an include value', () => {
    expect(columnHasActiveFilter('dept', { dept: new Set(['Eng']) }, {}, {})).toBe(true)
  })

  it('is true when the column has an exclude value', () => {
    expect(columnHasActiveFilter('dept', {}, { dept: new Set(['Eng']) }, {})).toBe(true)
  })

  it('is false for an empty Set (cleared but present key)', () => {
    expect(columnHasActiveFilter('dept', { dept: new Set() }, { dept: new Set() }, {})).toBe(false)
  })

  it('is true when the column has a min or max range bound set', () => {
    expect(columnHasActiveFilter('score', {}, {}, { score: { min: '80', max: '' } })).toBe(true)
    expect(columnHasActiveFilter('score', {}, {}, { score: { min: '', max: '100' } })).toBe(true)
  })

  it('is false for a range entry with both bounds empty', () => {
    expect(columnHasActiveFilter('score', {}, {}, { score: { min: '', max: '' } })).toBe(false)
  })

  it('does not confuse one column with another', () => {
    expect(columnHasActiveFilter('score', { dept: new Set(['Eng']) }, {}, {})).toBe(false)
  })
})

// ─── filterOpenState (U36) ──────────────────────────────────────────────────

describe('filterOpenState', () => {
  const COLS = [
    { key: 'name', label: 'Name' },
    { key: 'salary', label: 'Salary', category: 'Work' },
    { key: 'dept', label: 'Dept', category: 'Work' },
    { key: 'city', label: 'City', category: 'Contact' },
  ]
  const open = (pickedKey: string | null, include: Record<string, Set<string>> = {}) =>
    filterOpenState(COLS, include, {}, {}, pickedKey)

  it('shows the picked column and expands its category', () => {
    const s = open('salary')
    expect(s.shownKey).toBe('salary')
    expect([...s.collapsed]).toEqual(['Contact'])
  })

  it('shows the first active column, not an uncategorized one listed before it', () => {
    const s = open(null, { city: new Set(['Paris']) })
    expect(s.shownKey).toBe('city')
    expect([...s.collapsed]).toEqual(['Work'])
  })

  it("falls back once the picked column isn't filterable any more", () => {
    expect(open('gone').shownKey).toBe('name')
  })

  it('shows the first column when nothing is picked or active, its category expanded', () => {
    expect(open(null).shownKey).toBe('name')
    const categorized = filterOpenState(COLS.slice(1), {}, {}, {}, null)
    expect(categorized.shownKey).toBe('salary')
    expect([...categorized.collapsed]).toEqual(['Contact'])
  })
})

// ─── orderFilterColumnsByActive / applyColumnOrderSnapshot ─────────────────

describe('orderFilterColumnsByActive', () => {
  const COLS = [
    { key: 'name', label: 'Name' },
    { key: 'dept', label: 'Dept' },
    { key: 'score', label: 'Score' },
    { key: 'joined', label: 'Joined' },
  ]

  it('is plain alphabetical order when nothing is active', () => {
    expect(orderFilterColumnsByActive(COLS, {}, {}, {})).toEqual([
      'dept',
      'joined',
      'name',
      'score',
    ])
  })

  it('puts active-filter columns first, alphabetical within each group', () => {
    const order = orderFilterColumnsByActive(
      COLS,
      { score: new Set(['90']) },
      {},
      { joined: { min: '2023-01-01', max: '' } },
    )
    expect(order).toEqual(['joined', 'score', 'dept', 'name'])
  })
})

describe('applyColumnOrderSnapshot', () => {
  const COLS = [
    { key: 'name', label: 'Name' },
    { key: 'dept', label: 'Dept' },
    { key: 'score', label: 'Score' },
  ]

  it('falls back to alphabetical order when no snapshot was taken (null)', () => {
    expect(applyColumnOrderSnapshot(COLS, null).map((c) => c.key)).toEqual([
      'dept',
      'name',
      'score',
    ])
  })

  it('orders columns per the snapshot', () => {
    expect(applyColumnOrderSnapshot(COLS, ['score', 'dept', 'name']).map((c) => c.key)).toEqual([
      'score',
      'dept',
      'name',
    ])
  })

  it('sorts a column absent from the snapshot after every snapshotted one', () => {
    // 'score' wasn't in the snapshot (e.g. added to `columns` after the dropdown opened) — it
    // sorts after 'dept'/'name', alphabetically among any other such stragglers.
    expect(applyColumnOrderSnapshot(COLS, ['dept', 'name']).map((c) => c.key)).toEqual([
      'dept',
      'name',
      'score',
    ])
  })
})

// ─── isMultiValueColumn ─────────────────────────────────────────────────────────

describe('isMultiValueColumn', () => {
  it('is true when at least one row has an array value for the column', () => {
    expect(isMultiValueColumn(GAMES, undefined, 'tags')).toBe(true)
  })

  it('is false for a plain scalar column', () => {
    expect(isMultiValueColumn(GAMES, undefined, 'name')).toBe(false)
  })

  it('is false for an empty dataset', () => {
    expect(isMultiValueColumn([], undefined, 'tags')).toBe(false)
  })

  it('resolves the value through a column with a `value` accessor', () => {
    const col = { key: 'tagCount', label: 'Tags', value: (row: Game) => row.tags }
    expect(isMultiValueColumn(GAMES, col, 'tagCount')).toBe(true)
  })
})

// ─── selectRange ──────────────────────────────────────────────────────────────

describe('selectRange', () => {
  it('returns the inclusive run between anchor and target when anchor comes first', () => {
    expect(selectRange(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['a', 'b', 'c'])
  })

  it('returns the inclusive run in list order when target comes before anchor', () => {
    expect(selectRange(['a', 'b', 'c', 'd'], 'c', 'a')).toEqual(['a', 'b', 'c'])
  })

  it('returns a single-item array when anchor and target are the same', () => {
    expect(selectRange(['a', 'b', 'c'], 'b', 'b')).toEqual(['b'])
  })

  it('falls back to just the target when the anchor is not present in items', () => {
    expect(selectRange(['a', 'b', 'c'], 'z', 'b')).toEqual(['b'])
  })

  it('works with object identity, not just primitives', () => {
    const a = { id: 1 }
    const b = { id: 2 }
    const c = { id: 3 }
    expect(selectRange([a, b, c], a, c)).toEqual([a, b, c])
  })
})

// ─── Selection identity (getRowId) ────────────────────────────────────────────

interface SelRow {
  id: number
  name: string
}
const getRowId = (r: SelRow) => r.id

describe('isRowSelected', () => {
  it('without getRowId, matches by object identity', () => {
    const a: SelRow = { id: 1, name: 'a' }
    const aRefetched: SelRow = { id: 1, name: 'a' }
    expect(isRowSelected(new Set([a]), a)).toBe(true)
    expect(isRowSelected(new Set([a]), aRefetched)).toBe(false)
  })

  it('with getRowId, matches by id across different object references', () => {
    const a: SelRow = { id: 1, name: 'a' }
    const aRefetched: SelRow = { id: 1, name: 'a (refetched)' }
    expect(isRowSelected(new Set([a]), aRefetched, getRowId)).toBe(true)
  })

  it('with getRowId, a different id does not match', () => {
    const a: SelRow = { id: 1, name: 'a' }
    const b: SelRow = { id: 2, name: 'b' }
    expect(isRowSelected(new Set([a]), b, getRowId)).toBe(false)
  })
})

describe('getSelectedRows', () => {
  it('without getRowId, filters by object identity', () => {
    const a: SelRow = { id: 1, name: 'a' }
    const b: SelRow = { id: 2, name: 'b' }
    expect(getSelectedRows([a, b], new Set([a]))).toEqual([a])
  })

  it('with getRowId, filters by id even against refetched objects', () => {
    const a: SelRow = { id: 1, name: 'a' }
    const aRefetched: SelRow = { id: 1, name: 'a (refetched)' }
    const b: SelRow = { id: 2, name: 'b' }
    expect(getSelectedRows([aRefetched, b], new Set([a]), getRowId)).toEqual([aRefetched])
  })
})

describe('toggleRowInSelection', () => {
  it('without getRowId, adds an unselected row and removes an already-selected one', () => {
    const a: SelRow = { id: 1, name: 'a' }
    expect([...toggleRowInSelection(new Set(), a)]).toEqual([a])
    expect([...toggleRowInSelection(new Set([a]), a)]).toEqual([])
  })

  it('with getRowId, toggling a refetched row removes the old reference by id', () => {
    const a: SelRow = { id: 1, name: 'a' }
    const aRefetched: SelRow = { id: 1, name: 'a (refetched)' }
    const next = toggleRowInSelection(new Set([a]), aRefetched, getRowId)
    expect(next.size).toBe(0)
  })

  it('does not mutate the input selection', () => {
    const a: SelRow = { id: 1, name: 'a' }
    const original = new Set<Row>()
    toggleRowInSelection(original, a)
    expect(original.size).toBe(0)
  })
})

describe('toggleAllInSelection', () => {
  const a: SelRow = { id: 1, name: 'a' }
  const b: SelRow = { id: 2, name: 'b' }

  it('selects all when none are selected', () => {
    expect([...toggleAllInSelection(new Set(), [a, b])].sort()).toEqual([a, b].sort())
  })

  it('deselects all when any are already selected', () => {
    expect([...toggleAllInSelection(new Set([a]), [a, b])]).toEqual([])
  })

  it('with getRowId, selecting replaces a stale same-id reference rather than duplicating it', () => {
    const aStale: SelRow = { id: 1, name: 'a (stale)' }
    const next = toggleAllInSelection(new Set([aStale]), [a, b], getRowId)
    // aStale and a share id 1 — toggleAllInSelection sees `a` as "already selected" (by id) via
    // aStale, so this is the deselect-all branch: both should end up removed, not 3 entries.
    expect(next.size).toBe(0)
  })
})

describe('reconcileSelection', () => {
  it('is a no-op without getRowId', () => {
    const a: SelRow = { id: 1, name: 'a' }
    const selection = new Set([a])
    expect(reconcileSelection([], selection)).toBe(selection)
  })

  it('remaps a selected id to its fresh object reference in nextData', () => {
    const a: SelRow = { id: 1, name: 'a' }
    const aRefetched: SelRow = { id: 1, name: 'a (refetched)' }
    const next = reconcileSelection([aRefetched], new Set([a]), getRowId)
    expect([...next]).toEqual([aRefetched])
  })

  it('drops an id no longer present in nextData', () => {
    const a: SelRow = { id: 1, name: 'a' }
    const next = reconcileSelection([], new Set([a]), getRowId)
    expect(next.size).toBe(0)
  })

  it('returns the same Set instance when nothing actually changed', () => {
    const a: SelRow = { id: 1, name: 'a' }
    const selection = new Set([a])
    expect(reconcileSelection([a], selection, getRowId)).toBe(selection)
  })
})

describe('remapRow', () => {
  it('returns the row itself without getRowId', () => {
    const a: SelRow = { id: 1, name: 'a' }
    expect(remapRow(a, [], undefined)).toBe(a)
  })

  it('returns the fresh row with the same id', () => {
    const a: SelRow = { id: 1, name: 'a' }
    const aRefetched: SelRow = { id: 1, name: 'a (refetched)' }
    expect(remapRow(a, [aRefetched], getRowId)).toBe(aRefetched)
  })

  it('returns null when the id is gone, or for a null row', () => {
    expect(remapRow({ id: 1, name: 'a' }, [], getRowId)).toBeNull()
    expect(remapRow(null, [], getRowId)).toBeNull()
  })
})

describe('remapFocusTarget', () => {
  const a: SelRow = { id: 1, name: 'a' }
  const aRefetched: SelRow = { id: 1, name: 'a (refetched)' }

  it('repoints a row target at its fresh row, and drops it once gone', () => {
    const target = { kind: 'row', row: a, groupKey: '' } as VisibleItem<SelRow>
    expect(remapFocusTarget(target, [aRefetched], getRowId)).toEqual({ ...target, row: aRefetched })
    expect(remapFocusTarget(target, [], getRowId)).toBeNull()
  })

  it('keeps a group target, and any target without getRowId', () => {
    const group = { kind: 'group', key: 'g' } as VisibleItem<SelRow>
    const row = { kind: 'row', row: a, groupKey: '' } as VisibleItem<SelRow>
    expect(remapFocusTarget(group, [], getRowId)).toBe(group)
    expect(remapFocusTarget(row, [], undefined)).toBe(row)
  })
})

describe('isSameRow', () => {
  it('matches by reference, or by id with getRowId', () => {
    const a: SelRow = { id: 1, name: 'a' }
    const aRefetched: SelRow = { id: 1, name: 'a (refetched)' }
    expect(isSameRow(a, a)).toBe(true)
    expect(isSameRow(a, aRefetched)).toBe(false)
    expect(isSameRow(a, aRefetched, getRowId)).toBe(true)
    expect(isSameRow(a, null, getRowId)).toBe(false)
  })
})

describe('isNewRowFocusTarget', () => {
  const a: SelRow = { id: 1, name: 'a' }
  const aRefetched: SelRow = { id: 1, name: 'a (refetched)' }
  const b: SelRow = { id: 2, name: 'b' }
  const item = (row: SelRow) => ({ kind: 'row', row }) as VisibleItem<SelRow>

  it('is true for a new row target, including the same row moved to again', () => {
    expect(isNewRowFocusTarget(item(a), null)).toBe(true)
    expect(isNewRowFocusTarget(item(b), item(a), getRowId)).toBe(true)
    expect(isNewRowFocusTarget(item(a), item(a), getRowId)).toBe(true)
  })

  it('is false for the same target, a group, or a row a refetch only remapped', () => {
    const t = item(a)
    expect(isNewRowFocusTarget(t, t)).toBe(false)
    expect(isNewRowFocusTarget({ kind: 'group', key: 'g' }, null)).toBe(false)
    expect(isNewRowFocusTarget(item(aRefetched), item(a), getRowId)).toBe(false)
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

// ─── resolveFocusTarget ────────────────────────────────────────────────────

describe('resolveFocusTarget', () => {
  const alice = { name: 'Alice', dept: 'Eng' }
  const bob = { name: 'Bob', dept: 'Sales' }
  const carol = { name: 'Carol', dept: 'Eng' }
  const ungrouped = [{ key: null, keyParts: [], rows: [alice, bob, carol] }]

  it('returns null for a row not present in groups', () => {
    expect(
      resolveFocusTarget(ungrouped, { name: 'Nope', dept: 'X' }, new Set(), false, 0),
    ).toBeNull()
  })

  it('resolves an ungrouped row to page 1 with no collapse changes', () => {
    const collapsed = new Set<string>()
    const result = resolveFocusTarget(ungrouped, bob, collapsed, false, 0)
    expect(result).not.toBeNull()
    expect(result!.item).toEqual({ kind: 'row', row: bob, groupKey: null })
    expect(result!.page).toBe(1)
    expect(result!.collapsedGroups).toBe(collapsed)
  })

  it('computes the correct page when paginated', () => {
    // pageSize 1: alice=idx0 (page1), bob=idx1 (page2), carol=idx2 (page3)
    const result = resolveFocusTarget(ungrouped, carol, new Set(), false, 1)
    expect(result!.page).toBe(3)
  })

  it('force-expands a collapsed group containing the row', () => {
    const groups = [
      { key: 'Eng', keyParts: ['Eng'], rows: [alice, carol] },
      { key: 'Sales', keyParts: ['Sales'], rows: [bob] },
    ]
    const collapsed = new Set(['Eng'])
    const result = resolveFocusTarget(groups, carol, collapsed, false, 0)
    expect(result).not.toBeNull()
    expect(result!.collapsedGroups.has('Eng')).toBe(false)
    // Sales stays untouched
    expect(result!.item).toEqual({ kind: 'row', row: carol, groupKey: 'Eng' })
  })

  it('expands every group a multi-value row fans into', () => {
    const groups = [
      { key: 'Action', keyParts: ['Action'], rows: [alice] },
      { key: 'RPG', keyParts: ['RPG'], rows: [alice] },
    ]
    const result = resolveFocusTarget(groups, alice, new Set(['Action', 'RPG']), false, 0)
    expect(result!.collapsedGroups.has('Action')).toBe(false)
    expect(result!.collapsedGroups.has('RPG')).toBe(false)
  })

  it('does not expand an already-collapsed group the row is not in', () => {
    const groups = [
      { key: 'Eng', keyParts: ['Eng'], rows: [alice, carol] },
      { key: 'Sales', keyParts: ['Sales'], rows: [bob] },
    ]
    const result = resolveFocusTarget(groups, bob, new Set(['Eng']), false, 0)
    expect(result!.collapsedGroups.has('Eng')).toBe(true)
  })

  it('respects defaultGroupsCollapsed when deciding whether to expand', () => {
    const groups = [{ key: 'Eng', keyParts: ['Eng'], rows: [alice] }]
    // defaultGroupsCollapsed=true, empty collapsedGroups means every group starts collapsed
    const result = resolveFocusTarget(groups, alice, new Set(), true, 0)
    // Toggling away from the default marks it as manually opened
    expect(result!.collapsedGroups.has('Eng')).toBe(true)
    expect(result!.item.kind).toBe('row')
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

// ─── groupColumnsByCategory ───────────────────────────────────────────────────

describe('groupColumnsByCategory', () => {
  it('puts every column in uncategorized when none has a category', () => {
    const cols: { key: string; label: string; category?: string }[] = [
      { key: 'name', label: 'Name' },
      { key: 'dept', label: 'Dept' },
    ]
    const result = groupColumnsByCategory(cols)
    expect(result.uncategorized).toEqual(cols)
    expect(result.categories).toEqual([])
  })

  it('buckets categorized columns by category, in first-appearance order', () => {
    const cols = [
      { key: 'name', label: 'Name' },
      { key: 'salary', label: 'Salary', category: 'Finance' },
      { key: 'dept', label: 'Dept' },
      { key: 'bonus', label: 'Bonus', category: 'Finance' },
      { key: 'hireDate', label: 'Hire date', category: 'HR' },
    ]
    const result = groupColumnsByCategory(cols)
    expect(result.uncategorized.map((c) => c.key)).toEqual(['name', 'dept'])
    expect(result.categories.map((c) => c.name)).toEqual(['Finance', 'HR'])
    expect(result.categories[0].columns.map((c) => c.key)).toEqual(['salary', 'bonus'])
    expect(result.categories[1].columns.map((c) => c.key)).toEqual(['hireDate'])
  })

  it("preserves each column's original relative order within its bucket", () => {
    const cols = [
      { key: 'b', label: 'B', category: 'X' },
      { key: 'a', label: 'A', category: 'X' },
    ]
    const result = groupColumnsByCategory(cols)
    expect(result.categories[0].columns.map((c) => c.key)).toEqual(['b', 'a'])
  })
})

describe('addableLists', () => {
  const COLS = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name', category: 'Info' },
    { key: 'score', label: 'Score', category: 'Numbers' },
    { key: 'salary', label: 'Salary', category: 'Numbers' },
    { key: 'age', label: 'Age', category: 'Info' },
  ]
  const isActive = (key: string) => key === 'name'

  it('drops active columns, alphabetizes uncategorized columns and categories both', () => {
    const [addable, searching, shown, categorized] = addableLists(COLS, isActive, '')
    expect(addable.map((c) => c.key)).toEqual(['id', 'score', 'salary', 'age'])
    expect(searching).toBe(false)
    expect(shown.map((c) => c.key)).toEqual(['age', 'id', 'salary', 'score'])
    expect(categorized.uncategorized.map((c) => c.key)).toEqual(['id'])
    expect(categorized.categories.map((c) => c.name)).toEqual(['Info', 'Numbers'])
    expect(categorized.categories[1].columns.map((c) => c.key)).toEqual(['salary', 'score'])
  })

  it('narrows the shown list by label or category, keeping every addable column', () => {
    const [addable, searching, shown] = addableLists(COLS, isActive, ' numbers ')
    expect(addable).toHaveLength(4)
    expect(searching).toBe(true)
    expect(shown.map((c) => c.key)).toEqual(['salary', 'score'])
  })
})

describe('columnsDropdownLists', () => {
  const COLS = [
    { key: 'name', label: 'Name' },
    { key: 'salary', label: 'Salary', category: 'Work' },
    { key: 'dept', label: 'Dept', category: 'Work' },
    { key: 'age', label: 'Age' },
  ]
  const VISIBLE = new Set(['name', 'dept'])

  it('splits visible and available columns in column order, bucketing available ones', () => {
    const [searching, visible, available, categorized, eligible] = columnsDropdownLists(
      COLS,
      VISIBLE,
      '',
    )
    expect(searching).toBe(false)
    expect(visible.map((c) => c.key)).toEqual(['name', 'dept'])
    expect(available.map((c) => c.key)).toEqual(['salary', 'age'])
    expect(categorized.uncategorized.map((c) => c.key)).toEqual(['age'])
    expect(categorized.categories.map((c) => c.name)).toEqual(['Work'])
    expect(eligible).toBeUndefined()
  })

  it('narrows both lists while searching, eligible holding the shown visible keys', () => {
    const [searching, visible, available, , eligible] = columnsDropdownLists(COLS, VISIBLE, 'work')
    expect(searching).toBe(true)
    expect(visible.map((c) => c.key)).toEqual(['dept'])
    expect(available.map((c) => c.key)).toEqual(['salary'])
    expect([...eligible!]).toEqual(['dept'])
  })
})

// ─── columnMatchesSearch ──────────────────────────────────────────────────────

describe('columnMatchesSearch', () => {
  it('matches by label', () => {
    expect(columnMatchesSearch({ label: 'Salary' }, 'sal')).toBe(true)
    expect(columnMatchesSearch({ label: 'Salary' }, 'xyz')).toBe(false)
  })

  it('matches by category even when the label does not match', () => {
    expect(columnMatchesSearch({ label: 'Salary', category: 'Work' }, 'work')).toBe(true)
    expect(columnMatchesSearch({ label: 'Salary', category: undefined }, 'work')).toBe(false)
  })

  it('is case-insensitive and trims whitespace', () => {
    expect(columnMatchesSearch({ label: 'Salary', category: 'Work' }, '  WoRk  ')).toBe(true)
  })

  it('an empty/whitespace-only term always matches', () => {
    expect(columnMatchesSearch({ label: 'Salary' }, '')).toBe(true)
    expect(columnMatchesSearch({ label: 'Salary' }, '   ')).toBe(true)
  })
})

// ─── reconcileVisibleColumns ──────────────────────────────────────────────────

describe('reconcileVisibleColumns', () => {
  const OLD_COLS = [
    { key: 'name' as const, label: 'Name' },
    { key: 'dept' as const, label: 'Dept' },
    { key: 'salary' as const, label: 'Salary' },
  ]

  it('a fully disjoint column set keeps every new column visible, instead of filtering all of them out', () => {
    const newCols = [
      { key: 'sku' as const, label: 'SKU' },
      { key: 'qty' as const, label: 'Qty' },
    ]
    const result = reconcileVisibleColumns(OLD_COLS, newCols, new Set(['name', 'dept', 'salary']))
    expect(result).toEqual(new Set(['sku', 'qty']))
  })

  it("preserves an existing column's hidden state", () => {
    const visibleCols = new Set(['name', 'salary']) // dept hidden
    const result = reconcileVisibleColumns(OLD_COLS, OLD_COLS, visibleCols)
    expect(result).toEqual(new Set(['name', 'salary']))
  })

  it('defaults a genuinely new column to visible, alongside preserved existing ones', () => {
    const newCols = [...OLD_COLS, { key: 'region' as const, label: 'Region' }]
    const visibleCols = new Set(['name', 'salary']) // dept was already hidden
    const result = reconcileVisibleColumns(OLD_COLS, newCols, visibleCols)
    expect(result).toEqual(new Set(['name', 'salary', 'region']))
  })

  it('a removed column simply disappears, with no effect on the others', () => {
    const newCols = OLD_COLS.filter((c) => c.key !== 'dept')
    const result = reconcileVisibleColumns(OLD_COLS, newCols, new Set(['name', 'dept', 'salary']))
    expect(result).toEqual(new Set(['name', 'salary']))
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

  it('moves dragKey to just after targetKey when after is true', () => {
    expect(reorderColumn(['a', 'b', 'c'], 'a', 'b', true)).toEqual(['b', 'a', 'c'])
  })

  it('can make dragKey the new last entry by dropping after the current last one', () => {
    expect(reorderColumn(['a', 'b', 'c'], 'a', 'c', true)).toEqual(['b', 'c', 'a'])
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

// ─── moveVisibleColumnBy ──────────────────────────────────────────────────────

describe('moveVisibleColumnBy', () => {
  it('skips over a hidden neighbor to swap with the next visible one', () => {
    // b is hidden — a plain moveColumnBy(order, 'a', 1) would swap a↔b, invisible to the Visible
    // section's own rendered list.
    const order = ['a', 'b', 'c']
    const visible = new Set(['a', 'c'])
    expect(moveVisibleColumnBy(order, visible, 'a', 1)).toEqual(['c', 'b', 'a'])
  })

  it('skips over multiple hidden neighbors', () => {
    const order = ['a', 'b', 'c', 'd', 'e']
    const visible = new Set(['a', 'e'])
    expect(moveVisibleColumnBy(order, visible, 'a', 1)).toEqual(['e', 'b', 'c', 'd', 'a'])
  })

  it('leaves every skipped hidden column at its own exact position', () => {
    const order = ['a', 'b', 'c', 'd']
    const visible = new Set(['a', 'd'])
    const result = moveVisibleColumnBy(order, visible, 'd', -1)
    expect(result).toEqual(['d', 'b', 'c', 'a'])
    expect(result.indexOf('b')).toBe(1)
    expect(result.indexOf('c')).toBe(2)
  })

  it('is a no-op when there is no visible neighbor in that direction', () => {
    const order = ['a', 'b', 'c']
    const visible = new Set(['a'])
    expect(moveVisibleColumnBy(order, visible, 'a', 1)).toEqual(['a', 'b', 'c'])
    expect(moveVisibleColumnBy(order, visible, 'a', -1)).toEqual(['a', 'b', 'c'])
  })

  it('is a no-op when key is not present', () => {
    const order = ['a', 'b', 'c']
    expect(moveVisibleColumnBy(order, new Set(order), 'ghost', 1)).toEqual(order)
  })

  it('behaves exactly like moveColumnBy when every column is visible', () => {
    const order = ['a', 'b', 'c']
    const visible = new Set(order)
    expect(moveVisibleColumnBy(order, visible, 'a', 1)).toEqual(moveColumnBy(order, 'a', 1))
  })
})

// ─── moveSortBy ───────────────────────────────────────────────────────────────

describe('moveSortBy', () => {
  const sorts: SortEntry[] = [
    { key: 'a', dir: 'asc' },
    { key: 'b', dir: 'desc' },
    { key: 'c', dir: 'asc' },
  ]

  it('swaps entry with the next neighbor when delta is +1', () => {
    expect(moveSortBy(sorts, 'a', 1)).toEqual([
      { key: 'b', dir: 'desc' },
      { key: 'a', dir: 'asc' },
      { key: 'c', dir: 'asc' },
    ])
  })

  it('swaps entry with the previous neighbor when delta is -1', () => {
    expect(moveSortBy(sorts, 'c', -1)).toEqual([
      { key: 'a', dir: 'asc' },
      { key: 'c', dir: 'asc' },
      { key: 'b', dir: 'desc' },
    ])
  })

  it('is a no-op when already at the start', () => {
    expect(moveSortBy(sorts, 'a', -1)).toEqual(sorts)
  })

  it('is a no-op when already at the end', () => {
    expect(moveSortBy(sorts, 'c', 1)).toEqual(sorts)
  })

  it('is a no-op when key is not present', () => {
    expect(moveSortBy(sorts, 'ghost', 1)).toEqual(sorts)
  })

  it("preserves each entry's own dir while reordering", () => {
    const result = moveSortBy(sorts, 'b', -1)
    expect(result.find((s) => s.key === 'b')?.dir).toBe('desc')
  })
})

// ─── reorderSort ──────────────────────────────────────────────────────────────

describe('reorderSort', () => {
  const sorts: SortEntry[] = [
    { key: 'a', dir: 'asc' },
    { key: 'b', dir: 'desc' },
    { key: 'c', dir: 'asc' },
  ]

  it('moves dragKey to just before targetKey', () => {
    expect(reorderSort(sorts, 'c', 'a')).toEqual([
      { key: 'c', dir: 'asc' },
      { key: 'a', dir: 'asc' },
      { key: 'b', dir: 'desc' },
    ])
  })

  it('moves dragKey later when targetKey is after it', () => {
    expect(reorderSort(sorts, 'a', 'c')).toEqual([
      { key: 'b', dir: 'desc' },
      { key: 'a', dir: 'asc' },
      { key: 'c', dir: 'asc' },
    ])
  })

  it('is a no-op when dragKey equals targetKey', () => {
    expect(reorderSort(sorts, 'b', 'b')).toEqual(sorts)
  })

  it('returns sorts unchanged when targetKey is not present', () => {
    expect(reorderSort(sorts, 'a', 'ghost')).toEqual(sorts)
  })

  it('returns sorts unchanged when dragKey is not present', () => {
    expect(reorderSort(sorts, 'ghost', 'a')).toEqual(sorts)
  })

  it("preserves each entry's own dir while reordering", () => {
    const result = reorderSort(sorts, 'c', 'a')
    expect(result.find((s) => s.key === 'c')?.dir).toBe('asc')
    expect(result.find((s) => s.key === 'b')?.dir).toBe('desc')
  })

  it('moves dragKey to just after targetKey when after is true', () => {
    expect(reorderSort(sorts, 'a', 'b', true)).toEqual([
      { key: 'b', dir: 'desc' },
      { key: 'a', dir: 'asc' },
      { key: 'c', dir: 'asc' },
    ])
  })

  it('can make dragKey the new last entry by dropping after the current last one', () => {
    expect(reorderSort(sorts, 'a', 'c', true)).toEqual([
      { key: 'b', dir: 'desc' },
      { key: 'c', dir: 'asc' },
      { key: 'a', dir: 'asc' },
    ])
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

  it('counts columns with a non-empty excludeFilters entry', () => {
    const excludeFilters = { tags: new Set(['RPG']) }
    expect(countActiveFilters({}, {}, excludeFilters)).toBe(1)
  })

  it('counts a column once even when both filters and excludeFilters are non-empty for it', () => {
    const filters = { tags: new Set(['Action']) }
    const excludeFilters = { tags: new Set(['RPG']) }
    expect(countActiveFilters(filters, {}, excludeFilters)).toBe(1)
  })

  it('counts distinct columns across filters and excludeFilters separately', () => {
    const filters = { dept: new Set(['Eng']) }
    const excludeFilters = { tags: new Set(['RPG']) }
    expect(countActiveFilters(filters, {}, excludeFilters)).toBe(2)
  })
})

// ─── computeVirtualRange ─────────────────────────────────────────────────────

describe('computeVirtualRange', () => {
  it('returns all zeros for an empty list', () => {
    expect(computeVirtualRange(0, 260, 32, 0)).toEqual({
      startIndex: 0,
      endIndex: 0,
      offsetY: 0,
      totalHeight: 0,
    })
  })

  it('starts at 0 (clamped) when scrolled to the top, padded by overscan', () => {
    const range = computeVirtualRange(0, 260, 32, 10_000, 5)
    expect(range.startIndex).toBe(0)
    expect(range.offsetY).toBe(0)
    expect(range.totalHeight).toBe(10_000 * 32)
  })

  it('computes startIndex/offsetY from scrollTop minus overscan', () => {
    // scrolled to row 100 (3200px), minus 5 rows of overscan = row 95
    const range = computeVirtualRange(3200, 260, 32, 10_000, 5)
    expect(range.startIndex).toBe(95)
    expect(range.offsetY).toBe(95 * 32)
  })

  it('clamps endIndex to totalCount near the end of the list', () => {
    const range = computeVirtualRange(9990 * 32, 260, 32, 10_000, 5)
    expect(range.endIndex).toBe(10_000)
  })

  it('never returns a negative startIndex even with large overscan near the top', () => {
    const range = computeVirtualRange(32, 260, 32, 10_000, 5)
    expect(range.startIndex).toBe(0)
  })

  it('renders the whole list without windowing when it fits within the viewport', () => {
    const range = computeVirtualRange(0, 260, 32, 3, 5)
    expect(range.startIndex).toBe(0)
    expect(range.endIndex).toBe(3)
  })
})

// ─── getVirtualScrollTarget ─────────────────────────────────────────────────────

describe('getVirtualScrollTarget', () => {
  it('returns null when the target row is already fully within the viewport', () => {
    // viewport [0, 260), item height 32 -> rows 0-7 fully visible at scrollTop 0.
    expect(getVirtualScrollTarget(0, 260, 32, 3)).toBeNull()
  })

  it('scrolls up to the row itself when the target is above the viewport', () => {
    expect(getVirtualScrollTarget(320, 260, 32, 2)).toBe(64) // row 2 top = 2*32
  })

  it('scrolls down just enough to bring the row fully into view when below the viewport', () => {
    // viewport shows rows 0-7 at scrollTop 0; row 10 (top 320, bottom 352) is below it.
    expect(getVirtualScrollTarget(0, 260, 32, 10)).toBe(352 - 260) // bottom - viewportHeight
  })

  it('scrolls back to 0 when the target is the first row and the list is only slightly scrolled', () => {
    expect(getVirtualScrollTarget(5, 260, 32, 0)).toBe(0)
  })
})

describe('formatFilterValue', () => {
  const salary = {
    key: 'salary',
    label: 'Salary',
    type: 'number' as const,
    format: (v: unknown) => `$${Number(v).toLocaleString('en-US')}`,
  }

  it('shows a value through the column format, numbers as numbers', () => {
    expect(formatFilterValue(salary, '90000', '(none)')).toBe('$90,000')
  })

  it('leaves the empty placeholder, empty bounds and unformatted columns alone', () => {
    expect(formatFilterValue(salary, '(none)', '(none)')).toBe('(none)')
    expect(formatFilterValue(salary, '', '(none)')).toBe('')
    expect(formatFilterValue({ key: 'name', label: 'Name' }, 'Ada', '(none)')).toBe('Ada')
  })
})

describe('summarizeFilterValues with a format', () => {
  it('formats each named value', () => {
    expect(
      summarizeFilterValues(
        new Set(['a', 'b']),
        (n) => `+${n}`,
        (v) => v.toUpperCase(),
      ),
    ).toBe('A, B')
  })

  it('joins with the given separator, keeping a comma before the overflow', () => {
    const vals = new Set(['a', 'b', 'c', 'd', 'e'])
    expect(summarizeFilterValues(vals, (n) => `+${n}`, undefined, ' & ')).toBe('a & b & c, +2')
  })
})

describe('rangeInputProps', () => {
  const price = {
    key: 'price',
    label: 'Price',
    type: 'number' as const,
    format: (v: unknown) => `$${v}`,
  }
  const day = { key: 'day', label: 'Day', type: 'date' as const }
  const bounds = { min: 0, max: 1000 }

  it('leaves a number input empty, with the formatted bound as placeholder', () => {
    expect(rangeInputProps(price, 'max', undefined, bounds, 'Max')).toEqual({
      value: '',
      placeholder: '$1000',
      ariaLabel: 'Price Max',
    })
  })

  it('shows a set bound as typed, and falls back to the label without data', () => {
    expect(rangeInputProps(price, 'min', { min: '5', max: '' }, null, 'Min')).toEqual({
      value: '5',
      placeholder: 'Min',
      ariaLabel: 'Price Min',
    })
  })

  it('shows a date bound as the value, with no placeholder', () => {
    expect(
      rangeInputProps(
        day,
        'min',
        undefined,
        { min: new Date(2024, 0, 2).getTime(), max: 0 },
        'Min',
      ),
    ).toEqual({
      value: '2024-01-02',
      placeholder: undefined,
      ariaLabel: 'Day Min',
    })
  })
})

describe('range presets', () => {
  const played = {
    key: 'played',
    label: 'Played (h)',
    type: 'number' as const,
    format: (v: unknown) => `${v} h`,
    rangePresets: [
      { label: 'never played', max: 0 },
      { label: 'a lot', min: 100 },
    ],
  }

  it('matches a preset by its bounds, an omitted bound matching an empty one', () => {
    expect(matchingRangePreset(played, { min: '', max: '0' })?.label).toBe('never played')
    expect(matchingRangePreset(played, { min: '100', max: '' })?.label).toBe('a lot')
    expect(matchingRangePreset(played, { min: '0', max: '0' })).toBeUndefined()
    expect(matchingRangePreset(played, undefined)).toBeUndefined()
  })

  it('turns a preset into a range filter', () => {
    expect(rangePresetFilter({ label: 'x', max: 0 })).toEqual({ min: '', max: '0' })
  })

  it("words a chip with the preset's label, else the formatted bounds", () => {
    expect(rangeChipText(played, { min: '', max: '0' }, '(none)')).toBe('never played')
    expect(rangeChipText(played, { min: '1', max: '5' }, '(none)')).toBe('1 h–5 h')
  })

  it('words an open-ended range as a single bound', () => {
    expect(rangeChipText(played, { min: '5', max: '' }, '(none)')).toBe('≥ 5 h')
    expect(rangeChipText(played, { min: '', max: '20' }, '(none)')).toBe('≤ 20 h')
  })
})

// A date-only bound or value is a local day, whatever the time zone (GitHub issue #46).
describe.each(['America/New_York', 'UTC', 'Europe/Paris'])('date-only values in %s', (tz) => {
  beforeAll(() => {
    vi.stubEnv('TZ', tz)
  })
  afterAll(() => {
    vi.unstubAllEnvs()
  })

  const col = { key: 'd' as const, label: 'Date', type: 'date' as const }
  const rows = [
    { id: 1, d: 'Oct 23, 2026' },
    { id: 2, d: '2026-10-23' },
    { id: 3, d: '2026-10-23T23:30' },
  ]
  const kept = (min: string, max: string) =>
    filterData(rows, {}, { d: { min, max } }, [col]).map((r) => r.id)

  it('keeps rows dated on a min or max bound, the max covering its whole day', () => {
    expect(kept('', '2026-10-23')).toEqual([1, 2, 3])
    expect(kept('2026-10-23', '')).toEqual([1, 2, 3])
    expect(kept('2026-10-24', '')).toEqual([])
    expect(kept('', '2026-10-22')).toEqual([])
  })

  it('narrows date-tree values the same way', () => {
    const values = rows.map((r) => r.d)
    expect(filterValuesByRange(values, { min: '2026-10-23', max: '2026-10-23' })).toEqual(values)
  })

  it('puts a YYYY-MM-DD value on its own day in the date tree', () => {
    const [year] = computeDateTree(['2026-10-23'])
    expect(year.children[0].children[0].key).toBe('23')
  })

  it('formats a bound as the local day it falls on', () => {
    expect(formatRangeBound(new Date(2026, 9, 23).getTime(), col)).toBe('2026-10-23')
  })

  it('floors date bounds to local days, so a slider step lands on a day across DST', () => {
    const bounds = computeValueBounds([{ d: '2026-10-20T18:00' }, { d: '2026-11-02T09:00' }], col)
    expect(bounds).toEqual({
      min: new Date(2026, 9, 20).getTime(),
      max: new Date(2026, 10, 2).getTime(),
    })
    // 10 one-day steps from min cross Europe's and the US's DST ends.
    expect(formatRangeBound(bounds!.min + 10 * 86_400_000, col)).toBe('2026-10-30')
    expect(formatRangeBound(bounds!.min + 13 * 86_400_000, col)).toBe('2026-11-02')
  })

  it("places slider thumbs on the bounds' local days", () => {
    const bounds = { min: new Date(2026, 9, 1).getTime(), max: new Date(2026, 9, 31).getTime() }
    const geo = computeRangeSliderGeometry({ min: '2026-10-01', max: '2026-10-31' }, bounds, true)
    expect([geo.low, geo.high]).toEqual([bounds.min, bounds.max])
  })

  it('labels a bucket key with its own month', () => {
    expect(formatDatePart('month')('2024-05-01')).toBe(
      new Date(2024, 4, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    )
  })
})
