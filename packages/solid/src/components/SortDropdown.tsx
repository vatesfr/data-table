import { For, Show, createMemo, createSignal } from 'solid-js'
import type { SortEntry } from '@vates/data-table-core'
import {
  activeRowKeyDown,
  addableLists,
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
  NoMatchingColumns,
} from './DropdownParts'
import { withPanelRefocus } from './dropdownRowActions'

interface SortDropdownProps<TRow extends object> {
  table: TableState<TRow>
  columns: ColumnDef<TRow>[]
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}

// Sort dropdown (docs/sorting.md): active entries above an alphabetized add list; a drag commits only on drop
export function SortDropdown<TRow extends object>(props: SortDropdownProps<TRow>) {
  const { table } = props
  const [searchTerm, setSearchTerm] = createSignal('')
  const {
    dragOverKey,
    dragOverAfter,
    onRowDragStart,
    onRowDragEnd,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  } = createDragReorder('data-sort-key', table.sort.move)

  const lists = createMemo(() => {
    const sorts = table.sort.entries()
    return addableLists(
      props.columns.filter((c) => c.sortable !== false),
      (key) => getSortIndex(sorts, key) !== null,
      searchTerm(),
    )
  })
  const addableCols = () => lists()[0]
  const isSearching = () => lists()[1]
  const searchedFlatAddableCols = () => lists()[2]
  const categorizedAddableCols = () => lists()[3]

  // Grouped columns' entries, in `groupBy` order, are listed apart: drag position never changes nesting (docs/grouped-columns.md)
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
        // Only from the search box: Escape on a row closes rather than clearing the search
        if (!document.activeElement?.matches?.('.dt-dd-search')) return false
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
              // Not reorderable: nesting follows groupBy; direction still toggles
              <div
                class="dt-dd-item dt-dd-item--col dt-dd-item--sortrow dt-dd-item--locked"
                tabIndex={0}
                data-dd-row
                onClick={() => table.sort.toggleDir(entry.key)}
                onKeyDown={(e) =>
                  activeRowKeyDown(
                    e,
                    undefined,
                    () =>
                      withPanelRefocus(e.currentTarget, `[data-col-key="${entry.key}"]`, () =>
                        table.sort.remove(entry.key),
                      ),
                    () => table.sort.toggleDir(entry.key),
                  )
                }
              >
                <span class="dt-sort-idx">{i() + 1}</span>
                <span class="dt-flex1">{col()?.label ?? entry.key}</span>
                <span class="dt-sort-icon dt-sort-icon--active">
                  {getSortIcon(table.sort.entries(), entry.key)}
                </span>
                <button
                  type="button"
                  class="dt-item-remove"
                  title={table.labels().removeSort(col()?.label ?? entry.key)}
                  aria-label={table.labels().removeSort(col()?.label ?? entry.key)}
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
        <div onDragOver={handleDragOver} onDrop={handleDrop}>
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
                  onKeyDown={(e) =>
                    activeRowKeyDown(
                      e,
                      (delta) => {
                        // Swap within this non-group subset, not the raw sorts array, where a
                        // group entry can sit between two non-group ones
                        const neighbor = nonGroupEntries()[i() + delta]
                        if (!neighbor) return false
                        // Focus drops to <body> after this reorder without an explicit refocus
                        withPanelRefocus(e.currentTarget, `[data-sort-key="${entry.key}"]`, () =>
                          table.sort.move(entry.key, neighbor.key, delta > 0),
                        )
                      },
                      () =>
                        withPanelRefocus(e.currentTarget, `[data-col-key="${entry.key}"]`, () =>
                          table.sort.remove(entry.key),
                        ),
                      () => table.sort.toggleDir(entry.key),
                    )
                  }
                >
                  <span class="dt-dd-drag-handle" aria-hidden="true">
                    ⠿
                  </span>
                  <span class="dt-sort-idx">{i() + 1}</span>
                  <span class="dt-flex1">{col()?.label ?? entry.key}</span>
                  <span class="dt-sort-icon dt-sort-icon--active">
                    {getSortIcon(table.sort.entries(), entry.key)}
                  </span>
                  <button
                    type="button"
                    class="dt-item-remove"
                    title={table.labels().removeSort(col()?.label ?? entry.key)}
                    aria-label={table.labels().removeSort(col()?.label ?? entry.key)}
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
          clearLabel={table.labels().clearSearch}
        />
        <div class="dt-dd-section">{table.labels().sortSection}</div>
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
                    table.sort.toggle(col.key)
                    document.querySelector<HTMLElement>(`[data-sort-key="${col.key}"]`)?.focus()
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
                  table.sort.toggle(col.key)
                  document.querySelector<HTMLElement>(`[data-sort-key="${col.key}"]`)?.focus()
                }}
              />
            )}
          />
        </Show>
      </Show>
    </Dropdown>
  )
}
