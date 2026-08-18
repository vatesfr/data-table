import { render } from 'solid-js/web'
import { createRoot, createEffect, on } from 'solid-js'
import {
  bucketNumericRange,
  formatNumericRange,
  bucketDatePart,
  formatDatePart,
  compareMissingLast,
} from '@vates/data-table-core'
import type { ColumnDef, DataTableOptions, DataTableInstance } from './types'
import { createTableState } from './createTableState'
import { DataTableView } from './DataTableView'
import { STYLES } from './styles'

export type { ColumnDef, DataTableOptions, DataTableInstance }
export type { DataTableLabels, TableViewState } from '@vates/data-table-core'
export { persistViewToLocalStorage, syncViewToUrl, resetView } from './persistence'
export type { ViewStateApi, SyncViewToUrlOptions, ResetViewOptions } from './persistence'
export * from '@vates/data-table-core/locales'
// Ready-made groupValue/groupFormat pairs for bucketing a continuous/high-cardinality column
// (percentages, timestamps) into coarser groups — see `ColumnDefBase.groupValue` in the docs.
export { bucketNumericRange, formatNumericRange, bucketDatePart, formatDatePart }
// Ready-made compare for pinning a value (missing data, by default) last regardless of sort
// direction — see `ColumnDefBase.compare` in the docs.
export { compareMissingLast }
export type { DatePart } from '@vates/data-table-core'
export { createTableState } from './createTableState'
export type { TableState, CreateTableStateOptions } from './createTableState'
export { DataTableView } from './DataTableView'
export type { DataTableViewProps } from './DataTableView'

let stylesInjected = false
function injectStyles(): void {
  if (stylesInjected || typeof document === 'undefined') return
  stylesInjected = true
  const s = document.createElement('style')
  s.dataset.dtStyles = ''
  s.textContent = STYLES
  document.head.insertBefore(s, document.head.firstChild)
}

// --- Factory ---

export function createDataTable<TRow extends object>(
  container: HTMLElement,
  options: DataTableOptions<TRow>,
): DataTableInstance<TRow> {
  injectStyles()

  const { rowKey, selectable = false, onSelectionChange, onRowClick } = options

  let dispose!: () => void
  let table!: ReturnType<typeof createTableState<TRow>>
  const viewChangeListeners = new Set<(view: ReturnType<typeof table.getViewState>) => void>()

  createRoot((d) => {
    dispose = d
    table = createTableState(options.data, options.columns, {
      defaultVisibleColumns: options.defaultVisibleColumns,
      labels: options.labels,
      defaultPageSize: options.defaultPageSize,
      defaultGroupsCollapsed: options.defaultGroupsCollapsed,
    })

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

    if (onSelectionChange) {
      createEffect(on(table.selectedRows, (rows) => onSelectionChange(rows), { defer: true }))
    }

    render(
      () => (
        <DataTableView
          table={table}
          data={table.data()}
          columns={table.columns()}
          rowKey={rowKey}
          selectable={selectable}
          onRowClick={onRowClick}
        />
      ),
      container,
    )
  })

  return {
    setData: (data: TRow[]) => table.setData(data),
    setColumns: (columns: ColumnDef<TRow>[]) => table.setColumns(columns),
    getViewState: () => table.getViewState(),
    setViewState: (view) => table.setViewState(view),
    onViewChange: (cb) => {
      viewChangeListeners.add(cb)
      return () => viewChangeListeners.delete(cb)
    },
    getSelection: () => [...table.selection()],
    setSelection: (rows: TRow[]) => table.setSelectionRows(rows),
    clearSelection: () => table.clearSelection(),
    destroy: () => {
      dispose()
      container.innerHTML = ''
    },
  }
}
