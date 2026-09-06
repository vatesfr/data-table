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
//
// The search box is pinned at the very top and, unlike Sort/Group, narrows *both* sections — a
// column you already show is just as often what you're hunting for (to hide/reorder it) as one
// you don't. It's mounted unconditionally (never wrapped in a `<Show>` keyed off the filtered
// result count) so it can never unmount itself out from under an actively-focused, mid-typing
// user — the bug the previous "search only narrows Available, and only renders once Available's
// *filtered* list is non-empty" version had: typing a query with zero matches unmounted the input
// itself, dropping focus to <body> with no way back short of Escape.
//
// Reordering (drag and Alt+↑/↓) stays fully live while searching rather than being disabled —
// drag already only ever operates on rows the user can see (you can't drag or drop a row that
// isn't rendered), and Alt+↑/↓'s neighbor lookup is scoped to the same search-filtered key set via
// `moveVisibleBy`'s optional 3rd param, so it only ever swaps two currently-shown rows. A column
// hidden by the search filter (or by real column visibility) is never touched — not even nudged
// in relative order — regardless of what gets reordered around it.
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

  const isSearching = createMemo(() => searchTerm().trim().length > 0)
  const orderedColumns = createMemo(() => table.columns.ordered())
  const visibleColumns = createMemo(() =>
    orderedColumns().filter((c) => table.columns.visible().has(c.key)),
  )
  const searchedVisible = createMemo(() =>
    visibleColumns().filter((c) => columnMatchesSearch(c, searchTerm())),
  )
  // Alt+↑/↓'s neighbor-eligibility set: the real visible-columns set when not searching (today's
  // behavior, unchanged), or narrowed to just the currently-shown-and-matching keys while
  // searching, so a search-filtered-out column is never chosen as a swap partner.
  const reorderEligible = createMemo<ReadonlySet<string> | undefined>(() =>
    isSearching() ? new Set(searchedVisible().map((c) => c.key)) : undefined,
  )

  const availableColumns = createMemo(() =>
    orderedColumns().filter((c) => !table.columns.visible().has(c.key)),
  )
  const searchedAvailable = createMemo(() =>
    availableColumns().filter((c) => columnMatchesSearch(c, searchTerm())),
  )
  // Only bucketed by category while *not* searching — once a search term narrows a category down
  // to one or two matches, keeping them behind a submenu trigger would force an extra hover/click
  // right when the search was supposed to shortcut that. See categorizedAvailable's own use below.
  const categorizedAvailable = createMemo(() => groupColumnsByCategory(availableColumns()))

  // Hides `col`, refocusing whatever it reappears as in Available — shared by a visible row's own
  // × button and its Delete/Backspace keyboard equivalent, since both need the same
  // search/category-aware selector (see the inline comment on that selector below for why it
  // isn't always the same one).
  function hideColumn(el: HTMLElement, col: ColumnDef<TRow>): void {
    // The column reappears in Available either as its own addable row — its usual spot, or (while
    // searching) its flattened-out-of-category spot, see categorizedAvailable above — or, when
    // categorized and *not* currently searching, inside a closed submenu with no addable row of
    // its own rendered yet, so the submenu's own trigger is the right thing to focus instead (see
    // CategorySubmenu.tsx's own comment on this data attribute).
    const selector =
      col.category && !isSearching()
        ? `.dt-dd-category-trigger[data-category-name="${col.category}"]`
        : `[data-col-key="${col.key}"]`
    withPanelRefocus(el, selector, () => table.columns.toggleVisibility(col.key))
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
        // Scoped to focus actually being in the search box — without this, Escape pressed while
        // focused on a row (e.g. after arrowing down into the list) would still silently clear a
        // non-empty search term instead of closing the dropdown on the first press, the same
        // fix already applied to the Filter dropdown's own onEscapeClearable.
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
      <div class="dt-dd-section">{table.labels().columnsSection}</div>
      <div ref={setContainer} onDragOver={handleDragOver} onDrop={handleDrop}>
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
              onKeyDown={(e) => {
                if (e.altKey && e.key === 'ArrowUp') {
                  e.preventDefault()
                  // Focus drops to <body> after this reorder without an explicit refocus (same
                  // empirically-confirmed behavior as Sort/GroupDropdown's own Alt+Arrow handlers).
                  withPanelRefocus(e.currentTarget, `[data-col-row-key="${col.key}"]`, () =>
                    table.columns.moveVisibleBy(col.key, -1, reorderEligible()),
                  )
                } else if (e.altKey && e.key === 'ArrowDown') {
                  e.preventDefault()
                  withPanelRefocus(e.currentTarget, `[data-col-row-key="${col.key}"]`, () =>
                    table.columns.moveVisibleBy(col.key, 1, reorderEligible()),
                  )
                } else if (e.key === 'Delete' || e.key === 'Backspace') {
                  // Keyboard equivalent of this row's own × button — matches the Filter
                  // dropdown's identical Delete/Backspace-on-a-focused-active-row shortcut.
                  e.preventDefault()
                  hideColumn(e.currentTarget, col)
                } else if (e.key === 'Enter' || e.key === ' ') {
                  // No click action of its own (unlike Sort's active rows, which toggle
                  // direction) — but still needs to preventDefault, or Space's native default
                  // action scrolls the nearest scrollable ancestor (this panel, or the whole page
                  // once the panel itself has nothing left to scroll) out from under the still-
                  // focused row, which reads as "focus was lost" even though it wasn't.
                  e.preventDefault()
                }
              }}
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
      <Show when={availableColumns().length > 0}>
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
                  // See DropdownParts.tsx's AddableColumnRow / SortDropdown.tsx's identical
                  // comment: a document-wide query, not a `.closest('.dt-dd')`-scoped one, since
                  // this click can originate inside a portaled CategorySubmenu.
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
