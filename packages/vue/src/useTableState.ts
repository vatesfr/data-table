import { ref, shallowRef, computed, toValue, type MaybeRefOrGetter } from 'vue'
import {
  processData,
  searchData,
  groupData,
  computeStringValues,
  paginateData,
  calcTotalPages,
  toggleSort as _toggleSort,
  toggleFilter as _toggleFilter,
  toggleGroupBy,
  toggleCollapse,
  getSortIcon as _getSortIcon,
  getSortIndex as _getSortIndex,
  countActiveFilters,
  DEFAULT_LABELS,
  type SortEntry,
  type RangeFilter,
  type DataTableLabels,
} from '@vates/flexi-table-core'
import type { ColumnDef } from './types'

export interface UseTableStateOptions {
  defaultVisibleColumns?: string[]
  labels?: Partial<DataTableLabels>
  defaultPageSize?: number
}

export function useTableState<TRow extends object>(
  getData: MaybeRefOrGetter<TRow[]>,
  getColumns: MaybeRefOrGetter<ColumnDef<TRow>[]>,
  getOptions?: MaybeRefOrGetter<UseTableStateOptions>,
) {
  const data = computed(() => toValue(getData))
  const columns = computed(() => toValue(getColumns))
  const options = computed(() => toValue(getOptions) ?? {})

  const L = computed(() => ({ ...DEFAULT_LABELS, ...options.value.labels }))

  const visibleCols = ref<Set<string>>(
    new Set(options.value.defaultVisibleColumns ?? columns.value.map((c) => c.key)),
  )
  const sorts = ref<SortEntry[]>([])
  const filters = ref<Record<string, Set<string>>>({})
  const rangeFilters = ref<Record<string, RangeFilter>>({})
  const groupBy = ref<string[]>([])
  const collapsedGroups = ref<Set<string>>(new Set())
  const page = ref(1)
  const pageSize = ref(options.value.defaultPageSize ?? 0)
  const selection = shallowRef<Set<TRow>>(new Set())
  const searchQuery = ref('')

  const stringValueMap = computed(() => computeStringValues(data.value, columns.value))

  const processedData = computed(() =>
    processData(
      searchData(data.value, searchQuery.value, columns.value),
      filters.value,
      rangeFilters.value,
      sorts.value,
    ),
  )

  const numPages = computed(() => calcTotalPages(processedData.value.length, pageSize.value))

  const pagedData = computed(() =>
    paginateData(processedData.value, Math.min(page.value, numPages.value), pageSize.value),
  )

  const groupedData = computed(() => groupData(pagedData.value, groupBy.value))

  const activeColumns = computed(() =>
    columns.value.filter((c) => visibleCols.value.has(c.key) && !groupBy.value.includes(c.key)),
  )

  const activeFilterCount = computed(() => countActiveFilters(filters.value, rangeFilters.value))

  const selectedRows = computed(() => processedData.value.filter((r) => selection.value.has(r)))

  return {
    // Reactive state
    selection,
    visibleCols,
    sorts,
    filters,
    rangeFilters,
    groupBy,
    collapsedGroups,
    page,
    pageSize,
    searchQuery,
    // Computed
    selectedRows,
    processedData,
    pagedData,
    groupedData,
    activeColumns,
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
    toggleSort: (key: string) => {
      sorts.value = _toggleSort(sorts.value, key)
    },
    toggleFilter: (key: string, value: string) => {
      filters.value = _toggleFilter(filters.value, key, value)
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
    toggleRowSelection: (row: TRow) => {
      const next = new Set(selection.value)
      if (next.has(row)) next.delete(row)
      else next.add(row)
      selection.value = next
    },
    toggleSelectAll: (rows: TRow[]) => {
      const next = new Set(selection.value)
      const allSelected = rows.length > 0 && rows.every((r) => next.has(r))
      if (allSelected) rows.forEach((r) => next.delete(r))
      else rows.forEach((r) => next.add(r))
      selection.value = next
    },
    clearSelection: () => {
      selection.value = new Set()
    },
  }
}
