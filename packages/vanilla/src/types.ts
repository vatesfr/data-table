import type { ColumnDefBase, DataTableLabels, TableViewState } from '@vates/data-table-core'

export type ColumnDef<TRow extends object = Record<string, unknown>> = ColumnDefBase<TRow>

export interface DataTableOptions<TRow extends object = Record<string, unknown>> {
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

export interface DataTableInstance<TRow extends object = Record<string, unknown>> {
  setData(data: TRow[]): void
  setColumns(columns: ColumnDef<TRow>[]): void
  getViewState(): TableViewState
  setViewState(view: TableViewState): void
  /** Fires after any user action that changes the view (not selection). Returns an unsubscribe function. */
  onViewChange(cb: (view: TableViewState) => void): () => void
  destroy(): void
}
