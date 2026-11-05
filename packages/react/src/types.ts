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
   * Render a custom label in filter dropdown options. Not applied to `type: 'date'` columns, whose
   * tree nodes don't map to one raw value.
   */
  renderFilterLabel?: (value: string) => ReactNode
}

export interface DataTableViewProps<TRow extends object = Record<string, unknown>> {
  /** State returned by `useTableState`, so the caller can persist the view or drive selection */
  table: TableState<TRow>
  data: TRow[]
  columns: ColumnDef<TRow>[]
  selectable?: boolean
  onSelectionChange?: (rows: TRow[]) => void
  /** Fires on a row click, or on Enter while a row has keyboard focus (see "Keyboard navigation"). */
  onRowClick?: (
    row: TRow,
    event: MouseEvent<HTMLTableRowElement> | KeyboardEvent<HTMLTableRowElement>,
  ) => void
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
   * Content at the end of the toolbar's action row, in a right-aligned `.dt-toolbar-end`, e.g.
   * "Share view" buttons. Omitted: no wrapper.
   */
  toolbarEnd?: ReactNode
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
}
