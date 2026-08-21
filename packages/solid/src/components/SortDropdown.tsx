import { For, Show, createMemo, createSignal } from 'solid-js'
import { getSortIcon, getSortIndex, type SortEntry } from '@vates/data-table-core'
import type { TableState } from '../createTableState'
import type { ColumnDef } from '../types'
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
    const term = searchTerm().trim().toLowerCase()
    return props.columns
      .filter((c) => c.sortable !== false && getSortIndex(sorts, c.key) === null)
      .filter((c) => !term || c.label.toLowerCase().includes(term))
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label))
  })

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
    >
      <Show when={table.sort.entries().length > 0}>
        <div class="dt-dd-section">{table.labels().activeSortsSection}</div>
        <div ref={setContainer} onDragOver={handleDragOver} onDrop={handleDrop}>
          <For each={table.sort.entries()}>
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
                  data-sort-key={entry.key}
                  onDragStart={() => onRowDragStart(entry.key)}
                  onDragEnd={onRowDragEnd}
                  onClick={() => table.sort.toggleDir(entry.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      table.sort.toggleDir(entry.key)
                    } else if (e.altKey && e.key === 'ArrowUp') {
                      e.preventDefault()
                      table.sort.moveBy(entry.key, -1)
                    } else if (e.altKey && e.key === 'ArrowDown') {
                      e.preventDefault()
                      table.sort.moveBy(entry.key, 1)
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
                      table.sort.remove(entry.key)
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
            placeholder={table.labels().filterSearchPlaceholder}
            value={searchTerm()}
            onInput={(e) => setSearchTerm(e.currentTarget.value)}
          />
        </div>
        <div class="dt-dd-section">{table.labels().sortSection}</div>
        <For each={addableCols()}>
          {(col) => (
            <button
              type="button"
              class="dt-dd-item dt-dd-item--click"
              onClick={() => table.sort.toggle(col.key)}
            >
              <span class="dt-flex1">{col.label}</span>
            </button>
          )}
        </For>
      </Show>
    </Dropdown>
  )
}
