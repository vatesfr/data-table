import { createEffect, on, onCleanup } from 'solid-js'
import {
  loadViewFromStorage,
  saveOrClearViewInStorage,
  readViewFromUrlParam,
  writeViewToUrlParam,
  resetView as resetViewCore,
  type ViewStateApi,
  type ResetViewOptions,
} from '@vates/data-table-core/internal'

// React/Vue's persistence hooks for Solid, same names for cross-adapter consistency (docs/view-persistence.md)

export type { ViewStateApi, ResetViewOptions }

/**
 * Loads a persisted view from `localStorage` once and saves it back on every later change. An
 * `undefined` `storageKey` no-ops.
 */
export function usePersistedView(table: ViewStateApi, storageKey: string | undefined): void {
  if (!storageKey) return

  const view = loadViewFromStorage(storageKey)
  if (view) table.setViewState(view)

  // `on(..., { defer: true })` skips the run that would otherwise fire right after the hydration
  // above — saving that first (pre-hydration) snapshot back would overwrite storage with defaults.
  createEffect(
    on(
      () => table.getViewState(),
      (v) => {
        saveOrClearViewInStorage(storageKey, v)
      },
      { defer: true },
    ),
  )
}

export interface UseUrlViewOptions {
  /** Query string parameter name that holds the encoded view. Default: 'view'. */
  paramName?: string
}

/**
 * Keeps a view in sync with the current URL's query string: loads it once (and on back/forward
 * navigation) and writes it back (via `history.replaceState`) on every subsequent change.
 */
export function useUrlView(table: ViewStateApi, options?: UseUrlViewOptions): void {
  const paramName = options?.paramName ?? 'view'

  // An absent or malformed param keeps the current (e.g. storage-restored) view
  function applyFromUrl(): void {
    const view = readViewFromUrlParam(paramName)
    if (view) table.setViewState(view)
  }
  applyFromUrl()
  window.addEventListener('popstate', applyFromUrl)
  onCleanup(() => window.removeEventListener('popstate', applyFromUrl))

  createEffect(
    on(
      () => table.getViewState(),
      (view) => {
        writeViewToUrlParam(paramName, view)
      },
      { defer: true },
    ),
  )
}

/**
 * Resets a table to its construction-time defaults and clears whatever `usePersistedView`/
 * `useUrlView` persisted for it — pass the same `storageKey`/`paramName` given to those.
 */
export function resetView(table: ViewStateApi, options?: ResetViewOptions): void {
  resetViewCore(table, options)
}

export type UsePersistenceOptions = ResetViewOptions

/**
 * `usePersistedView` + `useUrlView` sharing one `storageKey`/`paramName`, plus a `reset()` bound to
 * them.
 */
export function usePersistence(
  table: ViewStateApi,
  options: UsePersistenceOptions = {},
): { reset: () => void } {
  const { storageKey, paramName } = options
  usePersistedView(table, storageKey)
  useUrlView(table, { paramName })
  return { reset: () => resetView(table, { storageKey, paramName }) }
}
