import { For, Show, createEffect, createMemo, createSignal } from 'solid-js'
import type { ValueSort } from '@vates/data-table-core'
import {
  computeStringValues,
  computeStringValueCounts,
  computeValueBounds,
  nextValueSort,
  checklistValues,
  isExcludeOnlyColumn,
  toggleCollapse,
  getValueSortIcon,
  getDateSortIcon,
  computeDateTree,
  isMultiValueColumnCached,
  formatFilterValue,
  computeVirtualRange,
  getVirtualScrollTarget,
  rovingFocusTarget,
  checklistNavIndex,
  checklistBulkState,
  clickChecklistValue,
  toggleChecklistExclude,
  clickDateTreeNode,
  toggleChecklistValues,
  type DateTreeNode,
  applyCheckboxState,
  deferCheckboxCorrection,
  filterMatchMode,
  FILTER_DETAIL_NAV_SELECTOR,
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

/** The pane's keyboard stops, in order: value search, then checklist rows or date tree checkboxes */
function detailFocusables(detailEl: Element): HTMLElement[] {
  return Array.from(detailEl.querySelectorAll<HTMLElement>(FILTER_DETAIL_NAV_SELECTOR))
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

  const stringValueCounts = createMemo(() =>
    computeStringValueCounts(
      table.data(),
      activeCol(),
      table.filter.include(),
      table.filter.ranges(),
      table.columns.list(),
      table.labels().emptyValue,
      table.filter.exclude(),
      table.filter.modes(),
    ),
  )

  const bounds = createMemo(() => {
    const col = activeCol()
    return computeValueBounds(table.data(), col)
  })

  // Any/all match mode — only for a column whose values are actually arrays (see
  // `isMultiValueColumn`); cached in core per data array and column
  const isMultiValueCol = createMemo(() => isMultiValueColumnCached(table.data(), activeCol()))
  const matchMode = createMemo(() =>
    filterMatchMode(table.filter.modes(), activeCol().key, activeCol()),
  )

  // A plain string column's checklist is checked-by-default, exclude-only (see
  // docs/filter-dropdown.md's "Filter dropdown"): "checked" means "not in `excludeFilters`"
  const usesExcludeOnly = createMemo(() => isExcludeOnlyColumn(table.data(), activeCol()))

  const allValues = createMemo(() =>
    computeStringValues(table.data(), activeCol(), table.labels().emptyValue),
  )
  const checklist = createMemo(() => {
    const col = activeCol()
    return checklistValues(
      col,
      allValues(),
      stringValueCounts(),
      (usesExcludeOnly() ? table.filter.exclude() : table.filter.include())[col.key],
      table.filter.ranges()[col.key],
      searchTerm(),
      valueSort(),
    )
  })
  const filterDetailValues = () => checklist()[0]
  // "Others": the values the value search is hiding; empty without a search
  const otherValues = () => checklist()[1]

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
    setExpanded((prev) => toggleCollapse(prev, path))
  }
  function cycleSort(): void {
    setValueSort(nextValueSort(activeCol(), valueSort()))
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
  function handleExcludeClick(value: string): void {
    toggleChecklistExclude(
      table.filter,
      activeCol().key,
      value,
      table.filter.exclude()[activeCol().key],
    )
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
      // Clearing can remove the focused element (the "Others" row): keep focus on the search box
      ;(e.currentTarget as HTMLElement)
        .querySelector<HTMLElement>('input[data-dd-value-search]')
        ?.focus()
      return
    }
    if (e.altKey) return
    // ←/→ cross between a value's checkbox and its ≠ button; ← from the checkbox leaves the pane
    const target = e.target as HTMLElement
    const partner = (selector: string) =>
      target.closest('.dt-dd-item')?.querySelector<HTMLElement>(selector)
    if (e.key === 'ArrowRight' && target.matches('input[data-dd-value-row]')) {
      const button = partner('[data-dd-value-exclude]')
      if (button) {
        e.preventDefault()
        button.focus()
      }
      return
    }
    if (e.key === 'ArrowLeft' && target.matches('[data-dd-value-exclude]')) {
      e.preventDefault()
      e.stopPropagation()
      partner('input[data-dd-value-row]')?.focus()
      return
    }
    // Only the value search joins the vertical chain; select-all and the sort button sit beside it
    const focusables = detailFocusables(e.currentTarget as HTMLElement)
    const rows = focusables.filter((el) => !el.matches('input[data-dd-value-search]'))
    const active = document.activeElement as HTMLElement | null
    // Up/Down from a ≠ button stays in the ≠ column
    const onExclude = !!active?.matches('[data-dd-value-exclude]')
    if (!active || (!focusables.includes(active) && !onExclude)) return

    // The flat checklist is virtualized (see "Checklist virtualization" below): a value outside
    // the mounted window (or Home/End) needs focusChecklistIndex's scroll-then-focus; the date
    // tree is fully mounted, so DOM order works
    const col = activeCol()
    if (col.type !== 'date' && col.type !== 'number') {
      const values = filterDetailValues()
      const i = checklistNavIndex(e.key, values, active.dataset.value)
      if (i !== null) {
        e.preventDefault()
        focusChecklistIndex(i, values, onExclude)
        return
      }
    }

    const next = rovingFocusTarget(e.key, focusables, active, rows)
    if (!next) return
    e.preventDefault()
    next.focus()
  }

  // Scrolls (if needed) and focuses the checklist row at `values[targetIdx]` — the scroll-then-
  // focus dance a virtualized list needs when the target isn't in the currently-mounted window.
  // Solid's DOM update for the new window is synchronous within this same call (same reasoning
  // as the Sort/Group activate/remove focus retention elsewhere in this codebase), so no
  // pending-ref/effect indirection is needed: set scrollTop, then focus, in the same tick.
  function focusChecklistIndex(targetIdx: number, values: string[], onExclude = false): void {
    const value = values[targetIdx]
    if (value === undefined) return
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
    const selector = onExclude ? '[data-dd-value-exclude]' : 'input[data-dd-value-row]'
    for (const el of filterListEl.querySelectorAll<HTMLElement>(selector)) {
      if (el.dataset.value === value) {
        el.focus()
        break
      }
    }
  }

  return (
    <div class="dt-filter-detail" data-filter-detail onKeyDown={handleKeyDown}>
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
                          // Non-multi-value column: "checked" means "not excluded".
                          // Multi-value column: the checkbox includes, the ≠ button excludes.
                          const excluded = () =>
                            table.filter.exclude()[col().key]?.has(value) ?? false
                          const checked = () =>
                            usesExcludeOnly()
                              ? !excluded()
                              : (table.filter.include()[col().key]?.has(value) ?? false)
                          const itemTitle = () =>
                            usesExcludeOnly()
                              ? checked()
                                ? table.labels().filterValueHideTitle
                                : table.labels().filterValueShowTitle
                              : undefined
                          const count = () => stringValueCounts().get(value) ?? 0
                          let el: HTMLInputElement | undefined
                          createEffect(() => {
                            applyCheckboxState(el, checked(), false)
                          })
                          return (
                            <div
                              class="dt-dd-item"
                              classList={{
                                'dt-dd-item--exclude': !usesExcludeOnly() && excluded(),
                              }}
                              style={{
                                height: `${FILTER_LIST_ITEM_HEIGHT}px`,
                                'box-sizing': 'border-box',
                              }}
                            >
                              <label class="dt-filter-value">
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
                                      indeterminate: false,
                                    }))
                                  }}
                                />
                                <span class="dt-flex1">
                                  {col().renderFilterLabel
                                    ? col().renderFilterLabel!(value)
                                    : formatFilterValue(col(), value, table.labels().emptyValue)}
                                </span>
                                <span class="dt-filter-count" aria-hidden="true">
                                  {count()}
                                </span>
                              </label>
                              <Show when={!usesExcludeOnly()}>
                                <button
                                  type="button"
                                  class="dt-filter-exclude"
                                  data-dd-value-exclude
                                  data-value={value}
                                  aria-pressed={excluded()}
                                  aria-label={table
                                    .labels()
                                    .excludeValue(
                                      formatFilterValue(col(), value, table.labels().emptyValue),
                                    )}
                                  title={table
                                    .labels()
                                    .excludeValue(
                                      formatFilterValue(col(), value, table.labels().emptyValue),
                                    )}
                                  onClick={() => handleExcludeClick(value)}
                                >
                                  ≠
                                </button>
                              </Show>
                            </div>
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
              onSetRange={(min, max) => {
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
          onSetRange={(min, max) => {
            table.filter.setRange(col().key, 'min', min)
            table.filter.setRange(col().key, 'max', max)
          }}
        />
      </Show>
    </div>
  )
}
