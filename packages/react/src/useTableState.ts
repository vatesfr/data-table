import { useState, useMemo } from 'react'
import {
  processData,
  searchData,
  groupData,
  sortWithinGroups,
  getVisibleRows,
  paginateVisibleGroups,
  paginateData,
  computeTotalPages,
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
  isRowSelected,
  getSelectedRows,
  toggleRowInSelection,
  toggleAllInSelection,
  reconcileSelection,
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
  type GetRowId,
} from '@vates/data-table-core'
import type { ColumnDef } from './types'

export interface UseTableStateOptions<TRow extends object = Record<string, unknown>> {
  defaultVisibleColumns?: string[]
  labels?: Partial<DataTableLabels>
  defaultPageSize?: number
  /** Whether newly-grouped groups start collapsed. Defaults to `true`; pass `false` to start expanded. */
  defaultGroupsCollapsed?: boolean
  /**
   * Opt-in row identity for selection. By default, selection tracks rows by object identity — a
   * refetch or re-map of `data` that produces new row objects (even with identical content)
   * silently drops selection, since a `Set` can only ever match by reference. Supplying `getRowId`
   * switches selection to match by id instead, so it survives that kind of refresh: whenever
   * `data` changes, currently-selected ids are looked up in the new array and remapped to their
   * fresh object references (an id no longer present is dropped from selection). Omit this to
   * keep today's exact default behavior.
   */
  getRowId?: GetRowId<TRow>
}

export type TableState<TRow extends object> = ReturnType<typeof useTableState<TRow>>

// True when both key lists contain exactly the same set of keys, ignoring order — a plain
// reorder of the same columns is not a "schema changed" event for the visibleCols reconciliation
// below, only a genuine addition/removal is.
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
    defaultVisibleColumns,
    labels: labelOverrides,
    defaultPageSize,
    defaultGroupsCollapsed = true,
    getRowId,
  } = options ?? {}
  const L = { ...DEFAULT_LABELS, ...labelOverrides }

  const [visibleCols, setVisibleCols] = useState<Set<string>>(
    () => new Set(defaultVisibleColumns ?? columns.map((c) => c.key)),
  )

  // Reconciles visibleCols whenever the `columns` argument itself changes to a different key
  // set across renders — comparing against the previous render (React's own documented pattern
  // for "adjust state when a prop changes", see the identical shape used for
  // filterListScrollTop in DataTableView.tsx) rather than an effect, avoiding both an extra
  // render and the react-hooks/set-state-in-effect lint error this project's config treats as
  // one. Without this, a `columns` prop swapped to a set with no overlap in the previous one
  // (e.g. a consumer keeping the same mounted <DataTable> but changing what kind of data it
  // shows) would leave every column filtered out as "not visible" — activeColumns below is
  // filtered by visibleCols — and the table would silently render with none at all. A column
  // that already existed keeps whatever visibility choice it had; a genuinely new column starts
  // visible by default, the same default this hook already uses with no defaultVisibleColumns
  // override — the same reconciliation @vates/data-table-solid's own `columns.set` needed, just
  // reached here via a changed argument instead of an explicit setter call.
  const columnKeys = columns.map((c) => c.key)
  const [prevColumnKeys, setPrevColumnKeys] = useState(columnKeys)
  if (!sameKeySet(prevColumnKeys, columnKeys)) {
    setPrevColumnKeys(columnKeys)
    const prevKeySet = new Set(prevColumnKeys)
    setVisibleCols((prevVisible) => {
      const next = new Set<string>()
      for (const key of columnKeys) {
        if (prevKeySet.has(key)) {
          if (prevVisible.has(key)) next.add(key)
        } else {
          next.add(key)
        }
      }
      return next
    })
  }

  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [sorts, setSorts] = useState<SortEntry[]>([])
  // `filters` (include) and `excludeFilters` — "not one of these values" for multi-value columns,
  // see `filter.cycleValue` — are combined into one state atom rather than two separate `useState`
  // calls: several actions (`filter.cycleValue`, the exclude-aware branch of `filter.toggleAll`)
  // need to read *both* current values together to decide the next state, and two independent
  // setters read from render-time closures — two such actions called synchronously before a
  // re-render (e.g. back-to-back in the same event handler) would each see the same stale pair.
  // One state atom means one updater always sees the latest committed value of both.
  const [filterState, setFilterState] = useState<{
    filters: Record<string, Set<string>>
    excludeFilters: Record<string, Set<string>>
  }>({ filters: {}, excludeFilters: {} })
  const { filters, excludeFilters } = filterState
  const [rangeFilters, setRangeFilters] = useState<Record<string, RangeFilter>>({})
  const [groupBy, setGroupBy] = useState<string[]>([])
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSizeState] = useState(defaultPageSize ?? 0)
  const [selection, setSelection] = useState<Set<TRow>>(new Set())
  const [selectionAnchor, setSelectionAnchor] = useState<TRow | null>(null)
  const [searchQuery, setSearchQueryState] = useState('')

  // Reconciles `selection`'s stored row references against a changed `data` argument, same
  // "adjust state when a prop changes" render-time pattern as visibleCols/columnKeys above —
  // only actually does anything when `getRowId` is set (reconcileSelection is a no-op passthrough
  // otherwise, so this is a zero-cost no-op for the default object-identity behavior).
  const [prevData, setPrevData] = useState(data)
  if (data !== prevData) {
    setPrevData(data)
    if (getRowId) setSelection((prev) => reconcileSelection(data, prev, getRowId))
  }

  const defaultSortDirFor = (key: string) =>
    columns.find((c) => c.key === key)?.defaultSortDir ?? 'asc'

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
        excludeFilters,
      ),
    [data, searchQuery, columns, filters, rangeFilters, sorts, L.emptyValue, excludeFilters],
  )

  // Grouping runs over the *full* filtered/sorted data, not a page's slice, so pagination (below)
  // can budget page size across header rows and data rows together instead of paginating data
  // rows first and grouping whatever lands on that page afterward — see "Pagination" in the docs.
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
        setColumnOrder((prev) =>
          _reorderColumn(prev.length ? prev : columns.map((c) => c.key), dragKey, targetKey, after),
        ),
      moveBy: (key: string, delta: number) =>
        setColumnOrder((prev) =>
          _moveColumnBy(prev.length ? prev : columns.map((c) => c.key), key, delta),
        ),
    },

    sort: {
      entries: sorts,
      toggle: (key: string) => setSorts((prev) => _toggleSort(prev, key, defaultSortDirFor(key))),
      replace: (key: string) => setSorts((prev) => _replaceSort(prev, key, defaultSortDirFor(key))),
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
      activeCount: activeFilterCount,
      valueMap: stringValueMap,
      toggleAll: (key: string, values: string[]) => {
        // The master checkbox's own checked/indeterminate state reflects `filters` only (no
        // visual concept of exclusion) — so only the "select all ON" branch should ever touch
        // `excludeFilters`, and only because it must: every listed value is about to become
        // included, and a value can't be in both sets at once (see `cycleValue`). The
        // "deselect all" branch leaves `excludeFilters` completely alone — it only clears values
        // the checkbox showed as selected, which by that same invariant can never include an
        // already-excluded value.
        setFilterState((prev) => {
          const willSelectAll = !values.some((v) => prev.filters[key]?.has(v))
          return {
            filters: _toggleFilterAll(prev.filters, key, values),
            excludeFilters: willSelectAll
              ? _clearExcludeValues(prev.excludeFilters, key, values)
              : prev.excludeFilters,
          }
        })
        setPageState(1)
      },
      setValues: (key: string, values: string[], selected: boolean) => {
        setFilterState((prev) => ({
          ...prev,
          filters: _setFilterValues(prev.filters, key, values, selected),
        }))
        setPageState(1)
      },
      // Cycles a single checklist value neutral → include → exclude → neutral. Shift-range
      // selection (`setValues` above) stays include-only by design — see the docs — so a caller
      // extending a range that should also clear a swept value's exclusion calls
      // `clearExcludeValues` alongside it, same as `toggleAll` above.
      cycleValue: (key: string, value: string) => {
        setFilterState((prev) => _cycleFilterValue(prev.filters, prev.excludeFilters, key, value))
        setPageState(1)
      },
      clearExcludeValues: (key: string, values: string[]) => {
        setFilterState((prev) => ({
          ...prev,
          excludeFilters: _clearExcludeValues(prev.excludeFilters, key, values),
        }))
      },
      setRange: (key: string, field: 'min' | 'max', value: string) => {
        setRangeFilters((prev) => ({
          ...prev,
          [key]: { min: prev[key]?.min ?? '', max: prev[key]?.max ?? '', [field]: value },
        }))
        setPageState(1)
      },
      // A column can carry an include set, an exclude set, and a range filter all at once (a date
      // column, or any multi-value column with both an include and an exclude selection) — `kind`
      // says which one to clear, so removing one doesn't silently drop the others too. This used
      // to be a single unconditional "full per-column reset" (clearing every kind together),
      // which read as an acceptable simplification back when a column could carry at most an
      // include set *or* a range filter as alternatives — but once include/exclude became two
      // states a column can hold at once, that stopped reading as a reset and started reading as
      // a bug: removing one active-bar chip silently cleared a sibling chip on the same column too.
      clearColumn: (key: string, kind: 'include' | 'exclude' | 'range' = 'include') => {
        if (kind === 'exclude')
          setFilterState((prev) => ({
            ...prev,
            excludeFilters: { ...prev.excludeFilters, [key]: new Set() },
          }))
        else if (kind === 'range')
          setRangeFilters((prev) => ({ ...prev, [key]: { min: '', max: '' } }))
        else setFilterState((prev) => ({ ...prev, filters: { ...prev.filters, [key]: new Set() } }))
        setPageState(1)
      },
      clear: () => {
        setFilterState({ filters: {}, excludeFilters: {} })
        setRangeFilters({})
        setPageState(1)
      },
    },

    group: {
      by: groupBy,
      collapsed: collapsedGroups,
      defaultCollapsed: defaultGroupsCollapsed,
      toggle: (key: string) => setGroupBy((prev) => toggleGroupBy(prev, key)),
      remove: (key: string) => setGroupBy((prev) => prev.filter((k) => k !== key)),
      moveBy: (key: string, delta: number) => setGroupBy((prev) => _moveColumnBy(prev, key, delta)),
      move: (dragKey: string, targetKey: string, after = false) =>
        setGroupBy((prev) => _reorderColumn(prev, dragKey, targetKey, after)),
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
        setSelection((prev) => {
          if (shiftKey && selectionAnchor) {
            const next = new Set(prev)
            const shouldSelect = !isRowSelected(next, row, getRowId)
            const range = selectRange(processedData, selectionAnchor, row)
            if (shouldSelect) range.forEach((r) => next.add(r))
            else range.forEach((r) => next.delete(r))
            return next
          }
          return toggleRowInSelection(prev, row, getRowId)
        })
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
        if (!Number.isFinite(p)) return
        setPageState(Math.max(1, Math.min(Math.floor(p), numPages)))
      },
      setPageSize: (s: number) => {
        if (!Number.isFinite(s)) return
        setPageSizeState(Math.max(0, Math.floor(s)))
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

    clearAll: () => {
      setSorts([])
      setFilterState({ filters: {}, excludeFilters: {} })
      setRangeFilters({})
      setGroupBy([])
      setCollapsedGroups(new Set())
      setPageState(1)
      setSearchQueryState('')
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
      setFilterState({
        filters: Object.fromEntries(
          Object.entries(view.filters ?? {}).map(([k, v]) => [k, new Set(v)]),
        ),
        excludeFilters: Object.fromEntries(
          Object.entries(view.excludeFilters ?? {}).map(([k, v]) => [k, new Set(v)]),
        ),
      })
      setRangeFilters(view.rangeFilters ?? {})
      setGroupBy(view.groupBy ?? [])
      setCollapsedGroups(new Set(view.collapsedGroups ?? []))
      setPageState(view.page ?? 1)
      setPageSizeState(view.pageSize ?? defaultPageSize ?? 0)
      setSearchQueryState(view.searchQuery ?? '')
    },
  }
}
