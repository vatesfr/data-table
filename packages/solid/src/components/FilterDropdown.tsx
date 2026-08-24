import {
  For,
  Show,
  createEffect,
  createMemo,
  createRenderEffect,
  createSignal,
  untrack,
} from 'solid-js'
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
  computeVirtualRange,
  getVirtualScrollTarget,
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
        data-dd-value-search
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
// controls — checklist (string, virtualized — see "Checklist virtualization" above), range +
// slider (number), or a Year›Month›Day tree + range + slider (date, never virtualized — every
// currently-expanded row is already naturally hierarchical/collapsed by default).
//
// Implements pane-crossing (ArrowRight/ArrowLeft between the left column list and the right
// detail pane), right-pane Up/Down/Home/End nav, and focus-follows-selection, at parity with
// React/Vue — see `handlePanelKeyDown`/`focusChecklistIndex` below and the `onFocusIn` on
// `.dt-filter-cols`.
export function FilterDropdown<TRow extends object>(props: FilterDropdownProps<TRow>) {
  const { table } = props
  const filterableCols = createMemo(() => props.columns.filter((c) => c.filterable !== false))

  // Whether `col` currently has any active filter (checklist include/exclude or a set range) —
  // shared by the left-pane per-row indicator/clear button below and the open-time ordering
  // snapshot (see `orderKeys` below).
  function hasActiveFilter(col: ColumnDef<TRow>): boolean {
    const rf = table.filter.ranges()[col.key]
    return (
      (table.filter.include()[col.key]?.size ?? 0) > 0 ||
      (table.filter.exclude()[col.key]?.size ?? 0) > 0 ||
      (rf !== undefined && (rf.min !== '' || rf.max !== ''))
    )
  }

  const [activeKey, setActiveKey] = createSignal<string | null>(null)
  // Narrows the left pane's *column list* — a separate concern from `searchTerms` below, which
  // narrows the active column's *values* in the right detail pane (see CLAUDE.md's "Dropdown
  // column search and keyboard navigation").
  const [colSearchTerm, setColSearchTerm] = createSignal('')

  // Snapshot of the left pane's column order, captured only at the moment the dropdown opens —
  // active-filter columns first, then the rest, both alphabetically within their own group. Per
  // user preference: reordering live (as filters are toggled while the panel stays open) is more
  // jarring than useful, so the order is frozen for the whole open session and only re-taken on
  // the next open. `null` while closed/never opened, meaning "no snapshot yet, fall back to plain
  // alpha order".
  const [orderKeys, setOrderKeys] = createSignal<string[] | null>(null)
  let wasOpen = false
  // createRenderEffect (not createEffect): must resolve synchronously in the same update flush
  // that flips the panel's `<Show>` open, so the very first render of the left-pane list already
  // reads the fresh snapshot instead of one stale tick of plain alpha order — same reasoning as
  // `data`/`columns`' own accessor-tracking effects in createTableState.ts.
  createRenderEffect(() => {
    const open = props.isOpen
    if (open && !wasOpen) {
      const sorted = filterableCols()
        .slice()
        .sort((a, b) => a.label.localeCompare(b.label))
      // Untracked: this must not re-run (and thus can't accidentally reorder mid-session) just
      // because a filter changes while the panel is open — only `props.isOpen`'s own transition
      // to `true` should ever produce a new snapshot.
      setOrderKeys(
        untrack(() => {
          const active = sorted.filter(hasActiveFilter)
          const inactive = sorted.filter((c) => !hasActiveFilter(c))
          return [...active, ...inactive].map((c) => c.key)
        }),
      )
    }
    wasOpen = open
  })

  const searchedFilterableCols = createMemo(() => {
    const term = colSearchTerm().trim().toLowerCase()
    const cols = term
      ? filterableCols().filter((c) => c.label.toLowerCase().includes(term))
      : filterableCols()
    const order = orderKeys()
    if (!order) return cols.slice().sort((a, b) => a.label.localeCompare(b.label))
    // A column absent from the snapshot (added to `columns` after the dropdown was opened) sorts
    // after every snapshotted one, alongside its own alphabetical fallback.
    const indexOf = (key: string) => {
      const i = order.indexOf(key)
      return i === -1 ? order.length : i
    }
    return cols.slice().sort((a, b) => {
      const diff = indexOf(a.key) - indexOf(b.key)
      return diff !== 0 ? diff : a.label.localeCompare(b.label)
    })
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

  // --- Checklist virtualization ---
  // A column with thousands of distinct values (a customer name, an order ID) would otherwise
  // mount one <label>/<input> per value regardless of scroll position — see CLAUDE.md's
  // "Performance" and "The flat checklist is virtualized in React and Vue" in the docs. Solid's
  // own version of this, windowing filterDetailValues() the same way.
  let filterListEl: HTMLDivElement | undefined
  const [scrollTop, setScrollTop] = createSignal(0)
  // Resets scroll to 0 whenever the active column or its search term changes — matches React/
  // Vue's own reset trigger (a stale scroll position from a previous column/search makes no
  // sense against a freshly-narrowed list).
  createEffect(() => {
    void activeCol()?.key
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

  // --- Left/right pane-crossing + right-pane row nav (Up/Down/Home/End) ---
  // A separate handler from Dropdown.tsx's own generic roving nav (which only ever reaches this
  // panel's left-pane `.dt-filter-col-item` buttons via `data-dd-row`) — this one needs to reach
  // into filter-specific DOM (the right-pane checklist/date-tree) that the generic handler knows
  // nothing about. Bound on `.dt-filter-panel` itself, a descendant of Dropdown's own panel, so it
  // runs *before* the generic handler via bubbling — deliberately not calling
  // preventDefault/stopPropagation for a key it doesn't itself handle, so a plain ArrowUp/Down/
  // Home/End on a left-pane button still reaches Dropdown.tsx's own handler untouched.
  let panelEl: HTMLDivElement | undefined
  function isEditableTarget(el: Element | null): boolean {
    return el instanceof HTMLInputElement && ['text', 'number', 'date', 'range'].includes(el.type)
  }
  function detailFocusables(detailEl: Element): HTMLElement[] {
    return Array.from(
      detailEl.querySelectorAll<HTMLElement>(
        'input[data-dd-value-search], input[data-dd-value-row], .dt-date-tree-wrap input[type="checkbox"]',
      ),
    )
  }
  function handlePanelKeyDown(e: KeyboardEvent): void {
    if (!panelEl) return
    const target = e.target as HTMLElement
    // Delete/Backspace on a focused left-pane column row clears that column's filter — the
    // keyboard equivalent of clicking its `×` clear button (see `hasActiveFilter`/the render
    // below). Guarded to an actually-active column so pressing it on an inert row is a true no-op
    // (no page-reset churn from `table.filter.clearColumn`'s unconditional `setPageState(1)`).
    if ((e.key === 'Delete' || e.key === 'Backspace') && target.matches('.dt-filter-col-item')) {
      const key = target.dataset.filterColKey
      const col = key && filterableCols().find((c) => c.key === key)
      if (col && hasActiveFilter(col)) {
        e.preventDefault()
        table.filter.clearColumn(col.key, 'include')
        table.filter.clearColumn(col.key, 'exclude')
        table.filter.clearColumn(col.key, 'range')
      }
      return
    }
    if (e.key === 'ArrowRight' && target.matches('.dt-filter-col-item')) {
      const detailEl = panelEl.querySelector('.dt-filter-detail')
      const first = detailEl && detailFocusables(detailEl)[0]
      if (first) {
        e.preventDefault()
        first.focus()
      }
      return
    }
    const detailEl = target.closest('.dt-filter-detail')
    if (!detailEl) return
    if (e.key === 'ArrowLeft') {
      if (isEditableTarget(document.activeElement)) return
      const activeColBtn = panelEl.querySelector<HTMLElement>(
        '.dt-filter-cols .dt-filter-col-item--active',
      )
      if (activeColBtn) {
        e.preventDefault()
        activeColBtn.focus()
      }
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
    if (col && col.type !== 'date' && col.type !== 'number') {
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

    const focusables = detailFocusables(detailEl)
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
      <div class="dt-filter-panel" ref={panelEl} onKeyDown={handlePanelKeyDown}>
        <div
          class="dt-filter-cols"
          // Listbox/radiogroup-style: focusing a column button by any means (click, Tab, the
          // arrow-nav above) drives which column's detail pane shows — not just an explicit
          // click/activate step. `focusin` (unlike `focus`) bubbles, so one delegated listener
          // here covers every column button without per-row wiring.
          onFocusIn={(e) => {
            const key = (e.target as HTMLElement).closest<HTMLElement>('.dt-filter-col-item')
              ?.dataset.filterColKey
            if (key) setActiveKey(key)
          }}
        >
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
              const hasActive = createMemo(() => hasActiveFilter(col))
              return (
                <div class="dt-filter-col-row">
                  <button
                    type="button"
                    class={`dt-filter-col-item${activeCol()?.key === col.key ? ' dt-filter-col-item--active' : ''}`}
                    data-dd-row
                    data-filter-col-key={col.key}
                    onClick={() => setActiveKey(col.key)}
                  >
                    <span>{col.label}</span>
                  </button>
                  {/* Replaces the plain active-filter dot: a one-click way to drop this column's
                      filter without opening it first, matching the toolbar's own per-dropdown ×
                      buttons — see CLAUDE.md's "Toolbar clear buttons". A sibling of the column
                      button rather than nested inside it, since a <button> can't contain another
                      interactive element. */}
                  <Show when={hasActive()}>
                    <button
                      type="button"
                      class="dt-filter-col-clear"
                      title={table.labels().clearColumnFilter}
                      aria-label={table.labels().clearColumnFilter}
                      onClick={(e) => {
                        e.stopPropagation()
                        // Clears every kind at once — this button means "drop this column's
                        // filter entirely", unlike the active-bar's own per-kind chips.
                        table.filter.clearColumn(col.key, 'include')
                        table.filter.clearColumn(col.key, 'exclude')
                        table.filter.clearColumn(col.key, 'range')
                      }}
                    >
                      ×
                    </button>
                  </Show>
                </div>
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
