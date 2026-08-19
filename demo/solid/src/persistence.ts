import { createEffect, on, onCleanup } from 'solid-js'
import { encodeViewState, decodeViewState, type TableViewState } from '@vates/data-table-core'

// @vates/data-table-solid has no usePersistedView/useUrlView-style helper of its own yet (see its
// README's "View persistence & sharing" section) — react/vue each ship one, built on the exact
// same getViewState()/setViewState() primitive this package's own createTableState also exposes.
// This is the "plain createEffect" implementation the README itself sketches, fleshed out to the
// same behavior as react/vue's own hooks so this demo can showcase persistence identically to
// theirs. A future package version could promote this straight into @vates/data-table-solid.

export interface ViewStateApi {
  getViewState(): TableViewState
  setViewState(view: TableViewState): void
}

/**
 * Loads a persisted view from `localStorage` once and saves it back on every subsequent change.
 * `table` is typically the object returned by `createTableState`.
 */
export function usePersistedView(table: ViewStateApi, storageKey: string): void {
  const stored = localStorage.getItem(storageKey)
  const view = stored ? decodeViewState(stored) : undefined
  if (view) table.setViewState(view)

  // `on(..., { defer: true })` skips the run that would otherwise fire right after the hydration
  // above — saving that first (pre-hydration) snapshot back would overwrite storage with defaults.
  createEffect(
    on(
      () => table.getViewState(),
      (v) => localStorage.setItem(storageKey, encodeViewState(v)),
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
