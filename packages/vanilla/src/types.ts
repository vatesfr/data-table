import type { ColumnDefBase, DataTableLabels, TableViewState } from '@vates/data-table-core'

export interface ColumnDef<
  TRow extends object = Record<string, unknown>,
> extends ColumnDefBase<TRow> {
  /** Returns a DOM node to render for this cell instead of a string. Takes priority over `format`. */
  render?: (value: unknown, row: TRow) => Node
}

export interface DataTableOptions<TRow extends object = Record<string, unknown>> {
  data: TRow[]
  columns: ColumnDef<TRow>[]
  rowKey?: keyof TRow & string
  defaultVisibleColumns?: string[]
  labels?: Partial<DataTableLabels>
  defaultPageSize?: number
  /** Whether newly-grouped groups start collapsed. Defaults to `true`; pass `false` to start expanded. */
  defaultGroupsCollapsed?: boolean
  selectable?: boolean
  onSelectionChange?: (rows: TRow[]) => void
  /** Fires on a row click, or on Enter while a row has keyboard focus (see "Keyboard navigation"). */
  onRowClick?: (row: TRow, event: MouseEvent | KeyboardEvent) => void
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
