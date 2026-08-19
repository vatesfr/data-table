import { render } from 'solid-js/web'
import { createRoot, createEffect, on } from 'solid-js'
import { createTableState, DataTableView } from '@vates/data-table-solid'
import {
  bucketNumericRange,
  formatNumericRange,
  bucketDatePart,
  formatDatePart,
  compareMissingLast,
} from '@vates/data-table-core'
import type { ColumnDef, DataTableOptions, DataTableInstance } from './types'

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
