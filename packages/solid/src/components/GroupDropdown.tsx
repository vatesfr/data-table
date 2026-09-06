import { For, Show, createMemo, createSignal } from 'solid-js'
import {
  alphabetizedByLabel,
  categorizedAlphabetizedByLabel,
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
  const {
    dragOverKey,
    dragOverAfter,
    setContainer,
    onRowDragStart,
    onRowDragEnd,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  } = createDragReorder('data-group-key', table.group.move)

  const isSearching = createMemo(() => searchTerm().trim().length > 0)
  const addableCols = createMemo(() => {
    const groupBy = table.group.by()
    return props.groupableCols.filter((c) => !groupBy.includes(c.key))
  })
  // While searching, category matches are flattened into plain, category-tagged rows instead of
  // bucketed behind a submenu — see CLAUDE.md's "Column categories"/ColumnsDropdown.tsx's identical
  // fix: hiding a single search match behind an extra hover/click defeats the point of searching.
  const searchedFlatAddableCols = createMemo(() => alphabetizedByLabel(addableCols(), searchTerm()))
  const categorizedAddableCols = createMemo(() => categorizedAlphabetizedByLabel(addableCols(), ''))

  return (
    <Dropdown
      isOpen={props.isOpen}
      onToggle={props.onToggle}
      onClose={props.onClose}
      trigger={
        <DropdownTriggerButton
          active={table.group.by().length > 0}
          label={table.labels().group}
          onClick={props.onToggle}
        />
      }
      extraTrigger={
        <DropdownClearButton
          show={table.group.by().length > 0}
          label={table.labels().clearGroups}
          onClear={table.group.clear}
        />
      }
      onEscapeClearable={() => {
        // Scoped to focus actually being in the search box — see ColumnsDropdown.tsx's identical
        // comment (and the Filter dropdown's own onEscapeClearable, the original source of this
        // fix): without this, Escape pressed while focused on a row still silently cleared a
        // non-empty search term instead of closing the dropdown on the first press.
        if (!document.activeElement?.matches?.('.dt-dd-search')) return false
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
                      // Focus drops to <body> after this reorder without an explicit refocus
                      // (confirmed empirically).
                      withPanelRefocus(e.currentTarget, `[data-group-key="${key}"]`, () =>
                        table.group.moveBy(key, -1),
                      )
                    } else if (e.altKey && e.key === 'ArrowDown') {
                      e.preventDefault()
                      withPanelRefocus(e.currentTarget, `[data-group-key="${key}"]`, () =>
                        table.group.moveBy(key, 1),
                      )
                    } else if (e.key === 'Delete' || e.key === 'Backspace') {
                      // Keyboard equivalent of this row's own × button — matches the Filter
                      // dropdown's identical Delete/Backspace-on-a-focused-active-row shortcut.
                      e.preventDefault()
                      withPanelRefocus(e.currentTarget, `[data-col-key="${key}"]`, () =>
                        table.group.remove(key),
                      )
                    } else if (e.key === 'Enter' || e.key === ' ') {
                      // No click action of its own (unlike Sort's active rows, which toggle
                      // direction) — but still needs to preventDefault, or Space's native default
                      // action scrolls the nearest scrollable ancestor (this panel, or the whole
                      // page once the panel itself has nothing left to scroll) out from under the
                      // still-focused row, which reads as "focus was lost" even though it wasn't.
                      e.preventDefault()
                    }
                  }}
                >
                  <span class="dt-dd-drag-handle" aria-hidden="true">
                    ⠿
                  </span>
                  <span class="dt-sort-idx">{i() + 1}</span>
                  <span class="dt-flex1">{col()?.label ?? key}</span>
                  <button
                    type="button"
                    class="dt-item-remove"
                    title={table.labels().removeGroup}
                    aria-label={table.labels().removeGroup}
                    draggable={false}
                    onClick={(e) =>
                      withPanelRefocus(e.currentTarget, `[data-col-key="${key}"]`, () =>
                        table.group.remove(key),
                      )
                    }
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
          clearLabel={table.labels().clearSearch}
        />
        <div class="dt-dd-section">{table.labels().groupSection}</div>
        <Show
          when={!isSearching()}
          fallback={
            <For each={searchedFlatAddableCols()}>
              {(col) => (
                <AddableColumnRow
                  col={col}
                  showCategory
                  onClick={() => {
                    table.group.toggle(col.key)
                    document.querySelector<HTMLElement>(`[data-group-key="${col.key}"]`)?.focus()
                  }}
                />
              )}
            </For>
          }
        >
          <CategorizedColumnList
            uncategorized={categorizedAddableCols().uncategorized}
            categories={categorizedAddableCols().categories}
            row={(col) => (
              <AddableColumnRow
                col={col}
                onClick={() => {
                  table.group.toggle(col.key)
                  document.querySelector<HTMLElement>(`[data-group-key="${col.key}"]`)?.focus()
                }}
              />
            )}
          />
        </Show>
      </Show>
    </Dropdown>
  )
}
