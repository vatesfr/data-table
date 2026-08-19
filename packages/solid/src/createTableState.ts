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

// Resolves a value that may be given either directly or as a reactive accessor — the same
// "value or getter" duality Vue's own useTableState accepts via MaybeRefOrGetter, here expressed
// the Solid way. Safe to discriminate on `typeof value === 'function'`: neither `TRow[]` nor
// `ColumnDef<TRow>[]` (the only two types this is ever called with) can themselves be a function.
function access<T>(value: T | Accessor<T>): T {
  return typeof value === 'function' ? (value as Accessor<T>)() : value
}

export interface CreateTableStateOptions {
  defaultVisibleColumns?: string[]
  labels?: Partial<DataTableLabels>
  defaultPageSize?: number
  /** Whether newly-grouped groups start collapsed. Defaults to `true`; pass `false` to start expanded. */
  defaultGroupsCollapsed?: boolean
}

export type TableState<TRow extends object> = ReturnType<typeof createTableState<TRow>>

// Solid port of react/useTableState.ts & vue/useTableState.ts — see CLAUDE.md's "Solid + TSX
// migration" note for why: this module intentionally mirrors those two field-for-field (same
// state shape, same action names) rather than reinventing the shape, so a change made to one
// adapter's state logic has an obvious equivalent here. The one structural difference from
// React/Vue: `data`/`columns` are themselves signals with public `setData`/`setColumns` setters,
// because vanilla's `createDataTable(container, options)` is a factory called once — there's no
// consumer-owned render loop re-invoking this with fresh `data`/`columns` arguments the way React
// re-invokes `useTableState` on every render, so this module has to own that mutability itself.
//
// `initialData`/`initialColumns` each accept a plain value *or* an `Accessor` (mirroring Vue's
// own `MaybeRefOrGetter` support) — passing an accessor sets up an internal `createEffect` that
// keeps `data`/`columns` tracking it for the table's whole lifetime, removing the need for the
// caller to write that effect by hand (as `@vates/data-table-vanilla`'s own `createDataTable`
// wrapper, and the `<DataTable>` component in this package, both would otherwise have to). A
// plain array, by contrast, is only ever a one-time initial value — exactly today's existing
// behavior — fully decoupled after construction, with `setData`/`setColumns` the only way to
// change it from then on. Calling `setData`/`setColumns` manually on an accessor-backed table
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
  options?: CreateTableStateOptions,
) {
  const {
    defaultVisibleColumns,
    labels: labelOverrides,
    defaultPageSize,
    defaultGroupsCollapsed = true,
  } = options ?? {}
  const L = { ...DEFAULT_LABELS, ...labelOverrides }

  const resolvedInitialColumns = access(initialColumns)
  const [data, setData] = createSignal<TRow[]>(access(initialData))
  const [columns, _setColumns] = createSignal<ColumnDef<TRow>[]>(resolvedInitialColumns)

  const [visibleCols, setVisibleCols] = createSignal<Set<string>>(
    new Set(defaultVisibleColumns ?? resolvedInitialColumns.map((c) => c.key)),
  )

  // Wraps the raw `columns` signal setter to reconcile `visibleCols` against the new key set.
  // `visibleCols` is seeded once at construction (from `defaultVisibleColumns`, or every initial
  // column) and otherwise only ever mutated by `toggleColVisibility` — a plain passthrough setter
  // here would leave it holding stale keys after a schema change, and since `activeColumns` is
  // filtered by `visibleCols`, a column set with no overlap in the old one (e.g. switching to a
  // different data type/shape entirely) would make every column filter out as "not visible" and
  // the table would silently render with no columns at all. A column that already existed keeps
  // whatever visibility choice it had; a genuinely new column (not present in the previous
  // `columns()`) starts visible by default, the same default construction itself uses with no
  // `defaultVisibleColumns` override. This also covers the fully-disjoint case for free: with
  // nothing carried over to preserve, every column in the new set counts as "new" and ends up
  // visible. Declared here (rather than inline in the returned object below) so the accessor-
  // tracking effect just below can call it too.
  const setColumns = (cols: ColumnDef<TRow>[]) => {
    const prevKeys = new Set(columns().map((c) => c.key))
    _setColumns(cols)
    setVisibleCols((prevVisible) => {
      const next = new Set<string>()
      for (const c of cols) {
        if (prevKeys.has(c.key)) {
          if (prevVisible.has(c.key)) next.add(c.key)
        } else {
          next.add(c.key)
        }
      }
      return next
    })
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
  const [selection, setSelection] = createSignal<Set<TRow>>(new Set())
  const [selectionAnchor, setSelectionAnchor] = createSignal<TRow | null>(null)
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

  const selectedRows = createMemo(() => processedData().filter((r) => selection().has(r)))

  return {
    // Raw state (for direct manipulation in the UI)
    data,
    columns,
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
    // Data/columns mutation (backs createDataTable's public setData/setColumns; see setColumns'
    // own doc comment above for what it does beyond a plain passthrough setter)
    setData,
    setColumns,
    // Actions
    toggleColVisibility: (key: string) =>
      setVisibleCols((prev) => {
        const next = new Set(prev)
        if (next.has(key)) {
          if (next.size > 1) next.delete(key)
        } else next.add(key)
        return next
      }),
    moveColumn: (dragKey: string, targetKey: string, after = false) =>
      setColumnOrder((prev) =>
        _reorderColumn(prev.length ? prev : columns().map((c) => c.key), dragKey, targetKey, after),
      ),
    moveColumnBy: (key: string, delta: number) =>
      setColumnOrder((prev) =>
        _moveColumnBy(prev.length ? prev : columns().map((c) => c.key), key, delta),
      ),
    toggleSort: (key: string) => setSorts((prev) => _toggleSort(prev, key, defaultSortDirFor(key))),
    replaceSort: (key: string) =>
      setSorts((prev) => _replaceSort(prev, key, defaultSortDirFor(key))),
    appendOrToggleSort: (key: string) =>
      setSorts((prev) => _appendOrToggleSort(prev, key, defaultSortDirFor(key))),
    removeSort: (key: string) => setSorts((prev) => prev.filter((s) => s.key !== key)),
    toggleSortDir: (key: string) =>
      setSorts((prev) =>
        prev.map((s) => (s.key === key ? { ...s, dir: _toggleSortDir(s.dir) } : s)),
      ),
    moveSortBy: (key: string, delta: number) => setSorts((prev) => _moveSortBy(prev, key, delta)),
    moveSort: (dragKey: string, targetKey: string, after = false) =>
      setSorts((prev) => _reorderSort(prev, dragKey, targetKey, after)),
    toggleFilterAll: (key: string, values: string[]) => {
      // Same reasoning as React's useTableState: only the "select all ON" branch touches
      // excludeFilters (every listed value is about to become included, and a value can't be in
      // both sets at once) — "deselect all" only clears what the checkbox actually showed as
      // selected.
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
    setFilterValues: (key: string, values: string[], selected: boolean) => {
      setFilterState((prev) => ({
        ...prev,
        filters: _setFilterValues(prev.filters, key, values, selected),
      }))
      setPageState(1)
    },
    cycleFilterValue: (key: string, value: string) => {
      setFilterState((prev) => _cycleFilterValue(prev.filters, prev.excludeFilters, key, value))
      setPageState(1)
    },
    clearExcludeValues: (key: string, values: string[]) => {
      setFilterState((prev) => ({
        ...prev,
        excludeFilters: _clearExcludeValues(prev.excludeFilters, key, values),
      }))
    },
    setRangeFilter: (key: string, field: 'min' | 'max', value: string) => {
      setRangeFilters((prev) => ({
        ...prev,
        [key]: { min: prev[key]?.min ?? '', max: prev[key]?.max ?? '', [field]: value },
      }))
      setPageState(1)
    },
    toggleGroup: (key: string) => setGroupBy((prev) => toggleGroupBy(prev, key)),
    removeGroup: (key: string) => setGroupBy((prev) => prev.filter((k) => k !== key)),
    moveGroupBy: (key: string, delta: number) =>
      setGroupBy((prev) => _moveColumnBy(prev, key, delta)),
    moveGroup: (dragKey: string, targetKey: string, after = false) =>
      setGroupBy((prev) => _reorderColumn(prev, dragKey, targetKey, after)),
    toggleGroupCollapse: (key: string) => setCollapsedGroups((prev) => toggleCollapse(prev, key)),
    clearColumnFilter: (key: string, kind: 'include' | 'exclude' | 'range' = 'include') => {
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
    setPage: (p: number) => {
      if (!Number.isFinite(p)) return
      setPageState(Math.max(1, Math.min(Math.floor(p), numPages())))
    },
    setPageSize: (s: number) => {
      if (!Number.isFinite(s)) return
      setPageSizeState(Math.max(0, Math.floor(s)))
      setPageState(1)
    },
    clearSorts: () => setSorts([]),
    clearFilters: () => {
      setFilterState({ filters: {}, excludeFilters: {} })
      setRangeFilters({})
      setPageState(1)
    },
    clearGroups: () => {
      setGroupBy([])
      setCollapsedGroups(new Set<string>())
    },
    setSearchQuery: (q: string) => {
      setSearchQueryState(q)
      setPageState(1)
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
    getSortIcon: (key: string) => _getSortIcon(sorts(), key),
    getSortIndex: (key: string) => _getSortIndex(sorts(), key),
    toggleRowSelection: (row: TRow, shiftKey = false) => {
      setSelection((prev) => {
        const next = new Set(prev)
        const anchor = selectionAnchor()
        if (shiftKey && anchor) {
          const shouldSelect = !next.has(row)
          const range = selectRange(processedData(), anchor, row)
          if (shouldSelect) range.forEach((r) => next.add(r))
          else range.forEach((r) => next.delete(r))
        } else if (next.has(row)) {
          next.delete(row)
        } else {
          next.add(row)
        }
        return next
      })
      // Solid's Setter overloads can't tell `row` (typed TRow, whose `object` constraint
      // structurally overlaps Function) apart from a functional updater — the standard Solid
      // workaround is wrapping the plain value in a thunk.
      setSelectionAnchor(() => row)
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
      setSelection(new Set<TRow>())
      setSelectionAnchor(null)
    },
    // Replaces the selection outright, by object identity — backs @vates/data-table-vanilla's
    // imperative `DataTableInstance.setSelection(rows)` (see CLAUDE.md's "Row selection" ->
    // "Vanilla's imperative selection API"), since that wrapper has no reactive `selection` value
    // of its own to mutate directly. A consumer using this package's own `createTableState`
    // directly can just call `setSelection(new Set(rows))` itself, so this method mainly exists
    // for that wrapper's sake. React/Vue have no equivalent: they expose `selection`/
    // `toggleRowSelection`/`clearSelection` directly since a consumer there already has the
    // `useTableState` value in hand, with no need for a separate "replace everything" method.
    setSelectionRows: (rows: TRow[]) => {
      setSelection(new Set(rows))
      setSelectionAnchor(null)
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
