import {
  processData,
  searchData,
  groupData,
  sortWithinGroups,
  computeStringValues,
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
  computeAggregate,
  getColumnValue,
  calcTotalPages,
  toggleSort as coreToggleSort,
  setSort as coreSetSort,
  appendOrToggleSort as coreAppendOrToggleSort,
  moveSortBy as coreMoveSortBy,
  reorderSort as coreReorderSort,
  toggleFilterAll as coreToggleFilterAll,
  setFilterValues as coreSetFilterValues,
  cycleFilterValue,
  clearExcludeValues,
  selectRange,
  toggleGroupBy,
  toggleCollapse,
  getVisibleRows,
  paginateVisibleGroups,
  paginateVisibleItems,
  mergePageSizeOptions,
  isGroupCollapsed,
  isSameVisibleItem,
  indexOfVisibleItem,
  getOrderedColumns,
  reorderColumn as coreReorderColumn,
  moveColumnBy as coreMoveColumnBy,
  getSortIcon,
  getSortIndex,
  countActiveFilters,
  computeDateTree,
  getDateTreeNodeState,
  sumDateTreeNodeCount,
  findDateTreeNode,
  selectDateRange,
  computeVirtualRange,
  DEFAULT_LABELS,
  bucketNumericRange,
  formatNumericRange,
  bucketDatePart,
  formatDatePart,
  compareMissingLast,
  type SortEntry,
  type SortDir,
  type RangeFilter,
  type DataTableLabels,
  type TableViewState,
  type DateTreeNode,
  type ValueSort,
  type VisibleItem,
  type PagedGroup,
} from '@vates/data-table-core'
import type { ColumnDef, DataTableOptions, DataTableInstance } from './types'
import { STYLES } from './styles'

export type { ColumnDef, DataTableOptions, DataTableInstance }
export type { DataTableLabels, TableViewState } from '@vates/data-table-core'
export { persistViewToLocalStorage, syncViewToUrl, resetView } from './persistence'
export type { ViewStateApi, SyncViewToUrlOptions, ResetViewOptions } from './persistence'
export { createScoreBar } from './components/scoreBar'
export type { ScoreBarOptions } from './components/scoreBar'
export * from '@vates/data-table-core/locales'
// Ready-made groupValue/groupFormat pairs for bucketing a continuous/high-cardinality column
// (percentages, timestamps) into coarser groups — see `ColumnDefBase.groupValue` in the docs.
export { bucketNumericRange, formatNumericRange, bucketDatePart, formatDatePart }
// Ready-made compare for pinning a value (missing data, by default) last regardless of sort
// direction — see `ColumnDefBase.compare` in the docs.
export { compareMissingLast }
export type { DatePart } from '@vates/data-table-core'

// --- Styles ---

let stylesInjected = false
function injectStyles(): void {
  if (stylesInjected || typeof document === 'undefined') return
  stylesInjected = true
  const s = document.createElement('style')
  s.dataset.dtStyles = ''
  s.textContent = STYLES
  document.head.insertBefore(s, document.head.firstChild)
}

// --- HTML helpers ---

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildDd(isOpen: boolean, trigger: string, contentFn: () => string): string {
  return `<div class="dt-dd-wrap">${trigger}${isOpen ? `<div class="dt-dd">${contentFn()}</div>` : ''}</div>`
}

const DEFAULT_VALUE_SORT: ValueSort = { by: 'alpha', dir: 'asc' }
// Fixed row height for the filter dropdown's virtualized checklist (see computeVirtualRange) —
// must match the actual rendered height of a checklist row exactly, which is why each row gets
// an explicit inline height below instead of relying on dt-dd-item's padding + line-height.
const FILTER_LIST_ITEM_HEIGHT = 32
// Floor height for the filter dropdown's checklist/date-tree viewport, and its value before the
// panel has been measured even once (first open). The *actual* height used is `_filterListHeight`
// below, corrected post-render to whatever the panel really renders at — see the measurement
// pass at the bottom of render(). GitHub issue #13.
const FILTER_LIST_DEFAULT_HEIGHT = 260

// --- Factory ---

export function createDataTable<TRow extends object>(
  container: HTMLElement,
  options: DataTableOptions<TRow>,
): DataTableInstance<TRow> {
  injectStyles()

  let data = options.data
  let columns = options.columns
  const {
    rowKey,
    selectable = false,
    onSelectionChange,
    onRowClick,
    defaultGroupsCollapsed = true,
  } = options
  const L: DataTableLabels = { ...DEFAULT_LABELS, ...options.labels }

  let sorts: SortEntry[] = []
  let filters: Record<string, Set<string>> = {}
  // "Not one of these values" filters for multi-value columns — a separate Set per column, kept
  // mutually exclusive with `filters` (a value is never in both at once) by `cycleFilterValue`/
  // `clearExcludeValues`. See "Filter dropdown" (exclude filters) in the docs.
  let excludeFilters: Record<string, Set<string>> = {}
  let rangeFilters: Record<string, RangeFilter> = {}
  let groupBy: string[] = []
  let collapsedGroups = new Set<string>()
  let page = 1
  let pageSize = options.defaultPageSize ?? 0
  let visibleCols = new Set<string>(options.defaultVisibleColumns ?? columns.map((c) => c.key))
  let columnOrder: string[] = []
  let selection = new Set<TRow>()
  let selectionAnchor: TRow | null = null
  let focusTarget: VisibleItem<TRow> | null = null
  let openDropdown: string | null = null
  let filterActiveCol: string | null = null
  let filterSearchTerms: Record<string, string> = {}
  // Narrows the *column list* itself in the Columns/Sort/Group dropdowns and the Filter
  // dropdown's left column pane — a completely separate concern from `filterSearchTerms` above,
  // which narrows one column's *values* in the Filter dropdown's right detail pane. Keyed by
  // dropdown id ('cols'/'sort'/'group'/'filter'), same category of ephemeral UI state as
  // `filterActiveCol`/`filterSearchTerms` — never touches `TableViewState`.
  let ddSearchTerms: Record<string, string> = {}
  let filterSelectionAnchor: Record<string, string> = {}
  let filterValueSort: Record<string, ValueSort> = {}
  let expandedDateNodes: Record<string, Set<string>> = {}
  // Scroll position of the filter dropdown's virtualized checklist (see computeVirtualRange /
  // FILTER_LIST_* below) — reset to 0 whenever the values being scrolled through change identity
  // (switching column via select-filter-col, or narrowing by search).
  let filterListScrollTop = 0
  let filterListRafPending = false
  let searchQuery = ''
  let draggedColKey: string | null = null
  let draggedColRowKey: string | null = null
  let draggedSortKey: string | null = null
  let draggedGroupKey: string | null = null
  const viewListeners = new Set<(view: TableViewState) => void>()

  // render() builds one HTML string and assigns it via innerHTML in one shot, so a col.render()
  // callback can't return a DOM node inline — instead formatStr() leaves a numbered placeholder
  // span and queues the call here; a pass right after container.innerHTML = html resolves each
  // placeholder to the real node.
  let pendingRenders: Array<{ id: number; col: ColumnDef<TRow>; value: unknown; row: TRow }> = []
  let renderIdCounter = 0

  // Updated by derive(), read by event handlers
  let _processedData: TRow[] = []
  let _groupedData: PagedGroup<TRow>[] = []
  let _numPages = 1
  let _clampedPage = 1
  let _filterDetailValues: string[] = []
  let _filterDetailTree: DateTreeNode[] = []
  // Cached alongside _filterDetailValues so the scroll-only patch path (see
  // handleFilterListScroll) can rebuild just the checklist's rendered rows without re-running
  // the full derive()/render() pipeline.
  let _stringValueCounts: Record<string, Map<string, number>> = {}
  // The filter dropdown checklist/date-tree's actual viewport height in px — starts at the
  // floor default and is corrected after every render to whatever `.dt-filter-panel` really
  // renders at (see the measurement pass at the bottom of render()), so a tall `.dt-filter-cols`
  // list no longer leaves dead space below a checklist stuck at a hardcoded height. Persists
  // across renders (unlike _filterDetailValues etc.) so the *next* render's initial HTML/
  // computeVirtualRange call already uses a close-to-correct number instead of always starting
  // from the floor and visibly correcting after the fact. GitHub issue #13.
  let _filterListHeight = FILTER_LIST_DEFAULT_HEIGHT
  // Every item across the *full* filtered/grouped dataset (not just this page) in display order —
  // a group header for every group (even a collapsed one, so it stays reachable) plus its rows
  // unless it's collapsed. Grouping over the full dataset first, then paginating this flattened
  // sequence (see `paginateVisibleGroups`/`paginateVisibleItems`), is what lets a page's row
  // budget count header rows alongside data rows instead of paginating data rows first and
  // grouping whatever lands on that page afterward — see "Pagination" in the docs.
  let _visibleItems: VisibleItem<TRow>[] = []
  // `_visibleItems` sliced to this page and narrowed to what's actually a valid Tab stop right
  // now: group headers always are, data rows only when the table is otherwise interactive
  // (selectable or onRowClick). This is the Up/Down/Home/End navigation order (see "Keyboard
  // navigation").
  let _navigableItems: VisibleItem<TRow>[] = []

  // The filter dropdown is a master-detail layout — only one column's checklist is ever visible
  // at a time — so facet counts only ever need computing for that one column, not every
  // filterable column. `filterActiveCol` may be null or stale (a column that's since become
  // non-filterable), so this mirrors the same fallback-to-first-filterable-column resolution
  // used to pick which column's detail pane actually renders.
  function resolveFilterActiveKey(filterableCols: ColumnDef<TRow>[]): string | null {
    return filterActiveCol && filterableCols.some((c) => c.key === filterActiveCol)
      ? filterActiveCol
      : (filterableCols[0]?.key ?? null)
  }

  function defaultSortDirFor(key: string): SortDir {
    return columns.find((c) => c.key === key)?.defaultSortDir ?? 'asc'
  }

  function derive() {
    const stringValueMap = computeStringValues(data, columns, L.emptyValue)
    const filterableCols = columns.filter((c) => c.filterable !== false)
    const filterActiveKey = resolveFilterActiveKey(filterableCols)
    const stringValueCounts = computeStringValueCounts(
      data,
      filters,
      rangeFilters,
      columns,
      L.emptyValue,
      filterActiveKey ? [filterActiveKey] : [],
      excludeFilters,
    )
    _processedData = processData(
      searchData(data, searchQuery, columns),
      filters,
      rangeFilters,
      sorts,
      columns,
      L.emptyValue,
      excludeFilters,
    )
    // Grouping runs over the *full* filtered/sorted data, not a page's slice — see the
    // `_visibleItems` comment above.
    const groupedFull = sortWithinGroups(
      groupData(_processedData, groupBy, columns, L.emptyValue),
      sorts,
      groupBy,
      columns,
    )
    _visibleItems = getVisibleRows(groupedFull, collapsedGroups, defaultGroupsCollapsed)
    _numPages = calcTotalPages(_visibleItems.length, pageSize)
    _clampedPage = Math.min(page, Math.max(1, _numPages))
    _groupedData = paginateVisibleGroups(
      groupedFull,
      _visibleItems,
      collapsedGroups,
      defaultGroupsCollapsed,
      _clampedPage,
      pageSize,
    )
    const orderedColumns = getOrderedColumns(columns, columnOrder)
    const activeColumns = orderedColumns.filter(
      (c) => visibleCols.has(c.key) && !groupBy.includes(c.key),
    )
    const activeFilterCount = countActiveFilters(filters, rangeFilters, excludeFilters)
    const selectedRows = _processedData.filter((r) => selection.has(r))
    return {
      stringValueMap,
      stringValueCounts,
      orderedColumns,
      activeColumns,
      activeFilterCount,
      selectedRows,
    }
  }

  function buildViewState(): TableViewState {
    const view: TableViewState = {}
    const allKeys = columns.map((c) => c.key)
    const isDefaultVisible =
      visibleCols.size === allKeys.length && allKeys.every((k) => visibleCols.has(k))
    if (!isDefaultVisible) view.visibleCols = [...visibleCols]
    if (columnOrder.length) view.columnOrder = columnOrder
    if (sorts.length) view.sorts = sorts
    const filterEntries = Object.entries(filters).filter(([, v]) => v.size > 0)
    if (filterEntries.length)
      view.filters = Object.fromEntries(filterEntries.map(([k, v]) => [k, [...v]]))
    const excludeFilterEntries = Object.entries(excludeFilters).filter(([, v]) => v.size > 0)
    if (excludeFilterEntries.length)
      view.excludeFilters = Object.fromEntries(excludeFilterEntries.map(([k, v]) => [k, [...v]]))
    const rangeEntries = Object.entries(rangeFilters).filter(
      ([, r]) => r.min !== '' || r.max !== '',
    )
    if (rangeEntries.length) view.rangeFilters = Object.fromEntries(rangeEntries)
    if (groupBy.length) view.groupBy = groupBy
    if (collapsedGroups.size) view.collapsedGroups = [...collapsedGroups]
    if (page !== 1) view.page = page
    if (pageSize !== (options.defaultPageSize ?? 0)) view.pageSize = pageSize
    if (searchQuery) view.searchQuery = searchQuery
    return view
  }

  function applyViewState(view: TableViewState): void {
    const validVisible = view.visibleCols?.filter((k) => columns.some((c) => c.key === k))
    visibleCols = validVisible?.length
      ? new Set(validVisible)
      : new Set(options.defaultVisibleColumns ?? columns.map((c) => c.key))
    columnOrder = view.columnOrder?.filter((k) => columns.some((c) => c.key === k)) ?? []
    sorts = view.sorts ?? []
    filters = Object.fromEntries(
      Object.entries(view.filters ?? {}).map(([k, v]) => [k, new Set(v)]),
    )
    excludeFilters = Object.fromEntries(
      Object.entries(view.excludeFilters ?? {}).map(([k, v]) => [k, new Set(v)]),
    )
    rangeFilters = view.rangeFilters ?? {}
    groupBy = view.groupBy ?? []
    collapsedGroups = new Set(view.collapsedGroups ?? [])
    page = view.page ?? 1
    pageSize = view.pageSize ?? options.defaultPageSize ?? 0
    searchQuery = view.searchQuery ?? ''
    render()
    notifyViewChange()
  }

  function notifyViewChange(): void {
    const view = buildViewState()
    for (const cb of viewListeners) cb(view)
  }

  // Arrow-key/Ctrl+Home/Ctrl+End navigation can target an item that isn't on the current page —
  // `_visibleItems` already covers the *full* filtered/grouped dataset, so jumping to an arbitrary
  // page is just slicing it again (with the same continuation-header handling as the current
  // page), no re-grouping needed.
  function visibleItemsForPage(p: number): VisibleItem<TRow>[] {
    return paginateVisibleItems(_visibleItems, p, pageSize).filter(
      (item) => item.kind === 'group' || selectable || !!onRowClick,
    )
  }

  /** Shared by the checkbox click handler and keyboard Space/Shift+Arrow — see toggleRowSelection in React/Vue. */
  function applyRowSelectionToggle(row: TRow, shiftKey: boolean): void {
    const next = new Set(selection)
    if (shiftKey && selectionAnchor) {
      const shouldSelect = !next.has(row)
      const range = selectRange(_processedData, selectionAnchor, row)
      if (shouldSelect) range.forEach((r) => next.add(r))
      else range.forEach((r) => next.delete(r))
    } else if (next.has(row)) {
      next.delete(row)
    } else {
      next.add(row)
    }
    selection = next
    selectionAnchor = row
  }

  /** Shared by the group header's own select-all checkbox and keyboard Space — mirrors applyRowSelectionToggle. */
  function applyGroupSelectionToggle(gkey: string): boolean {
    const group = _groupedData.find((g) => g.key === gkey)
    if (!group) return false
    const groupRows = group.rows
    const next = new Set(selection)
    const someSel = groupRows.some((r) => next.has(r))
    if (someSel) groupRows.forEach((r) => next.delete(r))
    else groupRows.forEach((r) => next.add(r))
    selection = next
    return true
  }

  function formatStr(v: unknown, row: TRow, col: ColumnDef<TRow>): string {
    if (col.render) {
      const id = renderIdCounter++
      pendingRenders.push({ id, col, value: v, row })
      return `<span data-render-slot="${id}"></span>`
    }
    if (col.format) return esc(col.format(v, row))
    if (Array.isArray(v)) return esc(v.join(', '))
    return esc(v != null ? String(v) : '')
  }

  function aggStr(col: ColumnDef<TRow>, rows: TRow[], sampleRow: TRow): string {
    const v = computeAggregate(col, rows)
    if (v === undefined || v === null) return ''
    return formatStr(v, sampleRow, col)
  }

  function cellStr(row: TRow, col: ColumnDef<TRow>): string {
    return formatStr(getColumnValue(col, row), row, col)
  }

  function valueSortFor(key: string): ValueSort {
    return (
      filterValueSort[key] ??
      columns.find((c) => c.key === key)?.defaultValueSort ??
      DEFAULT_VALUE_SORT
    )
  }

  /**
   * The virtualized checklist's inner content (spacer + windowed rows) for `col` — everything
   * that goes *inside* the `.dt-filter-list` wrapper, not the wrapper itself. Shared by the full
   * render() (below) and handleFilterListScroll's scroll-only patch, which needs to regenerate
   * just this on every scroll tick without rebuilding (and thereby destroying) the scrollable
   * `.dt-filter-list` element itself — see handleFilterListScroll for why that distinction matters.
   */
  function buildFilterListInnerHtml(col: ColumnDef<TRow>): string {
    const { startIndex, endIndex, offsetY, totalHeight } = computeVirtualRange(
      filterListScrollTop,
      _filterListHeight,
      FILTER_LIST_ITEM_HEIGHT,
      _filterDetailValues.length,
    )
    let s = `<div style="height:${totalHeight}px;position:relative">`
    s += `<div style="position:absolute;top:${offsetY}px;left:0;right:0">`
    for (const v of _filterDetailValues.slice(startIndex, endIndex)) {
      const count = _stringValueCounts[col.key]?.get(v) ?? 0
      const excluded = excludeFilters[col.key]?.has(v) ?? false
      // Tri-state checkbox: unchecked (neutral) → checked (include) → indeterminate (exclude,
      // rendered as a dash by every browser's native checkbox — a fitting "not this" glyph with
      // no extra markup) → back to unchecked. `indeterminate` isn't settable via an HTML
      // attribute, so `data-exclude` here just flags the node for the post-render fix-up pass
      // (below `container.innerHTML = html`, and again in `handleFilterListScroll`'s own patch)
      // that actually sets it, mirroring the date tree's own `data-indeterminate` convention.
      s += `<label class="dt-dd-item${excluded ? ' dt-dd-item--exclude' : ''}" style="height:${FILTER_LIST_ITEM_HEIGHT}px;box-sizing:border-box"><input type="checkbox" data-action="toggle-filter" data-key="${esc(col.key)}" data-value="${esc(v)}"${excluded ? ' data-exclude' : ''}${filters[col.key]?.has(v) ? ' checked' : ''} title="${esc(excluded ? L.filterExcludedTitle : L.filterValueTitle)}"> <span class="dt-flex1">${esc(v)}</span><span class="dt-filter-count">${count}</span></label>`
    }
    s += `</div></div>`
    return s
  }

  /** Formats a bound (epoch ms for a date column, a plain number otherwise) back into the string
   * shape `RangeFilter.min`/`.max` uses — shared by the slider's drag/commit handlers and the plain
   * min/max inputs' own data-derived default value. */
  function formatRangeBound(n: number, col: ColumnDef<TRow>): string {
    return col.type === 'date' ? new Date(n).toISOString().slice(0, 10) : String(n)
  }

  /**
   * A "2 inputs + a slider" range control for a `number`/`date` column's filter detail pane —
   * two overlapping native <input type="range"> thumbs sharing one visual track (styles.ts makes
   * only the thumb itself a hit target, so grabbing either one works regardless of z-order) plus
   * a colored fill between them. `bounds` is the column's actual min/max across the full,
   * unfiltered `data` (`computeValueBounds`, computed once by the caller and shared with the
   * plain min/max inputs' own default value so it isn't recomputed twice per render), so it
   * doesn't shift under a mid-drag user. Returns '' when there are no parseable values at all
   * (nothing to bound a slider to) — the plain min/max inputs above it keep working regardless.
   *
   * Both thumbs share one `data-action="range-slider"`: which one is nominally "low" vs "high"
   * doesn't matter, since the actual min/max is always `Math.min`/`Math.max` of both live thumb
   * values (see handleInput/handleChange) — the standard behavior for this two-native-inputs
   * trick, and it means dragging one thumb past the other just swaps their visual roles rather
   * than needing cross-clamping.
   */
  function buildRangeSlider(
    col: ColumnDef<TRow>,
    rf: RangeFilter | undefined,
    bounds: { min: number; max: number } | null,
  ): string {
    if (!bounds || bounds.min >= bounds.max) return ''
    const isDate = col.type === 'date'
    const toNum = (v: string) => (isDate ? new Date(v).getTime() : Number(v))
    const low = rf?.min ? toNum(rf.min) : bounds.min
    const high = rf?.max ? toNum(rf.max) : bounds.max
    const lo = Math.min(low, high)
    const hi = Math.max(low, high)
    const step = isDate ? String(24 * 60 * 60 * 1000) : 'any'
    const pctLo = ((lo - bounds.min) / (bounds.max - bounds.min)) * 100
    const pctHi = ((hi - bounds.min) / (bounds.max - bounds.min)) * 100
    const key = esc(col.key)
    let s = `<div class="dt-range-slider">`
    s += `<div class="dt-range-slider-track"></div>`
    s += `<div class="dt-range-slider-fill" style="left:${pctLo}%;right:${100 - pctHi}%"></div>`
    s += `<input type="range" class="dt-range-slider-thumb" min="${bounds.min}" max="${bounds.max}" step="${step}" value="${lo}" data-action="range-slider" data-key="${key}" aria-label="${esc(L.min)}">`
    s += `<input type="range" class="dt-range-slider-thumb" min="${bounds.min}" max="${bounds.max}" step="${step}" value="${hi}" data-action="range-slider" data-key="${key}" aria-label="${esc(L.max)}">`
    s += `</div>`
    return s
  }

  const FILTER_CHIP_MAX = 3
  function summarizeFilterValues(vals: Set<string>): string {
    const arr = [...vals]
    if (arr.length <= FILTER_CHIP_MAX) return arr.join(', ')
    return `${arr.slice(0, FILTER_CHIP_MAX).join(', ')}, ${L.moreValues(arr.length - FILTER_CHIP_MAX)}`
  }

  function render(): void {
    pendingRenders = []
    renderIdCounter = 0

    // Save focus state
    const focused = document.activeElement as HTMLElement | null
    const focusKey =
      focused && container.contains(focused) ? (focused.dataset.focusKey ?? null) : null
    const selStart = focused instanceof HTMLInputElement ? focused.selectionStart : null
    const selEnd = focused instanceof HTMLInputElement ? focused.selectionEnd : null
    // A row/group-header's DOM node is destroyed by the innerHTML rebuild below, same as any
    // focused input — but items are identified by object identity or group key (like
    // selectionAnchor), not a fixed focus-key string, so restoring focus needs its own
    // post-render step (see the bottom of this function).
    const wasItemFocused = !!focused?.closest('.dt-tr[data-proc-idx], .dt-group-row[data-gkey]')

    // The table wrap's scrollable element is destroyed and recreated by the innerHTML rebuild
    // below, same as the filter list (see its own restore further down) — without this, a
    // scrolled-down table jumps back to the top on every state change (setData, sort, filter,
    // page change), which is disruptive for streaming/live-update data.
    const tableWrapScrollTop =
      container.querySelector<HTMLElement>('.dt-table-wrap')?.scrollTop ?? 0

    const {
      stringValueMap,
      stringValueCounts,
      orderedColumns,
      activeColumns,
      activeFilterCount,
      selectedRows,
    } = derive()
    _stringValueCounts = stringValueCounts

    const rowNavEnabled = selectable || !!onRowClick
    _navigableItems = paginateVisibleItems(_visibleItems, _clampedPage, pageSize).filter(
      (item) => item.kind === 'group' || rowNavEnabled,
    )
    const effectiveFocusTarget =
      focusTarget && indexOfVisibleItem(_navigableItems, focusTarget) !== -1
        ? focusTarget
        : (_navigableItems[0] ?? null)
    const isFocusTarget = (item: VisibleItem<TRow>): boolean =>
      effectiveFocusTarget !== null && isSameVisibleItem(effectiveFocusTarget, item)

    const allSelected = _processedData.length > 0 && selectedRows.length === _processedData.length
    const someSelected = selectedRows.length > 0 && !allSelected
    const hasActiveState =
      sorts.length > 0 || activeFilterCount > 0 || groupBy.length > 0 || searchQuery !== ''
    const hasAgg = activeColumns.some((c) => c.aggregate !== undefined)
    const filterableCols = columns.filter((c) => c.filterable !== false)
    const groupableCols = columns.filter((c) => c.groupable === true)
    const filterActiveKey = resolveFilterActiveKey(filterableCols)
    const filterDetailCol = filterableCols.find((c) => c.key === filterActiveKey) ?? null
    _filterDetailValues =
      filterDetailCol && filterDetailCol.type !== 'number'
        ? sortFilterValues(
            filterValuesByCount(
              // Narrowed by the date range filter (if any) same as by search — a value outside
              // the active range never becomes a tree leaf, rather than merely being ANDed onto
              // the final row set once ticked. A no-op for string columns (they never populate
              // rangeFilters).
              filterValuesByRange(
                filterValuesBySearch(
                  stringValueMap[filterDetailCol.key] ?? [],
                  filterSearchTerms[filterDetailCol.key] ?? '',
                ),
                rangeFilters[filterDetailCol.key],
                filterDetailCol.parseDate,
              ),
              stringValueCounts[filterDetailCol.key] ?? new Map(),
              filters[filterDetailCol.key] ?? new Set(),
            ),
            stringValueCounts[filterDetailCol.key] ?? new Map(),
            valueSortFor(filterDetailCol.key),
            filterDetailCol.compare,
          )
        : []
    _filterDetailTree =
      filterDetailCol && filterDetailCol.type === 'date'
        ? computeDateTree(
            _filterDetailValues,
            L.emptyValue,
            valueSortFor(filterDetailCol.key).dir,
            filterDetailCol.parseDate,
          )
        : []

    const monthName = (m: string) =>
      new Date(2000, Number(m) - 1, 1).toLocaleDateString(undefined, { month: 'long' })

    function renderDateTreeNodes(nodes: DateTreeNode[], colKey: string, depth: number): string {
      const searchActive = (filterSearchTerms[colKey] ?? '') !== ''
      let s = ''
      for (const node of nodes) {
        const state = getDateTreeNodeState(node, filters[colKey] ?? new Set())
        const isLeaf = node.children.length === 0
        const expanded = searchActive || (expandedDateNodes[colKey]?.has(node.path) ?? false)
        const label =
          depth === 1
            ? esc(monthName(node.key))
            : depth === 2
              ? String(Number(node.key))
              : esc(node.key)
        const count = sumDateTreeNodeCount(node, stringValueCounts[colKey] ?? new Map())
        s += `<label class="dt-date-tree-item" style="padding-left:${14 + depth * 16}px">`
        s += isLeaf
          ? `<span class="dt-date-tree-toggle"></span>`
          : `<span class="dt-date-tree-toggle dt-date-tree-toggle--branch" data-action="toggle-date-expand" data-key="${esc(colKey)}" data-path="${esc(node.path)}">${expanded ? '▼' : '▶'}</span>`
        s += `<input type="checkbox" data-action="toggle-date-node" data-key="${esc(colKey)}" data-path="${esc(node.path)}"${state === 'checked' ? ' checked' : ''}${state === 'indeterminate' ? ' data-indeterminate' : ''}>`
        s += `<span class="dt-flex1">${label}</span>`
        s += `<span class="dt-filter-count">${count}</span>`
        s += `</label>`
        if (!isLeaf && expanded) s += renderDateTreeNodes(node.children, colKey, depth + 1)
      }
      return s
    }

    let html = `<div class="dt">`

    // --- Toolbar ---
    html += `<div class="dt-toolbar">`
    html += `<div class="dt-toolbar-actions">`

    // Columns
    html += buildDd(
      openDropdown === 'cols',
      `<button class="dt-btn${openDropdown === 'cols' ? ' dt-btn--active' : ''}" data-action="toggle-dd" data-dd="cols">${esc(L.columns)}</button>`,
      () => {
        // Search box narrows the list below by label — see `ddSearchTerms`. Ordering itself is
        // left untouched (still `orderedColumns`, i.e. real table column order): this list also
        // doubles as the drag-to-reorder surface, so its order carries meaning no alphabetization
        // should disturb.
        let s = `<div class="dt-dd-search-row"><input type="text" class="dt-dd-search" placeholder="${esc(L.filterSearchPlaceholder)}" value="${esc(ddSearchTerms.cols ?? '')}" data-action="dd-search" data-dd="cols" data-focus-key="ddsearch-cols"></div>`
        const term = (ddSearchTerms.cols ?? '').trim().toLowerCase()
        const searched = term
          ? orderedColumns.filter((c) => c.label.toLowerCase().includes(term))
          : orderedColumns
        s += `<div class="dt-dd-section">${esc(L.columnsSection)}</div>`
        for (const col of searched) {
          // Draggable row (see handleColRowDragStart/Over/Drop/End) + Alt+↑/↓ when focus is
          // anywhere inside it (see handleKeyDown) reorder columnOrder, replacing the old ▲▼
          // buttons — same treatment as the Sort/Group active rows. Unlike those, the row itself
          // gets no tabindex: the checkbox inside is already a native Tab stop, and giving the
          // row its own tabindex too would just be a second, visually-identical stop for the same
          // rectangle. The checkbox keeps its own native label-click/Space toggle regardless.
          s += `<div class="dt-dd-item dt-dd-item--col dt-dd-item--colrow" draggable="true" data-col-row-key="${esc(col.key)}">`
          s += `<label class="dt-flex1"><input type="checkbox" data-action="toggle-col" data-key="${esc(col.key)}" data-focus-key="colrow-${esc(col.key)}"${visibleCols.has(col.key) ? ' checked' : ''}> ${esc(col.label)}</label>`
          s += `</div>`
        }
        return s
      },
    )

    // Sort — active entries (priority order, reorderable) above, remaining sortable columns to
    // add below. Split into two sections because reordering only ever makes sense among active
    // entries; interleaving them with inactive columns would make ▲▼ jump over rows with no
    // visible effect.
    html += buildDd(
      openDropdown === 'sort',
      // The × clear button is a sibling <button>, not nested inside the toggle button (a
      // <button> can't contain another interactive element) — `.dt-btn-group` visually merges
      // them into one pill, same idea as the search input + its own clear button, and replaces
      // the dropdown's old footer "Clear sorts" row (removed below) with a one-click affordance
      // that doesn't require opening the dropdown first. No count badge here — the active bar
      // below (see "Active state bar") shows each active sort by name, so a bare number on the
      // button would just be a second, less useful copy of the same fact.
      `<span class="dt-btn-group"><button class="dt-btn${sorts.length > 0 ? ' dt-btn--active dt-btn--grouped' : ''}" data-action="toggle-dd" data-dd="sort">${esc(L.sort)}</button>${sorts.length > 0 ? `<button type="button" class="dt-btn-clear" data-action="clear-sorts" title="${esc(L.clearSorts)}" aria-label="${esc(L.clearSorts)}">×</button>` : ''}</span>`,
      () => {
        let s = ''
        const addableCols = columns.filter((c) => getSortIndex(sorts, c.key) === null)
        if (sorts.length > 0) {
          s += `<div class="dt-dd-section">${esc(L.activeSortsSection)}</div>`
          for (let i = 0; i < sorts.length; i++) {
            const entry = sorts[i]
            const col = columns.find((c) => c.key === entry.key)
            // The whole row is the click target (toggles direction, same `toggle-sort-dir`
            // action as before — just moved from a dedicated button onto the row itself) and the
            // drag source (reorder priority) — see handleSortDragStart/Over/Drop below. `×` stays
            // a separate <button> (draggable="false" so starting a drag from it doesn't also drag
            // the row) since removing isn't something a row click or drag should ever trigger.
            // tabindex/data-focus-key make it a normal tab stop that also supports Alt+↑/↓ reorder
            // and Enter/Space-to-toggle from the keyboard — see handleKeyDown.
            s += `<div class="dt-dd-item dt-dd-item--col dt-dd-item--sortrow" draggable="true" tabindex="0" data-action="toggle-sort-dir" data-key="${esc(entry.key)}" data-sort-key="${esc(entry.key)}" data-focus-key="sortrow-${esc(entry.key)}">`
            s += `<span class="dt-sort-idx">${i + 1}</span>`
            s += `<span class="dt-flex1">${esc(col?.label ?? entry.key)}</span>`
            s += `<span class="dt-sort-icon dt-sort-icon--active">${getSortIcon(sorts, entry.key)}</span>`
            s += `<button type="button" class="dt-item-remove" draggable="false" data-action="remove-sort" data-key="${esc(entry.key)}">×</button>`
            s += `</div>`
          }
        }
        if (addableCols.length > 0) {
          // Search box narrows this "add" list only — the active-sorts section above keeps its
          // own priority order and is never hidden by it, since it's a short, already-visible
          // list with its own remove/reorder controls. The add list itself carries no ordering
          // meaning (none of these are sorted yet), so it's alphabetized by label instead of
          // raw column-definition order, to make scanning a long list easier.
          s += `<div class="dt-dd-search-row"><input type="text" class="dt-dd-search" placeholder="${esc(L.filterSearchPlaceholder)}" value="${esc(ddSearchTerms.sort ?? '')}" data-action="dd-search" data-dd="sort" data-focus-key="ddsearch-sort"></div>`
          const term = (ddSearchTerms.sort ?? '').trim().toLowerCase()
          const searched = (
            term ? addableCols.filter((c) => c.label.toLowerCase().includes(term)) : addableCols
          )
            .slice()
            .sort((a, b) => a.label.localeCompare(b.label))
          s += `<div class="dt-dd-section">${esc(L.sortSection)}</div>`
          for (const col of searched) {
            // A real <button> (not a div) so it's a native Tab stop and Enter/Space "click" it
            // for free — no manual tabindex/keydown wiring needed, unlike the active rows above
            // (which need custom keyboard handling anyway for Alt+↑/↓ reorder).
            s += `<button type="button" class="dt-dd-item dt-dd-item--click" data-action="toggle-sort" data-key="${esc(col.key)}"><span class="dt-flex1">${esc(col.label)}</span></button>`
          }
        }
        return s
      },
    )

    // Group — same active/add split as Sort above. Unlike a sort entry, a group entry has
    // nothing to toggle on click (no direction), so the row is draggable/focusable for
    // reordering (drag, or Alt+↑/↓ when focused — see handleGroupDragStart/Over/Drop and
    // handleKeyDown) but carries no click action of its own; `×` remove is the only button.
    // Placed right after Sort (both "shape" the view — order/columns) rather than after Filter,
    // so the toolbar reads as two clusters: Columns/Sort/Group shape the view, Search/Filter
    // narrow it — see the divider below.
    if (groupableCols.length > 0) {
      html += buildDd(
        openDropdown === 'group',
        `<span class="dt-btn-group"><button class="dt-btn${groupBy.length > 0 ? ' dt-btn--active dt-btn--grouped' : ''}" data-action="toggle-dd" data-dd="group">${esc(L.group)}</button>${groupBy.length > 0 ? `<button type="button" class="dt-btn-clear" data-action="clear-groups" title="${esc(L.clearGroups)}" aria-label="${esc(L.clearGroups)}">×</button>` : ''}</span>`,
        () => {
          let s = ''
          const addableCols = groupableCols.filter((c) => !groupBy.includes(c.key))
          if (groupBy.length > 0) {
            s += `<div class="dt-dd-section">${esc(L.activeGroupsSection)}</div>`
            for (let i = 0; i < groupBy.length; i++) {
              const key = groupBy[i]
              const col = groupableCols.find((c) => c.key === key)
              s += `<div class="dt-dd-item dt-dd-item--col dt-dd-item--grouprow" draggable="true" tabindex="0" data-group-key="${esc(key)}" data-focus-key="grouprow-${esc(key)}">`
              s += `<span class="dt-sort-idx">${i + 1}</span>`
              s += `<span class="dt-flex1">${esc(col?.label ?? key)}</span>`
              s += `<button type="button" class="dt-item-remove" draggable="false" data-action="remove-group" data-key="${esc(key)}">×</button>`
              s += `</div>`
            }
          }
          if (addableCols.length > 0) {
            // Same search + alphabetize treatment as Sort's add list above, for the same reason.
            s += `<div class="dt-dd-search-row"><input type="text" class="dt-dd-search" placeholder="${esc(L.filterSearchPlaceholder)}" value="${esc(ddSearchTerms.group ?? '')}" data-action="dd-search" data-dd="group" data-focus-key="ddsearch-group"></div>`
            const term = (ddSearchTerms.group ?? '').trim().toLowerCase()
            const searched = (
              term ? addableCols.filter((c) => c.label.toLowerCase().includes(term)) : addableCols
            )
              .slice()
              .sort((a, b) => a.label.localeCompare(b.label))
            s += `<div class="dt-dd-section">${esc(L.groupSection)}</div>`
            for (const col of searched) {
              s += `<button type="button" class="dt-dd-item dt-dd-item--click" data-action="toggle-group" data-key="${esc(col.key)}"><span class="dt-flex1">${esc(col.label)}</span></button>`
            }
          }
          return s
        },
      )
    }

    // Divider between the "shape" controls above (Columns/Sort/Group — what's shown and in what
    // order) and the "find" controls below (Search/Filter — which rows are shown at all).
    html += `<span class="dt-toolbar-divider"></span>`

    html += `<span class="dt-search-wrap">`
    html += `<input type="text" class="dt-search-input" placeholder="${esc(L.search)}" value="${esc(searchQuery)}" data-action="search" data-focus-key="search">`
    if (searchQuery !== '') {
      html += `<button type="button" class="dt-search-clear" data-action="clear-search" title="${esc(L.clearSearch)}" aria-label="${esc(L.clearSearch)}">×</button>`
    }
    html += `</span>`

    // Filter
    if (filterableCols.length > 0) {
      html += buildDd(
        openDropdown === 'filter',
        `<span class="dt-btn-group"><button class="dt-btn${activeFilterCount > 0 ? ' dt-btn--active dt-btn--grouped' : ''}" data-action="toggle-dd" data-dd="filter">${esc(L.filter)}</button>${activeFilterCount > 0 ? `<button type="button" class="dt-btn-clear" data-action="clear-filters" title="${esc(L.clearFilters)}" aria-label="${esc(L.clearFilters)}">×</button>` : ''}</span>`,
        () => {
          let s = `<div class="dt-filter-panel">`
          s += `<div class="dt-filter-cols">`
          // Search box (sticky within this scrollable pane, see styles.ts) narrows the column
          // list itself — separate from `filterSearchTerms`, which narrows the *values* shown in
          // the right-hand detail pane for whichever column is currently selected. No inherent
          // order to preserve here (unlike the Columns dropdown, this list isn't reorderable), so
          // it's alphabetized by label rather than raw column-definition order.
          s += `<input type="text" class="dt-dd-search dt-filter-cols-search" placeholder="${esc(L.filterSearchPlaceholder)}" value="${esc(ddSearchTerms.filter ?? '')}" data-action="dd-search" data-dd="filter" data-focus-key="ddsearch-filter">`
          const ddTerm = (ddSearchTerms.filter ?? '').trim().toLowerCase()
          const searchedFilterCols = (
            ddTerm
              ? filterableCols.filter((c) => c.label.toLowerCase().includes(ddTerm))
              : filterableCols
          )
            .slice()
            .sort((a, b) => a.label.localeCompare(b.label))
          for (const col of searchedFilterCols) {
            const rf = rangeFilters[col.key]
            // A date column can have both an active checklist selection (tree) *and* an active
            // range filter above it at once — either one alone should light the dot, not just
            // whichever one a plain type-based ternary happened to check.
            const hasActive =
              (filters[col.key]?.size ?? 0) > 0 ||
              (excludeFilters[col.key]?.size ?? 0) > 0 ||
              (rf !== undefined && (rf.min !== '' || rf.max !== ''))
            // A real <button> (not a div) so it's a native Tab stop and Enter/Space "click" it
            // for free — same fix as the Sort/Group add-lists; this had the identical gap.
            s += `<button type="button" class="dt-filter-col-item${col.key === filterActiveKey ? ' dt-filter-col-item--active' : ''}" data-action="select-filter-col" data-key="${esc(col.key)}"><span>${esc(col.label)}</span>${hasActive ? '<span class="dt-filter-col-dot"></span>' : ''}</button>`
          }
          s += `</div>`
          s += `<div class="dt-filter-detail">`
          if (filterDetailCol) {
            if (filterDetailCol.type === 'number') {
              const rf = rangeFilters[filterDetailCol.key]
              // Unset inputs default to the column's actual data bounds (same source the slider
              // already falls back to) rather than sitting empty — a blank box gives no hint of
              // what range is even meaningful for this column, and it means the two "1/2" native
              // slider thumbs above/below no longer visually disagree with the text inputs.
              const bounds = computeValueBounds(data, filterDetailCol)
              const minDefault = bounds ? formatRangeBound(bounds.min, filterDetailCol) : ''
              const maxDefault = bounds ? formatRangeBound(bounds.max, filterDetailCol) : ''
              s += `<div style="padding:4px 14px 8px">`
              s += `<div style="display:flex;gap:6px;align-items:center">`
              s += `<input type="number" class="dt-range-input" placeholder="${esc(L.min)}" value="${esc(rf?.min ?? minDefault)}" data-action="range-min" data-key="${esc(filterDetailCol.key)}" data-focus-key="rmin-${esc(filterDetailCol.key)}">`
              s += `<span class="dt-range-sep">–</span>`
              s += `<input type="number" class="dt-range-input" placeholder="${esc(L.max)}" value="${esc(rf?.max ?? maxDefault)}" data-action="range-max" data-key="${esc(filterDetailCol.key)}" data-focus-key="rmax-${esc(filterDetailCol.key)}">`
              s += `</div>`
              s += buildRangeSlider(filterDetailCol, rf, bounds)
              s += `</div>`
            } else {
              if (filterDetailCol.type === 'date') {
                // The range filter narrows the tree itself (see _filterDetailValues above), so it
                // renders above the tree/search row — "runs before the tree", not just ANDed onto
                // the final result once a checkbox is ticked.
                const rf = rangeFilters[filterDetailCol.key]
                // See the `number` branch above — same data-bounds default for unset inputs.
                const bounds = computeValueBounds(data, filterDetailCol)
                const minDefault = bounds ? formatRangeBound(bounds.min, filterDetailCol) : ''
                const maxDefault = bounds ? formatRangeBound(bounds.max, filterDetailCol) : ''
                s += `<div style="padding:4px 14px 8px">`
                s += `<div style="display:flex;gap:6px;align-items:center">`
                s += `<input type="date" class="dt-range-input" value="${esc(rf?.min ?? minDefault)}" data-action="range-min" data-key="${esc(filterDetailCol.key)}" aria-label="${esc(L.min)}" data-focus-key="rmin-${esc(filterDetailCol.key)}">`
                s += `<span class="dt-range-sep">–</span>`
                s += `<input type="date" class="dt-range-input" value="${esc(rf?.max ?? maxDefault)}" data-action="range-max" data-key="${esc(filterDetailCol.key)}" aria-label="${esc(L.max)}" data-focus-key="rmax-${esc(filterDetailCol.key)}">`
                s += `</div>`
                s += buildRangeSlider(filterDetailCol, rf, bounds)
                s += `</div>`
              }
              const term = filterSearchTerms[filterDetailCol.key] ?? ''
              s += `<div class="dt-filter-search-row">`
              if (_filterDetailValues.length > 0) {
                const selectedCount = _filterDetailValues.filter((v) =>
                  filters[filterDetailCol.key]?.has(v),
                ).length
                const allValuesSelected = selectedCount === _filterDetailValues.length
                s += `<input type="checkbox" class="dt-filter-select-all" data-action="toggle-filter-all" data-key="${esc(filterDetailCol.key)}" title="${esc(L.selectAll)}" aria-label="${esc(L.selectAll)}"${allValuesSelected ? ' checked' : ''}>`
              }
              s += `<input type="text" class="dt-dd-search" placeholder="${esc(L.filterSearchPlaceholder)}" value="${esc(term)}" data-action="filter-search" data-key="${esc(filterDetailCol.key)}" data-focus-key="fsearch-${esc(filterDetailCol.key)}">`
              const vs = valueSortFor(filterDetailCol.key)
              const sortIcon =
                filterDetailCol.type === 'date' ? getDateSortIcon(vs.dir) : getValueSortIcon(vs)
              s += `<button type="button" class="dt-value-sort-btn" data-action="toggle-value-sort" data-key="${esc(filterDetailCol.key)}" title="${esc(L.sortValues)}" aria-label="${esc(L.sortValues)}">${esc(sortIcon)}</button>`
              s += `</div>`
              if (filterDetailCol.type === 'date') {
                // Bounded + scrollable, same as the checklist below (see _filterListHeight) —
                // without this wrapper the tree has no height cap at all and bleeds past the
                // panel onto the page once it's tall enough. GitHub issue #14.
                s += `<div class="dt-date-tree-wrap" style="height:${_filterListHeight}px">`
                s += renderDateTreeNodes(_filterDetailTree, filterDetailCol.key, 0)
                s += `</div>`
              } else {
                // Virtualized: only the rows scrolled into view (+ overscan) are ever mounted,
                // regardless of how many thousands of distinct values _filterDetailValues holds
                // — see computeVirtualRange/FILTER_LIST_*. Select-all/shift-range elsewhere
                // still operate on the full _filterDetailValues array, so behavior is unaffected
                // by how much of it is actually rendered.
                s += `<div class="dt-filter-list" style="height:${_filterListHeight}px">`
                s += buildFilterListInnerHtml(filterDetailCol)
                s += `</div>`
              }
            }
          }
          s += `</div>` // dt-filter-detail
          s += `</div>` // dt-filter-panel
          return s
        },
      )
    }

    // "Clear all" sits alone at the far right of the actions row (margin-left:auto, see
    // styles.ts) — nothing else in the row needs to reflow when it mounts/unmounts, unlike the
    // old layout where it sat between search and the stats text.
    if (hasActiveState) {
      html += `<button class="dt-btn dt-clear-all" data-action="clear-all">${esc(L.clearAll)}</button>`
    }

    html += `</div>` // dt-toolbar-actions
    html += `</div>` // dt-toolbar

    // --- Active state bar ---
    // Always rendered (even with nothing active) rather than only appearing once a filter is set
    // — this gives the row-count stats a single stable home instead of bouncing between "end of
    // the toolbar row" and nowhere, and means toggling a sort/filter/group never changes the
    // toolbar's height or shifts anything above it. Shows one chip per active sort entry, group
    // column, and filter column — sort/group chips were previously only visible as a bare count
    // on their toolbar button (see above); giving them the same at-a-glance chip treatment
    // filters already had removes that asymmetry. Sort/group chips reuse the plain neutral
    // `.dt-chip` look (the same one the removed count badges used) — filter chips keep their
    // existing blue `.dt-chip--filter` tint, the one deliberate color accent in this bar, since
    // filters already carried that "this is narrowing your view" meaning before this change.
    // Each chip's body is now a real <button> (a sibling of the × button, not nested inside it —
    // a <button> can't contain another interactive element, same reasoning as the toolbar's
    // grouped clear buttons) instead of a plain, inert <span>: clicking (or Enter/Space-
    // activating) it does something specific to that chip's own kind of active state, rather than
    // requiring the dropdown to be reopened and re-navigated to make the same change. Sort's body
    // toggles direction in place via the existing `toggle-sort-dir` action (no dropdown needed for
    // the single most common tweak); Group's and Filter's open their dropdown straight to that
    // entry/column (`open-group-entry`/`open-filter-col`), since neither has an equally obvious
    // single inline toggle the way direction is for sort.
    html += `<div class="dt-active-bar">`
    for (const entry of sorts) {
      const col = columns.find((c) => c.key === entry.key)
      html += `<span class="dt-chip"><button type="button" class="dt-chip-body" data-action="toggle-sort-dir" data-key="${esc(entry.key)}" data-focus-key="chip-sort-${esc(entry.key)}">${getSortIcon(sorts, entry.key)} ${esc(col?.label ?? entry.key)}</button><button type="button" class="dt-chip-x" data-action="remove-sort" data-key="${esc(entry.key)}">×</button></span>`
    }
    for (const key of groupBy) {
      const col = groupableCols.find((c) => c.key === key)
      html += `<span class="dt-chip"><button type="button" class="dt-chip-body" data-action="open-group-entry" data-key="${esc(key)}">${esc(col?.label ?? key)}</button><button type="button" class="dt-chip-x" data-action="remove-group" data-key="${esc(key)}">×</button></span>`
    }
    if (activeFilterCount > 0) {
      // Each chip's × clears only the state *that chip* represents (`data-kind`, read by the
      // 'clear-filter-key' handler) — a column can carry an include set, an exclude set, and a
      // range filter all at once (a date column, or any multi-value column with both an include
      // and an exclude selection), and removing one shouldn't silently drop the others too.
      for (const [key, vals] of Object.entries(filters)) {
        if (!vals.size) continue
        html += `<span class="dt-chip dt-chip--filter"><button type="button" class="dt-chip-body" data-action="open-filter-col" data-key="${esc(key)}">${esc(columns.find((c) => c.key === key)?.label ?? key)}: ${esc(summarizeFilterValues(vals))}</button><button type="button" class="dt-chip-x" data-action="clear-filter-key" data-kind="include" data-key="${esc(key)}">×</button></span>`
      }
      // Exclude filters (see "Filter dropdown" exclude filters in the docs) get their own chip,
      // distinguished by a "≠" prefix instead of a translated word — same reasoning the sort/
      // value-sort icons already use symbols (↑/↓, ABC/#) rather than growing every locale file.
      // `dt-chip--exclude` tints it apart from a plain include chip so the two read as opposite
      // actions at a glance, not just different text.
      for (const [key, vals] of Object.entries(excludeFilters)) {
        if (!vals.size) continue
        html += `<span class="dt-chip dt-chip--filter dt-chip--exclude"><button type="button" class="dt-chip-body" data-action="open-filter-col" data-key="${esc(key)}">${esc(columns.find((c) => c.key === key)?.label ?? key)}: ≠ ${esc(summarizeFilterValues(vals))}</button><button type="button" class="dt-chip-x" data-action="clear-filter-key" data-kind="exclude" data-key="${esc(key)}">×</button></span>`
      }
      // A range filter (number or date) didn't get a chip at all before — it's a distinct active
      // filter from the checklist above, so it needs its own (a date column can have both active
      // at once).
      for (const [key, rf] of Object.entries(rangeFilters)) {
        if (rf.min === '' && rf.max === '') continue
        html += `<span class="dt-chip dt-chip--filter"><button type="button" class="dt-chip-body" data-action="open-filter-col" data-key="${esc(key)}">${esc(columns.find((c) => c.key === key)?.label ?? key)}: ${esc(rf.min)}–${esc(rf.max)}</button><button type="button" class="dt-chip-x" data-action="clear-filter-key" data-kind="range" data-key="${esc(key)}">×</button></span>`
      }
    }
    // A group split across a page boundary contributes a second ("continued") chunk to
    // `_groupedData` — deduped by key here so it isn't double-counted.
    const pageGroupCount = new Set(_groupedData.map((g) => g.key)).size
    html += `<span class="dt-stats">${esc(L.rowCount(_processedData.length, data.length))}${groupBy.length > 0 ? esc(L.groupCount(pageGroupCount)) : ''}</span>`
    html += `</div>` // dt-active-bar

    // --- Table ---
    html += `<div class="dt-table-wrap"><table class="dt-table"><thead><tr>`
    if (selectable) {
      html += `<th class="dt-th dt-th--no-sort" style="width:36px"><input type="checkbox" data-action="select-all"${allSelected ? ' checked' : ''}></th>`
    }
    if (groupBy.length > 0) {
      html += `<th class="dt-th dt-th--no-sort" style="width:28px"></th>`
    }
    // Only `sorts` entries for a currently-rendered header count toward numbering — a groupBy
    // column can have its own sort entry (used by `sortWithinGroups` to order the groups
    // themselves), but it has no `<th>` of its own to attach a number to, and leaving it in would
    // shift every later header's number by one for no visible reason.
    const headerSorts = sorts.filter((s) => activeColumns.some((c) => c.key === s.key))
    for (const col of activeColumns) {
      const isSorted = headerSorts.some((s) => s.key === col.key)
      // A number is only useful to disambiguate priority when more than one visible header is
      // sorted — with just one, "1↑" is noise next to a plain "↑".
      const sortIdx = isSorted && headerSorts.length > 1 ? getSortIndex(headerSorts, col.key) : null
      const icon = isSorted ? getSortIcon(headerSorts, col.key) : '↕'
      html += `<th class="dt-th" draggable="true" data-col-key="${esc(col.key)}"${col.width ? ` style="width:${col.width}px"` : ''} data-action="header-sort" data-key="${esc(col.key)}"><span class="dt-th-inner">${esc(col.label)} <span class="dt-sort-icon${isSorted ? ' dt-sort-icon--active' : ''}">${sortIdx ? `${sortIdx}${icon}` : icon}</span></span></th>`
    }
    html += `</tr></thead><tbody>`

    const procIdxMap = new Map(_processedData.map((r, i) => [r, i]))

    // Roving tabindex: exactly one data row is a Tab stop at a time, arrow keys move it (see
    // handleKeyDown below) — mirrors the anchor/range idea the checklist/date-tree checkboxes
    // already use for shift-click. Rows only join the tab sequence when they're interactive.
    function rowOpenTag(row: TRow, procIdx: number, rk: string | number, trClass: string): string {
      const tabIndexAttr = rowNavEnabled
        ? ` tabindex="${isFocusTarget({ kind: 'row', row }) ? 0 : -1}"`
        : ''
      const ariaSelectedAttr = selectable ? ` aria-selected="${selection.has(row)}"` : ''
      return `<tr class="${trClass}" data-row-key="${esc(String(rk))}" data-action="row-click" data-proc-idx="${procIdx}"${tabIndexAttr}${ariaSelectedAttr}>`
    }

    for (const { key: gkey, keyParts, rows, continued, sampleRow } of _groupedData) {
      if (gkey !== null) {
        const isCollapsed = isGroupCollapsed(collapsedGroups, gkey, defaultGroupsCollapsed)
        const gAllSel = rows.length > 0 && rows.every((r) => selection.has(r))
        const groupTabIndex = isFocusTarget({ kind: 'group', key: gkey }) ? 0 : -1
        html += `<tr class="dt-group-row" data-action="toggle-group-collapse" data-gkey="${esc(gkey)}" tabindex="${groupTabIndex}" aria-expanded="${!isCollapsed}">`
        if (selectable) {
          // data-no-collapse prevents this td click from triggering the row collapse
          html += `<td class="dt-group-td" style="width:36px" data-no-collapse><input type="checkbox" data-action="toggle-group-select" data-gkey="${esc(gkey)}"${gAllSel ? ' checked' : ''}></td>`
        }
        html += `<td class="dt-group-td" style="width:28px">${isCollapsed ? '▶' : '▼'}</td>`
        html += `<td class="dt-group-td" colspan="${activeColumns.length}">`
        for (let gi = 0; gi < groupBy.length; gi++) {
          const gColKey = groupBy[gi]
          const gCol = columns.find((c) => c.key === gColKey)
          if (gi > 0) html += `<span class="dt-group-sep"> › </span>`
          html += `<span class="dt-group-colname">${esc(gCol?.label ?? gColKey)}:</span> `
          // A bucketed group (see groupValue/groupFormat) has no single row whose real value
          // *is* the group — the sample row's own value/format would show e.g. a raw "47%"
          // instead of the "40–50%" bucket it landed in — so its label is rendered from the
          // group's own keyPart via groupFormat instead of the normal cellValue/format pipeline.
          if (gCol?.groupValue) {
            html += esc(gCol.groupFormat ? gCol.groupFormat(keyParts[gi]) : keyParts[gi])
          } else {
            const raw = gCol ? getColumnValue(gCol, sampleRow!) : undefined
            const value = Array.isArray(raw) ? keyParts[gi] : raw
            html += gCol ? formatStr(value, sampleRow!, gCol) : esc(String(value ?? ''))
          }
        }
        if (continued) html += ` <span class="dt-group-continued">${esc(L.groupContinued)}</span>`
        html += ` <span class="dt-group-count">${esc(L.rowsInGroup(rows.length))}</span></td></tr>`

        if (hasAgg) {
          html += `<tr class="dt-agg-row">`
          if (selectable) html += `<td class="dt-agg-td" style="width:36px"></td>`
          html += `<td class="dt-agg-td" style="width:28px"></td>`
          for (const col of activeColumns) {
            html += `<td class="dt-agg-td">${aggStr(col, rows, sampleRow!)}</td>`
          }
          html += `</tr>`
        }

        if (!isCollapsed) {
          for (let ri = 0; ri < rows.length; ri++) {
            const row = rows[ri]
            const procIdx = procIdxMap.get(row) ?? -1
            const isSelected = selection.has(row)
            const trClass = `dt-tr${isSelected ? ' dt-tr--selected' : ri % 2 !== 0 ? ' dt-tr--odd' : ''}${onRowClick ? ' dt-tr--clickable' : ''}`
            const rk = rowKey ? String((row as Record<string, unknown>)[rowKey] ?? ri) : ri
            html += rowOpenTag(row, procIdx, rk, trClass)
            if (selectable) {
              html += `<td class="dt-td" style="width:36px" data-no-row-click><input type="checkbox" tabindex="-1" data-action="toggle-row-select" data-proc-idx="${procIdx}"${isSelected ? ' checked' : ''}></td>`
            }
            html += `<td class="dt-td" style="width:28px"></td>`
            for (const col of activeColumns) {
              html += `<td class="dt-td">${cellStr(row, col)}</td>`
            }
            html += `</tr>`
          }
        }
      } else {
        for (let ri = 0; ri < rows.length; ri++) {
          const row = rows[ri]
          const procIdx = procIdxMap.get(row) ?? -1
          const isSelected = selection.has(row)
          const trClass = `dt-tr${isSelected ? ' dt-tr--selected' : ri % 2 !== 0 ? ' dt-tr--odd' : ''}${onRowClick ? ' dt-tr--clickable' : ''}`
          const rk = rowKey ? String((row as Record<string, unknown>)[rowKey] ?? ri) : ri
          html += rowOpenTag(row, procIdx, rk, trClass)
          if (selectable) {
            html += `<td class="dt-td" style="width:36px" data-no-row-click><input type="checkbox" tabindex="-1" data-action="toggle-row-select" data-proc-idx="${procIdx}"${isSelected ? ' checked' : ''}></td>`
          }
          for (const col of activeColumns) {
            html += `<td class="dt-td">${cellStr(row, col)}</td>`
          }
          html += `</tr>`
        }
      }
    }

    html += `</tbody></table></div>`

    // --- Pagination ---
    if (pageSize > 0) {
      html += `<div class="dt-pagination">`
      html += `<button class="dt-page-btn" data-action="page-first"${_clampedPage === 1 ? ' disabled' : ''}>«</button>`
      html += `<button class="dt-page-btn" data-action="page-prev"${_clampedPage === 1 ? ' disabled' : ''}>‹</button>`
      html += `<span class="dt-page-info">${esc(L.pageOf(_clampedPage, _numPages))}</span>`
      html += `<button class="dt-page-btn" data-action="page-next"${_clampedPage >= _numPages ? ' disabled' : ''}>›</button>`
      html += `<button class="dt-page-btn" data-action="page-last"${_clampedPage >= _numPages ? ' disabled' : ''}>»</button>`
      html += `<span class="dt-rows-per-page-group">`
      html += `<span class="dt-rows-per-page">${esc(L.rowsPerPage)}:</span>`
      html += `<select class="dt-page-select" data-action="set-page-size">`
      for (const n of mergePageSizeOptions([10, 20, 50, 100], pageSize)) {
        html += `<option value="${n}"${pageSize === n ? ' selected' : ''}>${n}</option>`
      }
      html += `</select></span></div>`
    }

    html += `</div>` // .dt

    container.innerHTML = html

    const tableWrapEl = container.querySelector<HTMLElement>('.dt-table-wrap')
    if (tableWrapEl) tableWrapEl.scrollTop = tableWrapScrollTop

    // The virtualized filter checklist's scrollable element is destroyed and recreated by the
    // innerHTML rebuild above (same reason focus needs restoring below) — the fresh element
    // starts at scrollTop 0 regardless of where the user had actually scrolled to.
    const filterListEl = container.querySelector<HTMLElement>('.dt-filter-list')
    if (filterListEl) filterListEl.scrollTop = filterListScrollTop

    // Resolve col.render() placeholders now that their slots exist in the DOM
    for (const { id, col, value, row } of pendingRenders) {
      const slot = container.querySelector(`[data-render-slot="${id}"]`)
      if (slot && col.render) slot.replaceWith(col.render(value, row))
    }

    // Fix indeterminate checkboxes (not settable via HTML attribute)
    if (selectable) {
      if (someSelected) {
        const cb = container.querySelector<HTMLInputElement>('[data-action="select-all"]')
        if (cb) cb.indeterminate = true
      }
      for (const { key: gkey, rows } of _groupedData) {
        if (gkey === null) continue
        const gAllSel = rows.every((r) => selection.has(r))
        const gSomeSel = !gAllSel && rows.some((r) => selection.has(r))
        if (gSomeSel) {
          for (const cb of container.querySelectorAll<HTMLInputElement>(
            '[data-action="toggle-group-select"]',
          )) {
            if (cb.dataset.gkey === gkey) {
              cb.indeterminate = true
              break
            }
          }
        }
      }
    }
    if (_filterDetailValues.length > 0 && filterDetailCol) {
      const selectedCount = _filterDetailValues.filter((v) =>
        filters[filterDetailCol.key]?.has(v),
      ).length
      if (selectedCount > 0 && selectedCount < _filterDetailValues.length) {
        const cb = container.querySelector<HTMLInputElement>('[data-action="toggle-filter-all"]')
        if (cb) cb.indeterminate = true
      }
    }
    for (const cb of container.querySelectorAll<HTMLInputElement>(
      '[data-action="toggle-date-node"][data-indeterminate]',
    )) {
      cb.indeterminate = true
    }
    for (const cb of container.querySelectorAll<HTMLInputElement>(
      '[data-action="toggle-filter"][data-exclude]',
    )) {
      cb.indeterminate = true
    }

    // Restore focus
    if (focusKey) {
      for (const el of container.querySelectorAll<HTMLElement>('[data-focus-key]')) {
        if (el.dataset.focusKey === focusKey) {
          el.focus()
          if (el instanceof HTMLInputElement && selStart !== null) {
            el.setSelectionRange(selStart, selEnd ?? selStart)
          }
          break
        }
      }
    }
    // Restore row/group-header focus by object identity or group key (neither has a fixed
    // focus-key string) — essential, not just cosmetic: without it, arrow-key navigation would
    // drop focus to <body> on every keystroke, since each keydown triggers a re-render that
    // destroys the old node. Group keys are compared via dataset lookup rather than embedded in
    // a selector string, since an arbitrary key could contain characters that break selector
    // syntax (the same reason the indeterminate-checkbox pass above does the same).
    if (wasItemFocused && effectiveFocusTarget) {
      if (effectiveFocusTarget.kind === 'row') {
        const idx = _processedData.indexOf(effectiveFocusTarget.row)
        container.querySelector<HTMLElement>(`.dt-tr[data-proc-idx="${idx}"]`)?.focus()
      } else {
        for (const el of container.querySelectorAll<HTMLElement>('.dt-group-row[data-gkey]')) {
          if (el.dataset.gkey === effectiveFocusTarget.key) {
            el.focus()
            break
          }
        }
      }
    }

    // Clamp the open dropdown panel to the viewport — it's absolutely positioned off its
    // trigger and would otherwise render partly or fully off-screen (e.g. the 460px-wide
    // filter panel near the right edge). A translateX offset is used instead of flipping the
    // anchor side (left:0 -> right:0) because the panel's overflow is relative to the viewport,
    // not to the trigger — a trigger near the toolbar's left edge with a wide panel would just
    // push it off the opposite (left) side if the anchor were flipped instead. The left check
    // takes priority when the panel is wider than the viewport itself (rare, e.g. a 460px filter
    // panel on a <480px screen): keeping the left edge on-screen beats keeping the right edge.
    const openDd = container.querySelector<HTMLElement>('.dt-dd')
    if (openDd) {
      const rect = openDd.getBoundingClientRect()
      const margin = 8
      let dx = 0
      if (rect.right > window.innerWidth - margin) dx = window.innerWidth - margin - rect.right
      if (rect.left + dx < margin) dx = margin - rect.left
      if (dx !== 0) openDd.style.transform = `translateX(${dx}px)`
      if (rect.bottom > window.innerHeight - margin) openDd.classList.add('dt-dd--up')
    }

    // Correct the filter checklist/date-tree's viewport height to whatever `.dt-filter-panel`
    // actually renders at, instead of the FILTER_LIST_DEFAULT_HEIGHT constant — `.dt-filter-cols`
    // (the column list on the left) can stretch the panel taller than that default via flex
    // cross-axis stretch, and without this the checklist/tree stays stuck at the old height,
    // leaving dead space below it (#13) or, for the unbounded date tree, overflowing the panel
    // entirely (#14). `.dt-filter-detail`'s own height is driven by the flex row's stretch, not
    // by its content, so it can be taller than its children even before this correction — the
    // gap between its bottom edge and the checklist/tree's bottom edge is exactly the dead space
    // to close. Reset to the floor height *before* measuring (not just when growing) so a
    // shrunk `.dt-filter-cols` — fewer filterable columns, a narrower viewport — lets the
    // checklist/tree shrink back down too, rather than only ever growing once inflated.
    const filterDetailEl = container.querySelector<HTMLElement>('.dt-filter-detail')
    const filterViewportEl = container.querySelector<HTMLElement>(
      '.dt-filter-list, .dt-date-tree-wrap',
    )
    if (filterDetailEl && filterViewportEl) {
      filterViewportEl.style.height = `${FILTER_LIST_DEFAULT_HEIGHT}px`
      const gap =
        filterDetailEl.getBoundingClientRect().bottom -
        filterViewportEl.getBoundingClientRect().bottom
      _filterListHeight = Math.max(FILTER_LIST_DEFAULT_HEIGHT, FILTER_LIST_DEFAULT_HEIGHT + gap)
      filterViewportEl.style.height = `${_filterListHeight}px`
      // Only the checklist's rows depend on this number (via computeVirtualRange's viewport-
      // height argument) — the date tree isn't virtualized, so resizing its wrapper is enough.
      if (filterViewportEl.classList.contains('dt-filter-list') && filterDetailCol) {
        filterViewportEl.innerHTML = buildFilterListInnerHtml(filterDetailCol)
        // This replaces the checklist rows the earlier indeterminate fix-up pass already applied
        // to (see above), with fresh nodes that need the same fix-up again.
        for (const cb of filterViewportEl.querySelectorAll<HTMLInputElement>(
          '[data-action="toggle-filter"][data-exclude]',
        )) {
          cb.indeterminate = true
        }
      }
    }
  }

  // --- Event handlers ---

  function handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement
    const actionEl = target.closest('[data-action]') as HTMLElement | null

    // Close dropdown when clicking outside a dd-wrap — tracked separately from
    // `viewChanged`/`selectionChanged` below since some actions (row-click) return early without
    // reaching the shared `render()` at the bottom of this function, but still need the
    // now-closed dropdown reflected in the DOM rather than staying visibly open.
    let dropdownClosed = false
    if (openDropdown !== null && !target.closest('.dt-dd-wrap')) {
      openDropdown = null
      dropdownClosed = true
      if (!actionEl) {
        render()
        return
      }
    }

    if (!actionEl) return

    const action = actionEl.dataset.action!
    const key = actionEl.dataset.key ?? ''
    const dd = actionEl.dataset.dd ?? ''
    const value = actionEl.dataset.value ?? ''
    const gkey = actionEl.dataset.gkey ?? ''
    const kind = actionEl.dataset.kind ?? ''
    const path = actionEl.dataset.path ?? ''
    const procIdx = parseInt(actionEl.dataset.procIdx ?? '-1', 10)

    let selectionChanged = false
    let viewChanged = false

    switch (action) {
      case 'toggle-dd':
        openDropdown = openDropdown === dd ? null : dd
        break
      case 'toggle-sort':
        sorts = coreToggleSort(sorts, key, defaultSortDirFor(key))
        viewChanged = true
        break
      case 'header-sort':
        // Plain click: sort by this column alone, discarding any other active sorts.
        // Shift-click: add this column to the existing multi-sort (or flip its direction if
        // it's already in it) — the shift modifier is the escape hatch for building a
        // multi-column sort from the header. Never removes an entry; that's the chip ×/
        // dropdown's job, so a shift-click can't surprise-clear a sort someone just meant to
        // flip, nor bump it to the end of the priority stack on the next shift-click.
        sorts = e.shiftKey
          ? coreAppendOrToggleSort(sorts, key, defaultSortDirFor(key))
          : coreSetSort(sorts, key, defaultSortDirFor(key))
        viewChanged = true
        break
      case 'remove-sort':
        sorts = sorts.filter((s) => s.key !== key)
        viewChanged = true
        break
      case 'toggle-sort-dir':
        sorts = sorts.map((s) => (s.key === key ? { ...s, dir: toggleSortDir(s.dir) } : s))
        viewChanged = true
        break
      case 'toggle-col': {
        const next = new Set(visibleCols)
        if (next.has(key)) {
          if (next.size > 1) next.delete(key)
        } else next.add(key)
        visibleCols = next
        viewChanged = true
        break
      }
      case 'toggle-filter': {
        const anchor = filterSelectionAnchor[key]
        if (e.shiftKey && anchor != null) {
          // Shift-range selection only ever moves values into/out of the include set — see
          // "Filter dropdown" (exclude filters) in the docs for why exclude stays a single-click-
          // only, cycle-one-value-at-a-time action. Clear the swept range from the exclude set
          // too, so a value that was previously excluded doesn't end up in both sets at once.
          const shouldSelect = !(filters[key]?.has(value) ?? false)
          const range = selectRange(_filterDetailValues, anchor, value)
          filters = coreSetFilterValues(filters, key, range, shouldSelect)
          if (shouldSelect) excludeFilters = clearExcludeValues(excludeFilters, key, range)
        } else {
          const next = cycleFilterValue(filters, excludeFilters, key, value)
          filters = next.filters
          excludeFilters = next.excludeFilters
        }
        filterSelectionAnchor = { ...filterSelectionAnchor, [key]: value }
        page = 1
        viewChanged = true
        break
      }
      case 'toggle-filter-all': {
        // The master checkbox's own checked/indeterminate state (see its render above) reflects
        // `filters` only — it has no visual concept of exclusion at all — so only the "select all
        // ON" branch should ever touch `excludeFilters`, and only because it must: every listed
        // value is about to become included, and a value can't be in both sets at once (see
        // `cycleFilterValue`). The "deselect all" branch must leave excludeFilters completely
        // alone — it's clearing values the checkbox showed as selected, which by the same
        // invariant can never include an already-excluded value, so an independently-excluded
        // value (never counted as "selected" by this checkbox) must survive the click.
        const willSelectAll = !_filterDetailValues.some((v) => filters[key]?.has(v))
        filters = coreToggleFilterAll(filters, key, _filterDetailValues)
        if (willSelectAll)
          excludeFilters = clearExcludeValues(excludeFilters, key, _filterDetailValues)
        page = 1
        viewChanged = true
        break
      }
      case 'toggle-date-node': {
        const node = findDateTreeNode(_filterDetailTree, path)
        if (node) {
          const anchor = filterSelectionAnchor[key]
          const anchorNode = anchor != null ? findDateTreeNode(_filterDetailTree, anchor) : null
          const state = getDateTreeNodeState(node, filters[key] ?? new Set())
          if (e.shiftKey && anchorNode) {
            const parseDate = columns.find((c) => c.key === key)?.parseDate
            const values = selectDateRange(_filterDetailValues, anchorNode, node, parseDate)
            filters = coreSetFilterValues(filters, key, values, state !== 'checked')
          } else {
            filters = coreToggleFilterAll(filters, key, node.values)
          }
          filterSelectionAnchor = { ...filterSelectionAnchor, [key]: node.path }
          page = 1
          viewChanged = true
        }
        break
      }
      case 'toggle-date-expand': {
        // The toggle arrow sits inside the same <label> as the node's checkbox — without
        // preventDefault() here, the browser's native label→control forwarding would also
        // dispatch a click on the checkbox, triggering an unwanted toggle-date-node.
        e.preventDefault()
        const next = new Set(expandedDateNodes[key] ?? [])
        if (next.has(path)) next.delete(path)
        else next.add(path)
        expandedDateNodes = { ...expandedDateNodes, [key]: next }
        break
      }
      case 'select-filter-col':
        filterActiveCol = key
        filterListScrollTop = 0
        break
      case 'toggle-value-sort': {
        const col = columns.find((c) => c.key === key)
        const current = valueSortFor(key)
        const next =
          col?.type === 'date'
            ? { ...current, dir: toggleSortDir(current.dir) }
            : cycleValueSort(current)
        filterValueSort = { ...filterValueSort, [key]: next }
        break
      }
      case 'toggle-group':
        groupBy = toggleGroupBy(groupBy, key)
        viewChanged = true
        break
      case 'remove-group':
        groupBy = groupBy.filter((k) => k !== key)
        viewChanged = true
        break
      case 'open-group-entry':
        // Active-bar group chip body: opens the Group dropdown straight to that entry — there's
        // no single obvious inline action for a group chip the way `toggle-sort-dir` is for a
        // sort chip, so this just gets you to the entry ready to reorder/remove. Focus is
        // restored to the entry's row after render() below (see the post-render fixups).
        openDropdown = 'group'
        break
      case 'toggle-group-collapse':
        if (!target.closest('[data-no-collapse]')) {
          collapsedGroups = toggleCollapse(collapsedGroups, gkey)
          viewChanged = true
        }
        break
      case 'clear-sorts':
        sorts = []
        viewChanged = true
        break
      case 'clear-filters':
        filters = {}
        excludeFilters = {}
        rangeFilters = {}
        page = 1
        viewChanged = true
        break
      case 'clear-groups':
        groupBy = []
        collapsedGroups = new Set()
        viewChanged = true
        break
      case 'clear-filter-key':
        // A column can carry an include set, an exclude set, and a range filter all at once (see
        // the active-bar chip loop above) — `data-kind` says which one *this* × represents, so
        // clearing it doesn't also wipe unrelated state a user never asked to remove.
        if (kind === 'exclude') excludeFilters = { ...excludeFilters, [key]: new Set() }
        else if (kind === 'range') rangeFilters = { ...rangeFilters, [key]: { min: '', max: '' } }
        else filters = { ...filters, [key]: new Set() }
        page = 1
        viewChanged = true
        break
      case 'open-filter-col':
        // Active-bar filter chip body: opens the Filter dropdown straight to that column's detail
        // pane, instead of making you reopen the dropdown and re-find the column in the left list
        // to tweak a filter you already have active. Setting `filterActiveCol` here (rather than
        // relying solely on `handleFilterColFocus`'s focus-follows-selection) means the right pane
        // is already correct in the very first render, before focus even lands on the button.
        openDropdown = 'filter'
        filterActiveCol = key
        filterListScrollTop = 0
        break
      case 'clear-search':
        searchQuery = ''
        page = 1
        viewChanged = true
        break
      case 'clear-all':
        sorts = []
        filters = {}
        excludeFilters = {}
        rangeFilters = {}
        groupBy = []
        collapsedGroups = new Set()
        page = 1
        searchQuery = ''
        openDropdown = null
        viewChanged = true
        break
      case 'select-all': {
        const next = new Set(selection)
        const someSel = _processedData.some((r) => next.has(r))
        if (someSel) _processedData.forEach((r) => next.delete(r))
        else _processedData.forEach((r) => next.add(r))
        selection = next
        selectionChanged = true
        break
      }
      case 'toggle-row-select': {
        if (procIdx >= 0 && procIdx < _processedData.length) {
          const row = _processedData[procIdx]
          applyRowSelectionToggle(row, e.shiftKey)
          focusTarget = { kind: 'row', row }
          selectionChanged = true
        }
        break
      }
      case 'toggle-group-select': {
        if (applyGroupSelectionToggle(gkey)) selectionChanged = true
        break
      }
      case 'page-first':
        page = 1
        viewChanged = true
        break
      case 'page-prev':
        page = Math.max(1, _clampedPage - 1)
        viewChanged = true
        break
      case 'page-next':
        page = Math.min(_numPages, _clampedPage + 1)
        viewChanged = true
        break
      case 'page-last':
        page = _numPages
        viewChanged = true
        break
      case 'row-click':
        if (
          !target.closest('[data-no-row-click]') &&
          procIdx >= 0 &&
          procIdx < _processedData.length
        ) {
          focusTarget = { kind: 'row', row: _processedData[procIdx] }
          onRowClick?.(_processedData[procIdx], e)
        }
        if (dropdownClosed) render()
        return
      default:
        if (dropdownClosed) render()
        return
    }

    render()

    // The × button (not the input itself) had focus at click time, so render()'s own
    // focus-restore (keyed on data-focus-key) has nothing to restore here — return focus to the
    // search input directly so clearing doesn't strand focus on a now-hidden button.
    if (action === 'clear-search') {
      container.querySelector<HTMLInputElement>('[data-focus-key="search"]')?.focus()
    }
    // Opening a dropdown should hand it focus immediately, rather than leaving it on the toggle
    // button — otherwise every open still needs an extra Tab press before any of the new
    // Up/Down/Home/End/Escape nav (or plain typing into the search box) does anything.
    // `openDropdown === dd` (rather than just `action === 'toggle-dd'`) is what distinguishes an
    // *open* from a close — the same click toggles both, see the case above.
    if (action === 'toggle-dd' && openDropdown === dd) {
      focusFirstInDropdown(dd)
    }
    // Activating an addable Sort/Group column (or removing an active one) moves its row between
    // the active and addable sections, which — since every render() rebuilds the whole panel via
    // innerHTML — destroys whichever button/row had focus at click time and drops focus to
    // <body>. The addable buttons carry no `data-focus-key` of their own (only the active
    // sortrow/grouprow divs and the search inputs do — see render()'s generic focus-key restore
    // at the top of this function), so that generic mechanism has nothing to restore here; this
    // explicitly refocuses whichever element the column landed on instead, on both sides of
    // the toggle (adding *and* removing) so a repeated add/remove doesn't strand focus.
    if (action === 'toggle-sort') {
      for (const el of container.querySelectorAll<HTMLElement>('[data-focus-key]')) {
        if (el.dataset.focusKey === `sortrow-${key}`) {
          el.focus()
          break
        }
      }
    }
    if (action === 'remove-sort') {
      for (const el of container.querySelectorAll<HTMLElement>('[data-action="toggle-sort"]')) {
        if (el.dataset.key === key) {
          el.focus()
          break
        }
      }
    }
    if (action === 'toggle-group') {
      for (const el of container.querySelectorAll<HTMLElement>('[data-focus-key]')) {
        if (el.dataset.focusKey === `grouprow-${key}`) {
          el.focus()
          break
        }
      }
    }
    if (action === 'remove-group') {
      for (const el of container.querySelectorAll<HTMLElement>('[data-action="toggle-group"]')) {
        if (el.dataset.key === key) {
          el.focus()
          break
        }
      }
    }
    if (action === 'open-group-entry') {
      for (const el of container.querySelectorAll<HTMLElement>('[data-focus-key]')) {
        if (el.dataset.focusKey === `grouprow-${key}`) {
          el.focus()
          break
        }
      }
    }
    if (action === 'open-filter-col') {
      for (const el of container.querySelectorAll<HTMLElement>('.dt-filter-col-item')) {
        if (el.dataset.key === key) {
          el.focus()
          break
        }
      }
    }

    if (selectionChanged) {
      onSelectionChange?.(_processedData.filter((r) => selection.has(r)))
    }
    if (viewChanged) {
      notifyViewChange()
    }
  }

  function handleInput(e: Event): void {
    const target = e.target as HTMLInputElement
    const action = target.dataset.action
    if (action === 'search') {
      searchQuery = target.value
      page = 1
      render()
      notifyViewChange()
      return
    }
    if (action === 'filter-search') {
      const key = target.dataset.key ?? ''
      filterSearchTerms = { ...filterSearchTerms, [key]: target.value }
      filterListScrollTop = 0
      render()
      return
    }
    if (action === 'dd-search') {
      const dd = target.dataset.dd ?? ''
      ddSearchTerms = { ...ddSearchTerms, [dd]: target.value }
      render()
      return
    }
    if (action === 'range-slider') {
      // Live drag feedback only — deliberately *not* a state write + render(). Rebuilding the
      // whole panel via innerHTML mid-drag would destroy and recreate the thumb the user's mouse
      // has pointer-captured, aborting the native drag (same reasoning column header drag-and-
      // drop already avoids render() until `drop`). The actual value is committed on `change`
      // (handleChange below), which only fires once the gesture ends. The plain min/max <input>s
      // are patched the same imperative way (direct .value writes, not a render()) so the user
      // sees the exact numbers/dates tracking the thumbs while dragging, without touching the
      // slider's own DOM.
      const wrap = target.closest<HTMLElement>('.dt-range-slider')
      const fill = wrap?.querySelector<HTMLElement>('.dt-range-slider-fill')
      const key = target.dataset.key ?? ''
      const col = columns.find((c) => c.key === key)
      if (!wrap || !fill || !col) return
      const thumbs = wrap.querySelectorAll<HTMLInputElement>('.dt-range-slider-thumb')
      const vals = Array.from(thumbs, (t) => Number(t.value))
      const boundsMin = Number(thumbs[0]?.min ?? 0)
      const boundsMax = Number(thumbs[0]?.max ?? 0)
      const lo = Math.min(...vals)
      const hi = Math.max(...vals)
      fill.style.left = `${((lo - boundsMin) / (boundsMax - boundsMin)) * 100}%`
      fill.style.right = `${100 - ((hi - boundsMin) / (boundsMax - boundsMin)) * 100}%`
      const minInput = [
        ...container.querySelectorAll<HTMLInputElement>('[data-action="range-min"]'),
      ].find((el) => el.dataset.key === key)
      const maxInput = [
        ...container.querySelectorAll<HTMLInputElement>('[data-action="range-max"]'),
      ].find((el) => el.dataset.key === key)
      if (minInput) minInput.value = formatRangeBound(lo, col)
      if (maxInput) maxInput.value = formatRangeBound(hi, col)
      return
    }
    if (action !== 'range-min' && action !== 'range-max') return
    const key = target.dataset.key ?? ''
    const field = action === 'range-min' ? 'min' : 'max'
    rangeFilters = {
      ...rangeFilters,
      [key]: {
        min: rangeFilters[key]?.min ?? '',
        max: rangeFilters[key]?.max ?? '',
        [field]: target.value,
      },
    }
    page = 1
    render()
    notifyViewChange()
  }

  function handleChange(e: Event): void {
    const target = e.target as HTMLInputElement | HTMLSelectElement
    const action = target.dataset.action
    if (action === 'range-slider') {
      // The commit point for a slider drag (or a keyboard arrow press, or a click-to-jump on the
      // track) — see handleInput's own range-slider branch for why this doesn't happen on every
      // `input` tick instead.
      const wrap = target.closest<HTMLElement>('.dt-range-slider')
      const key = target.dataset.key ?? ''
      const col = columns.find((c) => c.key === key)
      if (!wrap || !col) return
      const thumbs = wrap.querySelectorAll<HTMLInputElement>('.dt-range-slider-thumb')
      const vals = Array.from(thumbs, (t) => Number(t.value))
      const lo = Math.min(...vals)
      const hi = Math.max(...vals)
      rangeFilters = {
        ...rangeFilters,
        [key]: { min: formatRangeBound(lo, col), max: formatRangeBound(hi, col) },
      }
      page = 1
      render()
      notifyViewChange()
      return
    }
    if (action !== 'set-page-size') return
    pageSize = Number(target.value)
    page = 1
    render()
    notifyViewChange()
  }

  // The Filter dropdown's left column list behaves like a listbox/radiogroup rather than a plain
  // list of buttons each needing its own explicit "activate" — whichever column pane is focused
  // is the one shown, with no separate Enter/Space/click step required beyond just getting there.
  // `focusin` (unlike `focus`) bubbles, so a single delegated listener on the container covers
  // every way focus can land on a `.dt-filter-col-item`: a mouse click (which focuses the button
  // natively before the click handler's own `select-filter-col` case runs — this just gets there
  // first), Tab/Shift+Tab, and the arrow-key nav in handleKeyDown (which, for this row type, only
  // ever calls a plain `.focus()` and relies entirely on this listener to do the actual work).
  // Guarded by comparing against the *resolved* active key (falling back to the first filterable
  // column the same way the render side does) rather than the raw `filterActiveCol`, so focusing
  // the already-effectively-active column on initial mount doesn't trigger a pointless re-render;
  // that same guard is also what stops this from looping — `render()` below re-renders and moves
  // focus to the equivalent new node, which fires another `focusin`, but by then `filterActiveCol`
  // already matches so the second call is a no-op.
  function handleFilterColFocus(e: FocusEvent): void {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.dt-filter-col-item')
    if (!btn) return
    const key = btn.dataset.key ?? ''
    const filterableCols = columns.filter((c) => c.filterable !== false)
    if (key === resolveFilterActiveKey(filterableCols)) return
    filterActiveCol = key
    filterListScrollTop = 0
    render()
    for (const el of container.querySelectorAll<HTMLElement>('.dt-filter-col-item')) {
      if (el.dataset.key === key) {
        el.focus()
        break
      }
    }
  }

  // The filter dropdown's virtualized checklist (see FILTER_LIST_* / computeVirtualRange) needs
  // to know its scroll position to know which rows to render — but native `scroll` events don't
  // bubble, so this can't join the click/input/change delegation above. Capture-phase listeners
  // fire on the way down to the target regardless of bubbling, which is what makes delegating a
  // non-bubbling event to the container possible at all. rAF-throttled since a full render()
  // rebuilds the whole page's HTML string, which would be wasteful to do on every scroll tick.
  function handleFilterListScroll(e: Event): void {
    const el = e.target as HTMLElement
    if (!el.classList?.contains('dt-filter-list')) return
    if (!filterListRafPending) {
      filterListRafPending = true
      requestAnimationFrame(() => {
        filterListRafPending = false
        // Read the live scrollTop here (not a value captured back in the triggering scroll
        // event) — several scroll events can fire before this callback runs, and only the
        // latest position matters.
        filterListScrollTop = el.scrollTop
        // Patch just this element's children instead of calling the full render(). A full
        // render() rebuilds the *entire* page via innerHTML, which destroys and recreates
        // .dt-filter-list itself — if that happens mid-gesture, any further wheel/scrollbar
        // input from the same continuous scroll is left targeting a now-detached element and
        // falls through to whatever scrollable ancestor is next (the whole page), which reads
        // as "the list won't scroll" even though each individual scroll tick was handled.
        // Keeping .dt-filter-list itself untouched (only reassigning its own innerHTML) means
        // it's never replaced, so the browser's native scroll on it is never interrupted.
        const filterableCols = columns.filter((c) => c.filterable !== false)
        const filterActiveKey = resolveFilterActiveKey(filterableCols)
        const filterDetailCol = filterableCols.find((c) => c.key === filterActiveKey) ?? null
        if (filterDetailCol) {
          el.innerHTML = buildFilterListInnerHtml(filterDetailCol)
          // Same indeterminate fix-up render() does below its own innerHTML assignment — this
          // patch bypasses render() entirely (see above), so it needs its own copy.
          for (const cb of el.querySelectorAll<HTMLInputElement>(
            '[data-action="toggle-filter"][data-exclude]',
          )) {
            cb.indeterminate = true
          }
        }
      })
    }
  }

  // Roving-tabindex row navigation — see "Keyboard navigation". Delegated like click/input, but
  // on a separate listener since it must act on keys bubbling from inside a row (e.g. its
  // checkbox) too, not just on the row element itself.
  // Focuses whichever element should be the first Tab/arrow-key stop right after a dropdown
  // opens: its own search box when it has one, else the first row-like control (a Sort/Group
  // dropdown with nothing left to add renders no search box — see the render()-side comment on
  // `ddSearchTerms` — so it falls back to the first *active* row instead).
  function focusFirstInDropdown(dd: string): void {
    const panel = container.querySelector<HTMLElement>('.dt-dd')
    if (!panel) return
    const search = panel.querySelector<HTMLElement>(
      `input[data-action="dd-search"][data-dd="${dd}"]`,
    )
    if (search) {
      search.focus()
      return
    }
    const firstRow = panel.querySelector<HTMLElement>(
      '.dt-dd-item--colrow input, .dt-dd-item--sortrow, .dt-dd-item--grouprow, .dt-dd-item--click, .dt-filter-col-item',
    )
    firstRow?.focus()
  }

  function handleKeyDown(e: KeyboardEvent): void {
    const targetEl = e.target as HTMLElement

    // Filter dropdown: Left/Right switches between the left column pane and the right detail
    // pane, and the right pane's own rows (value checklist / date tree, plus the search/select-
    // all/sort-value controls above them) get the same Up/Down/Home/End nav as every other
    // dropdown's row list — this has to run *before* the generic ddPanel block below, which
    // otherwise `return`s on an unrecognized `active` element (a right-pane row isn't part of its
    // own row selector) before ever reaching this.
    if (!e.altKey) {
      const filterColBtn = targetEl.closest<HTMLElement>('.dt-filter-col-item')
      const filterDetail = targetEl.closest<HTMLElement>('.dt-filter-detail')

      if (filterColBtn && e.key === 'ArrowRight') {
        e.preventDefault()
        container
          .querySelector<HTMLElement>('.dt-filter-detail input, .dt-filter-detail button')
          ?.focus()
        return
      }

      if (filterDetail && e.key === 'ArrowLeft') {
        const active = document.activeElement
        // Never hijack Left on an actual text/value-editing control — the value-search box, the
        // numeric/date range inputs, or a range-slider thumb — which all need their native
        // cursor/value behavior. Everything else in this pane (checklist/date-tree checkboxes,
        // select-all, the sort-order button) has no use for a bare Left, so it's free to reuse.
        const isEditable =
          active instanceof HTMLInputElement &&
          (active.dataset.action === 'filter-search' ||
            active.dataset.action === 'range-min' ||
            active.dataset.action === 'range-max' ||
            active.dataset.action === 'range-slider')
        if (!isEditable) {
          e.preventDefault()
          container.querySelector<HTMLElement>('.dt-filter-col-item--active')?.focus()
          return
        }
      }

      if (
        filterDetail &&
        (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End')
      ) {
        // Only the value-search box joins the vertical Up/Down chain, mirroring every other
        // dropdown's "search input, then rows" pattern — the select-all checkbox and sort-order
        // button sit beside it on the *same* row (`.dt-filter-search-row`), not above the rows, so
        // stepping Down/Up through all three before reaching the list would move focus somewhere
        // that doesn't visually correspond to "down". They stay reachable via Tab/click as before.
        const headerControls = [
          filterDetail.querySelector<HTMLElement>('input[data-action="filter-search"]'),
        ].filter((el): el is HTMLElement => el !== null)
        const rowInputs = Array.from(
          filterDetail.querySelectorAll<HTMLInputElement>(
            '.dt-dd-item input[data-action="toggle-filter"], .dt-date-tree-item input[data-action="toggle-date-node"]',
          ),
        )
        const focusables = [...headerControls, ...rowInputs]
        const active = document.activeElement as HTMLElement | null
        if (!active || focusables.indexOf(active) === -1) return

        // The flat checklist is virtualized (see computeVirtualRange/_filterListHeight) — only a
        // scrolled-into-view window of rows actually exists in the DOM at any moment, so crossing
        // out of that window (or Home/End, which must reach the *logical* first/last value, not
        // just whatever's currently rendered) needs to scroll the list and patch its innerHTML
        // before the target row can be focused at all. The date tree has no such window (every
        // currently-expanded row is already in the DOM), so it falls straight through to the
        // plain DOM-order nav below.
        const checklistEl = filterDetail.querySelector<HTMLElement>('.dt-filter-list')
        if (checklistEl) {
          const filterableCols = columns.filter((c) => c.filterable !== false)
          const filterDetailCol = filterableCols.find(
            (c) => c.key === resolveFilterActiveKey(filterableCols),
          )
          const activeValue =
            active instanceof HTMLInputElement && active.dataset.action === 'toggle-filter'
              ? active.dataset.value
              : undefined
          let targetIdx: number | null = null
          if (e.key === 'Home') targetIdx = 0
          else if (e.key === 'End') targetIdx = _filterDetailValues.length - 1
          else if (activeValue !== undefined) {
            const curIdx = _filterDetailValues.indexOf(activeValue)
            targetIdx = e.key === 'ArrowDown' ? curIdx + 1 : curIdx - 1
          }
          if (targetIdx !== null && filterDetailCol) {
            // Falls through to the plain header-control nav below in two cases: moving Up out of
            // the checklist's very first row (there's no row above it — the previous stop is a
            // header control instead), and Home/End on an empty list.
            const fallsThrough = targetIdx < 0 && e.key === 'ArrowUp' && activeValue !== undefined
            if (!fallsThrough) {
              if (targetIdx < 0 || targetIdx >= _filterDetailValues.length) {
                e.preventDefault()
                return
              }
              e.preventDefault()
              const rowTop = targetIdx * FILTER_LIST_ITEM_HEIGHT
              let newScrollTop = filterListScrollTop
              if (rowTop < filterListScrollTop) newScrollTop = rowTop
              else if (rowTop + FILTER_LIST_ITEM_HEIGHT > filterListScrollTop + _filterListHeight) {
                newScrollTop = rowTop + FILTER_LIST_ITEM_HEIGHT - _filterListHeight
              }
              if (newScrollTop !== filterListScrollTop) {
                filterListScrollTop = Math.max(0, newScrollTop)
                checklistEl.scrollTop = filterListScrollTop
                checklistEl.innerHTML = buildFilterListInnerHtml(filterDetailCol)
                // Same indeterminate fix-up as the other buildFilterListInnerHtml patch sites —
                // this rebuild has fresh nodes that need it applied again.
                for (const cb of checklistEl.querySelectorAll<HTMLInputElement>(
                  '[data-action="toggle-filter"][data-exclude]',
                )) {
                  cb.indeterminate = true
                }
              }
              const targetValue = _filterDetailValues[targetIdx]
              for (const cb of checklistEl.querySelectorAll<HTMLInputElement>(
                'input[data-action="toggle-filter"]',
              )) {
                if (cb.dataset.value === targetValue) {
                  cb.focus()
                  break
                }
              }
              return
            }
          }
        }

        // Plain DOM-order nav: the header controls (search/select-all/sort-button), date-tree
        // rows, and — via the fallthrough above — moving out of the checklist's first row back
        // into the header controls.
        if (e.key === 'Home' || e.key === 'End') {
          if (rowInputs.length === 0) return
          e.preventDefault()
          ;(e.key === 'Home' ? rowInputs[0] : rowInputs[rowInputs.length - 1]).focus()
          return
        }
        const idx = focusables.indexOf(active)
        const nextIdx = e.key === 'ArrowDown' ? idx + 1 : idx - 1
        if (nextIdx < 0 || nextIdx >= focusables.length) return
        e.preventDefault()
        focusables[nextIdx].focus()
        return
      }
    }

    // Roving Up/Down/Home/End/Escape navigation across whichever dropdown panel is currently
    // open (Columns/Sort/Group's full row lists, Filter's left column pane) — a distinct concern
    // from the Alt+↑/↓ reorder and Enter/Space toggle handled by the row-specific blocks below,
    // so this only ever acts on a plain (non-Alt) key and always runs *before* those blocks (which
    // otherwise unconditionally `return`, would-be swallowing an arrow key aimed at this instead).
    // Deliberately scoped to just the "column list" rows (colrow/sortrow/grouprow/add-buttons/
    // filter-col buttons) plus each dropdown's own new search input — never the Filter dropdown's
    // right-hand detail pane (value checklist, date tree, range slider), which has its own native
    // controls (a range `<input>`'s own Left/Right/Up/Down/Home/End) that must keep working
    // unmolested; scoping by an explicit "is focus already on one of our own elements" check
    // (`focusables.indexOf(active) !== -1`) rather than just "is focus somewhere inside .dt-dd" is
    // what keeps this from hijacking those.
    const ddPanel = targetEl.closest<HTMLElement>('.dt-dd')
    if (ddPanel && !e.altKey) {
      if (e.key === 'Escape') {
        e.preventDefault()
        // First Escape clears a non-empty search term (if focus is actually in that dropdown's
        // own column-search box, or the Filter dropdown's value-search box) rather than closing
        // outright, matching common combobox convention — a second press (now with nothing left
        // to clear) closes the dropdown.
        const searchInput = targetEl.closest<HTMLInputElement>('input[data-action="dd-search"]')
        const valueSearchInput = targetEl.closest<HTMLInputElement>(
          'input[data-action="filter-search"]',
        )
        if (searchInput && searchInput.value !== '') {
          const dd = searchInput.dataset.dd ?? ''
          ddSearchTerms = { ...ddSearchTerms, [dd]: '' }
          render()
        } else if (valueSearchInput && valueSearchInput.value !== '') {
          const key = valueSearchInput.dataset.key ?? ''
          filterSearchTerms = { ...filterSearchTerms, [key]: '' }
          filterListScrollTop = 0
          render()
        } else {
          const dd = openDropdown
          openDropdown = null
          render()
          if (dd) {
            container
              .querySelector<HTMLElement>(`[data-action="toggle-dd"][data-dd="${dd}"]`)
              ?.focus()
          }
        }
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
        // One combined query, in actual DOM/visual order — this matters for Sort/Group, where the
        // active-entries section renders *above* the search box and the addable section renders
        // *below* it (active → search → addable), not "search first" the way Columns/Filter's
        // left pane render it. Building the search input and the rows as two separate arrays and
        // concatenating them (search always first) used to silently reorder Sort/Group's nav to
        // "search → active → addable", which doesn't match what's on screen.
        const navEls = Array.from(
          ddPanel.querySelectorAll<HTMLElement>(
            'input[data-action="dd-search"], .dt-dd-item--colrow, .dt-dd-item--sortrow, .dt-dd-item--grouprow, .dt-dd-item--click, .dt-filter-col-item',
          ),
        )
        // Each element's own focusable target: the search input, a real <button>, or an explicit
        // tabindex="0" div is used directly (sortrow/grouprow/add-buttons/filter-col buttons); a
        // colrow div has neither (its checkbox is the actual Tab stop — see the markup comment
        // where it's built) so its first focusable descendant is used instead.
        const focusables = navEls
          .map((el) =>
            el.matches('input, button, [tabindex]')
              ? el
              : el.querySelector<HTMLElement>('input, button, [tabindex]'),
          )
          .filter((el): el is HTMLElement => el !== null)
        const rowFocusables = focusables.filter((el) => el.dataset.action !== 'dd-search')
        const active = document.activeElement as HTMLElement | null
        if (!active || focusables.indexOf(active) === -1) return
        let target: HTMLElement | undefined
        if (e.key === 'Home' || e.key === 'End') {
          if (rowFocusables.length === 0) return
          e.preventDefault()
          target = e.key === 'Home' ? rowFocusables[0] : rowFocusables[rowFocusables.length - 1]
        } else {
          const idx = focusables.indexOf(active)
          const nextIdx = e.key === 'ArrowDown' ? idx + 1 : idx - 1
          if (nextIdx < 0 || nextIdx >= focusables.length) return
          e.preventDefault()
          target = focusables[nextIdx]
        }
        // If `target` is a `.dt-filter-col-item`, focusing it fires `handleFilterColFocus` (see
        // its registration below), which is what actually updates `filterActiveCol` and shows its
        // detail pane — a listbox/radiogroup-style "focus follows selection", so arrowing here
        // needs no separate Enter/Space "activate" step (a plain click still does the same thing,
        // since focusing a button on click fires the same event).
        target.focus()
        return
      }
    }

    // Sort/Group dropdown active rows: a completely separate keyboard surface from the table's
    // roving-tabindex row nav below (plain sequential tab stops, not a single-tab-stop-at-a-time
    // model — there are at most a handful of active sorts/groups). Alt+↑/↓ mirrors the drag
    // gesture (see handleSortDragStart/Over/Drop and handleGroupDrag*) for keyboard-only reorder;
    // Enter/Space on a sort row mirrors its own click (toggle direction) since a plain
    // tabindex="0" div gets no free keyboard activation the way a real <button> would. Group rows
    // have no click action to mirror (nothing to toggle), so only reordering applies there.
    // render()'s existing generic data-focus-key restore (see the bottom of render()) refocuses
    // the row afterward, since both rows carry a `sortrow-`/`grouprow-` focus key already.
    const sortRow = targetEl.closest<HTMLElement>('.dt-dd-item--sortrow[data-sort-key]')
    if (sortRow) {
      const key = sortRow.dataset.sortKey!
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        sorts = sorts.map((s) => (s.key === key ? { ...s, dir: toggleSortDir(s.dir) } : s))
        render()
        notifyViewChange()
      } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        const next = coreMoveSortBy(sorts, key, e.key === 'ArrowUp' ? -1 : 1)
        if (next !== sorts) {
          sorts = next
          render()
          notifyViewChange()
        }
      }
      return
    }

    const groupRow = targetEl.closest<HTMLElement>('.dt-dd-item--grouprow[data-group-key]')
    if (groupRow) {
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        const key = groupRow.dataset.groupKey!
        const next = coreMoveColumnBy(groupBy, key, e.key === 'ArrowUp' ? -1 : 1)
        if (next !== groupBy) {
          groupBy = next
          render()
          notifyViewChange()
        }
      }
      return
    }

    // Columns dropdown row: the row itself carries no tabindex (its checkbox is already the
    // native Tab stop — see the markup comment above), so this matches via the checkbox as the
    // actual keydown target, same closest()-from-descendant approach as sortRow/groupRow above.
    const colRow = targetEl.closest<HTMLElement>('.dt-dd-item--colrow[data-col-row-key]')
    if (colRow) {
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        const key = colRow.dataset.colRowKey!
        const base = columnOrder.length ? columnOrder : columns.map((c) => c.key)
        const next = coreMoveColumnBy(base, key, e.key === 'ArrowUp' ? -1 : 1)
        if (next !== base) {
          columnOrder = next
          render()
          notifyViewChange()
        }
      }
      return
    }

    const rowTr = targetEl.closest<HTMLElement>('.dt-tr[data-proc-idx]')
    const groupTr = targetEl.closest<HTMLElement>('.dt-group-row[data-gkey]')

    let item: VisibleItem<TRow> | null = null
    if (rowTr) {
      if (!selectable && !onRowClick) return
      const procIdx = parseInt(rowTr.dataset.procIdx ?? '-1', 10)
      if (procIdx < 0 || procIdx >= _processedData.length) return
      item = { kind: 'row', row: _processedData[procIdx] }
    } else if (groupTr && groupTr.dataset.gkey !== undefined) {
      item = { kind: 'group', key: groupTr.dataset.gkey }
    }
    if (!item) return

    let selectionChanged = false
    let viewChanged = false

    // `targetPage`, when given, crosses a page boundary — `render()`'s existing focus-restore
    // step (see the bottom of `render()`) re-focuses `focusTarget` by object identity/group key
    // once the new page's items exist in the DOM, so this doesn't need its own post-render step.
    const moveFocus = (next: VisibleItem<TRow> | undefined, targetPage?: number) => {
      if (!next) return
      const crossingPage = targetPage !== undefined && targetPage !== _clampedPage
      if (!crossingPage && item && isSameVisibleItem(next, item)) return
      e.preventDefault()
      if (e.shiftKey && selectable && next.kind === 'row') {
        applyRowSelectionToggle(next.row, true)
        selectionChanged = true
      }
      focusTarget = next
      if (crossingPage) {
        page = targetPage!
        viewChanged = true
      }
      render()
    }

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        const delta = e.key === 'ArrowDown' ? 1 : -1
        const idx = indexOfVisibleItem(_navigableItems, item)
        const nextIdx = idx + delta
        if (nextIdx >= 0 && nextIdx < _navigableItems.length) {
          moveFocus(_navigableItems[nextIdx])
        } else if (delta === 1 && _clampedPage < _numPages) {
          moveFocus(visibleItemsForPage(_clampedPage + 1)[0], _clampedPage + 1)
        } else if (delta === -1 && _clampedPage > 1) {
          const prevItems = visibleItemsForPage(_clampedPage - 1)
          moveFocus(prevItems[prevItems.length - 1], _clampedPage - 1)
        }
        break
      }
      case 'Home':
      case 'End': {
        if (e.ctrlKey || e.metaKey) {
          const targetPage = e.key === 'Home' ? 1 : _numPages
          const items =
            targetPage === _clampedPage ? _navigableItems : visibleItemsForPage(targetPage)
          moveFocus(e.key === 'Home' ? items[0] : items[items.length - 1], targetPage)
        } else {
          moveFocus(
            e.key === 'Home' ? _navigableItems[0] : _navigableItems[_navigableItems.length - 1],
          )
        }
        break
      }
      case ' ':
        if (item.kind === 'group') {
          if (selectable) {
            e.preventDefault()
            if (applyGroupSelectionToggle(item.key)) selectionChanged = true
            focusTarget = item
            render()
          }
        } else if (selectable) {
          e.preventDefault()
          applyRowSelectionToggle(item.row, e.shiftKey)
          focusTarget = item
          selectionChanged = true
          render()
        }
        break
      case 'Enter':
        if (item.kind === 'group') {
          e.preventDefault()
          collapsedGroups = toggleCollapse(collapsedGroups, item.key)
          focusTarget = item
          viewChanged = true
          render()
        } else if (onRowClick) {
          e.preventDefault()
          onRowClick(item.row, e)
        }
        break
    }

    if (selectionChanged) {
      onSelectionChange?.(_processedData.filter((r) => selection.has(r)))
    }
    if (viewChanged) {
      notifyViewChange()
    }
  }

  // Drag-and-drop for column reordering bypasses the render()/innerHTML flow: replacing the
  // dragged <th>'s DOM node mid-drag (as a re-render would) aborts the native drag operation in
  // most browsers. So dragover/dragstart/dragend only toggle classes directly on existing nodes;
  // only 'drop' (the terminal action) mutates state and triggers a full re-render.
  function clearColDragClasses(): void {
    for (const th of container.querySelectorAll<HTMLElement>('.dt-th[data-col-key]')) {
      th.classList.remove('dt-th--dragging', 'dt-th--drag-over')
    }
  }

  function handleColDragStart(e: DragEvent): void {
    const th = (e.target as HTMLElement).closest<HTMLElement>('.dt-th[data-col-key]')
    if (!th) return
    draggedColKey = th.dataset.colKey ?? null
    th.classList.add('dt-th--dragging')
  }

  function handleColDragOver(e: DragEvent): void {
    const th = (e.target as HTMLElement).closest<HTMLElement>('.dt-th[data-col-key]')
    if (!th || !draggedColKey || th.dataset.colKey === draggedColKey) return
    e.preventDefault()
    for (const other of container.querySelectorAll<HTMLElement>('.dt-th[data-col-key]')) {
      other.classList.toggle('dt-th--drag-over', other === th)
    }
  }

  function handleColDrop(e: DragEvent): void {
    const th = (e.target as HTMLElement).closest<HTMLElement>('.dt-th[data-col-key]')
    const targetKey = th?.dataset.colKey
    if (!targetKey || !draggedColKey) return
    e.preventDefault()
    if (targetKey !== draggedColKey) {
      const base = columnOrder.length ? columnOrder : columns.map((c) => c.key)
      columnOrder = coreReorderColumn(base, draggedColKey, targetKey)
      render()
      notifyViewChange()
    }
    draggedColKey = null
  }

  function handleColDragEnd(): void {
    draggedColKey = null
    clearColDragClasses()
  }

  // Drag-and-drop reordering for the Sort/Group/Columns dropdown lists below. Resolves not just
  // *which* row the cursor is over but whether the dragged item should land before or after it
  // (cursor position within the row's own top/bottom half) — without this, dropping directly on
  // a row could only ever insert *before* it, so the last row could never actually become
  // non-last. When the cursor isn't over any row at all — the dead space below the last active
  // row, or the "add" section/footer beneath it — it snaps to the nearest edge row instead of
  // silently rejecting the drop (a plain `closest()` miss there would otherwise never call
  // `preventDefault()`, and the browser treats that as "not a valid drop target").
  function resolveDragRow(
    e: DragEvent,
    selector: string,
  ): { row: HTMLElement; after: boolean } | null {
    const rows = Array.from(container.querySelectorAll<HTMLElement>(selector))
    if (rows.length === 0) return null
    const hit = (e.target as HTMLElement).closest<HTMLElement>(selector)
    if (hit) {
      const rect = hit.getBoundingClientRect()
      return { row: hit, after: e.clientY > rect.top + rect.height / 2 }
    }
    const first = rows[0]
    const last = rows[rows.length - 1]
    if (e.clientY <= first.getBoundingClientRect().top) return { row: first, after: false }
    if (e.clientY >= last.getBoundingClientRect().bottom) return { row: last, after: true }
    return null
  }

  // Same rationale and bypass-render()-until-drop approach as column header dragging above, just
  // scoped to `.dt-dd-item--sortrow` and keyed by `data-sort-key` instead of `data-col-key`.
  function clearSortDragClasses(): void {
    for (const el of container.querySelectorAll<HTMLElement>(
      '.dt-dd-item--sortrow[data-sort-key]',
    )) {
      el.classList.remove(
        'dt-dd-item--dragging',
        'dt-dd-item--drag-over',
        'dt-dd-item--drag-over-after',
      )
    }
  }

  function handleSortDragStart(e: DragEvent): void {
    const row = (e.target as HTMLElement).closest<HTMLElement>(
      '.dt-dd-item--sortrow[data-sort-key]',
    )
    if (!row) return
    draggedSortKey = row.dataset.sortKey ?? null
    row.classList.add('dt-dd-item--dragging')
  }

  function handleSortDragOver(e: DragEvent): void {
    if (!draggedSortKey) return
    const target = resolveDragRow(e, '.dt-dd-item--sortrow[data-sort-key]')
    if (!target || target.row.dataset.sortKey === draggedSortKey) return
    e.preventDefault()
    for (const other of container.querySelectorAll<HTMLElement>(
      '.dt-dd-item--sortrow[data-sort-key]',
    )) {
      other.classList.toggle('dt-dd-item--drag-over', other === target.row && !target.after)
      other.classList.toggle('dt-dd-item--drag-over-after', other === target.row && target.after)
    }
  }

  function handleSortDrop(e: DragEvent): void {
    if (!draggedSortKey) return
    const target = resolveDragRow(e, '.dt-dd-item--sortrow[data-sort-key]')
    const targetKey = target?.row.dataset.sortKey
    if (!targetKey) return
    e.preventDefault()
    if (targetKey !== draggedSortKey) {
      sorts = coreReorderSort(sorts, draggedSortKey, targetKey, target?.after)
      render()
      notifyViewChange()
    }
    draggedSortKey = null
  }

  function handleSortDragEnd(): void {
    draggedSortKey = null
    clearSortDragClasses()
  }

  // Same as above, for the Group dropdown's active entries — `groupBy` is already a plain
  // `string[]`, so this reuses `coreReorderColumn` directly rather than needing its own primitive.
  function clearGroupDragClasses(): void {
    for (const el of container.querySelectorAll<HTMLElement>(
      '.dt-dd-item--grouprow[data-group-key]',
    )) {
      el.classList.remove(
        'dt-dd-item--dragging',
        'dt-dd-item--drag-over',
        'dt-dd-item--drag-over-after',
      )
    }
  }

  function handleGroupDragStart(e: DragEvent): void {
    const row = (e.target as HTMLElement).closest<HTMLElement>(
      '.dt-dd-item--grouprow[data-group-key]',
    )
    if (!row) return
    draggedGroupKey = row.dataset.groupKey ?? null
    row.classList.add('dt-dd-item--dragging')
  }

  function handleGroupDragOver(e: DragEvent): void {
    if (!draggedGroupKey) return
    const target = resolveDragRow(e, '.dt-dd-item--grouprow[data-group-key]')
    if (!target || target.row.dataset.groupKey === draggedGroupKey) return
    e.preventDefault()
    for (const other of container.querySelectorAll<HTMLElement>(
      '.dt-dd-item--grouprow[data-group-key]',
    )) {
      other.classList.toggle('dt-dd-item--drag-over', other === target.row && !target.after)
      other.classList.toggle('dt-dd-item--drag-over-after', other === target.row && target.after)
    }
  }

  function handleGroupDrop(e: DragEvent): void {
    if (!draggedGroupKey) return
    const target = resolveDragRow(e, '.dt-dd-item--grouprow[data-group-key]')
    const targetKey = target?.row.dataset.groupKey
    if (!targetKey) return
    e.preventDefault()
    if (targetKey !== draggedGroupKey) {
      groupBy = coreReorderColumn(groupBy, draggedGroupKey, targetKey, target?.after)
      render()
      notifyViewChange()
    }
    draggedGroupKey = null
  }

  function handleGroupDragEnd(): void {
    draggedGroupKey = null
    clearGroupDragClasses()
  }

  // Drag-and-drop reordering for the Columns dropdown's rows — replaces the old ▲▼ buttons,
  // same rationale as Sort/Group above. Kept as its own independent state/handlers (rather than
  // reusing `draggedColKey`/the `<th>` handlers) even though both ultimately reorder the same
  // `columnOrder`, mirroring how Sort/Group each got their own state instead of sharing one.
  function clearColRowDragClasses(): void {
    for (const el of container.querySelectorAll<HTMLElement>(
      '.dt-dd-item--colrow[data-col-row-key]',
    )) {
      el.classList.remove(
        'dt-dd-item--dragging',
        'dt-dd-item--drag-over',
        'dt-dd-item--drag-over-after',
      )
    }
  }

  function handleColRowDragStart(e: DragEvent): void {
    const row = (e.target as HTMLElement).closest<HTMLElement>(
      '.dt-dd-item--colrow[data-col-row-key]',
    )
    if (!row) return
    draggedColRowKey = row.dataset.colRowKey ?? null
    row.classList.add('dt-dd-item--dragging')
  }

  function handleColRowDragOver(e: DragEvent): void {
    if (!draggedColRowKey) return
    const target = resolveDragRow(e, '.dt-dd-item--colrow[data-col-row-key]')
    if (!target || target.row.dataset.colRowKey === draggedColRowKey) return
    e.preventDefault()
    for (const other of container.querySelectorAll<HTMLElement>(
      '.dt-dd-item--colrow[data-col-row-key]',
    )) {
      other.classList.toggle('dt-dd-item--drag-over', other === target.row && !target.after)
      other.classList.toggle('dt-dd-item--drag-over-after', other === target.row && target.after)
    }
  }

  function handleColRowDrop(e: DragEvent): void {
    if (!draggedColRowKey) return
    const target = resolveDragRow(e, '.dt-dd-item--colrow[data-col-row-key]')
    const targetKey = target?.row.dataset.colRowKey
    if (!targetKey) return
    e.preventDefault()
    if (targetKey !== draggedColRowKey) {
      const base = columnOrder.length ? columnOrder : columns.map((c) => c.key)
      columnOrder = coreReorderColumn(base, draggedColRowKey, targetKey, target?.after)
      render()
      notifyViewChange()
    }
    draggedColRowKey = null
  }

  function handleColRowDragEnd(): void {
    draggedColRowKey = null
    clearColRowDragClasses()
  }

  function handleDocClick(e: MouseEvent): void {
    // composedPath() captures the dispatch-time path, so it stays correct even
    // after innerHTML re-renders detach the original target from the DOM.
    if (openDropdown !== null && !e.composedPath().includes(container)) {
      openDropdown = null
      render()
    }
  }

  container.addEventListener('click', handleClick)
  container.addEventListener('input', handleInput)
  container.addEventListener('change', handleChange)
  container.addEventListener('scroll', handleFilterListScroll, true)
  container.addEventListener('focusin', handleFilterColFocus)
  container.addEventListener('keydown', handleKeyDown)
  container.addEventListener('dragstart', handleColDragStart)
  container.addEventListener('dragover', handleColDragOver)
  container.addEventListener('drop', handleColDrop)
  container.addEventListener('dragend', handleColDragEnd)
  container.addEventListener('dragstart', handleSortDragStart)
  container.addEventListener('dragover', handleSortDragOver)
  container.addEventListener('drop', handleSortDrop)
  container.addEventListener('dragend', handleSortDragEnd)
  container.addEventListener('dragstart', handleGroupDragStart)
  container.addEventListener('dragover', handleGroupDragOver)
  container.addEventListener('drop', handleGroupDrop)
  container.addEventListener('dragend', handleGroupDragEnd)
  container.addEventListener('dragstart', handleColRowDragStart)
  container.addEventListener('dragover', handleColRowDragOver)
  container.addEventListener('drop', handleColRowDrop)
  container.addEventListener('dragend', handleColRowDragEnd)
  document.addEventListener('click', handleDocClick)

  render()

  return {
    setData(newData: TRow[]): void {
      data = newData
      render()
    },
    setColumns(newCols: ColumnDef<TRow>[]): void {
      columns = newCols
      render()
    },
    getViewState(): TableViewState {
      return buildViewState()
    },
    setViewState(view: TableViewState): void {
      applyViewState(view)
    },
    onViewChange(cb: (view: TableViewState) => void): () => void {
      viewListeners.add(cb)
      return () => viewListeners.delete(cb)
    },
    getSelection(): TRow[] {
      return [...selection]
    },
    setSelection(rows: TRow[]): void {
      selection = new Set(rows)
      render()
      onSelectionChange?.(_processedData.filter((r) => selection.has(r)))
    },
    clearSelection(): void {
      selection = new Set()
      render()
      onSelectionChange?.([])
    },
    destroy(): void {
      container.removeEventListener('click', handleClick)
      container.removeEventListener('input', handleInput)
      container.removeEventListener('change', handleChange)
      container.removeEventListener('scroll', handleFilterListScroll, true)
      container.removeEventListener('focusin', handleFilterColFocus)
      container.removeEventListener('keydown', handleKeyDown)
      container.removeEventListener('dragstart', handleColDragStart)
      container.removeEventListener('dragover', handleColDragOver)
      container.removeEventListener('drop', handleColDrop)
      container.removeEventListener('dragend', handleColDragEnd)
      container.removeEventListener('dragstart', handleSortDragStart)
      container.removeEventListener('dragover', handleSortDragOver)
      container.removeEventListener('drop', handleSortDrop)
      container.removeEventListener('dragend', handleSortDragEnd)
      container.removeEventListener('dragstart', handleGroupDragStart)
      container.removeEventListener('dragover', handleGroupDragOver)
      container.removeEventListener('drop', handleGroupDrop)
      container.removeEventListener('dragend', handleGroupDragEnd)
      container.removeEventListener('dragstart', handleColRowDragStart)
      container.removeEventListener('dragover', handleColRowDragOver)
      container.removeEventListener('drop', handleColRowDrop)
      container.removeEventListener('dragend', handleColRowDragEnd)
      document.removeEventListener('click', handleDocClick)
      container.innerHTML = ''
    },
  }
}
