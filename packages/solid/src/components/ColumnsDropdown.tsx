import { For, createMemo, createSignal } from 'solid-js'
import type { TableState } from '../createTableState'
import type { ColumnDef } from '../types'
import { Dropdown } from './Dropdown'
import { createDragReorder } from './dragReorder'

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
  const searchedColumns = createMemo(() => {
    const term = searchTerm().trim().toLowerCase()
    return term
      ? orderedColumns().filter((c) => c.label.toLowerCase().includes(term))
      : orderedColumns()
  })

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
      <div class="dt-dd-section">{table.labels().columnsSection}</div>
      <div ref={setContainer} onDragOver={handleDragOver} onDrop={handleDrop}>
        <For each={searchedColumns()}>
          {(col) => (
            <div
              class="dt-dd-item dt-dd-item--col dt-dd-item--colrow"
              classList={{
                'dt-dd-item--drag-over': dragOverKey() === col.key && !dragOverAfter(),
                'dt-dd-item--drag-over-after': dragOverKey() === col.key && dragOverAfter(),
              }}
              draggable="true"
              data-dd-row
              data-col-row-key={col.key}
              onDragStart={() => onRowDragStart(col.key)}
              onDragEnd={onRowDragEnd}
            >
              <label class="dt-flex1">
                <input
                  type="checkbox"
                  checked={table.columns.visible().has(col.key)}
                  onClick={() => table.columns.toggleVisibility(col.key)}
                  onKeyDown={(e) => {
                    if (e.altKey && e.key === 'ArrowUp') {
                      e.preventDefault()
                      const panel = e.currentTarget.closest('.dt-dd')
                      table.columns.moveBy(col.key, -1)
                      // Focus drops to <body> after this reorder without an explicit refocus
                      // (confirmed empirically) — refocus the checkbox by its row's key, same
                      // reasoning as Sort/GroupDropdown's own Alt+Arrow handlers.
                      panel
                        ?.querySelector<HTMLElement>(`[data-col-row-key="${col.key}"] input`)
                        ?.focus()
                    } else if (e.altKey && e.key === 'ArrowDown') {
                      e.preventDefault()
                      const panel = e.currentTarget.closest('.dt-dd')
                      table.columns.moveBy(col.key, 1)
                      panel
                        ?.querySelector<HTMLElement>(`[data-col-row-key="${col.key}"] input`)
                        ?.focus()
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
