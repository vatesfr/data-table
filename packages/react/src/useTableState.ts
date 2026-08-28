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
  getDefaultSortDir,
  moveSortBy as _moveSortBy,
  reorderSort as _reorderSort,
  toggleSortDir as _toggleSortDir,
  toggleAllFilterState,
  setFilterValues as _setFilterValues,
  cycleFilterValue as _cycleFilterValue,
  clearExcludeValues as _clearExcludeValues,
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
   * Construction-time defaults for every other view concern (visible columns, column order,
   * sort, filters, grouping, page/pageSize, search) — a fresh table starts here, and `resetView`
   * restores it. Any field left unset falls back to that field's own ordinary empty default (all
   * columns visible, no sort, page 1, etc). Grouping a column with no matching sort entry here
   * gets one inserted automatically (the same thing interactive grouping already does), so
   * `initialViewState: { groupBy: ['status'] }` alone is enough for a deterministic group order.
   */
  initialViewState?: TableViewState
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
    labels: labelOverrides,
    defaultGroupsCollapsed = true,
    initialViewState,
    getRowId,
  } = options ?? {}
  const L = { ...DEFAULT_LABELS, ...labelOverrides }

  // Computed once (lazy useState initializer, discarded setter) rather than recomputed per
  // field below — the same `resolveViewState({}, ...)` call `resetView`/`setViewState({})` make,
  // so "what a fresh table starts at" and "what a reset restores" can never drift apart. Seeded
  // once and not recomputed on a later `columns`/`initialViewState` change, same as
  // `defaultVisibleColumns`/`defaultPageSize` were already seed-only before this replaced them.
  const [initial] = useState(() => resolveViewState({}, columns, initialViewState))

  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => initial.visibleCols)

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
  // visible by default, the same default this hook already uses with no `initialViewState`
  // override — the same reconciliation @vates/data-table-solid's own `columns.set` needed, just
  // reached here via a changed argument instead of an explicit setter call.
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
  }>(() => ({ filters: initial.filters, excludeFilters: initial.excludeFilters }))
  const { filters, excludeFilters } = filterState
  // Per-column runtime override of `col.multiMode` ("any"/"all" checklist match) — see
  // `setFilterMode`. Kept as its own state atom rather than folded into `filterState` above:
  // unlike `filters`/`excludeFilters`, no action ever needs to read both this and them together
  // to decide its next value.
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

  // Reconciles `selection`'s stored row references against a changed `data` argument, same
  // "adjust state when a prop changes" render-time pattern as visibleCols/columnKeys above —
  // only actually does anything when `getRowId` is set (reconcileSelection is a no-op passthrough
  // otherwise, so this is a zero-cost no-op for the default object-identity behavior).
  const [prevData, setPrevData] = useState(data)
  if (data !== prevData) {
    setPrevData(data)
    if (getRowId) setSelection((prev) => reconcileSelection(data, prev, getRowId))
  }

  const defaultSortDirFor = (key: string) => getDefaultSortDir(columns, key)

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
        filterModes,
      ),
    [
      data,
      searchQuery,
      columns,
      filters,
      rangeFilters,
      sorts,
      L.emptyValue,
      excludeFilters,
      filterModes,
    ],
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
      // See moveVisibleColumnBy's own doc comment (core) — the Columns dropdown's "Visible
      // columns" section's own Alt+↑/↓, which must skip over hidden columns rather than swap with
      // whichever key is textually adjacent in columnOrder.
      moveVisibleBy: (key: string, delta: number) =>
        setColumnOrder((prev) =>
          _moveVisibleColumnBy(
            prev.length ? prev : columns.map((c) => c.key),
            visibleCols,
            key,
            delta,
          ),
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
      valueMap: stringValueMap,
      setMode: (key: string, mode: 'and' | 'or') =>
        setFilterModes((prev) => _setFilterMode(prev, key, mode)),
      toggleAll: (key: string, values: string[]) => {
        // The master checkbox's own checked/indeterminate state reflects `filters` only (no
        // visual concept of exclusion) — so only the "select all ON" branch should ever touch
        // `excludeFilters`, and only because it must: every listed value is about to become
        // included, and a value can't be in both sets at once (see `cycleValue`). The
        // "deselect all" branch leaves `excludeFilters` completely alone — it only clears values
        // the checkbox showed as selected, which by that same invariant can never include an
        // already-excluded value.
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
        setFilterModes({})
        setRangeFilters({})
        setPageState(1)
      },
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
        setGroupBy((prev) => {
          const next = _moveColumnBy(prev, key, delta)
          setSorts((prevSorts) => reorderGroupSorts(prevSorts, next))
          return next
        }),
      move: (dragKey: string, targetKey: string, after = false) =>
        setGroupBy((prev) => {
          const next = _reorderColumn(prev, dragKey, targetKey, after)
          setSorts((prevSorts) => reorderGroupSorts(prevSorts, next))
          return next
        }),
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
      setFilterModes({})
      setRangeFilters({})
      setGroupBy([])
      setCollapsedGroups(new Set())
      setPageState(1)
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
