import type { SortEntry, RangeFilter, ColumnDefBase } from './types'
import { getDefaultSortDir, insertGroupSort } from './logic'

/**
 * Serializable snapshot of table configuration — everything a user can change through the UI
 * except `selection`, which is tracked by object identity and isn't meaningful to persist or
 * share. All fields are optional so a partial view (e.g. just a sort) can be applied on top of
 * whatever defaults are already in place.
 */
export interface TableViewState {
  visibleCols?: string[]
  columnOrder?: string[]
  sorts?: SortEntry[]
  filters?: Record<string, string[]>
  /** "Not one of these values" filters for multi-value columns — see `cycleFilterValue`. */
  excludeFilters?: Record<string, string[]>
  /** Per-column runtime override of `col.multiMode` ("any"/"all" match) — see `setFilterMode`. */
  filterModes?: Record<string, 'and' | 'or'>
  rangeFilters?: Record<string, RangeFilter>
  groupBy?: string[]
  collapsedGroups?: string[]
  page?: number
  pageSize?: number
  searchQuery?: string
}

// Wire format: 1-letter keys and tuples instead of objects, with any field matching its
// natural "empty" value omitted entirely — most shared/persisted views differ from the
// defaults in only one or two fields, so this keeps the encoded string small.
type WireSort = [key: string, dirFlag: 0 | 1]
type WireFilter = [key: string, values: string[]]
type WireRange = [key: string, min: string, max: string]
type WireFilterMode = [key: string, andFlag: 0 | 1]

interface WireViewState {
  v?: string[]
  o?: string[]
  s?: WireSort[]
  f?: WireFilter[]
  x?: WireFilter[]
  m?: WireFilterMode[]
  r?: WireRange[]
  g?: string[]
  c?: string[]
  p?: number
  z?: number
  q?: string
}

function toWire(view: TableViewState): WireViewState {
  const wire: WireViewState = {}
  if (view.visibleCols?.length) wire.v = view.visibleCols
  if (view.columnOrder?.length) wire.o = view.columnOrder
  if (view.sorts?.length)
    wire.s = view.sorts.map((s): WireSort => [s.key, s.dir === 'desc' ? 1 : 0])

  const filterEntries = Object.entries(view.filters ?? {}).filter(([, vals]) => vals.length > 0)
  if (filterEntries.length) wire.f = filterEntries

  const excludeFilterEntries = Object.entries(view.excludeFilters ?? {}).filter(
    ([, vals]) => vals.length > 0,
  )
  if (excludeFilterEntries.length) wire.x = excludeFilterEntries

  const filterModeEntries = Object.entries(view.filterModes ?? {})
  if (filterModeEntries.length)
    wire.m = filterModeEntries.map(([key, mode]): WireFilterMode => [key, mode === 'and' ? 1 : 0])

  const rangeEntries = Object.entries(view.rangeFilters ?? {})
    .filter(([, r]) => r.min !== '' || r.max !== '')
    .map(([key, r]): WireRange => [key, r.min, r.max])
  if (rangeEntries.length) wire.r = rangeEntries

  if (view.groupBy?.length) wire.g = view.groupBy
  if (view.collapsedGroups?.length) wire.c = view.collapsedGroups
  if (view.page && view.page !== 1) wire.p = view.page
  if (view.pageSize) wire.z = view.pageSize
  if (view.searchQuery) wire.q = view.searchQuery
  return wire
}

function fromWire(wire: WireViewState): TableViewState {
  const view: TableViewState = {}
  if (wire.v) view.visibleCols = wire.v
  if (wire.o) view.columnOrder = wire.o
  if (wire.s) view.sorts = wire.s.map(([key, dirFlag]) => ({ key, dir: dirFlag ? 'desc' : 'asc' }))
  if (wire.f) view.filters = Object.fromEntries(wire.f)
  if (wire.x) view.excludeFilters = Object.fromEntries(wire.x)
  if (wire.m)
    view.filterModes = Object.fromEntries(wire.m.map(([key, flag]) => [key, flag ? 'and' : 'or']))
  if (wire.r)
    view.rangeFilters = Object.fromEntries(wire.r.map(([key, min, max]) => [key, { min, max }]))
  if (wire.g) view.groupBy = wire.g
  if (wire.c) view.collapsedGroups = wire.c
  if (wire.p) view.page = wire.p
  if (wire.z) view.pageSize = wire.z
  if (wire.q) view.searchQuery = wire.q
  return view
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// Hand-rolled UTF-8 <-> base64url instead of btoa/TextEncoder: core targets ES2020 with no DOM
// or Node lib, and must run identically in browsers, Node (SSR), and the vanilla adapter.
function utf8Encode(str: string): number[] {
  const bytes: number[] = []
  for (const ch of str) {
    const code = ch.codePointAt(0) as number
    if (code < 0x80) {
      bytes.push(code)
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      )
    }
  }
  return bytes
}

function utf8Decode(bytes: number[]): string {
  let str = ''
  let i = 0
  while (i < bytes.length) {
    const b0 = bytes[i]
    if (b0 < 0x80) {
      str += String.fromCodePoint(b0)
      i += 1
    } else if (b0 < 0xe0) {
      str += String.fromCodePoint(((b0 & 0x1f) << 6) | (bytes[i + 1] & 0x3f))
      i += 2
    } else if (b0 < 0xf0) {
      str += String.fromCodePoint(
        ((b0 & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f),
      )
      i += 3
    } else {
      str += String.fromCodePoint(
        ((b0 & 0x07) << 18) |
          ((bytes[i + 1] & 0x3f) << 12) |
          ((bytes[i + 2] & 0x3f) << 6) |
          (bytes[i + 3] & 0x3f),
      )
      i += 4
    }
  }
  return str
}

function bytesToBase64Url(bytes: number[]): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = bytes[i + 1]
    const b2 = bytes[i + 2]
    const triplet = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0)
    out += BASE64_CHARS[(triplet >> 18) & 0x3f]
    out += BASE64_CHARS[(triplet >> 12) & 0x3f]
    out += b1 !== undefined ? BASE64_CHARS[(triplet >> 6) & 0x3f] : ''
    out += b2 !== undefined ? BASE64_CHARS[triplet & 0x3f] : ''
  }
  return out.replace(/\+/g, '-').replace(/\//g, '_')
}

function base64UrlToBytes(encoded: string): number[] {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const bytes: number[] = []
  for (let i = 0; i < b64.length; i += 4) {
    const c0 = BASE64_CHARS.indexOf(b64[i])
    const c1 = BASE64_CHARS.indexOf(b64[i + 1])
    const c2 = i + 2 < b64.length ? BASE64_CHARS.indexOf(b64[i + 2]) : -1
    const c3 = i + 3 < b64.length ? BASE64_CHARS.indexOf(b64[i + 3]) : -1
    if (c0 < 0 || c1 < 0) throw new Error('Invalid base64url input')
    const triplet = (c0 << 18) | (c1 << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f)
    bytes.push((triplet >> 16) & 0xff)
    if (c2 >= 0) bytes.push((triplet >> 8) & 0xff)
    if (c3 >= 0) bytes.push(triplet & 0xff)
  }
  return bytes
}

/** Serializes a view to a compact, URL-safe string (base64url of a shortened JSON shape). */
export function encodeViewState(view: TableViewState): string {
  return bytesToBase64Url(utf8Encode(JSON.stringify(toWire(view))))
}

/**
 * Parses a string produced by `encodeViewState` back into a `TableViewState`. Returns
 * `undefined` instead of throwing on malformed input (e.g. a hand-edited or stale URL).
 */
export function decodeViewState(encoded: string): TableViewState | undefined {
  try {
    return fromWire(JSON.parse(utf8Decode(base64UrlToBytes(encoded))) as WireViewState)
  } catch {
    return undefined
  }
}

// --- Equality helpers for buildViewStateSnapshot's "omit if it matches what a reset would
// restore" checks below. All order-sensitive except the Set-based ones (visibleCols/
// collapsedGroups/filter value lists have no meaningful order of their own).

function sameStringArray(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function sameStringSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

function sameSorts(a: SortEntry[], b: SortEntry[]): boolean {
  return a.length === b.length && a.every((s, i) => s.key === b[i].key && s.dir === b[i].dir)
}

function sameRecord<T>(a: Record<string, T>, b: Record<string, T>, eq: (x: T, y: T) => boolean) {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  return aKeys.length === bKeys.length && aKeys.every((k) => k in b && eq(a[k], b[k]))
}

function sameFilterMap(a: Record<string, Set<string>>, b: Record<string, Set<string>>): boolean {
  const nonEmpty = (m: Record<string, Set<string>>) =>
    Object.fromEntries(Object.entries(m).filter(([, v]) => v.size > 0))
  return sameRecord(nonEmpty(a), nonEmpty(b), sameStringSet)
}

function sameRangeMap(a: Record<string, RangeFilter>, b: Record<string, RangeFilter>): boolean {
  const nonEmpty = (m: Record<string, RangeFilter>) =>
    Object.fromEntries(Object.entries(m).filter(([, r]) => r.min !== '' || r.max !== ''))
  return sameRecord(nonEmpty(a), nonEmpty(b), (x, y) => x.min === y.min && x.max === y.max)
}

/** The bag of current plain state values `buildViewStateSnapshot` reads `getViewState()` from. */
export interface ViewStateSnapshotInput<TRow extends object = Record<string, unknown>> {
  visibleCols: Set<string>
  columnOrder: string[]
  sorts: SortEntry[]
  filters: Record<string, Set<string>>
  excludeFilters: Record<string, Set<string>>
  filterModes: Record<string, 'and' | 'or'>
  rangeFilters: Record<string, RangeFilter>
  groupBy: string[]
  collapsedGroups: Set<string>
  page: number
  pageSize: number
  searchQuery: string
  columns: ColumnDefBase<TRow>[]
  /** Construction-time defaults — see `resolveViewState`. */
  initialViewState?: TableViewState
}

/**
 * Builds a `TableViewState` snapshot from a bag of current plain state values, omitting any
 * field that's already back at what a reset would restore it to — shared by every adapter's
 * `getViewState()`. Reuses `resolveViewState({}, columns, initialViewState)` to compute that
 * "reset-to" bag rather than re-deriving each field's default independently, so a field showing
 * up here always means "differs from what `resetView` would produce", never a second, subtly
 * different notion of default.
 */
export function buildViewStateSnapshot<TRow extends object = Record<string, unknown>>(
  input: ViewStateSnapshotInput<TRow>,
): TableViewState {
  const {
    visibleCols,
    columnOrder,
    sorts,
    filters,
    excludeFilters,
    filterModes,
    rangeFilters,
    groupBy,
    collapsedGroups,
    page,
    pageSize,
    searchQuery,
    columns,
    initialViewState,
  } = input
  const def = resolveViewState({}, columns, initialViewState)
  const view: TableViewState = {}
  if (!sameStringSet(visibleCols, def.visibleCols)) view.visibleCols = [...visibleCols]
  if (!sameStringArray(columnOrder, def.columnOrder)) view.columnOrder = columnOrder
  if (!sameSorts(sorts, def.sorts)) view.sorts = sorts
  if (!sameFilterMap(filters, def.filters))
    view.filters = Object.fromEntries(
      Object.entries(filters)
        .filter(([, v]) => v.size > 0)
        .map(([k, v]) => [k, [...v]]),
    )
  if (!sameFilterMap(excludeFilters, def.excludeFilters))
    view.excludeFilters = Object.fromEntries(
      Object.entries(excludeFilters)
        .filter(([, v]) => v.size > 0)
        .map(([k, v]) => [k, [...v]]),
    )
  if (!sameRecord(filterModes, def.filterModes, (x, y) => x === y)) view.filterModes = filterModes
  if (!sameRangeMap(rangeFilters, def.rangeFilters))
    view.rangeFilters = Object.fromEntries(
      Object.entries(rangeFilters).filter(([, r]) => r.min !== '' || r.max !== ''),
    )
  if (!sameStringArray(groupBy, def.groupBy)) view.groupBy = groupBy
  if (!sameStringSet(collapsedGroups, def.collapsedGroups))
    view.collapsedGroups = [...collapsedGroups]
  if (page !== def.page) view.page = page
  if (pageSize !== def.pageSize) view.pageSize = pageSize
  if (searchQuery !== def.searchQuery) view.searchQuery = searchQuery
  return view
}

/** The fully-defaulted plain values `resolveViewState` produces for `setViewState(view)` to apply. */
export interface ResolvedViewState {
  visibleCols: Set<string>
  columnOrder: string[]
  sorts: SortEntry[]
  filters: Record<string, Set<string>>
  excludeFilters: Record<string, Set<string>>
  filterModes: Record<string, 'and' | 'or'>
  rangeFilters: Record<string, RangeFilter>
  groupBy: string[]
  collapsedGroups: Set<string>
  page: number
  pageSize: number
  searchQuery: string
}

function toSetMap(m: Record<string, string[]>): Record<string, Set<string>> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, new Set(v)]))
}

/**
 * Applies the same "grouping a column inserts a matching sort entry, ahead of whatever else is
 * grouped, unless one already exists" invariant interactive `group.toggle` maintains (see
 * `insertGroupSort`) — for the specific case that motivated this: `groupBy` resolved from
 * `initialViewState` (construction, `resetView`, or a `setViewState(view)` call that leaves
 * `view.groupBy` unset) rather than from an explicit `view.groupBy`. Deliberately scoped this
 * way rather than run unconditionally on every `resolveViewState` call: a caller that explicitly
 * passes `view.groupBy` (restoring a stored/shared view, say) already gets whatever `sorts` that
 * same view specifies — or deliberately none — and forcing a sync there would silently insert an
 * entry the caller never asked for and the pre-existing `setViewState` contract never promised.
 * Idempotent — already-consistent input comes back with the same effective order.
 */
function syncGroupSorts<TRow extends object>(
  sorts: SortEntry[],
  groupBy: string[],
  columns: ColumnDefBase<TRow>[],
): SortEntry[] {
  let result = sorts
  const seenGroupBy: string[] = []
  for (const key of groupBy) {
    result = insertGroupSort(result, seenGroupBy, key, getDefaultSortDir(columns, key))
    seenGroupBy.push(key)
  }
  return result
}

/**
 * Resolves a partial `TableViewState` (as passed to `setViewState`) plus the current `columns`
 * and optional construction-time `initialViewState` into the fully-defaulted plain values each
 * adapter writes back into its own state — shared by every adapter's `setViewState(view)`, and
 * (via `resolveViewState({}, columns, initialViewState)`) by `buildViewStateSnapshot` above and
 * by `resetView`/construction-time seeding, since both are just "apply an empty/absent view".
 * Any field `view` omits falls back to `initialViewState`'s own value for it, then to that
 * field's ordinary empty default — so `initialViewState` is simultaneously "what a fresh table
 * starts at" and "what a reset restores". `groupBy` falling back this way also gets `sorts`
 * synced via `syncGroupSorts` (see its own doc comment) — an explicit `view.groupBy` does not.
 */
export function resolveViewState<TRow extends object = Record<string, unknown>>(
  view: TableViewState,
  columns: ColumnDefBase<TRow>[],
  initialViewState?: TableViewState,
): ResolvedViewState {
  const validInitialVisible = initialViewState?.visibleCols?.filter((k) =>
    columns.some((c) => c.key === k),
  )
  const defaultVisible = validInitialVisible?.length
    ? validInitialVisible
    : columns.map((c) => c.key)
  const validVisible = view.visibleCols?.filter((k) => columns.some((c) => c.key === k))
  const visibleCols = validVisible?.length ? new Set(validVisible) : new Set(defaultVisible)
  const columnOrder = (view.columnOrder ?? initialViewState?.columnOrder ?? []).filter((k) =>
    columns.some((c) => c.key === k),
  )
  const groupBy = view.groupBy ?? initialViewState?.groupBy ?? []
  const rawSorts = view.sorts ?? initialViewState?.sorts ?? []
  const sorts = view.groupBy === undefined ? syncGroupSorts(rawSorts, groupBy, columns) : rawSorts
  const filters = toSetMap(view.filters ?? initialViewState?.filters ?? {})
  const excludeFilters = toSetMap(view.excludeFilters ?? initialViewState?.excludeFilters ?? {})
  const filterModes = view.filterModes ?? initialViewState?.filterModes ?? {}
  const rangeFilters = view.rangeFilters ?? initialViewState?.rangeFilters ?? {}
  const collapsedGroups = new Set(view.collapsedGroups ?? initialViewState?.collapsedGroups ?? [])
  const page = view.page ?? initialViewState?.page ?? 1
  const pageSize = view.pageSize ?? initialViewState?.pageSize ?? 0
  const searchQuery = view.searchQuery ?? initialViewState?.searchQuery ?? ''
  return {
    visibleCols,
    columnOrder,
    sorts,
    filters,
    excludeFilters,
    filterModes,
    rangeFilters,
    groupBy,
    collapsedGroups,
    page,
    pageSize,
    searchQuery,
  }
}
