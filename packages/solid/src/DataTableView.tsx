import { Show, children, createSignal, onCleanup, type JSXElement } from 'solid-js'
import {
  FILTER_NARROW_QUERY,
  injectStyles,
  tableStatus,
  watchMedia,
} from '@vates/data-table-core/internal'
import { renderThemeCss } from '@vates/data-table-core/theme'
import type { TableState } from './createTableState'
import { SearchBox, focusSearch } from './components/SearchBox'
import { ColumnsDropdown } from './components/ColumnsDropdown'
import { SortDropdown } from './components/SortDropdown'
import { GroupDropdown } from './components/GroupDropdown'
import { FilterDropdown, type FilterDropdownHandle } from './components/FilterDropdown'
import { ActiveBar } from './components/ActiveBar'
import { TableBody } from './components/TableBody'
import { Pagination } from './components/Pagination'

export interface DataTableViewProps<TRow extends object> {
  table: TableState<TRow>
  selectable?: boolean
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
   * Content at the end of the toolbar's action row, in a right-aligned `.dt-toolbar-end`, e.g.
   * "Share view" buttons. Omitted: no wrapper.
   */
  // `JSXElement`, not `JSX.Element`: the d.ts rollup (vite:dts) can't follow solid-js's `JSX` namespace.
  toolbarEnd?: JSXElement
}

type DropdownId = 'cols' | 'sort' | 'group' | 'filter'

// Render layer taking a `table` from `createTableState` (docs/packages.md's DataTableView split)
export function DataTableView<TRow extends object>(props: DataTableViewProps<TRow>) {
  injectStyles(renderThemeCss())
  const { table } = props
  const [openDropdown, setOpenDropdown] = createSignal<DropdownId | null>(null)
  let filterDropdown: FilterDropdownHandle | undefined
  const groupableCols = () => table.columns.list().filter((c) => c.groupable === true)
  const sortableCols = () => table.columns.list().filter((c) => c.sortable !== false)
  const filterableCols = () => table.columns.list().filter((c) => c.filterable !== false)
  // Resolved once: reading a JSX prop twice (the `when` and the body) would build it twice.
  const toolbarEnd = children(() => props.toolbarEnd)
  const hasToolbarEnd = () => toolbarEnd.toArray().length > 0
  const [narrow, setNarrow] = createSignal(false)
  onCleanup(watchMedia(FILTER_NARROW_QUERY, setNarrow))
  // On a phone the toolbar wraps: toolbarEnd ends the first line instead of taking a line of its own.
  const endFirst = () => narrow() && hasToolbarEnd()
  const showColumns = () => props.showColumns !== false && table.columns.list().length >= 2
  const hasActiveState = () =>
    table.sort.entries().length > 0 ||
    table.filter.activeCount() > 0 ||
    table.group.by().length > 0 ||
    table.search.query() !== ''
  // The divider separates the shape controls from the find ones: only drawn with both sides
  const hasShapeControls = () =>
    showColumns() || groupableCols().length > 0 || sortableCols().length > 0
  const hasFindControls = () =>
    props.showSearch !== false || filterableCols().length > 0 || hasActiveState()

  function toggleDd(id: DropdownId): void {
    setOpenDropdown((cur) => (cur === id ? null : id))
  }

  return (
    <div class="dt">
      <Show when={hasShapeControls() || hasFindControls() || hasToolbarEnd()}>
        <div class="dt-toolbar">
          <div class="dt-toolbar-actions">
            <Show when={showColumns()}>
              <ColumnsDropdown
                table={table}
                isOpen={openDropdown() === 'cols'}
                onToggle={() => toggleDd('cols')}
                onClose={() => setOpenDropdown(null)}
              />
            </Show>
            {/* Group before Sort: data is grouped, then ordered */}
            <Show when={groupableCols().length > 0}>
              <GroupDropdown
                table={table}
                groupableCols={groupableCols()}
                isOpen={openDropdown() === 'group'}
                onToggle={() => toggleDd('group')}
                onClose={() => setOpenDropdown(null)}
              />
            </Show>
            <Show when={sortableCols().length > 0}>
              <SortDropdown
                table={table}
                columns={table.columns.list()}
                isOpen={openDropdown() === 'sort'}
                onToggle={() => toggleDd('sort')}
                onClose={() => setOpenDropdown(null)}
              />
            </Show>
            <Show when={endFirst()}>
              <div class="dt-toolbar-end">{toolbarEnd()}</div>
            </Show>
            <Show when={!endFirst() && hasShapeControls() && hasFindControls()}>
              <span class="dt-toolbar-divider" />
            </Show>
            <Show when={props.showSearch !== false}>
              <SearchBox table={table} />
            </Show>
            <Show when={filterableCols().length > 0}>
              <FilterDropdown
                ref={(handle) => (filterDropdown = handle)}
                table={table}
                columns={table.columns.list()}
                isOpen={openDropdown() === 'filter'}
                onToggle={() => toggleDd('filter')}
                onClose={() => setOpenDropdown(null)}
              />
            </Show>
            <Show when={hasActiveState()}>
              <button
                type="button"
                class="dt-btn dt-clear-all"
                onClick={(e) => {
                  const root = e.currentTarget.closest('.dt')
                  table.clearAll()
                  focusSearch(root)
                }}
              >
                {table.labels().clearAll}
              </button>
            </Show>
            <Show when={hasToolbarEnd() && !endFirst()}>
              <div class="dt-toolbar-end">{toolbarEnd()}</div>
            </Show>
          </div>
        </div>
      </Show>
      <ActiveBar
        table={table}
        columns={table.columns.list()}
        groupableCols={groupableCols()}
        totalRows={table.data().length}
        onOpenGroup={(key) => {
          setOpenDropdown('group')
          // Queued after Dropdown's own focus-on-open microtask, so this focus wins
          queueMicrotask(() => {
            document.querySelector<HTMLElement>(`[data-group-key="${key}"]`)?.focus()
          })
        }}
        onOpenFilter={(key) => {
          filterDropdown?.selectColumn(key)
          setOpenDropdown('filter')
          filterDropdown?.focusColumn(key)
        }}
      />
      <TableBody
        table={table}
        columns={table.columns.list()}
        selectable={props.selectable}
        onRowClick={props.onRowClick}
        currentRow={props.currentRow}
        rowClass={props.rowClass}
      />
      <Pagination table={table} />
      <div role="status" class="dt-status">
        {tableStatus(
          table.labels(),
          table.processedData().length,
          table.data().length,
          table.pagination.page(),
          table.pagination.numPages(),
        )}
      </div>
    </div>
  )
}
