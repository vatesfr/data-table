import { For, Show, createMemo, createSignal } from 'solid-js'
import { columnMatchesSearch, groupColumnsByCategory } from '@vates/data-table-core/internal'
import type { TableState } from '../createTableState'
import type { ColumnDef } from '../types'
import { Dropdown } from './Dropdown'
import { createDragReorder } from './dragReorder'
import { AddableColumnRow, CategorizedColumnList, DropdownSearchRow } from './DropdownParts'
import { withPanelRefocus } from './dropdownRowActions'

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
// same principle instead of adopting Sort/Group's own alphabetical convention (see
// categorizedAlphabetizedByLabel, core — the shared helper Sort/Group use instead of this).
export function ColumnsDropdown<TRow extends object>(props: ColumnsDropdownProps<TRow>) {
  const { table } = props
  const [searchTerm, setSearchTerm] = createSignal('')
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
                  // Focus drops to <body> after this reorder without an explicit refocus (same
                  // empirically-confirmed behavior as Sort/GroupDropdown's own Alt+Arrow handlers).
                  withPanelRefocus(e.currentTarget, `[data-col-row-key="${col.key}"]`, () =>
                    table.columns.moveVisibleBy(col.key, -1),
                  )
                } else if (e.altKey && e.key === 'ArrowDown') {
                  e.preventDefault()
                  withPanelRefocus(e.currentTarget, `[data-col-row-key="${col.key}"]`, () =>
                    table.columns.moveVisibleBy(col.key, 1),
                  )
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
                  // The column reappears in Available either as its own addable row, or — if
                  // categorized — inside a *closed* submenu with no addable row of its own
                  // rendered yet, so the submenu's own trigger is the right thing to focus instead
                  // (see CategorySubmenu.tsx's own comment on this data attribute).
                  const selector = col.category
                    ? `.dt-dd-category-trigger[data-category-name="${col.category}"]`
                    : `[data-col-key="${col.key}"]`
                  withPanelRefocus(e.currentTarget, selector, () =>
                    table.columns.toggleVisibility(col.key),
                  )
                }}
              >
                ×
              </button>
            </div>
          )}
        </For>
      </div>
      <Show when={searchedAvailable().length > 0}>
        <DropdownSearchRow
          value={searchTerm()}
          onInput={setSearchTerm}
          placeholder={table.labels().filterSearchPlaceholder}
        />
        <div class="dt-dd-section">{table.labels().availableColumnsSection}</div>
        <CategorizedColumnList
          uncategorized={categorizedAvailable().uncategorized}
          categories={categorizedAvailable().categories}
          row={(col) => (
            <AddableColumnRow
              col={col}
              onClick={() => {
                // See DropdownParts.tsx's AddableColumnRow / SortDropdown.tsx's identical comment:
                // a document-wide query, not a `.closest('.dt-dd')`-scoped one, since this click
                // can originate inside a portaled CategorySubmenu.
                table.columns.toggleVisibility(col.key)
                document.querySelector<HTMLElement>(`[data-col-row-key="${col.key}"]`)?.focus()
              }}
            />
          )}
        />
      </Show>
    </Dropdown>
  )
}
