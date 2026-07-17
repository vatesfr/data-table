import {
  processData,
  searchData,
  groupData,
  computeStringValues,
  computeStringValueCounts,
  filterValuesBySearch,
  filterValuesByCount,
  sortFilterValues,
  cycleValueSort,
  toggleSortDir,
  getValueSortIcon,
  getDateSortIcon,
  computeAggregate,
  getColumnValue,
  calcTotalPages,
  toggleSort as coreToggleSort,
  toggleFilter as coreToggleFilter,
  toggleFilterAll as coreToggleFilterAll,
  setFilterValues as coreSetFilterValues,
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
  DEFAULT_LABELS,
  type SortEntry,
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
export { persistViewToLocalStorage, syncViewToUrl } from './persistence'
export type { ViewStateApi, SyncViewToUrlOptions } from './persistence'
export { createScoreBar } from './components/scoreBar'
export type { ScoreBarOptions } from './components/scoreBar'
export * from '@vates/data-table-core/locales'

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
  let filterSelectionAnchor: Record<string, string> = {}
  let filterValueSort: Record<string, ValueSort> = {}
  let expandedDateNodes: Record<string, Set<string>> = {}
  let searchQuery = ''
  let draggedColKey: string | null = null
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

  function derive() {
    const stringValueMap = computeStringValues(data, columns, L.emptyValue)
    const stringValueCounts = computeStringValueCounts(
      data,
      filters,
      rangeFilters,
      columns,
      L.emptyValue,
    )
    _processedData = processData(
      searchData(data, searchQuery, columns),
      filters,
      rangeFilters,
      sorts,
      columns,
      L.emptyValue,
    )
    // Grouping runs over the *full* filtered/sorted data, not a page's slice — see the
    // `_visibleItems` comment above.
    const groupedFull = groupData(_processedData, groupBy, columns, L.emptyValue)
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
    const activeFilterCount = countActiveFilters(filters, rangeFilters)
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
    return filterValueSort[key] ?? DEFAULT_VALUE_SORT
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

    const {
      stringValueMap,
      stringValueCounts,
      orderedColumns,
      activeColumns,
      activeFilterCount,
      selectedRows,
    } = derive()

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
    const filterActiveKey =
      filterActiveCol && filterableCols.some((c) => c.key === filterActiveCol)
        ? filterActiveCol
        : (filterableCols[0]?.key ?? null)
    const filterDetailCol = filterableCols.find((c) => c.key === filterActiveKey) ?? null
    _filterDetailValues =
      filterDetailCol && filterDetailCol.type !== 'number'
        ? sortFilterValues(
            filterValuesByCount(
              filterValuesBySearch(
                stringValueMap[filterDetailCol.key] ?? [],
                filterSearchTerms[filterDetailCol.key] ?? '',
              ),
              stringValueCounts[filterDetailCol.key] ?? new Map(),
              filters[filterDetailCol.key] ?? new Set(),
            ),
            stringValueCounts[filterDetailCol.key] ?? new Map(),
            valueSortFor(filterDetailCol.key),
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

    // Columns
    html += buildDd(
      openDropdown === 'cols',
      `<button class="dt-btn${openDropdown === 'cols' ? ' dt-btn--active' : ''}" data-action="toggle-dd" data-dd="cols">${esc(L.columns)}</button>`,
      () => {
        let s = `<div class="dt-dd-section">${esc(L.columnsSection)}</div>`
        for (let i = 0; i < orderedColumns.length; i++) {
          const col = orderedColumns[i]
          s += `<div class="dt-dd-item dt-dd-item--col">`
          s += `<label class="dt-flex1"><input type="checkbox" data-action="toggle-col" data-key="${esc(col.key)}"${visibleCols.has(col.key) ? ' checked' : ''}> ${esc(col.label)}</label>`
          s += `<span class="dt-reorder-btns">`
          s += `<button type="button" class="dt-reorder-btn" data-action="move-col-up" data-key="${esc(col.key)}"${i === 0 ? ' disabled' : ''}>▲</button>`
          s += `<button type="button" class="dt-reorder-btn" data-action="move-col-down" data-key="${esc(col.key)}"${i === orderedColumns.length - 1 ? ' disabled' : ''}>▼</button>`
          s += `</span></div>`
        }
        return s
      },
    )

    // Sort
    html += buildDd(
      openDropdown === 'sort',
      `<button class="dt-btn${sorts.length > 0 ? ' dt-btn--active' : ''}" data-action="toggle-dd" data-dd="sort">${esc(L.sort)}${sorts.length > 0 ? ` <span class="dt-chip">${sorts.length}</span>` : ''}</button>`,
      () => {
        let s = `<div class="dt-dd-section">${esc(L.sortSection)}</div>`
        for (const col of columns) {
          const sortIdx = getSortIndex(sorts, col.key)
          s += `<div class="dt-dd-item dt-dd-item--click" data-action="toggle-sort" data-key="${esc(col.key)}"><span class="dt-sort-idx">${sortIdx ?? ''}</span><span style="flex:1">${esc(col.label)}</span><span class="dt-sort-icon${sortIdx ? ' dt-sort-icon--active' : ''}">${getSortIcon(sorts, col.key)}</span></div>`
        }
        if (sorts.length > 0) {
          s += `<div class="dt-dd-footer"><button class="dt-clear-btn" data-action="clear-sorts">${esc(L.clearSorts)}</button></div>`
        }
        return s
      },
    )

    // Filter
    if (filterableCols.length > 0) {
      html += buildDd(
        openDropdown === 'filter',
        `<button class="dt-btn${activeFilterCount > 0 ? ' dt-btn--active' : ''}" data-action="toggle-dd" data-dd="filter">${esc(L.filter)}${activeFilterCount > 0 ? ` <span class="dt-chip">${activeFilterCount}</span>` : ''}</button>`,
        () => {
          let s = `<div class="dt-filter-panel">`
          s += `<div class="dt-filter-cols">`
          for (const col of filterableCols) {
            const rf = rangeFilters[col.key]
            const hasActive =
              col.type === 'number'
                ? rf !== undefined && (rf.min !== '' || rf.max !== '')
                : (filters[col.key]?.size ?? 0) > 0
            s += `<div class="dt-filter-col-item${col.key === filterActiveKey ? ' dt-filter-col-item--active' : ''}" data-action="select-filter-col" data-key="${esc(col.key)}"><span>${esc(col.label)}</span>${hasActive ? '<span class="dt-filter-col-dot"></span>' : ''}</div>`
          }
          s += `</div>`
          s += `<div class="dt-filter-detail">`
          if (filterDetailCol) {
            if (filterDetailCol.type === 'number') {
              const rf = rangeFilters[filterDetailCol.key]
              s += `<div style="padding:4px 14px 8px">`
              s += `<div style="display:flex;gap:6px;align-items:center">`
              s += `<input type="number" class="dt-range-input" placeholder="${esc(L.min)}" value="${esc(rf?.min ?? '')}" data-action="range-min" data-key="${esc(filterDetailCol.key)}" data-focus-key="rmin-${esc(filterDetailCol.key)}">`
              s += `<span class="dt-range-sep">–</span>`
              s += `<input type="number" class="dt-range-input" placeholder="${esc(L.max)}" value="${esc(rf?.max ?? '')}" data-action="range-max" data-key="${esc(filterDetailCol.key)}" data-focus-key="rmax-${esc(filterDetailCol.key)}">`
              s += `</div></div>`
            } else {
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
                s += renderDateTreeNodes(_filterDetailTree, filterDetailCol.key, 0)
              } else {
                for (const v of _filterDetailValues) {
                  const count = stringValueCounts[filterDetailCol.key]?.get(v) ?? 0
                  s += `<label class="dt-dd-item"><input type="checkbox" data-action="toggle-filter" data-key="${esc(filterDetailCol.key)}" data-value="${esc(v)}"${filters[filterDetailCol.key]?.has(v) ? ' checked' : ''}> <span class="dt-flex1">${esc(v)}</span><span class="dt-filter-count">${count}</span></label>`
                }
              }
            }
          }
          s += `</div>` // dt-filter-detail
          s += `</div>` // dt-filter-panel
          if (activeFilterCount > 0) {
            s += `<div class="dt-dd-footer"><button class="dt-clear-btn" data-action="clear-filters">${esc(L.clearFilters)}</button></div>`
          }
          return s
        },
      )
    }

    // Group
    if (groupableCols.length > 0) {
      html += buildDd(
        openDropdown === 'group',
        `<button class="dt-btn${groupBy.length > 0 ? ' dt-btn--active' : ''}" data-action="toggle-dd" data-dd="group">${esc(L.group)}${groupBy.length > 0 ? ` <span class="dt-chip">${groupBy.length}</span>` : ''}</button>`,
        () => {
          let s = `<div class="dt-dd-section">${esc(L.groupSection)}</div>`
          for (const col of groupableCols) {
            const gIdx = groupBy.indexOf(col.key)
            s += `<div class="dt-dd-item dt-dd-item--click" data-action="toggle-group" data-key="${esc(col.key)}"><span class="dt-sort-idx">${gIdx >= 0 ? gIdx + 1 : ''}</span><span style="flex:1">${esc(col.label)}</span>${groupBy.includes(col.key) ? '<span>✓</span>' : ''}</div>`
          }
          if (groupBy.length > 0) {
            s += `<div class="dt-dd-footer"><button class="dt-clear-btn" data-action="clear-groups">${esc(L.clearGroups)}</button></div>`
          }
          return s
        },
      )
    }

    html += `<input type="text" class="dt-search-input" placeholder="${esc(L.search)}" value="${esc(searchQuery)}" data-action="search" data-focus-key="search">`

    if (hasActiveState) {
      html += `<button class="dt-btn" data-action="clear-all" style="margin-left:4px">${esc(L.clearAll)}</button>`
    }

    // A group split across a page boundary contributes a second ("continued") chunk to
    // `_groupedData` — deduped by key here so it isn't double-counted.
    const pageGroupCount = new Set(_groupedData.map((g) => g.key)).size
    html += `<span class="dt-stats">${esc(L.rowCount(_processedData.length, data.length))}${groupBy.length > 0 ? esc(L.groupCount(pageGroupCount)) : ''}</span>`
    html += `</div>` // toolbar

    // --- Active chips ---
    if (hasActiveState) {
      html += `<div class="dt-chips">`
      for (const s of sorts) {
        html += `<span class="dt-chip">${sorts.indexOf(s) + 1}. ${esc(columns.find((c) => c.key === s.key)?.label ?? s.key)} ${s.dir === 'asc' ? '↑' : '↓'} <span class="dt-chip-x" data-action="remove-sort" data-key="${esc(s.key)}">×</span></span>`
      }
      for (const [key, vals] of Object.entries(filters)) {
        if (!vals.size) continue
        html += `<span class="dt-chip dt-chip--filter">${esc(columns.find((c) => c.key === key)?.label ?? key)}: ${esc(summarizeFilterValues(vals))} <span class="dt-chip-x" data-action="clear-filter-key" data-key="${esc(key)}">×</span></span>`
      }
      for (let i = 0; i < groupBy.length; i++) {
        const key = groupBy[i]
        html += `<span class="dt-chip dt-chip--group">${esc(L.groupLabel(i + 1))}: ${esc(columns.find((c) => c.key === key)?.label ?? key)} <span class="dt-chip-x" data-action="remove-group" data-key="${esc(key)}">×</span></span>`
      }
      html += `</div>`
    }

    // --- Table ---
    html += `<div class="dt-table-wrap"><table class="dt-table"><thead><tr>`
    if (selectable) {
      html += `<th class="dt-th dt-th--no-sort" style="width:36px"><input type="checkbox" data-action="select-all"${allSelected ? ' checked' : ''}></th>`
    }
    if (groupBy.length > 0) {
      html += `<th class="dt-th dt-th--no-sort" style="width:28px"></th>`
    }
    for (const col of activeColumns) {
      const sortIdx = getSortIndex(sorts, col.key)
      html += `<th class="dt-th" draggable="true" data-col-key="${esc(col.key)}"${col.width ? ` style="width:${col.width}px"` : ''} data-action="toggle-sort" data-key="${esc(col.key)}"><span class="dt-th-inner">${esc(col.label)} <span class="dt-sort-icon${sortIdx ? ' dt-sort-icon--active' : ''}">${sortIdx ? `${sortIdx}${getSortIcon(sorts, col.key)}` : '↕'}</span></span></th>`
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
          const raw = gCol ? getColumnValue(gCol, sampleRow!) : undefined
          const value = Array.isArray(raw) ? keyParts[gi] : raw
          if (gi > 0) html += `<span class="dt-group-sep"> › </span>`
          html += `<span class="dt-group-colname">${esc(gCol?.label ?? gColKey)}:</span> `
          html += gCol ? formatStr(value, sampleRow!, gCol) : esc(String(value ?? ''))
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
      html += `<span class="dt-rows-per-page">${esc(L.rowsPerPage)}:</span>`
      html += `<select class="dt-page-select" data-action="set-page-size">`
      for (const n of mergePageSizeOptions([10, 20, 50, 100], pageSize)) {
        html += `<option value="${n}"${pageSize === n ? ' selected' : ''}>${n}</option>`
      }
      html += `</select></div>`
    }

    html += `</div>` // .dt

    container.innerHTML = html

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
    const path = actionEl.dataset.path ?? ''
    const procIdx = parseInt(actionEl.dataset.procIdx ?? '-1', 10)

    let selectionChanged = false
    let viewChanged = false

    switch (action) {
      case 'toggle-dd':
        openDropdown = openDropdown === dd ? null : dd
        break
      case 'toggle-sort':
        sorts = coreToggleSort(sorts, key)
        viewChanged = true
        break
      case 'remove-sort':
        sorts = sorts.filter((s) => s.key !== key)
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
      case 'move-col-up':
      case 'move-col-down': {
        const base = columnOrder.length ? columnOrder : columns.map((c) => c.key)
        columnOrder = coreMoveColumnBy(base, key, action === 'move-col-up' ? -1 : 1)
        viewChanged = true
        break
      }
      case 'toggle-filter': {
        const anchor = filterSelectionAnchor[key]
        if (e.shiftKey && anchor != null) {
          const shouldSelect = !(filters[key]?.has(value) ?? false)
          filters = coreSetFilterValues(
            filters,
            key,
            selectRange(_filterDetailValues, anchor, value),
            shouldSelect,
          )
        } else {
          filters = coreToggleFilter(filters, key, value)
        }
        filterSelectionAnchor = { ...filterSelectionAnchor, [key]: value }
        page = 1
        viewChanged = true
        break
      }
      case 'toggle-filter-all':
        filters = coreToggleFilterAll(filters, key, _filterDetailValues)
        page = 1
        viewChanged = true
        break
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
        filters = { ...filters, [key]: new Set() }
        page = 1
        viewChanged = true
        break
      case 'clear-all':
        sorts = []
        filters = {}
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
      render()
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
    const target = e.target as HTMLSelectElement
    if (target.dataset.action !== 'set-page-size') return
    pageSize = Number(target.value)
    page = 1
    render()
    notifyViewChange()
  }

  // Roving-tabindex row navigation — see "Keyboard navigation". Delegated like click/input, but
  // on a separate listener since it must act on keys bubbling from inside a row (e.g. its
  // checkbox) too, not just on the row element itself.
  function handleKeyDown(e: KeyboardEvent): void {
    const targetEl = e.target as HTMLElement
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
  container.addEventListener('keydown', handleKeyDown)
  container.addEventListener('dragstart', handleColDragStart)
  container.addEventListener('dragover', handleColDragOver)
  container.addEventListener('drop', handleColDrop)
  container.addEventListener('dragend', handleColDragEnd)
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
    destroy(): void {
      container.removeEventListener('click', handleClick)
      container.removeEventListener('input', handleInput)
      container.removeEventListener('change', handleChange)
      container.removeEventListener('keydown', handleKeyDown)
      container.removeEventListener('dragstart', handleColDragStart)
      container.removeEventListener('dragover', handleColDragOver)
      container.removeEventListener('drop', handleColDrop)
      container.removeEventListener('dragend', handleColDragEnd)
      document.removeEventListener('click', handleDocClick)
      container.innerHTML = ''
    },
  }
}
