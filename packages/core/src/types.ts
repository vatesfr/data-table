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
   * `DD/MM`) since `new Date(v)` guesses. Return local time: range filter bounds are local days.
   * Default: `new Date(v).getTime()`, except `YYYY-MM-DD` is local midnight, not UTC.
   */
  parseDate?: (value: string) => number
  /**
   * Comparator over two resolved column values (not rows), for an order that's neither numeric nor
   * alphabetical (e.g. `Bronze < Silver < Gold`). Used by row sort and the filter checklist's
   * orders; takes priority over `type` coercion; doesn't affect `groupValue` bucketing. Callers flip
   * the result for `desc`; `dir` is only for pinning a value to one end in both directions (see
   * `compareMissingLast` and docs/sorting.md).
   */
  compare?: (a: unknown, b: unknown, dir: SortDir) => number
  /**
   * Direction a new sort on this column starts at, e.g. `'desc'` for a "last modified" date.
   * Default: `'asc'`. Doesn't change an active sort entry's `dir`.
   */
  defaultSortDir?: SortDir
  /**
   * Initial order of this column's filter checklist or date tree (`by` doesn't apply to the tree),
   * e.g. `{ by: 'count', dir: 'desc' }` for most common first. Default: `{ by: 'alpha', dir: 'asc' }`.
   */
  defaultValueSort?: ValueSort
  /**
   * Named ranges offered as buttons above a number column's range filter, e.g.
   * `{ label: 'never played', max: 0 }`. Picking one sets the range; the active-bar chip then reads
   * the label instead of the bounds. An omitted bound is open.
   */
  rangePresets?: { label: string; min?: number; max?: number }[]
  width?: number
  /** `'end'` right-aligns (in left-to-right text) the column's header, cells and aggregate cells, e.g. so a number column's digits line up. Default: `'end'` for `type: 'number'`, else `'start'`. */
  align?: 'start' | 'end'
  /**
   * Keeps the column at the table's left edge while it scrolls sideways (columns before it scroll
   * under it), e.g. a name column on a phone. One per table: several would overlap. Pinned body
   * cells are painted with `--dt-pinned-background` (default `--color-background-primary`).
   */
  pinned?: boolean
  /**
   * How to read this column's cell value from a row. Omitted: reads `row[key]`. Function:
   * computes the value from the whole row — covers property aliasing (`(row) => row.name`),
   * nested access, and columns with no single backing property (e.g. `price * qty`).
   */
  value?: (row: TRow) => unknown
  /**
   * Format a value to a plain string (framework-agnostic alternative to render). `row` is absent
   * where a value stands alone: filter chips, checklist values, range bounds.
   */
  format?: (value: unknown, row?: TRow) => string
  /**
   * Excludes this column from header-click sorting and the Sort dropdown's list. Default: true.
   * Enforced by each adapter, not core's sort functions.
   */
  sortable?: boolean
  filterable?: boolean
  groupable?: boolean
  /** Excludes this column from global search (`searchData`). Default: true. */
  searchable?: boolean
  /**
   * Buckets a row's groupBy value into a coarser group key, for continuous or high-cardinality
   * columns (percentages, timestamps); only grouping uses it. Return a value of the column's `type`
   * so groups keep their natural order; label buckets with `groupFormat`. See
   * `bucketNumericRange`/`bucketDatePart` and docs/grouped-columns.md.
   */
  groupValue?: (value: unknown, row: TRow) => unknown
  /**
   * Formats a `groupValue` bucket key for the group header, e.g. `40` → `"40–50%"`. Default: the
   * raw key.
   */
  groupFormat?: (keyPart: string) => string
  /**
   * Keeps this column's cells while it's in `groupBy`, instead of hiding them as redundant with the
   * group header: for a `groupValue`-bucketed column (the header shows only the bucket) or a
   * multi-value one (the row's other values). Default: `false`. See docs/grouped-columns.md.
   */
  keepVisibleWhenGrouped?: boolean
  /** Aggregate function or built-in type shown in group header rows */
  aggregate?: AggregateType | ((rows: TRow[]) => unknown)
  /**
   * Match semantics when this column's cell values are arrays (e.g. tags) and are filtered
   * via the checklist: 'or' matches rows containing any selected value (default), 'and'
   * requires all selected values to be present. Array-valued columns are detected
   * automatically — no flag needed to enable multi-value filtering/grouping/display.
   */
  multiMode?: 'and' | 'or'
  /**
   * Groups this column under a named category: a submenu in the Columns/Sort/Group dropdowns, a
   * collapsible section in the Filter dropdown's left pane. Uncategorized columns stay plain rows.
   */
  category?: string
}

/**
 * A node of a date column's filter tree (`computeDateTree`): `key` its year, month or day segment
 * (or `emptyLabel` for unparseable values), `path` its full id (`"2023-05"`), `values` every raw
 * filter value under it.
 */
export interface DateTreeNode {
  key: string
  path: string
  values: string[]
  children: DateTreeNode[]
}

export interface DataTableLabels {
  columns: string
  /**
   * Heading over the Columns dropdown's "Visible columns" section — the currently-visible,
   * reorderable columns (drag/Alt+↑↓), mirroring `activeSortsSection`/`activeGroupsSection`'s own
   * role for their dropdowns.
   */
  columnsSection: string
  /**
   * Heading over the Columns dropdown's "Available columns" section — hidden columns, click to
   * show; a categorized one (see `ColumnDefBase.category`) collapses into a submenu, mirroring
   * `sortSection`/`groupSection`'s own role for their dropdowns.
   */
  availableColumnsSection: string
  /** Title/aria-label for a Visible-columns row's own "×" (hide) button */
  hideColumn: string
  sort: string
  /** Heading over the already-active sort entries (priority order) in the Sort dropdown */
  activeSortsSection: string
  /**
   * Heading over the Sort dropdown's read-only entries of grouped columns, whose order follows
   * `groupBy`, not drag position
   */
  groupOrderSection: string
  /** Hint text under `groupOrderSection` pointing at where nesting is actually reordered */
  groupOrderHint: string
  sortSection: string
  clearSorts: string
  /** Title/aria-label of a "×" removing one column's sort (active-bar chip, Sort dropdown rows),
   * from the column's label */
  removeSort: (column: string) => string
  filter: string
  filterSearchPlaceholder: string
  selectAll: string
  /** Title/aria-label for the button that cycles a filter checklist's value sort order */
  sortValues: string
  /** Name of a multi-value column's per-value exclude toggle ("rows without this value") */
  excludeValue: (value: string) => string
  /** Tooltip on a non-multi-value column's checklist value while checked (shown) — the
   * checked-by-default, exclude-only model (see docs/filter-dropdown.md's "Filter dropdown") */
  filterValueHideTitle: string
  /** Tooltip on a non-multi-value column's checklist value while hidden (excluded) */
  filterValueShowTitle: string
  min: string
  max: string
  clearFilters: string
  /** Title/aria-label for the Filter dropdown's left-pane per-column clear button (replaces the plain active-filter dot) */
  clearColumnFilter: string
  /** Filter checklist's any/all toggle button text + title while in "any" (union, default) mode */
  filterMatchAny: string
  /** Filter checklist's any/all toggle button text + title while in "all" (intersection) mode */
  filterMatchAll: string
  /** Label for the checklist's "Others" row, which (de)selects every value the value search hides */
  filterOthers: string
  group: string
  /** Heading over the already-active group-by entries (priority order) in the Group dropdown */
  activeGroupsSection: string
  groupSection: string
  clearGroups: string
  /** Title/aria-label of a "×" removing one column's grouping (active-bar chip, Group dropdown
   * rows), from the column's label */
  removeGroup: (column: string) => string
  /** Accessible name of a group chip's body, from the column's label */
  groupedBy: (column: string) => string
  clearAll: string
  /** Title/aria-label for the button that clears the search input */
  clearSearch: string
  /** Digit-grouped count (`10,010`): the filter checklist's counts, and every built-in count label of the locale */
  formatCount: (count: number) => string
  rowCount: (filtered: number, total: number) => string
  groupCount: (count: number) => string
  groupLabel: (index: number) => string
  rowsInGroup: (count: number) => string
  /** Accessible name of a group header's checkbox, from the group's name (e.g. "Engineering") */
  selectGroup: (group: string) => string
  /** Accessible name of a row's checkbox, from its first visible cell's text */
  selectRow: (row: string) => string
  /** Header menu: add the column to the grouping */
  groupByColumn: string
  /** Header menu: remove the column from the grouping */
  ungroupColumn: string
  /** Accessible name of a header's menu button, from the column's label and whether it's filtered */
  columnMenu: (column: string, filtered: boolean) => string
  /** Marker shown on a group header that repeats mid-way down a page — see "Pagination" — because the group's rows split across a page boundary */
  groupContinued: string
  /** Visually hidden header of the column holding each group's expand/collapse button */
  expandCollapse: string
  rowsPerPage: string
  pageOf: (page: number, total: number) => string
  /** Empty table body: no data at all */
  noRows: string
  /** Empty table body: search and filters match nothing */
  noMatchingRows: string
  /** A dropdown's column search matches no column */
  noMatchingColumns: string
  /** Empty-body button resetting search and filters (sorts, groups kept) */
  clearSearchAndFilters: string
  /** Accessible names of the «, ‹, › and » pagination buttons */
  firstPage: string
  previousPage: string
  nextPage: string
  lastPage: string
  search: string
  /** Filter/group label for rows whose array-valued column is empty (e.g. `tags: []`) */
  emptyValue: string
  /** Suffix for the active-filters toolbar chip when a column has more selected values than are shown (e.g. a whole year picked via the date tree) */
  moreValues: (count: number) => string
}
