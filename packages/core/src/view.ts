import type { SortEntry, RangeFilter } from './types'

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

interface WireViewState {
  v?: string[]
  o?: string[]
  s?: WireSort[]
  f?: WireFilter[]
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
