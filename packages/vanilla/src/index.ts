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
  paginateData,
  calcTotalPages,
  toggleSort as coreToggleSort,
  toggleFilter as coreToggleFilter,
  toggleFilterAll as coreToggleFilterAll,
  setFilterValues as coreSetFilterValues,
  selectRange,
  toggleGroupBy,
  toggleCollapse,
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
  DEFAULT_LABELS,
  type SortEntry,
  type RangeFilter,
  type DataTableLabels,
  type TableViewState,
  type DateTreeNode,
  type ValueSort,
} from '@vates/data-table-core'
import type { ColumnDef, DataTableOptions, DataTableInstance } from './types'
import { STYLES } from './styles'

export type { ColumnDef, DataTableOptions, DataTableInstance }
export type { DataTableLabels, TableViewState } from '@vates/data-table-core'
export { persistViewToLocalStorage, syncViewToUrl } from './persistence'
export type { ViewStateApi, SyncViewToUrlOptions } from './persistence'
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
  const { rowKey, selectable = false, onSelectionChange, onRowClick } = options
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
  let openDropdown: string | null = null
  let filterActiveCol: string | null = null
  let filterSearchTerms: Record<string, string> = {}
  let filterSelectionAnchor: Record<string, string> = {}
  let filterValueSort: Record<string, ValueSort> = {}
  let expandedDateNodes: Record<string, Set<string>> = {}
  let searchQuery = ''
  let draggedColKey: string | null = null
  const viewListeners = new Set<(view: TableViewState) => void>()

  // Updated by derive(), read by event handlers
  let _processedData: TRow[] = []
  let _groupedData: Array<{ key: string | null; keyParts: string[]; rows: TRow[] }> = []
  let _numPages = 1
  let _clampedPage = 1
  let _filterDetailValues: string[] = []
  let _filterDetailTree: DateTreeNode[] = []

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
    _numPages = calcTotalPages(_processedData.length, pageSize)
    _clampedPage = Math.min(page, Math.max(1, _numPages))
    const pagedData = paginateData(_processedData, _clampedPage, pageSize)
    _groupedData = groupData(pagedData, groupBy, columns, L.emptyValue)
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

  function formatStr(v: unknown, row: TRow, col: ColumnDef<TRow>): string {
    if (col.format) return esc(col.format(v, row))
    if (Array.isArray(v)) return esc(v.join(', '))
    return esc(v != null ? String(v) : '')
  }

  function aggStr(col: ColumnDef<TRow>, rows: TRow[]): string {
    const v = computeAggregate(col, rows)
    if (v === undefined || v === null) return ''
    return formatStr(v, rows[0], col)
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
    // Save focus state
    const focused = document.activeElement as HTMLElement | null
    const focusKey =
      focused && container.contains(focused) ? (focused.dataset.focusKey ?? null) : null
    const selStart = focused instanceof HTMLInputElement ? focused.selectionStart : null
    const selEnd = focused instanceof HTMLInputElement ? focused.selectionEnd : null

    const {
      stringValueMap,
      stringValueCounts,
      orderedColumns,
      activeColumns,
      activeFilterCount,
      selectedRows,
    } = derive()

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
        ? computeDateTree(_filterDetailValues, L.emptyValue, valueSortFor(filterDetailCol.key).dir)
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

    html += `<span class="dt-stats">${esc(L.rowCount(_processedData.length, data.length))}${groupBy.length > 0 ? esc(L.groupCount(_groupedData.length)) : ''}</span>`
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

    for (const { key: gkey, keyParts, rows } of _groupedData) {
      if (gkey !== null) {
        const isCollapsed = collapsedGroups.has(gkey)
        const gAllSel = rows.length > 0 && rows.every((r) => selection.has(r))
        html += `<tr class="dt-group-row" data-action="toggle-group-collapse" data-gkey="${esc(gkey)}">`
        if (selectable) {
          // data-no-collapse prevents this td click from triggering the row collapse
          html += `<td class="dt-group-td" style="width:36px" data-no-collapse><input type="checkbox" data-action="toggle-group-select" data-gkey="${esc(gkey)}"${gAllSel ? ' checked' : ''}></td>`
        }
        html += `<td class="dt-group-td" style="width:28px">${isCollapsed ? '▶' : '▼'}</td>`
        html += `<td class="dt-group-td" colspan="${activeColumns.length}">`
        for (let gi = 0; gi < groupBy.length; gi++) {
          const gColKey = groupBy[gi]
          const gCol = columns.find((c) => c.key === gColKey)
          const raw = gCol ? getColumnValue(gCol, rows[0]) : undefined
          const value = Array.isArray(raw) ? keyParts[gi] : raw
          if (gi > 0) html += `<span class="dt-group-sep"> › </span>`
          html += `<span class="dt-group-colname">${esc(gCol?.label ?? gColKey)}:</span> `
          html += gCol ? formatStr(value, rows[0], gCol) : esc(String(value ?? ''))
        }
        html += ` <span class="dt-group-count">${esc(L.rowsInGroup(rows.length))}</span></td></tr>`

        if (hasAgg) {
          html += `<tr class="dt-agg-row">`
          if (selectable) html += `<td class="dt-agg-td" style="width:36px"></td>`
          html += `<td class="dt-agg-td" style="width:28px"></td>`
          for (const col of activeColumns) {
            html += `<td class="dt-agg-td">${aggStr(col, rows)}</td>`
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
            html += `<tr class="${trClass}" data-row-key="${esc(rk)}" data-action="row-click" data-proc-idx="${procIdx}">`
            if (selectable) {
              html += `<td class="dt-td" style="width:36px" data-no-row-click><input type="checkbox" data-action="toggle-row-select" data-proc-idx="${procIdx}"${isSelected ? ' checked' : ''}></td>`
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
          html += `<tr class="${trClass}" data-row-key="${esc(rk)}" data-action="row-click" data-proc-idx="${procIdx}">`
          if (selectable) {
            html += `<td class="dt-td" style="width:36px" data-no-row-click><input type="checkbox" data-action="toggle-row-select" data-proc-idx="${procIdx}"${isSelected ? ' checked' : ''}></td>`
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
      for (const n of [10, 20, 50, 100]) {
        html += `<option value="${n}"${pageSize === n ? ' selected' : ''}>${n}</option>`
      }
      html += `</select></div>`
    }

    html += `</div>` // .dt

    container.innerHTML = html

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
  }

  // --- Event handlers ---

  function handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement
    const actionEl = target.closest('[data-action]') as HTMLElement | null

    // Close dropdown when clicking outside a dd-wrap
    if (openDropdown !== null && !target.closest('.dt-dd-wrap')) {
      openDropdown = null
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
          filters = coreToggleFilterAll(filters, key, node.values)
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
        const allSel = _processedData.length > 0 && _processedData.every((r) => next.has(r))
        if (allSel) _processedData.forEach((r) => next.delete(r))
        else _processedData.forEach((r) => next.add(r))
        selection = next
        selectionChanged = true
        break
      }
      case 'toggle-row-select': {
        if (procIdx >= 0 && procIdx < _processedData.length) {
          const row = _processedData[procIdx]
          const next = new Set(selection)
          if (e.shiftKey && selectionAnchor) {
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
          selectionChanged = true
        }
        break
      }
      case 'toggle-group-select': {
        const group = _groupedData.find((g) => g.key === gkey)
        if (group) {
          const groupRows = group.rows
          const next = new Set(selection)
          const allSel = groupRows.length > 0 && groupRows.every((r) => next.has(r))
          if (allSel) groupRows.forEach((r) => next.delete(r))
          else groupRows.forEach((r) => next.add(r))
          selection = next
          selectionChanged = true
        }
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
          onRowClick?.(_processedData[procIdx], e)
        }
        return
      default:
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
      container.removeEventListener('dragstart', handleColDragStart)
      container.removeEventListener('dragover', handleColDragOver)
      container.removeEventListener('drop', handleColDrop)
      container.removeEventListener('dragend', handleColDragEnd)
      document.removeEventListener('click', handleDocClick)
      container.innerHTML = ''
    },
  }
}
