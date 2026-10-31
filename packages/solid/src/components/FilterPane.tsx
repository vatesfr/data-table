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
// Fixed row height so windowing is exact; the assumed list height stays within the overscan of the real one
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
  // Any/all match buttons, passed only for an array-valued column
  matchMode?: 'and' | 'or'
  matchAnyLabel?: string
  matchAllLabel?: string
  onSetMatchMode?: (mode: 'and' | 'or') => void
  clearSearchLabel: string
}

// Select-all checkbox, value search and sort toggle, shared by the checklist and the date tree
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

// One column's filter controls (checklist, range + slider, or date tree), shown by the Filter
// dropdown and the header menu; owns its view state, so render it keyed by column.
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

  // --- Checklist virtualization (docs/filter-dropdown.md) ---
  let filterListEl: HTMLDivElement | undefined
  const [scrollTop, setScrollTop] = createSignal(0)
  // Back to the top when the search changes what row 0 is
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
    // Cheap insurance against the native click racing Solid's write
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

    // A value outside the mounted window (or Home/End) needs focusChecklistIndex; the date tree is all mounted
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

  // Scrolls `values[targetIdx]` into the window and focuses it: Solid updates the DOM synchronously
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
                {/* Bulk (de)select what the value search hides (docs/filter-dropdown.md) */}
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
                  {/* Full-height spacer for a true scrollbar; the inner div holds the mounted window */}
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
