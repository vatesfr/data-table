import type { ColumnDefBase, SortEntry, RangeFilter, DateTreeNode } from './types'

function asRecord(row: object): Record<string, unknown> {
  return row as Record<string, unknown>
}

/** Reads a column's cell value from a row per its `value` accessor (or `row[key]` if unset). */
export function getColumnValue<TRow extends object>(col: ColumnDefBase<TRow>, row: TRow): unknown {
  return col.value ? col.value(row) : asRecord(row)[col.key]
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
    const col = colByKey.get(key)
    const mode = col?.multiMode ?? 'or'
    result = result.filter((row) => {
      const rowValues = multiValues(col ? getColumnValue(col, row) : asRecord(row)[key], emptyLabel)
      return mode === 'and'
        ? [...vals].every((v) => rowValues.includes(v))
        : [...vals].some((v) => rowValues.includes(v))
    })
  }

  for (const [key, range] of Object.entries(rangeFilters)) {
    const col = colByKey.get(key)
    const rangeValue = (r: TRow) => (col ? getColumnValue(col, r) : asRecord(r)[key])
    if (range.min !== '') result = result.filter((r) => Number(rangeValue(r)) >= Number(range.min))
    if (range.max !== '') result = result.filter((r) => Number(rangeValue(r)) <= Number(range.max))
  }

  if (sorts.length > 0) {
    result.sort((a, b) => {
      for (const { key, dir } of sorts) {
        const col = colByKey.get(key)
        const va = col ? getColumnValue(col, a) : asRecord(a)[key]
        const vb = col ? getColumnValue(col, b) : asRecord(b)[key]
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
  columns: ColumnDefBase<TRow>[] = [],
  emptyLabel = '(none)',
): GroupResult<TRow>[] {
  if (groupBy.length === 0) return [{ key: null, keyParts: [], rows: data }]
  const colByKey = new Map<string, ColumnDefBase<TRow>>(columns.map((c) => [c.key, c]))
  const groups: Record<string, { keyParts: string[]; rows: TRow[] }> = {}
  for (const row of data) {
    let combos: string[][] = [[]]
    for (const g of groupBy) {
      const col = colByKey.get(g)
      const values = multiValues(col ? getColumnValue(col, row) : asRecord(row)[g], emptyLabel)
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
  const cols = columns.filter((c) => c.type !== 'number' && c.filterable !== false)
  for (const col of cols) {
    const values = [
      ...new Set(data.flatMap((r) => multiValues(getColumnValue(col, r), emptyLabel))),
    ]
    map[col.key] = values.sort()
  }
  return map
}

/**
 * Same value set as `computeStringValues`, paired with how many rows would match each value —
 * computed as a facet: for a given column, rows are narrowed by every *other* active filter
 * (but not that column's own filter), so ticking a box in one checklist updates the counts
 * shown in another, while a column's own counts stay stable as its own boxes are ticked.
 */
export function computeStringValueCounts<TRow extends object>(
  data: TRow[],
  filters: Record<string, Set<string>>,
  rangeFilters: Record<string, RangeFilter>,
  columns: ColumnDefBase<TRow>[],
  emptyLabel = '(none)',
): Record<string, Map<string, number>> {
  const map: Record<string, Map<string, number>> = {}
  const cols = columns.filter((c) => c.type !== 'number' && c.filterable !== false)
  for (const col of cols) {
    const otherFilters = { ...filters }
    delete otherFilters[col.key]
    const rows = processData(data, otherFilters, rangeFilters, [], columns, emptyLabel)
    const counts = new Map<string, number>()
    for (const row of rows) {
      for (const v of multiValues(getColumnValue(col, row), emptyLabel)) {
        counts.set(v, (counts.get(v) ?? 0) + 1)
      }
    }
    map[col.key] = counts
  }
  return map
}

/** Narrows a checklist's values by a case-insensitive substring search term. */
export function filterValuesBySearch(values: string[], term: string): string[] {
  if (!term) return values
  const q = term.toLowerCase()
  return values.filter((v) => v.toLowerCase().includes(q))
}

/**
 * Drops checklist values with a facet count of 0, i.e. no row currently matches them given the
 * other active filters (see `computeStringValueCounts`) — except a value the user has already
 * selected, which stays listed regardless of its live count so it can still be unchecked.
 */
export function filterValuesByCount(
  values: string[],
  counts: Map<string, number>,
  selected: Set<string>,
): string[] {
  return values.filter((v) => selected.has(v) || (counts.get(v) ?? 0) > 0)
}

/**
 * Groups a `type: 'date'` column's checklist values (from `computeStringValues`) into a
 * Year › Month › Day tree, mirroring spreadsheet-style date autofilters — a high-cardinality
 * date column becomes navigable by year/month instead of one flat per-day checklist. Each
 * value is parsed with `new Date(v)`; values that don't parse are collected under a single
 * `emptyLabel` leaf alongside the year nodes rather than silently dropped.
 */
export function computeDateTree(values: string[], emptyLabel = '(none)'): DateTreeNode[] {
  const years = new Map<string, Map<string, Map<string, string[]>>>()
  const invalid: string[] = []
  for (const v of values) {
    const d = new Date(v)
    if (isNaN(d.getTime())) {
      invalid.push(v)
      continue
    }
    const y = String(d.getFullYear())
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    if (!years.has(y)) years.set(y, new Map())
    const months = years.get(y)!
    if (!months.has(m)) months.set(m, new Map())
    const days = months.get(m)!
    if (!days.has(day)) days.set(day, [])
    days.get(day)!.push(v)
  }

  const nodes: DateTreeNode[] = [...years.keys()].sort().map((y) => {
    const months = years.get(y)!
    const monthNodes: DateTreeNode[] = [...months.keys()].sort().map((m) => {
      const days = months.get(m)!
      const dayNodes: DateTreeNode[] = [...days.keys()].sort().map((day) => ({
        key: day,
        path: `${y}-${m}-${day}`,
        values: days.get(day)!,
        children: [],
      }))
      return {
        key: m,
        path: `${y}-${m}`,
        values: dayNodes.flatMap((n) => n.values),
        children: dayNodes,
      }
    })
    return {
      key: y,
      path: y,
      values: monthNodes.flatMap((n) => n.values),
      children: monthNodes,
    }
  })

  if (invalid.length > 0)
    nodes.push({ key: emptyLabel, path: emptyLabel, values: invalid, children: [] })
  return nodes
}

/** Checked/unchecked/indeterminate state of a date-tree node given the column's currently selected filter values. */
export function getDateTreeNodeState(
  node: DateTreeNode,
  selected: Set<string>,
): 'checked' | 'unchecked' | 'indeterminate' {
  const selectedCount = node.values.filter((v) => selected.has(v)).length
  if (selectedCount === 0) return 'unchecked'
  return selectedCount === node.values.length ? 'checked' : 'indeterminate'
}

/** Sum of `computeStringValueCounts`-style facet counts across every raw value under a date-tree node. */
export function sumDateTreeNodeCount(node: DateTreeNode, counts: Map<string, number>): number {
  return node.values.reduce((sum, v) => sum + (counts.get(v) ?? 0), 0)
}

/**
 * Depth-first lookup of a node by its `path`. Vanilla's delegated click handler has no closure
 * over the node objects rendered into the HTML string — only the `data-path` it wrote out —
 * so it re-derives the node (and its `values`) from the freshly recomputed tree via this.
 */
export function findDateTreeNode(nodes: DateTreeNode[], path: string): DateTreeNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node
    const found = findDateTreeNode(node.children, path)
    if (found) return found
  }
  return undefined
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

/**
 * Selects all `values` for `key` if any of them are currently unselected, deselects all of
 * them if they're all already selected — same select-all-if-any-unselected convention as
 * row selection's `toggleSelectAll`. `values` is typically a search-narrowed subset of the
 * column's full checklist, so this only ever affects what's currently visible.
 */
export function toggleFilterAll(
  filters: Record<string, Set<string>>,
  key: string,
  values: string[],
): Record<string, Set<string>> {
  const current = filters[key] ?? new Set<string>()
  const allSelected = values.length > 0 && values.every((v) => current.has(v))
  const next = new Set(current)
  if (allSelected) values.forEach((v) => next.delete(v))
  else values.forEach((v) => next.add(v))
  return { ...filters, [key]: next }
}

export function toggleGroupBy(groupBy: string[], key: string): string[] {
  return groupBy.includes(key) ? groupBy.filter((k) => k !== key) : [...groupBy, key]
}

/**
 * Sorts `columns` per `order` (an array of keys); any column missing from `order` — because it
 * was added after the order was set, or `order` is empty (natural order) — is appended at the
 * end in its original relative position.
 */
export function getOrderedColumns<TRow extends object>(
  columns: ColumnDefBase<TRow>[],
  order: string[],
): ColumnDefBase<TRow>[] {
  if (order.length === 0) return columns
  const byKey = new Map(columns.map((c) => [c.key, c]))
  const ordered = order
    .map((k) => byKey.get(k))
    .filter((c): c is ColumnDefBase<TRow> => c !== undefined)
  const orderedKeys = new Set(ordered.map((c) => c.key))
  return [...ordered, ...columns.filter((c) => !orderedKeys.has(c.key))]
}

/** Reorders `order` by moving `dragKey` to just before `targetKey` (drag-and-drop). */
export function reorderColumn(order: string[], dragKey: string, targetKey: string): string[] {
  if (dragKey === targetKey) return order
  const next = order.filter((k) => k !== dragKey)
  const targetIdx = next.indexOf(targetKey)
  if (targetIdx === -1) return order
  next.splice(targetIdx, 0, dragKey)
  return next
}

/** Swaps `key` with its neighbor `delta` positions away (e.g. -1/+1 for up/down buttons). */
export function moveColumnBy(order: string[], key: string, delta: number): string[] {
  const idx = order.indexOf(key)
  const newIdx = idx + delta
  if (idx === -1 || newIdx < 0 || newIdx >= order.length) return order
  const next = [...order]
  ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
  return next
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
      const v = getColumnValue(col, row)
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
  const nums = rows.map((r) => Number(getColumnValue(col, r))).filter((n) => !isNaN(n))
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
