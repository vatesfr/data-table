import type {
  ColumnDefBase,
  DataTableLabels,
  GetRowId,
  TableViewState,
} from '@vates/data-table-core'

// A copy of @vates/data-table-solid's `ColumnDef`: published types must not reference that bundled package
export interface ColumnDef<
  TRow extends object = Record<string, unknown>,
> extends ColumnDefBase<TRow> {
  /** Returns a DOM node to render for this cell instead of a string. Takes priority over `format`. */
  render?: (value: unknown, row: TRow) => Node
  /**
   * Render a custom label in filter dropdown options. Not applied to `type: 'date'` columns, whose
   * tree nodes don't map to one raw value.
   */
  renderFilterLabel?: (value: string) => Node
}

export interface DataTableOptions<TRow extends object = Record<string, unknown>> {
  data: TRow[]
  columns: ColumnDef<TRow>[]
  labels?: Partial<DataTableLabels>
  /** Whether newly-grouped groups start collapsed. Defaults to `true`; pass `false` to start expanded. */
  defaultGroupsCollapsed?: boolean
  /** See `@vates/data-table-solid`'s `CreateTableStateOptions.initialViewState` doc comment. */
  initialViewState?: TableViewState
  /** Opt-in row identity for selection — see `CreateTableStateOptions.getRowId` in `@vates/data-table-solid`. */
  getRowId?: GetRowId<TRow>
  selectable?: boolean
  onSelectionChange?: (rows: TRow[]) => void
  /** Fires on a row click, or on Enter while a row has keyboard focus (see "Keyboard navigation"). */
  onRowClick?: (row: TRow, event: MouseEvent | KeyboardEvent) => void
  /**
   * The row to mark as current (e.g. the one open in a side panel): it gets `aria-current="true"`
   * and the `dt-tr--current` class, with no default styling. Matched by object identity.
   */
  currentRow?: TRow | null
  /**
   * Extra classes for a data row (not group or aggregate rows), e.g. to dim an expired one:
   * added after the built-in `dt-tr*` classes. Called on every render.
   */
  rowClass?: (row: TRow) => string | undefined
  /**
   * Shows the toolbar's search box. Default: `true`. Opt out when the page has its own search.
   */
  showSearch?: boolean
  /**
   * Shows the Columns toolbar button. Default: `true`; hidden anyway with fewer than 2 columns.
   */
  showColumns?: boolean
  /**
   * A node rendered at the end of the toolbar's action row (after "Clear all"), inside a
   * right-aligned `.dt-toolbar-end` wrapper — e.g. "Share view"/"Reset view" buttons. Omitted or
   * `null`: no wrapper is rendered at all.
   */
  toolbarEnd?: Node | null
}

export interface DataTableInstance<TRow extends object = Record<string, unknown>> {
  setData(data: TRow[]): void
  setColumns(columns: ColumnDef<TRow>[]): void
  getViewState(): TableViewState
  setViewState(view: TableViewState): void
  /** Fires after any user action that changes the view (not selection). Returns an unsubscribe function. */
  onViewChange(cb: (view: TableViewState) => void): () => void
  /**
   * Fires whenever the selection changes, with the selected rows; attachable any time, alongside
   * the `onSelectionChange` option. Returns an unsubscribe function.
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
  /**
   * Rows after search, filters and sort, before grouping and pagination (`table.processedData`
   * elsewhere), e.g. for prev/next-row navigation.
   */
  getProcessedData(): TRow[]
  /**
   * Reveals `row` from outside the table: expands its groups, jumps to its page and makes it the
   * roving-tabindex row, so the next Tab or arrow key lands there. Moves DOM focus only with
   * `{ focus: true }`, so an external control keeps it. No-op for a row outside the current data.
   */
  focusRow(row: TRow, options?: { focus?: boolean }): void
  /**
   * Resets search/filters/sort/group/page to their true empty defaults, ignoring
   * `initialViewState` — unlike `setViewState({})`, which restores `initialViewState`'s own
   * values. Mirrors React/Vue/Solid's top-level `clearAll`.
   */
  clearAll(): void
  /** Toggles whether rows show selection checkboxes after construction. */
  setSelectable(value: boolean): void
  /** Shows/hides the toolbar's search box after construction — see `DataTableOptions.showSearch`. */
  setShowSearch(value: boolean): void
  /** Shows/hides the Columns toolbar button after construction — see `DataTableOptions.showColumns`. */
  setShowColumns(value: boolean): void
  /** Replaces (or removes, passing `null`) the toolbar-end node — see `DataTableOptions.toolbarEnd`. */
  setToolbarEnd(node: Node | null): void
  /** Changes (or clears, passing `undefined`) the row-click callback after construction. */
  setOnRowClick(cb: ((row: TRow, event: MouseEvent | KeyboardEvent) => void) | undefined): void
  /** Changes (or clears, passing `null`) the current row — see `DataTableOptions.currentRow`. */
  setCurrentRow(row: TRow | null): void
  /** Changes (or clears, passing `undefined`) the row class callback — see `DataTableOptions.rowClass`. */
  setRowClass(fn: ((row: TRow) => string | undefined) | undefined): void
  /** Replaces the label overrides after construction — see `DataTableOptions.labels`. */
  setLabels(labels: Partial<DataTableLabels> | undefined): void
  /** Changes whether newly-grouped groups start collapsed after construction. */
  setDefaultGroupsCollapsed(value: boolean): void
  /** Changes (or clears, passing `undefined`) the selection-identity function after construction. */
  setGetRowId(getRowId: GetRowId<TRow> | undefined): void
  destroy(): void
}
