import type { ColumnDefBase, DataTableLabels } from '@vates/data-table-core'
import type { TableState } from './useTableState'

// Vue uses scoped slots instead of render functions — no extra fields needed.
export type ColumnDef<TRow extends object = Record<string, unknown>> = ColumnDefBase<TRow>

export interface DataTableViewProps<TRow extends object = Record<string, unknown>> {
  /**
   * State returned by `useTableState`, owned by the caller — this is what lets you reach
   * persistence (`usePersistedView`/`useUrlView`) or imperative selection control
   * (`table.clearSelection()`, etc.) from outside while still getting the built-in table UI.
   */
  table: TableState<TRow>
  data: TRow[]
  columns: ColumnDef<TRow>[]
  rowKey?: string
  selectable?: boolean
  /**
   * Explicit override for whether rows should show clickable styling (pointer cursor, hover
   * highlight). Used by the `<DataTable>` wrapper to forward its own listener-presence check
   * through, since it always forwards the `row-click` emit itself regardless. Omit when using
   * `<DataTableView>` directly — it self-detects from its own `@row-click` listener.
   */
  rowClickable?: boolean
}

export interface DataTableProps<TRow extends object = Record<string, unknown>> extends Omit<
  DataTableViewProps<TRow>,
  'table' | 'rowClickable'
> {
  defaultVisibleColumns?: string[]
  labels?: Partial<DataTableLabels>
  defaultPageSize?: number
}
