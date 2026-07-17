import { useState, useMemo } from 'react'
import {
  processData,
  searchData,
  groupData,
  getVisibleRows,
  paginateVisibleGroups,
  paginateData,
  calcTotalPages,
  computeStringValues,
  toggleSort as _toggleSort,
  toggleFilter as _toggleFilter,
  toggleFilterAll as _toggleFilterAll,
  setFilterValues as _setFilterValues,
  selectRange,
  toggleGroupBy,
  toggleCollapse,
  getOrderedColumns,
  reorderColumn as _reorderColumn,
  moveColumnBy as _moveColumnBy,
  getSortIcon as _getSortIcon,
  getSortIndex as _getSortIndex,
  countActiveFilters,
  DEFAULT_LABELS,
  type SortEntry,
  type RangeFilter,
  type DataTableLabels,
  type TableViewState,
} from '@vates/data-table-core'
import type { ColumnDef } from './types'

export type TableState<TRow extends object> = ReturnType<typeof useTableState<TRow>>

export function useTableState<TRow extends object>(
  data: TRow[],
  columns: ColumnDef<TRow>[],
  defaultVisibleColumns?: string[],
  labelOverrides?: Partial<DataTableLabels>,
  defaultPageSize?: number,
  defaultGroupsCollapsed = true,
) {
  const L = { ...DEFAULT_LABELS, ...labelOverrides }

  const [visibleCols, setVisibleCols] = useState<Set<string>>(
    () => new Set(defaultVisibleColumns ?? columns.map((c) => c.key)),
  )
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [sorts, setSorts] = useState<SortEntry[]>([])
  const [filters, setFilters] = useState<Record<string, Set<string>>>({})
  const [rangeFilters, setRangeFilters] = useState<Record<string, RangeFilter>>({})
  const [groupBy, setGroupBy] = useState<string[]>([])
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSizeState] = useState(defaultPageSize ?? 0)
  const [selection, setSelection] = useState<Set<TRow>>(new Set())
  const [selectionAnchor, setSelectionAnchor] = useState<TRow | null>(null)
  const [searchQuery, setSearchQueryState] = useState('')

  const stringValueMap = useMemo(
    () => computeStringValues(data, columns, L.emptyValue),
    [data, columns, L.emptyValue],
  )

  const processedData = useMemo(
    () =>
      processData(
        searchData(data, searchQuery, columns),
        filters,
        rangeFilters,
        sorts,
        columns,
        L.emptyValue,
      ),
    [data, searchQuery, columns, filters, rangeFilters, sorts, L.emptyValue],
  )

  // Grouping runs over the *full* filtered/sorted data, not a page's slice, so pagination (below)
  // can budget page size across header rows and data rows together instead of paginating data
  // rows first and grouping whatever lands on that page afterward — see "Pagination" in the docs.
  const groupedFull = useMemo(
    () => groupData(processedData, groupBy, columns, L.emptyValue),
    [processedData, groupBy, columns, L.emptyValue],
  )

  const visibleItems = useMemo(
    () => getVisibleRows(groupedFull, collapsedGroups, defaultGroupsCollapsed),
    [groupedFull, collapsedGroups, defaultGroupsCollapsed],
  )

  const numPages = useMemo(
    () => calcTotalPages(visibleItems.length, pageSize),
    [visibleItems.length, pageSize],
  )

  const clampedPage = Math.min(page, numPages)

  const pagedData = useMemo(
    () =>
      paginateData(visibleItems, clampedPage, pageSize)
        .filter((item) => item.kind === 'row')
        .map((item) => item.row),
    [visibleItems, clampedPage, pageSize],
  )

  const groupedData = useMemo(
    () =>
      paginateVisibleGroups(
        groupedFull,
        visibleItems,
        collapsedGroups,
        defaultGroupsCollapsed,
        clampedPage,
        pageSize,
      ),
    [groupedFull, visibleItems, collapsedGroups, defaultGroupsCollapsed, clampedPage, pageSize],
  )

  const activeColumns = useMemo(
    () =>
      getOrderedColumns(columns, columnOrder).filter(
        (c) => visibleCols.has(c.key) && !groupBy.includes(c.key),
      ),
    [columns, columnOrder, visibleCols, groupBy],
  )

  const orderedColumns = useMemo(
    () => getOrderedColumns(columns, columnOrder),
    [columns, columnOrder],
  )

  const activeFilterCount = useMemo(
    () => countActiveFilters(filters, rangeFilters),
    [filters, rangeFilters],
  )

  const selectedRows = useMemo(
    () => processedData.filter((r) => selection.has(r)),
    [processedData, selection],
  )

  return {
    // Raw state (for direct manipulation in the UI)
    selection,
    visibleCols,
    columnOrder,
    sorts,
    filters,
    rangeFilters,
    groupBy,
    collapsedGroups,
    page,
    pageSize,
    searchQuery,
    defaultGroupsCollapsed,
    // Derived
    selectedRows,
    processedData,
    pagedData,
    groupedData,
    visibleItems,
    activeColumns,
    orderedColumns,
    stringValueMap,
    activeFilterCount,
    numPages,
    L,
    // Actions
    toggleColVisibility: (key: string) =>
      setVisibleCols((prev) => {
        const next = new Set(prev)
        if (next.has(key)) {
          if (next.size > 1) next.delete(key)
        } else next.add(key)
        return next
      }),
    moveColumn: (dragKey: string, targetKey: string) =>
      setColumnOrder((prev) =>
        _reorderColumn(prev.length ? prev : columns.map((c) => c.key), dragKey, targetKey),
      ),
    moveColumnBy: (key: string, delta: number) =>
      setColumnOrder((prev) =>
        _moveColumnBy(prev.length ? prev : columns.map((c) => c.key), key, delta),
      ),
    toggleSort: (key: string) => setSorts((prev) => _toggleSort(prev, key)),
    toggleFilter: (key: string, value: string) => {
      setFilters((prev) => _toggleFilter(prev, key, value))
      setPageState(1)
    },
    toggleFilterAll: (key: string, values: string[]) => {
      setFilters((prev) => _toggleFilterAll(prev, key, values))
      setPageState(1)
    },
    setFilterValues: (key: string, values: string[], selected: boolean) => {
      setFilters((prev) => _setFilterValues(prev, key, values, selected))
      setPageState(1)
    },
    setRangeFilter: (key: string, field: 'min' | 'max', value: string) => {
      setRangeFilters((prev) => ({
        ...prev,
        [key]: { min: prev[key]?.min ?? '', max: prev[key]?.max ?? '', [field]: value },
      }))
      setPageState(1)
    },
    toggleGroup: (key: string) => setGroupBy((prev) => toggleGroupBy(prev, key)),
    toggleGroupCollapse: (key: string) => setCollapsedGroups((prev) => toggleCollapse(prev, key)),
    clearColumnFilter: (key: string) => {
      setFilters((prev) => ({ ...prev, [key]: new Set() }))
      setPageState(1)
    },
    setPage: (p: number) => setPageState(Math.max(1, Math.min(p, numPages))),
    setPageSize: (s: number) => {
      setPageSizeState(s)
      setPageState(1)
    },
    clearSorts: () => setSorts([]),
    clearFilters: () => {
      setFilters({})
      setRangeFilters({})
      setPageState(1)
    },
    clearGroups: () => {
      setGroupBy([])
      setCollapsedGroups(new Set())
    },
    setSearchQuery: (q: string) => {
      setSearchQueryState(q)
      setPageState(1)
    },
    clearAll: () => {
      setSorts([])
      setFilters({})
      setRangeFilters({})
      setGroupBy([])
      setCollapsedGroups(new Set())
      setPageState(1)
      setSearchQueryState('')
    },
    getSortIcon: (key: string) => _getSortIcon(sorts, key),
    getSortIndex: (key: string) => _getSortIndex(sorts, key),
    toggleRowSelection: (row: TRow, shiftKey = false) => {
      setSelection((prev) => {
        const next = new Set(prev)
        if (shiftKey && selectionAnchor) {
          const shouldSelect = !next.has(row)
          const range = selectRange(processedData, selectionAnchor, row)
          if (shouldSelect) range.forEach((r) => next.add(r))
          else range.forEach((r) => next.delete(r))
        } else if (next.has(row)) {
          next.delete(row)
        } else {
          next.add(row)
        }
        return next
      })
      setSelectionAnchor(row)
    },
    toggleSelectAll: (rows: TRow[]) =>
      setSelection((prev) => {
        const next = new Set(prev)
        const someSelected = rows.some((r) => next.has(r))
        if (someSelected) rows.forEach((r) => next.delete(r))
        else rows.forEach((r) => next.add(r))
        return next
      }),
    clearSelection: () => {
      setSelection(new Set())
      setSelectionAnchor(null)
    },
    getViewState: (): TableViewState => {
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
      if (pageSize !== (defaultPageSize ?? 0)) view.pageSize = pageSize
      if (searchQuery) view.searchQuery = searchQuery
      return view
    },
    setViewState: (view: TableViewState) => {
      const validVisible = view.visibleCols?.filter((k) => columns.some((c) => c.key === k))
      setVisibleCols(
        validVisible?.length
          ? new Set(validVisible)
          : new Set(defaultVisibleColumns ?? columns.map((c) => c.key)),
      )
      setColumnOrder(view.columnOrder?.filter((k) => columns.some((c) => c.key === k)) ?? [])
      setSorts(view.sorts ?? [])
      setFilters(
        Object.fromEntries(Object.entries(view.filters ?? {}).map(([k, v]) => [k, new Set(v)])),
      )
      setRangeFilters(view.rangeFilters ?? {})
      setGroupBy(view.groupBy ?? [])
      setCollapsedGroups(new Set(view.collapsedGroups ?? []))
      setPageState(view.page ?? 1)
      setPageSizeState(view.pageSize ?? defaultPageSize ?? 0)
      setSearchQueryState(view.searchQuery ?? '')
    },
  }
}
