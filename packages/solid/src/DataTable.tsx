import { createEffect, on } from 'solid-js'
import { createTableState } from './createTableState'
import { DataTableView, type DataTableViewProps } from './DataTableView'
import type { ColumnDef } from './types'
import type { DataTableLabels, GetRowId } from '@vates/data-table-core'

export interface DataTableProps<TRow extends object> extends Omit<
  DataTableViewProps<TRow>,
  'table'
> {
  // `DataTableView` reads these from `table` (see its own props — no separate data/columns props
  // there), but `<DataTable>` builds that `table` itself via `createTableState`, so it still needs
  // them as its own inputs.
  data: TRow[]
  columns: ColumnDef<TRow>[]
  defaultVisibleColumns?: string[]
  labels?: Partial<DataTableLabels>
  defaultPageSize?: number
  /** Whether newly-grouped groups start collapsed. Defaults to `true`; pass `false` to start expanded. */
  defaultGroupsCollapsed?: boolean
  /**
   * Opt-in row identity for selection — see `CreateTableStateOptions.getRowId`'s own doc comment
   * for the full reasoning. Omit to keep the default object-identity behavior.
   */
  getRowId?: GetRowId<TRow>
  /**
   * Fires whenever the selection changes. `createTableState`+`DataTableView` used directly has
   * no equivalent — a consumer holding onto `table` can just read `table.selectedRows()`
   * reactively — but `<DataTable>` never hands `table` back, so this is the only way to observe
   * selection here, the same reason `@vates/data-table-vanilla`'s `createDataTable` has one too.
   */
  onSelectionChange?: (rows: TRow[]) => void
}

// Thin convenience wrapper mirroring React's/Vue's own <DataTable>: builds a createTableState
// internally and renders <DataTableView>, for the common case that doesn't need the
// createTableState+DataTableView split (view persistence, an imperative selection API — see
// the README/CLAUDE.md's "reaching state a wrapper can't expose" section). `data`/`columns` are
// passed to createTableState as accessors (`() => props.data`), so they're tracked reactively
// for the table's whole lifetime with no manual createEffect needed here — unlike every other
// adapter's own equivalent wrapper (React's/Vue's own <DataTable>, and
// @vates/data-table-vanilla's createDataTable), which all need to re-seed/re-sync by hand
// because their own underlying state primitive doesn't accept a reactive source directly.
export function DataTable<TRow extends object>(props: DataTableProps<TRow>) {
  const table = createTableState(
    () => props.data,
    () => props.columns,
    {
      defaultVisibleColumns: props.defaultVisibleColumns,
      labels: props.labels,
      defaultPageSize: props.defaultPageSize,
      defaultGroupsCollapsed: props.defaultGroupsCollapsed,
      getRowId: props.getRowId,
    },
  )

  // Checked once at construction, matching vanilla's own wrapper — not reactive to a later
  // change of the callback itself, only to what it's called with.
  const onSelectionChange = props.onSelectionChange
  if (onSelectionChange) {
    createEffect(on(table.selectedRows, (rows) => onSelectionChange(rows), { defer: true }))
  }

  return (
    <DataTableView
      table={table}
      rowKey={props.rowKey}
      selectable={props.selectable}
      onRowClick={props.onRowClick}
    />
  )
}
