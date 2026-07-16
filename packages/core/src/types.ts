export type SortDir = 'asc' | 'desc'

export interface SortEntry {
  key: string
  dir: SortDir
}

export interface RangeFilter {
  min: string
  max: string
}

/** Sort applied to a filter checklist's values: `by` picks the basis, `dir` the direction. */
export interface ValueSort {
  by: 'alpha' | 'count'
  dir: SortDir
}

export type AggregateType = 'sum' | 'count' | 'avg' | 'min' | 'max'

export interface ColumnDefBase<TRow extends object = Record<string, unknown>> {
  /**
   * Unique column identifier, used for sort/filter/group/visibility state and as the default
   * property name read from each row. Does not need to name a real property on TRow — see
   * `value` for columns whose cell value isn't a plain `row[key]` lookup.
   */
  key: (keyof TRow & string) | (string & {})
  label: string
  /** Determines filter UI: 'string' → checklist, 'number' → range, 'date' → year/month/day tree. Default: 'string' */
  type?: 'string' | 'number' | 'date'
  /**
   * Parses a `type: 'date'` column's raw string value to a comparable epoch number, used by
   * sorting, the date filter tree (`computeDateTree`), and its range selection
   * (`selectDateRange`) — all three otherwise disagree on ambiguous formats (e.g. `MM/DD` vs
   * `DD/MM`) since `new Date(v)` guesses. Default: `(v) => new Date(v).getTime()`.
   */
  parseDate?: (value: string) => number
  width?: number
  /**
   * How to read this column's cell value from a row. Omitted: reads `row[key]`. Function:
   * computes the value from the whole row — covers property aliasing (`(row) => row.name`),
   * nested access, and columns with no single backing property (e.g. `price * qty`).
   */
  value?: (row: TRow) => unknown
  /** Format a value to a plain string (framework-agnostic alternative to render) */
  format?: (value: unknown, row: TRow) => string
  sortable?: boolean
  filterable?: boolean
  groupable?: boolean
  /** Aggregate function or built-in type shown in group header rows */
  aggregate?: AggregateType | ((rows: TRow[]) => unknown)
  /**
   * Match semantics when this column's cell values are arrays (e.g. tags) and are filtered
   * via the checklist: 'or' matches rows containing any selected value (default), 'and'
   * requires all selected values to be present. Array-valued columns are detected
   * automatically — no flag needed to enable multi-value filtering/grouping/display.
   */
  multiMode?: 'and' | 'or'
}

/**
 * One level of a `type: 'date'` column's filter tree (see `computeDateTree`): `key` is this
 * node's own path segment (a 4-digit year, 0-padded month, or 0-padded day — or `emptyLabel`
 * for values that don't parse as dates), `path` is the full dot-free path from the root
 * (`"2023"`, `"2023-05"`, `"2023-05-14"`) and doubles as a stable id for expand/collapse state,
 * and `values` lists every raw filter value (as stored in `filters`) under this node — a single
 * value for a leaf (day), every descendant leaf's values rolled up otherwise.
 */
export interface DateTreeNode {
  key: string
  path: string
  values: string[]
  children: DateTreeNode[]
}

export interface DataTableLabels {
  columns: string
  columnsSection: string
  sort: string
  sortSection: string
  clearSorts: string
  filter: string
  filterSearchPlaceholder: string
  selectAll: string
  /** Title/aria-label for the button that cycles a filter checklist's value sort order */
  sortValues: string
  min: string
  max: string
  clearFilters: string
  group: string
  groupSection: string
  clearGroups: string
  clearAll: string
  rowCount: (filtered: number, total: number) => string
  groupCount: (count: number) => string
  groupLabel: (index: number) => string
  rowsInGroup: (count: number) => string
  rowsPerPage: string
  pageOf: (page: number, total: number) => string
  search: string
  /** Filter/group label for rows whose array-valued column is empty (e.g. `tags: []`) */
  emptyValue: string
  /** Suffix for the active-filters toolbar chip when a column has more selected values than are shown (e.g. a whole year picked via the date tree) */
  moreValues: (count: number) => string
}

export { LABELS_EN as DEFAULT_LABELS } from './locales'
