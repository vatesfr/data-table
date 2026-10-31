// Browser-only; the file-scoped DOM lib keeps "dom" out of the package's `lib`.
/// <reference lib="dom" />

import { encodeViewState, decodeViewState, type TableViewState } from './view'

// Storage and URL helpers behind every adapter's persistence (docs/view-persistence.md); the reactive glue stays per adapter.

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
 * Saves `view` to `localStorage`, removing the key for an empty (default) view so a reset isn't
 * undone by the next save. No-ops when `storageKey` is `undefined`.
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
 * Reads and decodes a view from `paramName` in the query string; `undefined` when absent or
 * malformed, so a plain reload keeps the storage-restored view.
 */
export function readViewFromUrlParam(paramName: string): TableViewState | undefined {
  const encoded = new URLSearchParams(window.location.search).get(paramName)
  if (!encoded) return undefined
  return decodeViewState(encoded)
}

/**
 * Writes `view` to `paramName` with `replaceState` (no history entry per change), deleting the
 * param for an empty (default) view.
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
