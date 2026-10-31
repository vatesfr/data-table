import type {
  ColumnDefBase,
  DataTableLabels,
  GetRowId,
  TableViewState,
} from '@vates/data-table-core'
import type { TableState } from './useTableState'

// Vue uses scoped slots instead of render functions — no extra fields needed.
export type ColumnDef<TRow extends object = Record<string, unknown>> = ColumnDefBase<TRow>

export interface DataTableViewProps<TRow extends object = Record<string, unknown>> {
  /** State returned by `useTableState`, so the caller can persist the view or drive selection */
  table: TableState<TRow>
  data: TRow[]
  columns: ColumnDef<TRow>[]
  /**
   * A row property used as Vue's `:key` (default: the index). Not used for selection, which tracks
   * rows by object identity (or `getRowId`).
   */
  rowKey?: string
  selectable?: boolean
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
   * Called when a data row is clicked or activated with Enter (`@row-click`); setting it also
   * makes rows look clickable and keyboard-focusable.
   */
  onRowClick?: (row: TRow, event: MouseEvent | KeyboardEvent) => void
  /**
   * Shows the toolbar's search box. Default: `true`. Opt out when the page has its own search.
   */
  showSearch?: boolean
  /**
   * Shows the Columns toolbar button. Default: `true`; hidden anyway with fewer than 2 columns.
   */
  showColumns?: boolean
}

export interface DataTableProps<TRow extends object = Record<string, unknown>> extends Omit<
  DataTableViewProps<TRow>,
  'table'
> {
  labels?: Partial<DataTableLabels>
  /** Whether newly-grouped groups start collapsed. Defaults to `true`; pass `false` to start expanded. */
  defaultGroupsCollapsed?: boolean
  /** See `UseTableStateOptions.initialViewState`'s own doc comment. */
  initialViewState?: TableViewState
  /** Opt-in row identity for selection — see `UseTableStateOptions.getRowId`. */
  getRowId?: GetRowId<TRow>
  /** `v-model:page`: reads or sets the table's current page from outside. */
  page?: number
  /** `v-model:search-query` — same two-way binding as `page` above, for the global search box. */
  searchQuery?: string
}
