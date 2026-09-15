import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import type {
  ColumnDefBase,
  DataTableLabels,
  GetRowId,
  TableViewState,
} from '@vates/data-table-core'
import type { TableState } from './useTableState'

export interface ColumnDef<
  TRow extends object = Record<string, unknown>,
> extends ColumnDefBase<TRow> {
  /** Render a custom React node in table cells and group headers */
  render?: (value: unknown, row: TRow) => ReactNode
  /**
   * Render a custom label in filter dropdown options. Not applied to `type: 'date'` columns —
   * their filter is a Year/Month/Day tree, and a branch node's label (e.g. a month) has no
   * single raw value to hand back; only a day leaf's underlying values are checklist-like, and
   * even then a leaf can bundle more than one raw value (e.g. several timestamps on the same day).
   */
  renderFilterLabel?: (value: string) => ReactNode
}

export interface DataTableViewProps<TRow extends object = Record<string, unknown>> {
  /**
   * State returned by `useTableState`, owned by the caller — this is what lets you reach
   * persistence (`usePersistedView`/`useUrlView`) or imperative selection control
   * (`table.clearSelection()`, etc.) from outside while still getting the built-in table UI.
   */
  table: TableState<TRow>
  data: TRow[]
  columns: ColumnDef<TRow>[]
  /**
   * A row property to use as React's `key` for table rows (falls back to array index when
   * omitted). Purely a rendering-identity hint — it is **not** used for selection, which is
   * tracked by object identity instead (see `useTableState`'s `selection.all`/`selection.toggle`)
   * and works correctly with no `rowKey` at all. Unlike most table libraries' "row key" prop,
   * this one has no bearing on selection/sort/filter state.
   */
  rowKey?: keyof TRow & string
  selectable?: boolean
  onSelectionChange?: (rows: TRow[]) => void
  /** Fires on a row click, or on Enter while a row has keyboard focus (see "Keyboard navigation"). */
  onRowClick?: (
    row: TRow,
    event: MouseEvent<HTMLTableRowElement> | KeyboardEvent<HTMLTableRowElement>,
  ) => void
  /**
   * Shows/hides the toolbar's search box. Defaults to `true`. Unlike the Sort/Group/Filter
   * dropdowns (which already hide themselves when no column qualifies for them), search always
   * applies regardless of column config — there's no equivalent auto-hide signal for it, so this
   * is the one toolbar control that needs an explicit opt-out (e.g. when the page already has its
   * own search input and the toolbar's own box would just duplicate it).
   */
  showSearch?: boolean
  /**
   * Shows/hides the Columns toolbar button. Defaults to `true`, but auto-hides regardless once
   * `columns.length < 2` — reordering/toggling the visibility of a single column has nothing
   * meaningful to act on. Unlike Sort/Group/Filter (which derive their own auto-hide from a
   * per-column flag), Columns has no such per-column signal — hiding/showing a column is a
   * table-level preference, not something a column def opts into — so this explicit opt-out
   * mirrors `showSearch`'s reasoning rather than adding a `showable`-style column flag.
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
  /**
   * Opt-in row identity for selection — see `UseTableStateOptions.getRowId`'s own doc comment for
   * the full reasoning. Omit to keep the default object-identity behavior.
   */
  getRowId?: GetRowId<TRow>
}
