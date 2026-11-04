import { ref, shallowRef, computed, toValue, watch, type MaybeRefOrGetter } from 'vue'
import {
  filterData,
  sortData,
  searchData,
  buildSearchIndex,
  groupData,
  sortWithinGroups,
  getVisibleRows,
  paginateVisibleGroups,
  paginateData,
  computeTotalPages,
  toggleSort as _toggleSort,
  replaceSort as _replaceSort,
  appendOrToggleSort as _appendOrToggleSort,
  getDefaultSortDir,
  moveSortBy as _moveSortBy,
  reorderSort as _reorderSort,
  toggleSortDir as _toggleSortDir,
  toggleAllFilterState,
  setFilterValues as _setFilterValues,
  cycleFilterValue as _cycleFilterValue,
  clearExcludeValues as _clearExcludeValues,
  toggleExcludeAll as _toggleExcludeAll,
  setFilterMode as _setFilterMode,
  getSelectedRows,
  toggleSelectionShiftAware,
  toggleAllInSelection,
  reconcileSelection,
  toggleGroupBy,
  insertGroupSort,
  reorderGroupSorts,
  toggleCollapse,
  getOrderedColumns,
  reconcileVisibleColumns,
  reorderColumn as _reorderColumn,
  moveColumnBy as _moveColumnBy,
  moveVisibleColumnBy as _moveVisibleColumnBy,
  getSortIcon as _getSortIcon,
  getSortIndex as _getSortIndex,
  countActiveFilters,
  buildViewStateSnapshot,
  resolveViewState,
  clampInt,
  resolveFocusTarget,
  type VisibleItem,
} from '@vates/data-table-core/internal'
import {
  DEFAULT_LABELS,
  type SortEntry,
  type RangeFilter,
  type DataTableLabels,
  type TableViewState,
  type GetRowId,
} from '@vates/data-table-core'
import type { ColumnDef } from './types'

export interface UseTableStateOptions<TRow extends object = Record<string, unknown>> {
  labels?: Partial<DataTableLabels>
  /** Whether newly-grouped groups start collapsed. Defaults to `true`; pass `false` to start expanded. */
  defaultGroupsCollapsed?: boolean
  /**
   * The view a fresh table starts at and `resetView` restores; unset fields take their empty
   * default. A grouped column gets a matching sort entry, as interactive grouping does. Read once.
   */
  initialViewState?: TableViewState
  /**
   * Opt-in row identity for selection, which otherwise tracks row objects and so drops rows
   * replaced by a refetch. With it, selected ids are remapped to the new `data`'s rows (missing
   * ones dropped).
   */
  getRowId?: GetRowId<TRow>
}

export type TableState<TRow extends object> = ReturnType<typeof useTableState<TRow>>

export function useTableState<TRow extends object>(
  getData: MaybeRefOrGetter<TRow[]>,
  getColumns: MaybeRefOrGetter<ColumnDef<TRow>[]>,
  getOptions?: MaybeRefOrGetter<UseTableStateOptions<TRow>>,
) {
  const data = computed(() => toValue(getData))
  const columns = computed(() => toValue(getColumns))
  const options = computed(() => toValue(getOptions) ?? {})

  const L = computed(() => ({ ...DEFAULT_LABELS, ...options.value.labels }))
  const defaultGroupsCollapsed = computed(() => options.value.defaultGroupsCollapsed ?? true)
  const getRowId = computed(() => options.value.getRowId)

  const defaultSortDirFor = (key: string) => getDefaultSortDir(columns.value, key)

  // Seed-only, from the same `resolveViewState({}, …)` a reset uses
  const initial = resolveViewState({}, columns.value, options.value.initialViewState)

  // shallowRef throughout: every write replaces the value, so deep reactivity would be wasted
  const visibleCols = shallowRef<Set<string>>(initial.visibleCols)

  // A changed column key set reconciles visibleCols (docs/table-state.md); lazy, so not on the seed
  watch(columns, (nextColumns, prevColumns) => {
    visibleCols.value = reconcileVisibleColumns(prevColumns, nextColumns, visibleCols.value)
  })

  const columnOrder = shallowRef<string[]>(initial.columnOrder)
  const sorts = shallowRef<SortEntry[]>(initial.sorts)
  const filters = shallowRef<Record<string, Set<string>>>(initial.filters)
  // Mutually exclusive with `filters`
  const excludeFilters = shallowRef<Record<string, Set<string>>>(initial.excludeFilters)
  // Per-column override of `col.multiMode`
  const filterModes = shallowRef<Record<string, 'and' | 'or'>>(initial.filterModes)
  const rangeFilters = shallowRef<Record<string, RangeFilter>>(initial.rangeFilters)
  const groupBy = shallowRef<string[]>(initial.groupBy)
  const collapsedGroups = shallowRef<Set<string>>(initial.collapsedGroups)
  const page = ref(initial.page)
  const pageSize = ref(initial.pageSize)
  const selection = shallowRef<Set<TRow>>(new Set())
  const selectionAnchor = shallowRef<TRow | null>(null)
  const searchQuery = ref(initial.searchQuery)
  // Roving-tabindex item, lifted here for `focus.moveTo` (docs/keyboard-navigation.md's "External row focus")
  const focusTarget = shallowRef<VisibleItem<TRow> | null>(null)
  // Set by `moveTo(row, { focus: true })`, consumed by DataTableView once the row mounts, as only it holds row refs
  let wantsDomFocus = false

  // Remaps selection to a changed `data` (only with `getRowId`)
  watch(data, (nextData) => {
    if (getRowId.value)
      selection.value = reconcileSelection(nextData, selection.value, getRowId.value)
  })

  // Sorted apart from search/filters so a keystroke or filter click never re-sorts (see `sortData`)
  const sortedData = computed(() => sortData(data.value, sorts.value, columns.value))

  // Built on the first keystroke, then reused until data or columns change; none while not searching.
  const searching = computed(() => searchQuery.value !== '')
  const searchIndex = computed(() =>
    searching.value ? buildSearchIndex(data.value, columns.value) : null,
  )
  // Apart from filters, so a filter click doesn't re-run the search over every row
  const searchedData = computed(() =>
    searchIndex.value
      ? searchData(sortedData.value, searchQuery.value, searchIndex.value)
      : sortedData.value,
  )

  const processedData = computed(() =>
    filterData(
      searchedData.value,
      filters.value,
      rangeFilters.value,
      columns.value,
      L.value.emptyValue,
      excludeFilters.value,
      filterModes.value,
    ),
  )

  // Grouped over all rows, so pages budget header and data rows together (docs/pagination.md)
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

  const numPages = computed(() => computeTotalPages(visibleItems.value.length, pageSize.value))

  const clampedPage = computed(() => Math.min(page.value, numPages.value))

  const pagedData = computed(() =>
    paginateData(visibleItems.value, clampedPage.value, pageSize.value)
      .filter((item) => item.kind === 'row')
      .map((item) => item.row),
  )

  const groupedData = computed(() =>
    paginateVisibleGroups(groupedFull.value, visibleItems.value, clampedPage.value, pageSize.value),
  )

  const activeColumns = computed(() =>
    getOrderedColumns(columns.value, columnOrder.value).filter(
      (c) =>
        visibleCols.value.has(c.key) &&
        (!groupBy.value.includes(c.key) || c.keepVisibleWhenGrouped === true),
    ),
  )

  const orderedColumns = computed(() => getOrderedColumns(columns.value, columnOrder.value))

  const activeFilterCount = computed(() =>
    countActiveFilters(filters.value, rangeFilters.value, excludeFilters.value),
  )

  const selectedRows = computed(() =>
    getSelectedRows(processedData.value, selection.value, getRowId.value),
  )

  return {
    // Top-level: the pipeline's actual output, not a "concern" of its own
    processedData,
    pagedData,
    groupedData,
    visibleItems,
    labels: L,

    columns: {
      visible: visibleCols,
      active: activeColumns,
      ordered: orderedColumns,
      toggleVisibility: (key: string) => {
        const next = new Set(visibleCols.value)
        if (next.has(key)) {
          if (next.size > 1) next.delete(key)
        } else next.add(key)
        visibleCols.value = next
      },
      move: (dragKey: string, targetKey: string, after = false) => {
        const base = columnOrder.value.length ? columnOrder.value : columns.value.map((c) => c.key)
        columnOrder.value = _reorderColumn(base, dragKey, targetKey, after)
      },
      moveBy: (key: string, delta: number) => {
        const base = columnOrder.value.length ? columnOrder.value : columns.value.map((c) => c.key)
        columnOrder.value = _moveColumnBy(base, key, delta)
      },
      // Alt+↑/↓ in Visible columns: skips hidden columns, and those outside `eligible` (the search matches)
      moveVisibleBy: (key: string, delta: number, eligible?: ReadonlySet<string>) => {
        const base = columnOrder.value.length ? columnOrder.value : columns.value.map((c) => c.key)
        columnOrder.value = _moveVisibleColumnBy(base, eligible ?? visibleCols.value, key, delta)
      },
    },

    sort: {
      entries: sorts,
      toggle: (key: string) => {
        sorts.value = _toggleSort(sorts.value, key, defaultSortDirFor(key))
      },
      replace: (key: string) => {
        sorts.value = _replaceSort(sorts.value, key, defaultSortDirFor(key), groupBy.value)
      },
      appendOrToggle: (key: string) => {
        sorts.value = _appendOrToggleSort(sorts.value, key, defaultSortDirFor(key))
      },
      remove: (key: string) => {
        sorts.value = sorts.value.filter((s) => s.key !== key)
      },
      toggleDir: (key: string) => {
        sorts.value = sorts.value.map((s) =>
          s.key === key ? { ...s, dir: _toggleSortDir(s.dir) } : s,
        )
      },
      moveBy: (key: string, delta: number) => {
        sorts.value = _moveSortBy(sorts.value, key, delta)
      },
      move: (dragKey: string, targetKey: string, after = false) => {
        sorts.value = _reorderSort(sorts.value, dragKey, targetKey, after)
      },
      clear: () => {
        sorts.value = []
      },
      icon: (key: string) => _getSortIcon(sorts.value, key),
      index: (key: string) => _getSortIndex(sorts.value, key),
    },

    filter: {
      include: filters,
      exclude: excludeFilters,
      ranges: rangeFilters,
      modes: filterModes,
      activeCount: activeFilterCount,
      setMode: (key: string, mode: 'and' | 'or') => {
        filterModes.value = _setFilterMode(filterModes.value, key, mode)
      },
      toggleAll: (key: string, values: string[]) => {
        // Only selecting all touches `excludeFilters` (a value can't be in both sets)
        const next = toggleAllFilterState(filters.value, excludeFilters.value, key, values)
        filters.value = next.filters
        excludeFilters.value = next.excludeFilters
        page.value = 1
      },
      setValues: (key: string, values: string[], selected: boolean) => {
        filters.value = _setFilterValues(filters.value, key, values, selected)
        page.value = 1
      },
      // Neutral → include → exclude → neutral; shift-range stays include-only
      cycleValue: (key: string, value: string) => {
        const next = _cycleFilterValue(filters.value, excludeFilters.value, key, value)
        filters.value = next.filters
        excludeFilters.value = next.excludeFilters
        page.value = 1
      },
      clearExcludeValues: (key: string, values: string[]) => {
        excludeFilters.value = _clearExcludeValues(excludeFilters.value, key, values)
      },
      // Exclude-only checklist of a non-multi-value column (docs/filter-dropdown.md)
      setExcludeValues: (key: string, values: string[], excluded: boolean) => {
        excludeFilters.value = _setFilterValues(excludeFilters.value, key, values, excluded)
        page.value = 1
      },
      toggleExcludeAll: (key: string, values: string[]) => {
        excludeFilters.value = _toggleExcludeAll(excludeFilters.value, key, values)
        page.value = 1
      },
      setRange: (key: string, field: 'min' | 'max', value: string) => {
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
      // A column can hold include, exclude and range filters at once: `kind` clears one, none clears all
      clearColumn: (key: string, kind?: 'include' | 'exclude' | 'range') => {
        if (!kind || kind === 'include') filters.value = { ...filters.value, [key]: new Set() }
        if (!kind || kind === 'exclude')
          excludeFilters.value = { ...excludeFilters.value, [key]: new Set() }
        if (!kind || kind === 'range')
          rangeFilters.value = { ...rangeFilters.value, [key]: { min: '', max: '' } }
        page.value = 1
      },
      clear: () => {
        filters.value = {}
        excludeFilters.value = {}
        filterModes.value = {}
        rangeFilters.value = {}
        page.value = 1
      },
    },

    group: {
      by: groupBy,
      collapsed: collapsedGroups,
      defaultCollapsed: defaultGroupsCollapsed,
      toggle: (key: string) => {
        const prev = groupBy.value
        if (!prev.includes(key)) {
          sorts.value = insertGroupSort(sorts.value, prev, key, defaultSortDirFor(key))
        }
        groupBy.value = toggleGroupBy(prev, key)
      },
      remove: (key: string) => {
        groupBy.value = groupBy.value.filter((k) => k !== key)
      },
      moveBy: (key: string, delta: number) => {
        groupBy.value = _moveColumnBy(groupBy.value, key, delta)
        sorts.value = reorderGroupSorts(sorts.value, groupBy.value)
      },
      move: (dragKey: string, targetKey: string, after = false) => {
        groupBy.value = _reorderColumn(groupBy.value, dragKey, targetKey, after)
        sorts.value = reorderGroupSorts(sorts.value, groupBy.value)
      },
      toggleCollapse: (key: string) => {
        collapsedGroups.value = toggleCollapse(collapsedGroups.value, key)
      },
      clear: () => {
        groupBy.value = []
        collapsedGroups.value = new Set()
      },
    },

    selection: {
      all: selection,
      rows: selectedRows,
      toggle: (row: TRow, shiftKey = false) => {
        selection.value = toggleSelectionShiftAware(
          selection.value,
          row,
          shiftKey,
          selectionAnchor.value,
          processedData.value,
          getRowId.value,
        )
        selectionAnchor.value = row
      },
      toggleAll: (rows: TRow[]) => {
        selection.value = toggleAllInSelection(selection.value, rows, getRowId.value)
      },
      clear: () => {
        selection.value = new Set()
        selectionAnchor.value = null
      },
    },

    pagination: {
      page: clampedPage,
      pageSize,
      numPages,
      setPage: (p: number) => {
        const next = clampInt(p, 1, numPages.value)
        if (next !== undefined) page.value = next
      },
      setPageSize: (s: number) => {
        const next = clampInt(s, 0)
        if (next === undefined) return
        pageSize.value = next
        page.value = 1
      },
    },

    search: {
      query: searchQuery,
      setQuery: (q: string) => {
        searchQuery.value = q
        page.value = 1
      },
    },

    focus: {
      target: focusTarget,
      row: computed(() => (focusTarget.value?.kind === 'row' ? focusTarget.value.row : null)),
      setTarget: (item: VisibleItem<TRow> | null) => {
        wantsDomFocus = false
        focusTarget.value = item
      },
      // Reveals `row` as the roving target (expands groups, jumps page); real focus only with `{ focus: true }`
      moveTo: (row: TRow, options?: { focus?: boolean }) => {
        const resolved = resolveFocusTarget(
          groupedFull.value,
          row,
          collapsedGroups.value,
          defaultGroupsCollapsed.value,
          pageSize.value,
        )
        if (!resolved) return
        collapsedGroups.value = resolved.collapsedGroups
        page.value = resolved.page
        wantsDomFocus = options?.focus === true
        focusTarget.value = resolved.item
      },
      // Internal: DataTableView's focus watcher
      consumeDomFocus: () => {
        const wanted = wantsDomFocus
        wantsDomFocus = false
        return wanted
      },
    },

    clearAll: () => {
      sorts.value = []
      filters.value = {}
      excludeFilters.value = {}
      filterModes.value = {}
      rangeFilters.value = {}
      groupBy.value = []
      collapsedGroups.value = new Set()
      page.value = 1
      searchQuery.value = ''
    },

    getViewState: (): TableViewState =>
      buildViewStateSnapshot({
        visibleCols: visibleCols.value,
        columnOrder: columnOrder.value,
        sorts: sorts.value,
        filters: filters.value,
        excludeFilters: excludeFilters.value,
        filterModes: filterModes.value,
        rangeFilters: rangeFilters.value,
        groupBy: groupBy.value,
        collapsedGroups: collapsedGroups.value,
        page: page.value,
        pageSize: pageSize.value,
        searchQuery: searchQuery.value,
        columns: columns.value,
        initialViewState: options.value.initialViewState,
      }),
    setViewState: (view: TableViewState) => {
      const resolved = resolveViewState(view, columns.value, options.value.initialViewState)
      visibleCols.value = resolved.visibleCols
      columnOrder.value = resolved.columnOrder
      sorts.value = resolved.sorts
      filters.value = resolved.filters
      excludeFilters.value = resolved.excludeFilters
      filterModes.value = resolved.filterModes
      rangeFilters.value = resolved.rangeFilters
      groupBy.value = resolved.groupBy
      collapsedGroups.value = resolved.collapsedGroups
      page.value = resolved.page
      pageSize.value = resolved.pageSize
      searchQuery.value = resolved.searchQuery
    },
  }
}
