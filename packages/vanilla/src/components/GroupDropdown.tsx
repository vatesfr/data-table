import { For, Show, createMemo, createSignal } from 'solid-js'
import type { TableState } from '../createTableState'
import type { ColumnDef } from '../types'
import { Dropdown } from './Dropdown'
import { resolveDropRow } from './dragReorder'

interface GroupDropdownProps<TRow extends object> {
  table: TableState<TRow>
  groupableCols: ColumnDef<TRow>[]
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}

// Same active/add split as SortDropdown, but a group entry has no click action of its own (no
// direction to toggle) — the row is draggable/focusable for reordering only, with × as the sole
// button. See CLAUDE.md's "Grouped columns"/"Column reordering".
export function GroupDropdown<TRow extends object>(props: GroupDropdownProps<TRow>) {
  const { table } = props
  const [searchTerm, setSearchTerm] = createSignal('')
  const [dragKey, setDragKey] = createSignal<string | null>(null)
  const [dragOverKey, setDragOverKey] = createSignal<string | null>(null)
  const [dragOverAfter, setDragOverAfter] = createSignal(false)

  const addableCols = createMemo(() => {
    const groupBy = table.groupBy()
    const term = searchTerm().trim().toLowerCase()
    return props.groupableCols
      .filter((c) => !groupBy.includes(c.key))
      .filter((c) => !term || c.label.toLowerCase().includes(term))
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label))
  })

  let rowsContainer: HTMLDivElement | undefined
  function rowEls(): { key: string; el: HTMLElement }[] {
    if (!rowsContainer) return []
    return [...rowsContainer.querySelectorAll<HTMLElement>('[data-group-key]')].map((el) => ({
      key: el.dataset.groupKey!,
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
    if (from && hit && hit.key !== from) table.moveGroup(from, hit.key, hit.after)
    setDragKey(null)
    setDragOverKey(null)
  }

  return (
    <Dropdown
      isOpen={props.isOpen}
      onToggle={props.onToggle}
      onClose={props.onClose}
      trigger={
        <button
          type="button"
          class={`dt-btn${table.groupBy().length > 0 ? ' dt-btn--active dt-btn--grouped' : ''}`}
          onClick={props.onToggle}
        >
          {table.L.group}
        </button>
      }
      extraTrigger={
        <Show when={table.groupBy().length > 0}>
          <button
            type="button"
            class="dt-btn-clear"
            title={table.L.clearGroups}
            aria-label={table.L.clearGroups}
            onClick={table.clearGroups}
          >
            ×
          </button>
        </Show>
      }
    >
      <Show when={table.groupBy().length > 0}>
        <div class="dt-dd-section">{table.L.activeGroupsSection}</div>
        <div ref={rowsContainer} onDragOver={handleDragOver} onDrop={handleDrop}>
          <For each={table.groupBy()}>
            {(key, i) => {
              const col = () => props.groupableCols.find((c) => c.key === key)
              return (
                <div
                  class="dt-dd-item dt-dd-item--col dt-dd-item--grouprow"
                  classList={{
                    'dt-dd-item--drag-over': dragOverKey() === key && !dragOverAfter(),
                    'dt-dd-item--drag-over-after': dragOverKey() === key && dragOverAfter(),
                  }}
                  draggable="true"
                  tabIndex={0}
                  data-group-key={key}
                  onDragStart={() => setDragKey(key)}
                  onDragEnd={() => {
                    setDragKey(null)
                    setDragOverKey(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.altKey && e.key === 'ArrowUp') {
                      e.preventDefault()
                      table.moveGroupBy(key, -1)
                    } else if (e.altKey && e.key === 'ArrowDown') {
                      e.preventDefault()
                      table.moveGroupBy(key, 1)
                    }
                  }}
                >
                  <span class="dt-sort-idx">{i() + 1}</span>
                  <span class="dt-flex1">{col()?.label ?? key}</span>
                  <button
                    type="button"
                    class="dt-item-remove"
                    draggable={false}
                    onClick={() => table.removeGroup(key)}
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
            placeholder={table.L.filterSearchPlaceholder}
            value={searchTerm()}
            onInput={(e) => setSearchTerm(e.currentTarget.value)}
          />
        </div>
        <div class="dt-dd-section">{table.L.groupSection}</div>
        <For each={addableCols()}>
          {(col) => (
            <button
              type="button"
              class="dt-dd-item dt-dd-item--click"
              onClick={() => table.toggleGroup(col.key)}
            >
              <span class="dt-flex1">{col.label}</span>
            </button>
          )}
        </For>
      </Show>
    </Dropdown>
  )
}
