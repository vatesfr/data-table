import { useTableState } from './useTableState'
import { DataTableView } from './DataTableView'
import type { DataTableProps } from './types'

export function DataTable<TRow extends object>({
  data,
  columns,
  rowKey,
  defaultVisibleColumns,
  labels,
  defaultPageSize,
  selectable,
  onSelectionChange,
  onRowClick,
}: DataTableProps<TRow>) {
  const table = useTableState(data, columns, defaultVisibleColumns, labels, defaultPageSize)

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
