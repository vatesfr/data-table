import type { MouseEvent, ReactNode } from 'react'
import type { ColumnDefBase, DataTableLabels } from '@vates/data-table-core'
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
  rowKey?: keyof TRow & string
  selectable?: boolean
  onSelectionChange?: (rows: TRow[]) => void
  onRowClick?: (row: TRow, event: MouseEvent<HTMLTableRowElement>) => void
}

export interface DataTableProps<TRow extends object = Record<string, unknown>> extends Omit<
  DataTableViewProps<TRow>,
  'table'
> {
  defaultVisibleColumns?: string[]
  labels?: Partial<DataTableLabels>
  defaultPageSize?: number
}
