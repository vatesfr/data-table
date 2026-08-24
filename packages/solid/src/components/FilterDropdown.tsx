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
  isMultiValueColumn,
  type ValueSort,
  type DateTreeNode,
} from '@vates/data-table-core'
import type { TableState } from '../createTableState'
import type { ColumnDef } from '../types'
import { Dropdown } from './Dropdown'
import { RangeInputs } from './RangeInputs'
import { DateTreeItem } from './DateTreeItem'
import { applyCheckboxState, deferCheckboxCorrection } from './checkboxSync'

interface FilterDropdownProps<TRow extends object> {
  table: TableState<TRow>
  columns: ColumnDef<TRow>[]
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}

const DEFAULT_VALUE_SORT: ValueSort = { by: 'alpha', dir: 'asc' }

interface FilterSearchRowProps {
  checked: boolean
  selectAllLabel: string
  onSelectAll: () => void
  checkboxRef: (el: HTMLInputElement) => void
  searchPlaceholder: string
  searchValue: string
  onSearchInput: (value: string) => void
  sortIcon: string
  sortLabel: string
  onSortClick: () => void
  // Any/all match-mode control — only meaningful for a genuinely array-valued column (see
  // `isMultiValueColumn`), so the caller passes these only when that's the case; omitted
  // entirely (rather than always rendered and disabled) for a plain scalar column, where
  // "match all selected values" could never match more than one value at a time anyway.
  // Rendered as two buttons rather than one cycling button — see FilterDropdown's own comment
  // on `matchMode`/`onSetMatchMode` for why "Any"/"All" both need to be visible, equal-weight
  // options rather than one being a default/passive non-state.
  matchMode?: 'and' | 'or'
  matchAnyLabel?: string
  matchAllLabel?: string
  onSetMatchMode?: (mode: 'and' | 'or') => void
}

// Select-all checkbox + value search input + sort-order toggle — shared by the string checklist
// and the date tree (the date branch had been missing this entirely at first; see CLAUDE.md's
// "Filter dropdown" section). Both narrow/select over the same filterDetailValues() pipeline
// regardless of which control (checklist or tree) renders those values, so this row's own
// behavior is identical either way — only the sort icon function differs (alpha/count vs.
// chronological), passed in by the caller.
function FilterSearchRow(props: FilterSearchRowProps) {
  return (
    <div class="dt-filter-search-row">
      <input
        type="checkbox"
        title={props.selectAllLabel}
        aria-label={props.selectAllLabel}
        checked={props.checked}
        ref={props.checkboxRef}
        onClick={props.onSelectAll}
      />
      <input
        type="text"
        class="dt-dd-search"
        placeholder={props.searchPlaceholder}
        value={props.searchValue}
        onInput={(e) => props.onSearchInput(e.currentTarget.value)}
      />
      <button
        type="button"
        class="dt-value-sort-btn"
        title={props.sortLabel}
        aria-label={props.sortLabel}
        onClick={props.onSortClick}
      >
        {props.sortIcon}
      </button>
      <Show when={props.matchMode}>
        <div class="dt-filter-match-mode-group" role="group">
          <button
            type="button"
            class={`dt-value-sort-btn dt-filter-match-mode dt-filter-match-mode--left${props.matchMode === 'or' ? ' dt-filter-match-mode--active' : ''}`}
            title={props.matchAnyLabel}
            aria-label={props.matchAnyLabel}
            aria-pressed={props.matchMode === 'or'}
            onClick={() => props.onSetMatchMode?.('or')}
          >
            {props.matchAnyLabel}
          </button>
          <button
            type="button"
            class={`dt-value-sort-btn dt-filter-match-mode dt-filter-match-mode--right${props.matchMode === 'and' ? ' dt-filter-match-mode--active' : ''}`}
            title={props.matchAllLabel}
            aria-label={props.matchAllLabel}
            aria-pressed={props.matchMode === 'and'}
            onClick={() => props.onSetMatchMode?.('and')}
          >
            {props.matchAllLabel}
          </button>
        </div>
      </Show>
    </div>
  )
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
  // Narrows the left pane's *column list* — a separate concern from `searchTerms` below, which
  // narrows the active column's *values* in the right detail pane (see CLAUDE.md's "Dropdown
  // column search and keyboard navigation").
  const [colSearchTerm, setColSearchTerm] = createSignal('')
  const searchedFilterableCols = createMemo(() => {
    const term = colSearchTerm().trim().toLowerCase()
    return (
      term ? filterableCols().filter((c) => c.label.toLowerCase().includes(term)) : filterableCols()
    )
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label))
  })
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
        table.filter.include(),
        table.filter.ranges(),
        props.columns,
        table.labels().emptyValue,
        [col.key],
        table.filter.exclude(),
        table.filter.modes(),
      )[col.key] ?? new Map()
    )
  })

  const bounds = createMemo(() => {
    const col = activeCol()
    return col ? computeValueBounds(table.data(), col) : null
  })

  // Any/all match mode — only surfaced in the UI for a column whose values are actually
  // array-shaped in the data (see `isMultiValueColumn`'s own doc comment for why a plain scalar
  // column has no meaningful "all" mode to switch to).
  const isMultiValueCol = createMemo(() => {
    const col = activeCol()
    return col ? isMultiValueColumn(table.data(), col, col.key) : false
  })
  const matchMode = createMemo(() => {
    const col = activeCol()
    if (!col) return 'or' as const
    return table.filter.modes()[col.key] ?? col.multiMode ?? 'or'
  })

  const filterDetailValues = createMemo(() => {
    const col = activeCol()
    if (!col) return []
    let values = table.filter.valueMap()[col.key] ?? []
    values = filterValuesBySearch(values, searchTerm())
    if (col.type === 'date')
      values = filterValuesByRange(values, table.filter.ranges()[col.key], col.parseDate)
    values = filterValuesByCount(
      values,
      stringValueCounts(),
      table.filter.include()[col.key] ?? new Set(),
    )
    return sortFilterValues(values, stringValueCounts(), valueSort(), col.compare)
  })

  const dateTree = createMemo(() => {
    const col = activeCol()
    if (!col || col.type !== 'date') return []
    return computeDateTree(
      filterDetailValues(),
      table.labels().emptyValue,
      valueSort().dir,
      col.parseDate,
    )
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
      const included = table.filter.include()[col.key]?.has(value) ?? false
      const shouldSelect = !included
      const range = selectRange(filterDetailValues(), anchor, value)
      table.filter.setValues(col.key, range, shouldSelect)
      // Only clear exclusions when values are moving *into* filters — deselecting a range must
      // not silently drop an unrelated exclude flag on a value that happens to be in the swept
      // range (matches react/vue's own `if (shouldSelect)` guard around this same call).
      if (shouldSelect) table.filter.clearExcludeValues(col.key, range)
    } else {
      table.filter.cycleValue(col.key, value)
    }
    setAnchor(col.key, value)
  }
  function handleSelectAll(): void {
    const col = activeCol()
    if (!col) return
    table.filter.toggleAll(col.key, filterDetailValues())
    // No preventDefault() here (this checkbox is a plain two-state toggle, not tri-state), but
    // the native pre-click activation can still race Solid's own synchronous write on rare
    // event-ordering — deferring a correction alongside the state update is cheap insurance.
    deferCheckboxCorrection(selectAllEl, () => selectAllState())
  }
  const selectAllState = createMemo(() => {
    const col = activeCol()
    if (!col) return { checked: false, indeterminate: false }
    const values = filterDetailValues()
    const selected = table.filter.include()[col.key] ?? new Set()
    const selectedCount = values.filter((v) => selected.has(v)).length
    return {
      checked: selectedCount > 0 && selectedCount === values.length,
      indeterminate: selectedCount > 0 && selectedCount < values.length,
    }
  })
  let selectAllEl: HTMLInputElement | undefined
  createEffect(() => {
    applyCheckboxState(selectAllEl, selectAllState().checked, selectAllState().indeterminate)
  })

  // --- Date tree ---
  function handleDateNodeToggle(node: DateTreeNode, shiftKey: boolean): void {
    const col = activeCol()
    if (!col) return
    const anchorPath = selectionAnchors()[col.key]
    const anchorNode = anchorPath ? findDateTreeNode(dateTree(), anchorPath) : undefined
    if (shiftKey && anchorNode) {
      const selected = table.filter.include()[col.key] ?? new Set()
      const wasChecked = node.values.length > 0 && node.values.every((v) => selected.has(v))
      const shouldSelect = !wasChecked
      const range = selectDateRange(filterDetailValues(), anchorNode, node, col.parseDate)
      table.filter.setValues(col.key, range, shouldSelect)
      // Same "only clear exclusions when selecting" guard as the flat checklist's handleValueClick.
      if (shouldSelect) table.filter.clearExcludeValues(col.key, range)
    } else {
      table.filter.toggleAll(col.key, node.values)
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
          class={`dt-btn${table.filter.activeCount() > 0 ? ' dt-btn--active dt-btn--grouped' : ''}`}
          onClick={props.onToggle}
        >
          {table.labels().filter}
        </button>
      }
      extraTrigger={
        <Show when={table.filter.activeCount() > 0}>
          <button
            type="button"
            class="dt-btn-clear"
            title={table.labels().clearFilters}
            aria-label={table.labels().clearFilters}
            onClick={table.filter.clear}
          >
            ×
          </button>
        </Show>
      }
      onEscapeClearable={() => {
        const active = document.activeElement
        if (active?.matches?.('.dt-filter-cols-search') && colSearchTerm()) {
          setColSearchTerm('')
          return true
        }
        const col = activeCol()
        if (col && searchTerms()[col.key]) {
          setSearchTerm(col.key, '')
          return true
        }
        return false
      }}
    >
      <div class="dt-filter-panel">
        <div class="dt-filter-cols">
          <input
            type="text"
            class="dt-dd-search dt-filter-cols-search"
            data-dd-search
            placeholder={table.labels().filterSearchPlaceholder}
            value={colSearchTerm()}
            onInput={(e) => setColSearchTerm(e.currentTarget.value)}
          />
          <For each={searchedFilterableCols()}>
            {(col) => {
              const hasActive = createMemo(() => {
                const rf = table.filter.ranges()[col.key]
                return (
                  (table.filter.include()[col.key]?.size ?? 0) > 0 ||
                  (table.filter.exclude()[col.key]?.size ?? 0) > 0 ||
                  (rf !== undefined && (rf.min !== '' || rf.max !== ''))
                )
              })
              return (
                <button
                  type="button"
                  class={`dt-filter-col-item${activeCol()?.key === col.key ? ' dt-filter-col-item--active' : ''}`}
                  data-dd-row
                  data-filter-col-key={col.key}
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
                        <FilterSearchRow
                          checked={selectAllState().checked}
                          selectAllLabel={table.labels().selectAll}
                          onSelectAll={handleSelectAll}
                          checkboxRef={(el) => (selectAllEl = el)}
                          searchPlaceholder={table.labels().filterSearchPlaceholder}
                          searchValue={searchTerm()}
                          onSearchInput={(v) => setSearchTerm(col().key, v)}
                          sortIcon={getValueSortIcon(valueSort())}
                          sortLabel={table.labels().sortValues}
                          onSortClick={cycleSort}
                          matchMode={isMultiValueCol() ? matchMode() : undefined}
                          matchAnyLabel={table.labels().filterMatchAny}
                          matchAllLabel={table.labels().filterMatchAll}
                          onSetMatchMode={(mode) => table.filter.setMode(col().key, mode)}
                        />
                        <div class="dt-filter-list">
                          <For each={filterDetailValues()}>
                            {(value) => {
                              const included = () =>
                                table.filter.include()[col().key]?.has(value) ?? false
                              const excluded = () =>
                                table.filter.exclude()[col().key]?.has(value) ?? false
                              const count = () => stringValueCounts().get(value) ?? 0
                              let el: HTMLInputElement | undefined
                              createEffect(() => {
                                applyCheckboxState(el, included(), excluded())
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
                                      deferCheckboxCorrection(el, () => ({
                                        checked: included(),
                                        indeterminate: excluded(),
                                      }))
                                    }}
                                  />
                                  <span class="dt-flex1">
                                    {col().renderFilterLabel
                                      ? col().renderFilterLabel!(value)
                                      : value}
                                  </span>
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
                    <RangeInputs
                      col={col()}
                      rangeFilter={table.filter.ranges()[col().key]}
                      bounds={bounds()}
                      minLabel={table.labels().min}
                      maxLabel={table.labels().max}
                      onChange={(kind, value) => table.filter.setRange(col().key, kind, value)}
                      onSliderCommit={(min, max) => {
                        table.filter.setRange(col().key, 'min', min)
                        table.filter.setRange(col().key, 'max', max)
                      }}
                    />
                    <FilterSearchRow
                      checked={selectAllState().checked}
                      selectAllLabel={table.labels().selectAll}
                      onSelectAll={handleSelectAll}
                      checkboxRef={(el) => (selectAllEl = el)}
                      searchPlaceholder={table.labels().filterSearchPlaceholder}
                      searchValue={searchTerm()}
                      onSearchInput={(v) => setSearchTerm(col().key, v)}
                      sortIcon={getDateSortIcon(valueSort().dir)}
                      sortLabel={table.labels().sortValues}
                      onSortClick={cycleSort}
                    />
                    <div class="dt-date-tree-wrap">
                      <For each={dateTree()}>
                        {(node) => (
                          <DateTreeItem
                            node={node}
                            depth={0}
                            selected={table.filter.include()[col().key] ?? new Set()}
                            counts={stringValueCounts()}
                            expanded={expanded()}
                            searchActive={searchTerm() !== ''}
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
                <RangeInputs
                  col={col()}
                  rangeFilter={table.filter.ranges()[col().key]}
                  bounds={bounds()}
                  minLabel={table.labels().min}
                  maxLabel={table.labels().max}
                  onChange={(kind, value) => table.filter.setRange(col().key, kind, value)}
                  onSliderCommit={(min, max) => {
                    table.filter.setRange(col().key, 'min', min)
                    table.filter.setRange(col().key, 'max', max)
                  }}
                />
              </Show>
            )}
          </Show>
        </div>
      </div>
    </Dropdown>
  )
}
