import { render } from 'solid-js/web'
import { createRoot, createEffect, createSignal, on } from 'solid-js'
import { createTableState, DataTableView } from '@vates/data-table-solid'
import {
  bucketNumericRange,
  formatNumericRange,
  numericRangeGroup,
  bucketDatePart,
  formatDatePart,
  datePartGroup,
  bucketLogRange,
  formatLogRange,
  logRangeGroup,
  compareMissingLast,
} from '@vates/data-table-core'
import type { GetRowId } from '@vates/data-table-core'
import type { ColumnDef, DataTableOptions, DataTableInstance } from './types'

export type { ColumnDef, DataTableOptions, DataTableInstance }
export type {
  DataTableLabels,
  TableViewState,
  GetRowId,
  SortEntry,
  RangeFilter,
} from '@vates/data-table-core'
export { DEFAULT_LABELS } from '@vates/data-table-core'
export { persistViewToLocalStorage, syncViewToUrl, resetView, persistView } from './persistence'
export type {
  ViewStateApi,
  SyncViewToUrlOptions,
  ResetViewOptions,
  PersistViewOptions,
} from './persistence'
export * from '@vates/data-table-core/locales'
// Ready-made groupValue/groupFormat pairs for bucketing a continuous/high-cardinality column
// (percentages, timestamps) into coarser groups — see `ColumnDefBase.groupValue` in the docs.
export {
  bucketNumericRange,
  formatNumericRange,
  numericRangeGroup,
  bucketDatePart,
  formatDatePart,
  datePartGroup,
  bucketLogRange,
  formatLogRange,
  logRangeGroup,
}
// Ready-made compare for pinning a value (missing data, by default) last regardless of sort
// direction — see `ColumnDefBase.compare` in the docs.
export { compareMissingLast }
export type { DatePart, LogRangeOptions } from '@vates/data-table-core'

// --- Factory ---

// This is now a thin wrapper: the actual reactive state (createTableState) and render layer
// (DataTableView) live in @vates/data-table-solid (a real, standalone Solid package — solid-js
// is a peerDependency there, never bundled) so a project already using Solid can depend on it
// directly and compose the table into its own reactive tree, sharing its own solid-js instance
// instead of getting a second, non-interoperable copy. This package's own job is narrower: adapt
// that Solid API into the plain-DOM-container, callback-based `createDataTable` shape a non-Solid
// consumer expects, and — since a non-Solid consumer must never need to install solid-js
// themselves — bundle both solid-js and @vates/data-table-solid into its own dist/ (see
// vite.config.ts's `external`, which still only excludes @vates/data-table-core).
export function createDataTable<TRow extends object>(
  container: HTMLElement,
  options: DataTableOptions<TRow>,
): DataTableInstance<TRow> {
  let dispose!: () => void
  let disposeView!: () => void
  let table!: ReturnType<typeof createTableState<TRow>>
  const viewChangeListeners = new Set<(view: ReturnType<typeof table.getViewState>) => void>()
  // Set-of-listeners, mirroring `viewChangeListeners` above, rather than a single fixed callback —
  // lets a consumer attach a listener after construction too (e.g. wiring up an external "selected
  // rows" display added later), not just via the constructor's `onSelectionChange` option.
  const selectionChangeListeners = new Set<(rows: TRow[]) => void>()
  if (options.onSelectionChange) selectionChangeListeners.add(options.onSelectionChange)

  // Each of these six options is now backed by its own signal, so it can be changed after
  // construction (via the matching `setXxx` returned below) without recreating the table —
  // `rowKey`/`selectable`/`onRowClick` because `DataTableView`/`TableBody` already read their
  // own props lazily (a signal call passed directly as a JSX prop stays live through Solid's
  // compiled prop getters, the same mechanism that already keeps `table` itself live), and
  // `labels`/`defaultGroupsCollapsed`/`getRowId` because `createTableState` now accepts its whole
  // `options` argument as an Accessor (see that package's own doc comment). `initialViewState`
  // stays a plain, one-time value — `createTableState` only ever seeds from it once regardless,
  // matching every other adapter's documented frozen behavior for it.
  const [rowKey, setRowKeySignal] = createSignal(options.rowKey)
  const [selectable, setSelectableSignal] = createSignal(options.selectable ?? false)
  // `onRowClick`/`getRowId` are themselves functions, so Solid's setter overloads can't tell them
  // apart from a functional updater — wrap each write in a thunk, the same workaround
  // `createTableState`'s own `selectionAnchor` signal already uses for the same reason.
  const [onRowClick, setOnRowClickSignal] = createSignal(options.onRowClick)
  const [labels, setLabelsSignal] = createSignal(options.labels)
  const [defaultGroupsCollapsed, setDefaultGroupsCollapsedSignal] = createSignal(
    options.defaultGroupsCollapsed,
  )
  const [getRowId, setGetRowIdSignal] = createSignal(options.getRowId)

  createRoot((d) => {
    dispose = d
    table = createTableState(options.data, options.columns, () => ({
      labels: labels(),
      defaultGroupsCollapsed: defaultGroupsCollapsed(),
      initialViewState: options.initialViewState,
      getRowId: getRowId(),
    }))

    // Fires on every subsequent change to any view-affecting signal (sort/filter/group/page/etc,
    // see getViewState) — `on(..., { defer: true })` skips the initial run at mount, matching the
    // old vanilla behavior where this only ever fired from inside a specific action handler, never
    // on initial render. Deliberately does NOT read `selection` (getViewState doesn't either), so
    // a selection-only change never fires this — same "not persisted/shared" reasoning as the
    // view-state docs.
    createEffect(
      on(
        () => table.getViewState(),
        (view) => {
          for (const cb of viewChangeListeners) cb(view)
        },
        { defer: true },
      ),
    )

    createEffect(
      on(
        table.selection.rows,
        (rows) => {
          for (const cb of selectionChangeListeners) cb(rows)
        },
        { defer: true },
      ),
    )

    // `render()` (solid-js/web) creates its own internal `createRoot` for the mounted subtree,
    // separate from the outer `createRoot` this factory owns — a nested root is only linked to
    // its parent via `.owner`, never registered in the parent's `.owned`, so the outer `dispose`
    // above never reaches anything mounted here (e.g. `Dropdown`'s `document`-level click
    // listener). `render`'s own return value must be captured and disposed too, or every
    // `createDataTable(...)` call leaks that listener forever, even past `destroy()`.
    disposeView = render(
      () => (
        <DataTableView
          table={table}
          rowKey={rowKey()}
          selectable={selectable()}
          onRowClick={onRowClick()}
        />
      ),
      container,
    )
  })

  return {
    setData: (data: TRow[]) => table.setData(data),
    setColumns: (columns: ColumnDef<TRow>[]) => table.columns.set(columns),
    getViewState: () => table.getViewState(),
    setViewState: (view) => table.setViewState(view),
    onViewChange: (cb) => {
      viewChangeListeners.add(cb)
      return () => viewChangeListeners.delete(cb)
    },
    onSelectionChange: (cb) => {
      selectionChangeListeners.add(cb)
      return () => selectionChangeListeners.delete(cb)
    },
    getSelection: () => [...table.selection.all()],
    setSelection: (rows: TRow[]) => table.selection.setAll(rows),
    clearSelection: () => table.selection.clear(),
    getProcessedData: () => [...table.processedData()],
    clearAll: () => table.clearAll(),
    // Wrapped in a thunk even though `key` is never actually a function: TS can't prove a
    // generic `keyof TRow & string` excludes `Function` structurally, so Solid's setter overload
    // resolution rejects a bare value here — same generic-signal friction as `getRowId`/
    // `onRowClick` above, just for a type-system reason rather than a real runtime ambiguity.
    setRowKey: (key: keyof TRow & string) => setRowKeySignal(() => key),
    setSelectable: (value: boolean) => setSelectableSignal(value),
    setOnRowClick: (cb: ((row: TRow, event: MouseEvent | KeyboardEvent) => void) | undefined) =>
      setOnRowClickSignal(() => cb),
    setLabels: (next: DataTableOptions<TRow>['labels']) => setLabelsSignal(next),
    setDefaultGroupsCollapsed: (value: boolean) => setDefaultGroupsCollapsedSignal(value),
    setGetRowId: (next: GetRowId<TRow> | undefined) => setGetRowIdSignal(() => next),
    destroy: () => {
      disposeView()
      dispose()
      container.innerHTML = ''
    },
  }
}
