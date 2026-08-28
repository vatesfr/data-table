import { For, Show, createMemo, createSignal } from 'solid-js'
import type { SortEntry } from '@vates/data-table-core'
import {
  categorizedAlphabetizedByLabel,
  getSortIcon,
  getSortIndex,
} from '@vates/data-table-core/internal'
import type { TableState } from '../createTableState'
import type { ColumnDef } from '../types'
import { Dropdown } from './Dropdown'
import { createDragReorder } from './dragReorder'
import {
  AddableColumnRow,
  CategorizedColumnList,
  DropdownClearButton,
  DropdownSearchRow,
  DropdownTriggerButton,
} from './DropdownParts'
import { withPanelRefocus } from './dropdownRowActions'

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
    return props.columns.filter((c) => c.sortable !== false && getSortIndex(sorts, c.key) === null)
  })
  const categorizedAddableCols = createMemo(() =>
    categorizedAlphabetizedByLabel(addableCols(), searchTerm()),
  )

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

  return (
    <Dropdown
      isOpen={props.isOpen}
      onToggle={props.onToggle}
      onClose={props.onClose}
      trigger={
        <DropdownTriggerButton
          active={table.sort.entries().length > 0}
          label={table.labels().sort}
          onClick={props.onToggle}
        />
      }
      extraTrigger={
        <DropdownClearButton
          show={table.sort.entries().length > 0}
          label={table.labels().clearSorts}
          onClear={table.sort.clear}
        />
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
                    withPanelRefocus(e.currentTarget, `[data-col-key="${entry.key}"]`, () =>
                      table.sort.remove(entry.key),
                    )
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
                      withPanelRefocus(e.currentTarget, `[data-sort-key="${entry.key}"]`, () =>
                        table.sort.move(entry.key, neighbor.key, delta > 0),
                      )
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
                      withPanelRefocus(e.currentTarget, `[data-col-key="${entry.key}"]`, () =>
                        table.sort.remove(entry.key),
                      )
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
        <DropdownSearchRow
          value={searchTerm()}
          onInput={setSearchTerm}
          placeholder={table.labels().filterSearchPlaceholder}
        />
        <div class="dt-dd-section">{table.labels().sortSection}</div>
        <CategorizedColumnList
          uncategorized={categorizedAddableCols().uncategorized}
          categories={categorizedAddableCols().categories}
          row={(col) => (
            <AddableColumnRow
              col={col}
              onClick={() => {
                // See DropdownParts.tsx's AddableColumnRow / GroupDropdown.tsx's identical
                // comment: a document-wide query, not a `.closest('.dt-dd')`-scoped one, since
                // this click can originate inside a portaled CategorySubmenu.
                table.sort.toggle(col.key)
                document.querySelector<HTMLElement>(`[data-sort-key="${col.key}"]`)?.focus()
              }}
            />
          )}
        />
      </Show>
    </Dropdown>
  )
}
