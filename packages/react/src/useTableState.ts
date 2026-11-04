import { useState, useMemo, useRef, useCallback } from 'react'
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
  resolveFocusTarget,
  type VisibleItem,
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
  reorderColumn as _reorderColumn,
  moveColumnBy as _moveColumnBy,
  moveVisibleColumnBy as _moveVisibleColumnBy,
  reconcileVisibleColumns,
  getSortIcon as _getSortIcon,
  getSortIndex as _getSortIndex,
  countActiveFilters,
  buildViewStateSnapshot,
  resolveViewState,
  clampInt,
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
   * default. A grouped column gets a matching sort entry, as interactive grouping does.
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

// Same keys in any order: a reorder isn't a column set change
function sameKeySet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((key) => set.has(key))
}

export function useTableState<TRow extends object>(
  data: TRow[],
  columns: ColumnDef<TRow>[],
  options?: UseTableStateOptions<TRow>,
) {
  const {
    labels: labelOverrides,
    defaultGroupsCollapsed = true,
    initialViewState,
    getRowId,
  } = options ?? {}
  const L = { ...DEFAULT_LABELS, ...labelOverrides }

  // Seed-only, from the same `resolveViewState({}, …)` a reset uses
  const [initial] = useState(() => resolveViewState({}, columns, initialViewState))

  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => initial.visibleCols)

  // A changed column key set reconciles visibleCols (docs/table-state.md), render-time rather than an effect
  const columnKeys = columns.map((c) => c.key)
  const [prevColumns, setPrevColumns] = useState(columns)
  if (
    !sameKeySet(
      prevColumns.map((c) => c.key),
      columnKeys,
    )
  ) {
    const prevColumnsForReconcile = prevColumns
    setPrevColumns(columns)
    setVisibleCols((prevVisible) =>
      reconcileVisibleColumns(prevColumnsForReconcile, columns, prevVisible),
    )
  }

  const [columnOrder, setColumnOrder] = useState<string[]>(() => initial.columnOrder)
  const [sorts, setSorts] = useState<SortEntry[]>(() => initial.sorts)
  // One atom: actions read both include and exclude sets, and separate setters would see stale pairs
  const [filterState, setFilterState] = useState<{
    filters: Record<string, Set<string>>
    excludeFilters: Record<string, Set<string>>
  }>(() => ({ filters: initial.filters, excludeFilters: initial.excludeFilters }))
  const { filters, excludeFilters } = filterState
  // Per-column override of `col.multiMode`; no action reads it with `filterState`
  const [filterModes, setFilterModes] = useState<Record<string, 'and' | 'or'>>(
    () => initial.filterModes,
  )
  const [rangeFilters, setRangeFilters] = useState<Record<string, RangeFilter>>(
    () => initial.rangeFilters,
  )
  const [groupBy, setGroupBy] = useState<string[]>(() => initial.groupBy)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => initial.collapsedGroups)
  const [page, setPageState] = useState(() => initial.page)
  const [pageSize, setPageSizeState] = useState(() => initial.pageSize)
  const [selection, setSelection] = useState<Set<TRow>>(new Set())
  const [selectionAnchor, setSelectionAnchor] = useState<TRow | null>(null)
  const [searchQuery, setSearchQueryState] = useState(() => initial.searchQuery)
  // Roving-tabindex item, lifted here for `focus.moveTo` (docs/keyboard-navigation.md's "External row focus")
  const [focusTarget, setFocusTarget] = useState<VisibleItem<TRow> | null>(null)
  // Set by `moveTo(row, { focus: true })`, consumed by DataTableView once the row mounts, as only it holds row refs
  const wantsDomFocusRef = useRef(false)
  // Stable identity so DataTableView's scroll/focus effect can list it as a dependency.
  const consumeDomFocus = useCallback(() => {
    const wanted = wantsDomFocusRef.current
    wantsDomFocusRef.current = false
    return wanted
  }, [])

  // Remaps selection to a changed `data` (only with `getRowId`)
  const [prevData, setPrevData] = useState(data)
  if (data !== prevData) {
    setPrevData(data)
    if (getRowId) setSelection((prev) => reconcileSelection(data, prev, getRowId))
  }

  const defaultSortDirFor = (key: string) => getDefaultSortDir(columns, key)

  // Sorted apart from search/filters so a keystroke or filter click never re-sorts (see `sortData`)
  const sortedData = useMemo(() => sortData(data, sorts, columns), [data, sorts, columns])

  // Built on the first keystroke, then reused until data or columns change; none while not searching.
  const searching = searchQuery !== ''
  const searchIndex = useMemo(
    () => (searching ? buildSearchIndex(data, columns) : null),
    [searching, data, columns],
  )
  // Apart from filters, so a filter click doesn't re-run the search over every row
  const searchedData = useMemo(
    () => (searchIndex ? searchData(sortedData, searchQuery, searchIndex) : sortedData),
    [sortedData, searchQuery, searchIndex],
  )

  const processedData = useMemo(
    () =>
      filterData(
        searchedData,
        filters,
        rangeFilters,
        columns,
        L.emptyValue,
        excludeFilters,
        filterModes,
      ),
    [searchedData, columns, filters, rangeFilters, L.emptyValue, excludeFilters, filterModes],
  )

  // Grouped over all rows, so pages budget header and data rows together (docs/pagination.md)
  const groupedFull = useMemo(
    () =>
      sortWithinGroups(
        groupData(processedData, groupBy, columns, L.emptyValue),
        sorts,
        groupBy,
        columns,
      ),
    [processedData, groupBy, columns, L.emptyValue, sorts],
  )

  const visibleItems = useMemo(
    () => getVisibleRows(groupedFull, collapsedGroups, defaultGroupsCollapsed),
    [groupedFull, collapsedGroups, defaultGroupsCollapsed],
  )

  const numPages = useMemo(
    () => computeTotalPages(visibleItems.length, pageSize),
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
    () => paginateVisibleGroups(groupedFull, visibleItems, clampedPage, pageSize),
    [groupedFull, visibleItems, clampedPage, pageSize],
  )

  const activeColumns = useMemo(
    () =>
      getOrderedColumns(columns, columnOrder).filter(
        (c) =>
          visibleCols.has(c.key) && (!groupBy.includes(c.key) || c.keepVisibleWhenGrouped === true),
      ),
    [columns, columnOrder, visibleCols, groupBy],
  )

  const orderedColumns = useMemo(
    () => getOrderedColumns(columns, columnOrder),
    [columns, columnOrder],
  )

  const activeFilterCount = useMemo(
    () => countActiveFilters(filters, rangeFilters, excludeFilters),
    [filters, rangeFilters, excludeFilters],
  )

  const selectedRows = useMemo(
    () => getSelectedRows(processedData, selection, getRowId),
    [processedData, selection, getRowId],
  )

  // An empty columnOrder means "declaration order"
  const fullOrder = (prev: string[]) => (prev.length ? prev : columnKeys)
  const setExclude = (update: (prev: Record<string, Set<string>>) => Record<string, Set<string>>) =>
    setFilterState((prev) => ({ ...prev, excludeFilters: update(prev.excludeFilters) }))
  const clearFilters = () => {
    setFilterState({ filters: {}, excludeFilters: {} })
    setFilterModes({})
    setRangeFilters({})
    setPageState(1)
  }
  // Group nesting order drives the group sorts' order
  const reorderGroups = (update: (prev: string[]) => string[]) =>
    setGroupBy((prev) => {
      const next = update(prev)
      setSorts((prevSorts) => reorderGroupSorts(prevSorts, next))
      return next
    })

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
      toggleVisibility: (key: string) =>
        setVisibleCols((prev) => {
          const next = new Set(prev)
          if (next.has(key)) {
            if (next.size > 1) next.delete(key)
          } else next.add(key)
          return next
        }),
      move: (dragKey: string, targetKey: string, after = false) =>
        setColumnOrder((prev) => _reorderColumn(fullOrder(prev), dragKey, targetKey, after)),
      moveBy: (key: string, delta: number) =>
        setColumnOrder((prev) => _moveColumnBy(fullOrder(prev), key, delta)),
      // Alt+↑/↓ in Visible columns: skips hidden columns, and those outside `eligible` (the search matches)
      moveVisibleBy: (key: string, delta: number, eligible?: ReadonlySet<string>) =>
        setColumnOrder((prev) =>
          _moveVisibleColumnBy(fullOrder(prev), eligible ?? visibleCols, key, delta),
        ),
    },

    sort: {
      entries: sorts,
      toggle: (key: string) => setSorts((prev) => _toggleSort(prev, key, defaultSortDirFor(key))),
      replace: (key: string) =>
        setSorts((prev) => _replaceSort(prev, key, defaultSortDirFor(key), groupBy)),
      appendOrToggle: (key: string) =>
        setSorts((prev) => _appendOrToggleSort(prev, key, defaultSortDirFor(key))),
      remove: (key: string) => setSorts((prev) => prev.filter((s) => s.key !== key)),
      toggleDir: (key: string) =>
        setSorts((prev) =>
          prev.map((s) => (s.key === key ? { ...s, dir: _toggleSortDir(s.dir) } : s)),
        ),
      moveBy: (key: string, delta: number) => setSorts((prev) => _moveSortBy(prev, key, delta)),
      move: (dragKey: string, targetKey: string, after = false) =>
        setSorts((prev) => _reorderSort(prev, dragKey, targetKey, after)),
      clear: () => setSorts([]),
      icon: (key: string) => _getSortIcon(sorts, key),
      index: (key: string) => _getSortIndex(sorts, key),
    },

    filter: {
      include: filters,
      exclude: excludeFilters,
      ranges: rangeFilters,
      modes: filterModes,
      activeCount: activeFilterCount,
      setMode: (key: string, mode: 'and' | 'or') =>
        setFilterModes((prev) => _setFilterMode(prev, key, mode)),
      toggleAll: (key: string, values: string[]) => {
        // Only selecting all touches `excludeFilters` (a value can't be in both sets)
        setFilterState((prev) =>
          toggleAllFilterState(prev.filters, prev.excludeFilters, key, values),
        )
        setPageState(1)
      },
      setValues: (key: string, values: string[], selected: boolean) => {
        setFilterState((prev) => ({
          ...prev,
          filters: _setFilterValues(prev.filters, key, values, selected),
        }))
        setPageState(1)
      },
      // Neutral → include → exclude → neutral; shift-range stays include-only
      cycleValue: (key: string, value: string) => {
        setFilterState((prev) => _cycleFilterValue(prev.filters, prev.excludeFilters, key, value))
        setPageState(1)
      },
      clearExcludeValues: (key: string, values: string[]) => {
        setExclude((prev) => _clearExcludeValues(prev, key, values))
      },
      // Exclude-only checklist of a non-multi-value column (docs/filter-dropdown.md)
      setExcludeValues: (key: string, values: string[], excluded: boolean) => {
        setExclude((prev) => _setFilterValues(prev, key, values, excluded))
        setPageState(1)
      },
      toggleExcludeAll: (key: string, values: string[]) => {
        setExclude((prev) => _toggleExcludeAll(prev, key, values))
        setPageState(1)
      },
      setRange: (key: string, field: 'min' | 'max', value: string) => {
        setRangeFilters((prev) => ({
          ...prev,
          [key]: { min: prev[key]?.min ?? '', max: prev[key]?.max ?? '', [field]: value },
        }))
        setPageState(1)
      },
      // A column can hold include, exclude and range filters at once: `kind` clears one, none clears all
      clearColumn: (key: string, kind?: 'include' | 'exclude' | 'range') => {
        if (!kind || kind === 'include')
          setFilterState((prev) => ({ ...prev, filters: { ...prev.filters, [key]: new Set() } }))
        if (!kind || kind === 'exclude') setExclude((prev) => ({ ...prev, [key]: new Set() }))
        if (!kind || kind === 'range')
          setRangeFilters((prev) => ({ ...prev, [key]: { min: '', max: '' } }))
        setPageState(1)
      },
      clear: clearFilters,
    },

    group: {
      by: groupBy,
      collapsed: collapsedGroups,
      defaultCollapsed: defaultGroupsCollapsed,
      toggle: (key: string) =>
        setGroupBy((prev) => {
          if (!prev.includes(key)) {
            setSorts((prevSorts) => insertGroupSort(prevSorts, prev, key, defaultSortDirFor(key)))
          }
          return toggleGroupBy(prev, key)
        }),
      remove: (key: string) => setGroupBy((prev) => prev.filter((k) => k !== key)),
      moveBy: (key: string, delta: number) =>
        reorderGroups((prev) => _moveColumnBy(prev, key, delta)),
      move: (dragKey: string, targetKey: string, after = false) =>
        reorderGroups((prev) => _reorderColumn(prev, dragKey, targetKey, after)),
      toggleCollapse: (key: string) => setCollapsedGroups((prev) => toggleCollapse(prev, key)),
      clear: () => {
        setGroupBy([])
        setCollapsedGroups(new Set())
      },
    },

    selection: {
      all: selection,
      rows: selectedRows,
      toggle: (row: TRow, shiftKey = false) => {
        setSelection((prev) =>
          toggleSelectionShiftAware(prev, row, shiftKey, selectionAnchor, processedData, getRowId),
        )
        setSelectionAnchor(row)
      },
      toggleAll: (rows: TRow[]) =>
        setSelection((prev) => toggleAllInSelection(prev, rows, getRowId)),
      clear: () => {
        setSelection(new Set())
        setSelectionAnchor(null)
      },
    },

    pagination: {
      page: clampedPage,
      pageSize,
      numPages,
      setPage: (p: number) => {
        const next = clampInt(p, 1, numPages)
        if (next !== undefined) setPageState(next)
      },
      setPageSize: (s: number) => {
        const next = clampInt(s, 0)
        if (next === undefined) return
        setPageSizeState(next)
        setPageState(1)
      },
    },

    search: {
      query: searchQuery,
      setQuery: (q: string) => {
        setSearchQueryState(q)
        setPageState(1)
      },
    },

    focus: {
      target: focusTarget,
      row: focusTarget?.kind === 'row' ? focusTarget.row : null,
      setTarget: (item: VisibleItem<TRow> | null) => {
        wantsDomFocusRef.current = false
        setFocusTarget(item)
      },
      // Reveals `row` as the roving target (expands groups, jumps page); real focus only with `{ focus: true }`
      moveTo: (row: TRow, options?: { focus?: boolean }) => {
        const resolved = resolveFocusTarget(
          groupedFull,
          row,
          collapsedGroups,
          defaultGroupsCollapsed,
          pageSize,
        )
        if (!resolved) return
        setCollapsedGroups(resolved.collapsedGroups)
        setPageState(resolved.page)
        wantsDomFocusRef.current = options?.focus === true
        setFocusTarget(resolved.item)
      },
      // Internal: DataTableView's focus effect
      consumeDomFocus,
    },

    clearAll: () => {
      setSorts([])
      clearFilters()
      setGroupBy([])
      setCollapsedGroups(new Set())
      setSearchQueryState('')
    },

    getViewState: (): TableViewState =>
      buildViewStateSnapshot({
        visibleCols,
        columnOrder,
        sorts,
        filters,
        excludeFilters,
        filterModes,
        rangeFilters,
        groupBy,
        collapsedGroups,
        page,
        pageSize,
        searchQuery,
        columns,
        initialViewState,
      }),
    setViewState: (view: TableViewState) => {
      const resolved = resolveViewState(view, columns, initialViewState)
      setVisibleCols(resolved.visibleCols)
      setColumnOrder(resolved.columnOrder)
      setSorts(resolved.sorts)
      setFilterState({ filters: resolved.filters, excludeFilters: resolved.excludeFilters })
      setFilterModes(resolved.filterModes)
      setRangeFilters(resolved.rangeFilters)
      setGroupBy(resolved.groupBy)
      setCollapsedGroups(resolved.collapsedGroups)
      setPageState(resolved.page)
      setPageSizeState(resolved.pageSize)
      setSearchQueryState(resolved.searchQuery)
    },
  }
}
