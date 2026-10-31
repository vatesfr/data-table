// `TextEncoder`/`btoa` are in browsers and Node; the DOM lib types them without adding "dom" to the
// whole package. `preserve` keeps the reference in the emitted `.d.ts` (see docs/pitfalls.md).
/// <reference lib="dom" preserve="true" />

import type { SortEntry, RangeFilter, ColumnDefBase } from './types'
import { clampInt, getDefaultSortDir, insertGroupSort } from './logic'

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

function toBase64Url(str: string): string {
  let bin = ''
  // A byte loop: spreading a large view's bytes into `String.fromCharCode` overflows the stack.
  for (const byte of new TextEncoder().encode(str)) bin += String.fromCharCode(byte)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(encoded: string): string {
  const bin = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

/** Serializes a view to a compact, URL-safe string (base64url of a shortened JSON shape). */
export function encodeViewState(view: TableViewState): string {
  return toBase64Url(JSON.stringify(toWire(view)))
}

/**
 * Parses a string produced by `encodeViewState` back into a `TableViewState`. Returns
 * `undefined` instead of throwing on malformed input (e.g. a hand-edited or stale URL).
 */
export function decodeViewState(encoded: string): TableViewState | undefined {
  try {
    return fromWire(JSON.parse(fromBase64Url(encoded)) as WireViewState)
  } catch {
    return undefined
  }
}

// Equality helpers for buildViewStateSnapshot's "matches what a reset restores" checks

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
export interface ViewStateSnapshotInput<
  TRow extends object = Record<string, unknown>,
> extends ResolvedViewState {
  columns: ColumnDefBase<TRow>[]
  /** Construction-time defaults — see `resolveViewState`. */
  initialViewState?: TableViewState
}

/**
 * `getViewState()`'s snapshot, omitting every field at what `resetView` would restore (computed
 * by `resolveViewState({}, …)`, so both share one notion of default).
 */
export function buildViewStateSnapshot<TRow extends object = Record<string, unknown>>(
  input: ViewStateSnapshotInput<TRow>,
): TableViewState {
  const def = resolveViewState({}, input.columns, input.initialViewState)
  const view: TableViewState = {}
  if (!sameStringSet(input.visibleCols, def.visibleCols)) view.visibleCols = [...input.visibleCols]
  if (!sameStringArray(input.columnOrder, def.columnOrder)) view.columnOrder = input.columnOrder
  if (!sameSorts(input.sorts, def.sorts)) view.sorts = input.sorts
  if (!sameFilterMap(input.filters, def.filters))
    view.filters = Object.fromEntries(
      Object.entries(input.filters)
        .filter(([, v]) => v.size > 0)
        .map(([k, v]) => [k, [...v]]),
    )
  if (!sameFilterMap(input.excludeFilters, def.excludeFilters))
    view.excludeFilters = Object.fromEntries(
      Object.entries(input.excludeFilters)
        .filter(([, v]) => v.size > 0)
        .map(([k, v]) => [k, [...v]]),
    )
  if (!sameRecord(input.filterModes, def.filterModes, (x, y) => x === y))
    view.filterModes = input.filterModes
  if (!sameRangeMap(input.rangeFilters, def.rangeFilters))
    view.rangeFilters = Object.fromEntries(
      Object.entries(input.rangeFilters).filter(([, r]) => r.min !== '' || r.max !== ''),
    )
  if (!sameStringArray(input.groupBy, def.groupBy)) view.groupBy = input.groupBy
  if (!sameStringSet(input.collapsedGroups, def.collapsedGroups))
    view.collapsedGroups = [...input.collapsedGroups]
  if (input.page !== def.page) view.page = input.page
  if (input.pageSize !== def.pageSize) view.pageSize = input.pageSize
  if (input.searchQuery !== def.searchQuery) view.searchQuery = input.searchQuery
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

function toSetMap(m: Record<string, unknown[]> = {}): Record<string, Set<string>> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, new Set(v.filter(isStr))]))
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const strs = (v: unknown) => (Array.isArray(v) ? v.filter(isStr) : undefined)
const sortList = (v: unknown) =>
  Array.isArray(v)
    ? v.filter(
        (s): s is SortEntry => isObj(s) && isStr(s.key) && (s.dir === 'asc' || s.dir === 'desc'),
      )
    : undefined
/** Keeps the entries of record `v` that pass `ok`. */
const entries =
  <T>(ok: (x: unknown) => x is T) =>
  (v: unknown) =>
    isObj(v)
      ? (Object.fromEntries(Object.entries(v).filter(([, x]) => ok(x))) as Record<string, T>)
      : undefined

/**
 * Inserts each grouped column's sort entry, as `group.toggle` does (`insertGroupSort`). Only for a
 * `groupBy` taken from `initialViewState`: an explicit `view.groupBy` keeps its own `sorts`.
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
 * Resolves a partial `TableViewState` into every adapter's fully-defaulted state values: an
 * omitted field falls back to `initialViewState`'s, then to its empty default, so construction,
 * `resetView` and `getViewState` all resolve `{}`. A fallback `groupBy` also syncs `sorts`.
 */
export function resolveViewState<TRow extends object = Record<string, unknown>>(
  view: TableViewState,
  columns: ColumnDefBase<TRow>[],
  initialViewState?: TableViewState,
): ResolvedViewState {
  // Untyped sources (hand-edited URL, stale storage, plain JS) can break the types: a wrongly
  // typed field or entry acts as omitted instead of throwing (#44).
  const v: Obj = isObj(view) ? view : {}
  const i: Obj = isObj(initialViewState) ? initialViewState : {}
  const get = <T>(k: keyof TableViewState, f: (x: unknown) => T | undefined) => f(v[k]) ?? f(i[k])
  const known = (x: unknown) => strs(x)?.filter((k) => columns.some((c) => c.key === k))
  const visibleCols = new Set(
    [known(v.visibleCols), known(i.visibleCols), columns.map((c) => c.key)].find((a) => a?.length),
  )
  const columnOrder = get('columnOrder', known) ?? []
  const groupBy = get('groupBy', strs) ?? []
  const rawSorts = get('sorts', sortList) ?? []
  const sorts = strs(v.groupBy) ? rawSorts : syncGroupSorts(rawSorts, groupBy, columns)
  const filters = toSetMap(get('filters', entries(Array.isArray)))
  const excludeFilters = toSetMap(get('excludeFilters', entries(Array.isArray)))
  const filterModes =
    get(
      'filterModes',
      entries((m): m is 'and' | 'or' => m === 'and' || m === 'or'),
    ) ?? {}
  const rangeFilters =
    get(
      'rangeFilters',
      entries((r): r is RangeFilter => isObj(r) && isStr(r.min) && isStr(r.max)),
    ) ?? {}
  const collapsedGroups = new Set(get('collapsedGroups', strs))
  const page = get('page', (x) => clampInt(x, 1)) ?? 1
  const pageSize = get('pageSize', (x) => clampInt(x, 0)) ?? 0
  const searchQuery = get('searchQuery', (x) => (isStr(x) ? x : undefined)) ?? ''
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
