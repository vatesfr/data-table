import { createEffect, on, splitProps } from 'solid-js'
import { createTableState } from './createTableState'
import { DataTableView, type DataTableViewProps } from './DataTableView'
import type { ColumnDef } from './types'
import type { DataTableLabels, TableViewState } from '@vates/data-table-core'
import type { GetRowId } from '@vates/data-table-core/internal'

export interface DataTableProps<TRow extends object> extends Omit<
  DataTableViewProps<TRow>,
  'table'
> {
  // `DataTableView` reads these from `table`, which this wrapper builds itself
  data: TRow[]
  columns: ColumnDef<TRow>[]
  labels?: Partial<DataTableLabels>
  /** Whether newly-grouped groups start collapsed. Defaults to `true`; pass `false` to start expanded. */
  defaultGroupsCollapsed?: boolean
  /** See `CreateTableStateOptions.initialViewState`'s own doc comment. */
  initialViewState?: TableViewState
  /** Opt-in row identity for selection — see `CreateTableStateOptions.getRowId`. */
  getRowId?: GetRowId<TRow>
  /** Fires whenever the selection changes: `<DataTable>` never hands `table` back to read it from. */
  onSelectionChange?: (rows: TRow[]) => void
}

// `createTableState` + `<DataTableView>` in one, like React's/Vue's `<DataTable>` (docs/solid-package.md)
export function DataTable<TRow extends object>(props: DataTableProps<TRow>) {
  // A thunk keeps `labels`/`defaultGroupsCollapsed`/`getRowId` live; `initialViewState` is read once
  const table = createTableState(
    () => props.data,
    () => props.columns,
    () => ({
      labels: props.labels,
      defaultGroupsCollapsed: props.defaultGroupsCollapsed,
      initialViewState: props.initialViewState,
      getRowId: props.getRowId,
    }),
  )

  // Checked once at construction, matching vanilla's own wrapper — not reactive to a later
  // change of the callback itself, only to what it's called with.
  const onSelectionChange = props.onSelectionChange
  if (onSelectionChange) {
    createEffect(on(table.selection.rows, (rows) => onSelectionChange(rows), { defer: true }))
  }

  const [, viewProps] = splitProps(props, [
    'data',
    'columns',
    'labels',
    'defaultGroupsCollapsed',
    'initialViewState',
    'getRowId',
    'onSelectionChange',
  ])
  return <DataTableView table={table} {...viewProps} />
}
