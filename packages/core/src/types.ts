export type SortDir = 'asc' | 'desc'

export interface SortEntry {
  key: string
  dir: SortDir
}

export interface RangeFilter {
  min: string
  max: string
}

export type AggregateType = 'sum' | 'count' | 'avg' | 'min' | 'max'

export interface ColumnDefBase<TRow extends object = Record<string, unknown>> {
  key: keyof TRow & string
  label: string
  /** Determines filter UI: 'string' → checklist, 'number' → range. Default: 'string' */
  type?: 'string' | 'number' | 'date'
  width?: number
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

export interface DataTableLabels {
  columns: string
  columnsSection: string
  sort: string
  sortSection: string
  clearSorts: string
  filter: string
  numericRanges: string
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
}

export { LABELS_EN as DEFAULT_LABELS } from './locales'
