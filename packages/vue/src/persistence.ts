import { onMounted, onUnmounted, watch } from 'vue'
import { encodeViewState, decodeViewState, type TableViewState } from '@vates/data-table-core'

export interface ViewStateApi {
  getViewState(): TableViewState
  setViewState(view: TableViewState): void
}

/**
 * Loads a persisted view from `localStorage` on mount and saves it back on every change.
 * `table` is typically the object returned by `useTableState`. Relies on `watch` only firing
 * in response to an actual reactive change, so — unlike a render-driven effect — there's no
 * risk of saving pre-hydration state: hydration itself is the change that triggers the first save.
 */
export function usePersistedView(table: ViewStateApi, storageKey: string): void {
  onMounted(() => {
    const stored = localStorage.getItem(storageKey)
    const view = stored ? decodeViewState(stored) : undefined
    if (view) table.setViewState(view)
  })

  watch(
    () => table.getViewState(),
    (view) => {
      localStorage.setItem(storageKey, encodeViewState(view))
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
    const encoded = new URLSearchParams(window.location.search).get(paramName)
    if (!encoded) return
    const view = decodeViewState(encoded)
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
      const params = new URLSearchParams(window.location.search)
      if (Object.keys(view).length === 0) params.delete(paramName)
      else params.set(paramName, encodeViewState(view))
      const query = params.toString()
      const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
      window.history.replaceState(null, '', url)
    },
    { deep: true },
  )
}
