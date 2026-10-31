import { onMounted, onUnmounted, watch } from 'vue'
import {
  loadViewFromStorage,
  saveOrClearViewInStorage,
  readViewFromUrlParam,
  writeViewToUrlParam,
  resetView as resetViewCore,
  type ViewStateApi,
  type ResetViewOptions,
} from '@vates/data-table-core/internal'

export type { ViewStateApi, ResetViewOptions }

/**
 * Loads a persisted view from `localStorage` on mount and saves it back on every change (`watch`
 * fires only on change, so pre-hydration state is never saved). An `undefined` `storageKey` no-ops.
 */
export function usePersistedView(table: ViewStateApi, storageKey: string | undefined): void {
  if (!storageKey) return

  onMounted(() => {
    const view = loadViewFromStorage(storageKey)
    if (view) table.setViewState(view)
  })

  watch(
    () => table.getViewState(),
    (view) => {
      saveOrClearViewInStorage(storageKey, view)
    },
    { deep: true },
  )
}

export interface UseUrlViewOptions {
  /** Query string parameter name that holds the encoded view. Default: 'view'. */
  paramName?: string
}

/**
 * Keeps a view in sync with the current URL's query string: loads it on mount and on
 * back/forward navigation, and writes it back (via `history.replaceState`) on every change.
 */
export function useUrlView(table: ViewStateApi, options?: UseUrlViewOptions): void {
  const paramName = options?.paramName ?? 'view'

  // An absent or malformed param keeps the current (e.g. storage-restored) view
  function applyFromUrl(): void {
    const view = readViewFromUrlParam(paramName)
    if (view) table.setViewState(view)
  }

  onMounted(() => {
    applyFromUrl()
    window.addEventListener('popstate', applyFromUrl)
  })
  onUnmounted(() => window.removeEventListener('popstate', applyFromUrl))

  watch(
    () => table.getViewState(),
    (view) => {
      writeViewToUrlParam(paramName, view)
    },
    { deep: true },
  )
}

/**
 * Resets a table to its construction-time defaults and clears what `usePersistedView`/`useUrlView`
 * stored, given the same `storageKey`/`paramName`.
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
  usePersistedView(table, options.storageKey)
  useUrlView(table, { paramName: options.paramName })
  return { reset: () => resetView(table, options) }
}
