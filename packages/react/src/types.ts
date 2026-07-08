import type { MouseEvent, ReactNode } from 'react'
import type { ColumnDefBase, DataTableLabels } from '@vates/data-table-core'

export interface ColumnDef<
  TRow extends object = Record<string, unknown>,
> extends ColumnDefBase<TRow> {
  /** Render a custom React node in table cells and group headers */
  render?: (value: unknown, row: TRow) => ReactNode
  /** Render a custom label in filter dropdown options */
  renderFilterLabel?: (value: string) => ReactNode
}

export interface DataTableProps<TRow extends object = Record<string, unknown>> {
  data: TRow[]
  columns: ColumnDef<TRow>[]
  rowKey?: keyof TRow & string
  defaultVisibleColumns?: string[]
  labels?: Partial<DataTableLabels>
  defaultPageSize?: number
  selectable?: boolean
  onSelectionChange?: (rows: TRow[]) => void
  onRowClick?: (row: TRow, event: MouseEvent<HTMLTableRowElement>) => void
}
