import { For, Show, createMemo, createSignal } from 'solid-js'
import { activeRowKeyDown, addableLists } from '@vates/data-table-core/internal'
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
  NoMatchingColumns,
} from './DropdownParts'
import { withPanelRefocus } from './dropdownRowActions'

interface GroupDropdownProps<TRow extends object> {
  table: TableState<TRow>
  groupableCols: ColumnDef<TRow>[]
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}

// Like SortDropdown, but a group row only reorders and removes (docs/grouped-columns.md)
export function GroupDropdown<TRow extends object>(props: GroupDropdownProps<TRow>) {
  const { table } = props
  const [searchTerm, setSearchTerm] = createSignal('')
  const {
    dragOverKey,
    dragOverAfter,
    onRowDragStart,
    onRowDragEnd,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  } = createDragReorder('data-group-key', table.group.move)

  const lists = createMemo(() => {
    const groupBy = table.group.by()
    return addableLists(props.groupableCols, (key) => groupBy.includes(key), searchTerm())
  })
  const addableCols = () => lists()[0]
  const isSearching = () => lists()[1]
  const searchedFlatAddableCols = () => lists()[2]
  const categorizedAddableCols = () => lists()[3]

  return (
    <Dropdown
      isOpen={props.isOpen}
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
        // Only from the search box: Escape on a row closes rather than clearing the search
        if (!document.activeElement?.matches?.('.dt-dd-search')) return false
        if (!searchTerm()) return false
        setSearchTerm('')
        return true
      }}
    >
      <Show when={table.group.by().length > 0}>
        <div class="dt-dd-section">{table.labels().activeGroupsSection}</div>
        <div onDragOver={handleDragOver} onDrop={handleDrop}>
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
                  onKeyDown={(e) =>
                    activeRowKeyDown(
                      e,
                      (delta) =>
                        // Focus drops to <body> after this reorder without an explicit refocus
                        withPanelRefocus(e.currentTarget, `[data-group-key="${key}"]`, () =>
                          table.group.moveBy(key, delta),
                        ),
                      () =>
                        withPanelRefocus(e.currentTarget, `[data-col-key="${key}"]`, () =>
                          table.group.remove(key),
                        ),
                    )
                  }
                >
                  <span class="dt-dd-drag-handle" aria-hidden="true">
                    ⠿
                  </span>
                  <span class="dt-sort-idx">{i() + 1}</span>
                  <span class="dt-flex1">{col()?.label ?? key}</span>
                  <button
                    type="button"
                    class="dt-item-remove"
                    title={table.labels().removeGroup(col()?.label ?? key)}
                    aria-label={table.labels().removeGroup(col()?.label ?? key)}
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
        <NoMatchingColumns
          when={isSearching() && searchedFlatAddableCols().length === 0}
          label={table.labels().noMatchingColumns}
        />
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
