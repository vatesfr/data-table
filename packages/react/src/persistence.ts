import { useCallback, useEffect, useRef } from 'react'
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
 * `table` is typically the object returned by `useTableState`. `storageKey` may be `undefined` to
 * no-op — this lets `usePersistence` below call this hook unconditionally (required by the Rules
 * of Hooks) regardless of whether storage persistence is actually wanted.
 */
export function usePersistedView(table: ViewStateApi, storageKey: string | undefined): void {
  const skipNextSave = useRef(true)

  useEffect(() => {
    if (!storageKey) return
    const view = loadViewFromStorage(storageKey)
    if (view) table.setViewState(view)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  useEffect(() => {
    if (!storageKey) return
    // The first commit reflects state from before hydration (or before the effect above ran);
    // saving it would overwrite storage with the pre-hydration defaults.
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }
    saveOrClearViewInStorage(storageKey, table.getViewState())
  })
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
  const skipNextSave = useRef(true)

  useEffect(() => {
    // Only acts when the param is actually present — an absent (or malformed) param leaves
    // whatever state is already there alone, rather than forcing a reset to defaults. This
    // matters when combined with usePersistedView: a plain reload with no `view` param should
    // keep the localStorage-restored view, not clobber it with an empty one.
    function applyFromUrl(): void {
      const view = readViewFromUrlParam(paramName)
      if (view) table.setViewState(view)
    }
    applyFromUrl()
    window.addEventListener('popstate', applyFromUrl)
    return () => window.removeEventListener('popstate', applyFromUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramName])

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }
    writeViewToUrlParam(paramName, table.getViewState())
  })
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
  const { storageKey, paramName } = options
  usePersistedView(table, storageKey)
  useUrlView(table, { paramName })
  return {
    reset: useCallback(
      () => resetView(table, { storageKey, paramName }),
      [table, storageKey, paramName],
    ),
  }
}
