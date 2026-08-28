import { For, Show, createMemo, createSignal } from 'solid-js'
import { categorizedAlphabetizedByLabel } from '@vates/data-table-core/internal'
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

  const addableCols = createMemo(() => {
    const groupBy = table.group.by()
    return props.groupableCols.filter((c) => !groupBy.includes(c.key))
  })
  const categorizedAddableCols = createMemo(() =>
    categorizedAlphabetizedByLabel(addableCols(), searchTerm()),
  )

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
                    }
                  }}
                >
                  <span class="dt-sort-idx">{i() + 1}</span>
                  <span class="dt-flex1">{col()?.label ?? key}</span>
                  <button
                    type="button"
                    class="dt-item-remove"
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
        />
        <div class="dt-dd-section">{table.labels().groupSection}</div>
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
    </Dropdown>
  )
}
