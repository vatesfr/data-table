import type { ColumnDefBase, SortEntry, RangeFilter } from './types'

function asRecord(row: object): Record<string, unknown> {
  return row as Record<string, unknown>
}

export function processData<TRow extends object>(
  data: TRow[],
  filters: Record<string, Set<string>>,
  rangeFilters: Record<string, RangeFilter>,
  sorts: SortEntry[],
): TRow[] {
  let result = [...data]

  for (const [key, vals] of Object.entries(filters)) {
    if (vals.size > 0) result = result.filter((row) => vals.has(String(asRecord(row)[key] ?? '')))
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

export function groupData<TRow extends object>(
  data: TRow[],
  groupBy: string[],
): Array<{ key: string | null; rows: TRow[] }> {
  if (groupBy.length === 0) return [{ key: null, rows: data }]
  const groups: Record<string, TRow[]> = {}
  for (const row of data) {
    const gkey = groupBy.map((g) => String(asRecord(row)[g] ?? '')).join(' › ')
    if (!groups[gkey]) groups[gkey] = []
    groups[gkey].push(row)
  }
  return Object.entries(groups).map(([key, rows]) => ({ key, rows }))
}

export function computeStringValues<TRow extends object>(
  data: TRow[],
  columns: ColumnDefBase<TRow>[],
): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  const cols = columns.filter(
    (c) => c.type !== 'number' && c.type !== 'date' && c.filterable !== false,
  )
  for (const col of cols) {
    const values = [...new Set(data.map((r) => String(asRecord(r)[col.key] ?? '')))]
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
      const s = col.format ? col.format(v) : v != null ? String(v) : ''
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
