import type {
  ColumnDefBase,
  SortEntry,
  RangeFilter,
  DateTreeNode,
  ValueSort,
  SortDir,
  DataTableLabels,
} from './types'

function asRecord(row: object): Record<string, unknown> {
  return row as Record<string, unknown>
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Default `type: 'date'` value parser, shared by sort, `computeDateTree`, `selectDateRange` and
 * range bounds: `new Date(v)`, except that `YYYY-MM-DD` is local midnight, like every other
 * date-only format, rather than UTC midnight.
 */
function defaultParseDate(v: string): number {
  const iso = ISO_DAY.exec(v)
  if (!iso) return new Date(v).getTime()
  const [y, m, day] = [Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])]
  const d = new Date(y, m, day)
  return d.getMonth() === m && d.getDate() === day ? d.getTime() : NaN
}

/** Start of the local day `days` days after the one `t` falls in */
function startOfDay(t: number, days = 0): number {
  const d = new Date(t)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime()
}

/** A range filter as a predicate on cell numbers; a date `max` covers its whole local day. */
function inRange(range: RangeFilter, isDate: boolean): (t: number) => boolean {
  const parse = isDate ? defaultParseDate : Number
  const min = range.min === '' ? -Infinity : parse(range.min)
  if (range.max === '') return (t) => t >= min
  const max = parse(range.max)
  if (!isDate) return (t) => t >= min && t <= max
  const end = startOfDay(max, 1)
  return (t) => t >= min && t < end
}

/** Reads a column's cell value from a row per its `value` accessor (or `row[key]` if unset). */
export function getColumnValue<TRow extends object>(col: ColumnDefBase<TRow>, row: TRow): unknown {
  return col.value ? col.value(row) : asRecord(row)[col.key]
}

/** `'end'` when the column's cells right-align (`align`, which defaults to `'end'` for `type: 'number'`), else `undefined`: no inline style. */
export function getColumnAlign<TRow extends object>(col: ColumnDefBase<TRow>): 'end' | undefined {
  return (col.align ?? (col.type === 'number' ? 'end' : 'start')) === 'end' ? 'end' : undefined
}

/** A cell's plain text (`format`, never `render`), e.g. for an accessible name. */
export function cellText<TRow extends object>(col: ColumnDefBase<TRow>, row: TRow): string {
  const v = getColumnValue(col, row)
  if (col.format) return col.format(v, row)
  if (Array.isArray(v)) return v.join(', ')
  return v != null ? String(v) : ''
}

/** A row's plain-text name: its first column with text, so a picture column doesn't leave it blank. */
export function rowText<TRow extends object>(columns: ColumnDefBase<TRow>[], row: TRow): string {
  for (const col of columns) {
    const text = cellText(col, row)
    if (text) return text
  }
  return ''
}

/** A group's plain-text name, every `groupBy` level joined with " › " as in its header. */
export function groupText<TRow extends object>(
  columns: ColumnDefBase<TRow>[],
  groupBy: string[],
  keyParts: string[],
  sampleRow: TRow,
): string {
  return groupBy
    .map((key, i) => {
      const col = columns.find((c) => c.key === key)
      if (!col) return keyParts[i]
      if (col.groupValue) return col.groupFormat?.(keyParts[i]) ?? keyParts[i]
      const raw = getColumnValue(col, sampleRow)
      const value = Array.isArray(raw) ? keyParts[i] : raw
      return col.format ? col.format(value, sampleRow) : String(value ?? '')
    })
    .join(' › ')
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
 * to resolve to *something*). Shared by every place `filterData`/`groupData` look up a raw
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

/** `Number(v)`, but `NaN` for a missing value, which `Number` reads as 0 (issue #47). */
function toNumber(v: unknown): number {
  return v == null || v === '' ? NaN : Number(v)
}

/** A number or date cell as a number (dates via `col.parseDate`); `NaN` when missing or invalid. */
function cellToNumber<TRow extends object>(
  col: ColumnDefBase<TRow> | undefined,
  raw: unknown,
): number {
  if (col?.type !== 'date') return toNumber(raw)
  // `new Date(null)` is 1970, not invalid
  return raw == null || raw === '' ? NaN : (col.parseDate ?? defaultParseDate)(raw as string)
}

/**
 * Coerces a raw value per `col.type` (`'date'` and `'number'` via `cellToNumber`, else
 * unchanged) so every sort agrees on what it means (issue #10). Applied to cell values
 * (`sortRows`) and to group `keyPart`s (`sortWithinGroups`).
 */
function coerceByType<TRow extends object>(
  col: ColumnDefBase<TRow> | undefined,
  raw: unknown,
): unknown {
  return col?.type === 'date' || col?.type === 'number' ? cellToNumber(col, raw) : raw
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

/** Default value comparator: numeric when both sides are numbers, else lexicographic. */
function defaultCompare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number' && !isNaN(a) && !isNaN(b)) return a - b
  return String(a ?? '').localeCompare(String(b ?? ''))
}

/** Flips a direction-naive comparator's result for a descending sort — the same "compute cmp,
 * then negate it for desc" idiom repeated at every sort-ordering call site in this module. */
function applyDir(cmp: number, dir: SortDir): number {
  return dir === 'asc' ? cmp : -cmp
}

/** Decomposes a `Date` into its zero-padded year/month/day string parts — shared by
 * `bucketDatePart` and `computeDateTree`, which both build year/month/day keys from a `Date`. */
function datePartsOf(d: Date): { y: string; m: string; day: string } {
  return {
    y: String(d.getFullYear()),
    m: String(d.getMonth() + 1).padStart(2, '0'),
    day: String(d.getDate()).padStart(2, '0'),
  }
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
 * Ready-made `ColumnDefBase.compare` for an ordinal column (`Bronze < Silver < Gold`): values
 * rank by their index in `order`; values missing from it rank after, tied. Under a descending sort
 * they come first: wrap it in `compareMissingLast(compareInOrder(order), (v) => !order.includes(v))`
 * to keep them last in both directions.
 */
export function compareInOrder(order: readonly unknown[]): (a: unknown, b: unknown) => number {
  const rank = (v: unknown) => {
    const i = order.indexOf(v)
    return i === -1 ? order.length : i
  }
  return (a, b) => rank(a) - rank(b)
}

/**
 * Sorts `rows` by `sorts` for `sortData` and `sortWithinGroups`, coercing each row's values once
 * rather than per comparison (docs/performance.md); a column's `compare` takes the raw values.
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
      const raw = getColumnValue(col, row)
      return col.compare ? raw : coerceByType(col, raw)
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

/**
 * Adapters sort the full data once and filter the sorted rows (`searchData`, `filterData`), so a
 * keystroke or filter click never re-sorts: filtering keeps order and the sort is stable, so the
 * result equals filtering first, given a consistent comparator. Returns `data` itself when `sorts`
 * is empty.
 */
export function sortData<TRow extends object>(
  data: TRow[],
  sorts: SortEntry[],
  columns: ColumnDefBase<TRow>[],
): TRow[] {
  return sortRows(data, sorts, buildColByKey(columns))
}

export function filterData<TRow extends object>(
  data: TRow[],
  filters: Record<string, Set<string>>,
  rangeFilters: Record<string, RangeFilter>,
  columns: ColumnDefBase<TRow>[],
  emptyLabel = '(none)',
  excludeFilters: Record<string, Set<string>> = {},
  // Per-column runtime override of `col.multiMode`, keyed the same way as `filters` — lets a
  // user flip a multi-value column's checklist between "any" (union) and "all" (intersection)
  // from the UI (see `setFilterMode`) without touching the developer-set column default.
  // Falls back to `col?.multiMode ?? 'or'` for any key with no override, so this is purely
  // additive: a caller that never passes it gets today's exact behavior.
  filterModes: Record<string, 'and' | 'or'> = {},
): TRow[] {
  let result = [...data]
  const colByKey = buildColByKey(columns)

  // Iterate the row's few values against an O(1) `Set.has`, never `.includes` per filter value
  // (docs/performance.md); `rowValueSet` only for "and" mode.
  for (const [key, vals] of Object.entries(filters)) {
    if (vals.size === 0) continue
    const col = colByKey.get(key)
    const mode = filterMatchMode(filterModes, key, col, data)
    result = result.filter((row) => {
      const rowValues = resolveMultiValues(col, row, key, emptyLabel)
      if (mode === 'and') {
        const rowValueSet = new Set(rowValues)
        return [...vals].every((v) => rowValueSet.has(v))
      }
      return rowValues.some((v) => vals.has(v))
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
      return !rowValues.some((v) => vals.has(v))
    })
  }

  for (const [key, range] of Object.entries(rangeFilters)) {
    if (range.min === '' && range.max === '') continue
    const col = colByKey.get(key)
    // Bounds come from the range filter's native <input type="date">s, always ISO
    // `YYYY-MM-DD` — parsed with the default parser, not `col.parseDate`, since a column's
    // custom parser is for its own raw value format, not this input's fixed ISO one.
    const matches = inRange(range, col?.type === 'date')
    result = result.filter((r) => matches(cellToNumber(col, resolveValue(col, r, key))))
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
 *
 * Accumulates into a `Map`: a plain object would enumerate integer-like keys in numeric order
 * (docs/grouped-columns.md).
 */
export function groupData<TRow extends object>(
  data: TRow[],
  groupBy: string[],
  columns: ColumnDefBase<TRow>[],
  emptyLabel = '(none)',
): GroupResult<TRow>[] {
  if (groupBy.length === 0) return [{ key: null, keyParts: [], rows: data }]
  const colByKey = buildColByKey(columns)
  const groupCols = groupBy.map((g) => colByKey.get(g))
  const groups = new Map<string, { keyParts: string[]; rows: TRow[] }>()
  for (const row of data) {
    const bucketed = groupBy.map((g, i) => {
      const col = groupCols[i]
      const raw = resolveValue(col, row, g)
      return col?.groupValue ? col.groupValue(raw, row, col) : raw
    })
    // Fast path for the usual all-scalar row (one bucket): no per-row combo arrays, and keyParts
    // only built for a new group
    if (!bucketed.some(Array.isArray)) {
      const key =
        bucketed.length === 1
          ? String(bucketed[0] ?? '')
          : bucketed.map((v) => String(v ?? '')).join(' › ')
      let group = groups.get(key)
      if (!group) {
        group = { keyParts: bucketed.map((v) => String(v ?? '')), rows: [] }
        groups.set(key, group)
      }
      group.rows.push(row)
      continue
    }
    let combos: string[][] = [[]]
    for (const value of bucketed) {
      const values = multiValues(value, emptyLabel)
      combos = combos.flatMap((combo) => values.map((v) => [...combo, v]))
    }
    for (const keyParts of combos) {
      const key = keyParts.join(' › ')
      let group = groups.get(key)
      if (!group) {
        group = { keyParts, rows: [] }
        groups.set(key, group)
      }
      group.rows.push(row)
    }
  }
  return [...groups.entries()].map(([key, { keyParts, rows }]) => ({ key, keyParts, rows }))
}

/**
 * Orders `groups` by the sort entries matching a groupBy column, comparing each group's own
 * `keyParts[i]` (not a multi-value row's whole array), and re-sorts each group's rows by the
 * remaining entries (docs/grouped-columns.md).
 */
export function sortWithinGroups<TRow extends object>(
  groups: GroupResult<TRow>[],
  sorts: SortEntry[],
  groupBy: string[],
  columns: ColumnDefBase<TRow>[],
): GroupResult<TRow>[] {
  // Ungrouped: the single group's rows are already sorted by `sortData`, re-sorting them is a no-op
  if (groupBy.length === 0) return groups
  const colByKey = buildColByKey(columns)
  const dirByGroupKey = new Map(
    sorts.filter((s) => groupBy.includes(s.key)).map((s) => [s.key, s.dir]),
  )
  const withinGroupSorts = sorts.filter((s) => !groupBy.includes(s.key))

  let result = groups
  if (withinGroupSorts.length > 0) {
    result = result.map((group) => ({
      ...group,
      rows: sortRows(group.rows, withinGroupSorts, colByKey),
    }))
  }
  // Nesting follows `groupBy`'s order, never position in `sorts` (docs/grouped-columns.md)
  if (dirByGroupKey.size > 0) {
    result = [...result].sort((a, b) => {
      for (let idx = 0; idx < groupBy.length; idx++) {
        const key = groupBy[idx]
        const dir = dirByGroupKey.get(key)
        if (dir === undefined) continue
        const raw = colByKey.get(key)
        // A bucketed date key is ISO (`bucketDatePart`), not the column's own `parseDate` format
        const col = raw?.groupValue && raw.type === 'date' ? { ...raw, parseDate: undefined } : raw
        const ka = a.keyParts[idx]
        const kb = b.keyParts[idx]
        const va = col?.compare ? ka : coerceByType(col, ka)
        const vb = col?.compare ? kb : coerceByType(col, kb)
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
 *
 * A missing (`null`/`undefined`) or non-numeric value returns `null` rather than coercing it —
 * `Number(null) === 0` would otherwise silently merge "no value" into the same bucket as a real,
 * confirmed `0`, and `Number(undefined)`/`Number('abc')` being `NaN` would otherwise flow through
 * to a group key that stringifies to the literal text `"NaN"` (see `groupData`'s `multiValues`).
 * `null` stringifies to `''` the same way an *unbucketed* missing value already does, so it lands
 * in the same "no value" group a plain (non-bucketed) numeric column's missing rows already get.
 */
export function bucketNumericRange(step: number): (value: unknown) => number | null {
  return (value: unknown) => {
    const n = toNumber(value)
    return isNaN(n) ? null : Math.floor(n / step) * step
  }
}

/**
 * Formats a `bucketNumericRange(step)` key as `"<lower>–<upper><unit>"`, e.g. `"40–50%"`.
 * `missingLabel` renders the "no value" group (see `bucketNumericRange`); a keyPart that didn't
 * come from `bucketNumericRange` and isn't a number is returned unchanged rather than replaced,
 * on the assumption it's meaningful raw text from some other source.
 */
export function formatNumericRange(
  step: number,
  unit = '',
  missingLabel = '(none)',
): (keyPart: string) => string {
  return (keyPart: string) => {
    if (keyPart === '') return missingLabel
    const n = Number(keyPart)
    return isNaN(n) ? keyPart : `${n}–${n + step}${unit}`
  }
}

/** `bucketNumericRange`/`formatNumericRange` as one matched pair, so `step`/`unit`/`missingLabel`
 * are given once instead of twice — passing them to only one half is a config-divergence bug
 * that fails silently (a group header disagreeing with its own bucket's real boundaries). Spread
 * directly into a column def: `{ key: 'price', ...numericRangeGroup(10, '%') }`. */
export function numericRangeGroup(
  step: number,
  unit = '',
  missingLabel = '(none)',
): { groupValue: (value: unknown) => number | null; groupFormat: (keyPart: string) => string } {
  return {
    groupValue: bucketNumericRange(step),
    groupFormat: formatNumericRange(step, unit, missingLabel),
  }
}

/** Coarser granularity `bucketDatePart`/`formatDatePart` group a `type: 'date'` column by. */
export type DatePart = 'year' | 'month' | 'day'

/**
 * Ready-made `groupValue` bucketing function for a `type: 'date'` column: truncates a value to
 * the start of its enclosing year/month/day (read with the column's `parseDate`), returned as an
 * ISO date string (`"2024-05-01"`), which `sortWithinGroups` orders chronologically. Pair with `formatDatePart` to render a human label (e.g. `"May 2024"`) instead of
 * the raw ISO bucket key in the group header.
 *
 * A missing (`null`/`undefined`) value returns `null` rather than falling through to
 * `String(value)` — `String(null) === "null"`, a 4-character string that fails to parse and
 * would otherwise surface as the literal group header text "null". A genuinely invalid *but
 * present* value (e.g. `"not-a-date"`) still returns it unchanged — that case has real raw text
 * worth keeping, unlike a missing value.
 */
export function bucketDatePart(
  part: DatePart,
): (
  value: unknown,
  row?: unknown,
  col?: Pick<ColumnDefBase<object>, 'parseDate'>,
) => string | null {
  return (value, _row, col) => {
    if (value == null) return null
    const t = (col?.parseDate ?? defaultParseDate)(String(value))
    if (isNaN(t)) return String(value)
    const { y, m, day: dayPart } = datePartsOf(new Date(t))
    const day = part === 'day' ? dayPart : '01'
    return `${y}-${part === 'year' ? '01' : m}-${day}`
  }
}

/** Formats a `bucketDatePart(part)` ISO key for display, e.g. `"2024-05-01"` -> `"May 2024"` for
 * `'month'`. `missingLabel` renders the "no value" group (see `bucketDatePart`). */
export function formatDatePart(
  part: DatePart,
  missingLabel = '(none)',
): (keyPart: string) => string {
  return (keyPart: string) => {
    if (keyPart === '') return missingLabel
    const d = new Date(defaultParseDate(keyPart))
    if (isNaN(d.getTime())) return keyPart
    if (part === 'year') return String(d.getFullYear())
    if (part === 'month') return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  }
}

/** `bucketDatePart`/`formatDatePart` as one matched pair — see `numericRangeGroup`'s own doc for
 * why (`part`/`parseDate` given once instead of twice). Spread directly into a column def:
 * `{ key: 'releaseDate', ...datePartGroup('month') }`. */
export function datePartGroup(
  part: DatePart,
  missingLabel = '(none)',
): { groupValue: ReturnType<typeof bucketDatePart>; groupFormat: (keyPart: string) => string } {
  return {
    groupValue: bucketDatePart(part),
    groupFormat: formatDatePart(part, missingLabel),
  }
}

/** Options shared by `bucketLogRange`/`formatLogRange`/`logRangeGroup`. */
export interface LogRangeOptions {
  /** Multiplier per exponent step: `10` for decades (default), `2` for octaves/binary doublings. */
  base?: number
  /**
   * Bucket starts within one `base` cycle, as multipliers of `base ** exponent` — e.g. `[1, 3]`
   * splits each decade into a "1–3" and a "3–10" bucket (a "1-3-10" half-decade grid); `[1, 2, 5]`
   * gives the common "1-2-5" grid. Must include `1`. Defaults to `[1]`: one bucket per power of
   * `base` — plain order-of-magnitude (or per-octave, with `base: 2`).
   */
  divisions?: number[]
  /**
   * Values below this collapse into a single low bucket instead of extending the log grid down
   * toward zero — the near-zero tail of a right-skewed column (mostly-unplayed games, mostly-empty
   * carts) is rarely worth splitting further, and `log` is undefined at/below `0` regardless.
   * Default `1`. Pass `min: 0` to opt out of the collapse bucket and let the grid extend all the
   * way down to (but not including) zero — `0` and negative values still always fall into the
   * below-threshold bucket no matter what `min` is set to, since they have no log-scale bucket to
   * extend into.
   */
  min?: number
}

const LOG_RANGE_EPSILON = 1e-9
/** Sentinel bucket key for "below `min`" — sorts before every real bucket (all `>= min > 0`) and
 * is distinguishable from the `null` "missing" key used by every other bucketer in this file. */
const BELOW_LOG_MIN = -Infinity

function sortedDivisions(divisions: number[] | undefined): number[] {
  return [...(divisions ?? [1])].sort((a, b) => a - b)
}

/** The bucket-start value just after `start` in the same `base`/`divisions` grid `bucketLogRange`
 * produced `start` from — used by `formatLogRange` to render a bucket's upper bound without
 * `bucketLogRange` needing to return a `[start, end]` pair (every other bucketer in this file
 * returns a single scalar key too, so `groupData`/`sortWithinGroups` only ever handle one shape). */
function logRangeBoundaryAfter(start: number, base: number, divisions: number[]): number {
  const exp = Math.floor(Math.log(start) / Math.log(base) + LOG_RANGE_EPSILON)
  const normalized = start / base ** exp
  const idx = divisions.findIndex(
    (d) => Math.abs(d - normalized) < LOG_RANGE_EPSILON * Math.max(normalized, 1),
  )
  return idx === divisions.length - 1
    ? divisions[0] * base ** (exp + 1)
    : divisions[idx + 1] * base ** exp
}

function formatLogMagnitude(n: number): string {
  const trim = (v: number) => Number(v.toPrecision(12)).toString()
  if (n >= 1e6) return `${trim(n / 1e6)}M`
  if (n >= 1e3) return `${trim(n / 1e3)}k`
  return trim(n)
}

/**
 * Ready-made `groupValue` bucketing function for a `type: 'number'` column on a logarithmic
 * scale — for right-skewed columns (review counts, hours played, file sizes) spanning several
 * orders of magnitude, where any single linear `bucketNumericRange` step is either too coarse
 * for the long tail or too fine for the low end. See `LogRangeOptions` for `base`/`divisions`/
 * `min`. Missing/non-numeric values return `null`, same convention as `bucketNumericRange`; a
 * value below `min` (or `<= 0`, always unbucketable on a log scale) returns a distinct sentinel
 * so it groups apart from "no value" rather than merging with it. Pair with `formatLogRange`
 * (same options) to render a bucket's range in the group header, or use `logRangeGroup` for both.
 */
export function bucketLogRange(options: LogRangeOptions = {}): (value: unknown) => number | null {
  const { base = 10, min = 1 } = options
  const divisions = sortedDivisions(options.divisions)
  return (value: unknown) => {
    const n = toNumber(value)
    if (isNaN(n)) return null
    if (n <= 0 || n < min) return BELOW_LOG_MIN
    let exp = Math.floor(Math.log(n) / Math.log(base) + LOG_RANGE_EPSILON)
    for (;;) {
      for (let i = divisions.length - 1; i >= 0; i--) {
        const start = base ** exp * divisions[i]
        if (start <= n * (1 + LOG_RANGE_EPSILON)) return start
      }
      exp--
    }
  }
}

/** Formats a `bucketLogRange(options)` key as `"<lower>–<upper><unit>"` (e.g. `"3–10"`,
 * `"300k–1M"`), or `"<<min><unit>"` for the below-`min` bucket. Same `options` as the bucketer;
 * `missingLabel` renders the "no value" group. */
export function formatLogRange(
  options: LogRangeOptions = {},
  unit = '',
  missingLabel = '(none)',
): (keyPart: string) => string {
  const { base = 10, min = 1 } = options
  const divisions = sortedDivisions(options.divisions)
  return (keyPart: string) => {
    if (keyPart === '') return missingLabel
    const n = Number(keyPart)
    if (isNaN(n)) return keyPart
    if (n === BELOW_LOG_MIN) return `<${formatLogMagnitude(min)}${unit}`
    const end = logRangeBoundaryAfter(n, base, divisions)
    return `${formatLogMagnitude(n)}–${formatLogMagnitude(end)}${unit}`
  }
}

/** `bucketLogRange`/`formatLogRange` as one matched pair — see `numericRangeGroup`'s own doc for
 * why (`options`/`unit`/`missingLabel` given once instead of twice). Spread directly into a
 * column def: `{ key: 'hoursPlayed', ...logRangeGroup({ divisions: [1, 3] }) }`. */
export function logRangeGroup(
  options: LogRangeOptions = {},
  unit = '',
  missingLabel = '(none)',
): { groupValue: (value: unknown) => number | null; groupFormat: (keyPart: string) => string } {
  return {
    groupValue: bucketLogRange(options),
    groupFormat: formatLogRange(options, unit, missingLabel),
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
 * Flattens `groupData`'s result into rendered display order: every group header (collapsed ones
 * too), then its rows unless collapsed — the keyboard-nav order. Called on the full data so
 * pagination budgets headers and rows together (`paginateVisibleGroups`/`paginateVisibleItems`).
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

// One column only: callers compute it where a checklist is shown, not for every column eagerly.
export function computeStringValues<TRow extends object>(
  data: TRow[],
  col: ColumnDefBase<TRow>,
  emptyLabel = '(none)',
): string[] {
  const values = [...new Set(data.flatMap((r) => multiValues(getColumnValue(col, r), emptyLabel)))]
  // No direction of its own here — a fixed 'asc' lets a compare like compareMissingLast()
  // still pin its matching values last (compareMissingLast's non-pinned branch is direction-
  // naive anyway, so 'asc' vs 'desc' would make no difference there).
  return col.compare ? values.sort((a, b) => col.compare!(a, b, 'asc')) : values.sort()
}

/**
 * `computeStringValues`' values with each one's facet count: rows narrowed by every *other*
 * column's include, exclude and range filters (under `filterModes`), never by the column's own,
 * so its counts stay stable as its own boxes are ticked (docs/filter-dropdown.md). `columns` is
 * the full list; a `number` column gets no counts.
 */
export function computeStringValueCounts<TRow extends object>(
  data: TRow[],
  col: ColumnDefBase<TRow>,
  filters: Record<string, Set<string>>,
  rangeFilters: Record<string, RangeFilter>,
  columns: ColumnDefBase<TRow>[],
  emptyLabel = '(none)',
  excludeFilters: Record<string, Set<string>> = {},
  filterModes: Record<string, 'and' | 'or'> = {},
): Map<string, number> {
  const counts = new Map<string, number>()
  if (col.type === 'number') return counts
  const otherFilters = { ...filters }
  delete otherFilters[col.key]
  const otherExcludeFilters = { ...excludeFilters }
  delete otherExcludeFilters[col.key]
  const otherRangeFilters = { ...rangeFilters }
  delete otherRangeFilters[col.key]
  const rows = filterData(
    data,
    otherFilters,
    otherRangeFilters,
    columns,
    emptyLabel,
    otherExcludeFilters,
    filterModes,
  )
  for (const row of rows) {
    for (const v of multiValues(getColumnValue(col, row), emptyLabel)) {
      counts.set(v, (counts.get(v) ?? 0) + 1)
    }
  }
  return counts
}

// Printable ASCII (and `buildSearchIndex`'s NUL separator) has no diacritics: skipping NFD +
// regex builds a 500k-row search index ~1.2x faster
const PRINTABLE_ASCII = /^[\0 -~]*$/

/** Lowercases and strips diacritics (e.g. "Öoo" -> "ooo") so search is accent-insensitive. */
export function normalizeForSearch(s: string): string {
  if (PRINTABLE_ASCII.test(s)) return s.toLowerCase()
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
  selected: ReadonlySet<string> | undefined,
): string[] {
  return values.filter((v) => selected?.has(v) || (counts.get(v) ?? 0) > 0)
}

/**
 * A filter value (checklist value, chip value or range bound, all strings) shown through the
 * column's `format`, without a row; a number column's value goes back to a number first. The
 * empty-value placeholder and columns without `format` show as is.
 */
export function formatFilterValue<TRow extends object>(
  col: ColumnDefBase<TRow> | undefined,
  value: string,
  emptyLabel: string,
): string {
  if (!col?.format || value === emptyLabel || value === '') return value
  return col.format(col.type === 'number' ? Number(value) : value)
}

/** Max values shown by name on an active-bar filter chip before falling back to a "+N more"
 * suffix — see `summarizeFilterValues`. */
const FILTER_CHIP_MAX = 3

/**
 * A column's checklist match: its runtime override, else `col.multiMode`, else "any". Always "any"
 * for a single-value column, where "all" of two values would match no row.
 */
export function filterMatchMode<TRow extends object>(
  filterModes: Record<string, 'and' | 'or'>,
  key: string,
  col: ColumnDefBase<TRow> | undefined,
  data: TRow[],
): 'and' | 'or' {
  const mode = filterModes[key] ?? col?.multiMode ?? 'or'
  if (mode !== 'and') return 'or'
  const multi = col ? isMultiValueColumnCached(data, col) : isMultiValueColumn(data, col, key)
  return multi ? 'and' : 'or'
}

/** Joins an include chip's values: " & " when all must match, so it doesn't read as "any of" */
export const chipSeparator = (mode: 'and' | 'or'): string => (mode === 'and' ? ' & ' : ', ')

/**
 * A filter chip's label: the first `FILTER_CHIP_MAX` values joined by `separator`, plus a
 * `moreValues(n)` suffix for the rest.
 */
export function summarizeFilterValues(
  vals: Set<string>,
  moreValues: (n: number) => string,
  format: (value: string) => string = (v) => v,
  separator = ', ',
): string {
  const arr = [...vals].map(format)
  if (arr.length <= FILTER_CHIP_MAX) return arr.join(separator)
  return `${arr.slice(0, FILTER_CHIP_MAX).join(separator)}, ${moreValues(arr.length - FILTER_CHIP_MAX)}`
}

/**
 * Whether `col`'s `label` or `category` matches a column-search term (empty always matches);
 * shared by every search box narrowing a column list.
 */
export function columnMatchesSearch(
  col: { label: string; category?: string },
  term: string,
): boolean {
  const t = term.trim().toLowerCase()
  if (!t) return true
  return col.label.toLowerCase().includes(t) || (col.category?.toLowerCase().includes(t) ?? false)
}

/** One `category`'s worth of columns, in `cols`' own relative order. */
export interface ColumnCategory<T> {
  name: string
  columns: T[]
}

/** `groupColumnsByCategory`'s result. */
export interface CategorizedColumns<T> {
  uncategorized: T[]
  categories: ColumnCategory<T>[]
}

/**
 * Buckets `cols` by `category`: `uncategorized` and each category's `columns` keep `cols`' order,
 * categories come in first-appearance order. Never reorders; callers apply their own ordering.
 */
export function groupColumnsByCategory<T extends { category?: string }>(
  cols: T[],
): CategorizedColumns<T> {
  const uncategorized: T[] = []
  const categories: ColumnCategory<T>[] = []
  const byName = new Map<string, ColumnCategory<T>>()
  for (const col of cols) {
    if (!col.category) {
      uncategorized.push(col)
      continue
    }
    let bucket = byName.get(col.category)
    if (!bucket) {
      bucket = { name: col.category, columns: [] }
      byName.set(col.category, bucket)
      categories.push(bucket)
    }
    bucket.columns.push(col)
  }
  return { uncategorized, categories }
}

/**
 * The Columns dropdown's lists, in real column order (it doubles as the drag-to-reorder surface):
 * whether `term` searches, the visible and available (hidden) columns it matches, the latter
 * bucketed by category (rendered when not searching) and, while searching, the shown visible keys —
 * Alt+↑/↓'s only swap partners (see `moveVisibleColumnBy`).
 */
export function columnsDropdownLists<T extends { key: string; label: string; category?: string }>(
  ordered: T[],
  visible: ReadonlySet<string>,
  term: string,
): [
  searching: boolean,
  shownVisible: T[],
  shownAvailable: T[],
  categorizedAvailable: CategorizedColumns<T>,
  reorderEligible: Set<string> | undefined,
] {
  const searching = term.trim() !== ''
  const shown = ordered.filter((c) => columnMatchesSearch(c, term))
  const shownVisible = shown.filter((c) => visible.has(c.key))
  const shownAvailable = shown.filter((c) => !visible.has(c.key))
  return [
    searching,
    shownVisible,
    shownAvailable,
    groupColumnsByCategory(shownAvailable),
    searching ? new Set(shownVisible.map((c) => c.key)) : undefined,
  ]
}

/**
 * Sort's/Group's "add" lists: `cols` not yet active, whether `term` searches, the ones it matches
 * (alphabetized, shown flat while searching) and, for when it doesn't, those bucketed by category
 * with the categories alphabetized too — none of them is sorted/grouped yet, so their definition
 * order carries no meaning.
 */
export function addableLists<T extends { key: string; label: string; category?: string }>(
  cols: T[],
  isActive: (key: string) => boolean,
  term: string,
): [addable: T[], searching: boolean, shown: T[], categorized: CategorizedColumns<T>] {
  const addable = cols.filter((c) => !isActive(c.key))
  const shown = addable
    .filter((c) => columnMatchesSearch(c, term))
    .sort((a, b) => a.label.localeCompare(b.label))
  const categorized = groupColumnsByCategory(shown)
  categorized.categories.sort((a, b) => a.name.localeCompare(b.name))
  return [addable, term.trim() !== '', shown, categorized]
}

/**
 * A column's value bounds over the full, unfiltered `data` (so the slider doesn't shrink
 * mid-drag when another filter narrows rows); dates via `parseDate` and floored to their local
 * day, so the slider's one-day steps land on days; else `Number`. `null` when no value parses:
 * callers hide the slider.
 */
export function computeValueBounds<TRow extends object>(
  data: TRow[],
  col: ColumnDefBase<TRow>,
): { min: number; max: number } | null {
  let min = Infinity
  let max = -Infinity
  for (const row of data) {
    const t = cellToNumber(col, getColumnValue(col, row))
    if (isNaN(t)) continue
    if (t < min) min = t
    if (t > max) max = t
  }
  if (min > max) return null
  return col.type === 'date' ? { min: startOfDay(min), max: startOfDay(max) } : { min, max }
}

/** Converts a bound (epoch ms for `type: 'date'`, a plain number otherwise) back into the string
 * shape `RangeFilter.min`/`.max` expects. Shared by the range slider's thumb commit and the plain
 * min/max inputs' default-to-bounds display — both consumers of a column's numeric/date bounds,
 * so they'd otherwise drift out of sync with each other. */
export function formatRangeBound<TRow extends object>(n: number, col: ColumnDefBase<TRow>): string {
  if (col.type !== 'date') return String(n)
  // The nearest local midnight: a slider's 24 h steps drift an hour across a DST change.
  const { y, m, day } = datePartsOf(new Date(n + 12 * 3_600_000))
  return `${y}-${m}-${day}`
}

type RangePreset = NonNullable<ColumnDefBase['rangePresets']>[number]

/** The `rangePresets` entry `rangeFilter` equals, an omitted bound matching an empty one */
export function matchingRangePreset<TRow extends object>(
  col: ColumnDefBase<TRow> | undefined,
  rangeFilter: RangeFilter | undefined,
): RangePreset | undefined {
  const same = (bound: number | undefined, value: string | undefined) =>
    bound === undefined ? !value : !!value && Number(value) === bound
  return col?.rangePresets?.find(
    (p) => same(p.min, rangeFilter?.min) && same(p.max, rangeFilter?.max),
  )
}

/** The range filter `RangeFilter` a preset sets: an omitted bound is left empty */
export function rangePresetFilter(preset: RangePreset): RangeFilter {
  return {
    min: preset.min === undefined ? '' : String(preset.min),
    max: preset.max === undefined ? '' : String(preset.max),
  }
}

/**
 * A range filter's active-bar chip value: its preset's label, else its bounds through `format`,
 * an open-ended range as "≥ min" or "≤ max"
 */
export function rangeChipText<TRow extends object>(
  col: ColumnDefBase<TRow> | undefined,
  rangeFilter: RangeFilter,
  emptyLabel: string,
): string {
  const preset = matchingRangePreset(col, rangeFilter)
  if (preset) return preset.label
  const min = formatFilterValue(col, rangeFilter.min, emptyLabel)
  const max = formatFilterValue(col, rangeFilter.max, emptyLabel)
  if (min === '') return `≤ ${max}`
  if (max === '') return `≥ ${min}`
  return `${min}–${max}`
}

/**
 * A range filter input's value, placeholder and accessible name ("Salary Min"). A number input
 * stays empty until its bound is set, showing the data's bound through the column's `format` as
 * its placeholder ("$180,000"): a formatted value can't be typed back. A date input has no
 * placeholder, so it shows the bound as its value, which the browser formats.
 */
export function rangeInputProps<TRow extends object>(
  col: ColumnDefBase<TRow>,
  kind: 'min' | 'max',
  rangeFilter: RangeFilter | undefined,
  bounds: { min: number; max: number } | null,
  label: string,
): { value: string; placeholder: string | undefined; ariaLabel: string } {
  const isDate = col.type === 'date'
  const set = rangeFilter?.[kind]
  return {
    value: set ?? (isDate && bounds ? formatRangeBound(bounds[kind], col) : ''),
    placeholder: isDate
      ? undefined
      : bounds
        ? formatFilterValue(col, String(bounds[kind]), '')
        : label,
    ariaLabel: `${col.label} ${label}`,
  }
}

/**
 * The range slider's sorted thumb positions (empty `range` bounds fall back to `bounds`), `step`
 * (a day for dates, else `'any'`) and fill percentages; a zero-span `bounds` gives 0%.
 */
export function computeRangeSliderGeometry(
  range: RangeFilter | undefined,
  bounds: { min: number; max: number },
  isDate: boolean,
): { low: number; high: number; step: number | 'any'; pctLo: number; pctHi: number } {
  const toNum = isDate ? defaultParseDate : Number
  const rawLow = range?.min ? toNum(range.min) : bounds.min
  const rawHigh = range?.max ? toNum(range.max) : bounds.max
  const low = Math.min(rawLow, rawHigh)
  const high = Math.max(rawLow, rawHigh)
  const step = isDate ? 24 * 60 * 60 * 1000 : 'any'
  const span = bounds.max - bounds.min
  const pctLo = span ? ((low - bounds.min) / span) * 100 : 0
  const pctHi = span ? ((high - bounds.min) / span) * 100 : 0
  return { low, high, step, pctLo, pctHi }
}

/**
 * Narrows a date column's values to `range` (the date tree's `filterValuesBySearch`): values parse
 * with `parseDate`, the ISO bounds with the default parser; unparseable values drop once a bound
 * is set.
 */
export function filterValuesByRange(
  values: string[],
  range: RangeFilter | undefined,
  parseDate: (value: string) => number = defaultParseDate,
): string[] {
  if (!range || (range.min === '' && range.max === '')) return values
  const matches = inRange(range, true)
  return values.filter((v) => matches(parseDate(v)))
}

/**
 * Orders checklist values alphabetically or by facet count, ascending or descending (default
 * alpha asc). The column's `compare` replaces `localeCompare` in alpha mode (given `sort.dir`)
 * and in count mode's tie-break, which is always ascending.
 */
export function sortFilterValues(
  values: string[],
  counts: Map<string, number>,
  sort: ValueSort,
  compare: (a: string, b: string, dir: SortDir) => number = defaultCompare,
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

/** The sort button's next `ValueSort`: the date tree only flips direction, a checklist cycles. */
export function nextValueSort<TRow extends object>(
  col: ColumnDefBase<TRow>,
  sort: ValueSort,
): ValueSort {
  return col.type === 'date' ? { ...sort, dir: toggleSortDir(sort.dir) } : cycleValueSort(sort)
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
 * value is parsed with `parseDate` (default: `new Date(v)`, `YYYY-MM-DD` as local midnight);
 * values that don't parse are collected under a single `emptyLabel` leaf alongside the year nodes rather than silently
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
    const { y, m, day } = datePartsOf(new Date(t))
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

/**
 * Depth-based label for a date-tree node (see `computeDateTree`): year nodes (depth 0) and day
 * nodes (depth 2) render as plain (non-zero-padded) numbers, month nodes (depth 1) as a localized
 * long month name ("May", not "05"). A non-numeric key (the `emptyLabel` leaf for unparseable
 * values, which sits at depth 0) is left as its raw key rather than coerced through `Number`.
 */
export function formatDateTreeLabel(key: string, depth: number): string {
  if (depth === 1)
    return new Date(2000, Number(key) - 1, 1).toLocaleDateString(undefined, { month: 'long' })
  if ((depth === 0 || depth === 2) && /^\d+$/.test(key)) return String(Number(key))
  return key
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
 * Shift-click range over the date tree as a chronological interval spanning both nodes' values,
 * not rendered-row order (an expanded year row between two months isn't in range); unparseable
 * values are excluded.
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

/** `key`'s `defaultSortDir`, `'asc'` when unset or the column is missing. */
export function getDefaultSortDir<TRow extends object>(
  columns: ColumnDefBase<TRow>[],
  key: string,
): SortDir {
  return columns.find((c) => c.key === key)?.defaultSortDir ?? 'asc'
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
 * A plain header click: sort by `key` alone — cycling it when it's already the sole non-group
 * sort, else starting at `defaultDir` — keeping grouped columns' entries ahead of it. A grouped
 * `key` (`keepVisibleWhenGrouped`) cycles in place via `toggleSort` (docs/sorting.md,
 * docs/grouped-columns.md). With `dir`, applies exactly that direction instead of cycling.
 */
export function replaceSort(
  sorts: SortEntry[],
  key: string,
  defaultDir: SortDir = 'asc',
  groupBy: string[] = [],
  dir?: SortDir,
): SortEntry[] {
  if (groupBy.includes(key))
    return dir
      ? insertGroupSort(sorts, groupBy.slice(0, groupBy.indexOf(key)), key, dir).map((s) =>
          s.key === key ? { key, dir } : s,
        )
      : toggleSort(sorts, key, defaultDir)
  const groupSorts = sorts.filter((s) => groupBy.includes(s.key))
  const rest = sorts.filter((s) => !groupBy.includes(s.key))
  if (!dir && rest.length === 1 && rest[0].key === key)
    return [...groupSorts, ...toggleSort(rest, key, defaultDir)]
  return [...groupSorts, { key, dir: dir ?? defaultDir }]
}

/**
 * A shift-clicked header: append `key` at `defaultDir`, or flip it in place; never removes, so
 * its priority survives (docs/sorting.md).
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

/** `reorderColumn` for `SortEntry`s: moves `dragKey`'s entry before `targetKey`'s, or after it. */
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
 * Deselects all `values` for `key` if any is selected, else selects them all (Gmail-style, like
 * `toggleSelectAll`).
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
 * Sets `values` for `key` to `selected` regardless of prior state (shift-range in a checklist);
 * works on `filters` or `excludeFilters`.
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
 * Cycles a checklist value neutral → include → exclude → neutral; a value is never in both
 * `filters` and `excludeFilters` (docs/filter-dropdown.md).
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
 * A checklist's master checkbox: `toggleFilterAll`, also clearing `values` from `excludeFilters`
 * on select-all (a value is never in both sets).
 */
export function toggleAllFilterState(
  filters: Record<string, Set<string>>,
  excludeFilters: Record<string, Set<string>>,
  key: string,
  values: string[],
): { filters: Record<string, Set<string>>; excludeFilters: Record<string, Set<string>> } {
  const willSelectAll = !values.some((v) => filters[key]?.has(v))
  return {
    filters: toggleFilterAll(filters, key, values),
    excludeFilters: willSelectAll
      ? clearExcludeValues(excludeFilters, key, values)
      : excludeFilters,
  }
}

/** Removes `values` from `key`'s exclude set, after a batch include (never in both sets). */
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
 * `toggleFilterAll` for the checked-by-default model, where "checked" means absent from
 * `excludeFilters`.
 */
export function toggleExcludeAll(
  excludeFilters: Record<string, Set<string>>,
  key: string,
  values: string[],
): Record<string, Set<string>> {
  const someChecked = values.some((v) => !excludeFilters[key]?.has(v))
  return setFilterValues(excludeFilters, key, values, someChecked)
}

/** Sets a column's runtime any/all mode (`col.multiMode` only sets the default). */
export function setFilterMode(
  filterModes: Record<string, 'and' | 'or'>,
  key: string,
  mode: 'and' | 'or',
): Record<string, 'and' | 'or'> {
  return { ...filterModes, [key]: mode }
}

/** Whether `key` has a checklist include/exclude value or a set range. */
export function columnHasActiveFilter(
  key: string,
  filters: Record<string, Set<string>>,
  excludeFilters: Record<string, Set<string>>,
  rangeFilters: Record<string, RangeFilter>,
): boolean {
  const rf = rangeFilters[key]
  return (
    (filters[key]?.size ?? 0) > 0 ||
    (excludeFilters[key]?.size ?? 0) > 0 ||
    (rf !== undefined && (rf.min !== '' || rf.max !== ''))
  )
}

/**
 * The Filter dropdown's column keys, active-filter columns first, each half by label — a
 * snapshot taken on open, never live (docs/filter-dropdown.md).
 */
export function orderFilterColumnsByActive<TRow extends object>(
  columns: ColumnDefBase<TRow>[],
  filters: Record<string, Set<string>>,
  excludeFilters: Record<string, Set<string>>,
  rangeFilters: Record<string, RangeFilter>,
): string[] {
  const sorted = columns.slice().sort((a, b) => a.label.localeCompare(b.label))
  const isActive = (c: ColumnDefBase<TRow>) =>
    columnHasActiveFilter(c.key, filters, excludeFilters, rangeFilters)
  return [...sorted.filter(isActive), ...sorted.filter((c) => !isActive(c))].map((c) => c.key)
}

/**
 * Applies an `orderFilterColumnsByActive` snapshot; keys missing from it sort after, and `null`
 * (no snapshot yet) means alphabetical.
 */
export function applyColumnOrderSnapshot<TRow extends object>(
  columns: ColumnDefBase<TRow>[],
  orderKeys: string[] | null,
): ColumnDefBase<TRow>[] {
  if (!orderKeys) return columns.slice().sort((a, b) => a.label.localeCompare(b.label))
  const indexOf = (key: string) => {
    const i = orderKeys.indexOf(key)
    return i === -1 ? orderKeys.length : i
  }
  return columns.slice().sort((a, b) => {
    const diff = indexOf(a.key) - indexOf(b.key)
    return diff !== 0 ? diff : a.label.localeCompare(b.label)
  })
}

/**
 * The Filter dropdown's state when it opens: its column order snapshot, the column its pane shows
 * (`pickedKey` while still filterable, else the first column with an active filter, else the
 * first column) and the categories that start collapsed — those with no active filter, except
 * the shown column's, so a visible row always names the pane's column (U36).
 */
export function filterOpenState<TRow extends object>(
  columns: ColumnDefBase<TRow>[],
  filters: Record<string, Set<string>>,
  excludeFilters: Record<string, Set<string>>,
  rangeFilters: Record<string, RangeFilter>,
  pickedKey: string | null,
): { orderKeys: string[]; shownKey: string | null; collapsed: Set<string> } {
  const isActive = (c: ColumnDefBase<TRow>) =>
    columnHasActiveFilter(c.key, filters, excludeFilters, rangeFilters)
  const orderKeys = orderFilterColumnsByActive(columns, filters, excludeFilters, rangeFilters)
  const ordered = applyColumnOrderSnapshot(columns, orderKeys)
  const shown = columns.find((c) => c.key === pickedKey) ?? ordered.find(isActive) ?? columns[0]
  const collapsed = new Set(
    groupColumnsByCategory(columns)
      .categories.filter((cat) => cat.name !== shown?.category && !cat.columns.some(isActive))
      .map((cat) => cat.name),
  )
  return { orderKeys, shownKey: shown?.key ?? null, collapsed }
}

/** Whether any row holds an array for `col`: only then is an any/all toggle meaningful. */
export function isMultiValueColumn<TRow extends object>(
  data: TRow[],
  col: ColumnDefBase<TRow> | undefined,
  key: string,
): boolean {
  return data.some((row) => Array.isArray(resolveValue(col, row, key)))
}

const multiValueCache = new WeakMap<object[], Map<string, boolean>>()

/**
 * `isMultiValueColumn`, cached per data array and column key: its scan never short-circuits for a
 * scalar column, and filter panes are recreated per column, so revisiting one would rescan the
 * whole dataset. Date and number columns are never multi-value here.
 */
export function isMultiValueColumnCached<TRow extends object>(
  data: TRow[],
  col: ColumnDefBase<TRow>,
): boolean {
  if (col.type === 'date' || col.type === 'number') return false
  let byKey = multiValueCache.get(data)
  if (!byKey) multiValueCache.set(data, (byKey = new Map()))
  let cached = byKey.get(col.key)
  if (cached === undefined) {
    cached = isMultiValueColumn(data, col, col.key)
    byKey.set(col.key, cached)
  }
  return cached
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
// Selection is a `Set<TRow>` by identity; `getRowId` matches by id instead, so it survives a
// data refetch (docs/selection-and-row-click.md). Without it, every function below passes through.
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

/**
 * `selection.toggle(row, shiftKey?)`: with an `anchor`, shift range-selects over `processedData`
 * to the clicked row's new state; else toggles `row`. Adapters keep and update their own anchor.
 */
export function toggleSelectionShiftAware<TRow extends object>(
  selection: Set<TRow>,
  row: TRow,
  shiftKey: boolean | undefined,
  anchor: TRow | null,
  processedData: TRow[],
  getRowId?: GetRowId<TRow>,
): Set<TRow> {
  if (shiftKey && anchor) {
    const next = new Set(selection)
    const shouldSelect = !isRowSelected(next, row, getRowId)
    const range = selectRange(processedData, anchor, row)
    if (shouldSelect) range.forEach((r) => next.add(r))
    else range.forEach((r) => next.delete(r))
    return next
  }
  return toggleRowInSelection(selection, row, getRowId)
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

// Repoints `selection` at `nextData`'s rows by id and drops vanished ids; call on every data
// change. Returns `selection` itself without `getRowId`.
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

// Repoints one held row (shift anchor, focus target) at `nextData`'s row with its id; `null` once
// gone. Returns `row` itself without `getRowId`.
export function remapRow<TRow>(
  row: TRow | null,
  nextData: TRow[],
  getRowId?: GetRowId<TRow>,
): TRow | null {
  if (!getRowId || row === null) return row
  const id = getRowId(row)
  return nextData.find((r) => getRowId(r) === id) ?? null
}

// `remapRow` for the roving focus target; a group target keeps its key
export function remapFocusTarget<TRow extends object>(
  item: VisibleItem<TRow> | null,
  nextData: TRow[],
  getRowId?: GetRowId<TRow>,
): VisibleItem<TRow> | null {
  if (item?.kind !== 'row') return item
  const row = remapRow(item.row, nextData, getRowId)
  if (row === item.row) return item
  return row ? { ...item, row } : null
}

export function isSameRow<TRow>(
  a: TRow | null | undefined,
  b: TRow | null | undefined,
  getRowId?: GetRowId<TRow>,
): boolean {
  if (a == null || b == null) return false
  return a === b || (!!getRowId && getRowId(a) === getRowId(b))
}

// For the view's scroll-into-view effect: a new row target, not one a refetch only remapped
export function isNewRowFocusTarget<TRow extends object>(
  target: VisibleItem<TRow> | null,
  last: VisibleItem<TRow> | null,
  getRowId?: GetRowId<TRow>,
): target is { kind: 'row'; row: TRow; groupKey?: string | null } {
  if (target?.kind !== 'row' || target === last) return false
  return !(
    last?.kind === 'row' &&
    last.row !== target.row &&
    isSameRow(last.row, target.row, getRowId)
  )
}

export function toggleGroupBy(groupBy: string[], key: string): string[] {
  return groupBy.includes(key) ? groupBy.filter((k) => k !== key) : [...groupBy, key]
}

/**
 * For a column just added to `groupBy` (issue #17): inserts its sort entry, or moves an existing
 * one keeping its direction, after the `prevGroupBy` entries and before the rest. Call on add
 * only, with `groupBy` as it was before (docs/grouped-columns.md).
 */
export function insertGroupSort(
  sorts: SortEntry[],
  prevGroupBy: string[],
  key: string,
  dir: SortDir = 'asc',
): SortEntry[] {
  const existingDir = sorts.find((s) => s.key === key)?.dir
  const withoutKey = sorts.filter((s) => s.key !== key)
  const groupSorts = withoutKey.filter((s) => prevGroupBy.includes(s.key))
  const rest = withoutKey.filter((s) => !prevGroupBy.includes(s.key))
  return [...groupSorts, { key, dir: existingDir ?? dir }, ...rest]
}

/**
 * Reorders the `sorts` entries matching `groupBy` keys to follow `groupBy`, others untouched;
 * call after reordering `groupBy` so nesting and row order agree.
 */
export function reorderGroupSorts(sorts: SortEntry[], groupBy: string[]): SortEntry[] {
  const byKey = new Map(sorts.map((s) => [s.key, s]))
  const groupSorts = groupBy
    .map((key) => byKey.get(key))
    .filter((s): s is SortEntry => s !== undefined)
  const rest = sorts.filter((s) => !groupBy.includes(s.key))
  return [...groupSorts, ...rest]
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
 * Reconciles `visibleCols` against a replaced column list: kept columns keep their visibility,
 * new ones start visible (docs/table-state.md).
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

/** Moves `dragKey` before `targetKey` in `order`, or after it (to drop past the last one). */
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

/**
 * `moveColumnBy` for the Columns dropdown's Visible section: swaps `key` with its nearest visible
 * neighbor `delta` away, leaving hidden columns in place (docs/column-reordering.md).
 */
export function moveVisibleColumnBy(
  order: string[],
  visibleCols: ReadonlySet<string>,
  key: string,
  delta: number,
): string[] {
  const idx = order.indexOf(key)
  if (idx === -1) return order
  let neighborIdx = idx + delta
  while (neighborIdx >= 0 && neighborIdx < order.length && !visibleCols.has(order[neighborIdx]))
    neighborIdx += delta
  if (neighborIdx < 0 || neighborIdx >= order.length) return order
  const next = [...order]
  ;[next[idx], next[neighborIdx]] = [next[neighborIdx], next[idx]]
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

/** Result of `resolveFocusTarget` — everything `focus.moveTo` needs to bring a row into view. */
export interface FocusMoveResult<TRow> {
  /** The resolved row, as a `VisibleItem` — assign directly to `focusTarget`. */
  item: VisibleItem<TRow>
  /** The page containing `item`, given `collapsedGroups` below (not the caller's original one). */
  page: number
  /** `collapsedGroups` with every group `row` belongs to force-expanded, so `item` is reachable. */
  collapsedGroups: Set<string>
}

/**
 * What `focus.moveTo(row)` needs: every group holding `row` to expand, its page once expanded
 * and its `VisibleItem`; `null` when `row` isn't in `groups`.
 */
export function resolveFocusTarget<TRow extends object>(
  groups: GroupResult<TRow>[],
  row: TRow,
  collapsedGroups: Set<string>,
  defaultGroupsCollapsed: boolean,
  pageSize: number,
): FocusMoveResult<TRow> | null {
  let nextCollapsed = collapsedGroups
  for (const g of groups) {
    if (
      g.key !== null &&
      g.rows.includes(row) &&
      isGroupCollapsed(nextCollapsed, g.key, defaultGroupsCollapsed)
    ) {
      nextCollapsed = toggleCollapse(nextCollapsed, g.key)
    }
  }
  const items = getVisibleRows(groups, nextCollapsed, defaultGroupsCollapsed)
  const index = items.findIndex((item) => item.kind === 'row' && item.row === row)
  if (index === -1) return null
  const page = pageSize > 0 ? Math.floor(index / pageSize) + 1 : 1
  return { item: items[index], page, collapsedGroups: nextCollapsed }
}

export function getSortIcon(sorts: SortEntry[], key: string): string {
  const s = sorts.find((s) => s.key === key)
  return s ? (s.dir === 'asc' ? '↑' : '↓') : '↕'
}

export function getSortIndex(sorts: SortEntry[], key: string): number | null {
  const i = sorts.findIndex((s) => s.key === key)
  return i >= 0 ? i + 1 : null
}

/** Floors a finite number into `[min, max]`; `undefined` for anything else (e.g. `NaN`, a string). */
export function clampInt(v: unknown, min: number, max = Infinity): number | undefined {
  return typeof v === 'number' && Number.isFinite(v)
    ? Math.max(min, Math.min(Math.floor(v), max))
    : undefined
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
 * One page's occurrence of a group: `rows` is the whole group, `pageRows` the part of it rendered
 * on this page (`[]` when collapsed). `continued`: its header repeats one from an earlier page.
 */
export interface PagedGroup<TRow extends object> extends GroupResult<TRow> {
  continued: boolean
  pageRows: TRow[]
}

/**
 * Re-chunks one page's slice of `visibleItems` into per-group chunks, so header rows count toward
 * `pageSize`; a group resumed mid-group is `continued` (docs/pagination.md).
 */
export function paginateVisibleGroups<TRow extends object>(
  groupedFull: GroupResult<TRow>[],
  visibleItems: VisibleItem<TRow>[],
  page: number,
  pageSize: number,
): PagedGroup<TRow>[] {
  const groupsByKey = new Map(groupedFull.filter((g) => g.key !== null).map((g) => [g.key!, g]))
  const chunk = (key: string | null, continued: boolean): PagedGroup<TRow> => {
    const group = key !== null ? groupsByKey.get(key) : undefined
    const pageRows: TRow[] = []
    // an ungrouped chunk's rows are just this page's
    return {
      key,
      keyParts: group?.keyParts ?? [],
      rows: group?.rows ?? pageRows,
      continued,
      pageRows,
    }
  }

  const chunks: PagedGroup<TRow>[] = []
  let current: PagedGroup<TRow> | null = null
  for (const item of paginateData(visibleItems, page, pageSize)) {
    if (item.kind === 'group') {
      current = chunk(item.key, false)
      chunks.push(current)
    } else {
      const groupKey = item.groupKey ?? null
      if (current === null || current.key !== groupKey) {
        current = chunk(groupKey, groupKey !== null)
        chunks.push(current)
      }
      current.pageRows.push(item.row)
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

/** What a key press on a table-body row or group header does; see `planRowNav`. */
export type RowNavAction<TRow> =
  // `page`: only when the item is on another page. `extend`: Shift-extend the selection to it first.
  | { kind: 'focus'; item: VisibleItem<TRow>; page?: number; extend?: TRow }
  | { kind: 'toggleRow'; row: TRow }
  | { kind: 'toggleGroupSelection'; key: string }
  | { kind: 'toggleCollapse'; key: string }
  | { kind: 'rowClick'; row: TRow }

/**
 * Row keyboard nav (see docs/keyboard-navigation.md): the action for a key pressed on `target`, or
 * `null` when the table doesn't handle it, so the caller leaves it to the page (no `preventDefault`).
 */
export function planRowNav<TRow extends object>(
  e: { key: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean },
  target: VisibleItem<TRow>,
  ctx: {
    visibleItems: VisibleItem<TRow>[]
    navigableItems: VisibleItem<TRow>[]
    page: number
    numPages: number
    pageSize: number
    selectable: boolean
    rowClickable: boolean
  },
): RowNavAction<TRow> | null {
  switch (e.key) {
    case 'ArrowDown':
    case 'ArrowUp':
    case 'Home':
    case 'End': {
      const forward = e.key === 'ArrowDown' || e.key === 'End'
      const jump = e.key === 'Home' || e.key === 'End'
      let items = ctx.navigableItems
      let item = jump ? undefined : items[indexOfVisibleItem(items, target) + (forward ? 1 : -1)]
      let page = ctx.page
      // Ctrl/Cmd+Home/End: the first/last page; an arrow at the page's edge: the adjacent one
      if (jump && (e.ctrlKey || e.metaKey)) page = forward ? ctx.numPages : 1
      else if (!jump && !item) page += forward ? 1 : -1
      if (page !== ctx.page) {
        if (page < 1 || page > ctx.numPages) return null
        items = paginateVisibleItems(ctx.visibleItems, page, ctx.pageSize).filter(
          (i) => i.kind === 'group' || ctx.selectable || ctx.rowClickable,
        )
      }
      // A jump lands on the far end in its direction, a page crossing on the near end
      item ??= items[forward === jump ? items.length - 1 : 0]
      if (!item || (page === ctx.page && isSameVisibleItem(item, target))) return null
      return {
        kind: 'focus',
        item,
        page: page === ctx.page ? undefined : page,
        extend: e.shiftKey && ctx.selectable && item.kind === 'row' ? item.row : undefined,
      }
    }
    case ' ':
      if (!ctx.selectable) return null
      return target.kind === 'group'
        ? { kind: 'toggleGroupSelection', key: target.key }
        : { kind: 'toggleRow', row: target.row }
    case 'Enter':
      if (target.kind === 'group') return { kind: 'toggleCollapse', key: target.key }
      return ctx.rowClickable ? { kind: 'rowClick', row: target.row } : null
  }
  return null
}

/**
 * "Rows per page" options, always including `pageSize` (else the `<select>` shows the wrong one)
 * and `initialPageSize` (else a larger pick could hide the pager under the pointer, U27).
 */
export function pageSizeOptions(pageSize: number, initialPageSize: number): number[] {
  return [...new Set([10, 20, 50, 100, pageSize, initialPageSize])].sort((a, b) => a - b)
}

/** What the table's polite live region announces after a search, filter or page change (U31). */
export function tableStatus(
  labels: Pick<DataTableLabels, 'rowCount' | 'pageOf' | 'noRows' | 'noMatchingRows'>,
  shown: number,
  total: number,
  page: number,
  numPages: number,
): string {
  if (shown === 0) return total === 0 ? labels.noRows : labels.noMatchingRows
  const count = labels.rowCount(shown, total)
  return numPages > 1 ? `${count}, ${labels.pageOf(page, numPages)}` : count
}

/** Whether the pager is worth showing: the smallest of the (sorted) page sizes splits the items into pages */
export function showsPager(itemCount: number, pageSizeOptions: number[]): boolean {
  return itemCount > pageSizeOptions[0]
}

/**
 * Each row's searchable cells, formatted and normalized once, so a keystroke only runs a
 * substring check per row. Cells are joined with a NUL a query can't contain, so a match never
 * spans two cells.
 */
export function buildSearchIndex<TRow extends object>(
  data: TRow[],
  columns: ColumnDefBase<TRow>[],
): Map<TRow, string> {
  const cols = columns.filter((col) => col.searchable !== false)
  const index = new Map<TRow, string>()
  for (const row of data) {
    const cells = cols.map((col) => {
      const v = getColumnValue(col, row)
      return col.format ? col.format(v, row) : v != null ? String(v) : ''
    })
    index.set(row, normalizeForSearch(cells.join('\0')))
  }
  return index
}

/** Keeps the rows of `data` (any subset of the rows `index` was built from) matching `query`. */
export function searchData<TRow extends object>(
  data: TRow[],
  query: string,
  index: Map<TRow, string>,
): TRow[] {
  if (!query) return data
  const q = normalizeForSearch(query)
  return data.filter((row) => index.get(row)?.includes(q) ?? false)
}

export function computeAggregate<TRow extends object>(
  col: ColumnDefBase<TRow>,
  rows: TRow[],
): unknown {
  if (!col.aggregate) return undefined
  if (typeof col.aggregate === 'function') return col.aggregate(rows)
  if (col.aggregate === 'count') return rows.length
  const nums = rows.map((r) => toNumber(getColumnValue(col, r))).filter((n) => !isNaN(n))
  if (nums.length === 0) return undefined
  switch (col.aggregate) {
    case 'sum':
      return nums.reduce((a, b) => a + b, 0)
    case 'avg':
      return nums.reduce((a, b) => a + b, 0) / nums.length
    // reduce, not Math.min(...nums): spreading a large group overflows the call stack
    case 'min':
      return nums.reduce((a, b) => Math.min(a, b))
    case 'max':
      return nums.reduce((a, b) => Math.max(a, b))
  }
}

/** A group header's aggregate cell text: `''` when there's no value, else `aggregateFormat`, else `format`. */
export function formatAggregate<TRow extends object>(
  col: ColumnDefBase<TRow>,
  rows: TRow[],
): string {
  const v = computeAggregate(col, rows)
  if (v === undefined || v === null) return ''
  if (col.aggregateFormat) return col.aggregateFormat(v, rows)
  return col.format ? col.format(v, rows[0]) : String(v)
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
 * The mounted window of a fixed-row-height list, with `overscan` rows each side to avoid a blank
 * flash while scrolling; virtualizes the filter checklist.
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

/**
 * The `scrollTop` bringing `targetIndex` into `computeVirtualRange`'s window, or `null` when it's
 * already fully visible; for keyboard nav past the mounted window.
 */
export function getVirtualScrollTarget(
  scrollTop: number,
  viewportHeight: number,
  itemHeight: number,
  targetIndex: number,
): number | null {
  const rowTop = targetIndex * itemHeight
  let nextScrollTop = scrollTop
  if (rowTop < scrollTop) nextScrollTop = rowTop
  else if (rowTop + itemHeight > scrollTop + viewportHeight) {
    nextScrollTop = rowTop + itemHeight - viewportHeight
  }
  nextScrollTop = Math.max(0, nextScrollTop)
  return nextScrollTop !== scrollTop ? nextScrollTop : null
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
