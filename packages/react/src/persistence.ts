import { useCallback, useEffect, useRef } from 'react'
import {
  encodeViewState,
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
 * Loads a persisted view from `localStorage` on mount and saves it back on every change. An
 * `undefined` `storageKey` no-ops, so `usePersistence` can call it unconditionally.
 */
export function usePersistedView(table: ViewStateApi, storageKey: string | undefined): void {
  const skipNextSave = useRef(true)
  // getViewState builds a new object on every render: the save effect is keyed on its encoding,
  // so it writes when the view changes, not on every render (focus, selection, parent re-render).
  const view = storageKey ? table.getViewState() : {}
  const encoded = encodeViewState(view)

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
    saveOrClearViewInStorage(storageKey, view)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `view` changes exactly when `encoded` does
  }, [storageKey, encoded])
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
  // Keyed on the encoded view, as in usePersistedView above
  const view = table.getViewState()
  const encoded = encodeViewState(view)

  useEffect(() => {
    // An absent or malformed param keeps the current (e.g. storage-restored) view
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
    writeViewToUrlParam(paramName, view)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `view` changes exactly when `encoded` does
  }, [paramName, encoded])
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
