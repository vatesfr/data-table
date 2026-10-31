import { render } from 'solid-js/web'
import { createRoot, createEffect, createSignal, on } from 'solid-js'
import type { Accessor } from 'solid-js'
import { createTableState, DataTableView } from '@vates/data-table-solid'
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
} from '@vates/data-table-core'
// Ready-made compare for pinning a value (missing data, by default) last regardless of sort
// direction — see `ColumnDefBase.compare` in the docs.
export { compareMissingLast } from '@vates/data-table-core'
export type { DatePart, LogRangeOptions } from '@vates/data-table-core'

// Solid setters treat a function argument as an updater, and several of these values are functions.
function prop<T>(initial: T): [Accessor<T>, (value: T) => void] {
  const [get, set] = createSignal(initial)
  return [get, (value) => set(() => value)]
}

// --- Factory ---

// Adapts @vates/data-table-solid, bundled with solid-js so consumers never install them, to a plain-DOM factory (docs/packages.md)
export function createDataTable<TRow extends object>(
  container: HTMLElement,
  options: DataTableOptions<TRow>,
): DataTableInstance<TRow> {
  let dispose!: () => void
  let disposeView!: () => void
  let table!: ReturnType<typeof createTableState<TRow>>
  const viewChangeListeners = new Set<(view: ReturnType<typeof table.getViewState>) => void>()
  // A set, so listeners can be added after construction too
  const selectionChangeListeners = new Set<(rows: TRow[]) => void>()
  if (options.onSelectionChange) selectionChangeListeners.add(options.onSelectionChange)

  // Settable after construction; see docs/packages.md's "Vanilla package".
  const [rowKey, setRowKey] = prop(options.rowKey)
  const [selectable, setSelectable] = prop(options.selectable ?? false)
  const [showSearch, setShowSearch] = prop(options.showSearch ?? true)
  const [showColumns, setShowColumns] = prop(options.showColumns ?? true)
  const [toolbarEnd, setToolbarEnd] = prop(options.toolbarEnd ?? null)
  const [currentRow, setCurrentRow] = prop(options.currentRow ?? null)
  const [onRowClick, setOnRowClick] = prop(options.onRowClick)
  const [rowClass, setRowClass] = prop(options.rowClass)
  const [labels, setLabels] = prop(options.labels)
  const [defaultGroupsCollapsed, setDefaultGroupsCollapsed] = prop(options.defaultGroupsCollapsed)
  const [getRowId, setGetRowId] = prop(options.getRowId)

  createRoot((d) => {
    dispose = d
    table = createTableState(options.data, options.columns, () => ({
      labels: labels(),
      defaultGroupsCollapsed: defaultGroupsCollapsed(),
      initialViewState: options.initialViewState,
      getRowId: getRowId(),
    }))

    // Deferred: not on mount; selection isn't part of the view, so it doesn't fire this
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

    // `render()` makes its own root, which the outer `dispose` never reaches: dispose it too, or its listeners leak
    disposeView = render(
      () => (
        <DataTableView
          table={table}
          rowKey={rowKey()}
          selectable={selectable()}
          onRowClick={onRowClick()}
          currentRow={currentRow()}
          rowClass={rowClass()}
          showSearch={showSearch()}
          showColumns={showColumns()}
          toolbarEnd={toolbarEnd()}
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
    // Flat name, as vanilla flattens every namespaced group (docs/packages.md)
    focusRow: (row: TRow, options?: { focus?: boolean }) => table.focus.moveTo(row, options),
    clearAll: () => table.clearAll(),
    setRowKey,
    setSelectable,
    setShowSearch,
    setShowColumns,
    setToolbarEnd,
    setOnRowClick,
    setCurrentRow,
    setRowClass,
    setLabels,
    setDefaultGroupsCollapsed,
    setGetRowId,
    destroy: () => {
      disposeView()
      dispose()
      container.innerHTML = ''
    },
  }
}
