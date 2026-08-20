import type { ColumnDefBase, DataTableLabels, GetRowId } from '@vates/data-table-core'
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
  /**
   * A row property used as Vue's `:key` for table rows (falls back to array index when omitted).
   * Purely a rendering-identity hint — it is **not** used for selection, which is tracked by
   * object identity instead (see `useTableState`'s `selection`/`toggleRowSelection`) and works
   * correctly with no `rowKey` at all. Unlike most table libraries' "row key" prop, this one has
   * no bearing on selection/sort/filter state.
   */
  rowKey?: string
  selectable?: boolean
}

// `<DataTableView>`'s actual runtime props, plus `rowClickable` — an internal wiring detail (see
// DataTableView.vue's own comment) that only `<DataTable>` ever sets, to forward its own
// listener-presence check through since it always forwards the `row-click` emit itself
// regardless. Deliberately not part of `DataTableViewProps` (the type consumers see/import from
// this package's index) nor re-exported from `index.ts` — a consumer using `<DataTableView>`
// directly should never see this prop, let alone be tempted to set it themselves; that usage
// self-detects clickability from its own `@row-click` listener instead.
export interface DataTableViewInternalProps<
  TRow extends object = Record<string, unknown>,
> extends DataTableViewProps<TRow> {
  rowClickable?: boolean
}

export interface DataTableProps<TRow extends object = Record<string, unknown>> extends Omit<
  DataTableViewProps<TRow>,
  'table'
> {
  defaultVisibleColumns?: string[]
  labels?: Partial<DataTableLabels>
  defaultPageSize?: number
  /** Whether newly-grouped groups start collapsed. Defaults to `true`; pass `false` to start expanded. */
  defaultGroupsCollapsed?: boolean
  /**
   * Opt-in row identity for selection — see `UseTableStateOptions.getRowId`'s own doc comment for
   * the full reasoning. Omit to keep the default object-identity behavior.
   */
  getRowId?: GetRowId<TRow>
  /**
   * `v-model:page` — two-way bound to the table's own current page. Unlike selection (already
   * observable via `selectionChange`/`onSelectionChange`), `<DataTable>` otherwise has no way to
   * read or set the current page from outside at all. Omit to just let the table manage its own
   * page as before; binding it lets a parent read the page (e.g. to show it elsewhere) or jump to
   * one programmatically.
   */
  page?: number
  /** `v-model:search-query` — same two-way binding as `page` above, for the global search box. */
  searchQuery?: string
}
