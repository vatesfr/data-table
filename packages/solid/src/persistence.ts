import { createEffect, on, onCleanup } from 'solid-js'
import { encodeViewState, decodeViewState, type TableViewState } from '@vates/data-table-core'

// Solid's own equivalent of react/vue's usePersistedView/useUrlView/usePersistence, built on the
// exact same getViewState()/setViewState() primitive this package's own createTableState also
// exposes — see CLAUDE.md's "View persistence" for the shared design across all three adapters.
// Named to match react/vue's own hooks (rather than a Solid-conventional `createXxx` name) since
// these are the same concept under the same API — cross-adapter consistency wins here over strict
// per-framework naming convention.

export interface ViewStateApi {
  getViewState(): TableViewState
  setViewState(view: TableViewState): void
}

/**
 * Loads a persisted view from `localStorage` once and saves it back on every subsequent change.
 * `table` is typically the object returned by `createTableState`. `storageKey` may be `undefined`
 * to no-op — this lets `usePersistence` below call this unconditionally regardless of whether
 * storage persistence is actually wanted.
 */
export function usePersistedView(table: ViewStateApi, storageKey: string | undefined): void {
  if (!storageKey) return

  const stored = localStorage.getItem(storageKey)
  const view = stored ? decodeViewState(stored) : undefined
  if (view) table.setViewState(view)

  // `on(..., { defer: true })` skips the run that would otherwise fire right after the hydration
  // above — saving that first (pre-hydration) snapshot back would overwrite storage with defaults.
  createEffect(
    on(
      () => table.getViewState(),
      (v) => {
        // Mirrors useUrlView's own empty-view handling below: a view back at its
        // construction-time defaults removes the key entirely rather than storing an
        // encoded-but-empty blob, so resetView's own removeItem isn't immediately undone by
        // this effect's next run.
        if (Object.keys(v).length === 0) localStorage.removeItem(storageKey)
        else localStorage.setItem(storageKey, encodeViewState(v))
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

  // Only acts when the param is actually present — an absent (or malformed) param leaves whatever
  // state is already there alone, rather than forcing a reset to defaults. This matters when
  // composing with usePersistedView above: a plain reload with no `view` param should keep the
  // localStorage-restored view, not clobber it with an empty one.
  function applyFromUrl(): void {
    const encoded = new URLSearchParams(window.location.search).get(paramName)
    if (!encoded) return
    const view = decodeViewState(encoded)
    if (view) table.setViewState(view)
  }
  applyFromUrl()
  window.addEventListener('popstate', applyFromUrl)
  onCleanup(() => window.removeEventListener('popstate', applyFromUrl))

  createEffect(
    on(
      () => table.getViewState(),
      (view) => {
        const params = new URLSearchParams(window.location.search)
        if (Object.keys(view).length === 0) params.delete(paramName)
        else params.set(paramName, encodeViewState(view))
        const query = params.toString()
        const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
        window.history.replaceState(null, '', url)
      },
      { defer: true },
    ),
  )
}

export interface ResetViewOptions {
  /** localStorage key passed to `usePersistedView` for this table, if any. */
  storageKey?: string
  /** Query string parameter name passed to `useUrlView` for this table. Default: 'view'. */
  paramName?: string
}

/**
 * Resets a table to its construction-time defaults and clears whatever `usePersistedView`/
 * `useUrlView` persisted for it — pass the same `storageKey`/`paramName` given to those.
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
  const { storageKey, paramName } = options
  usePersistedView(table, storageKey)
  useUrlView(table, { paramName })
  return { reset: () => resetView(table, { storageKey, paramName }) }
}
