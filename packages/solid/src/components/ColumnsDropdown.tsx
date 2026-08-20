import { For, createMemo, createSignal } from 'solid-js'
import type { TableState } from '../createTableState'
import type { ColumnDef } from '../types'
import { Dropdown } from './Dropdown'
import { resolveDropRow } from './dragReorder'

interface ColumnsDropdownProps<TRow extends object> {
  table: TableState<TRow>
  columns: ColumnDef<TRow>[]
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}

// Mirrors CLAUDE.md's "Column reordering": lists every column (visible or not) in
// orderedColumns' display order — this list doubles as the drag-to-reorder surface, so unlike
// Sort/Group's addable lists it's deliberately NOT alphabetized. Each row is draggable and
// supports Alt+ArrowUp/Down (fired on the row itself, since the checkbox inside is the only
// native Tab stop — same "no dedicated tabindex on the row" reasoning as the old version, see
// CLAUDE.md's "Dropdown column search and keyboard navigation" -> "Vanilla").
export function ColumnsDropdown<TRow extends object>(props: ColumnsDropdownProps<TRow>) {
  const { table } = props
  const [searchTerm, setSearchTerm] = createSignal('')
  const [dragKey, setDragKey] = createSignal<string | null>(null)
  const [dragOverKey, setDragOverKey] = createSignal<string | null>(null)
  const [dragOverAfter, setDragOverAfter] = createSignal(false)

  const orderedColumns = createMemo(() => table.columns.ordered())
  const searchedColumns = createMemo(() => {
    const term = searchTerm().trim().toLowerCase()
    return term
      ? orderedColumns().filter((c) => c.label.toLowerCase().includes(term))
      : orderedColumns()
  })

  let rowsContainer: HTMLDivElement | undefined
  function rowEls(): { key: string; el: HTMLElement }[] {
    if (!rowsContainer) return []
    return [...rowsContainer.querySelectorAll<HTMLElement>('[data-col-row-key]')].map((el) => ({
      key: el.dataset.colRowKey!,
      el,
    }))
  }
  function handleDragOver(e: DragEvent): void {
    e.preventDefault()
    const hit = resolveDropRow(e.clientY, rowEls())
    if (hit) {
      setDragOverKey(hit.key)
      setDragOverAfter(hit.after)
    }
  }
  function handleDrop(e: DragEvent): void {
    e.preventDefault()
    const from = dragKey()
    const hit = resolveDropRow(e.clientY, rowEls())
    if (from && hit && hit.key !== from) table.columns.move(from, hit.key, hit.after)
    setDragKey(null)
    setDragOverKey(null)
  }

  return (
    <Dropdown
      isOpen={props.isOpen}
      onToggle={props.onToggle}
      onClose={props.onClose}
      trigger={
        <button type="button" class="dt-btn" onClick={props.onToggle}>
          {table.labels.columns}
        </button>
      }
    >
      <div class="dt-dd-search-row">
        <input
          type="text"
          class="dt-dd-search"
          placeholder={table.labels.filterSearchPlaceholder}
          value={searchTerm()}
          onInput={(e) => setSearchTerm(e.currentTarget.value)}
        />
      </div>
      <div class="dt-dd-section">{table.labels.columnsSection}</div>
      <div ref={rowsContainer} onDragOver={handleDragOver} onDrop={handleDrop}>
        <For each={searchedColumns()}>
          {(col) => (
            <div
              class="dt-dd-item dt-dd-item--col dt-dd-item--colrow"
              classList={{
                'dt-dd-item--drag-over': dragOverKey() === col.key && !dragOverAfter(),
                'dt-dd-item--drag-over-after': dragOverKey() === col.key && dragOverAfter(),
              }}
              draggable="true"
              data-col-row-key={col.key}
              onDragStart={() => setDragKey(col.key)}
              onDragEnd={() => {
                setDragKey(null)
                setDragOverKey(null)
              }}
            >
              <label class="dt-flex1">
                <input
                  type="checkbox"
                  checked={table.columns.visible().has(col.key)}
                  onClick={() => table.columns.toggleVisibility(col.key)}
                  onKeyDown={(e) => {
                    if (e.altKey && e.key === 'ArrowUp') {
                      e.preventDefault()
                      table.columns.moveBy(col.key, -1)
                    } else if (e.altKey && e.key === 'ArrowDown') {
                      e.preventDefault()
                      table.columns.moveBy(col.key, 1)
                    }
                  }}
                />{' '}
                {col.label}
              </label>
            </div>
          )}
        </For>
      </div>
    </Dropdown>
  )
}
