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
  /**
   * A row property used as a stable DOM key for table rows (falls back to array index when
   * omitted). Purely a rendering-identity hint — it is **not** used for selection, which is
   * tracked by object identity instead (see `DataTableInstance.getSelection`/the internal
   * `toggleRowSelection` behavior) and works correctly with no `rowKey` at all. Unlike most table
   * libraries' "row key" prop, this one has no bearing on selection/sort/filter state.
   */
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
  /**
   * Current selection, by object identity (same model as React/Vue's `selection` — see the docs).
   * Includes rows currently hidden by an active filter, unlike a filtered "selected and visible"
   * view; there is no such filtered accessor here since vanilla exposes state only through methods.
   */
  getSelection(): TRow[]
  /** Replaces the selection outright — e.g. to pre-select rows on load, or restore a prior selection. */
  setSelection(rows: TRow[]): void
  /** Empties the selection — e.g. to wire an external "Clear selection" button. */
  clearSelection(): void
  destroy(): void
}
