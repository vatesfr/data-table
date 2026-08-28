import { For, Show, createMemo, createSignal } from 'solid-js'
import { columnMatchesSearch, groupColumnsByCategory } from '@vates/data-table-core/internal'
import type { TableState } from '../createTableState'
import type { ColumnDef } from '../types'
import { CategorySubmenu } from './CategorySubmenu'
import { Dropdown } from './Dropdown'
import { createDragReorder } from './dragReorder'

interface ColumnsDropdownProps<TRow extends object> {
  table: TableState<TRow>
  columns: ColumnDef<TRow>[]
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}

// Mirrors CLAUDE.md's "Columns dropdown": a "Visible columns" section (every column the user has
// chosen to show — table.columns.visible(), not table.columns.active(), so a column merely hidden
// *by grouping* still counts as visible here — draggable/Alt+↑↓-reorderable, exactly the flat
// list this dropdown always was) above an "Available columns" section (hidden columns, click to
// show; a categorized one collapses into a CategorySubmenu — see that file's own doc). This is the
// same active/addable split Sort/Group already use, replacing the single all-columns-with-a-
// checkbox list this dropdown used before category submenus existed — a checkbox no longer fit
// once "shown" and "hidden" needed visually distinct rows (draggable + remove vs. plain click-to-
// add), the same reason Sort/Group never used one either.
//
// Reordering only ever happens within Visible — Available is click-only, so nesting it into
// category submenus (impossible for Visible, since submenu rows can't also be a drag surface —
// see CategorySubmenu.tsx) creates no conflict. A newly-shown column reappears in Visible at
// whatever position table.columns.ordered() already puts it — its last dragged position, or
// definition order if never dragged — with no new logic needed: columnOrder never actually
// changes when visibility toggles, only when something is dragged/Alt+↑↓'d. The one thing this
// drops versus the old single-list UI: pre-positioning a *hidden* column by dragging it before
// ever showing it. That's an intentionally accepted tradeoff, not an oversight — Sort/Group never
// supported "reorder before adding" either.
//
// Unlike Sort/Group's addable lists, Available is deliberately NOT alphabetized, and its
// categories are NOT re-sorted after groupColumnsByCategory — this dropdown has never alphabetized
// anything (its whole identity is "shows real column/definition order"), so Available keeps that
// same principle instead of adopting Sort/Group's own alphabetical convention.
export function ColumnsDropdown<TRow extends object>(props: ColumnsDropdownProps<TRow>) {
  const { table } = props
  const [searchTerm, setSearchTerm] = createSignal('')
  const [openCategory, setOpenCategory] = createSignal<string | null>(null)
  const {
    dragOverKey,
    dragOverAfter,
    setContainer,
    onRowDragStart,
    onRowDragEnd,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  } = createDragReorder('data-col-row-key', table.columns.move)

  const orderedColumns = createMemo(() => table.columns.ordered())
  const visibleColumns = createMemo(() =>
    orderedColumns().filter((c) => table.columns.visible().has(c.key)),
  )
  // Search narrows Available only, matching Sort/Group (where search never touches the active
  // section) — Visible is usually short enough to just scan, and the point of search here is
  // finding something to *add*.
  const searchedAvailable = createMemo(() => {
    const available = orderedColumns().filter((c) => !table.columns.visible().has(c.key))
    return available.filter((c) => columnMatchesSearch(c, searchTerm()))
  })
  const categorizedAvailable = createMemo(() => groupColumnsByCategory(searchedAvailable()))

  // One addable-column row — shared by the flat uncategorized list and each category submenu. See
  // SortDropdown.tsx's identical AddableColRow comment for why this is a document-wide query
  // rather than a `.closest('.dt-dd')`-scoped one: a click here can originate inside a portaled
  // CategorySubmenu, which isn't a DOM descendant of the panel.
  function AvailableColRow(rowProps: { col: ColumnDef<TRow> }) {
    const col = rowProps.col
    return (
      <button
        type="button"
        class="dt-dd-item dt-dd-item--click"
        data-dd-row
        data-col-key={col.key}
        onClick={() => {
          table.columns.toggleVisibility(col.key)
          document.querySelector<HTMLElement>(`[data-col-row-key="${col.key}"]`)?.focus()
        }}
      >
        <span class="dt-flex1">{col.label}</span>
      </button>
    )
  }

  return (
    <Dropdown
      isOpen={props.isOpen}
      onToggle={props.onToggle}
      onClose={props.onClose}
      trigger={
        <button type="button" class="dt-btn" onClick={props.onToggle}>
          {table.labels().columns}
        </button>
      }
      onEscapeClearable={() => {
        if (!searchTerm()) return false
        setSearchTerm('')
        return true
      }}
    >
      <div class="dt-dd-section">{table.labels().columnsSection}</div>
      <div ref={setContainer} onDragOver={handleDragOver} onDrop={handleDrop}>
        <For each={visibleColumns()}>
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
              onKeyDown={(e) => {
                if (e.altKey && e.key === 'ArrowUp') {
                  e.preventDefault()
                  table.columns.moveVisibleBy(col.key, -1)
                  // Focus drops to <body> after this reorder without an explicit refocus (same
                  // empirically-confirmed behavior as Sort/GroupDropdown's own Alt+Arrow handlers).
                  document.querySelector<HTMLElement>(`[data-col-row-key="${col.key}"]`)?.focus()
                } else if (e.altKey && e.key === 'ArrowDown') {
                  e.preventDefault()
                  table.columns.moveVisibleBy(col.key, 1)
                  document.querySelector<HTMLElement>(`[data-col-row-key="${col.key}"]`)?.focus()
                }
              }}
            >
              <span class="dt-flex1">{col.label}</span>
              <button
                type="button"
                class="dt-item-remove"
                draggable={false}
                onClick={(e) => {
                  e.stopPropagation()
                  table.columns.toggleVisibility(col.key)
                  // The column reappears in Available either as its own addable row, or — if
                  // categorized — inside a *closed* submenu with no addable row of its own
                  // rendered yet, so the submenu's own trigger is the right thing to focus instead
                  // (see CategorySubmenu.tsx's own comment on this data attribute).
                  const selector = col.category
                    ? `.dt-dd-category-trigger[data-category-name="${col.category}"]`
                    : `[data-col-key="${col.key}"]`
                  document.querySelector<HTMLElement>(selector)?.focus()
                }}
              >
                ×
              </button>
            </div>
          )}
        </For>
      </div>
      <Show when={searchedAvailable().length > 0}>
        <div class="dt-dd-search-row">
          <input
            type="text"
            class="dt-dd-search"
            data-dd-search
            placeholder={table.labels().filterSearchPlaceholder}
            value={searchTerm()}
            onInput={(e) => setSearchTerm(e.currentTarget.value)}
          />
        </div>
        <div class="dt-dd-section">{table.labels().availableColumnsSection}</div>
        <For each={categorizedAvailable().uncategorized}>
          {(col) => <AvailableColRow col={col} />}
        </For>
        <For each={categorizedAvailable().categories}>
          {(category) => (
            <CategorySubmenu
              name={category.name}
              isOpen={openCategory() === category.name}
              onOpen={() => setOpenCategory(category.name)}
              onClose={() => setOpenCategory((c) => (c === category.name ? null : c))}
            >
              <For each={category.columns}>{(col) => <AvailableColRow col={col} />}</For>
            </CategorySubmenu>
          )}
        </For>
      </Show>
    </Dropdown>
  )
}
