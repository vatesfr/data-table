import { For, Show, createMemo, createSignal } from 'solid-js'
import { alphabetizedByLabel, groupColumnsByCategory } from '@vates/data-table-core/internal'
import type { TableState } from '../createTableState'
import type { ColumnDef } from '../types'
import { CategorySubmenu } from './CategorySubmenu'
import { Dropdown } from './Dropdown'
import { createDragReorder } from './dragReorder'

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
  // See SortDropdown.tsx's identical comment on its own openCategory.
  const [openCategory, setOpenCategory] = createSignal<string | null>(null)
  const {
    dragOverKey,
    dragOverAfter,
    setContainer,
    onRowDragStart,
    onRowDragEnd,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  } = createDragReorder('data-group-key', table.group.move)

  const addableCols = createMemo(() => {
    const groupBy = table.group.by()
    const notYetActive = props.groupableCols.filter((c) => !groupBy.includes(c.key))
    return alphabetizedByLabel(notYetActive, searchTerm())
  })
  // See SortDropdown.tsx's identical comment on its own categorizedAddableCols.
  const categorizedAddableCols = createMemo(() => {
    const { uncategorized, categories } = groupColumnsByCategory(addableCols())
    return {
      uncategorized,
      categories: categories.slice().sort((a, b) => a.name.localeCompare(b.name)),
    }
  })

  // One addable-column row — shared by the flat uncategorized list and each category submenu.
  function AddableColRow(rowProps: { col: ColumnDef<TRow> }) {
    const col = rowProps.col
    return (
      <button
        type="button"
        class="dt-dd-item dt-dd-item--click"
        data-dd-row
        data-col-key={col.key}
        onClick={(e) => {
          const panel = e.currentTarget.closest('.dt-dd')
          table.group.toggle(col.key)
          panel?.querySelector<HTMLElement>(`[data-group-key="${col.key}"]`)?.focus()
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
          class={`dt-btn${table.group.by().length > 0 ? ' dt-btn--active dt-btn--grouped' : ''}`}
          onClick={props.onToggle}
        >
          {table.labels().group}
        </button>
      }
      extraTrigger={
        <Show when={table.group.by().length > 0}>
          <button
            type="button"
            class="dt-btn-clear"
            title={table.labels().clearGroups}
            aria-label={table.labels().clearGroups}
            onClick={table.group.clear}
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
      <Show when={table.group.by().length > 0}>
        <div class="dt-dd-section">{table.labels().activeGroupsSection}</div>
        <div ref={setContainer} onDragOver={handleDragOver} onDrop={handleDrop}>
          <For each={table.group.by()}>
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
                  data-dd-row
                  data-group-key={key}
                  onDragStart={() => onRowDragStart(key)}
                  onDragEnd={onRowDragEnd}
                  onKeyDown={(e) => {
                    if (e.altKey && e.key === 'ArrowUp') {
                      e.preventDefault()
                      const panel = e.currentTarget.closest('.dt-dd')
                      table.group.moveBy(key, -1)
                      // Focus drops to <body> after this reorder without an explicit refocus
                      // (confirmed empirically) — refocus by key, same pattern used for
                      // activate/remove below.
                      panel?.querySelector<HTMLElement>(`[data-group-key="${key}"]`)?.focus()
                    } else if (e.altKey && e.key === 'ArrowDown') {
                      e.preventDefault()
                      const panel = e.currentTarget.closest('.dt-dd')
                      table.group.moveBy(key, 1)
                      panel?.querySelector<HTMLElement>(`[data-group-key="${key}"]`)?.focus()
                    }
                  }}
                >
                  <span class="dt-sort-idx">{i() + 1}</span>
                  <span class="dt-flex1">{col()?.label ?? key}</span>
                  <button
                    type="button"
                    class="dt-item-remove"
                    draggable={false}
                    onClick={(e) => {
                      // Panel must be resolved *before* the mutating call — this button is
                      // itself removed from the DOM as a synchronous side effect of it, so
                      // `.closest()` on it afterward would find nothing (see SortDropdown.tsx's
                      // own version of this same pattern).
                      const panel = e.currentTarget.closest('.dt-dd')
                      table.group.remove(key)
                      panel?.querySelector<HTMLElement>(`[data-col-key="${key}"]`)?.focus()
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
        <div class="dt-dd-section">{table.labels().groupSection}</div>
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
