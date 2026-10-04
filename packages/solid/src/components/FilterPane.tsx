import { For, Show, createEffect, createMemo, createSignal } from 'solid-js'
import type { ValueSort } from '@vates/data-table-core'
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
  isMultiValueColumn,
  computeVirtualRange,
  getVirtualScrollTarget,
  checklistBulkState,
  clickChecklistValue,
  clickDateTreeNode,
  toggleChecklistValues,
  type DateTreeNode,
  applyCheckboxState,
  deferCheckboxCorrection,
} from '@vates/data-table-core/internal'
import type { TableState } from '../createTableState'
import type { ColumnDef } from '../types'
import { RangeInputs } from './RangeInputs'
import { DateTreeItem } from './DateTreeItem'

interface FilterPaneProps<TRow extends object> {
  table: TableState<TRow>
  col: ColumnDef<TRow>
}

const DEFAULT_VALUE_SORT: ValueSort = { by: 'alpha', dir: 'asc' }
// Checklist virtualization (see "Checklist virtualization" below): a fixed per-row height so the
// windowing math is exact, and an assumed viewport height safe because `.dt-filter-panel`'s own
// `max-height: 380px` bounds how much taller the checklist can ever grow past this default —
// comfortably inside the 5-row/160px overscan `computeVirtualRange` already renders each side, so
// the mounted window always covers the real visible box. Matches React/Vue's own constants.
const FILTER_LIST_ITEM_HEIGHT = 32
const FILTER_LIST_VIEWPORT_HEIGHT = 260

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
  clearSearchLabel: string
}

// Select-all checkbox + value search input + sort-order toggle — shared by the string checklist
// and the date tree (the date branch had been missing this entirely at first; see docs/filter-dropdown.md's
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
      <span class="dt-dd-search-wrap">
        <input
          type="text"
          class="dt-dd-search"
          data-dd-value-search
          placeholder={props.searchPlaceholder}
          value={props.searchValue}
          onInput={(e) => props.onSearchInput(e.currentTarget.value)}
        />
        <Show when={props.searchValue}>
          <button
            type="button"
            class="dt-dd-search-clear"
            title={props.clearSearchLabel}
            aria-label={props.clearSearchLabel}
            onClick={() => props.onSearchInput('')}
          >
            ×
          </button>
        </Show>
      </span>
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

const multiValueCache = new WeakMap<object[], Map<string, boolean>>()

/** The pane's keyboard stops, in order: value search, then checklist rows or date tree checkboxes */
export function detailFocusables(detailEl: Element): HTMLElement[] {
  return Array.from(
    detailEl.querySelectorAll<HTMLElement>(
      'input[data-dd-value-search], input[data-dd-value-row], .dt-date-tree-wrap input[type="checkbox"]',
    ),
  )
}

// One column's filter controls — checklist (string, virtualized — see "Checklist virtualization"
// below), range + slider (number), or a Year›Month›Day tree + range + slider (date). Shown by the
// Filter dropdown's right pane and the header menu's Filter flyout; its view state (value search,
// value order, shift-click anchor, expanded date nodes) lives here, so render it keyed by column.
export function FilterPane<TRow extends object>(props: FilterPaneProps<TRow>) {
  const { table } = props
  const activeCol = () => props.col
  const col = activeCol
  const [searchTerm, setSearchTerm] = createSignal('')
  const [valueSort, setValueSort] = createSignal<ValueSort>(
    props.col.defaultValueSort ?? DEFAULT_VALUE_SORT,
  )
  const [anchorValue, setAnchor] = createSignal<string>()
  const [expanded, setExpanded] = createSignal(new Set<string>())

  // Scoped via targetKeys to just the active column — see docs/performance.md's "Performance": computing
  // this for every filterable column on every change is the single biggest cost this library has
  // measured (~15-17x at 500k rows), and only one column's checklist is ever shown at a time.
  const stringValueCounts = createMemo(() => {
    const col = activeCol()
    return (
      computeStringValueCounts(
        table.data(),
        table.filter.include(),
        table.filter.ranges(),
        table.columns.list(),
        table.labels().emptyValue,
        [col.key],
        table.filter.exclude(),
        table.filter.modes(),
      )[col.key] ?? new Map()
    )
  })

  const bounds = createMemo(() => {
    const col = activeCol()
    return computeValueBounds(table.data(), col)
  })

  // Any/all match mode — only surfaced in the UI for a column whose values are actually
  // array-shaped in the data (see `isMultiValueColumn`'s own doc comment for why a plain scalar
  // column has no meaningful "all" mode to switch to).
  //
  // Cached per data array and column key (module-level, since a pane is recreated per column):
  // revisiting a column otherwise reruns a full O(rows) scan, which never short-circuits for a
  // scalar column. Multi-valueness is a property of the data shape, stable while `data` is.
  const isMultiValueCol = createMemo(() => {
    const col = activeCol()
    const data = table.data()
    let byKey = multiValueCache.get(data)
    if (!byKey) multiValueCache.set(data, (byKey = new Map()))
    let cached = byKey.get(col.key)
    if (cached === undefined) {
      cached = isMultiValueColumn(data, col, col.key)
      byKey.set(col.key, cached)
    }
    return cached
  })
  const matchMode = createMemo(() => {
    const col = activeCol()
    return table.filter.modes()[col.key] ?? col.multiMode ?? 'or'
  })

  // A non-multi-value column's checklist uses a checked-by-default, exclude-only model instead
  // of the tri-state include/exclude cycle (see docs/filter-dropdown.md's "Filter dropdown"): `filters` is
  // never written for such a column, "checked" simply means "not in `excludeFilters`". Date/
  // number columns (their own detail branches below) and genuinely multi-value columns keep the
  // original include-based model untouched.
  const usesExcludeOnly = createMemo(() => {
    const col = activeCol()
    if (col.type === 'date' || col.type === 'number') return false
    return !isMultiValueCol()
  })

  // The set a value must be in to stay visible even at a 0 facet count (see
  // `filterValuesByCount`) — whichever map the active column's model actually writes to.
  function alreadyTouched(col: ColumnDef<TRow>): Set<string> {
    return usesExcludeOnly()
      ? (table.filter.exclude()[col.key] ?? new Set())
      : (table.filter.include()[col.key] ?? new Set())
  }

  // Count/range-filtered, but *not* yet narrowed by the checklist's own value search — kept
  // separate from filterDetailValues below so `otherValues` can diff the two to find exactly what
  // the search is currently hiding. Order relative to search doesn't matter here: range/count
  // filtering and search are independent per-value predicates, so computing them in either order
  // yields the same final set.
  const detailValuesBeforeSearch = createMemo(() => {
    const col = activeCol()
    let values = table.filter.valueMap()[col.key] ?? []
    if (col.type === 'date')
      values = filterValuesByRange(values, table.filter.ranges()[col.key], col.parseDate)
    return filterValuesByCount(values, stringValueCounts(), alreadyTouched(col))
  })

  const filterDetailValues = createMemo(() => {
    const col = activeCol()
    const values = filterValuesBySearch(detailValuesBeforeSearch(), searchTerm())
    return sortFilterValues(values, stringValueCounts(), valueSort(), col.compare)
  })

  // "Others" — the values the checklist's own value search is currently hiding (see docs/filter-dropdown.md's
  // "Filter dropdown"). Only meaningful once a search term actually narrows the list; empty
  // otherwise, which also keeps it a no-op for the date tree's own (unused) reference to this.
  const otherValues = createMemo(() => {
    if (!searchTerm()) return []
    const shown = new Set(filterDetailValues())
    return detailValuesBeforeSearch().filter((v) => !shown.has(v))
  })

  const dateTree = createMemo(() => {
    const col = activeCol()
    if (col.type !== 'date') return []
    return computeDateTree(
      filterDetailValues(),
      table.labels().emptyValue,
      valueSort().dir,
      col.parseDate,
    )
  })

  // --- Checklist virtualization ---
  // A column with thousands of distinct values (a customer name, an order ID) would otherwise
  // mount one <label>/<input> per value regardless of scroll position — see docs/performance.md's
  // "Performance" and "The flat checklist is virtualized in React and Vue" in the docs. Solid's
  // own version of this, windowing filterDetailValues() the same way.
  let filterListEl: HTMLDivElement | undefined
  const [scrollTop, setScrollTop] = createSignal(0)
  // Resets scroll to 0 whenever the active column or its search term changes — matches React/
  // Vue's own reset trigger (a stale scroll position from a previous column/search makes no
  // sense against a freshly-narrowed list).
  createEffect(() => {
    void searchTerm()
    setScrollTop(0)
    if (filterListEl) filterListEl.scrollTop = 0
  })
  const filterListVirtualRange = createMemo(() =>
    computeVirtualRange(
      scrollTop(),
      FILTER_LIST_VIEWPORT_HEIGHT,
      FILTER_LIST_ITEM_HEIGHT,
      filterDetailValues().length,
    ),
  )

  function toggleExpand(path: string): void {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }
  function cycleSort(): void {
    const col = activeCol()
    setValueSort(
      col.type === 'date'
        ? { ...valueSort(), dir: toggleSortDir(valueSort().dir) }
        : cycleValueSort(valueSort()),
    )
  }

  // --- Flat checklist (string columns), "Others" and date tree: shared click logic in core ---
  const touched = () =>
    (usesExcludeOnly() ? table.filter.exclude() : table.filter.include())[activeCol().key]
  function handleValueClick(value: string, shiftKey: boolean): void {
    clickChecklistValue(table.filter, activeCol().key, value, shiftKey, {
      anchor: anchorValue(),
      values: filterDetailValues(),
      include: table.filter.include()[activeCol().key],
      exclude: table.filter.exclude()[activeCol().key],
      excludeOnly: usesExcludeOnly(),
    })
    setAnchor(value)
  }
  function handleSelectAll(): void {
    toggleChecklistValues(table.filter, activeCol().key, filterDetailValues(), usesExcludeOnly())
    // No preventDefault() here (this checkbox is a plain two-state toggle, not tri-state), but
    // the native pre-click activation can still race Solid's own synchronous write on rare
    // event-ordering — deferring a correction alongside the state update is cheap insurance.
    deferCheckboxCorrection(selectAllEl, () => selectAllState())
  }
  const selectAllState = createMemo(() =>
    checklistBulkState(filterDetailValues(), touched(), usesExcludeOnly()),
  )
  let selectAllEl: HTMLInputElement | undefined
  createEffect(() => {
    applyCheckboxState(selectAllEl, selectAllState().checked, selectAllState().indeterminate)
  })

  function handleOthersToggle(): void {
    toggleChecklistValues(table.filter, activeCol().key, otherValues(), usesExcludeOnly())
    deferCheckboxCorrection(othersEl, () => othersState())
  }
  const othersState = createMemo(() =>
    checklistBulkState(otherValues(), touched(), usesExcludeOnly()),
  )
  let othersEl: HTMLInputElement | undefined
  createEffect(() => {
    applyCheckboxState(othersEl, othersState().checked, othersState().indeterminate)
  })

  function handleDateNodeToggle(node: DateTreeNode, shiftKey: boolean): void {
    clickDateTreeNode(table.filter, activeCol().key, node, shiftKey, {
      anchorPath: anchorValue(),
      tree: dateTree(),
      values: filterDetailValues(),
      include: table.filter.include()[activeCol().key],
      parseDate: activeCol().parseDate,
    })
    setAnchor(node.path)
  }

  // --- Row nav (Up/Down/Home/End); Escape clears a non-empty value search first ---
  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && searchTerm()) {
      e.preventDefault()
      e.stopPropagation()
      setSearchTerm('')
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return

    // The flat checklist is virtualized (see "Checklist virtualization" below) — only a
    // scrolled-into-view window of rows actually exists in the DOM, so Up/Down/Home/End need to
    // reach a *logical* value that isn't necessarily mounted, via filterDetailValues() (the full
    // narrowed list) rather than a DOM query. Falls through to the generic DOM-order nav below in
    // two cases, same as React/Vue's own version: moving Up out of the very first row (there's no
    // row above it — the previous stop is the search box instead, itself always mounted so plain
    // DOM order already gets there), and starting from the search box itself (ArrowDown to row 0
    // is likewise always mounted). The date tree has no such window, so it always uses the
    // generic path.
    const col = activeCol()
    if (col.type !== 'date' && col.type !== 'number') {
      const values = filterDetailValues()
      const active = document.activeElement
      const activeValue =
        active instanceof HTMLInputElement && active.matches('input[data-dd-value-row]')
          ? active.dataset.value
          : undefined
      let targetIdx: number | null = null
      if (e.key === 'Home') targetIdx = 0
      else if (e.key === 'End') targetIdx = values.length - 1
      else if (activeValue !== undefined) {
        const curIdx = values.indexOf(activeValue)
        targetIdx = e.key === 'ArrowDown' ? curIdx + 1 : curIdx - 1
      }
      if (targetIdx !== null) {
        const fallsThrough = targetIdx < 0 && e.key === 'ArrowUp' && activeValue !== undefined
        if (!fallsThrough) {
          if (targetIdx < 0 || targetIdx >= values.length) {
            e.preventDefault()
            return
          }
          e.preventDefault()
          focusChecklistIndex(targetIdx, values)
          return
        }
      }
    }

    const focusables = detailFocusables(e.currentTarget as HTMLElement)
    const active = document.activeElement as HTMLElement | null
    const idx = active ? focusables.indexOf(active) : -1
    if (idx === -1) return
    if (e.key === 'Home' || e.key === 'End') {
      const rowFocusables = focusables.filter((el) => !el.matches('input[data-dd-value-search]'))
      if (rowFocusables.length === 0) return
      e.preventDefault()
      ;(e.key === 'Home' ? rowFocusables[0] : rowFocusables[rowFocusables.length - 1]).focus()
      return
    }
    const nextIdx = e.key === 'ArrowDown' ? idx + 1 : idx - 1
    if (nextIdx < 0 || nextIdx >= focusables.length) return
    e.preventDefault()
    focusables[nextIdx].focus()
  }

  // Scrolls (if needed) and focuses the checklist row at `values[targetIdx]` — the scroll-then-
  // focus dance a virtualized list needs when the target isn't in the currently-mounted window.
  // Solid's DOM update for the new window is synchronous within this same call (same reasoning
  // as the Sort/Group activate/remove focus retention elsewhere in this codebase), so no
  // pending-ref/effect indirection is needed: set scrollTop, then focus, in the same tick.
  function focusChecklistIndex(targetIdx: number, values: string[]): void {
    const value = values[targetIdx]
    const nextScrollTop = getVirtualScrollTarget(
      scrollTop(),
      FILTER_LIST_VIEWPORT_HEIGHT,
      FILTER_LIST_ITEM_HEIGHT,
      targetIdx,
    )
    if (nextScrollTop !== null) {
      if (filterListEl) filterListEl.scrollTop = nextScrollTop
      setScrollTop(nextScrollTop)
    }
    if (!filterListEl) return
    for (const cb of filterListEl.querySelectorAll<HTMLInputElement>('input[data-dd-value-row]')) {
      if (cb.dataset.value === value) {
        cb.focus()
        break
      }
    }
  }

  return (
    <div class="dt-filter-detail" onKeyDown={handleKeyDown}>
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
                  onSearchInput={setSearchTerm}
                  sortIcon={getValueSortIcon(valueSort())}
                  sortLabel={table.labels().sortValues}
                  onSortClick={cycleSort}
                  matchMode={isMultiValueCol() ? matchMode() : undefined}
                  matchAnyLabel={table.labels().filterMatchAny}
                  matchAllLabel={table.labels().filterMatchAll}
                  onSetMatchMode={(mode) => table.filter.setMode(col().key, mode)}
                  clearSearchLabel={table.labels().clearSearch}
                />
                {/* Bulk (de)select everything the value search above is currently hiding
                        — see docs/filter-dropdown.md's "Filter dropdown". Only rendered once a search term
                        actually narrows the list. */}
                <Show when={otherValues().length > 0}>
                  <label class="dt-dd-item dt-filter-others">
                    <input
                      type="checkbox"
                      title={table.labels().filterOthers}
                      aria-label={table.labels().filterOthers}
                      checked={othersState().checked}
                      ref={othersEl}
                      onClick={(e) => {
                        e.preventDefault()
                        handleOthersToggle()
                      }}
                    />
                    <span class="dt-flex1">{table.labels().filterOthers}</span>
                    <span class="dt-filter-count" aria-hidden="true">
                      {otherValues().length}
                    </span>
                  </label>
                </Show>
                <div
                  class="dt-filter-list"
                  ref={filterListEl}
                  onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
                >
                  {/* Spacer sized to the *full* (unwindowed) list so the real scrollbar
                          still reports the true item count's size; the inner div positions
                          just the mounted window at its real offset within that spacer. */}
                  <div
                    style={{
                      height: `${filterListVirtualRange().totalHeight}px`,
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: `${filterListVirtualRange().offsetY}px`,
                        left: 0,
                        right: 0,
                      }}
                    >
                      <For
                        each={filterDetailValues().slice(
                          filterListVirtualRange().startIndex,
                          filterListVirtualRange().endIndex,
                        )}
                      >
                        {(value) => {
                          // Non-multi-value column: plain checked/unchecked, "checked"
                          // meaning "not excluded" — no tri-state indeterminate cue.
                          // Multi-value column: unchanged include/exclude tri-state,
                          // shown as checked/indeterminate.
                          const checked = () =>
                            usesExcludeOnly()
                              ? !(table.filter.exclude()[col().key]?.has(value) ?? false)
                              : (table.filter.include()[col().key]?.has(value) ?? false)
                          const indeterminate = () =>
                            usesExcludeOnly()
                              ? false
                              : (table.filter.exclude()[col().key]?.has(value) ?? false)
                          // Explains each model's own click behavior — the checked-by-
                          // default model has no tri-state cycle to describe, so it gets
                          // its own plain hide/show copy instead of reusing the tri-state
                          // labels (see docs/filter-dropdown.md's "Filter dropdown").
                          const itemTitle = () =>
                            usesExcludeOnly()
                              ? checked()
                                ? table.labels().filterValueHideTitle
                                : table.labels().filterValueShowTitle
                              : indeterminate()
                                ? table.labels().filterExcludedTitle
                                : table.labels().filterValueTitle
                          const count = () => stringValueCounts().get(value) ?? 0
                          let el: HTMLInputElement | undefined
                          createEffect(() => {
                            applyCheckboxState(el, checked(), indeterminate())
                          })
                          return (
                            <label
                              class="dt-dd-item"
                              style={{
                                height: `${FILTER_LIST_ITEM_HEIGHT}px`,
                                'box-sizing': 'border-box',
                              }}
                            >
                              <input
                                type="checkbox"
                                data-dd-value-row
                                data-value={value}
                                checked={checked()}
                                title={itemTitle()}
                                ref={el}
                                onClick={(e) => {
                                  e.preventDefault()
                                  handleValueClick(value, (e as MouseEvent).shiftKey)
                                  deferCheckboxCorrection(el, () => ({
                                    checked: checked(),
                                    indeterminate: indeterminate(),
                                  }))
                                }}
                              />
                              <span class="dt-flex1">
                                {col().renderFilterLabel ? col().renderFilterLabel!(value) : value}
                              </span>
                              <span class="dt-filter-count" aria-hidden="true">
                                {count()}
                              </span>
                            </label>
                          )
                        }}
                      </For>
                    </div>
                  </div>
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
              onSearchInput={setSearchTerm}
              sortIcon={getDateSortIcon(valueSort().dir)}
              sortLabel={table.labels().sortValues}
              onSortClick={cycleSort}
              clearSearchLabel={table.labels().clearSearch}
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
                    onToggleExpand={toggleExpand}
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
    </div>
  )
}
