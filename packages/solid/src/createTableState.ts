import { createSignal, createMemo, createRenderEffect, type Accessor } from 'solid-js'
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
  isRowSelected,
  selectedRowsOf,
  toggleRowInSelection,
  toggleAllInSelection,
  reconcileSelection,
  toggleGroupBy,
  toggleCollapse,
  getOrderedColumns,
  reconcileVisibleColumns,
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

// Resolves a value that may be given either directly or as a reactive accessor — the same
// "value or getter" duality Vue's own useTableState accepts via MaybeRefOrGetter, here expressed
// the Solid way. Safe to discriminate on `typeof value === 'function'`: neither `TRow[]` nor
// `ColumnDef<TRow>[]` (the only two types this is ever called with) can themselves be a function.
function access<T>(value: T | Accessor<T>): T {
  return typeof value === 'function' ? (value as Accessor<T>)() : value
}

export interface CreateTableStateOptions<TRow extends object = Record<string, unknown>> {
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

export type TableState<TRow extends object> = ReturnType<typeof createTableState<TRow>>

// Solid port of react/useTableState.ts & vue/useTableState.ts — see CLAUDE.md's "Solid + TSX
// migration" note for why. Internal state/action logic mirrors those two field-for-field (same
// signal names, same core functions called), so a change made to one adapter's state logic has an
// obvious equivalent here — only the *returned object's shape* is namespaced (`table.sort.*`,
// `table.filter.*`, `table.group.*`, `table.selection.*`, `table.pagination.*`, `table.search.*`,
// `table.columns.*`, plus `processedData`/`pagedData`/`groupedData`/`visibleItems`/`labels` and
// `getViewState`/`setViewState`/`clearAll` staying top-level) rather than the ~45-field flat object
// every adapter used to return — see CLAUDE.md's "Namespaced TableState" for the full reasoning;
// Solid is the first adapter migrated to this shape, with React/Vue to follow the same grouping.
// The one structural difference from React/Vue: `data`/`columns` are themselves signals with
// public `setData`/`columns.set` setters, because vanilla's `createDataTable(container, options)`
// is a factory called once — there's no consumer-owned render loop re-invoking this with fresh
// `data`/`columns` arguments the way React re-invokes `useTableState` on every render, so this
// module has to own that mutability itself.
//
// `initialData`/`initialColumns` each accept a plain value *or* an `Accessor` (mirroring Vue's
// own `MaybeRefOrGetter` support) — passing an accessor sets up an internal `createEffect` that
// keeps `data`/`columns` tracking it for the table's whole lifetime, removing the need for the
// caller to write that effect by hand (as `@vates/data-table-vanilla`'s own `createDataTable`
// wrapper, and the `<DataTable>` component in this package, both would otherwise have to). A
// plain array, by contrast, is only ever a one-time initial value — exactly today's existing
// behavior — fully decoupled after construction, with `setData`/`columns.set` the only way to
// change it from then on. Calling `setData`/`columns.set` manually on an accessor-backed table
// still works, but is only a temporary override: the internal effect re-applies the accessor's
// value the next time it re-runs, the same "controlled input" trade-off as Vue's own `computed`.
//
// Ephemeral, UI-only state that React/Vue keep in their *view* layer rather than in
// `useTableState` (openDropdown, filterActiveCol, ddSearchTerms, focusTarget, drag state, etc. —
// see "Filter dropdown"/"Keyboard navigation" in the docs) is deliberately NOT here either; it
// belongs in DataTableView.tsx once that exists, matching the same split.
export function createTableState<TRow extends object>(
  initialData: TRow[] | Accessor<TRow[]>,
  initialColumns: ColumnDef<TRow>[] | Accessor<ColumnDef<TRow>[]>,
  options?: CreateTableStateOptions<TRow>,
) {
  const {
    defaultVisibleColumns,
    labels: labelOverrides,
    defaultPageSize,
    defaultGroupsCollapsed = true,
    getRowId,
  } = options ?? {}
  const L = { ...DEFAULT_LABELS, ...labelOverrides }

  const resolvedInitialColumns = access(initialColumns)
  const [data, _setData] = createSignal<TRow[]>(access(initialData))
  const [columns, _setColumns] = createSignal<ColumnDef<TRow>[]>(resolvedInitialColumns)

  const [visibleCols, setVisibleCols] = createSignal<Set<string>>(
    new Set(defaultVisibleColumns ?? resolvedInitialColumns.map((c) => c.key)),
  )
  const [selection, setSelection] = createSignal<Set<TRow>>(new Set())
  const [selectionAnchor, setSelectionAnchor] = createSignal<TRow | null>(null)

  // Wraps the raw `data` signal setter to reconcile `selection`'s stored row references (see
  // core's `reconcileSelection` for the full reasoning) whenever `getRowId` is set — a no-op
  // passthrough otherwise, so this costs nothing for the default object-identity behavior.
  // Declared here (rather than inline in the returned object below) so the accessor-tracking
  // effect just below can call it too.
  const setData = (rows: TRow[]) => {
    _setData(rows)
    if (getRowId) setSelection((prev) => reconcileSelection(rows, prev, getRowId))
  }

  // Wraps the raw `columns` signal setter to reconcile `visibleCols` against the new key set via
  // core's `reconcileVisibleColumns` (see its own doc comment for the full reasoning — a plain
  // passthrough setter would leave `visibleCols` holding stale keys after a schema change).
  // Declared here (rather than inline in the returned object below) so the accessor-tracking
  // effect just below can call it too.
  const setColumns = (cols: ColumnDef<TRow>[]) => {
    const prevColumns = columns()
    _setColumns(cols)
    setVisibleCols((prevVisible) => reconcileVisibleColumns(prevColumns, cols, prevVisible))
  }

  // See this function's own doc comment above for why: an accessor keeps tracking its source for
  // the table's whole lifetime instead of only seeding the initial value. `createRenderEffect`
  // (not `createEffect`) specifically — a plain `createEffect` only re-runs in a microtask after
  // the triggering signal write, so `data()`/`columns()` would lag one tick behind the source
  // accessor; `createRenderEffect` re-runs synchronously in the same update flush, the same
  // timing a JSX binding reading the accessor directly would get.
  if (typeof initialData === 'function') {
    createRenderEffect(() => setData((initialData as Accessor<TRow[]>)()))
  }
  if (typeof initialColumns === 'function') {
    createRenderEffect(() => setColumns((initialColumns as Accessor<ColumnDef<TRow>[]>)()))
  }

  const [columnOrder, setColumnOrder] = createSignal<string[]>([])
  const [sorts, setSorts] = createSignal<SortEntry[]>([])
  // `filters` (include) and `excludeFilters` ("not one of these values", see `cycleFilterValue`)
  // are combined into one signal rather than two independent ones, for the same reason as React's
  // `useTableState`: several actions need to read *both* current maps together to decide the next
  // state, and one signal means one updater always sees the latest committed value of both.
  const [filterState, setFilterState] = createSignal<{
    filters: Record<string, Set<string>>
    excludeFilters: Record<string, Set<string>>
  }>({ filters: {}, excludeFilters: {} })
  const filters = () => filterState().filters
  const excludeFilters = () => filterState().excludeFilters
  const [rangeFilters, setRangeFilters] = createSignal<Record<string, RangeFilter>>({})
  const [groupBy, setGroupBy] = createSignal<string[]>([])
  const [collapsedGroups, setCollapsedGroups] = createSignal<Set<string>>(new Set())
  const [page, setPageState] = createSignal(1)
  const [pageSize, setPageSizeState] = createSignal(defaultPageSize ?? 0)
  const [searchQuery, setSearchQueryState] = createSignal('')

  const defaultSortDirFor = (key: string) =>
    columns().find((c) => c.key === key)?.defaultSortDir ?? 'asc'

  const stringValueMap = createMemo(() => computeStringValues(data(), columns(), L.emptyValue))

  const processedData = createMemo(() =>
    processData(
      searchData(data(), searchQuery(), columns()),
      filters(),
      rangeFilters(),
      sorts(),
      columns(),
      L.emptyValue,
      excludeFilters(),
    ),
  )

  // Grouping runs over the *full* filtered/sorted data, not a page's slice, so pagination (below)
  // can budget page size across header rows and data rows together instead of paginating data
  // rows first and grouping whatever lands on that page afterward — see "Pagination" in the docs.
  const groupedFull = createMemo(() =>
    sortWithinGroups(
      groupData(processedData(), groupBy(), columns(), L.emptyValue),
      sorts(),
      groupBy(),
      columns(),
    ),
  )

  const visibleItems = createMemo(() =>
    getVisibleRows(groupedFull(), collapsedGroups(), defaultGroupsCollapsed),
  )

  const numPages = createMemo(() => calcTotalPages(visibleItems().length, pageSize()))

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
      defaultGroupsCollapsed,
      clampedPage(),
      pageSize(),
    ),
  )

  const activeColumns = createMemo(() =>
    getOrderedColumns(columns(), columnOrder()).filter(
      (c) => visibleCols().has(c.key) && !groupBy().includes(c.key),
    ),
  )

  const orderedColumns = createMemo(() => getOrderedColumns(columns(), columnOrder()))

  const activeFilterCount = createMemo(() =>
    countActiveFilters(filters(), rangeFilters(), excludeFilters()),
  )

  const selectedRows = createMemo(() => selectedRowsOf(processedData(), selection(), getRowId))

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
      icon: (key: string) => _getSortIcon(sorts(), key),
      index: (key: string) => _getSortIndex(sorts(), key),
    },

    filter: {
      include: filters,
      exclude: excludeFilters,
      ranges: rangeFilters,
      activeCount: activeFilterCount,
      valueMap: stringValueMap,
      toggleAll: (key: string, values: string[]) => {
        // Only the "select all ON" branch touches excludeFilters (every listed value is about to
        // become included, and a value can't be in both sets at once) — "deselect all" only
        // clears what the checkbox actually showed as selected.
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
      // Fixed at construction (no setter — `options.defaultGroupsCollapsed` isn't meant to change
      // at runtime), but still exposed as a same-shaped accessor as everything else here, not a
      // one-off exception a consumer has to remember.
      defaultCollapsed: () => defaultGroupsCollapsed,
      toggle: (key: string) => setGroupBy((prev) => toggleGroupBy(prev, key)),
      remove: (key: string) => setGroupBy((prev) => prev.filter((k) => k !== key)),
      moveBy: (key: string, delta: number) => setGroupBy((prev) => _moveColumnBy(prev, key, delta)),
      move: (dragKey: string, targetKey: string, after = false) =>
        setGroupBy((prev) => _reorderColumn(prev, dragKey, targetKey, after)),
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
        setSelection((prev) => {
          const anchor = selectionAnchor()
          if (shiftKey && anchor) {
            const next = new Set(prev)
            const shouldSelect = !isRowSelected(next, row, getRowId)
            const range = selectRange(processedData(), anchor, row)
            if (shouldSelect) range.forEach((r) => next.add(r))
            else range.forEach((r) => next.delete(r))
            return next
          }
          return toggleRowInSelection(prev, row, getRowId)
        })
        // Solid's Setter overloads can't tell `row` (typed TRow, whose `object` constraint
        // structurally overlaps Function) apart from a functional updater — the standard Solid
        // workaround is wrapping the plain value in a thunk.
        setSelectionAnchor(() => row)
      },
      toggleAll: (rows: TRow[]) =>
        setSelection((prev) => toggleAllInSelection(prev, rows, getRowId)),
      clear: () => {
        setSelection(new Set<TRow>())
        setSelectionAnchor(null)
      },
      // Replaces the selection outright, by object identity — backs @vates/data-table-vanilla's
      // imperative `DataTableInstance.setSelection(rows)` (see CLAUDE.md's "Row selection" ->
      // "Vanilla's imperative selection API"), since that wrapper has no reactive `selection.all`
      // value of its own to mutate directly. A consumer using this package's own `createTableState`
      // directly has no need for a separate "replace everything" method — this mainly exists for
      // that wrapper's sake.
      setAll: (rows: TRow[]) => {
        setSelection(new Set(rows))
        setSelectionAnchor(null)
      },
    },

    pagination: {
      page,
      pageSize,
      numPages,
      setPage: (p: number) => {
        if (!Number.isFinite(p)) return
        setPageState(Math.max(1, Math.min(Math.floor(p), numPages())))
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
      setCollapsedGroups(new Set<string>())
      setPageState(1)
      setSearchQueryState('')
    },

    getViewState: (): TableViewState => {
      const view: TableViewState = {}
      const allKeys = columns().map((c) => c.key)
      const vc = visibleCols()
      const isDefaultVisible = vc.size === allKeys.length && allKeys.every((k) => vc.has(k))
      if (!isDefaultVisible) view.visibleCols = [...vc]
      const co = columnOrder()
      if (co.length) view.columnOrder = co
      const s = sorts()
      if (s.length) view.sorts = s
      const filterEntries = Object.entries(filters()).filter(([, v]) => v.size > 0)
      if (filterEntries.length)
        view.filters = Object.fromEntries(filterEntries.map(([k, v]) => [k, [...v]]))
      const excludeFilterEntries = Object.entries(excludeFilters()).filter(([, v]) => v.size > 0)
      if (excludeFilterEntries.length)
        view.excludeFilters = Object.fromEntries(excludeFilterEntries.map(([k, v]) => [k, [...v]]))
      const rangeEntries = Object.entries(rangeFilters()).filter(
        ([, r]) => r.min !== '' || r.max !== '',
      )
      if (rangeEntries.length) view.rangeFilters = Object.fromEntries(rangeEntries)
      const gb = groupBy()
      if (gb.length) view.groupBy = gb
      const cg = collapsedGroups()
      if (cg.size) view.collapsedGroups = [...cg]
      if (page() !== 1) view.page = page()
      if (pageSize() !== (defaultPageSize ?? 0)) view.pageSize = pageSize()
      if (searchQuery()) view.searchQuery = searchQuery()
      return view
    },
    setViewState: (view: TableViewState) => {
      const validVisible = view.visibleCols?.filter((k) => columns().some((c) => c.key === k))
      setVisibleCols(
        validVisible?.length
          ? new Set(validVisible)
          : new Set(defaultVisibleColumns ?? columns().map((c) => c.key)),
      )
      setColumnOrder(view.columnOrder?.filter((k) => columns().some((c) => c.key === k)) ?? [])
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
