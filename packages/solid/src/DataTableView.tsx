import { Show, createSignal } from 'solid-js'
import type { TableState } from './createTableState'
import { injectStyles } from './styles'
import { SearchBox } from './components/SearchBox'
import { ColumnsDropdown } from './components/ColumnsDropdown'
import { SortDropdown } from './components/SortDropdown'
import { GroupDropdown } from './components/GroupDropdown'
import { FilterDropdown } from './components/FilterDropdown'
import { ActiveBar } from './components/ActiveBar'
import { TableBody } from './components/TableBody'
import { Pagination } from './components/Pagination'

export interface DataTableViewProps<TRow extends object> {
  table: TableState<TRow>
  /**
   * A row property used as a stable DOM key for table rows (falls back to array index when
   * omitted). Purely a rendering-identity hint — it is **not** used for selection, which is
   * tracked by object identity instead (see `TableState.selection`/`toggleRowSelection`) and
   * works correctly with no `rowKey` at all. Unlike most table libraries' "row key" prop, this
   * one has no bearing on selection/sort/filter state.
   */
  rowKey?: keyof TRow & string
  selectable?: boolean
  onRowClick?: (row: TRow, event: MouseEvent | KeyboardEvent) => void
}

type DropdownId = 'cols' | 'sort' | 'group' | 'filter'

// Top-level render layer, taking a `table: TableState<TRow>` (createTableState's return) as a
// prop instead of calling createTableState itself — mirrors react/vue's own DataTableView split
// (see CLAUDE.md's "DataTableView — reaching state that <DataTable> can't expose"), so a consumer
// with imperative needs (usePersistedView-equivalent, etc.) can build a table and pass it in
// directly instead of only ever going through the createDataTable(container, options) wrapper.
export function DataTableView<TRow extends object>(props: DataTableViewProps<TRow>) {
  injectStyles()
  const { table } = props
  const [openDropdown, setOpenDropdown] = createSignal<DropdownId | null>(null)
  const groupableCols = () => table.columns().filter((c) => c.groupable === true)

  function toggleDd(id: DropdownId): void {
    setOpenDropdown((cur) => (cur === id ? null : id))
  }

  return (
    <div class="dt">
      <div class="dt-toolbar">
        <div class="dt-toolbar-actions">
          <ColumnsDropdown
            table={table}
            columns={table.columns()}
            isOpen={openDropdown() === 'cols'}
            onToggle={() => toggleDd('cols')}
            onClose={() => setOpenDropdown(null)}
          />
          <SortDropdown
            table={table}
            columns={table.columns()}
            isOpen={openDropdown() === 'sort'}
            onToggle={() => toggleDd('sort')}
            onClose={() => setOpenDropdown(null)}
          />
          <Show when={groupableCols().length > 0}>
            <GroupDropdown
              table={table}
              groupableCols={groupableCols()}
              isOpen={openDropdown() === 'group'}
              onToggle={() => toggleDd('group')}
              onClose={() => setOpenDropdown(null)}
            />
          </Show>
          <span class="dt-toolbar-divider" />
          <SearchBox table={table} />
          <FilterDropdown
            table={table}
            columns={table.columns()}
            isOpen={openDropdown() === 'filter'}
            onToggle={() => toggleDd('filter')}
            onClose={() => setOpenDropdown(null)}
          />
          <Show
            when={
              table.sorts().length > 0 ||
              table.activeFilterCount() > 0 ||
              table.groupBy().length > 0 ||
              table.searchQuery() !== ''
            }
          >
            <button type="button" class="dt-btn dt-clear-all" onClick={table.clearAll}>
              {table.L.clearAll}
            </button>
          </Show>
        </div>
      </div>
      <ActiveBar
        table={table}
        columns={table.columns()}
        groupableCols={groupableCols()}
        totalRows={table.data().length}
        onOpenGroup={() => setOpenDropdown('group')}
        onOpenFilter={() => setOpenDropdown('filter')}
      />
      <TableBody
        table={table}
        columns={table.columns()}
        rowKey={props.rowKey}
        selectable={props.selectable}
        onRowClick={props.onRowClick}
      />
      <Pagination table={table} />
    </div>
  )
}
