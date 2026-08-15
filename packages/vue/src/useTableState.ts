import { ref, shallowRef, computed, toValue, type MaybeRefOrGetter } from 'vue'
import {
  processData,
  searchData,
  groupData,
  sortWithinGroups,
  getVisibleRows,
  paginateVisibleGroups,
  paginateData,
  calcTotalPages,
  computeStringValues,
  toggleSort as _toggleSort,
  replaceSort as _replaceSort,
  appendOrToggleSort as _appendOrToggleSort,
  moveSortBy as _moveSortBy,
  reorderSort as _reorderSort,
  toggleSortDir as _toggleSortDir,
  toggleFilterAll as _toggleFilterAll,
  setFilterValues as _setFilterValues,
  cycleFilterValue as _cycleFilterValue,
  clearExcludeValues as _clearExcludeValues,
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

  const defaultSortDirFor = (key: string) =>
    columns.value.find((c) => c.key === key)?.defaultSortDir ?? 'asc'

  const visibleCols = ref<Set<string>>(
    new Set(options.value.defaultVisibleColumns ?? columns.value.map((c) => c.key)),
  )
  const columnOrder = ref<string[]>([])
  const sorts = ref<SortEntry[]>([])
  const filters = ref<Record<string, Set<string>>>({})
  // "Not one of these values" filters for multi-value columns — see `cycleFilterValue`. Kept as
  // a separate Set per column, mutually exclusive with `filters` (a value is never in both at
  // once) by `cycleFilterValue`/`clearExcludeValues`.
  const excludeFilters = ref<Record<string, Set<string>>>({})
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

  const processedData = computed(() =>
    processData(
      searchData(data.value, searchQuery.value, columns.value),
      filters.value,
      rangeFilters.value,
      sorts.value,
      columns.value,
      L.value.emptyValue,
      excludeFilters.value,
    ),
  )

  // Grouping runs over the *full* filtered/sorted data, not a page's slice, so pagination (below)
  // can budget page size across header rows and data rows together instead of paginating data
  // rows first and grouping whatever lands on that page afterward — see "Pagination" in the docs.
  const groupedFull = computed(() =>
    sortWithinGroups(
      groupData(processedData.value, groupBy.value, columns.value, L.value.emptyValue),
      sorts.value,
      groupBy.value,
      columns.value,
    ),
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

  const activeFilterCount = computed(() =>
    countActiveFilters(filters.value, rangeFilters.value, excludeFilters.value),
  )

  const selectedRows = computed(() => processedData.value.filter((r) => selection.value.has(r)))

  return {
    // Reactive state
    selection,
    visibleCols,
    columnOrder,
    sorts,
    filters,
    excludeFilters,
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
    moveColumn: (dragKey: string, targetKey: string, after = false) => {
      const base = columnOrder.value.length ? columnOrder.value : columns.value.map((c) => c.key)
      columnOrder.value = _reorderColumn(base, dragKey, targetKey, after)
    },
    moveColumnBy: (key: string, delta: number) => {
      const base = columnOrder.value.length ? columnOrder.value : columns.value.map((c) => c.key)
      columnOrder.value = _moveColumnBy(base, key, delta)
    },
    toggleSort: (key: string) => {
      sorts.value = _toggleSort(sorts.value, key, defaultSortDirFor(key))
    },
    replaceSort: (key: string) => {
      sorts.value = _replaceSort(sorts.value, key, defaultSortDirFor(key))
    },
    appendOrToggleSort: (key: string) => {
      sorts.value = _appendOrToggleSort(sorts.value, key, defaultSortDirFor(key))
    },
    removeSort: (key: string) => {
      sorts.value = sorts.value.filter((s) => s.key !== key)
    },
    toggleSortDir: (key: string) => {
      sorts.value = sorts.value.map((s) =>
        s.key === key ? { ...s, dir: _toggleSortDir(s.dir) } : s,
      )
    },
    moveSortBy: (key: string, delta: number) => {
      sorts.value = _moveSortBy(sorts.value, key, delta)
    },
    moveSort: (dragKey: string, targetKey: string, after = false) => {
      sorts.value = _reorderSort(sorts.value, dragKey, targetKey, after)
    },
    toggleFilterAll: (key: string, values: string[]) => {
      // The master checkbox's own checked/indeterminate state reflects `filters` only (no visual
      // concept of exclusion) — so only the "select all ON" branch should ever touch
      // `excludeFilters`, and only because it must: every listed value is about to become
      // included, and a value can't be in both sets at once (see `cycleFilterValue`). The
      // "deselect all" branch leaves `excludeFilters` completely alone — it only clears values
      // the checkbox showed as selected, which by that same invariant can never include an
      // already-excluded value.
      const willSelectAll = !values.some((v) => filters.value[key]?.has(v))
      filters.value = _toggleFilterAll(filters.value, key, values)
      if (willSelectAll)
        excludeFilters.value = _clearExcludeValues(excludeFilters.value, key, values)
      page.value = 1
    },
    setFilterValues: (key: string, values: string[], selected: boolean) => {
      filters.value = _setFilterValues(filters.value, key, values, selected)
      page.value = 1
    },
    // Cycles a single checklist value neutral → include → exclude → neutral (see
    // `cycleFilterValue`). Shift-range selection (`setFilterValues` above) stays include-only by
    // design — see the docs — so a caller extending a range that should also clear a swept
    // value's exclusion calls `clearExcludeValues` alongside it, same as `toggleFilterAll` above.
    cycleFilterValue: (key: string, value: string) => {
      const next = _cycleFilterValue(filters.value, excludeFilters.value, key, value)
      filters.value = next.filters
      excludeFilters.value = next.excludeFilters
      page.value = 1
    },
    clearExcludeValues: (key: string, values: string[]) => {
      excludeFilters.value = _clearExcludeValues(excludeFilters.value, key, values)
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
    // A column can carry an include set, an exclude set, and a range filter all at once (a date
    // column, or any multi-value column with both an include and an exclude selection) — `kind`
    // says which one to clear, so removing one doesn't silently drop the others too. This used to
    // be a single unconditional "full per-column reset" (clearing every kind together), which read
    // as an acceptable simplification back when a column could carry at most an include set *or*
    // a range filter as alternatives — but once include/exclude became two states a column can
    // hold at once, that stopped reading as a reset and started reading as a bug: removing one
    // active-bar chip silently cleared a sibling chip on the same column too.
    clearColumnFilter: (key: string, kind: 'include' | 'exclude' | 'range' = 'include') => {
      if (kind === 'exclude') excludeFilters.value = { ...excludeFilters.value, [key]: new Set() }
      else if (kind === 'range')
        rangeFilters.value = { ...rangeFilters.value, [key]: { min: '', max: '' } }
      else filters.value = { ...filters.value, [key]: new Set() }
      page.value = 1
    },
    setPage: (p: number) => {
      if (!Number.isFinite(p)) return
      page.value = Math.max(1, Math.min(Math.floor(p), numPages.value))
    },
    setPageSize: (s: number) => {
      if (!Number.isFinite(s)) return
      pageSize.value = Math.max(0, Math.floor(s))
      page.value = 1
    },
    toggleGroup: (key: string) => {
      groupBy.value = toggleGroupBy(groupBy.value, key)
    },
    removeGroup: (key: string) => {
      groupBy.value = groupBy.value.filter((k) => k !== key)
    },
    moveGroupBy: (key: string, delta: number) => {
      groupBy.value = _moveColumnBy(groupBy.value, key, delta)
    },
    moveGroup: (dragKey: string, targetKey: string, after = false) => {
      groupBy.value = _reorderColumn(groupBy.value, dragKey, targetKey, after)
    },
    toggleGroupCollapse: (key: string) => {
      collapsedGroups.value = toggleCollapse(collapsedGroups.value, key)
    },
    clearSorts: () => {
      sorts.value = []
    },
    clearFilters: () => {
      filters.value = {}
      excludeFilters.value = {}
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
      excludeFilters.value = {}
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
      const excludeFilterEntries = Object.entries(excludeFilters.value).filter(
        ([, v]) => v.size > 0,
      )
      if (excludeFilterEntries.length)
        view.excludeFilters = Object.fromEntries(excludeFilterEntries.map(([k, v]) => [k, [...v]]))
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
      excludeFilters.value = Object.fromEntries(
        Object.entries(view.excludeFilters ?? {}).map(([k, v]) => [k, new Set(v)]),
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
