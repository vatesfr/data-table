import { useTableState } from './useTableState'
import { DataTableView } from './DataTableView'
import type { DataTableProps } from './types'

export function DataTable<TRow extends object>({
  data,
  columns,
  rowKey,
  labels,
  defaultGroupsCollapsed,
  initialViewState,
  getRowId,
  selectable,
  onSelectionChange,
  onRowClick,
}: DataTableProps<TRow>) {
  const table = useTableState(data, columns, {
    labels,
    defaultGroupsCollapsed,
    initialViewState,
    getRowId,
  })

  return (
    <DataTableView
      table={table}
      data={data}
      columns={columns}
      rowKey={rowKey}
      selectable={selectable}
      onSelectionChange={onSelectionChange}
      onRowClick={onRowClick}
    />
  )
}
