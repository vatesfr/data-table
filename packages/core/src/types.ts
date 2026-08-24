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
  /**
   * Custom ordering for columns whose natural order is neither numeric nor alphabetical (e.g.
   * an enum/tier column: `Bronze < Silver < Gold`, not alphabetical). A plain
   * `Array.prototype.sort`-style comparator over two already-resolved column values (whatever
   * `value()`/`row[key]` produced for each side) — not full rows; see `sortWithinGroups` for why
   * rows aren't available here. Overrides the default numeric-or-lexicographic comparison
   * everywhere a column's values are ordered: row sort (`processData`, `sortWithinGroups`'
   * group-order pass), the filter checklist's default order (`computeStringValues`), and its
   * explicit alpha-mode sort toggle including count-mode's tie-break (`sortFilterValues`).
   * Doesn't affect `groupValue`/`groupFormat` bucketing, which solves the equivalent problem for
   * grouping instead. Takes priority over `type: 'number'`/`'date'` coercion when both are set.
   *
   * The 3rd `dir` argument is the active ascending/descending direction at that sort site (a
   * fixed `'asc'` at the two checklist-ordering sites, which have no direction of their own —
   * `computeStringValues`'s default order, and `sortFilterValues`'s count-mode tie-break).
   * Ignore it for an ordinary comparator — every call site already flips the *return value*'s
   * sign for a descending sort, the same way the default comparison does, so a direction-naive
   * `(a, b) => …` behaves correctly with no extra work. It exists only for the rarer case of a
   * value that must stay pinned to one end regardless of which direction is active (e.g. a
   * missing value sorting last whether ascending or descending) — impossible to express as a
   * plain `(a, b) => number` return, since that return gets sign-flipped for `desc` right along
   * with everything else, flipping "always after" to "always before" the moment the direction is
   * toggled. See `compareMissingLast` for a ready-made comparator built on this.
   */
  compare?: (a: unknown, b: unknown, dir: SortDir) => number
  /**
   * The direction a fresh sort on this column should start at — e.g. `'desc'` for a "last
   * modified" date column or a score/count column, where descending is the more useful first
   * click. Default: `'asc'`. Threaded through `toggleSort`/`replaceSort`/`appendOrToggleSort`'s
   * `defaultDir` param by each adapter; only changes where a *new* sort entry for this column
   * starts (and, symmetrically, which direction its cycle removes from) — an already-active sort
   * entry's own `dir` is unaffected, and this has no bearing on `compare`'s direction-naive
   * comparator contract above.
   */
  defaultSortDir?: SortDir
  /**
   * The `ValueSort` a column's filter checklist (or date filter tree, which shares the same state
   * — `by` just doesn't apply there) starts at before the user ever touches its sort-order toggle.
   * Default: `{ by: 'alpha', dir: 'asc' }`. Useful for e.g. a high-cardinality tag/category column
   * that reads better as "most common first" (`{ by: 'count', dir: 'desc' }`), or a date column
   * whose tree should open most-recent-year-first (`{ by: 'alpha', dir: 'desc' }` — `by` ignored).
   * Only changes the starting point; `cycleValueSort` still advances through all 4 states the same
   * way regardless of where it started.
   */
  defaultValueSort?: ValueSort
  width?: number
  /**
   * How to read this column's cell value from a row. Omitted: reads `row[key]`. Function:
   * computes the value from the whole row — covers property aliasing (`(row) => row.name`),
   * nested access, and columns with no single backing property (e.g. `price * qty`).
   */
  value?: (row: TRow) => unknown
  /** Format a value to a plain string (framework-agnostic alternative to render) */
  format?: (value: unknown, row: TRow) => string
  /**
   * Excludes this column from both header-click sorting and the Sort dropdown's "add a sort"
   * list. Default: true. Enforced by each adapter, not core — `toggleSort`/`replaceSort`/
   * `appendOrToggleSort` themselves have no `columns` argument to check this against.
   */
  sortable?: boolean
  filterable?: boolean
  groupable?: boolean
  /** Excludes this column from global search (`searchData`). Default: true. */
  searchable?: boolean
  /**
   * Buckets a row's groupBy value into a coarser group key, for continuous/high-cardinality
   * columns (percentages, timestamps) where grouping by the exact value would create one group
   * per row. Only affects grouping — sort/filter/aggregate/cell rendering still read the column's
   * real value via `value`/`getColumnValue`, unaffected by this. Return a value whose type
   * matches `col.type` (a number for a `type: 'number'` column, a `parseDate`-parseable string
   * for `type: 'date'`) so group ordering — driven by the same type-aware comparison a normal
   * groupBy column already gets (see `sortWithinGroups`) — stays correct without a separate sort
   * key; see `bucketNumericRange`/`bucketDatePart` for ready-made bucketing functions. The label
   * shown in the group header for a bucket is controlled separately by `groupFormat`, since the
   * raw bucketed value (e.g. a range's lower bound) usually isn't fit to display on its own.
   */
  groupValue?: (value: unknown, row: TRow) => unknown
  /**
   * Formats a bucketed group's key (see `groupValue`) for display in the group header — e.g.
   * turning a percentage bucket's lower bound `40` into `"40–50%"`. Only used when `groupValue`
   * is set; a plain (non-bucketed) groupBy column keeps rendering via the sample row's own
   * `format`/cell value, unaffected. Falls back to the raw bucket key string when omitted.
   */
  groupFormat?: (keyPart: string) => string
  /**
   * Keeps this column in the row cells even while it's in `groupBy`, instead of the default
   * auto-hide (the group header already shows this column's value, so repeating it in every row
   * is normally redundant). Set this when the header *doesn't* show the same thing the row would:
   * a `groupValue`-bucketed column (the header only shows the bucket label, e.g. "3–10h" — the
   * row's exact value, e.g. "4.3h", is otherwise lost entirely, visible nowhere), or a
   * multi-value/array column (grouping fans a row out into one group per value — e.g. a "Tags"
   * column with `["Roguelike", "Deckbuilder"]` shows up in both the "Roguelike" and "Deckbuilder"
   * groups; hiding the column removes the only way to see a row's *other* values while looking at
   * one particular group). Default: `false` (unchanged prior behavior). Not auto-detected from
   * `groupValue`/array-valued cells, since `value` is an arbitrary function whose return shape
   * isn't knowable from the column def alone — an explicit opt-in per column instead.
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
  /** Heading over the already-active sort entries (priority order) in the Sort dropdown */
  activeSortsSection: string
  /**
   * Heading over the Sort dropdown's separate, non-draggable sub-list of entries matching a
   * currently grouped column — nesting order there always follows `groupBy`'s own order (see
   * `sortWithinGroups`), not drag position, so these render read-only here rather than mixed
   * into the freely-reorderable `activeSortsSection` list below them.
   */
  groupOrderSection: string
  /** Hint text under `groupOrderSection` pointing at where nesting is actually reordered */
  groupOrderHint: string
  sortSection: string
  clearSorts: string
  filter: string
  filterSearchPlaceholder: string
  selectAll: string
  /** Title/aria-label for the button that cycles a filter checklist's value sort order */
  sortValues: string
  /** Tooltip on a filter checklist value in its neutral/included state, explaining the tri-state (include/exclude) cycle */
  filterValueTitle: string
  /** Tooltip on a filter checklist value that's currently excluded ("not this value") */
  filterExcludedTitle: string
  min: string
  max: string
  clearFilters: string
  /** Filter checklist's any/all toggle button text + title while in "any" (union, default) mode */
  filterMatchAny: string
  /** Filter checklist's any/all toggle button text + title while in "all" (intersection) mode */
  filterMatchAll: string
  group: string
  /** Heading over the already-active group-by entries (priority order) in the Group dropdown */
  activeGroupsSection: string
  groupSection: string
  clearGroups: string
  clearAll: string
  /** Title/aria-label for the button that clears the search input */
  clearSearch: string
  rowCount: (filtered: number, total: number) => string
  groupCount: (count: number) => string
  groupLabel: (index: number) => string
  rowsInGroup: (count: number) => string
  /** Marker shown on a group header that repeats mid-way down a page — see "Pagination" — because the group's rows split across a page boundary */
  groupContinued: string
  rowsPerPage: string
  pageOf: (page: number, total: number) => string
  search: string
  /** Filter/group label for rows whose array-valued column is empty (e.g. `tags: []`) */
  emptyValue: string
  /** Suffix for the active-filters toolbar chip when a column has more selected values than are shown (e.g. a whole year picked via the date tree) */
  moreValues: (count: number) => string
}

export { LABELS_EN as DEFAULT_LABELS } from './locales'
