import { encodeViewState, decodeViewState, type TableViewState } from '@vates/data-table-core'

export interface ViewStateApi {
  getViewState(): TableViewState
  setViewState(view: TableViewState): void
  onViewChange(cb: (view: TableViewState) => void): () => void
}

/**
 * Loads a persisted view from `localStorage` and saves it back on every subsequent change.
 * `table` is the instance returned by `createDataTable`. Returns an unsubscribe function —
 * call it alongside `table.destroy()`.
 */
export function persistViewToLocalStorage(table: ViewStateApi, storageKey: string): () => void {
  const stored = localStorage.getItem(storageKey)
  const view = stored ? decodeViewState(stored) : undefined
  if (view) table.setViewState(view)

  return table.onViewChange((view) => {
    // Mirrors syncViewToUrl's own empty-view handling below: a view back at its construction-time
    // defaults removes the key entirely rather than storing an encoded-but-empty blob, so
    // `resetView`'s own `removeItem` (or a plain "clear all" that lands back on the defaults)
    // isn't immediately undone by this listener's next fire.
    if (Object.keys(view).length === 0) localStorage.removeItem(storageKey)
    else localStorage.setItem(storageKey, encodeViewState(view))
  })
}

export interface SyncViewToUrlOptions {
  /** Query string parameter name that holds the encoded view. Default: 'view'. */
  paramName?: string
}

/**
 * Keeps a view in sync with the current URL's query string: loads it immediately and on
 * back/forward navigation, and writes it back (via `history.replaceState`) on every change.
 * Returns an unsubscribe function — call it alongside `table.destroy()`.
 */
export function syncViewToUrl(table: ViewStateApi, options?: SyncViewToUrlOptions): () => void {
  const paramName = options?.paramName ?? 'view'

  // Only acts when the param is actually present — an absent (or malformed) param leaves
  // whatever state is already there alone, rather than forcing a reset to defaults. This
  // matters when combined with persistViewToLocalStorage: a plain reload with no `view` param
  // should keep the localStorage-restored view, not clobber it with an empty one.
  function applyFromUrl(): void {
    const encoded = new URLSearchParams(window.location.search).get(paramName)
    if (!encoded) return
    const view = decodeViewState(encoded)
    if (view) table.setViewState(view)
  }

  applyFromUrl()
  window.addEventListener('popstate', applyFromUrl)

  const unsubscribe = table.onViewChange((view) => {
    const params = new URLSearchParams(window.location.search)
    if (Object.keys(view).length === 0) params.delete(paramName)
    else params.set(paramName, encodeViewState(view))
    const query = params.toString()
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    window.history.replaceState(null, '', url)
  })

  return () => {
    window.removeEventListener('popstate', applyFromUrl)
    unsubscribe()
  }
}

export interface ResetViewOptions {
  /** localStorage key passed to `persistViewToLocalStorage` for this table, if any. */
  storageKey?: string
  /** Query string parameter name passed to `syncViewToUrl` for this table. Default: 'view'. */
  paramName?: string
}

/**
 * Resets a table to its construction-time defaults and clears whatever
 * `persistViewToLocalStorage`/`syncViewToUrl` persisted for it — pass the same
 * `storageKey`/`paramName` you gave those functions (both optional, since a consumer may use
 * only one, or neither).
 */
export function resetView(table: ViewStateApi, options?: ResetViewOptions): void {
  table.setViewState({})
  if (options?.storageKey) localStorage.removeItem(options.storageKey)
  const paramName = options?.paramName ?? 'view'
  const params = new URLSearchParams(window.location.search)
  if (params.has(paramName)) {
    params.delete(paramName)
    const query = params.toString()
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    window.history.replaceState(null, '', url)
  }
}

export type PersistViewOptions = ResetViewOptions

/**
 * Combines `persistViewToLocalStorage` + `syncViewToUrl` behind one options object, so
 * `storageKey`/`paramName` are written down once instead of separately at three call sites
 * (`persistViewToLocalStorage`, `syncViewToUrl`, and `resetView` all need the *same* values — a
 * typo'd/forgotten key at any one of them is a silent bug). Returns a `reset()` bound to those
 * same options (equivalent to calling `resetView(table, options)` yourself) alongside a combined
 * `unsubscribe()` — call it alongside `table.destroy()`, same as the two functions it wraps.
 */
export function persistView(
  table: ViewStateApi,
  options: PersistViewOptions = {},
): { reset: () => void; unsubscribe: () => void } {
  const unsubscribes: Array<() => void> = []
  if (options.storageKey) unsubscribes.push(persistViewToLocalStorage(table, options.storageKey))
  unsubscribes.push(syncViewToUrl(table, { paramName: options.paramName }))
  return {
    reset: () => resetView(table, options),
    unsubscribe: () => unsubscribes.forEach((unsubscribe) => unsubscribe()),
  }
}
