import {
  batch,
  createSignal,
  createMemo,
  createRenderEffect,
  untrack,
  type Accessor,
} from 'solid-js'
import {
  DEFAULT_LABELS,
  type SortEntry,
  type RangeFilter,
  type DataTableLabels,
  type TableViewState,
} from '@vates/data-table-core'
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
  remapRow,
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
  type GetRowId,
  buildViewStateSnapshot,
  resolveViewState,
  clampInt,
  resolveFocusTarget,
  type VisibleItem,
} from '@vates/data-table-core/internal'
import type { ColumnDef } from './types'

// A value or its accessor; neither data nor columns can themselves be functions
function access<T>(value: T | Accessor<T>): T {
  return typeof value === 'function' ? (value as Accessor<T>)() : value
}

export interface CreateTableStateOptions<TRow extends object = Record<string, unknown>> {
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

export type TableState<TRow extends object> = ReturnType<typeof createTableState<TRow>>

// Solid port of React/Vue's state hooks: see docs/solid-package.md for its accessor inputs and
// `setData`/`columns.set`, and docs/table-state.md for the namespaced shape.
export function createTableState<TRow extends object>(
  initialData: TRow[] | Accessor<TRow[]>,
  initialColumns: ColumnDef<TRow>[] | Accessor<ColumnDef<TRow>[]>,
  options?: CreateTableStateOptions<TRow> | Accessor<CreateTableStateOptions<TRow> | undefined>,
) {
  // Reactive as a whole: `getRowId` is a function, so fields can't each be "value or accessor"
  const getOptions = (): CreateTableStateOptions<TRow> => access(options) ?? {}
  // Seed-only, from the same `resolveViewState({}, …)` a reset uses; the other options stay live
  const { initialViewState } = getOptions()

  const resolvedInitialColumns = access(initialColumns)
  const initial = resolveViewState({}, resolvedInitialColumns, initialViewState)
  const L = createMemo(() => ({ ...DEFAULT_LABELS, ...getOptions().labels }))

  const [data, _setData] = createSignal<TRow[]>(access(initialData))
  const [columns, _setColumns] = createSignal<ColumnDef<TRow>[]>(resolvedInitialColumns)

  const [visibleCols, setVisibleCols] = createSignal<Set<string>>(initial.visibleCols)
  const [selection, setSelection] = createSignal<Set<TRow>>(new Set())
  const [selectionAnchor, setSelectionAnchor] = createSignal<TRow | null>(null)
  // Roving-tabindex item (docs/keyboard-navigation.md's "External row focus")
  const [focusTarget, setFocusTarget] = createSignal<VisibleItem<TRow> | null>(null)
  // Set by `moveTo(row, { focus: true })`, consumed by TableBody once the row mounts, as only it holds row refs
  let wantsDomFocus = false

  // Remaps selection and its shift anchor to the new rows (only with `getRowId`)
  const setData = (rows: TRow[]) => {
    _setData(rows)
    const rowId = getOptions().getRowId
    if (!rowId) return
    setSelection((prev) => reconcileSelection(rows, prev, rowId))
    setSelectionAnchor((prev) => remapRow(prev, rows, rowId))
  }

  // Reconciles visibleCols with the new key set (docs/table-state.md)
  const setColumns = (cols: ColumnDef<TRow>[]) => {
    // Untracked: the accessor effect below calls this, and tracking `columns` there re-ran it on
    // its own write — forever, for an accessor returning a new array per read (inline JSX)
    const prevColumns = untrack(columns)
    _setColumns(cols)
    setVisibleCols((prevVisible) => reconcileVisibleColumns(prevColumns, cols, prevVisible))
  }

  // A render effect, not `createEffect`, so `data()`/`columns()` don't lag a tick behind the accessor
  if (typeof initialData === 'function') {
    createRenderEffect(() => setData((initialData as Accessor<TRow[]>)()))
  }
  if (typeof initialColumns === 'function') {
    createRenderEffect(() => setColumns((initialColumns as Accessor<ColumnDef<TRow>[]>)()))
  }

  const [columnOrder, setColumnOrder] = createSignal<string[]>(initial.columnOrder)
  const [sorts, setSorts] = createSignal<SortEntry[]>(initial.sorts)
  // One signal: actions read both include and exclude sets together
  const [filterState, setFilterState] = createSignal<{
    filters: Record<string, Set<string>>
    excludeFilters: Record<string, Set<string>>
  }>({ filters: initial.filters, excludeFilters: initial.excludeFilters })
  const filters = () => filterState().filters
  const excludeFilters = () => filterState().excludeFilters
  // Per-column override of `col.multiMode`
  const [filterModes, setFilterModes] = createSignal<Record<string, 'and' | 'or'>>(
    initial.filterModes,
  )
  const [rangeFilters, setRangeFilters] = createSignal<Record<string, RangeFilter>>(
    initial.rangeFilters,
  )
  const [groupBy, setGroupBy] = createSignal<string[]>(initial.groupBy)
  const [collapsedGroups, setCollapsedGroups] = createSignal<Set<string>>(initial.collapsedGroups)
  const [page, setPageState] = createSignal(initial.page)
  const [pageSize, setPageSizeState] = createSignal(initial.pageSize)
  const [searchQuery, setSearchQueryState] = createSignal(initial.searchQuery)

  const defaultSortDirFor = (key: string) => getDefaultSortDir(columns(), key)

  // Sorted apart from search/filters so a keystroke or filter click never re-sorts (see `sortData`)
  const sortedData = createMemo(() => sortData(data(), sorts(), columns()))

  // Built on the first keystroke, then reused until data or columns change; none while not searching.
  const searching = createMemo(() => searchQuery() !== '')
  const searchIndex = createMemo(() => (searching() ? buildSearchIndex(data(), columns()) : null))
  // Apart from filters, so a filter click doesn't re-run the search over every row
  const searchedData = createMemo(() => {
    const index = searchIndex()
    return index ? searchData(sortedData(), searchQuery(), index) : sortedData()
  })

  const processedData = createMemo(() =>
    filterData(
      searchedData(),
      filters(),
      rangeFilters(),
      columns(),
      L().emptyValue,
      excludeFilters(),
      filterModes(),
    ),
  )

  // Grouped over all rows, so pages budget header and data rows together (docs/pagination.md)
  const groupedFull = createMemo(() =>
    sortWithinGroups(
      groupData(processedData(), groupBy(), columns(), L().emptyValue),
      sorts(),
      groupBy(),
      columns(),
    ),
  )

  const visibleItems = createMemo(() =>
    getVisibleRows(groupedFull(), collapsedGroups(), getOptions().defaultGroupsCollapsed ?? true),
  )

  const numPages = createMemo(() => computeTotalPages(visibleItems().length, pageSize()))

  const clampedPage = createMemo(() => Math.min(page(), numPages()))

  const pagedData = createMemo(() =>
    paginateData(visibleItems(), clampedPage(), pageSize())
      .filter((item) => item.kind === 'row')
      .map((item) => item.row),
  )

  const groupedData = createMemo(() =>
    paginateVisibleGroups(
      groupedFull(),
      visibleItems(),
      collapsedGroups(),
      getOptions().defaultGroupsCollapsed ?? true,
      clampedPage(),
      pageSize(),
    ),
  )

  const activeColumns = createMemo(() =>
    getOrderedColumns(columns(), columnOrder()).filter(
      (c) =>
        visibleCols().has(c.key) &&
        (!groupBy().includes(c.key) || c.keepVisibleWhenGrouped === true),
    ),
  )

  const orderedColumns = createMemo(() => getOrderedColumns(columns(), columnOrder()))

  const activeFilterCount = createMemo(() =>
    countActiveFilters(filters(), rangeFilters(), excludeFilters()),
  )

  const selectedRows = createMemo(() =>
    getSelectedRows(processedData(), selection(), getOptions().getRowId),
  )

  return {
    // Top-level: the pipeline's actual output, not a "concern" of its own
    data,
    setData,
    processedData,
    pagedData,
    groupedData,
    visibleItems,
    labels: L,

    columns: {
      list: columns,
      set: setColumns,
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
          _reorderColumn(
            prev.length ? prev : columns().map((c) => c.key),
            dragKey,
            targetKey,
            after,
          ),
        ),
      moveBy: (key: string, delta: number) =>
        setColumnOrder((prev) =>
          _moveColumnBy(prev.length ? prev : columns().map((c) => c.key), key, delta),
        ),
      // Alt+↑/↓ in Visible columns: skips hidden columns, and those outside `eligible` (the search matches)
      moveVisibleBy: (key: string, delta: number, eligible?: ReadonlySet<string>) =>
        setColumnOrder((prev) =>
          _moveVisibleColumnBy(
            prev.length ? prev : columns().map((c) => c.key),
            eligible ?? visibleCols(),
            key,
            delta,
          ),
        ),
    },

    sort: {
      entries: sorts,
      toggle: (key: string) => setSorts((prev) => _toggleSort(prev, key, defaultSortDirFor(key))),
      replace: (key: string) =>
        setSorts((prev) => _replaceSort(prev, key, defaultSortDirFor(key), groupBy())),
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
      icon: (key: string) => _getSortIcon(sorts(), key),
      index: (key: string) => _getSortIndex(sorts(), key),
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
        // Only selecting all touches excludeFilters (a value can't be in both sets)
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
      // Exclude-only checklist of a non-multi-value column (docs/filter-dropdown.md)
      setExcludeValues: (key: string, values: string[], excluded: boolean) => {
        setFilterState((prev) => ({
          ...prev,
          excludeFilters: _setFilterValues(prev.excludeFilters, key, values, excluded),
        }))
        setPageState(1)
      },
      toggleExcludeAll: (key: string, values: string[]) => {
        setFilterState((prev) => ({
          ...prev,
          excludeFilters: _toggleExcludeAll(prev.excludeFilters, key, values),
        }))
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
      clearColumn: (key: string, kind?: 'include' | 'exclude' | 'range') =>
        batch(() => {
          if (!kind || kind === 'include')
            setFilterState((prev) => ({ ...prev, filters: { ...prev.filters, [key]: new Set() } }))
          if (!kind || kind === 'exclude')
            setFilterState((prev) => ({
              ...prev,
              excludeFilters: { ...prev.excludeFilters, [key]: new Set() },
            }))
          if (!kind || kind === 'range')
            setRangeFilters((prev) => ({ ...prev, [key]: { min: '', max: '' } }))
          setPageState(1)
        }),
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
      // Live — reads the latest `options.defaultGroupsCollapsed` on every call, tracking it
      // reactively when `options` itself was given as an Accessor (see `getOptions` above).
      defaultCollapsed: () => getOptions().defaultGroupsCollapsed ?? true,
      // Batched so groupBy and sorts change together: grouping (and persistence) run once
      toggle: (key: string) => {
        const prev = groupBy()
        batch(() => {
          if (!prev.includes(key))
            setSorts((s) => insertGroupSort(s, prev, key, defaultSortDirFor(key)))
          setGroupBy(toggleGroupBy(prev, key))
        })
      },
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
        setCollapsedGroups(new Set<string>())
      },
    },

    selection: {
      all: selection,
      rows: selectedRows,
      toggle: (row: TRow, shiftKey = false) => {
        const rowId = getOptions().getRowId
        setSelection((prev) =>
          toggleSelectionShiftAware(prev, row, shiftKey, selectionAnchor(), processedData(), rowId),
        )
        // A thunk: Solid's setter would take a row (an object) for an updater function
        setSelectionAnchor(() => row)
      },
      toggleAll: (rows: TRow[]) =>
        setSelection((prev) => toggleAllInSelection(prev, rows, getOptions().getRowId)),
      clear: () => {
        setSelection(new Set<TRow>())
        setSelectionAnchor(null)
      },
      // Replaces the selection, by object identity: backs vanilla's `setSelection(rows)`
      setAll: (rows: TRow[]) => {
        setSelection(new Set(rows))
        setSelectionAnchor(null)
      },
    },

    pagination: {
      page: clampedPage,
      pageSize,
      numPages,
      setPage: (p: number) => {
        const next = clampInt(p, 1, numPages())
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
      row: createMemo(() => {
        const t = focusTarget()
        return t?.kind === 'row' ? t.row : null
      }),
      setTarget: (item: VisibleItem<TRow> | null) => {
        wantsDomFocus = false
        setFocusTarget(item)
      },
      // Reveals `row` as the roving target (expands groups, jumps page); real focus only with `{ focus: true }`
      moveTo: (row: TRow, options?: { focus?: boolean }) => {
        const resolved = resolveFocusTarget(
          groupedFull(),
          row,
          collapsedGroups(),
          getOptions().defaultGroupsCollapsed ?? true,
          pageSize(),
        )
        if (!resolved) return
        setCollapsedGroups(resolved.collapsedGroups)
        setPageState(resolved.page)
        wantsDomFocus = options?.focus === true
        setFocusTarget(resolved.item)
      },
      // Internal: TableBody's focus effect
      consumeDomFocus: () => {
        const wanted = wantsDomFocus
        wantsDomFocus = false
        return wanted
      },
    },

    clearAll: () => {
      setSorts([])
      setFilterState({ filters: {}, excludeFilters: {} })
      setFilterModes({})
      setRangeFilters({})
      setGroupBy([])
      setCollapsedGroups(new Set<string>())
      setPageState(1)
      setSearchQueryState('')
    },

    getViewState: (): TableViewState =>
      buildViewStateSnapshot({
        visibleCols: visibleCols(),
        columnOrder: columnOrder(),
        sorts: sorts(),
        filters: filters(),
        excludeFilters: excludeFilters(),
        filterModes: filterModes(),
        rangeFilters: rangeFilters(),
        groupBy: groupBy(),
        collapsedGroups: collapsedGroups(),
        page: page(),
        pageSize: pageSize(),
        searchQuery: searchQuery(),
        columns: columns(),
        initialViewState,
      }),
    setViewState: (view: TableViewState) => {
      const resolved = resolveViewState(view, columns(), initialViewState)
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
