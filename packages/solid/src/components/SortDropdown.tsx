import { For, Show, createMemo, createSignal } from 'solid-js'
import type { SortEntry } from '@vates/data-table-core'
import {
  alphabetizedByLabel,
  getSortIcon,
  getSortIndex,
  groupColumnsByCategory,
} from '@vates/data-table-core/internal'
import type { TableState } from '../createTableState'
import type { ColumnDef } from '../types'
import { CategorySubmenu } from './CategorySubmenu'
import { Dropdown } from './Dropdown'
import { createDragReorder } from './dragReorder'

interface SortDropdownProps<TRow extends object> {
  table: TableState<TRow>
  columns: ColumnDef<TRow>[]
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}

// Mirrors the Sort dropdown described in CLAUDE.md's "Header click sorting"/"Column reordering":
// active entries (priority order, reorderable, direction-toggle-on-click) above a search-narrowed,
// alphabetized "add" list below. Drag-and-drop reordering of active entries is the first real test
// of native HTML5 DnD against Solid's reactivity (see the migration plan's flagged risk) — it
// works the same way it will for the Columns dropdown later: drag feedback (drag-over highlight)
// is applied directly via a signal read by the dragged/hovered rows' own `classList`-equivalent
// (Solid's `classList`/`class` binding), and the actual reorder only commits on `drop`, exactly
// like the old vanilla code's own "don't destroy the dragged node mid-drag" rule — except here
// Solid's diffing means a mid-drag re-render was never going to destroy the node in the first
// place; the drop-only commit is kept anyway purely to match drag semantics (you don't want the
// list order visibly jumping around before the user has committed to a position).
export function SortDropdown<TRow extends object>(props: SortDropdownProps<TRow>) {
  const { table } = props
  const [searchTerm, setSearchTerm] = createSignal('')
  // Which category submenu is open — a single shared value (not one signal per CategorySubmenu)
  // so opening one always closes any other that was open, see CategorySubmenu.tsx's own doc.
  const [openCategory, setOpenCategory] = createSignal<string | null>(null)
  // Activating an addable column (moving it into the active section) or removing an active one
  // (moving it back to addable) re-renders a structurally different part of the tree — the
  // element that had focus is gone, so focus would silently drop to <body> without this. Solid's
  // signal writes (table.sort.toggle/remove) update the DOM synchronously within this same
  // handler, so the new element already exists by the time `.focus()` runs right after — no
  // pending-ref/effect indirection needed the way React/Vue's async re-render requires. The panel
  // element (via `closest`, no ref of our own needed) must be resolved *before* the mutating call
  // for the "remove" direction — the clicked × button is itself removed from the DOM as a
  // synchronous side effect of that call, so `.closest()` on it afterward would find nothing.
  function panelOf(el: HTMLElement): ParentNode | null {
    return el.closest('.dt-dd')
  }
  const {
    dragOverKey,
    dragOverAfter,
    setContainer,
    onRowDragStart,
    onRowDragEnd,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  } = createDragReorder('data-sort-key', table.sort.move)

  const addableCols = createMemo(() => {
    const sorts = table.sort.entries()
    const notYetActive = props.columns.filter(
      (c) => c.sortable !== false && getSortIndex(sorts, c.key) === null,
    )
    return alphabetizedByLabel(notYetActive, searchTerm())
  })
  // Buckets the (already searched/alphabetized) addable list by category — see CLAUDE.md's
  // "Column categories". Categories themselves are alphabetized too, matching this list's own
  // existing ordering scheme for everything else in it.
  const categorizedAddableCols = createMemo(() => {
    const { uncategorized, categories } = groupColumnsByCategory(addableCols())
    return {
      uncategorized,
      categories: categories.slice().sort((a, b) => a.name.localeCompare(b.name)),
    }
  })

  // Split the active list in two: entries matching a currently grouped column always govern
  // nesting order (`sortWithinGroups` reads that off `groupBy`'s own order, never off drag
  // position within `sorts` — see CLAUDE.md's "Auto-syncing group order with sort") and entries
  // for everything else, which is the actual freely-reorderable tie-break priority stack. Mixing
  // both into one flat draggable list made it look like dragging a tie-break column above a
  // group column changed something when it never could — see issue #17's follow-up. `groupEntries`
  // is in `groupBy`'s own order (skipping a grouped column with no matching sort entry — nothing
  // to show there), matching what actually governs nesting.
  const groupEntries = createMemo(() => {
    const sorts = table.sort.entries()
    return table.group
      .by()
      .map((key) => sorts.find((s) => s.key === key))
      .filter((s): s is SortEntry => s !== undefined)
  })
  const nonGroupEntries = createMemo(() => {
    const groupBy = table.group.by()
    return table.sort.entries().filter((s) => !groupBy.includes(s.key))
  })

  // One addable-column row — shared by the flat uncategorized list and each category submenu. A
  // click here can originate *inside* a portaled CategorySubmenu (see that file's own comment),
  // where `panelOf`'s `.closest('.dt-dd')` finds nothing — the submenu isn't a DOM descendant of
  // the panel at all. Looked up via `document.querySelector` instead, safe because only one
  // dropdown panel is ever open at a time (the toolbar's Columns/Sort/Group/Filter dropdowns share
  // one `openDropdown` signal), so there's never more than one `[data-sort-key]` match to collide
  // with. Confirmed empirically: without this, activating a categorized column silently dropped
  // focus to <body> instead of landing on its new active row.
  function AddableColRow(rowProps: { col: ColumnDef<TRow> }) {
    const col = rowProps.col
    return (
      <button
        type="button"
        class="dt-dd-item dt-dd-item--click"
        data-dd-row
        data-col-key={col.key}
        onClick={() => {
          table.sort.toggle(col.key)
          document.querySelector<HTMLElement>(`[data-sort-key="${col.key}"]`)?.focus()
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
        <button
          type="button"
          class={`dt-btn${table.sort.entries().length > 0 ? ' dt-btn--active dt-btn--grouped' : ''}`}
          onClick={props.onToggle}
        >
          {table.labels().sort}
        </button>
      }
      extraTrigger={
        <Show when={table.sort.entries().length > 0}>
          <button
            type="button"
            class="dt-btn-clear"
            title={table.labels().clearSorts}
            aria-label={table.labels().clearSorts}
            onClick={table.sort.clear}
          >
            ×
          </button>
        </Show>
      }
      onEscapeClearable={() => {
        if (!searchTerm()) return false
        setSearchTerm('')
        return true
      }}
    >
      <Show when={groupEntries().length > 0}>
        <div class="dt-dd-section">{table.labels().groupOrderSection}</div>
        <div class="dt-dd-hint">{table.labels().groupOrderHint}</div>
        <For each={groupEntries()}>
          {(entry: SortEntry, i) => {
            const col = () => props.columns.find((c) => c.key === entry.key)
            return (
              // Not draggable, no Alt+Arrow reorder — nesting order always follows groupBy's own
              // order (see the Group dropdown), so reordering here would be a no-op; direction is
              // still toggleable/removable in place, same as any other sort entry.
              <div
                class="dt-dd-item dt-dd-item--col dt-dd-item--sortrow dt-dd-item--locked"
                tabIndex={0}
                data-dd-row
                onClick={() => table.sort.toggleDir(entry.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    table.sort.toggleDir(entry.key)
                  }
                }}
              >
                <span class="dt-sort-idx">{i() + 1}</span>
                <span class="dt-flex1">{col()?.label ?? entry.key}</span>
                <span class="dt-sort-icon dt-sort-icon--active">
                  {getSortIcon(table.sort.entries(), entry.key)}
                </span>
                <button
                  type="button"
                  class="dt-item-remove"
                  draggable={false}
                  onClick={(e) => {
                    e.stopPropagation()
                    const panel = panelOf(e.currentTarget)
                    table.sort.remove(entry.key)
                    panel?.querySelector<HTMLElement>(`[data-col-key="${entry.key}"]`)?.focus()
                  }}
                >
                  ×
                </button>
              </div>
            )
          }}
        </For>
      </Show>
      <Show when={nonGroupEntries().length > 0}>
        <div class="dt-dd-section">{table.labels().activeSortsSection}</div>
        <div ref={setContainer} onDragOver={handleDragOver} onDrop={handleDrop}>
          <For each={nonGroupEntries()}>
            {(entry: SortEntry, i) => {
              const col = () => props.columns.find((c) => c.key === entry.key)
              return (
                <div
                  class="dt-dd-item dt-dd-item--col dt-dd-item--sortrow"
                  classList={{
                    'dt-dd-item--drag-over': dragOverKey() === entry.key && !dragOverAfter(),
                    'dt-dd-item--drag-over-after': dragOverKey() === entry.key && dragOverAfter(),
                  }}
                  draggable="true"
                  tabIndex={0}
                  data-dd-row
                  data-sort-key={entry.key}
                  onDragStart={() => onRowDragStart(entry.key)}
                  onDragEnd={onRowDragEnd}
                  onClick={() => table.sort.toggleDir(entry.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      table.sort.toggleDir(entry.key)
                    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                      e.preventDefault()
                      // Swap with the neighbor within this non-group subset (by key, via
                      // reorderSort), not the raw sorts-array neighbor (moveSortBy) — a group
                      // entry can sit between two non-group ones in the underlying array, and
                      // swapping with it would silently do nothing visible in this section.
                      const list = nonGroupEntries()
                      const delta = e.key === 'ArrowUp' ? -1 : 1
                      const neighbor = list[i() + delta]
                      if (!neighbor) return
                      const panel = panelOf(e.currentTarget)
                      table.sort.move(entry.key, neighbor.key, delta > 0)
                      // Focus drops to <body> after this reorder without an explicit refocus —
                      // confirmed empirically (unlike activate/remove, where the same-node-identity
                      // reasoning above actually holds). Refocus by key, same pattern as every
                      // other row mutation in this file, rather than relying on `e.currentTarget`
                      // still being the right element post-reorder.
                      panel?.querySelector<HTMLElement>(`[data-sort-key="${entry.key}"]`)?.focus()
                    }
                  }}
                >
                  <span class="dt-sort-idx">{i() + 1}</span>
                  <span class="dt-flex1">{col()?.label ?? entry.key}</span>
                  <span class="dt-sort-icon dt-sort-icon--active">
                    {getSortIcon(table.sort.entries(), entry.key)}
                  </span>
                  <button
                    type="button"
                    class="dt-item-remove"
                    draggable={false}
                    onClick={(e) => {
                      e.stopPropagation()
                      const panel = panelOf(e.currentTarget)
                      table.sort.remove(entry.key)
                      panel?.querySelector<HTMLElement>(`[data-col-key="${entry.key}"]`)?.focus()
                    }}
                  >
                    ×
                  </button>
                </div>
              )
            }}
          </For>
        </div>
      </Show>
      <Show when={addableCols().length > 0}>
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
        <div class="dt-dd-section">{table.labels().sortSection}</div>
        <For each={categorizedAddableCols().uncategorized}>
          {(col) => <AddableColRow col={col} />}
        </For>
        <For each={categorizedAddableCols().categories}>
          {(category) => (
            <CategorySubmenu
              name={category.name}
              isOpen={openCategory() === category.name}
              onOpen={() => setOpenCategory(category.name)}
              onClose={() => setOpenCategory((c) => (c === category.name ? null : c))}
            >
              <For each={category.columns}>{(col) => <AddableColRow col={col} />}</For>
            </CategorySubmenu>
          )}
        </For>
      </Show>
    </Dropdown>
  )
}
