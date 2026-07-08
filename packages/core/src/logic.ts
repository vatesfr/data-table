import type { ColumnDefBase, SortEntry, RangeFilter } from './types'

function asRecord(row: object): Record<string, unknown> {
  return row as Record<string, unknown>
}

/**
 * Normalizes a cell value to a string array: arrays are stringified item-by-item, scalars
 * become a single-item array. An empty array normalizes to a single `emptyLabel` item instead
 * of dropping the row, so rows with no items still get a (labeled) filter/group bucket rather
 * than silently disappearing from checklists and grouped views.
 */
function multiValues(value: unknown, emptyLabel = '(none)'): string[] {
  if (!Array.isArray(value)) return [String(value ?? '')]
  return value.length > 0 ? value.map((v) => String(v)) : [emptyLabel]
}

export function processData<TRow extends object>(
  data: TRow[],
  filters: Record<string, Set<string>>,
  rangeFilters: Record<string, RangeFilter>,
  sorts: SortEntry[],
  columns: ColumnDefBase<TRow>[] = [],
  emptyLabel = '(none)',
): TRow[] {
  let result = [...data]
  const colByKey = new Map<string, ColumnDefBase<TRow>>(columns.map((c) => [c.key, c]))

  for (const [key, vals] of Object.entries(filters)) {
    if (vals.size === 0) continue
    const mode = colByKey.get(key)?.multiMode ?? 'or'
    result = result.filter((row) => {
      const rowValues = multiValues(asRecord(row)[key], emptyLabel)
      return mode === 'and'
        ? [...vals].every((v) => rowValues.includes(v))
        : [...vals].some((v) => rowValues.includes(v))
    })
  }

  for (const [key, range] of Object.entries(rangeFilters)) {
    if (range.min !== '')
      result = result.filter((r) => Number(asRecord(r)[key]) >= Number(range.min))
    if (range.max !== '')
      result = result.filter((r) => Number(asRecord(r)[key]) <= Number(range.max))
  }

  if (sorts.length > 0) {
    result.sort((a, b) => {
      for (const { key, dir } of sorts) {
        const va = asRecord(a)[key]
        const vb = asRecord(b)[key]
        let cmp = 0
        if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb
        else cmp = String(va ?? '').localeCompare(String(vb ?? ''))
        if (cmp !== 0) return dir === 'asc' ? cmp : -cmp
      }
      return 0
    })
  }

  return result
}

export interface GroupResult<TRow extends object> {
  key: string | null
  /** Per-groupBy-column string value that defines this group, aligned with the groupBy array. */
  keyParts: string[]
  rows: TRow[]
}

/**
 * Groups rows by one or more columns. When a groupBy column's value is an array (e.g. tags),
 * a row is fanned out into one group per array item instead of one group per whole-array
 * combination — so a row tagged ['Action', 'RPG'] appears in both the 'Action' and 'RPG' groups.
 */
export function groupData<TRow extends object>(
  data: TRow[],
  groupBy: string[],
  emptyLabel = '(none)',
): GroupResult<TRow>[] {
  if (groupBy.length === 0) return [{ key: null, keyParts: [], rows: data }]
  const groups: Record<string, { keyParts: string[]; rows: TRow[] }> = {}
  for (const row of data) {
    let combos: string[][] = [[]]
    for (const g of groupBy) {
      const values = multiValues(asRecord(row)[g], emptyLabel)
      combos = combos.flatMap((combo) => values.map((v) => [...combo, v]))
    }
    for (const keyParts of combos) {
      const key = keyParts.join(' › ')
      if (!groups[key]) groups[key] = { keyParts, rows: [] }
      groups[key].rows.push(row)
    }
  }
  return Object.entries(groups).map(([key, { keyParts, rows }]) => ({ key, keyParts, rows }))
}

export function computeStringValues<TRow extends object>(
  data: TRow[],
  columns: ColumnDefBase<TRow>[],
  emptyLabel = '(none)',
): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  const cols = columns.filter(
    (c) => c.type !== 'number' && c.type !== 'date' && c.filterable !== false,
  )
  for (const col of cols) {
    const values = [...new Set(data.flatMap((r) => multiValues(asRecord(r)[col.key], emptyLabel)))]
    map[col.key] = values.sort()
  }
  return map
}

export function toggleSort(sorts: SortEntry[], key: string): SortEntry[] {
  const existing = sorts.find((s) => s.key === key)
  if (!existing) return [...sorts, { key, dir: 'asc' }]
  if (existing.dir === 'asc')
    return sorts.map((s) => (s.key === key ? { ...s, dir: 'desc' as const } : s))
  return sorts.filter((s) => s.key !== key)
}

export function toggleFilter(
  filters: Record<string, Set<string>>,
  key: string,
  value: string,
): Record<string, Set<string>> {
  const next = new Set(filters[key] ?? [])
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return { ...filters, [key]: next }
}

export function toggleGroupBy(groupBy: string[], key: string): string[] {
  return groupBy.includes(key) ? groupBy.filter((k) => k !== key) : [...groupBy, key]
}

export function toggleCollapse(collapsedGroups: Set<string>, key: string): Set<string> {
  const next = new Set(collapsedGroups)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

export function getSortIcon(sorts: SortEntry[], key: string): string {
  const s = sorts.find((s) => s.key === key)
  return s ? (s.dir === 'asc' ? '↑' : '↓') : '↕'
}

export function getSortIndex(sorts: SortEntry[], key: string): number | null {
  const i = sorts.findIndex((s) => s.key === key)
  return i >= 0 ? i + 1 : null
}

export function paginateData<TRow extends object>(
  data: TRow[],
  page: number,
  pageSize: number,
): TRow[] {
  if (pageSize <= 0) return data
  const start = (page - 1) * pageSize
  return data.slice(start, start + pageSize)
}

export function calcTotalPages(count: number, pageSize: number): number {
  if (pageSize <= 0) return 1
  return Math.max(1, Math.ceil(count / pageSize))
}

export function searchData<TRow extends object>(
  data: TRow[],
  query: string,
  columns: ColumnDefBase<TRow>[],
): TRow[] {
  if (!query) return data
  const q = query.toLowerCase()
  return data.filter((row) =>
    columns.some((col) => {
      const v = asRecord(row)[col.key]
      const s = col.format ? col.format(v, row) : v != null ? String(v) : ''
      return s.toLowerCase().includes(q)
    }),
  )
}

export function computeAggregate<TRow extends object>(
  col: ColumnDefBase<TRow>,
  rows: TRow[],
): unknown {
  if (!col.aggregate) return undefined
  if (typeof col.aggregate === 'function') return col.aggregate(rows)
  if (col.aggregate === 'count') return rows.length
  const nums = rows.map((r) => Number(asRecord(r)[col.key])).filter((n) => !isNaN(n))
  if (nums.length === 0) return undefined
  switch (col.aggregate) {
    case 'sum':
      return nums.reduce((a, b) => a + b, 0)
    case 'avg':
      return nums.reduce((a, b) => a + b, 0) / nums.length
    case 'min':
      return Math.min(...nums)
    case 'max':
      return Math.max(...nums)
  }
}

export function countActiveFilters(
  filters: Record<string, Set<string>>,
  rangeFilters: Record<string, RangeFilter>,
): number {
  return (
    Object.values(filters).filter((v) => v.size > 0).length +
    Object.values(rangeFilters).filter((v) => v.min !== '' || v.max !== '').length
  )
}
