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
   * tracked by object identity instead (see `TableState.selection.all`/`.toggle`) and
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
  const groupableCols = () => table.columns.list().filter((c) => c.groupable === true)

  function toggleDd(id: DropdownId): void {
    setOpenDropdown((cur) => (cur === id ? null : id))
  }

  return (
    <div class="dt">
      <div class="dt-toolbar">
        <div class="dt-toolbar-actions">
          <ColumnsDropdown
            table={table}
            columns={table.columns.list()}
            isOpen={openDropdown() === 'cols'}
            onToggle={() => toggleDd('cols')}
            onClose={() => setOpenDropdown(null)}
          />
          {/* Group before Sort — data is grouped first, then ordered (groups themselves, then
              rows within them), matching the Sort dropdown's own "Group order" section coming
              before "Active sorts" and the active bar's group-chips-before-sort-chips order. */}
          <Show when={groupableCols().length > 0}>
            <GroupDropdown
              table={table}
              groupableCols={groupableCols()}
              isOpen={openDropdown() === 'group'}
              onToggle={() => toggleDd('group')}
              onClose={() => setOpenDropdown(null)}
            />
          </Show>
          <SortDropdown
            table={table}
            columns={table.columns.list()}
            isOpen={openDropdown() === 'sort'}
            onToggle={() => toggleDd('sort')}
            onClose={() => setOpenDropdown(null)}
          />
          <span class="dt-toolbar-divider" />
          <SearchBox table={table} />
          <FilterDropdown
            table={table}
            columns={table.columns.list()}
            isOpen={openDropdown() === 'filter'}
            onToggle={() => toggleDd('filter')}
            onClose={() => setOpenDropdown(null)}
          />
          <Show
            when={
              table.sort.entries().length > 0 ||
              table.filter.activeCount() > 0 ||
              table.group.by().length > 0 ||
              table.search.query() !== ''
            }
          >
            <button type="button" class="dt-btn dt-clear-all" onClick={table.clearAll}>
              {table.labels().clearAll}
            </button>
          </Show>
        </div>
      </div>
      <ActiveBar
        table={table}
        columns={table.columns.list()}
        groupableCols={groupableCols()}
        totalRows={table.data().length}
        onOpenGroup={(key) => {
          setOpenDropdown('group')
          // Dropdown's own focus-on-open runs in a queueMicrotask (not synchronously — see
          // Dropdown.tsx's own comment), since its panel's ref callback fires before
          // `props.children` exists underneath it. This override has to run in a *later*-queued
          // microtask of its own, or Dropdown's already-scheduled one would win the race and
          // steal focus back to the search box/first row after this line runs. Scoped globally
          // rather than to this table's own root (no existing ref for that) — a practically
          // negligible risk of matching a different table's dropdown, only if two tables' Group
          // dropdowns were opened this way at the exact same instant with an overlapping key.
          queueMicrotask(() => {
            document.querySelector<HTMLElement>(`[data-group-key="${key}"]`)?.focus()
          })
        }}
        onOpenFilter={(key) => {
          setOpenDropdown('filter')
          // Same later-queued-microtask reasoning as onOpenGroup above. Focusing the column
          // button is enough on its own — FilterDropdown's own delegated `focusin` listener
          // (see "focus follows selection" in FilterDropdown.tsx) picks it up and selects that
          // column in the detail pane, no separate "which column" state to set from here.
          queueMicrotask(() => {
            document.querySelector<HTMLElement>(`[data-filter-col-key="${key}"]`)?.focus()
          })
        }}
      />
      <TableBody
        table={table}
        columns={table.columns.list()}
        rowKey={props.rowKey}
        selectable={props.selectable}
        onRowClick={props.onRowClick}
      />
      <Pagination table={table} />
    </div>
  )
}
