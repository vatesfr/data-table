import type { ColumnDefBase, DataTableLabels } from '@vates/flexi-table-core'

export type ColumnDef<TRow extends object = Record<string, unknown>> = ColumnDefBase<TRow>

export interface FlexiTableOptions<TRow extends object = Record<string, unknown>> {
  data: TRow[]
  columns: ColumnDef<TRow>[]
  rowKey?: keyof TRow & string
  defaultVisibleColumns?: string[]
  labels?: Partial<DataTableLabels>
  defaultPageSize?: number
  selectable?: boolean
  onSelectionChange?: (rows: TRow[]) => void
  onRowClick?: (row: TRow, event: MouseEvent) => void
}

export interface FlexiTableInstance<TRow extends object = Record<string, unknown>> {
  setData(data: TRow[]): void
  setColumns(columns: ColumnDef<TRow>[]): void
  destroy(): void
}
