import { useTableState } from './useTableState'
import { DataTableView } from './DataTableView'
import type { DataTableProps } from './types'

export function DataTable<TRow extends object>({
  labels,
  defaultGroupsCollapsed,
  initialViewState,
  getRowId,
  ...viewProps
}: DataTableProps<TRow>) {
  const table = useTableState(viewProps.data, viewProps.columns, {
    labels,
    defaultGroupsCollapsed,
    initialViewState,
    getRowId,
  })

  return <DataTableView table={table} {...viewProps} />
}
