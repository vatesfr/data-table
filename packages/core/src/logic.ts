import type {
  ColumnDefBase,
  SortEntry,
  RangeFilter,
  DateTreeNode,
  ValueSort,
  SortDir,
} from './types'

function asRecord(row: object): Record<string, unknown> {
  return row as Record<string, unknown>
}

/** Default `type: 'date'` value parser, shared by sort, `computeDateTree`, and `selectDateRange`. */
function defaultParseDate(v: string): number {
  return new Date(v).getTime()
}

/** Reads a column's cell value from a row per its `value` accessor (or `row[key]` if unset). */
export function getColumnValue<TRow extends object>(col: ColumnDefBase<TRow>, row: TRow): unknown {
  return col.value ? col.value(row) : asRecord(row)[col.key]
}

/** Indexes columns by key for O(1) lookup — shared by every function that resolves a raw filter/
 * sort/group key back to its column definition. */
function buildColByKey<TRow extends object>(
  columns: ColumnDefBase<TRow>[],
): Map<string, ColumnDefBase<TRow>> {
  return new Map(columns.map((c) => [c.key, c]))
}

/**
 * Resolves a row's value for a given key — via the column's own accessor (`getColumnValue`,
 * which honors `col.value`) when a matching column exists, or a plain `row[key]` lookup when it
 * doesn't (a filter/rangeFilter/groupBy key with no corresponding column definition still needs
 * to resolve to *something*). Shared by every place `processData`/`groupData` look up a raw
 * value from a possibly-absent column.
 */
function resolveValue<TRow extends object>(
  col: ColumnDefBase<TRow> | undefined,
  row: TRow,
  key: string,
): unknown {
  return col ? getColumnValue(col, row) : asRecord(row)[key]
}

/** `resolveValue` followed by `multiValues` — the same pairing shows up everywhere a filter/group
 * key needs to be read as a flat, deduped array of strings rather than a raw value. */
function resolveMultiValues<TRow extends object>(
  col: ColumnDefBase<TRow> | undefined,
  row: TRow,
  key: string,
  emptyLabel: string,
): string[] {
  return multiValues(resolveValue(col, row, key), emptyLabel)
}

/**
 * Coerces an already-obtained raw value per `col.type`, so every type-aware comparison
 * (currently just sort) agrees on what a column's value *means* instead of each call site
 * guessing independently from the raw value's runtime `typeof` — the root cause behind both
 * the date/string sort mismatch (issue #10) and the same-shaped bug for numeric-string values
 * in a `type: 'number'` column. `'date'` parses via `col.parseDate` (default `new Date`),
 * `'number'` coerces via `Number`; anything else (including untyped/computed columns) passes
 * the value through unchanged, preserving numeric sort for plain numbers with no `type` set.
 * Shared by `getComparableValue` (a row's own cell value) and `comparableFromKeyPart` (a group's
 * already-stringified `keyPart`) — same coercion, different source for the raw value.
 */
function coerceByType<TRow extends object>(
  col: ColumnDefBase<TRow> | undefined,
  raw: unknown,
): unknown {
  if (col?.type === 'date') return (col.parseDate ?? defaultParseDate)(raw as string)
  if (col?.type === 'number') return Number(raw)
  return raw
}

/** Reads a column's cell value and coerces it per `col.type` — see `coerceByType`. */
function getComparableValue<TRow extends object>(col: ColumnDefBase<TRow>, row: TRow): unknown {
  return coerceByType(col, getColumnValue(col, row))
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

/**
 * Default value comparator: numeric when both sides are numbers, else lexicographic. Ignores
 * `dir` (unused by every caller below) — it exists only so this is directly assignable wherever
 * a `ColumnDefBase.compare` (which does take `dir`) is expected, e.g. as the fallback in
 * `sortRows`'s `compareFns`.
 */
function defaultCompare(a: unknown, b: unknown, _dir?: SortDir): number {
  if (typeof a === 'number' && typeof b === 'number' && !isNaN(a) && !isNaN(b)) return a - b
  return String(a ?? '').localeCompare(String(b ?? ''))
}

/** Flips a direction-naive comparator's result for a descending sort — the same "compute cmp,
 * then negate it for desc" idiom repeated at every sort-ordering call site in this module. */
function applyDir(cmp: number, dir: SortDir): number {
  return dir === 'asc' ? cmp : -cmp
}

/**
 * Ready-made `ColumnDefBase.compare` for pinning a value — missing data, by default — to the end
 * of the sort regardless of the active ascending/descending direction (see `compare`'s `dir`
 * param doc for why this needs `dir` at all rather than being expressible as a plain comparator).
 * `compare` orders any two non-pinned values (default: this module's own numeric-or-lexicographic
 * fallback); `isMissing` decides which values get pinned (default: `v == null || v === ''`,
 * covering both a real null/undefined raw value and the empty string a missing scalar
 * stringifies to wherever grouping/the filter checklist need a string instead — see
 * `multiValues`). Two pinned values compare as equal, falling through to the next sort key the
 * same way a tied `compare` result would.
 */
export function compareMissingLast<T = unknown>(
  compare: (a: T, b: T) => number = defaultCompare as (a: T, b: T) => number,
  isMissing: (v: T) => boolean = (v) => v == null || v === '',
): (a: T, b: T, dir: SortDir) => number {
  return (a, b, dir) => {
    const ma = isMissing(a)
    const mb = isMissing(b)
    if (ma && mb) return 0
    if (ma || mb) {
      const rel = ma ? 1 : -1 // a missing → wants a after b
      return applyDir(rel, dir) // pre-cancels the sort's own direction flip
    }
    return compare(a, b)
  }
}

/**
 * Sorts `rows` by `sorts`, shared by `processData`'s global sort and `sortWithinGroups`'
 * per-bucket re-sort. Decorate-sort-undecorate: `getComparableValue` (esp. a `type: 'date'`
 * column's `parseDate`) is pure per-row, but a comparator recomputes it for both sides on every
 * comparison — O(n log n) calls instead of O(n). Precomputing once per row per sort key avoids
 * re-parsing the same row's date string dozens of times during a large sort.
 *
 * A column with a `compare` (see `ColumnDefBase.compare`) skips `getComparableValue`'s
 * type coercion entirely — `compare` takes the raw column value on each side and is solely
 * responsible for ordering it — and its own comparator (passed this sort key's `dir`) is used
 * in place of the default numeric-or-lexicographic one.
 */
function sortRows<TRow extends object>(
  rows: TRow[],
  sorts: SortEntry[],
  colByKey: Map<string, ColumnDefBase<TRow>>,
): TRow[] {
  if (sorts.length === 0) return rows
  const compareFns = sorts.map(({ key }) => colByKey.get(key)?.compare ?? defaultCompare)
  const decorated = rows.map((row) => ({
    row,
    values: sorts.map(({ key }) => {
      const col = colByKey.get(key)
      if (!col) return asRecord(row)[key]
      return col.compare ? getColumnValue(col, row) : getComparableValue(col, row)
    }),
  }))
  decorated.sort((a, b) => {
    for (let i = 0; i < sorts.length; i++) {
      const cmp = compareFns[i](a.values[i], b.values[i], sorts[i].dir)
      if (cmp !== 0) return applyDir(cmp, sorts[i].dir)
    }
    return 0
  })
  return decorated.map((d) => d.row)
}

export function processData<TRow extends object>(
  data: TRow[],
  filters: Record<string, Set<string>>,
  rangeFilters: Record<string, RangeFilter>,
  sorts: SortEntry[],
  columns: ColumnDefBase<TRow>[],
  emptyLabel = '(none)',
  excludeFilters: Record<string, Set<string>> = {},
): TRow[] {
  let result = [...data]
  const colByKey = buildColByKey(columns)

  for (const [key, vals] of Object.entries(filters)) {
    if (vals.size === 0) continue
    const col = colByKey.get(key)
    const mode = col?.multiMode ?? 'or'
    result = result.filter((row) => {
      const rowValues = resolveMultiValues(col, row, key, emptyLabel)
      return mode === 'and'
        ? [...vals].every((v) => rowValues.includes(v))
        : [...vals].some((v) => rowValues.includes(v))
    })
  }

  // Exclude filters are a separate set from `filters` (see `cycleFilterValue`) — a row is
  // dropped as soon as it carries *any* excluded value, independent of `col.multiMode` (which
  // only ever governs the include side): "not tagged Action" should exclude a row the moment
  // Action shows up among its tags, regardless of how the column's include matches are combined.
  for (const [key, vals] of Object.entries(excludeFilters)) {
    if (vals.size === 0) continue
    const col = colByKey.get(key)
    result = result.filter((row) => {
      const rowValues = resolveMultiValues(col, row, key, emptyLabel)
      return ![...vals].some((v) => rowValues.includes(v))
    })
  }

  for (const [key, range] of Object.entries(rangeFilters)) {
    const col = colByKey.get(key)
    const rangeValue = (r: TRow) => resolveValue(col, r, key)
    if (col?.type === 'date') {
      // Bounds come from the range filter's native <input type="date">s, always ISO
      // `YYYY-MM-DD` — parsed with the default parser, not `col.parseDate`, since a column's
      // custom parser is for its own raw value format, not this input's fixed ISO one.
      const parseDate = col.parseDate ?? defaultParseDate
      if (range.min !== '') {
        const min = defaultParseDate(range.min)
        result = result.filter((r) => parseDate(String(rangeValue(r))) >= min)
      }
      if (range.max !== '') {
        const max = defaultParseDate(range.max)
        result = result.filter((r) => parseDate(String(rangeValue(r))) <= max)
      }
    } else {
      if (range.min !== '')
        result = result.filter((r) => Number(rangeValue(r)) >= Number(range.min))
      if (range.max !== '')
        result = result.filter((r) => Number(rangeValue(r)) <= Number(range.max))
    }
  }

  return sortRows(result, sorts, colByKey)
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
  columns: ColumnDefBase<TRow>[],
  emptyLabel = '(none)',
): GroupResult<TRow>[] {
  if (groupBy.length === 0) return [{ key: null, keyParts: [], rows: data }]
  const colByKey = buildColByKey(columns)
  const groups: Record<string, { keyParts: string[]; rows: TRow[] }> = {}
  for (const row of data) {
    let combos: string[][] = [[]]
    for (const g of groupBy) {
      const col = colByKey.get(g)
      const raw = resolveValue(col, row, g)
      const bucketed = col?.groupValue ? col.groupValue(raw, row) : raw
      const values = multiValues(bucketed, emptyLabel)
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

/** Same type-aware coercion as `getComparableValue`, applied to a group's own string `keyPart` instead of a row — see `coerceByType`. */
function comparableFromKeyPart<TRow extends object>(
  col: ColumnDefBase<TRow> | undefined,
  keyPart: string,
): unknown {
  return coerceByType(col, keyPart)
}

/**
 * Reorders `groups` and re-sorts each group's own rows, splitting `sorts` into the entries that
 * match a groupBy column (which govern the order of the *groups themselves*) and the rest (which
 * govern row order *within* each group).
 *
 * `groupData` fans a row into one bucket per individual value for a multi-value groupBy column
 * (e.g. a row tagged `['Action', 'RPG']` lands in both the 'Action' and 'RPG' buckets), but
 * `processData`'s sort runs *before* that fan-out, over the flat row list — so a multi-value
 * column used as a sort key has no single per-row comparable value that matches any one bucket,
 * and falls back to comparing the row's whole array (`String(array)`). That comparison is
 * unrelated to either bucket a row lands in, and it determines *two* things downstream that both
 * end up wrong: which order `groupData` first encounters each value in (and therefore which order
 * the groups themselves come out in), and — since it rarely ties between two different rows — it
 * also starves any secondary sort key from ever being reached for row order within a bucket.
 *
 * This fixes both from the one well-defined comparison a group actually has available: a group's
 * own `keyParts[i]` is already the single value that group represents for `groupBy[i]` (not the
 * whole array), so comparing *that* — type-aware, like a normal column sort — gives the groups
 * array a well-defined order for free. A groupBy column's own sort entry is then dropped before
 * re-sorting rows within a bucket, since every row in one of its buckets already shares that
 * value (comparing it again would be a no-op at best, or reintroduce the same whole-array
 * comparison at worst); the next sort key becomes the effective within-group row order instead —
 * exactly as it already does for a single-value groupBy column, where the flat pre-sort happens
 * to already put same-value rows adjacent to each other.
 *
 * Sorting a multi-value column that is *not* a groupBy column keeps `processData`'s incidental
 * whole-array comparison, unchanged — there is no per-bucket context to resolve it against.
 */
export function sortWithinGroups<TRow extends object>(
  groups: GroupResult<TRow>[],
  sorts: SortEntry[],
  groupBy: string[],
  columns: ColumnDefBase<TRow>[],
): GroupResult<TRow>[] {
  const colByKey = buildColByKey(columns)
  const groupSorts = sorts.filter((s) => groupBy.includes(s.key))
  const withinGroupSorts = sorts.filter((s) => !groupBy.includes(s.key))

  let result = groups
  if (withinGroupSorts.length > 0) {
    result = result.map((group) => ({
      ...group,
      rows: sortRows(group.rows, withinGroupSorts, colByKey),
    }))
  }
  if (groupSorts.length > 0) {
    result = [...result].sort((a, b) => {
      for (const { key, dir } of groupSorts) {
        const idx = groupBy.indexOf(key)
        const col = colByKey.get(key)
        const ka = a.keyParts[idx]
        const kb = b.keyParts[idx]
        const va = col?.compare ? ka : comparableFromKeyPart(col, ka)
        const vb = col?.compare ? kb : comparableFromKeyPart(col, kb)
        const cmp = col?.compare ? col.compare(va, vb, dir) : defaultCompare(va, vb)
        if (cmp !== 0) return applyDir(cmp, dir)
      }
      return 0
    })
  }
  return result
}

/**
 * Ready-made `groupValue` bucketing function for a `type: 'number'` column: rounds a value down
 * to the start of its `step`-wide range (e.g. `bucketNumericRange(10)(47) === 40`), so a
 * continuous column (percentages, prices) groups into a handful of ranges instead of one group
 * per distinct value. The returned number keeps `sortWithinGroups`' existing numeric comparison
 * correct with no separate sort key needed; pair with `formatNumericRange` to render the range
 * itself (e.g. `"40–50"`) instead of just its lower bound in the group header.
 */
export function bucketNumericRange(step: number): (value: unknown) => number {
  return (value: unknown) => {
    const n = Number(value)
    return isNaN(n) ? NaN : Math.floor(n / step) * step
  }
}

/** Formats a `bucketNumericRange(step)` key as `"<lower>–<upper><unit>"`, e.g. `"40–50%"`. */
export function formatNumericRange(step: number, unit = ''): (keyPart: string) => string {
  return (keyPart: string) => {
    const n = Number(keyPart)
    return isNaN(n) ? keyPart : `${n}–${n + step}${unit}`
  }
}

/** Coarser granularity `bucketDatePart`/`formatDatePart` group a `type: 'date'` column by. */
export type DatePart = 'year' | 'month' | 'day'

/**
 * Ready-made `groupValue` bucketing function for a `type: 'date'` column: truncates a value to
 * the start of its enclosing year/month/day, returned as an ISO date string (`"2024-05-01"`) that
 * the same `parseDate` (default or override, matching the column's own) parses back correctly —
 * so `sortWithinGroups`' existing chronological comparison stays correct with no separate sort
 * key needed. Pair with `formatDatePart` to render a human label (e.g. `"May 2024"`) instead of
 * the raw ISO bucket key in the group header.
 */
export function bucketDatePart(
  part: DatePart,
  parseDate: (value: string) => number = defaultParseDate,
): (value: unknown) => string {
  return (value: unknown) => {
    const t = parseDate(String(value))
    if (isNaN(t)) return String(value)
    const d = new Date(t)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = part === 'day' ? String(d.getDate()).padStart(2, '0') : '01'
    return `${y}-${part === 'year' ? '01' : m}-${day}`
  }
}

/** Formats a `bucketDatePart(part)` ISO key for display, e.g. `"2024-05-01"` -> `"May 2024"` for `'month'`. */
export function formatDatePart(part: DatePart): (keyPart: string) => string {
  return (keyPart: string) => {
    const d = new Date(keyPart)
    if (isNaN(d.getTime())) return keyPart
    if (part === 'year') return String(d.getFullYear())
    if (part === 'month') return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  }
}

/**
 * A single keyboard-navigable target in the table body: a group header row, or a data row.
 * `groupKey` on a row item is the key of its enclosing group (`null` when ungrouped), set by
 * `getVisibleRows` — `paginateVisibleGroups`/`paginateVisibleItems` use it to tell whether a
 * page's leading rows belong to a group whose header rendered on an earlier page.
 */
export type VisibleItem<TRow> =
  { kind: 'group'; key: string } | { kind: 'row'; row: TRow; groupKey?: string | null }

/**
 * Flattens `groupData`'s result into the items actually rendered, in display order — a group
 * header for every group (even a collapsed one, so it stays reachable to re-expand), followed by
 * its rows unless it's collapsed, the same condition each adapter's own render already applies.
 * This is the order used for keyboard arrow-key navigation: a collapsed group's rows are not
 * valid Up/Down targets, but its header always is, and expanding/collapsing a group changes what
 * else is reachable. Called with the *full* filtered/grouped data (not a page's slice) so that
 * pagination — see `paginateVisibleGroups`/`paginateVisibleItems` — can budget page size across
 * header and data rows together, instead of paginating data rows first and grouping afterward.
 */
export function getVisibleRows<TRow extends object>(
  groups: GroupResult<TRow>[],
  collapsedGroups: Set<string>,
  defaultCollapsed = false,
): VisibleItem<TRow>[] {
  return groups.flatMap(({ key, rows }): VisibleItem<TRow>[] => {
    if (key === null) return rows.map((row) => ({ kind: 'row', row, groupKey: null }))
    const rowItems: VisibleItem<TRow>[] = isGroupCollapsed(collapsedGroups, key, defaultCollapsed)
      ? []
      : rows.map((row) => ({ kind: 'row', row, groupKey: key }))
    return [{ kind: 'group', key }, ...rowItems]
  })
}

/** Whether `a` and `b` are the same navigable target — rows compare by object identity, groups by key. */
export function isSameVisibleItem<TRow extends object>(
  a: VisibleItem<TRow>,
  b: VisibleItem<TRow>,
): boolean {
  if (a.kind === 'group' && b.kind === 'group') return a.key === b.key
  if (a.kind === 'row' && b.kind === 'row') return a.row === b.row
  return false
}

/** Index of `target` within `items` (see `isSameVisibleItem`), or -1 if `target` is null/absent. */
export function indexOfVisibleItem<TRow extends object>(
  items: VisibleItem<TRow>[],
  target: VisibleItem<TRow> | null,
): number {
  if (target === null) return -1
  return items.findIndex((item) => isSameVisibleItem(item, target))
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
    // No direction of its own here — a fixed 'asc' lets a compare like compareMissingLast()
    // still pin its matching values last (compareMissingLast's non-pinned branch is direction-
    // naive anyway, so 'asc' vs 'desc' would make no difference there).
    map[col.key] = col.compare ? values.sort((a, b) => col.compare!(a, b, 'asc')) : values.sort()
  }
  return map
}

/**
 * Same value set as `computeStringValues`, paired with how many rows would match each value —
 * computed as a facet: for a given column, rows are narrowed by every *other* active filter
 * (but not that column's own filter), so ticking a box in one checklist updates the counts
 * shown in another, while a column's own counts stay stable as its own boxes are ticked.
 *
 * `targetKeys`, if given, restricts which columns counts are actually computed for — the master-
 * detail filter dropdown only ever displays one column's checklist at a time, so callers can pass
 * `[activeColumnKey]` to avoid the O(filterableColumns × rows) cost of computing counts for every
 * column when only one is ever read. `columns` must still be the *full* column list even when
 * narrowing via `targetKeys`, since it's also used to resolve each *other* filter's accessor.
 *
 * `excludeFilters` (see `cycleFilterValue`) is excluded from the facet baseline the same way as
 * `filters` — a column's own exclude selections don't narrow its own counts, only every other
 * column's include/exclude selections do. `rangeFilters` gets the same treatment: a `type: 'date'`
 * column can carry both a checklist (this function) and its own range filter (the two-thumb
 * slider) at once, so that column's own active range must also be excluded from its own baseline
 * — otherwise narrowing the range would shrink its own checklist counts instead of only every
 * other column's.
 */
export function computeStringValueCounts<TRow extends object>(
  data: TRow[],
  filters: Record<string, Set<string>>,
  rangeFilters: Record<string, RangeFilter>,
  columns: ColumnDefBase<TRow>[],
  emptyLabel = '(none)',
  targetKeys?: string[],
  excludeFilters: Record<string, Set<string>> = {},
): Record<string, Map<string, number>> {
  const map: Record<string, Map<string, number>> = {}
  let cols = columns.filter((c) => c.type !== 'number' && c.filterable !== false)
  if (targetKeys) {
    const keySet = new Set(targetKeys)
    cols = cols.filter((c) => keySet.has(c.key))
  }
  for (const col of cols) {
    const otherFilters = { ...filters }
    delete otherFilters[col.key]
    const otherExcludeFilters = { ...excludeFilters }
    delete otherExcludeFilters[col.key]
    const otherRangeFilters = { ...rangeFilters }
    delete otherRangeFilters[col.key]
    const rows = processData(
      data,
      otherFilters,
      otherRangeFilters,
      [],
      columns,
      emptyLabel,
      otherExcludeFilters,
    )
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

/** Lowercases and strips diacritics (e.g. "Öoo" -> "ooo") so search is accent-insensitive. */
export function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Narrows a checklist's values by a case- and diacritic-insensitive substring search term. */
export function filterValuesBySearch(values: string[], term: string): string[] {
  if (!term) return values
  const q = normalizeForSearch(term)
  return values.filter((v) => normalizeForSearch(v).includes(q))
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
 * Numeric bounds of a column's actual values across `data` — the slider's own `min`/`max`, so it
 * always spans exactly what's in the dataset. Deliberately computed from the full, unfiltered
 * `data` rather than `processedData`, so the slider's own range doesn't shrink out from under a
 * user who's mid-drag just because another filter narrowed the row set (the same "stable handles"
 * reasoning `computeStringValueCounts` already applies to a column's own facet counts). `'date'`
 * columns coerce via `parseDate` (default/override); everything else via `Number`. Returns `null`
 * when no row has a parseable value (empty data, or every value is non-numeric/non-date) — the
 * slider has nothing to bound, so callers should hide it rather than render a degenerate 0–0 range.
 */
export function computeValueBounds<TRow extends object>(
  data: TRow[],
  col: ColumnDefBase<TRow>,
): { min: number; max: number } | null {
  const parse =
    col.type === 'date' ? (col.parseDate ?? defaultParseDate) : (v: unknown) => Number(v)
  let min = Infinity
  let max = -Infinity
  for (const row of data) {
    const t = parse(getColumnValue(col, row) as string)
    if (isNaN(t)) continue
    if (t < min) min = t
    if (t > max) max = t
  }
  return min <= max ? { min, max } : null
}

/**
 * Narrows a `type: 'date'` column's flat value list to those falling within `range`'s bounds —
 * the date-tree equivalent of `filterValuesBySearch`, so the range filter excludes out-of-range
 * dates from the tree itself instead of merely being ANDed onto the final row set once a checkbox
 * is ticked. `values` are parsed with `parseDate` (default/override, matching the column's own);
 * the bounds are always ISO `YYYY-MM-DD` from the range filter's native `<input type="date">`s,
 * so they're parsed with the default parser regardless — see `processData`'s range-filter loop
 * for the same distinction. A value that fails to parse is dropped whenever a bound is active —
 * it isn't part of any chronological range in the first place, same reasoning as `selectDateRange`.
 */
export function filterValuesByRange(
  values: string[],
  range: RangeFilter | undefined,
  parseDate: (value: string) => number = defaultParseDate,
): string[] {
  if (!range || (range.min === '' && range.max === '')) return values
  const min = range.min !== '' ? defaultParseDate(range.min) : -Infinity
  const max = range.max !== '' ? defaultParseDate(range.max) : Infinity
  return values.filter((v) => {
    const t = parseDate(v)
    return !isNaN(t) && t >= min && t <= max
  })
}

/**
 * Reorders a filter checklist's (already search/count-narrowed) values by alphabetical order
 * or by facet count (see `computeStringValueCounts`), ascending or descending. Default is
 * `{ by: 'alpha', dir: 'asc' }`, matching the order `computeStringValues` already produces.
 *
 * `compare` (the column's own `ColumnDefBase.compare`, when set) replaces `localeCompare` both
 * for the `'alpha'` mode itself and as count-mode's tie-break — so a column with a custom order
 * stays consistently ordered everywhere it's listed, not just alphabetically as a fallback.
 * Passed `sort.dir` for the alpha-mode comparison (so a `compareMissingLast`-style `compare` can
 * still pin values regardless of it), but a fixed `'asc'` for the count-mode tie-break, which —
 * like `computeStringValueCounts`'s existing "tie-break alphabetically" behavior — is always
 * ascending regardless of `sort.dir`, itself only ever governing the count comparison above it.
 */
export function sortFilterValues(
  values: string[],
  counts: Map<string, number>,
  sort: ValueSort,
  compare: (a: string, b: string, dir: SortDir) => number = (a, b) => a.localeCompare(b),
): string[] {
  return [...values].sort((a, b) => {
    if (sort.by === 'count') {
      const cmp = (counts.get(a) ?? 0) - (counts.get(b) ?? 0)
      return applyDir(cmp, sort.dir) || compare(a, b, 'asc')
    }
    const cmp = compare(a, b, sort.dir)
    return applyDir(cmp, sort.dir)
  })
}

/** Advances a filter checklist's `ValueSort` through alpha-asc → alpha-desc → count-desc → count-asc → alpha-asc. */
export function cycleValueSort(sort: ValueSort): ValueSort {
  if (sort.by === 'alpha')
    return sort.dir === 'asc' ? { by: 'alpha', dir: 'desc' } : { by: 'count', dir: 'desc' }
  return sort.dir === 'desc' ? { by: 'count', dir: 'asc' } : { by: 'alpha', dir: 'asc' }
}

/** Flips a plain ascending/descending direction, used for the date tree's asc/desc toggle. */
export function toggleSortDir(dir: SortDir): SortDir {
  return dir === 'asc' ? 'desc' : 'asc'
}

/** Compact icon for a filter checklist's current `ValueSort`, e.g. `"ABC ↑"` or `"# ↓"`. */
export function getValueSortIcon(sort: ValueSort): string {
  return `${sort.by === 'count' ? '#' : 'ABC'} ${sort.dir === 'asc' ? '↑' : '↓'}`
}

/** Compact icon for a date tree's current sort direction. */
export function getDateSortIcon(dir: SortDir): string {
  return dir === 'asc' ? '↑' : '↓'
}

/**
 * Groups a `type: 'date'` column's checklist values (from `computeStringValues`) into a
 * Year › Month › Day tree, mirroring spreadsheet-style date autofilters — a high-cardinality
 * date column becomes navigable by year/month instead of one flat per-day checklist. Each
 * value is parsed with `parseDate` (default `new Date(v)`); values that don't parse are
 * collected under a single `emptyLabel` leaf alongside the year nodes rather than silently
 * dropped. `dir` orders the year/month/day nodes at every level chronologically ascending
 * (default) or descending; the trailing `emptyLabel` leaf always stays last regardless of `dir`.
 */
export function computeDateTree(
  values: string[],
  emptyLabel = '(none)',
  dir: SortDir = 'asc',
  parseDate: (value: string) => number = defaultParseDate,
): DateTreeNode[] {
  const years = new Map<string, Map<string, Map<string, string[]>>>()
  const invalid: string[] = []
  for (const v of values) {
    const t = parseDate(v)
    if (isNaN(t)) {
      invalid.push(v)
      continue
    }
    const d = new Date(t)
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

  const orderKeys = (keys: string[]): string[] => {
    const sorted = keys.sort()
    return dir === 'desc' ? sorted.reverse() : sorted
  }

  const nodes: DateTreeNode[] = orderKeys([...years.keys()]).map((y) => {
    const months = years.get(y)!
    const monthNodes: DateTreeNode[] = orderKeys([...months.keys()]).map((m) => {
      const days = months.get(m)!
      const dayNodes: DateTreeNode[] = orderKeys([...days.keys()]).map((day) => ({
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

/**
 * Shift-click range selection over the date tree, computed as a chronological interval rather
 * than over the tree's rendered rows. The tree's year/month/day grouping is purely a *display*
 * concern — ranging is a flat-list operation underneath it, exactly like the plain checklist,
 * just re-expressed in terms of dates instead of list positions. Using rendered-row order instead
 * (crossing a branch row includes that whole branch) would be wrong: ranging from `2023-02` to
 * `2024-06` must select everything chronologically between those two months, but never `2024-07`
 * — even though the `2024` year row sits "between" them if the tree happens to be expanded that
 * far. `anchorNode`/`targetNode` can be a leaf (day) or a branch (year/month); the interval spans
 * the earliest to latest raw value across both nodes' own `values`, and every value in `allValues`
 * that falls inside it (by parsed date, not string order, matching `computeDateTree`'s own
 * `parseDate`) is returned — values that don't parse as dates are excluded, same as they'd never
 * match a chronological interval in the first place.
 */
export function selectDateRange(
  allValues: string[],
  anchorNode: DateTreeNode,
  targetNode: DateTreeNode,
  parseDate: (value: string) => number = defaultParseDate,
): string[] {
  const bounds = [...anchorNode.values, ...targetNode.values]
    .map((v) => parseDate(v))
    .filter((t) => !isNaN(t))
  if (bounds.length === 0) return []
  const start = Math.min(...bounds)
  const end = Math.max(...bounds)
  return allValues.filter((v) => {
    const t = parseDate(v)
    return !isNaN(t) && t >= start && t <= end
  })
}

/**
 * Cycles `key`'s sort entry through `defaultDir` → its opposite → removed (default `defaultDir`:
 * `'asc'`, so `none → asc → desc → none`) — a column with `defaultSortDir: 'desc'` instead cycles
 * `none → desc → asc → none`, so its first click lands on whichever direction is actually useful
 * first for that column.
 */
export function toggleSort(
  sorts: SortEntry[],
  key: string,
  defaultDir: SortDir = 'asc',
): SortEntry[] {
  const existing = sorts.find((s) => s.key === key)
  if (!existing) return [...sorts, { key, dir: defaultDir }]
  if (existing.dir === defaultDir)
    return sorts.map((s) => (s.key === key ? { ...s, dir: toggleSortDir(defaultDir) } : s))
  return sorts.filter((s) => s.key !== key)
}

/**
 * A plain (non-shift) header click: sort by `key` alone, discarding every other sort entry —
 * unlike `toggleSort`/`appendOrToggleSort`, which both preserve the rest of `sorts`. Named
 * `replaceSort` (not `setSort`) specifically to read as distinct from those two at a glance; all
 * three sound like near-synonyms otherwise, despite very different effects on the rest of the
 * multi-sort. If `key` is already the sole active sort, cycles its direction (`defaultDir` →
 * opposite → none) the same way `toggleSort` would; otherwise starts fresh at `defaultDir`
 * (default `'asc'`), regardless of what was sorted before.
 */
export function replaceSort(
  sorts: SortEntry[],
  key: string,
  defaultDir: SortDir = 'asc',
): SortEntry[] {
  if (sorts.length === 1 && sorts[0].key === key) return toggleSort(sorts, key, defaultDir)
  return [{ key, dir: defaultDir }]
}

/**
 * A shift-clicked header: add `key` to the existing multi-sort (at `defaultDir`, default `'asc'`)
 * if it isn't already part of it, or just flip its direction in place if it is. Deliberately never
 * removes an entry — a shift-click's intent is "adjust the multi-sort", and cycling through "none"
 * would both surprise someone who only meant to flip direction and, on the next shift-click,
 * re-add the column at the *end* of the stack instead of restoring its original priority. Removing
 * a column from the multi-sort has its own dedicated UI (a chip's × or the Sort dropdown's remove
 * button).
 */
export function appendOrToggleSort(
  sorts: SortEntry[],
  key: string,
  defaultDir: SortDir = 'asc',
): SortEntry[] {
  const existing = sorts.find((s) => s.key === key)
  if (!existing) return [...sorts, { key, dir: defaultDir }]
  return sorts.map((s) => (s.key === key ? { ...s, dir: toggleSortDir(s.dir) } : s))
}

/** Swaps the sort entry for `key` with its neighbor `delta` positions away (e.g. -1/+1 for up/down buttons) — reorders sort priority without touching `dir`. */
export function moveSortBy(sorts: SortEntry[], key: string, delta: number): SortEntry[] {
  const idx = sorts.findIndex((s) => s.key === key)
  const newIdx = idx + delta
  if (idx === -1 || newIdx < 0 || newIdx >= sorts.length) return sorts
  const next = [...sorts]
  ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
  return next
}

/**
 * Reorders `sorts` by moving the entry for `dragKey` next to the entry for `targetKey`
 * (drag-and-drop) — before it by default, or after it when `after` is true (needed to drop a
 * dragged entry *past* `targetKey`, e.g. making it the new last entry by dropping after the
 * previously-last one, which "insert before" alone can never express). Mirrors `reorderColumn`,
 * but keyed by `.key` on `SortEntry` objects instead of plain strings.
 */
export function reorderSort(
  sorts: SortEntry[],
  dragKey: string,
  targetKey: string,
  after = false,
): SortEntry[] {
  if (dragKey === targetKey) return sorts
  const dragged = sorts.find((s) => s.key === dragKey)
  if (!dragged) return sorts
  const next = sorts.filter((s) => s.key !== dragKey)
  const targetIdx = next.findIndex((s) => s.key === targetKey)
  if (targetIdx === -1) return sorts
  next.splice(after ? targetIdx + 1 : targetIdx, 0, dragged)
  return next
}

/**
 * Deselects all `values` for `key` if any of them are currently selected (matching Gmail's
 * select-all-checkbox convention: an indeterminate or fully-checked state clears on click),
 * selects all of them only if none are currently selected — same convention as row selection's
 * `toggleSelectAll`. `values` is typically a search-narrowed subset of the column's full
 * checklist, so this only ever affects what's currently visible.
 */
export function toggleFilterAll(
  filters: Record<string, Set<string>>,
  key: string,
  values: string[],
): Record<string, Set<string>> {
  const someSelected = values.some((v) => filters[key]?.has(v))
  return setFilterValues(filters, key, values, !someSelected)
}

/**
 * Sets `values` for `key` to `selected` unconditionally — unlike `toggleFilterAll`, which
 * derives the direction itself from whether all of `values` are already selected. Backs
 * shift-click range selection in the filter checklist, where the direction (select vs
 * deselect) is instead decided by the clicked checkbox's own new state, so the whole range
 * needs to move the same way regardless of the other values' prior state.
 */
export function setFilterValues(
  filters: Record<string, Set<string>>,
  key: string,
  values: string[],
  selected: boolean,
): Record<string, Set<string>> {
  const next = new Set(filters[key] ?? [])
  if (selected) values.forEach((v) => next.add(v))
  else values.forEach((v) => next.delete(v))
  return { ...filters, [key]: next }
}

/**
 * Cycles a single checklist value through neutral → include → exclude → neutral, backing "not
 * one of these" filtering for multi-value columns (e.g. "doesn't have the Action tag") — plain
 * `filters` alone can only ever narrow *down to* a set of values, never rule specific ones out.
 * Kept as two separate `Set<string>` maps (`filters` for include, `excludeFilters` for exclude)
 * rather than a single `Map<string, 'include'|'exclude'>` per value, so every existing
 * include-only call site (`processData`'s default exclude-less overload, `computeStringValueCounts`,
 * view-state persistence, `toggleFilterAll`/`setFilterValues`) keeps working unchanged against
 * `filters` alone — only the few sites that need to know about exclusion at all take the second
 * map as a new, optional/trailing parameter.
 *
 * A value is never present in both sets at once: moving it into one always removes it from the
 * other, so `processData`'s two filter passes (include, then exclude) never fight over the same
 * value.
 */
export function cycleFilterValue(
  filters: Record<string, Set<string>>,
  excludeFilters: Record<string, Set<string>>,
  key: string,
  value: string,
): { filters: Record<string, Set<string>>; excludeFilters: Record<string, Set<string>> } {
  const inc = filters[key] ?? new Set<string>()
  const exc = excludeFilters[key] ?? new Set<string>()
  const nextInc = new Set(inc)
  const nextExc = new Set(exc)
  if (inc.has(value)) {
    nextInc.delete(value)
    nextExc.add(value)
  } else if (exc.has(value)) {
    nextExc.delete(value)
  } else {
    nextInc.add(value)
  }
  return {
    filters: { ...filters, [key]: nextInc },
    excludeFilters: { ...excludeFilters, [key]: nextExc },
  }
}

/**
 * Removes `values` from the exclude set for `key`, keeping `cycleFilterValue`'s "never in both
 * sets at once" invariant when a *batch* include action (select-all, shift-range select) moves
 * values into `filters` via `toggleFilterAll`/`setFilterValues` — both of those stay include-only
 * and unaware of `excludeFilters`, so a caller that also tracks exclusion calls this right
 * alongside them rather than those two growing an extra parameter each.
 */
export function clearExcludeValues(
  excludeFilters: Record<string, Set<string>>,
  key: string,
  values: string[],
): Record<string, Set<string>> {
  const next = new Set(excludeFilters[key] ?? [])
  values.forEach((v) => next.delete(v))
  return { ...excludeFilters, [key]: next }
}

/**
 * Returns the contiguous run of `items` between `anchor` and `target` (inclusive, in `items`'
 * order), for shift-click range selection over a rendered list. Falls back to `[target]` alone
 * if `anchor` isn't present in `items` — e.g. it scrolled out of the current page or got
 * filtered/sorted out since it was set.
 */
export function selectRange<T>(items: T[], anchor: T, target: T): T[] {
  const anchorIdx = items.indexOf(anchor)
  if (anchorIdx === -1) return [target]
  const targetIdx = items.indexOf(target)
  const [start, end] = anchorIdx <= targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx]
  return items.slice(start, end + 1)
}

// --- Selection identity (opt-in getRowId) ---
//
// Selection is tracked as Set<TRow> by object identity by default — no `getRowId` involved, and
// every function below is a no-op passthrough to that exact pre-existing behavior when `getRowId`
// is omitted. That default has one real footgun: a re-fetch or re-map of `data` that produces new
// row objects (even with identical content) silently drops selection, since a `Set` can only ever
// match by reference. `getRowId` is the opt-in escape hatch — a consumer who supplies one gets
// selection that survives such a refresh, matched by id instead of reference, at the cost of an
// O(selection size) index build on each selection-membership check (`getSelectedRows`) or mutation
// (`toggleRowInSelection`/`toggleAllInSelection`) — cheap for any selection size a user could
// plausibly multi-select by hand, and only paid at all by a consumer who opts in.
export type GetRowId<TRow> = (row: TRow) => string | number

export function isRowSelected<TRow>(
  selection: Set<TRow>,
  row: TRow,
  getRowId?: GetRowId<TRow>,
): boolean {
  if (!getRowId) return selection.has(row)
  const id = getRowId(row)
  for (const r of selection) if (getRowId(r) === id) return true
  return false
}

// The array-filter equivalent of isRowSelected, used to derive `selectedRows` from
// `processedData` — builds one id lookup up front instead of re-scanning `selection` per row.
export function getSelectedRows<TRow>(
  rows: TRow[],
  selection: Set<TRow>,
  getRowId?: GetRowId<TRow>,
): TRow[] {
  if (!getRowId) return rows.filter((r) => selection.has(r))
  const ids = new Set<string | number>()
  for (const r of selection) ids.add(getRowId(r))
  return rows.filter((r) => ids.has(getRowId(r)))
}

export function toggleRowInSelection<TRow>(
  selection: Set<TRow>,
  row: TRow,
  getRowId?: GetRowId<TRow>,
): Set<TRow> {
  const next = new Set(selection)
  if (!getRowId) {
    if (next.has(row)) next.delete(row)
    else next.add(row)
    return next
  }
  const id = getRowId(row)
  for (const r of next) {
    if (getRowId(r) === id) {
      next.delete(r)
      return next
    }
  }
  next.add(row)
  return next
}

export function toggleAllInSelection<TRow>(
  selection: Set<TRow>,
  rows: TRow[],
  getRowId?: GetRowId<TRow>,
): Set<TRow> {
  if (!getRowId) {
    const someSelected = rows.some((r) => selection.has(r))
    const next = new Set(selection)
    rows.forEach((r) => (someSelected ? next.delete(r) : next.add(r)))
    return next
  }
  const rowIds = new Set(rows.map(getRowId))
  const someSelected = [...selection].some((r) => rowIds.has(getRowId(r)))
  const next = new Set(selection)
  // Drop any existing entry sharing an id with `rows` first, whether selecting or deselecting —
  // covers both the plain toggle-off case and "selecting" a row whose id is already present under
  // a stale (pre-refresh) reference, so it doesn't end up double-counted under two references.
  for (const r of [...next]) if (rowIds.has(getRowId(r))) next.delete(r)
  if (!someSelected) rows.forEach((r) => next.add(r))
  return next
}

// Keeps `selection`'s stored row objects pointing at `nextData`'s current references for their
// ids — call this whenever `data` changes. Without it, a getRowId-based `isRowSelected`/
// `getSelectedRows` check still keeps working (ids still match), but `selection` itself would
// quietly accumulate detached row objects from every past `data` array forever, and anything
// reading `selection` directly (not through those two helpers) would see stale references. Drops
// an id from `selection` entirely once it no longer exists in `nextData`. A no-op passthrough
// (returns `selection` unchanged, not even a copy) when `getRowId` is omitted, matching today's
// behavior exactly — object-identity selection has always relied on stable references, with no
// reconciliation step.
export function reconcileSelection<TRow>(
  nextData: TRow[],
  selection: Set<TRow>,
  getRowId?: GetRowId<TRow>,
): Set<TRow> {
  if (!getRowId || selection.size === 0) return selection
  const byId = new Map<string | number, TRow>()
  for (const row of nextData) byId.set(getRowId(row), row)
  const next = new Set<TRow>()
  let changed = false
  for (const row of selection) {
    const fresh = byId.get(getRowId(row))
    if (fresh === undefined) {
      changed = true
      continue
    }
    next.add(fresh)
    if (fresh !== row) changed = true
  }
  return changed ? next : selection
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
  const byKey = buildColByKey(columns)
  const ordered = order
    .map((k) => byKey.get(k))
    .filter((c): c is ColumnDefBase<TRow> => c !== undefined)
  const orderedKeys = new Set(ordered.map((c) => c.key))
  return [...ordered, ...columns.filter((c) => !orderedKeys.has(c.key))]
}

/**
 * Reconciles a `visibleCols` set against a replaced column list — needed anywhere a table's
 * whole column set can change independently of a fresh mount: Solid's `createTableState.
 * setColumns`, or a `columns` prop/ref changing to a different key set in React's/Vue's own
 * `useTableState` (each adapter reaches this from a different trigger — an explicit setter call
 * vs. a changed argument — but needs the identical reconciliation once it happens). `visibleCols`
 * is normally seeded once (from `defaultVisibleColumns`, or every initial column) and otherwise
 * only ever mutated by `toggleColVisibility`; left unreconciled, a `nextColumns` with no overlap
 * in `prevColumns` (e.g. a consumer swapping to a different data schema entirely while keeping
 * the same table/component instance) would leave every column filtered out as "not visible" —
 * `activeColumns` is filtered by `visibleCols` — and the table would silently render with none at
 * all. A column present in both `prevColumns` and `nextColumns` keeps whatever visibility choice
 * it had; a column only in `nextColumns` (genuinely new) starts visible by default, the same
 * default used when no `defaultVisibleColumns` override is given at construction. This also
 * covers a fully disjoint replacement for free: with nothing carried over to preserve, every
 * column in `nextColumns` counts as "new" and ends up visible.
 */
export function reconcileVisibleColumns<TRow extends object>(
  prevColumns: ColumnDefBase<TRow>[],
  nextColumns: ColumnDefBase<TRow>[],
  visibleCols: Set<string>,
): Set<string> {
  const prevKeys = new Set(prevColumns.map((c) => c.key))
  const next = new Set<string>()
  for (const c of nextColumns) {
    if (prevKeys.has(c.key)) {
      if (visibleCols.has(c.key)) next.add(c.key)
    } else {
      next.add(c.key)
    }
  }
  return next
}

/**
 * Reorders `order` by moving `dragKey` next to `targetKey` (drag-and-drop) — before it by
 * default, or after it when `after` is true (needed to drop `dragKey` *past* `targetKey`, e.g.
 * making it the new last entry by dropping after the previously-last one, which "insert before"
 * alone can never express).
 */
export function reorderColumn(
  order: string[],
  dragKey: string,
  targetKey: string,
  after = false,
): string[] {
  if (dragKey === targetKey) return order
  const next = order.filter((k) => k !== dragKey)
  const targetIdx = next.indexOf(targetKey)
  if (targetIdx === -1) return order
  next.splice(after ? targetIdx + 1 : targetIdx, 0, dragKey)
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

/**
 * Whether group `key` is currently collapsed. `collapsedGroups` tracks manual toggles *away from*
 * `defaultCollapsed` rather than absolute collapsed state, so a group key that's never been
 * toggled (including one that's never been seen before, e.g. new data) picks up `defaultCollapsed`
 * for free — no separate step is needed to seed newly-appearing groups.
 */
export function isGroupCollapsed(
  collapsedGroups: Set<string>,
  key: string,
  defaultCollapsed = false,
): boolean {
  return defaultCollapsed ? !collapsedGroups.has(key) : collapsedGroups.has(key)
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
  if (!Number.isFinite(pageSize) || pageSize <= 0) return data
  const safePage = Number.isFinite(page) ? Math.floor(page) : 1
  const start = (Math.max(1, safePage) - 1) * pageSize
  return data.slice(start, start + pageSize)
}

export function computeTotalPages(count: number, pageSize: number): number {
  if (!Number.isFinite(pageSize) || pageSize <= 0) return 1
  return Math.max(1, Math.ceil(count / pageSize))
}

/**
 * A `GroupResult` re-chunked for one page of `paginateVisibleGroups`'s output. `continued` marks
 * a chunk whose header is a *repeat* — the group's real header rendered on an earlier page and
 * this page picks its rows back up — so the UI can show it as e.g. "Engineering (cont'd)" instead
 * of rendering headerless orphan rows. `sampleRow` is a representative row of the group (always
 * present when `key` is non-null), independent of whether `rows` happens to be empty *on this
 * page* — a header can legitimately land as the very last item of a page's budget with none of
 * its own rows following until the next page, so header rendering (which needs some row to read
 * the groupBy column's real value/format from) can't always rely on `rows[0]`.
 */
export interface PagedGroup<TRow extends object> extends GroupResult<TRow> {
  continued: boolean
  sampleRow: TRow | undefined
}

/**
 * Re-chunks a page's slice of `visibleItems` (the *full*, unpaginated flattening from
 * `getVisibleRows`) back into per-group chunks for rendering — undoing the flattening, scoped to
 * one page. This is what lets a page's row budget (`pageSize`) count header rows alongside data
 * rows: pagination happens once, over the whole flattened sequence, rather than the old
 * paginate-data-rows-then-group-the-slice order (which let a page silently render `pageSize` data
 * rows *plus* however many header rows landed on top of them).
 *
 * A collapsed group contributes exactly one item to `visibleItems` — its header, no rows — so it
 * can never split across a page boundary; its `rows` here are backfilled from `groupedFull`
 * instead of accumulated from the (empty) visible slice, since a collapsed group's rows never
 * entered the paginated flow and have no "this page's portion" to fall back to. This is also just
 * the more useful answer: collapsing a group is usually precisely so its aggregate/select-all
 * reflect the *whole* group, not whatever fraction happens to share the current page. An expanded
 * group's rows, by contrast, do consume page budget and may split across pages — a chunk that
 * picks up mid-group (no header item at the start of this page's slice) is marked `continued` and
 * still gets its `keyParts` from `groupedFull`, purely for the repeated-header label.
 */
export function paginateVisibleGroups<TRow extends object>(
  groupedFull: GroupResult<TRow>[],
  visibleItems: VisibleItem<TRow>[],
  collapsedGroups: Set<string>,
  defaultCollapsed: boolean,
  page: number,
  pageSize: number,
): PagedGroup<TRow>[] {
  const rowsByKey = new Map(groupedFull.filter((g) => g.key !== null).map((g) => [g.key!, g.rows]))
  const keyPartsByKey = new Map(
    groupedFull.filter((g) => g.key !== null).map((g) => [g.key!, g.keyParts]),
  )
  const pageItems = paginateData(visibleItems, page, pageSize)

  const chunks: PagedGroup<TRow>[] = []
  let current: PagedGroup<TRow> | null = null
  for (const item of pageItems) {
    if (item.kind === 'group') {
      const collapsed = isGroupCollapsed(collapsedGroups, item.key, defaultCollapsed)
      current = {
        key: item.key,
        keyParts: keyPartsByKey.get(item.key) ?? [],
        rows: collapsed ? (rowsByKey.get(item.key) ?? []) : [],
        continued: false,
        sampleRow: rowsByKey.get(item.key)?.[0],
      }
      chunks.push(current)
    } else {
      const groupKey = item.groupKey ?? null
      if (current === null || current.key !== groupKey) {
        current = {
          key: groupKey,
          keyParts: groupKey !== null ? (keyPartsByKey.get(groupKey) ?? []) : [],
          rows: [],
          continued: groupKey !== null,
          sampleRow: groupKey !== null ? rowsByKey.get(groupKey)?.[0] : item.row,
        }
        chunks.push(current)
      }
      current.rows.push(item.row)
    }
  }
  return chunks
}

/**
 * The page's flat navigable sequence for keyboard nav — like slicing `visibleItems` by page, but
 * if the slice starts with row items whose group's header rendered on an earlier page (an
 * expanded group split across the page boundary), a synthetic group item for that key is
 * prepended so the repeated ("continued") header — a real, focusable row once rendered — is a
 * valid Tab stop here too, matching `paginateVisibleGroups`'s own chunking.
 */
export function paginateVisibleItems<TRow extends object>(
  visibleItems: VisibleItem<TRow>[],
  page: number,
  pageSize: number,
): VisibleItem<TRow>[] {
  const pageItems = paginateData(visibleItems, page, pageSize)
  const first = pageItems[0]
  if (first?.kind === 'row' && first.groupKey != null) {
    return [{ kind: 'group', key: first.groupKey }, ...pageItems]
  }
  return pageItems
}

/**
 * The "Rows per page" dropdown's option list, guaranteed to include `pageSize` itself — a plain
 * `<select>` bound to a value absent from its own `<option>`s (e.g. `defaultPageSize: 5` against
 * the default `[10, 20, 50, 100]` choices) silently shows the wrong option as selected, since the
 * browser falls back to the first one rather than leaving nothing selected. Inserting the current
 * value keeps the dropdown honest for any custom `defaultPageSize`/`setPageSize` call, not just
 * the four defaults.
 */
export function mergePageSizeOptions(options: number[], pageSize: number): number[] {
  if (options.includes(pageSize)) return options
  return [...options, pageSize].sort((a, b) => a - b)
}

export function searchData<TRow extends object>(
  data: TRow[],
  query: string,
  columns: ColumnDefBase<TRow>[],
): TRow[] {
  if (!query) return data
  const q = normalizeForSearch(query)
  return data.filter((row) =>
    columns.some((col) => {
      if (col.searchable === false) return false
      const v = getColumnValue(col, row)
      const s = col.format ? col.format(v, row) : v != null ? String(v) : ''
      return normalizeForSearch(s).includes(q)
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

/**
 * A fixed-row-height windowed-rendering slice: which item indices should actually be mounted,
 * the pixel offset to position that window at within the scrollable list, and the list's total
 * (virtual) height so the real scrollbar still reports the full item count's size regardless of
 * how few items are actually in the DOM.
 */
export interface VirtualRange {
  startIndex: number
  /** Exclusive — the slice is `values.slice(startIndex, endIndex)`. */
  endIndex: number
  offsetY: number
  totalHeight: number
}

/**
 * Computes which rows of a fixed-row-height list are visible (plus `overscan` extra rows each
 * side, to avoid a blank flash between paint and the next scroll-driven re-render) given the
 * list's current scroll position and viewport size. Used to virtualize the filter dropdown's
 * checklist (see "Filter dropdown" in the docs) — a column with thousands of distinct values
 * would otherwise mount one `<input>`/`<label>` per value regardless of how many are actually
 * scrolled into view.
 */
export function computeVirtualRange(
  scrollTop: number,
  viewportHeight: number,
  itemHeight: number,
  totalCount: number,
  overscan = 5,
): VirtualRange {
  if (totalCount <= 0 || itemHeight <= 0) {
    return { startIndex: 0, endIndex: 0, offsetY: 0, totalHeight: 0 }
  }
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const visibleCount = Math.ceil(viewportHeight / itemHeight) + overscan * 2
  const endIndex = Math.min(totalCount, startIndex + visibleCount)
  return {
    startIndex,
    endIndex,
    offsetY: startIndex * itemHeight,
    totalHeight: totalCount * itemHeight,
  }
}

export function countActiveFilters(
  filters: Record<string, Set<string>>,
  rangeFilters: Record<string, RangeFilter>,
  excludeFilters: Record<string, Set<string>> = {},
): number {
  const keys = new Set([
    ...Object.entries(filters)
      .filter(([, v]) => v.size > 0)
      .map(([k]) => k),
    ...Object.entries(excludeFilters)
      .filter(([, v]) => v.size > 0)
      .map(([k]) => k),
  ])
  return keys.size + Object.values(rangeFilters).filter((v) => v.min !== '' || v.max !== '').length
}
