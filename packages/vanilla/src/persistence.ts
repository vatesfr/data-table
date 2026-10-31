import {
  loadViewFromStorage,
  saveOrClearViewInStorage,
  readViewFromUrlParam,
  writeViewToUrlParam,
  resetView as resetViewCore,
  type ViewStateApi as CoreViewStateApi,
  type ResetViewOptions,
} from '@vates/data-table-core/internal'
import type { TableViewState } from '@vates/data-table-core'

export interface ViewStateApi extends CoreViewStateApi {
  onViewChange(cb: (view: TableViewState) => void): () => void
}

export type { ResetViewOptions }

/**
 * Loads a persisted view from `localStorage` and saves it back on every subsequent change.
 * `table` is the instance returned by `createDataTable`. Returns an unsubscribe function —
 * call it alongside `table.destroy()`.
 */
export function persistViewToLocalStorage(table: ViewStateApi, storageKey: string): () => void {
  const view = loadViewFromStorage(storageKey)
  if (view) table.setViewState(view)

  return table.onViewChange((view) => {
    saveOrClearViewInStorage(storageKey, view)
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

  // An absent or malformed param keeps the current (e.g. storage-restored) view
  function applyFromUrl(): void {
    const view = readViewFromUrlParam(paramName)
    if (view) table.setViewState(view)
  }

  applyFromUrl()
  window.addEventListener('popstate', applyFromUrl)

  const unsubscribe = table.onViewChange((view) => {
    writeViewToUrlParam(paramName, view)
  })

  return () => {
    window.removeEventListener('popstate', applyFromUrl)
    unsubscribe()
  }
}

/**
 * Resets a table to its construction-time defaults and clears what
 * `persistViewToLocalStorage`/`syncViewToUrl` stored, given the same `storageKey`/`paramName`.
 */
export function resetView(table: ViewStateApi, options?: ResetViewOptions): void {
  resetViewCore(table, options)
}

export type PersistViewOptions = ResetViewOptions

/**
 * `persistViewToLocalStorage` + `syncViewToUrl` sharing one `storageKey`/`paramName`, plus a
 * `reset()` bound to them and an `unsubscribe()` to call alongside `table.destroy()`.
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
