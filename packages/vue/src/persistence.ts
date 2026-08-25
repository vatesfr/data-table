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
 * Loads a persisted view from `localStorage` on mount and saves it back on every change.
 * `table` is typically the object returned by `useTableState`. Relies on `watch` only firing
 * in response to an actual reactive change, so — unlike a render-driven effect — there's no
 * risk of saving pre-hydration state: hydration itself is the change that triggers the first save.
 * `storageKey` may be `undefined` to no-op — this lets `usePersistence` below call this
 * unconditionally regardless of whether storage persistence is actually wanted.
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
      // Mirrors useUrlView's own empty-view handling below: a view back at its construction-time
      // defaults removes the key entirely rather than storing an encoded-but-empty blob, so
      // `resetView`'s own `removeItem` (or a plain "clear all" that lands back on the defaults)
      // isn't immediately undone by this watcher's next run.
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

  // Only acts when the param is actually present — an absent (or malformed) param leaves
  // whatever state is already there alone, rather than forcing a reset to defaults. This
  // matters when combined with usePersistedView: a plain reload with no `view` param should
  // keep the localStorage-restored view, not clobber it with an empty one.
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
 * Resets a table to its construction-time defaults and clears whatever `usePersistedView`/
 * `useUrlView` persisted for it — pass the same `storageKey`/`paramName` you gave those hooks
 * (both optional, since a consumer may use only one, or neither).
 */
export function resetView(table: ViewStateApi, options?: ResetViewOptions): void {
  resetViewCore(table, options)
}

export type UsePersistenceOptions = ResetViewOptions

/**
 * Combines `usePersistedView` + `useUrlView` behind one options object, so `storageKey`/
 * `paramName` are written down once instead of separately at three call sites (`usePersistedView`,
 * `useUrlView`, and `resetView` all need the *same* values — a typo'd/forgotten key at any one of
 * them is a silent bug). Returns a `reset()` bound to those same options, equivalent to calling
 * `resetView(table, options)` yourself.
 */
export function usePersistence(
  table: ViewStateApi,
  options: UsePersistenceOptions = {},
): { reset: () => void } {
  usePersistedView(table, options.storageKey)
  useUrlView(table, { paramName: options.paramName })
  return { reset: () => resetView(table, options) }
}
