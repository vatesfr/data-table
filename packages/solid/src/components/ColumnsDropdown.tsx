import { For, Show, createMemo, createSignal } from 'solid-js'
import { activeRowKeyDown, columnsDropdownLists } from '@vates/data-table-core/internal'
import type { TableState } from '../createTableState'
import type { ColumnDef } from '../types'
import { Dropdown } from './Dropdown'
import { createDragReorder } from './dragReorder'
import {
  AddableColumnRow,
  CategorizedColumnList,
  DropdownSearchRow,
  NoMatchingColumns,
} from './DropdownParts'
import { withPanelRefocus } from './dropdownRowActions'

interface ColumnsDropdownProps<TRow extends object> {
  table: TableState<TRow>
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}

// The Columns dropdown: Visible and Available sections, see docs/columns.md's "Columns dropdown"
export function ColumnsDropdown<TRow extends object>(props: ColumnsDropdownProps<TRow>) {
  const { table } = props
  const [searchTerm, setSearchTerm] = createSignal('')
  const {
    dragOverKey,
    dragOverAfter,
    onRowDragStart,
    onRowDragEnd,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  } = createDragReorder('data-col-row-key', table.columns.move)

  const lists = createMemo(() =>
    columnsDropdownLists(table.columns.ordered(), table.columns.visible(), searchTerm()),
  )
  const isSearching = () => lists()[0]
  const searchedVisible = () => lists()[1]
  const searchedAvailable = () => lists()[2]
  const categorizedAvailable = () => lists()[3]
  const reorderEligible = () => lists()[4]

  // Hides `col` and refocuses what it reappears as in Available (× and Delete/Backspace)
  function hideColumn(el: HTMLElement, col: ColumnDef<TRow>): void {
    // Categorized and not searching: it lands in a closed submenu, so focus that submenu's trigger
    const selector =
      col.category && !isSearching()
        ? `.dt-dd-category-trigger[data-category-name="${col.category}"]`
        : `[data-col-key="${col.key}"]`
    withPanelRefocus(el, selector, () => table.columns.toggleVisibility(col.key))
  }

  return (
    <Dropdown
      isOpen={props.isOpen}
      onClose={props.onClose}
      trigger={
        <button type="button" class="dt-btn" onClick={props.onToggle}>
          {table.labels().columns}
        </button>
      }
      onEscapeClearable={() => {
        // Only from the search box: Escape on a row closes rather than clearing the search
        if (!document.activeElement?.matches?.('.dt-dd-search')) return false
        if (!searchTerm()) return false
        setSearchTerm('')
        return true
      }}
    >
      <DropdownSearchRow
        value={searchTerm()}
        onInput={setSearchTerm}
        placeholder={table.labels().filterSearchPlaceholder}
        clearLabel={table.labels().clearSearch}
      />
      <Show when={searchedVisible().length > 0}>
        <div class="dt-dd-section">{table.labels().columnsSection}</div>
      </Show>
      <div onDragOver={handleDragOver} onDrop={handleDrop}>
        <For each={searchedVisible()}>
          {(col) => (
            <div
              class="dt-dd-item dt-dd-item--col dt-dd-item--colrow"
              classList={{
                'dt-dd-item--drag-over': dragOverKey() === col.key && !dragOverAfter(),
                'dt-dd-item--drag-over-after': dragOverKey() === col.key && dragOverAfter(),
              }}
              draggable="true"
              tabIndex={0}
              data-dd-row
              data-col-row-key={col.key}
              onDragStart={() => onRowDragStart(col.key)}
              onDragEnd={onRowDragEnd}
              onKeyDown={(e) =>
                activeRowKeyDown(
                  e,
                  (delta) =>
                    // Focus drops to <body> after this reorder without an explicit refocus
                    withPanelRefocus(e.currentTarget, `[data-col-row-key="${col.key}"]`, () =>
                      table.columns.moveVisibleBy(col.key, delta, reorderEligible()),
                    ),
                  () => hideColumn(e.currentTarget, col),
                )
              }
            >
              <span class="dt-dd-drag-handle" aria-hidden="true">
                ⠿
              </span>
              <span class="dt-flex1">{col.label}</span>
              <button
                type="button"
                class="dt-item-remove"
                title={table.labels().hideColumn}
                aria-label={table.labels().hideColumn}
                draggable={false}
                onClick={(e) => {
                  e.stopPropagation()
                  hideColumn(e.currentTarget, col)
                }}
              >
                ×
              </button>
            </div>
          )}
        </For>
      </div>
      <NoMatchingColumns
        when={searchedVisible().length === 0 && searchedAvailable().length === 0}
        label={table.labels().noMatchingColumns}
      />
      <Show when={searchedAvailable().length > 0}>
        <div class="dt-dd-section">{table.labels().availableColumnsSection}</div>
        <Show
          when={!isSearching()}
          fallback={
            <For each={searchedAvailable()}>
              {(col) => (
                <AddableColumnRow
                  col={col}
                  showCategory
                  onClick={() => {
                    table.columns.toggleVisibility(col.key)
                    document.querySelector<HTMLElement>(`[data-col-row-key="${col.key}"]`)?.focus()
                  }}
                />
              )}
            </For>
          }
        >
          <CategorizedColumnList
            uncategorized={categorizedAvailable().uncategorized}
            categories={categorizedAvailable().categories}
            row={(col) => (
              <AddableColumnRow
                col={col}
                onClick={() => {
                  table.columns.toggleVisibility(col.key)
                  document.querySelector<HTMLElement>(`[data-col-row-key="${col.key}"]`)?.focus()
                }}
              />
            )}
          />
        </Show>
      </Show>
    </Dropdown>
  )
}
