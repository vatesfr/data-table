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
    localStorage.setItem(storageKey, encodeViewState(view))
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
