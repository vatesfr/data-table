import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useInsertionEffect,
  useMemo,
  type KeyboardEvent,
  type MouseEventHandler,
  type ReactNode,
} from 'react'
import {
  computeAggregate,
  trackWrapWidth,
  formatAggregate,
  exclusionChip,
  exclusionValueKeys,
  exclusionValues,
  getColumnAlign,
  getColumnValue,
  rowText,
  groupText,
  rangeChipText,
  addableLists,
  columnsDropdownLists,
  isGroupCollapsed,
  isSameVisibleItem,
  isSameRow,
  isNewRowFocusTarget,
  isViewClearable,
  indexOfVisibleItem,
  paginateVisibleItems,
  pageSizeOptions,
  showsPager,
  planRowNav,
  activeRowKeyDown,
  getSortIndex as getHeaderSortIndex,
  getSortIcon as getHeaderSortIcon,
  summarizeFilterValues,
  filterMatchMode,
  chipSeparator,
  formatFilterValue,
  columnHasActiveFilter,
  filterOpenState,
  applyColumnOrderSnapshot,
  columnMatchesSearch,
  groupColumnsByCategory,
  toggleCollapse,
  getHeaderMenuItems,
  watchMedia,
  tableStatus,
  chipRemovalFocusTarget,
  filterDetailFocusTarget,
  FILTER_NARROW_QUERY,
  injectStyles,
  type VisibleItem,
} from '@vates/data-table-core/internal'
import type { SortEntry } from '@vates/data-table-core'
import { Dropdown } from './components/Dropdown'
import { CategorySubmenu } from './components/CategorySubmenu'
import { HeaderMenu } from './components/HeaderMenu'
import { ToolbarBtn } from './components/ToolbarBtn'
import { FilterPane } from './components/FilterPane'
import { useDropdownReorder } from './hooks/useDropdownReorder'
import type { ColumnDef, DataTableViewProps } from './types'

/**
 * Consumes a pending-focus ref (see the `pendingSortFocusKey`/`pendingGroupFocusKey`/
 * `pendingFilterColFocusKey` refs below) and focuses whichever element under `root` carries a
 * matching value on one of `attrs` — a column/entry key can land on either of two possible
 * data-attributes depending on which section (active vs. addable) it's currently rendered in.
 * No-ops if the ref is already empty (nothing pending).
 */
function focusPendingKey(
  root: HTMLElement,
  ref: { current: string | null },
  attrs: string[],
): void {
  if (!ref.current) return
  const key = ref.current
  ref.current = null
  const selector = attrs.map((a) => `[${a}]`).join(', ')
  for (const el of root.querySelectorAll<HTMLElement>(selector)) {
    if (attrs.some((a) => el.getAttribute(a) === key)) {
      el.focus()
      break
    }
  }
}

/** Stands in for a column list that a search narrowed to nothing (U26) */
function NoMatchingColumns({ label }: { label: string }) {
  return (
    <div className="dt-dd-no-match" data-dd-no-match>
      {label}
    </div>
  )
}

/**
 * The Columns/Sort/Group/Filter dropdowns' own column-search box — narrows that dropdown's
 * column list by label, with Escape clearing the term (stopping propagation so it doesn't also
 * close the dropdown itself). Columns/Sort/Group wrap it in a `.dt-dd-search-row`; the Filter
 * dropdown's left pane passes `filterCols` instead, making the input+clear-button pair itself
 * sticky (`.dt-filter-cols-search-wrap`).
 * Its × clear button gives mouse users what Escape gives keyboard users.
 */
function DdSearchInput({
  value,
  onChange,
  placeholder,
  clearLabel,
  filterCols,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  clearLabel: string
  filterCols?: boolean
}) {
  return (
    <span className={`dt-dd-search-wrap${filterCols ? ' dt-filter-cols-search-wrap' : ''}`}>
      <input
        type="text"
        className={`dt-dd-search${filterCols ? ' dt-filter-cols-search' : ''}`}
        data-dd-search
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && e.currentTarget.value !== '') {
            e.preventDefault()
            e.stopPropagation()
            onChange('')
          }
        }}
      />
      {value !== '' && (
        <button
          type="button"
          className="dt-dd-search-clear"
          title={clearLabel}
          aria-label={clearLabel}
          onClick={() => onChange('')}
        >
          ×
        </button>
      )}
    </span>
  )
}

/** An active row's × remove button */
function RemoveButton({ label, onClick }: { label: string; onClick: MouseEventHandler }) {
  return (
    <button
      type="button"
      draggable={false}
      title={label}
      aria-label={label}
      onClick={onClick}
      className="dt-item-remove"
    >
      ×
    </button>
  )
}

// A data row's `dt-tr` modifiers, then the app's `rowClass`; a selected row isn't striped
function trClass(
  selected: boolean,
  odd: boolean,
  clickable: boolean,
  current: boolean,
  extra: string | undefined,
): string {
  return `dt-tr${selected ? ' dt-tr--selected' : odd ? ' dt-tr--odd' : ''}${clickable ? ' dt-tr--clickable' : ''}${current ? ' dt-tr--current' : ''}${extra ? ` ${extra}` : ''}`
}

// `.dt-dd-item--drag-over`/`--drag-over-after`: a dropdown row's drop-position line
function dragOverClass(over: boolean, after: boolean): string {
  return over ? (after ? ' dt-dd-item--drag-over-after' : ' dt-dd-item--drag-over') : ''
}

/**
 * Renders the built-in table UI for a `useTableState` result you own yourself — the same
 * markup `<DataTable>` renders, minus the internal `useTableState` call. Use this instead of
 * `<DataTable>` when you need to reach the table's state from outside (view persistence,
 * imperative selection control, etc.) but still want the default look, e.g.:
 *
 * ```tsx
 * const table = useTableState(data, columns)
 * usePersistedView(table, 'my-table-view')
 * return <DataTableView table={table} data={data} columns={columns} />
 * ```
 */
export function DataTableView<TRow extends object>({
  table,
  data,
  columns,
  selectable,
  onSelectionChange,
  onRowClick,
  currentRow,
  rowClass,
  showSearch,
  showColumns,
  toolbarEnd,
}: DataTableViewProps<TRow>) {
  // No theme tokens: React apps define their own (see the README's Theming)
  useInsertionEffect(injectStyles, [])
  // One open toolbar dropdown per table, as in Solid: opening one closes the others (U33)
  const [openDD, setOpenDD] = useState<'cols' | 'sort' | 'filter' | 'group' | null>(null)
  const ddSetters = useMemo(() => {
    const setter = (id: NonNullable<typeof openDD>) => (open: boolean) =>
      setOpenDD((cur) => (open ? id : cur === id ? null : cur))
    return {
      cols: setter('cols'),
      sort: setter('sort'),
      filter: setter('filter'),
      group: setter('group'),
    }
  }, [])
  // Narrow screen (U16): the Filter dropdown shows one pane at a time — columns, or values
  const [narrowFilter, setNarrowFilter] = useState(false)
  useEffect(() => watchMedia(FILTER_NARROW_QUERY, setNarrowFilter), [])
  // U41: a group label wraps to the visible width of the sideways-scrolling table
  const wrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => trackWrapWidth(wrapRef.current!), [])
  const hasToolbarEnd = toolbarEnd != null && toolbarEnd !== false
  // On a phone the toolbar wraps: toolbarEnd ends the first line instead of taking a line of its own.
  const endFirst = narrowFilter && hasToolbarEnd
  const [filterShowValues, setFilterShowValues] = useState(false)
  const pendingFilterValuesFocus = useRef(false)
  const rowRefs = useRef(new Map<TRow | string, HTMLElement>())
  const [dragColKey, setDragColKey] = useState<string | null>(null)
  const [dragOverColKey, setDragOverColKey] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [filterActiveCol, setFilterActiveCol] = useState<string | null>(null)
  // Column-list search per dropdown id; FilterPane keeps its own value search
  const [ddSearchTerms, setDdSearchTerms] = useState<Record<string, string>>({})
  // Root ref purely so the two pending-focus effects below can scope their DOM queries to *this*
  // table instance — a plain `document.querySelector` by column key would risk matching another
  // <DataTable> on the same page whose columns happen to share a key.
  const rootRef = useRef<HTMLDivElement>(null)
  // Focus target after a clear button unmounts itself: the search box, else the first toolbar button.
  const focusSearch = () =>
    (searchInputRef.current ?? rootRef.current?.querySelector('button'))?.focus()
  // Activating an addable Sort/Group column (or removing an active one) moves its row between
  // the active and addable sections — a different DOM element, since they're different JSX
  // subtrees (not just a reordered list React could keep the same node for), so the button/row
  // that had focus at click time unmounts and focus is otherwise dropped. `sorts`/`groupBy`
  // updates are async (the new element doesn't exist until the next commit), so the key to
  // refocus is stashed here and picked up by a `useLayoutEffect` right after that commit — same
  // "can't focus synchronously across an async state update" shape as `pendingFocusTarget` above.
  const pendingSortFocusKey = useRef<string | null>(null)
  const pendingGroupFocusKey = useRef<string | null>(null)
  // Same shape, for the active-bar Group/Filter chip bodies (see "Active-bar chip click
  // actions" below): clicking one opens its dropdown — a panel that doesn't exist in the DOM
  // yet at click time — so the row/button to focus inside it can't be reached until the
  // open-state update commits and the panel actually mounts. `pendingGroupFocusKey` is reused as-
  // is for the Group chip (it already matches on `data-group-key`, exactly the row a newly-opened
  // Group dropdown renders); Filter gets its own ref since there's no equivalent existing one.
  const pendingFilterColFocusKey = useRef<string | null>(null)
  // Same shape, for the Columns dropdown: showing a column refocuses its new Visible row
  // (data-col-row-key); hiding one refocuses whatever it reappears as in Available — its own
  // addable row (data-col-key) if uncategorized, or its category's submenu trigger
  // (data-category-header) if not, since a categorized column has no addable row of its own
  // rendered while its submenu stays closed. A single ref covers all three since the stashed
  // value is either a column key or a category name, and matching is exact-string against
  // whichever attribute is present on a given element.
  const pendingColFocusKey = useRef<string | null>(null)
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    focusPendingKey(root, pendingSortFocusKey, ['data-sort-key', 'data-sort-add-key'])
    focusPendingKey(root, pendingGroupFocusKey, ['data-group-key', 'data-group-add-key'])
    focusPendingKey(root, pendingFilterColFocusKey, ['data-filter-col-key'])
    if (pendingFilterValuesFocus.current) {
      pendingFilterValuesFocus.current = false
      // A number column has no value rows: fall back to the back button
      ;(
        filterDetailFocusTarget(root.querySelector('[data-filter-detail]')) ??
        root.querySelector<HTMLElement>('[data-filter-back]')
      )?.focus()
    }
    focusPendingKey(root, pendingColFocusKey, [
      'data-col-row-key',
      'data-col-key',
      'data-category-header',
    ])
  })
  // Hides `col`, refocusing whatever it reappears as in Available — shared by a visible row's own
  // × button and its Delete/Backspace keyboard equivalent (see pendingColFocusKey's own comment
  // above for why a category name and a column key are both valid values to stash here). While
  // searching, a categorized column reappears flattened out of its submenu (see the render below)
  // — its own addable row, not the category's — so the category-name target only applies when
  // *not* currently searching.
  function hideColumn(col: ColumnDef<TRow>): void {
    pendingColFocusKey.current = col.category && !isColsSearching ? col.category : col.key
    toggleColVisibility(col.key)
  }
  // Which category submenu is open, one independent value per dropdown — a single shared value
  // (not one per CategorySubmenu instance) so opening one category always closes any other that
  // was open in the same dropdown, see CategorySubmenu.tsx's own doc.
  const [openSortCategory, setOpenSortCategory] = useState<string | null>(null)
  const [openGroupCategory, setOpenGroupCategory] = useState<string | null>(null)
  const [openColsCategory, setOpenColsCategory] = useState<string | null>(null)
  // Bare local names for `table`'s namespaced fields (docs/table-state.md)
  const { processedData, groupedData, visibleItems, labels: L, clearAll } = table
  const {
    visible: visibleCols,
    active: activeColumns,
    ordered: orderedColumns,
    toggleVisibility: toggleColVisibility,
    move: moveColumn,
    moveVisibleBy: moveVisibleColumnBy,
  } = table.columns
  const {
    entries: sorts,
    toggle: toggleSort,
    replace: replaceSort,
    appendOrToggle: appendOrToggleSort,
    remove: removeSort,
    toggleDir: toggleSortDir,
    move: moveSort,
    clear: clearSorts,
    icon: getSortIcon,
    index: getSortIndex,
  } = table.sort
  const {
    include: filters,
    exclude: excludeFilters,
    ranges: rangeFilters,
    modes: filterModes,
    activeCount: activeFilterCount,
    clearColumn: clearColumnFilter,
    clear: clearFilters,
  } = table.filter
  const exclusionKeys = exclusionValueKeys(data, columns, filters, excludeFilters)
  const exclusionAllValues = useMemo(
    () => exclusionValues(data, columns, exclusionKeys, L.emptyValue),
    [data, columns, exclusionKeys, L.emptyValue],
  )
  const {
    by: groupBy,
    collapsed: collapsedGroups,
    defaultCollapsed: defaultGroupsCollapsed,
    toggle: toggleGroup,
    remove: removeGroup,
    moveBy: moveGroupBy,
    move: moveGroup,
    toggleCollapse: toggleGroupCollapse,
    clear: clearGroups,
  } = table.group
  const { target: focusTarget, setTarget: setFocusTarget, consumeDomFocus } = table.focus

  // Split for the Sort dropdown's active list (see "Auto-syncing group order with sort" in
  // docs/grouped-columns.md): entries matching a currently grouped column always govern nesting order via
  // `groupBy`'s own order, never via drag position within `sorts` — mixing them into one flat
  // draggable list made dragging a tie-break column above a group column look like it did
  // something when it never could (issue #17's follow-up). `groupSortEntries` is in `groupBy`'s
  // own order (skipping a grouped column with no matching sort entry); `nonGroupSortEntries` is
  // the actual freely-reorderable tie-break priority stack.
  const groupSortEntries = groupBy
    .map((key) => sorts.find((s) => s.key === key))
    .filter((s): s is SortEntry => s !== undefined)
  const nonGroupSortEntries = sorts.filter((s) => !groupBy.includes(s.key))

  // Kept independent from dragColKey/dragOverColKey above (the <th> header drag state), even
  // though both ultimately reorder columnOrder — mirrors vanilla giving each dropdown its own
  // drag state instead of a shared one.
  const {
    dragOverKey: dragOverColRowKey,
    dragOverAfter: dragOverColRowAfter,
    onRowDragStart: onColRowDragStart,
    onRowDragEnd: onColRowDragEnd,
    onDragOver: onColRowsDragOver,
    onDrop: onColRowsDrop,
  } = useDropdownReorder('data-col-row-key', moveColumn)
  const {
    dragOverKey: dragOverSortKey,
    dragOverAfter: dragOverSortAfter,
    onRowDragStart: onSortRowDragStart,
    onRowDragEnd: onSortRowDragEnd,
    onDragOver: onSortRowsDragOver,
    onDrop: onSortRowsDrop,
  } = useDropdownReorder('data-sort-key', moveSort)
  const {
    dragOverKey: dragOverGroupKey,
    dragOverAfter: dragOverGroupAfter,
    onRowDragStart: onGroupRowDragStart,
    onRowDragEnd: onGroupRowDragEnd,
    onDragOver: onGroupRowsDragOver,
    onDrop: onGroupRowsDrop,
  } = useDropdownReorder('data-group-key', moveGroup)

  const {
    all: selection,
    rows: selectedRows,
    toggle: toggleRowSelection,
    toggleAll: toggleSelectAll,
  } = table.selection
  const { page, pageSize, numPages, setPage, setPageSize } = table.pagination
  const { query: searchQuery, setQuery: setSearchQuery } = table.search

  const selectAllRef = useRef<HTMLInputElement>(null)
  const allSelected = processedData.length > 0 && selectedRows.length === processedData.length
  const someSelected = selectedRows.length > 0 && !allSelected

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected
  }, [someSelected])

  const groupAllSelected = (rows: TRow[]) => rows.length > 0 && rows.every((r) => selection.has(r))
  const groupSomeSelected = (rows: TRow[]) =>
    rows.some((r) => selection.has(r)) && !groupAllSelected(rows)

  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    onSelectionChange?.(selectedRows)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRows])

  // Roving tabindex: exactly one item (a data row or a group header row) is a Tab stop at a
  // time (the rest are tabIndex={-1}), arrow keys move it, matching how the checklist/date-tree
  // checkboxes reuse the same anchor idea for range selection. Data rows only join the tab
  // sequence when they're actually interactive; group headers always do, since collapsing a
  // group is already a click away regardless of selectable/onRowClick.
  const rowNavEnabled = selectable || !!onRowClick
  const pageVisibleItems = paginateVisibleItems(visibleItems, page, pageSize)
  const [initialPageSize] = useState(pageSize)
  const pageSizes = pageSizeOptions(pageSize, initialPageSize)
  const navigableItems = pageVisibleItems.filter((item) => item.kind === 'group' || rowNavEnabled)
  const effectiveFocusTarget =
    focusTarget && indexOfVisibleItem(navigableItems, focusTarget) !== -1
      ? focusTarget
      : (navigableItems[0] ?? null)
  const isFocusTarget = (item: VisibleItem<TRow>) =>
    effectiveFocusTarget !== null && isSameVisibleItem(effectiveFocusTarget, item)

  const focusItem = (target: VisibleItem<TRow>) => {
    setFocusTarget(target)
    const refKey = target.kind === 'row' ? target.row : target.key
    rowRefs.current.get(refKey)?.focus()
  }

  // Changing `page` re-renders asynchronously, so an item on the new page can't be focused until
  // after that render commits — this records the target and a `useEffect` below picks it up.
  const pendingFocusTarget = useRef<VisibleItem<TRow> | null>(null)

  useEffect(() => {
    if (pendingFocusTarget.current) {
      const target = pendingFocusTarget.current
      pendingFocusTarget.current = null
      focusItem(target)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // Scrolls `focus.target` into view whenever it changes to a row — the counterpart to
  // `pendingFocusTarget`/`focusItem` above, but for `table.focus.moveTo`, which (unlike keyboard
  // nav) never calls real DOM `.focus()` itself — see its own doc comment in `useTableState.ts`.
  // Runs on every `focusTarget` change (a keyboard-driven one already scrolled synchronously via
  // `focusItem`'s `.focus()`, so this is a harmless no-op re-scroll for that case) and retries on
  // `page`/`collapsedGroups` so a `moveTo` that had to expand a group or cross a page still finds
  // the row once it actually mounts.
  const lastScrolledFocusTarget = useRef<VisibleItem<TRow> | null>(null)
  useEffect(() => {
    if (isNewRowFocusTarget(focusTarget, lastScrolledFocusTarget.current, table.getRowId)) {
      const el = rowRefs.current.get(focusTarget.row)
      if (el) {
        // jsdom (used by this project's own component tests) doesn't implement
        // `scrollIntoView` at all — guard rather than let it throw in a passive effect.
        el.scrollIntoView?.({ block: 'nearest' })
        // `moveTo(row, { focus: true })` — real `.focus()` in addition to the scroll, done here
        // (not in useTableState) since this is the one place that actually holds the row's DOM
        // node. `preventScroll` avoids a redundant second scroll on top of the line above.
        if (consumeDomFocus()) el.focus({ preventScroll: true })
        lastScrolledFocusTarget.current = focusTarget
      }
    } else lastScrolledFocusTarget.current = focusTarget
  }, [focusTarget, page, collapsedGroups, consumeDomFocus, table.getRowId])

  const handleKeyDown = (e: KeyboardEvent<HTMLTableRowElement>, target: VisibleItem<TRow>) => {
    const plan = planRowNav(e, target, {
      visibleItems,
      navigableItems,
      page,
      numPages,
      pageSize,
      selectable: !!selectable,
      rowClickable: !!onRowClick,
    })
    if (!plan) return
    e.preventDefault()
    if (plan.kind === 'focus') {
      if (plan.extend) toggleRowSelection(plan.extend, true)
      if (plan.page) {
        pendingFocusTarget.current = plan.item
        setPage(plan.page)
      } else focusItem(plan.item)
    } else if (plan.kind === 'toggleRow') toggleRowSelection(plan.row, e.shiftKey)
    else if (plan.kind === 'toggleGroupSelection') {
      const group = groupedData.find((g) => g.key === plan.key)
      if (group) toggleSelectAll(group.rows)
    } else if (plan.kind === 'toggleCollapse') toggleGroupCollapse(plan.key)
    else onRowClick?.(plan.row, e)
  }

  const filterableCols = columns.filter((c) => c.filterable !== false)
  const groupableCols = columns.filter((c) => c.groupable === true)
  const sortableCols = columns.filter((c) => c.sortable !== false)
  // Sort/Group dropdowns split into an "active" section (priority order, reorderable) and an
  // "add" section (everything else) — reordering only ever makes sense among active entries.
  const [
    addableSortCols,
    isSortSearching,
    searchedFlatAddableSortCols,
    categorizedAddableSortCols,
  ] = addableLists(sortableCols, (key) => getSortIndex(key) !== null, ddSearchTerms.sort ?? '')
  const [
    addableGroupCols,
    isGroupSearching,
    searchedFlatAddableGroupCols,
    categorizedAddableGroupCols,
  ] = addableLists(groupableCols, (key) => groupBy.includes(key), ddSearchTerms.group ?? '')
  const [
    isColsSearching,
    searchedVisibleColumns,
    searchedAvailableColumns,
    categorizedAvailableCols,
    colsReorderEligible,
  ] = columnsDropdownLists(orderedColumns, visibleCols, ddSearchTerms.cols ?? '')
  // Snapshot of the left pane's column order, taken only at the moment the Filter dropdown opens
  // — active-filter columns first, then the rest (see `orderFilterColumnsByActive`'s own doc
  // comment, core, for why this is a snapshot rather than a live sort: reordering while a filter
  // is toggled with the panel still open would move a row out from under the pointer
  // mid-interaction). Comparing `openDD` against the previous render is React's own
  // documented pattern for "adjust state when a prop changes" — same shape as
  // `filterListResetKey`/`prevColumnKeys` elsewhere in this file — rather than an effect, so the
  // very first render with the panel open already has the fresh snapshot.
  const [filterColOrderKeys, setFilterColOrderKeys] = useState<string[] | null>(null)
  // Which categories are collapsed (see docs/columns.md's "Column categories"). Seeded the same way as
  // filterColOrderKeys above — a snapshot taken only on the closed→open transition, not
  // recomputed live while the panel stays open (so toggling a category by hand isn't fought by an
  // unrelated filter change elsewhere). Collapsed by default (matching Columns/Sort/Group's own
  // category submenus, which always start closed), except a category containing an active filter
  // at the moment the panel opens starts expanded instead — so opening the dropdown never hides
  // the very filter you're currently using behind a collapsed section with no visual sign why.
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  function toggleCategoryCollapsed(name: string): void {
    setCollapsedCategories((prev) => toggleCollapse(prev, name))
  }
  // A chip's column: selected by state, so neither the column search nor a collapsed category
  // can hide it (U25). A handler factory: react-hooks/refs rejects a ref write in a helper an
  // inline handler calls.
  const openFilterColumn = (key: string) => (): void => {
    pendingFilterColFocusKey.current = key
    setFilterActiveCol(key)
    setDdSearchTerms((prev) => ({ ...prev, filter: '' }))
    const category = filterableCols.find((c) => c.key === key)?.category
    if (category)
      setCollapsedCategories((prev) => {
        const next = new Set(prev)
        next.delete(category)
        return next
      })
    ddSetters.filter(true)
  }
  const [prevOpenDD, setPrevOpenDD] = useState(openDD)
  if (openDD !== prevOpenDD) {
    setPrevOpenDD(openDD)
    if (openDD === 'filter') {
      setFilterShowValues(false)
      const state = filterOpenState(
        filterableCols,
        filters,
        excludeFilters,
        rangeFilters,
        filterActiveCol,
      )
      setFilterColOrderKeys(state.orderKeys)
      setCollapsedCategories(state.collapsed)
      setFilterActiveCol(state.shownKey)
      setDdSearchTerms((prev) => ({ ...prev, filter: '' }))
    }
  }
  const isFilterColSearching = (ddSearchTerms.filter ?? '').trim() !== ''
  const searchedFilterableCols = applyColumnOrderSnapshot(
    filterableCols.filter((c) => columnMatchesSearch(c, ddSearchTerms.filter ?? '')),
    filterColOrderKeys,
  )
  // Buckets the (already searched/ordered) left-pane column list by category. Deliberately NOT
  // re-sorted alphabetically afterward — searchedFilterableCols is already active-filtered-first-
  // then-alphabetical (see its own comment above), not purely alphabetical, so re-sorting
  // categories here would undo that active-first bubbling for whichever category contains the
  // column currently being filtered on.
  const categorizedFilterCols = groupColumnsByCategory(searchedFilterableCols)
  const filterActiveKey =
    filterActiveCol && filterableCols.some((c) => c.key === filterActiveCol)
      ? filterActiveCol
      : (filterableCols[0]?.key ?? null)
  const filterDetailCol = filterableCols.find((c) => c.key === filterActiveKey) ?? null
  // One left-pane column row — shared by the flat uncategorized list and each category section
  // below (`.dt-filter-category-cols` indents the latter).
  const renderFilterColRow = (col: ColumnDef<TRow>) => {
    const hasActive = columnHasActiveFilter(col.key, filters, excludeFilters, rangeFilters)
    const isActive = col.key === filterActiveKey
    return (
      // The row (not the item button alone) carries the selected-column highlight, so it spans
      // the clear button too instead of stopping short of it — a <button> can't contain another
      // interactive element, so the clear button below is a sibling, not nested.
      <div
        key={col.key}
        data-filter-row-key={col.key}
        className={`dt-filter-col-row${isActive ? ' dt-filter-col-row--active' : ''}`}
      >
        {/* A real <button> (not a div) so it's a native Tab stop and Enter/Space "click" it for
            free — same fix as the Sort/Group add-lists above; this had the identical gap.
            `onFocus` (not just `onClick`) is what actually shows this column's detail pane — a
            listbox/radiogroup-style "focus follows selection", so arrow-key nav or Tab landing
            here needs no separate Enter/Space "activate" step; a click still works the same way,
            since focusing a button on click fires the same event. Guarded against re-selecting
            the already-active column so focusing it back (e.g. via ArrowLeft from the right pane)
            doesn't trigger a pointless state update. Delete/Backspace clearing the column's
            filter is handled by handleFilterPanelKeyDown (bound on the whole panel), not here —
            same action as the clear button below, reachable without leaving the row. */}
        <button
          type="button"
          data-filter-col-key={col.key}
          data-dd-row
          onFocus={() => {
            if (col.key !== filterActiveKey) setFilterActiveCol(col.key)
          }}
          onClick={() => {
            setFilterActiveCol(col.key)
            if (!narrowFilter) return
            setFilterShowValues(true)
            pendingFilterValuesFocus.current = true
          }}
          className={`dt-filter-col-item${isActive ? ' dt-filter-col-item--active' : ''}`}
          aria-current={isActive || undefined}
        >
          <span>{col.label}</span>
        </button>
        {/* Replaces the plain active-filter dot: a one-click way to drop this column's filter
            without opening it first, matching the toolbar's own per-dropdown × buttons (see
            "Toolbar clear buttons" in docs/toolbar.md). */}
        {hasActive && (
          <button
            type="button"
            className="dt-filter-col-clear"
            title={L.clearColumnFilter}
            aria-label={L.clearColumnFilter}
            onClick={(e) => {
              e.stopPropagation()
              // Clears every kind at once — this button means "drop this column's filter
              // entirely", unlike the active-bar's own per-kind chips.
              clearColumnFilter(col.key)
            }}
          >
            ×
          </button>
        )}
      </div>
    )
  }

  // Filter dropdown: ArrowRight/ArrowLeft cross between the left column pane and the right
  // detail pane; Up/Down/Home/End inside the right pane (the value checklist or date tree,
  // whichever is rendered for the column's type, plus the value-search box above them) get the
  // same nav every other dropdown's row list gets from Dropdown.tsx's own generic handler — this
  // one is deliberately separate (bound on the filterPanel div, a descendant of Dropdown's own
  // panel) since it needs to reach into filter-specific DOM (the virtualized checklist) that
  // generic handler knows nothing about. Bubbles up to Dropdown's handler when it doesn't apply
  // (e.g. Up/Down on a *left*-pane column button, which Dropdown's own `data-dd-row` query
  // already covers) by simply not calling preventDefault/stopPropagation in that case.
  const handleFilterPanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey) return
    const targetEl = e.target as HTMLElement
    const filterColBtn = targetEl.closest<HTMLElement>('[data-filter-col-key]')

    // Delete/Backspace on a focused left-pane column row clears that column's filter — the
    // keyboard equivalent of clicking its × clear button. Guarded to an actually-active column
    // so pressing it on an inert row is a true no-op (no page-reset churn from clearColumnFilter's
    // unconditional setPageState(1)).
    if ((e.key === 'Delete' || e.key === 'Backspace') && filterColBtn) {
      const key = filterColBtn.dataset.filterColKey
      const col = key && filterableCols.find((c) => c.key === key)
      if (col && columnHasActiveFilter(col.key, filters, excludeFilters, rangeFilters)) {
        e.preventDefault()
        clearColumnFilter(col.key)
      }
      return
    }

    if (filterColBtn && e.key === 'ArrowRight') {
      e.preventDefault()
      e.stopPropagation()
      if (narrowFilter) {
        setFilterShowValues(true)
        pendingFilterValuesFocus.current = true
        return
      }
      filterDetailFocusTarget(e.currentTarget.querySelector('[data-filter-detail]'))?.focus()
      return
    }

    const filterDetailEl = targetEl.closest<HTMLElement>('[data-filter-detail]')
    if (filterDetailEl && e.key === 'ArrowLeft') {
      const active = document.activeElement
      // Never hijack Left on an actual text/value-editing control — the value-search box, the
      // numeric/date range inputs, or a range-slider thumb — which all need their native
      // cursor/value behavior. Everything else in this pane (checklist/date-tree checkboxes,
      // select-all, the sort-order button) has no use for a bare Left, so it's free to reuse.
      const isEditable =
        active instanceof HTMLInputElement &&
        (active.type === 'text' ||
          active.type === 'number' ||
          active.type === 'date' ||
          active.type === 'range')
      if (!isEditable) {
        e.preventDefault()
        e.stopPropagation()
        if (narrowFilter) {
          setFilterShowValues(false)
          pendingFilterColFocusKey.current = filterActiveKey
          return
        }
        const cols = e.currentTarget.querySelector<HTMLElement>('[data-filter-cols]')
        for (const el of cols?.querySelectorAll<HTMLElement>('[data-filter-col-key]') ?? []) {
          if (el.dataset.filterColKey === filterActiveKey) {
            el.focus()
            break
          }
        }
        return
      }
    }
  }

  // Apart from `initialViewState`, which "Clear all" returns to
  const canClearAll = isViewClearable(table.getViewState())
  const hasAggregates = activeColumns.some((c) => c.aggregate !== undefined)
  const toolbarEndEl = hasToolbarEnd && <div className="dt-toolbar-end">{toolbarEnd}</div>
  // The divider separates the shape controls from the find ones: only drawn with both sides
  const hasShapeControls =
    (showColumns !== false && columns.length >= 2) ||
    groupableCols.length > 0 ||
    sortableCols.length > 0
  const hasFindControls = showSearch !== false || filterableCols.length > 0 || canClearAll

  const formatValue = (v: unknown, row: TRow, col: ColumnDef<TRow>) => {
    if (col.render) return col.render(v, row)
    if (col.format) return col.format(v, row)
    if (Array.isArray(v)) return v.join(', ')
    return v != null ? String(v) : ''
  }

  // aggregateFormat, else render, else format (formatAggregate); nothing for an empty aggregate
  const aggregateValue = (col: ColumnDef<TRow>, rows: TRow[]) => {
    if (!col.render || col.aggregateFormat) return formatAggregate(col, rows)
    const v = computeAggregate(col, rows)
    return v === undefined || v === null ? null : col.render(v, rows[0])
  }

  const cellValue = (row: TRow, col: ColumnDef<TRow>) =>
    formatValue(getColumnValue(col, row), row, col)

  // Render helpers (not components, so nothing remounts) for repeated markup; the dropdown ones
  // mirror Solid's DropdownParts.tsx. Ref-writing handlers stay inline JSX props (react-hooks/refs).
  const searchRow = (k: string) => (
    <div className="dt-dd-search-row">
      <DdSearchInput
        value={ddSearchTerms[k] ?? ''}
        onChange={(v) => setDdSearchTerms({ ...ddSearchTerms, [k]: v })}
        placeholder={L.filterSearchPlaceholder}
        clearLabel={L.clearSearch}
      />
    </div>
  )
  const clearButton = (
    kind: 'groups' | 'sorts' | 'filters',
    show: boolean,
    label: string,
    onClear: () => void,
  ) =>
    show && (
      <button
        type="button"
        onClick={onClear}
        title={label}
        aria-label={label}
        className={`dt-btn-clear dt-btn-clear--${kind}`}
      >
        ×
      </button>
    )
  const chipX = (label: string, onClick: () => void) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="dt-chip-x"
      onClick={(e) => {
        chipRemovalFocusTarget(e.currentTarget)?.focus()
        onClick()
      }}
    >
      ×
    </button>
  )
  const pageBtn = (label: string, onClick: () => void, disabled: boolean, glyph: string) => (
    <button
      type="button"
      className="dt-page-btn"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
    >
      {glyph}
    </button>
  )
  const dragHandle = (
    <span aria-hidden="true" className="dt-dd-drag-handle">
      ⠿
    </span>
  )
  // Activating a row moves it into another section (a different DOM node), hence the pending
  // refocus key — see pendingSortFocusKey. Handler factories: react-hooks/refs rejects a ref write
  // in a helper an inline handler calls.
  const addableRow =
    (attr: string, onAdd: (key: string) => () => void) =>
    (col: ColumnDef<TRow>, showCategory?: boolean) => (
      <button
        key={col.key}
        type="button"
        {...{ [attr]: col.key }}
        data-dd-row
        onClick={onAdd(col.key)}
        className="dt-dd-item dt-dd-item--click"
      >
        <span className="dt-flex1">{col.label}</span>
        {showCategory && col.category && (
          <span className="dt-dd-item-category">{col.category}</span>
        )}
      </button>
    )
  const addColRow = addableRow('data-col-key', (key) => () => {
    pendingColFocusKey.current = key
    toggleColVisibility(key)
  })
  const addGroupRow = addableRow('data-group-add-key', (key) => () => {
    pendingGroupFocusKey.current = key
    toggleGroup(key)
  })
  const addSortRow = addableRow('data-sort-add-key', (key) => () => {
    pendingSortFocusKey.current = key
    toggleSort(key)
  })
  // Uncategorized columns as plain rows, each category collapsed into a CategorySubmenu
  const categorizedList = (
    { uncategorized, categories }: ReturnType<typeof groupColumnsByCategory<ColumnDef<TRow>>>,
    openCategory: string | null,
    setOpenCategory: (update: (c: string | null) => string | null) => void,
    row: (col: ColumnDef<TRow>) => ReactNode,
  ) => [
    ...uncategorized.map((col) => row(col)),
    ...categories.map((category) => (
      <CategorySubmenu
        key={category.name}
        name={category.name}
        isOpen={openCategory === category.name}
        onOpen={() => setOpenCategory(() => category.name)}
        onClose={() => setOpenCategory((c) => (c === category.name ? null : c))}
      >
        {category.columns.map((col) => row(col))}
      </CategorySubmenu>
    )),
  ]

  return (
    <div className="dt" ref={rootRef}>
      {(hasShapeControls || hasFindControls || hasToolbarEnd) && (
        <div className="dt-toolbar">
          <div className="dt-toolbar-actions">
            {/* Columns — "Visible columns" (every shown column, draggable/Alt+↑↓-reorderable, in
              real table order) above "Available columns" (hidden columns, click to show; a
              categorized one collapses into a CategorySubmenu). Mirrors the Sort/Group
              active/addable split above — a checkbox no longer fit once "shown" and "hidden"
              needed visually distinct rows (draggable + remove vs. plain click-to-add), the same
              reason Sort/Group never used one either. Reordering only ever happens within
              Visible — Available is click-only, so nesting it into category submenus (impossible
              for Visible, since submenu rows can't also be a drag surface) creates no conflict. */}
            {showColumns !== false && columns.length >= 2 && (
              <Dropdown
                open={openDD === 'cols'}
                setOpen={ddSetters.cols}
                trigger={<ToolbarBtn>{L.columns}</ToolbarBtn>}
                onDragOver={onColRowsDragOver}
                onDrop={onColRowsDrop}
              >
                {/* Always mounted: a search matching nothing must not unmount the box and drop focus */}
                {searchRow('cols')}
                {searchedVisibleColumns.length > 0 && (
                  <div className="dt-dd-section">{L.columnsSection}</div>
                )}
                {searchedVisibleColumns.map((col) => (
                  // Draggable (+ Alt+↑/↓) reorders columnOrder, skipping hidden columns (moveVisibleBy)
                  // — same treatment as the Sort/Group active rows. dragover/drop are handled at the
                  // Dropdown panel level (see above), not per-row — that's what lets a drop past the
                  // last row still resolve to a valid target. Alt+↑/↓'s own neighbor lookup is scoped
                  // to colsReorderEligible while searching, so it only ever swaps two currently-shown
                  // rows, leaving anything hidden by the filter untouched at its own position.
                  <div
                    key={col.key}
                    data-col-row-key={col.key}
                    data-dd-row
                    tabIndex={0}
                    draggable
                    onDragStart={() => onColRowDragStart(col.key)}
                    onDragEnd={onColRowDragEnd}
                    onKeyDown={(e) =>
                      activeRowKeyDown(
                        e,
                        (delta) => {
                          // Focus drops to <body> after this reorder without an explicit refocus
                          pendingColFocusKey.current = col.key
                          moveVisibleColumnBy(col.key, delta, colsReorderEligible)
                        },
                        () => hideColumn(col),
                      )
                    }
                    className={`dt-dd-item dt-dd-item--col dt-dd-item--colrow${dragOverClass(dragOverColRowKey === col.key, dragOverColRowAfter)}`}
                  >
                    {dragHandle}
                    <span className="dt-flex1">{col.label}</span>
                    <RemoveButton
                      label={L.hideColumn}
                      onClick={(e) => {
                        e.stopPropagation()
                        hideColumn(col)
                      }}
                    />
                  </div>
                ))}
                {searchedVisibleColumns.length === 0 && searchedAvailableColumns.length === 0 && (
                  <NoMatchingColumns label={L.noMatchingColumns} />
                )}
                {searchedAvailableColumns.length > 0 && (
                  <>
                    <div className="dt-dd-section">{L.availableColumnsSection}</div>
                    {isColsSearching
                      ? searchedAvailableColumns.map((col) => addColRow(col, true))
                      : categorizedList(
                          categorizedAvailableCols,
                          openColsCategory,
                          setOpenColsCategory,
                          addColRow,
                        )}
                  </>
                )}
              </Dropdown>
            )}

            {/* Group before Sort — data is grouped first, then ordered (groups themselves, then
              rows within them), matching the Sort dropdown's own "Group order" section coming
              before "Active sorts" and the active bar's group-chips-before-sort-chips order.
              Both still "shape" the view (vs. Search/Filter narrowing it below) — see the
              divider below. */}
            {groupableCols.length > 0 && (
              <Dropdown
                open={openDD === 'group'}
                setOpen={ddSetters.group}
                trigger={<ToolbarBtn active={groupBy.length > 0}>{L.group}</ToolbarBtn>}
                extraTrigger={clearButton('groups', groupBy.length > 0, L.clearGroups, clearGroups)}
                onDragOver={onGroupRowsDragOver}
                onDrop={onGroupRowsDrop}
              >
                {groupBy.length > 0 && (
                  <>
                    <div className="dt-dd-section">{L.activeGroupsSection}</div>
                    {groupBy.map((key, i) => {
                      const col = groupableCols.find((c) => c.key === key)
                      return (
                        // Same treatment as the Sort active rows, minus a click action — a group
                        // entry has nothing to toggle (no direction), so the row is
                        // draggable/focusable purely for reordering (drag, or Alt+↑/↓ when
                        // focused); `×` remove is the only button. dragover/drop are handled at
                        // the Dropdown panel level (see above), not per-row — that's what lets a
                        // drop past the last row still resolve to a valid target.
                        <div
                          key={key}
                          data-group-key={key}
                          data-dd-row
                          draggable
                          tabIndex={0}
                          onDragStart={() => onGroupRowDragStart(key)}
                          onDragEnd={onGroupRowDragEnd}
                          onKeyDown={(e) =>
                            activeRowKeyDown(
                              e,
                              (delta) => moveGroupBy(key, delta),
                              () => {
                                pendingGroupFocusKey.current = key
                                removeGroup(key)
                              },
                            )
                          }
                          className={`dt-dd-item dt-dd-item--col dt-dd-item--grouprow${dragOverClass(dragOverGroupKey === key, dragOverGroupAfter)}`}
                        >
                          {dragHandle}
                          <span className="dt-sort-idx">{i + 1}</span>
                          <span className="dt-flex1">{col?.label ?? key}</span>
                          <RemoveButton
                            label={L.removeGroup(col?.label ?? key)}
                            onClick={() => {
                              // Same reasoning as Sort's remove-focus hand-off above.
                              pendingGroupFocusKey.current = key
                              removeGroup(key)
                            }}
                          />
                        </div>
                      )
                    })}
                  </>
                )}
                {addableGroupCols.length > 0 && (
                  <>
                    {/* Same search + alphabetize treatment as Sort's add list above, for the same
                      reason. */}
                    {searchRow('group')}
                    <div className="dt-dd-section">{L.groupSection}</div>
                    {isGroupSearching && searchedFlatAddableGroupCols.length === 0 && (
                      <NoMatchingColumns label={L.noMatchingColumns} />
                    )}
                    {isGroupSearching
                      ? searchedFlatAddableGroupCols.map((col) => addGroupRow(col, true))
                      : categorizedList(
                          categorizedAddableGroupCols,
                          openGroupCategory,
                          setOpenGroupCategory,
                          addGroupRow,
                        )}
                  </>
                )}
              </Dropdown>
            )}

            {/* Sort */}
            {sortableCols.length > 0 && (
              <Dropdown
                open={openDD === 'sort'}
                setOpen={ddSetters.sort}
                trigger={<ToolbarBtn active={sorts.length > 0}>{L.sort}</ToolbarBtn>}
                extraTrigger={clearButton('sorts', sorts.length > 0, L.clearSorts, clearSorts)}
                onDragOver={onSortRowsDragOver}
                onDrop={onSortRowsDrop}
              >
                {groupSortEntries.length > 0 && (
                  <>
                    <div className="dt-dd-section">{L.groupOrderSection}</div>
                    <div className="dt-dd-hint">{L.groupOrderHint}</div>
                    {groupSortEntries.map((entry, i) => {
                      const col = columns.find((c) => c.key === entry.key)
                      // Not draggable, no Alt+↑/↓ reorder — nesting order always follows groupBy's
                      // own order (see the Group dropdown), so reordering here would be a no-op;
                      // direction is still toggleable/removable in place, same as any other entry.
                      return (
                        <div
                          key={entry.key}
                          tabIndex={0}
                          onClick={() => toggleSortDir(entry.key)}
                          onKeyDown={(e) =>
                            activeRowKeyDown(
                              e,
                              undefined,
                              () => {
                                pendingSortFocusKey.current = entry.key
                                removeSort(entry.key)
                              },
                              () => toggleSortDir(entry.key),
                            )
                          }
                          className="dt-dd-item dt-dd-item--col dt-dd-item--sortrow dt-dd-item--locked"
                        >
                          <span className="dt-sort-idx">{i + 1}</span>
                          <span className="dt-flex1">{col?.label ?? entry.key}</span>
                          <span className="dt-sort-icon dt-sort-icon--active">
                            {getSortIcon(entry.key)}
                          </span>
                          <RemoveButton
                            label={L.removeSort(col?.label ?? entry.key)}
                            onClick={(e) => {
                              e.stopPropagation()
                              pendingSortFocusKey.current = entry.key
                              removeSort(entry.key)
                            }}
                          />
                        </div>
                      )
                    })}
                  </>
                )}
                {nonGroupSortEntries.length > 0 && (
                  <>
                    <div className="dt-dd-section">{L.activeSortsSection}</div>
                    {nonGroupSortEntries.map((entry, i) => {
                      const col = columns.find((c) => c.key === entry.key)
                      return (
                        // The whole row is the click target (toggles direction) and the drag source
                        // (reorder priority); `×` stays a separate <button> (draggable=false so
                        // starting a drag from it doesn't also drag the row) since removing isn't
                        // something a row click/drag should ever trigger. tabIndex + onKeyDown give
                        // it Alt+↑/↓ reorder and Enter/Space-to-toggle from the keyboard — a plain
                        // div gets no free keyboard activation the way a real <button> would (unlike
                        // the add-list below, which doesn't need custom keyboard handling).
                        // dragover/drop are handled at the Dropdown panel level (see above), not
                        // per-row — that's what lets a drop past the last row still resolve to a
                        // valid target.
                        <div
                          key={entry.key}
                          data-sort-key={entry.key}
                          data-dd-row
                          draggable
                          tabIndex={0}
                          onDragStart={() => onSortRowDragStart(entry.key)}
                          onDragEnd={onSortRowDragEnd}
                          onClick={() => toggleSortDir(entry.key)}
                          onKeyDown={(e) =>
                            activeRowKeyDown(
                              e,
                              (delta) => {
                                // Swap within this non-group subset, not the raw sorts array, where
                                // a group entry can sit between two non-group ones
                                const neighbor = nonGroupSortEntries[i + delta]
                                if (!neighbor) return false
                                moveSort(entry.key, neighbor.key, delta > 0)
                              },
                              () => {
                                pendingSortFocusKey.current = entry.key
                                removeSort(entry.key)
                              },
                              () => toggleSortDir(entry.key),
                            )
                          }
                          className={`dt-dd-item dt-dd-item--col dt-dd-item--sortrow${dragOverClass(dragOverSortKey === entry.key, dragOverSortAfter)}`}
                        >
                          {dragHandle}
                          <span className="dt-sort-idx">{i + 1}</span>
                          <span className="dt-flex1">{col?.label ?? entry.key}</span>
                          <span className="dt-sort-icon dt-sort-icon--active">
                            {getSortIcon(entry.key)}
                          </span>
                          <RemoveButton
                            label={L.removeSort(col?.label ?? entry.key)}
                            onClick={(e) => {
                              e.stopPropagation()
                              // Removing this entry unmounts this whole row (a different JSX subtree
                              // than the addable button it's about to become again — see
                              // pendingSortFocusKey above), so focus needs an explicit hand-off.
                              pendingSortFocusKey.current = entry.key
                              removeSort(entry.key)
                            }}
                          />
                        </div>
                      )
                    })}
                  </>
                )}
                {addableSortCols.length > 0 && (
                  <>
                    {/* Search box narrows this "add" list only — the active-sorts section above
                    keeps its own priority order and is never hidden by it, since it's a short,
                    already-visible list with its own remove/reorder controls. */}
                    {searchRow('sort')}
                    <div className="dt-dd-section">{L.sortSection}</div>
                    {isSortSearching && searchedFlatAddableSortCols.length === 0 && (
                      <NoMatchingColumns label={L.noMatchingColumns} />
                    )}
                    {isSortSearching
                      ? searchedFlatAddableSortCols.map((col) => addSortRow(col, true))
                      : categorizedList(
                          categorizedAddableSortCols,
                          openSortCategory,
                          setOpenSortCategory,
                          addSortRow,
                        )}
                  </>
                )}
              </Dropdown>
            )}

            {endFirst && toolbarEndEl}
            {/* Divider between the "shape" controls above (Columns/Sort/Group) and the "find"
              controls below (Search/Filter). */}
            {!endFirst && hasShapeControls && hasFindControls && (
              <span className="dt-toolbar-divider" />
            )}

            {showSearch !== false && (
              <span className="dt-search-wrap">
                <input
                  ref={searchInputRef}
                  type="text"
                  className="dt-search-input"
                  placeholder={L.search}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery !== '' && (
                  <button
                    type="button"
                    className="dt-search-clear"
                    onClick={() => {
                      setSearchQuery('')
                      focusSearch()
                    }}
                    title={L.clearSearch}
                    aria-label={L.clearSearch}
                  >
                    ×
                  </button>
                )}
              </span>
            )}

            {/* Filter */}
            {filterableCols.length > 0 && (
              <Dropdown
                open={openDD === 'filter'}
                setOpen={ddSetters.filter}
                trigger={<ToolbarBtn active={activeFilterCount > 0}>{L.filter}</ToolbarBtn>}
                extraTrigger={clearButton(
                  'filters',
                  activeFilterCount > 0,
                  L.clearFilters,
                  clearFilters,
                )}
              >
                <div
                  className={`dt-filter-panel${narrowFilter ? ' dt-filter-panel--narrow' : ''}`}
                  onKeyDown={handleFilterPanelKeyDown}
                >
                  {(!narrowFilter || !filterShowValues) && (
                    <div className="dt-filter-cols" data-filter-cols>
                      {/* Order: filterColOrderKeys, snapshotted on open (active filters first) */}
                      <DdSearchInput
                        value={ddSearchTerms.filter ?? ''}
                        onChange={(v) => setDdSearchTerms({ ...ddSearchTerms, filter: v })}
                        placeholder={L.filterSearchPlaceholder}
                        clearLabel={L.clearSearch}
                        filterCols
                      />
                      {searchedFilterableCols.length === 0 && (
                        <NoMatchingColumns label={L.noMatchingColumns} />
                      )}
                      {categorizedFilterCols.uncategorized.map(renderFilterColRow)}
                      {categorizedFilterCols.categories.map((category) => {
                        // While searching, a category only ever renders here at all when it has a
                        // matching column (categorizedFilterCols buckets the already-searched list)
                        // — so force it open rather than let a stale collapsed snapshot hide the very
                        // match the search just surfaced, with no visible sign it's there.
                        // collapsedCategories is untouched, so clearing the search restores it.
                        const isCollapsed =
                          !isFilterColSearching && collapsedCategories.has(category.name)
                        return (
                          <div key={category.name} className="dt-filter-category">
                            <button
                              type="button"
                              className="dt-filter-category-header"
                              data-dd-row
                              data-filter-category-header={category.name}
                              aria-expanded={!isCollapsed}
                              onClick={() => toggleCategoryCollapsed(category.name)}
                            >
                              <span className="dt-filter-category-toggle">
                                {isCollapsed ? '▶' : '▼'}
                              </span>
                              <span className="dt-flex1">{category.name}</span>
                            </button>
                            {!isCollapsed && (
                              <div className="dt-filter-category-cols">
                                {category.columns.map(renderFilterColRow)}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {narrowFilter && filterShowValues && (
                    <button
                      type="button"
                      className="dt-dd-item dt-dd-item--click dt-filter-back"
                      data-filter-back
                      onClick={() => {
                        setFilterShowValues(false)
                        pendingFilterColFocusKey.current = filterActiveKey
                      }}
                    >
                      ‹ {L.columns} · {filterDetailCol?.label}
                    </button>
                  )}
                  {filterDetailCol && (!narrowFilter || filterShowValues) && (
                    <FilterPane
                      key={filterDetailCol.key}
                      table={table}
                      data={data}
                      columns={columns}
                      col={filterDetailCol}
                    />
                  )}
                </div>
              </Dropdown>
            )}

            {/* "Clear all" sits alone at the far right of the actions row (`.dt-clear-all`'s
              margin-left: auto) — nothing else in the row needs to reflow when it mounts/unmounts,
              unlike the old layout where it sat between search and the stats text. */}
            {canClearAll && (
              <button
                type="button"
                className="dt-btn dt-clear-all"
                onClick={() => {
                  clearAll()
                  focusSearch()
                }}
              >
                {L.clearAll}
              </button>
            )}
            {!endFirst && toolbarEndEl}
          </div>
        </div>
      )}

      {/* Active state bar, always rendered so the stats keep one home (docs/toolbar.md) */}
      <div className="dt-active-bar">
        {/* Each chip's body is a real <button> (a sibling of the × button, not nested inside it —
            a <button> can't contain another interactive element, same reasoning as the toolbar's
            grouped clear buttons above) that does something specific to that chip's own kind of
            active state (docs/toolbar.md's "Active-bar chip click actions"). */}
        {/* Group chips render before sort chips — matches the Sort dropdown's own "Group order"
            section coming before "Active sorts", since grouping is the structural, primary
            concern and tie-break sorting is secondary. */}
        {groupBy.map((key) => {
          const col = groupableCols.find((c) => c.key === key)
          return (
            <span key={key} className="dt-chip">
              {/* Opens the Group dropdown focused on this entry's row — there's no single
                    obvious inline toggle for a group entry the way direction is for sort, so
                    getting straight to it (ready to reorder/remove) is the most useful available
                    action. Reuses pendingGroupFocusKey (see above) since it already matches on
                    the same data-group-key the dropdown's own active row carries. */}
              <button
                type="button"
                onClick={() => {
                  pendingGroupFocusKey.current = key
                  ddSetters.group(true)
                }}
                className="dt-chip-body"
                aria-label={L.groupedBy(col?.label ?? key)}
              >
                {/* ⊞ tells it apart from the same column's sort chip (U6), groupedBy for screen readers (U28) */}
                <span aria-hidden="true">⊞</span> {col?.label ?? key}
              </button>
              {chipX(L.removeGroup(col?.label ?? key), () => removeGroup(key))}
            </span>
          )
        })}
        {sorts.map((entry) => {
          const col = columns.find((c) => c.key === entry.key)
          return (
            <span key={entry.key} className="dt-chip">
              {/* Toggles direction in place — the same action the Sort dropdown's own
                    active-sort row already uses — no dropdown needed for the single most common
                    tweak. `entry.key` keeps this button's identity (and DOM node) stable across
                    the toggle, so it stays focused for free with no explicit refocus needed,
                    unlike Group/Filter above (whose click opens a not-yet-mounted dropdown
                    panel). */}
              <button
                type="button"
                className="dt-chip-body"
                onClick={() => toggleSortDir(entry.key)}
              >
                {getSortIcon(entry.key)} {col?.label ?? entry.key}
              </button>
              {chipX(L.removeSort(col?.label ?? entry.key), () => removeSort(entry.key))}
            </span>
          )
        })}
        {activeFilterCount > 0 &&
          Object.entries(filters)
            .filter(([, v]) => v.size > 0)
            .map(([key, vals]) => (
              <span key={key} className="dt-chip dt-chip--filter">
                {/* Opens the Filter dropdown straight to this column's detail pane, instead of
                    making you reopen the dropdown and re-find the column in the left list to
                    tweak a filter you already have active. Setting filterActiveCol here (rather
                    than relying solely on the column button's own onFocus/"focus follows
                    selection") means the right pane is already correct on the very first render,
                    before focus even lands on the button — both state updates are batched into
                    the same commit. */}
                <button type="button" className="dt-chip-body" onClick={openFilterColumn(key)}>
                  {columns.find((c) => c.key === key)?.label}:{' '}
                  {summarizeFilterValues(
                    vals,
                    L.moreValues,
                    (v) =>
                      formatFilterValue(
                        columns.find((c) => c.key === key),
                        v,
                        L.emptyValue,
                      ),
                    chipSeparator(
                      filterMatchMode(
                        filterModes,
                        key,
                        columns.find((c) => c.key === key),
                        data,
                      ),
                    ),
                  )}
                </button>
                {chipX(L.clearColumnFilter, () => clearColumnFilter(key, 'include'))}
              </span>
            ))}
        {activeFilterCount > 0 &&
          // Exclude filters (see cycleFilterValue in the docs) get their own chip, distinguished
          // by a "≠" prefix instead of a translated word — same reasoning the sort/value-sort
          // icons already use symbols (↑/↓, ABC/#) rather than growing every locale file.
          // chipExclude tints it apart from a plain include chip so the two read as opposite
          // actions at a glance, not just different text.
          Object.entries(excludeFilters)
            .filter(([, v]) => v.size > 0)
            .map(([key, vals]) => {
              const col = columns.find((c) => c.key === key)
              // Names the kept values when fewer are kept than hidden
              const chip = exclusionChip(vals, exclusionAllValues[key])
              return (
                <span
                  key={`exclude-${key}`}
                  className={`dt-chip dt-chip--filter${chip.kept ? '' : ' dt-chip--exclude'}`}
                >
                  <button type="button" className="dt-chip-body" onClick={openFilterColumn(key)}>
                    {col?.label}: {chip.kept ? '' : '≠ '}
                    {summarizeFilterValues(chip.values, L.moreValues, (v) =>
                      formatFilterValue(col, v, L.emptyValue),
                    )}
                  </button>
                  {chipX(L.clearColumnFilter, () => clearColumnFilter(key, 'exclude'))}
                </span>
              )
            })}
        {activeFilterCount > 0 &&
          // A range filter (number or date) didn't get a chip at all before — it's a distinct
          // active filter from the checklist above, so it needs its own (a date column can have
          // both active at once).
          Object.entries(rangeFilters)
            .filter(([, rf]) => rf.min !== '' || rf.max !== '')
            .map(([key, rf]) => (
              <span key={`range-${key}`} className="dt-chip dt-chip--filter">
                <button type="button" className="dt-chip-body" onClick={openFilterColumn(key)}>
                  {columns.find((c) => c.key === key)?.label}:{' '}
                  {rangeChipText(
                    columns.find((c) => c.key === key),
                    rf,
                    L.emptyValue,
                  )}
                </button>
                {chipX(L.clearColumnFilter, () => clearColumnFilter(key, 'range'))}
              </span>
            ))}
        <span className="dt-stats">
          {L.rowCount(processedData.length, data.length)}
          {groupBy.length > 0 && L.groupCount(new Set(groupedData.map((g) => g.key)).size)}
        </span>
      </div>

      {/* Table */}
      <div className="dt-table-wrap" ref={wrapRef}>
        <table className="dt-table">
          <thead>
            <tr>
              {selectable && (
                <th
                  className="dt-th dt-check-cell"
                  style={{ width: 36 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (e.target === e.currentTarget) toggleSelectAll(processedData)
                  }}
                >
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    aria-label={L.selectAll}
                    onChange={() => toggleSelectAll(processedData)}
                  />
                </th>
              )}
              {groupBy.length > 0 && (
                <th className="dt-th dt-th--no-sort" style={{ width: 28 }}>
                  <span className="dt-sr-only">{L.expandCollapse}</span>
                </th>
              )}
              {/* Only sorts entries for a currently-rendered header count toward numbering — a
                  groupBy column can have its own sort entry (sortWithinGroups uses it to order
                  the groups themselves), but it has no header of its own to attach a number to,
                  and leaving it in would shift every later header's number for no visible reason. */}
              {(() => {
                const headerSorts = sorts.filter((s) => activeColumns.some((c) => c.key === s.key))
                return activeColumns.map((col) => {
                  const sortDir = headerSorts.find((s) => s.key === col.key)?.dir
                  const isSorted = sortDir !== undefined
                  // A number is only useful to disambiguate priority when more than one visible
                  // header is sorted — with just one, "1↑" is noise next to a plain "↑".
                  const sortIdx =
                    isSorted && headerSorts.length > 1
                      ? getHeaderSortIndex(headerSorts, col.key)
                      : null
                  const icon = isSorted ? getHeaderSortIcon(headerSorts, col.key) : '↕'
                  const filtered = columnHasActiveFilter(
                    col.key,
                    filters,
                    excludeFilters,
                    rangeFilters,
                  )
                  const labelAndIcon = (
                    <>
                      {col.label}
                      {col.sortable !== false && (
                        <span
                          className={`dt-sort-icon${isSorted ? ' dt-sort-icon--active' : ''}`}
                          aria-hidden="true"
                        >
                          {sortIdx ? `${sortIdx}${icon}` : icon}
                        </span>
                      )}
                    </>
                  )
                  return (
                    <th
                      key={col.key}
                      data-col-key={col.key}
                      aria-sort={
                        sortDir ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined
                      }
                      className={`dt-th${col.pinned ? ' dt-pinned' : ''}${dragOverColKey === col.key ? ' dt-dd-item--drag-over' : ''}`}
                      draggable
                      onDragStart={() => setDragColKey(col.key)}
                      onDragOver={(e) => {
                        e.preventDefault()
                        if (dragColKey && dragColKey !== col.key) setDragOverColKey(col.key)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (dragColKey && dragColKey !== col.key) moveColumn(dragColKey, col.key)
                        setDragColKey(null)
                        setDragOverColKey(null)
                      }}
                      onDragEnd={() => {
                        setDragColKey(null)
                        setDragOverColKey(null)
                      }}
                      style={{ width: col.width }}
                      // Plain click: sort by this column alone, discarding other active sorts.
                      // Shift-click: add this column to the multi-sort (or flip its direction if
                      // it's already in it) — never removes, so it can't surprise-clear a sort or
                      // bump a column to the end of the priority stack; that's the chip ×/dropdown's job.
                      // No-op entirely when the column opts out via sortable: false.
                      onClick={(e) => {
                        if (col.sortable === false) return
                        if (e.shiftKey) appendOrToggleSort(col.key)
                        else replaceSort(col.key)
                      }}
                    >
                      <span className="dt-th-inner">
                        {/* Takes the free space before the label, since the menu's auto margin defeats justifyContent */}
                        {getColumnAlign(col) && <span className="dt-th-spacer" />}
                        {/* A button so keyboard users can sort; its click bubbles to the <th>'s handler */}
                        {col.sortable === false ? (
                          labelAndIcon
                        ) : (
                          <button type="button" className="dt-th-sort">
                            {labelAndIcon}
                          </button>
                        )}
                        <HeaderMenu
                          menuLabel={L.columnMenu(col.label, false)}
                          column={col.label}
                          label={L.columnMenu(col.label, filtered)}
                          labels={L}
                          items={getHeaderMenuItems(col, groupBy, activeColumns.length, filtered)}
                          filtered={filtered}
                          filterPane={
                            <FilterPane table={table} data={data} columns={columns} col={col} />
                          }
                          onClearFilter={() => {
                            clearColumnFilter(col.key)
                          }}
                          onGroup={() => toggleGroup(col.key)}
                          onHide={() => toggleColVisibility(col.key)}
                        />
                      </span>
                    </th>
                  )
                })
              })()}
            </tr>
          </thead>
          <tbody>
            {groupedData.map(({ key: gkey, keyParts, rows, pageRows, continued }) => {
              const isCollapsed =
                gkey !== null && isGroupCollapsed(collapsedGroups, gkey, defaultGroupsCollapsed)
              return [
                gkey !== null && (
                  <tr
                    key={`g-${gkey}`}
                    onKeyDown={(e) => handleKeyDown(e, { kind: 'group', key: gkey })}
                    onFocus={() => setFocusTarget({ kind: 'group', key: gkey })}
                    className="dt-group-row"
                    onClick={() => {
                      toggleGroupCollapse(gkey)
                      // A click anywhere on the row makes its toggle the tab stop, as a data row's click does
                      rowRefs.current.get(gkey)?.focus({ preventScroll: true })
                    }}
                  >
                    <td
                      colSpan={activeColumns.length + (selectable ? 2 : 1)}
                      className="dt-group-td"
                    >
                      <div className="dt-group-label">
                        {selectable && (
                          <span
                            className="dt-group-check dt-check-cell"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (e.target === e.currentTarget) toggleSelectAll(rows)
                            }}
                          >
                            <input
                              ref={(el) => {
                                if (el) el.indeterminate = groupSomeSelected(rows)
                              }}
                              type="checkbox"
                              checked={groupAllSelected(rows)}
                              aria-label={L.selectGroup(
                                groupText(columns, groupBy, keyParts, rows[0]),
                              )}
                              onChange={() => toggleSelectAll(rows)}
                            />
                          </span>
                        )}
                        {/* The group's tab stop: a row can't carry aria-expanded outside a treegrid */}
                        <button
                          type="button"
                          className="dt-group-arrow dt-group-toggle"
                          ref={(el) => {
                            if (el) rowRefs.current.set(gkey, el)
                            else rowRefs.current.delete(gkey)
                          }}
                          tabIndex={isFocusTarget({ kind: 'group', key: gkey }) ? 0 : -1}
                          aria-expanded={!isCollapsed}
                          aria-label={groupText(columns, groupBy, keyParts, rows[0])}
                        >
                          {isCollapsed ? '▶' : '▼'}
                        </button>
                        <span className="dt-group-text">
                          {groupBy.map((g, i) => {
                            const col = columns.find((c) => c.key === g)
                            // A bucketed group (see groupValue/groupFormat) has no single row whose
                            // real value *is* the group — the sample row's own value/format would
                            // show e.g. a raw "47%" instead of the "40–50%" bucket it landed in — so
                            // its label renders from the group's own keyPart via groupFormat instead
                            // of the normal cellValue/format pipeline.
                            const label = col?.groupValue
                              ? (col.groupFormat?.(keyParts[i]) ?? keyParts[i])
                              : (() => {
                                  const raw = col ? getColumnValue(col, rows[0]) : undefined
                                  const value = Array.isArray(raw) ? keyParts[i] : raw
                                  return col
                                    ? formatValue(value, rows[0], col)
                                    : String(value ?? '')
                                })()
                            return (
                              <span key={g}>
                                {i > 0 && <span className="dt-group-sep"> › </span>}
                                <span className="dt-group-colname">{col?.label ?? g}:</span> {label}
                              </span>
                            )
                          })}
                          {continued && (
                            <>
                              {' '}
                              <span className="dt-group-continued">{L.groupContinued}</span>
                            </>
                          )}{' '}
                          <span className="dt-group-count">{L.rowsInGroup(rows.length)}</span>
                        </span>
                      </div>
                    </td>
                  </tr>
                ),
                gkey !== null && hasAggregates && (
                  <tr key={`agg-${gkey}`} className="dt-agg-row">
                    {selectable && <td className="dt-agg-td" style={{ width: 36 }} />}
                    <td className="dt-agg-td" style={{ width: 28 }} />
                    {activeColumns.map((col) => {
                      return (
                        <td
                          key={col.key}
                          className={col.pinned ? 'dt-agg-td dt-pinned' : 'dt-agg-td'}
                          data-col-key={col.key}
                          style={{ textAlign: getColumnAlign(col) }}
                        >
                          {aggregateValue(col, rows)}
                        </td>
                      )
                    })}
                  </tr>
                ),
                !isCollapsed &&
                  pageRows.map((row, ri) => (
                    <tr
                      key={table.getRowId ? table.getRowId(row) : `${gkey}-${ri}`}
                      ref={(el) => {
                        if (el) rowRefs.current.set(row, el)
                        else rowRefs.current.delete(row)
                      }}
                      tabIndex={
                        rowNavEnabled ? (isFocusTarget({ kind: 'row', row }) ? 0 : -1) : undefined
                      }
                      aria-selected={selectable ? selection.has(row) : undefined}
                      aria-current={isSameRow(row, currentRow, table.getRowId) ? 'true' : undefined}
                      className={trClass(
                        !!selectable && selection.has(row),
                        ri % 2 !== 0,
                        !!onRowClick,
                        isSameRow(row, currentRow, table.getRowId),
                        rowClass?.(row),
                      )}
                      onKeyDown={
                        rowNavEnabled ? (e) => handleKeyDown(e, { kind: 'row', row }) : undefined
                      }
                      onFocus={
                        rowNavEnabled ? () => setFocusTarget({ kind: 'row', row }) : undefined
                      }
                      onClick={onRowClick ? (e) => onRowClick(row, e) : undefined}
                    >
                      {selectable && (
                        <td
                          className="dt-td dt-check-cell"
                          style={{ width: 36 }}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (e.target === e.currentTarget) toggleRowSelection(row, e.shiftKey)
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selection.has(row)}
                            readOnly
                            aria-label={L.selectRow(rowText(activeColumns, row))}
                            tabIndex={-1}
                            onClick={(e) => toggleRowSelection(row, e.shiftKey)}
                          />
                        </td>
                      )}
                      {gkey !== null && <td className="dt-td" style={{ width: 28 }} />}
                      {activeColumns.map((col) => (
                        <td
                          key={col.key}
                          className={col.pinned ? 'dt-td dt-pinned' : 'dt-td'}
                          data-col-key={col.key}
                          style={{ textAlign: getColumnAlign(col) }}
                        >
                          {cellValue(row, col)}
                        </td>
                      ))}
                    </tr>
                  )),
              ]
            })}
            {processedData.length === 0 && (
              <tr>
                <td
                  colSpan={
                    activeColumns.length + (selectable ? 1 : 0) + (groupBy.length > 0 ? 1 : 0)
                  }
                  className="dt-td dt-empty"
                >
                  {data.length === 0 ? (
                    L.noRows
                  ) : (
                    <>
                      {L.noMatchingRows}{' '}
                      <button
                        type="button"
                        className="dt-btn"
                        onClick={() => {
                          clearFilters()
                          setSearchQuery('')
                          focusSearch()
                        }}
                      >
                        {L.clearSearchAndFilters}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageSize > 0 && showsPager(visibleItems.length, pageSizes) && (
        <div className="dt-pagination">
          {numPages > 1 && (
            <>
              {pageBtn(L.firstPage, () => setPage(1), page === 1, '«')}
              {pageBtn(L.previousPage, () => setPage(page - 1), page === 1, '‹')}
              <span className="dt-page-info">{L.pageOf(page, numPages)}</span>
              {pageBtn(L.nextPage, () => setPage(page + 1), page >= numPages, '›')}
              {pageBtn(L.lastPage, () => setPage(numPages), page >= numPages, '»')}
            </>
          )}
          <label className="dt-rows-per-page-group">
            <span className="dt-rows-per-page">{L.rowsPerPage}:</span>
            <select
              className="dt-page-select"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              {pageSizes.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div role="status" className="dt-status">
        {tableStatus(L, processedData.length, data.length, page, numPages)}
      </div>
    </div>
  )
}
