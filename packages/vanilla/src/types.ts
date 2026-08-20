import type {
  ColumnDefBase,
  DataTableLabels,
  GetRowId,
  TableViewState,
} from '@vates/data-table-core'

// Structurally identical to @vates/data-table-solid's own `ColumnDef` (createTableState/
// DataTableView there are typed against it) — declared again here rather than imported from
// that package so this package's own published `dist/index.d.ts` never references a type from
// @vates/data-table-solid, which (unlike @vates/data-table-core) isn't a real "dependencies"
// entry for this package — it's bundled, the same internal-implementation-detail status as
// solid-js itself, so consumers must never be required to have its types resolvable. TypeScript's
// structural typing means an identically-shaped, independently-declared interface here is still
// assignable to solid's own `ColumnDef` at every call site that passes one across the boundary
// (same reasoning React/Vue each already declare their own independent `ColumnDef` rather than
// sharing one).
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
  /**
   * Opt-in row identity for selection — see `@vates/data-table-solid`'s `CreateTableStateOptions.
   * getRowId` doc comment for the full reasoning. Omit to keep the default object-identity
   * behavior.
   */
  getRowId?: GetRowId<TRow>
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
   * Fires whenever the selection changes, with the current `getSelection()`-equivalent rows.
   * Mirrors `onViewChange`'s subscribe/unsubscribe shape — a listener can be attached any time,
   * not only via the constructor's `onSelectionChange` option (which is still supported and is
   * seeded as this listener set's first member). Returns an unsubscribe function.
   */
  onSelectionChange(cb: (rows: TRow[]) => void): () => void
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
