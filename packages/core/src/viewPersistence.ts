// This file's own functions only ever run in a browser (as with every adapter's persistence
// helpers this replaces) — the rest of `packages/core` targets a DOM-free `lib` (see `view.ts`'s
// hand-rolled base64url) so it can also run in Node/SSR, but that constraint doesn't apply here.
// A file-scoped `lib="dom"` reference pulls in just the ambient types this file needs
// (`localStorage`, `URLSearchParams`, `window`) without adding "dom" to the whole package's
// `tsconfig.json` `lib` array.
/// <reference lib="dom" />

import { encodeViewState, decodeViewState, type TableViewState } from './view'

// Framework-agnostic building blocks shared by every adapter's own `persistence.ts`
// (react/vue/solid's `usePersistedView`/`useUrlView`/`usePersistence`, vanilla's
// `persistViewToLocalStorage`/`syncViewToUrl`/`persistView`) — see CLAUDE.md's "View persistence".
// These only ever touch `TableViewState`/`localStorage`/`URLSearchParams`/`window.history`; the
// reactive glue (effects, watchers, `popstate` subscriptions) stays adapter-local since it's tied
// to each framework's own lifecycle, not something a pure function can express.

export interface ViewStateApi {
  getViewState(): TableViewState
  setViewState(view: TableViewState): void
}

/**
 * Reads a persisted view from `localStorage`, decoding it if present. Returns `undefined` when
 * `storageKey` is `undefined` (no-op, for callers that make storage persistence optional) or when
 * nothing is stored yet.
 */
export function loadViewFromStorage(storageKey: string | undefined): TableViewState | undefined {
  if (!storageKey) return undefined
  const stored = localStorage.getItem(storageKey)
  return stored ? decodeViewState(stored) : undefined
}

/**
 * Saves `view` to `localStorage`, or removes the key entirely when `view` is back at its
 * construction-time defaults (empty object) — rather than storing an encoded-but-empty blob, so
 * `resetView`'s own `removeItem` (or a plain "clear all" that lands back on the defaults) isn't
 * immediately undone by the next save. No-ops when `storageKey` is `undefined`.
 */
export function saveOrClearViewInStorage(
  storageKey: string | undefined,
  view: TableViewState,
): void {
  if (!storageKey) return
  if (Object.keys(view).length === 0) localStorage.removeItem(storageKey)
  else localStorage.setItem(storageKey, encodeViewState(view))
}

/**
 * Reads and decodes a view from the given query string parameter in `window.location.search`.
 * Returns `undefined` when the param is absent or fails to decode — an absent/malformed param
 * leaves whatever state is already there alone, rather than forcing a reset to defaults (this
 * matters when composing with storage persistence: a plain reload with no URL param should keep
 * the localStorage-restored view, not clobber it with an empty one).
 */
export function readViewFromUrlParam(paramName: string): TableViewState | undefined {
  const encoded = new URLSearchParams(window.location.search).get(paramName)
  if (!encoded) return undefined
  return decodeViewState(encoded)
}

/**
 * Writes `view` to the given query string parameter via `history.replaceState` (not `pushState`,
 * so per-change tweaks don't spam browser history), or deletes the param entirely when `view` is
 * back at its construction-time defaults (empty object) — mirroring
 * `saveOrClearViewInStorage`'s own empty-view handling.
 */
export function writeViewToUrlParam(paramName: string, view: TableViewState): void {
  const params = new URLSearchParams(window.location.search)
  if (Object.keys(view).length === 0) params.delete(paramName)
  else params.set(paramName, encodeViewState(view))
  const query = params.toString()
  const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
  window.history.replaceState(null, '', url)
}

export interface ResetViewOptions {
  /** localStorage key used for this table's persisted view, if any. */
  storageKey?: string
  /** Query string parameter name used for this table's persisted view. Default: 'view'. */
  paramName?: string
}

/**
 * Resets a table to its construction-time defaults and clears whatever was persisted for it in
 * `localStorage`/the URL — pass the same `storageKey`/`paramName` used for that persistence (both
 * optional, since a consumer may use only one, or neither).
 */
export function resetView(table: ViewStateApi, options?: ResetViewOptions): void {
  table.setViewState({})
  if (options?.storageKey) localStorage.removeItem(options.storageKey)
  writeViewToUrlParam(options?.paramName ?? 'view', {})
}
