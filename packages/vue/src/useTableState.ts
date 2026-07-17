import { ref, shallowRef, computed, toValue, type MaybeRefOrGetter } from 'vue'
import {
  processData,
  searchData,
  groupData,
  getVisibleRows,
  paginateVisibleGroups,
  paginateData,
  calcTotalPages,
  computeStringValues,
  computeStringValueCounts,
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

export interface UseTableStateOptions {
  defaultVisibleColumns?: string[]
  labels?: Partial<DataTableLabels>
  defaultPageSize?: number
  /** Whether newly-grouped groups start collapsed. Defaults to `true`; pass `false` to start expanded. */
  defaultGroupsCollapsed?: boolean
}

export type TableState<TRow extends object> = ReturnType<typeof useTableState<TRow>>

export function useTableState<TRow extends object>(
  getData: MaybeRefOrGetter<TRow[]>,
  getColumns: MaybeRefOrGetter<ColumnDef<TRow>[]>,
  getOptions?: MaybeRefOrGetter<UseTableStateOptions>,
) {
  const data = computed(() => toValue(getData))
  const columns = computed(() => toValue(getColumns))
  const options = computed(() => toValue(getOptions) ?? {})

  const L = computed(() => ({ ...DEFAULT_LABELS, ...options.value.labels }))
  const defaultGroupsCollapsed = computed(() => options.value.defaultGroupsCollapsed ?? true)

  const visibleCols = ref<Set<string>>(
    new Set(options.value.defaultVisibleColumns ?? columns.value.map((c) => c.key)),
  )
  const columnOrder = ref<string[]>([])
  const sorts = ref<SortEntry[]>([])
  const filters = ref<Record<string, Set<string>>>({})
  const rangeFilters = ref<Record<string, RangeFilter>>({})
  const groupBy = ref<string[]>([])
  const collapsedGroups = ref<Set<string>>(new Set())
  const page = ref(1)
  const pageSize = ref(options.value.defaultPageSize ?? 0)
  const selection = shallowRef<Set<TRow>>(new Set())
  const selectionAnchor = shallowRef<TRow | null>(null)
  const searchQuery = ref('')

  const stringValueMap = computed(() =>
    computeStringValues(data.value, columns.value, L.value.emptyValue),
  )

  const stringValueCounts = computed(() =>
    computeStringValueCounts(
      data.value,
      filters.value,
      rangeFilters.value,
      columns.value,
      L.value.emptyValue,
    ),
  )

  const processedData = computed(() =>
    processData(
      searchData(data.value, searchQuery.value, columns.value),
      filters.value,
      rangeFilters.value,
      sorts.value,
      columns.value,
      L.value.emptyValue,
    ),
  )

  // Grouping runs over the *full* filtered/sorted data, not a page's slice, so pagination (below)
  // can budget page size across header rows and data rows together instead of paginating data
  // rows first and grouping whatever lands on that page afterward — see "Pagination" in the docs.
  const groupedFull = computed(() =>
    groupData(processedData.value, groupBy.value, columns.value, L.value.emptyValue),
  )

  const visibleItems = computed(() =>
    getVisibleRows(groupedFull.value, collapsedGroups.value, defaultGroupsCollapsed.value),
  )

  const numPages = computed(() => calcTotalPages(visibleItems.value.length, pageSize.value))

  const clampedPage = computed(() => Math.min(page.value, numPages.value))

  const pagedData = computed(() =>
    paginateData(visibleItems.value, clampedPage.value, pageSize.value)
      .filter((item) => item.kind === 'row')
      .map((item) => item.row),
  )

  const groupedData = computed(() =>
    paginateVisibleGroups(
      groupedFull.value,
      visibleItems.value,
      collapsedGroups.value,
      defaultGroupsCollapsed.value,
      clampedPage.value,
      pageSize.value,
    ),
  )

  const activeColumns = computed(() =>
    getOrderedColumns(columns.value, columnOrder.value).filter(
      (c) => visibleCols.value.has(c.key) && !groupBy.value.includes(c.key),
    ),
  )

  const orderedColumns = computed(() => getOrderedColumns(columns.value, columnOrder.value))

  const activeFilterCount = computed(() => countActiveFilters(filters.value, rangeFilters.value))

  const selectedRows = computed(() => processedData.value.filter((r) => selection.value.has(r)))

  return {
    // Reactive state
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
    // Computed
    selectedRows,
    processedData,
    pagedData,
    groupedData,
    visibleItems,
    activeColumns,
    orderedColumns,
    stringValueMap,
    stringValueCounts,
    activeFilterCount,
    numPages,
    L,
    // Actions
    toggleColVisibility: (key: string) => {
      const next = new Set(visibleCols.value)
      if (next.has(key)) {
        if (next.size > 1) next.delete(key)
      } else next.add(key)
      visibleCols.value = next
    },
    moveColumn: (dragKey: string, targetKey: string) => {
      const base = columnOrder.value.length ? columnOrder.value : columns.value.map((c) => c.key)
      columnOrder.value = _reorderColumn(base, dragKey, targetKey)
    },
    moveColumnBy: (key: string, delta: number) => {
      const base = columnOrder.value.length ? columnOrder.value : columns.value.map((c) => c.key)
      columnOrder.value = _moveColumnBy(base, key, delta)
    },
    toggleSort: (key: string) => {
      sorts.value = _toggleSort(sorts.value, key)
    },
    toggleFilter: (key: string, value: string) => {
      filters.value = _toggleFilter(filters.value, key, value)
      page.value = 1
    },
    toggleFilterAll: (key: string, values: string[]) => {
      filters.value = _toggleFilterAll(filters.value, key, values)
      page.value = 1
    },
    setFilterValues: (key: string, values: string[], selected: boolean) => {
      filters.value = _setFilterValues(filters.value, key, values, selected)
      page.value = 1
    },
    setRangeFilter: (key: string, field: 'min' | 'max', value: string) => {
      rangeFilters.value = {
        ...rangeFilters.value,
        [key]: {
          min: rangeFilters.value[key]?.min ?? '',
          max: rangeFilters.value[key]?.max ?? '',
          [field]: value,
        },
      }
      page.value = 1
    },
    clearColumnFilter: (key: string) => {
      filters.value = { ...filters.value, [key]: new Set() }
      page.value = 1
    },
    setPage: (p: number) => {
      page.value = Math.max(1, Math.min(p, numPages.value))
    },
    setPageSize: (s: number) => {
      pageSize.value = s
      page.value = 1
    },
    toggleGroup: (key: string) => {
      groupBy.value = toggleGroupBy(groupBy.value, key)
    },
    toggleGroupCollapse: (key: string) => {
      collapsedGroups.value = toggleCollapse(collapsedGroups.value, key)
    },
    clearSorts: () => {
      sorts.value = []
    },
    clearFilters: () => {
      filters.value = {}
      rangeFilters.value = {}
      page.value = 1
    },
    clearGroups: () => {
      groupBy.value = []
      collapsedGroups.value = new Set()
    },
    setSearchQuery: (q: string) => {
      searchQuery.value = q
      page.value = 1
    },
    clearAll: () => {
      sorts.value = []
      filters.value = {}
      rangeFilters.value = {}
      groupBy.value = []
      collapsedGroups.value = new Set()
      page.value = 1
      searchQuery.value = ''
    },
    getSortIcon: (key: string) => _getSortIcon(sorts.value, key),
    getSortIndex: (key: string) => _getSortIndex(sorts.value, key),
    toggleRowSelection: (row: TRow, shiftKey = false) => {
      const next = new Set(selection.value)
      if (shiftKey && selectionAnchor.value) {
        const shouldSelect = !next.has(row)
        const range = selectRange(processedData.value, selectionAnchor.value, row)
        if (shouldSelect) range.forEach((r) => next.add(r))
        else range.forEach((r) => next.delete(r))
      } else if (next.has(row)) {
        next.delete(row)
      } else {
        next.add(row)
      }
      selection.value = next
      selectionAnchor.value = row
    },
    toggleSelectAll: (rows: TRow[]) => {
      const next = new Set(selection.value)
      const someSelected = rows.some((r) => next.has(r))
      if (someSelected) rows.forEach((r) => next.delete(r))
      else rows.forEach((r) => next.add(r))
      selection.value = next
    },
    clearSelection: () => {
      selection.value = new Set()
      selectionAnchor.value = null
    },
    getViewState: (): TableViewState => {
      const view: TableViewState = {}
      const allKeys = columns.value.map((c) => c.key)
      const isDefaultVisible =
        visibleCols.value.size === allKeys.length && allKeys.every((k) => visibleCols.value.has(k))
      if (!isDefaultVisible) view.visibleCols = [...visibleCols.value]
      if (columnOrder.value.length) view.columnOrder = columnOrder.value
      if (sorts.value.length) view.sorts = sorts.value
      const filterEntries = Object.entries(filters.value).filter(([, v]) => v.size > 0)
      if (filterEntries.length)
        view.filters = Object.fromEntries(filterEntries.map(([k, v]) => [k, [...v]]))
      const rangeEntries = Object.entries(rangeFilters.value).filter(
        ([, r]) => r.min !== '' || r.max !== '',
      )
      if (rangeEntries.length) view.rangeFilters = Object.fromEntries(rangeEntries)
      if (groupBy.value.length) view.groupBy = groupBy.value
      if (collapsedGroups.value.size) view.collapsedGroups = [...collapsedGroups.value]
      if (page.value !== 1) view.page = page.value
      if (pageSize.value !== (options.value.defaultPageSize ?? 0)) view.pageSize = pageSize.value
      if (searchQuery.value) view.searchQuery = searchQuery.value
      return view
    },
    setViewState: (view: TableViewState) => {
      const validVisible = view.visibleCols?.filter((k) => columns.value.some((c) => c.key === k))
      visibleCols.value = validVisible?.length
        ? new Set(validVisible)
        : new Set(options.value.defaultVisibleColumns ?? columns.value.map((c) => c.key))
      columnOrder.value =
        view.columnOrder?.filter((k) => columns.value.some((c) => c.key === k)) ?? []
      sorts.value = view.sorts ?? []
      filters.value = Object.fromEntries(
        Object.entries(view.filters ?? {}).map(([k, v]) => [k, new Set(v)]),
      )
      rangeFilters.value = view.rangeFilters ?? {}
      groupBy.value = view.groupBy ?? []
      collapsedGroups.value = new Set(view.collapsedGroups ?? [])
      page.value = view.page ?? 1
      pageSize.value = view.pageSize ?? options.value.defaultPageSize ?? 0
      searchQuery.value = view.searchQuery ?? ''
    },
  }
}
