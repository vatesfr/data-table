import { For, Show, createEffect, createMemo, createSignal } from 'solid-js'
import {
  computeStringValueCounts,
  filterValuesBySearch,
  filterValuesByCount,
  filterValuesByRange,
  computeValueBounds,
  sortFilterValues,
  cycleValueSort,
  toggleSortDir,
  getValueSortIcon,
  getDateSortIcon,
  computeDateTree,
  selectDateRange,
  findDateTreeNode,
  selectRange,
  type ValueSort,
  type DateTreeNode,
} from '@vates/data-table-core'
import type { TableState } from '../createTableState'
import type { ColumnDef } from '../types'
import { Dropdown } from './Dropdown'
import { RangeSlider } from './RangeSlider'
import { DateTreeItem } from './DateTreeItem'

interface FilterDropdownProps<TRow extends object> {
  table: TableState<TRow>
  columns: ColumnDef<TRow>[]
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}

const DEFAULT_VALUE_SORT: ValueSort = { by: 'alpha', dir: 'asc' }

function formatRangeBound<TRow extends object>(n: number, col: ColumnDef<TRow>): string {
  return col.type === 'date' ? new Date(n).toISOString().slice(0, 10) : String(n)
}

// Master-detail filter panel (see CLAUDE.md's "Filter dropdown"): a left pane listing every
// filterable column (dot-marked when active), a right pane showing the selected column's
// controls — checklist (string), range + slider (number), or a Year›Month›Day tree + range +
// slider (date).
//
// Simplifications vs. the fuller documented behavior, noted rather than silently dropped:
// - The flat checklist is NOT virtualized/windowed here — every narrowed value gets a real DOM
//   node. `computeVirtualRange` exists in core for this and can be layered on later; it's a pure
//   rendering-cost optimization for very high-cardinality columns; it doesn't change behavior.
// - Shift-range selection (both the flat checklist and the date tree) is implemented; the panel's
//   own generic roving Up/Down/Home/End keyboard nav (beyond native Tab order) is deferred, same
//   as noted in Dropdown.tsx.
export function FilterDropdown<TRow extends object>(props: FilterDropdownProps<TRow>) {
  const { table } = props
  const filterableCols = createMemo(() => props.columns.filter((c) => c.filterable !== false))

  const [activeKey, setActiveKey] = createSignal<string | null>(null)
  const [searchTerms, setSearchTerms] = createSignal<Record<string, string>>({})
  const [valueSorts, setValueSorts] = createSignal<Record<string, ValueSort>>({})
  const [selectionAnchors, setSelectionAnchors] = createSignal<Record<string, string>>({})
  const [expandedNodes, setExpandedNodes] = createSignal<Record<string, Set<string>>>({})

  const activeCol = createMemo(
    () => filterableCols().find((c) => c.key === activeKey()) ?? filterableCols()[0] ?? null,
  )

  const searchTerm = createMemo(() => searchTerms()[activeCol()?.key ?? ''] ?? '')
  const valueSort = createMemo(
    () =>
      valueSorts()[activeCol()?.key ?? ''] ?? activeCol()?.defaultValueSort ?? DEFAULT_VALUE_SORT,
  )
  const expanded = createMemo(() => expandedNodes()[activeCol()?.key ?? ''] ?? new Set<string>())

  // Scoped via targetKeys to just the active column — see CLAUDE.md's "Performance": computing
  // this for every filterable column on every change is the single biggest cost this library has
  // measured (~15-17x at 500k rows), and only one column's checklist is ever shown at a time.
  const stringValueCounts = createMemo(() => {
    const col = activeCol()
    if (!col) return new Map<string, number>()
    return (
      computeStringValueCounts(
        table.data(),
        table.filters(),
        table.rangeFilters(),
        props.columns,
        table.L.emptyValue,
        [col.key],
        table.excludeFilters(),
      )[col.key] ?? new Map()
    )
  })

  const bounds = createMemo(() => {
    const col = activeCol()
    return col ? computeValueBounds(table.data(), col) : null
  })

  const filterDetailValues = createMemo(() => {
    const col = activeCol()
    if (!col) return []
    let values = table.stringValueMap()[col.key] ?? []
    values = filterValuesBySearch(values, searchTerm())
    if (col.type === 'date')
      values = filterValuesByRange(values, table.rangeFilters()[col.key], col.parseDate)
    values = filterValuesByCount(values, stringValueCounts(), table.filters()[col.key] ?? new Set())
    return sortFilterValues(values, stringValueCounts(), valueSort(), col.compare)
  })

  const dateTree = createMemo(() => {
    const col = activeCol()
    if (!col || col.type !== 'date') return []
    return computeDateTree(filterDetailValues(), table.L.emptyValue, valueSort().dir, col.parseDate)
  })

  function setSearchTerm(key: string, term: string): void {
    setSearchTerms((prev) => ({ ...prev, [key]: term }))
  }
  function setAnchor(key: string, value: string): void {
    setSelectionAnchors((prev) => ({ ...prev, [key]: value }))
  }
  function toggleExpand(key: string, path: string): void {
    setExpandedNodes((prev) => {
      const next = new Set(prev[key] ?? [])
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return { ...prev, [key]: next }
    })
  }
  function cycleSort(): void {
    const col = activeCol()
    if (!col) return
    if (col.type === 'date') {
      setValueSorts((prev) => ({
        ...prev,
        [col.key]: { ...valueSort(), dir: toggleSortDir(valueSort().dir) },
      }))
    } else {
      setValueSorts((prev) => ({ ...prev, [col.key]: cycleValueSort(valueSort()) }))
    }
  }

  // --- Flat checklist (string columns) ---
  function handleValueClick(value: string, shiftKey: boolean): void {
    const col = activeCol()
    if (!col) return
    const anchor = selectionAnchors()[col.key]
    if (shiftKey && anchor) {
      const included = table.filters()[col.key]?.has(value) ?? false
      const range = selectRange(filterDetailValues(), anchor, value)
      table.setFilterValues(col.key, range, !included)
      table.clearExcludeValues(col.key, range)
    } else {
      table.cycleFilterValue(col.key, value)
    }
    setAnchor(col.key, value)
  }
  function handleSelectAll(): void {
    const col = activeCol()
    if (!col) return
    table.toggleFilterAll(col.key, filterDetailValues())
  }
  const selectAllState = createMemo(() => {
    const col = activeCol()
    if (!col) return { checked: false, indeterminate: false }
    const values = filterDetailValues()
    const selected = table.filters()[col.key] ?? new Set()
    const selectedCount = values.filter((v) => selected.has(v)).length
    return {
      checked: selectedCount > 0 && selectedCount === values.length,
      indeterminate: selectedCount > 0 && selectedCount < values.length,
    }
  })
  let selectAllEl: HTMLInputElement | undefined
  createEffect(() => {
    if (selectAllEl) selectAllEl.indeterminate = selectAllState().indeterminate
  })

  // --- Date tree ---
  function handleDateNodeToggle(node: DateTreeNode, shiftKey: boolean): void {
    const col = activeCol()
    if (!col) return
    const anchorPath = selectionAnchors()[col.key]
    const anchorNode = anchorPath ? findDateTreeNode(dateTree(), anchorPath) : undefined
    if (shiftKey && anchorNode) {
      const selected = table.filters()[col.key] ?? new Set()
      const wasChecked = node.values.length > 0 && node.values.every((v) => selected.has(v))
      const range = selectDateRange(filterDetailValues(), anchorNode, node, col.parseDate)
      table.setFilterValues(col.key, range, !wasChecked)
      table.clearExcludeValues(col.key, range)
    } else {
      table.toggleFilterAll(col.key, node.values)
    }
    setAnchor(col.key, node.path)
  }

  return (
    <Dropdown
      isOpen={props.isOpen}
      onToggle={props.onToggle}
      onClose={props.onClose}
      trigger={
        <button
          type="button"
          class={`dt-btn${table.activeFilterCount() > 0 ? ' dt-btn--active dt-btn--grouped' : ''}`}
          onClick={props.onToggle}
        >
          {table.L.filter}
        </button>
      }
      extraTrigger={
        <Show when={table.activeFilterCount() > 0}>
          <button
            type="button"
            class="dt-btn-clear"
            title={table.L.clearFilters}
            aria-label={table.L.clearFilters}
            onClick={table.clearFilters}
          >
            ×
          </button>
        </Show>
      }
    >
      <div class="dt-filter-panel">
        <div class="dt-filter-cols">
          <For each={filterableCols()}>
            {(col) => {
              const hasActive = createMemo(() => {
                const rf = table.rangeFilters()[col.key]
                return (
                  (table.filters()[col.key]?.size ?? 0) > 0 ||
                  (table.excludeFilters()[col.key]?.size ?? 0) > 0 ||
                  (rf !== undefined && (rf.min !== '' || rf.max !== ''))
                )
              })
              return (
                <button
                  type="button"
                  class={`dt-filter-col-item${activeCol()?.key === col.key ? ' dt-filter-col-item--active' : ''}`}
                  onClick={() => setActiveKey(col.key)}
                >
                  <span>{col.label}</span>
                  <Show when={hasActive()}>
                    <span class="dt-filter-col-dot" />
                  </Show>
                </button>
              )
            }}
          </For>
        </div>
        <div class="dt-filter-detail">
          <Show when={activeCol()}>
            {(col) => (
              <Show
                when={col().type === 'number'}
                fallback={
                  <Show
                    when={col().type === 'date'}
                    fallback={
                      // --- String checklist ---
                      <>
                        <div class="dt-filter-search-row">
                          <input
                            type="checkbox"
                            title={table.L.selectAll}
                            aria-label={table.L.selectAll}
                            checked={selectAllState().checked}
                            ref={selectAllEl}
                            onClick={handleSelectAll}
                          />
                          <input
                            type="text"
                            class="dt-dd-search"
                            placeholder={table.L.filterSearchPlaceholder}
                            value={searchTerm()}
                            onInput={(e) => setSearchTerm(col().key, e.currentTarget.value)}
                          />
                          <button type="button" onClick={cycleSort}>
                            {getValueSortIcon(valueSort())}
                          </button>
                        </div>
                        <div class="dt-filter-list">
                          <For each={filterDetailValues()}>
                            {(value) => {
                              const included = () => table.filters()[col().key]?.has(value) ?? false
                              const excluded = () =>
                                table.excludeFilters()[col().key]?.has(value) ?? false
                              const count = () => stringValueCounts().get(value) ?? 0
                              let el: HTMLInputElement | undefined
                              createEffect(() => {
                                if (el) el.indeterminate = excluded()
                              })
                              return (
                                <label class="dt-dd-item">
                                  <input
                                    type="checkbox"
                                    checked={included()}
                                    ref={el}
                                    onClick={(e) => {
                                      e.preventDefault()
                                      handleValueClick(value, (e as MouseEvent).shiftKey)
                                    }}
                                  />
                                  <span class="dt-flex1">{value}</span>
                                  <span class="dt-filter-count" aria-hidden="true">
                                    {count()}
                                  </span>
                                </label>
                              )
                            }}
                          </For>
                        </div>
                      </>
                    }
                  >
                    {/* --- Date tree --- */}
                    <div style={{ padding: '4px 14px 8px' }}>
                      <div style={{ display: 'flex', gap: '6px', 'align-items': 'center' }}>
                        <input
                          type="date"
                          aria-label={table.L.min}
                          value={table.rangeFilters()[col().key]?.min ?? ''}
                          onInput={(e) =>
                            table.setRangeFilter(col().key, 'min', e.currentTarget.value)
                          }
                        />
                        <span class="dt-range-sep">–</span>
                        <input
                          type="date"
                          aria-label={table.L.max}
                          value={table.rangeFilters()[col().key]?.max ?? ''}
                          onInput={(e) =>
                            table.setRangeFilter(col().key, 'max', e.currentTarget.value)
                          }
                        />
                        <button type="button" onClick={cycleSort}>
                          {getDateSortIcon(valueSort().dir)}
                        </button>
                      </div>
                      <RangeSlider
                        col={col()}
                        rangeFilter={table.rangeFilters()[col().key]}
                        bounds={bounds()}
                        onCommit={(min, max) => {
                          table.setRangeFilter(col().key, 'min', min)
                          table.setRangeFilter(col().key, 'max', max)
                        }}
                      />
                    </div>
                    <div class="dt-date-tree-wrap">
                      <For each={dateTree()}>
                        {(node) => (
                          <DateTreeItem
                            node={node}
                            depth={0}
                            selected={table.filters()[col().key] ?? new Set()}
                            counts={stringValueCounts()}
                            expanded={expanded()}
                            onToggleExpand={(path) => toggleExpand(col().key, path)}
                            onToggleNode={handleDateNodeToggle}
                          />
                        )}
                      </For>
                    </div>
                  </Show>
                }
              >
                {/* --- Number range --- */}
                <div style={{ padding: '4px 14px 8px' }}>
                  <div style={{ display: 'flex', gap: '6px', 'align-items': 'center' }}>
                    <input
                      type="text"
                      inputmode="decimal"
                      class="dt-range-input"
                      placeholder={table.L.min}
                      value={
                        table.rangeFilters()[col().key]?.min ??
                        (bounds() ? formatRangeBound(bounds()!.min, col()) : '')
                      }
                      onInput={(e) => table.setRangeFilter(col().key, 'min', e.currentTarget.value)}
                    />
                    <span class="dt-range-sep">–</span>
                    <input
                      type="text"
                      inputmode="decimal"
                      class="dt-range-input"
                      placeholder={table.L.max}
                      value={
                        table.rangeFilters()[col().key]?.max ??
                        (bounds() ? formatRangeBound(bounds()!.max, col()) : '')
                      }
                      onInput={(e) => table.setRangeFilter(col().key, 'max', e.currentTarget.value)}
                    />
                  </div>
                  <RangeSlider
                    col={col()}
                    rangeFilter={table.rangeFilters()[col().key]}
                    bounds={bounds()}
                    onCommit={(min, max) => {
                      table.setRangeFilter(col().key, 'min', min)
                      table.setRangeFilter(col().key, 'max', max)
                    }}
                  />
                </div>
              </Show>
            )}
          </Show>
        </div>
      </div>
    </Dropdown>
  )
}
