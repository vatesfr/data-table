<script setup lang="ts" generic="TRow extends object">
import { computed, ref, toRaw, watch, nextTick, useSlots, onMounted, onBeforeUnmount } from 'vue'
import {
  computeAggregate,
  getColumnValue,
  cellText,
  rowText,
  groupText,
  isGroupCollapsed,
  isSameVisibleItem,
  indexOfVisibleItem,
  paginateVisibleItems,
  mergePageSizeOptions,
  getCrossPageFocusTarget,
  getSortIndex as getHeaderSortIndex,
  getSortIcon as getHeaderSortIcon,
  summarizeFilterValues,
  filterMatchMode,
  chipSeparator,
  formatFilterValue,
  rangeChipText,
  columnHasActiveFilter,
  orderFilterColumnsByActive,
  applyColumnOrderSnapshot,
  alphabetizedByLabel,
  columnMatchesSearch,
  groupColumnsByCategory,
  categorizedAlphabetizedByLabel,
  moveVisibleColumnBy as _moveVisibleColumnBy,
  type PagedGroup,
  type VisibleItem,
  watchMedia,
  FILTER_NARROW_QUERY,
  exclusionChip,
  isExcludeOnlyColumn,
} from '@vates/data-table-core/internal'
import { type SortEntry } from '@vates/data-table-core'
import type { ColumnDef, DataTableViewInternalProps } from './types'
import Dropdown from './components/Dropdown.vue'
import CategorySubmenu from './components/CategorySubmenu.vue'
import HeaderMenu from './components/HeaderMenu.vue'
import FilterPane from './components/FilterPane.vue'
import ToolbarBtn from './components/ToolbarBtn.vue'
import { vIndeterminate } from './directives/vIndeterminate'
import { useDropdownReorder } from './composables/useDropdownReorder'
import { useSelfDetectedListener } from './composables/useSelfDetectedListener'

// Vue casts an absent boolean prop with no explicit default to `false`, not `undefined` — an
// explicit `true` default is required here so an omitted `showSearch` still shows the search box
// (same gotcha `<DataTable>`'s own `defaultGroupsCollapsed` default works around).
const props = withDefaults(defineProps<DataTableViewInternalProps<TRow>>(), {
  rowKey: 'id',
  showSearch: true,
  showColumns: true,
})

const emit = defineEmits<{
  selectionChange: [rows: TRow[]]
  rowClick: [row: TRow, event: MouseEvent | KeyboardEvent]
}>()

const slots = useSlots()

// vnode.props holds the raw incoming listeners regardless of the emits declaration above
// (declared emits are stripped from $attrs), so this is the only reliable way to detect
// whether the caller passed a @row-click listener directly on this component. The
// `<DataTable>` wrapper always forwards the row-click emit itself (so clicks still fire
// regardless of listener presence, matching the underlying emit's own semantics) and instead
// passes its own listener-presence check through explicitly via `rowClickable` — falling back
// to self-detection here only when `<DataTableView>` is used directly, with no such prop.
//
// See useSelfDetectedListener for why this needs onUpdated rather than a plain computed over
// vnode.props directly.
const selfDetectedRowClickable = useSelfDetectedListener('onRowClick')
const isRowClickable = computed(() => props.rowClickable ?? selfDetectedRowClickable.value)

function handleRowClick(row: TRow, event: MouseEvent | KeyboardEvent) {
  emit('rowClick', row, event)
}

// `props.table`'s own fields are namespaced by concern (see docs/table-state.md's "Namespaced TableState")
// — destructured here into the same bare local names this file's script and template already
// use throughout, so nothing below this block (including every `<template>` binding, since
// `<script setup>` auto-exposes top-level `const`s to the template) needed to change when the
// namespacing landed.
const { processedData, groupedData, visibleItems, labels: L, clearAll } = props.table
const {
  visible: visibleCols,
  active: activeColumns,
  ordered: orderedColumns,
  toggleVisibility: toggleColVisibility,
  move: moveColumn,
  moveVisibleBy: moveVisibleColumnBy,
} = props.table.columns
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
} = props.table.sort
const {
  include: filters,
  exclude: excludeFilters,
  ranges: rangeFilters,
  modes: filterModes,
  activeCount: activeFilterCount,
  clearColumn: clearColumnFilter,
  clear: clearFilters,
} = props.table.filter
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
} = props.table.group
const {
  all: selection,
  rows: selectedRows,
  toggle: toggleRowSelection,
  toggleAll: toggleSelectAll,
} = props.table.selection
const { page, pageSize, numPages, setPage, setPageSize } = props.table.pagination
const { query: searchQuery, setQuery: setSearchQuery } = props.table.search
// `focusTarget`/`setFocusTarget` used to be local `shallowRef`/function here — lifted to
// `useTableState` (`table.focus.target`/`setTarget`) so it's reachable/settable from outside the
// rendered table (see `focus.moveTo`'s own doc comment there); everything below still reads/
// writes it through these same bare local names.
const { target: focusTarget, setTarget: setFocusTarget } = props.table.focus

// Split for the Sort dropdown's active list and the active-bar chips (see "Auto-syncing group
// order with sort" in docs/grouped-columns.md): entries matching a currently grouped column always govern
// nesting order via groupBy's own order, never via drag position within `sorts` — mixing them
// into one flat draggable list (or showing two identically-labeled chips) made it look like
// dragging a tie-break column above a group column changed something when it never could
// (issue #17's follow-up). `groupSortEntries` is in groupBy's own order (skipping a grouped
// column with no matching sort entry); `nonGroupSortEntries` is the actual freely-reorderable
// tie-break priority stack / the chips for non-grouped sorts.
const groupSortEntries = computed(() =>
  groupBy.value
    .map((key) => sorts.value.find((s) => s.key === key))
    .filter((s): s is SortEntry => s !== undefined),
)
const nonGroupSortEntries = computed(() =>
  sorts.value.filter((s) => !groupBy.value.includes(s.key)),
)

watch(selectedRows, (rows) => {
  emit('selectionChange', rows)
})

// Roving tabindex: exactly one item (a data row or a group header row) is a Tab stop at a time
// (the rest are tabindex="-1"), arrow keys move it — mirrors the anchor/range idea the
// checklist/date-tree checkboxes already use for shift-click. Data rows only join the tab
// sequence when they're actually interactive; group headers always do, since collapsing a group
// is already a click away regardless of selectable/onRowClick.
const rowRefs = new Map<TRow | string, HTMLTableRowElement>()

const isRowNavEnabled = computed(() => props.selectable || isRowClickable.value)
const pageVisibleItems = computed(() =>
  paginateVisibleItems(visibleItems.value, page.value, pageSize.value),
)
const navigableItems = computed(() =>
  pageVisibleItems.value.filter((item) => item.kind === 'group' || isRowNavEnabled.value),
)
const effectiveFocusTarget = computed(() =>
  focusTarget.value && indexOfVisibleItem(navigableItems.value, focusTarget.value) !== -1
    ? focusTarget.value
    : (navigableItems.value[0] ?? null),
)

function isFocusTarget(item: VisibleItem<TRow>): boolean {
  return effectiveFocusTarget.value !== null && isSameVisibleItem(effectiveFocusTarget.value, item)
}

function groupCollapsed(key: string): boolean {
  return isGroupCollapsed(collapsedGroups.value, key, defaultGroupsCollapsed.value)
}

// Distinct group count on this page — not `groupedData.length`, since a group split across a
// page boundary contributes a second ("continued") chunk that shouldn't be double-counted.
const pageGroupCount = computed(() => new Set(groupedData.value.map((g) => g.key)).size)

// A plain <select> bound to a value absent from its own options (e.g. a custom initialViewState
// pageSize not in the four defaults) silently shows the wrong option as selected — merge the current
// pageSize in so the dropdown always reflects it.
const pageSizeOptions = computed(() => mergePageSizeOptions([10, 20, 50, 100], pageSize.value))

function setItemRef(key: TRow | string, el: Element | null): void {
  if (el) rowRefs.set(key, el as HTMLTableRowElement)
  else rowRefs.delete(key)
}

function focusItem(target: VisibleItem<TRow>): void {
  setFocusTarget(target)
  const refKey = target.kind === 'row' ? target.row : target.key
  rowRefs.get(refKey)?.focus()
}

// Arrow-key/Ctrl+Home/Ctrl+End navigation can target an item that isn't on the current page —
// `visibleItems` (from `table`) already covers the *full* filtered/grouped dataset, so crossing
// to an arbitrary page's first/last item is core's `getCrossPageFocusTarget` (shared with React).

// Changing `page` re-renders asynchronously, so an item on the new page can't be focused until
// after that render commits — this records the target and the `watch` below (flush: 'post',
// i.e. after the DOM update) picks it up.
let pendingFocusTarget: VisibleItem<TRow> | null = null

watch(
  page,
  () => {
    if (pendingFocusTarget) {
      const target = pendingFocusTarget
      pendingFocusTarget = null
      focusItem(target)
    }
  },
  { flush: 'post' },
)

// Scrolls `focus.target` into view whenever it changes to a row — the counterpart to
// `pendingFocusTarget`/`focusItem` above, but for `table.focus.moveTo`, which (unlike keyboard
// nav) never calls real DOM `.focus()` itself — see its own doc comment in `useTableState.ts`.
// Runs on every `focusTarget` change (a keyboard-driven one already scrolled synchronously via
// `focusItem`'s `.focus()`, so this is a harmless no-op re-scroll for that case) and re-runs on
// `page`/`collapsedGroups` so a `moveTo` that had to expand a group or cross a page still finds
// the row once it actually mounts.
let lastScrolledFocusTarget: VisibleItem<TRow> | null = null
watch(
  [focusTarget, page, collapsedGroups],
  () => {
    const target = focusTarget.value
    if (target && target.kind === 'row' && target !== lastScrolledFocusTarget) {
      const el = rowRefs.get(target.row)
      if (el) {
        // jsdom (used by this project's own component tests) doesn't implement
        // `scrollIntoView` at all — guard rather than let it throw.
        el.scrollIntoView?.({ block: 'nearest' })
        // `moveTo(row, { focus: true })` — real `.focus()` in addition to the scroll, done here
        // (not in useTableState) since this is the one place that actually holds the row's DOM
        // node. `preventScroll` avoids a redundant second scroll on top of the line above.
        if (props.table.focus.consumeDomFocus()) el.focus({ preventScroll: true })
        lastScrolledFocusTarget = target
      }
    }
  },
  { flush: 'post' },
)

function handleKeyDown(event: KeyboardEvent, target: VisibleItem<TRow>): void {
  const items = navigableItems.value
  const idx = indexOfVisibleItem(items, target)
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp': {
      const delta = event.key === 'ArrowDown' ? 1 : -1
      const nextIdx = idx + delta
      if (nextIdx >= 0 && nextIdx < items.length) {
        const next = items[nextIdx]
        event.preventDefault()
        if (event.shiftKey && props.selectable && next.kind === 'row')
          toggleRowSelection(next.row, true)
        focusItem(next)
      } else {
        const crossing = getCrossPageFocusTarget(
          visibleItems.value,
          page.value,
          numPages.value,
          pageSize.value,
          { kind: 'edge', delta },
          isRowNavEnabled.value,
        )
        if (crossing) {
          event.preventDefault()
          if (event.shiftKey && props.selectable && crossing.item.kind === 'row')
            toggleRowSelection(crossing.item.row, true)
          pendingFocusTarget = crossing.item
          setPage(crossing.targetPage)
        }
      }
      break
    }
    case 'Home':
    case 'End': {
      if (event.ctrlKey || event.metaKey) {
        const crossing = getCrossPageFocusTarget(
          visibleItems.value,
          page.value,
          numPages.value,
          pageSize.value,
          { kind: 'jump', toEnd: event.key === 'End' },
          isRowNavEnabled.value,
        )
        if (crossing) {
          event.preventDefault()
          if (event.shiftKey && props.selectable && crossing.item.kind === 'row')
            toggleRowSelection(crossing.item.row, true)
          if (crossing.targetPage === page.value) {
            focusItem(crossing.item)
          } else {
            pendingFocusTarget = crossing.item
            setPage(crossing.targetPage)
          }
        }
        break
      }
      const next = items[event.key === 'Home' ? 0 : items.length - 1]
      if (next && !isSameVisibleItem(next, target)) {
        event.preventDefault()
        if (event.shiftKey && props.selectable && next.kind === 'row')
          toggleRowSelection(next.row, true)
        focusItem(next)
      }
      break
    }
    case ' ':
      if (target.kind === 'group') {
        if (props.selectable) {
          event.preventDefault()
          const group = groupedData.value.find((g) => g.key === target.key)
          if (group) toggleSelectAll(group.rows)
        }
      } else if (props.selectable) {
        event.preventDefault()
        toggleRowSelection(target.row, event.shiftKey)
      }
      break
    case 'Enter':
      if (target.kind === 'group') {
        event.preventDefault()
        toggleGroupCollapse(target.key)
      } else if (isRowClickable.value) {
        event.preventDefault()
        handleRowClick(target.row, event)
      }
      break
  }
}

const allSelected = computed(
  () => processedData.value.length > 0 && selectedRows.value.length === processedData.value.length,
)
const someSelected = computed(() => selectedRows.value.length > 0 && !allSelected.value)

function isGroupAllSelected(rows: TRow[]) {
  return rows.length > 0 && rows.every((r) => selection.value.has(r))
}
function isGroupSomeSelected(rows: TRow[]) {
  return rows.some((r) => selection.value.has(r)) && !isGroupAllSelected(rows)
}

const filterableCols = computed(() => props.columns.filter((c) => c.filterable !== false))
const groupableCols = computed(() => props.columns.filter((c) => c.groupable === true))
const sortableCols = computed(() => props.columns.filter((c) => c.sortable !== false))
// Narrows the *column list* itself in the Columns/Sort/Group dropdowns and the Filter dropdown's
// left column pane — a completely separate concern from FilterPane's own value search, which
// narrows one column's *values*. Keyed by dropdown id
// ('cols'/'sort'/'group'/'filter'), same category of ephemeral UI state as `filterActiveCol`.
const ddSearchTerms = ref<Record<string, string>>({})
function ddSearchTerm(dd: string): string {
  return ddSearchTerms.value[dd] ?? ''
}
function setDdSearchTerm(dd: string, term: string): void {
  ddSearchTerms.value = { ...ddSearchTerms.value, [dd]: term }
}
// `Dropdown`'s own Escape handling (see components/Dropdown.vue) clears a non-empty search term
// before closing — this is the Columns/Sort/Group dropdowns' shared callback for that, one bound
// instance per dropdown id since `onEscapeClearable` takes no arguments of its own. The Filter
// dropdown needs a different callback (see filterEscapeClearable below), since it has a second,
// per-column value search term to check too.
function makeDdEscapeClearable(dd: string): () => boolean {
  return () => {
    // Scoped to focus actually being in the search box — without this, Escape pressed while
    // focused on a row (e.g. after arrowing down into the list) would still silently clear a
    // non-empty search term instead of closing the dropdown on the first press.
    if (!(document.activeElement as HTMLElement | null)?.matches?.('.dt__dd-search')) return false
    if (ddSearchTerm(dd) !== '') {
      setDdSearchTerm(dd, '')
      return true
    }
    return false
  }
}
const colsEscapeClearable = makeDdEscapeClearable('cols')
const sortEscapeClearable = makeDdEscapeClearable('sort')
const groupEscapeClearable = makeDdEscapeClearable('group')
// Columns dropdown: the search box is pinned at the top and, unlike Sort/Group, narrows *both*
// "Visible columns" (visibleCols, not activeColumns, so a column merely hidden *by grouping*
// still counts as visible here) and "Available columns" (hidden columns, click to show) — a
// column you already show is just as often what you're hunting for (to hide/reorder it) as one
// you don't. Available stays bucketed by category but deliberately NOT alphabetized when not
// searching: this dropdown's whole identity is "shows real column/definition order," unlike
// Sort/Group's addable lists (see categorizedAlphabetizedByLabel above). While searching, a
// category match is flattened into a plain, category-tagged row instead — see
// searchedFlatAvailableCols below — since hiding a single match behind an extra hover/click
// defeats the point of searching (same reasoning as Sort/Group's own flatten-on-search).
const isColsSearching = computed(() => ddSearchTerm('cols').trim() !== '')
const visibleOrderedColumns = computed(() =>
  orderedColumns.value.filter((c) => visibleCols.value.has(c.key)),
)
const searchedVisibleOrderedColumns = computed(() =>
  visibleOrderedColumns.value.filter((c) => columnMatchesSearch(c, ddSearchTerm('cols'))),
)
// Alt+↑/↓'s neighbor-eligibility set for moveVisibleColumnBy (see useTableState.ts's own comment
// on its 3rd param): the real visible-columns set when not searching (today's behavior,
// unchanged), or narrowed to just the currently-shown-and-matching keys while searching, so a
// search-filtered-out column is never chosen as a swap partner.
const colsReorderEligible = computed<ReadonlySet<string> | undefined>(() =>
  isColsSearching.value
    ? new Set(searchedVisibleOrderedColumns.value.map((c) => c.key))
    : undefined,
)
const availableColumns = computed(() =>
  orderedColumns.value.filter((c) => !visibleCols.value.has(c.key)),
)
// Only bucketed by category while *not* searching — see categorizedAvailableCols' own use below.
const categorizedAvailableCols = computed(() => groupColumnsByCategory(availableColumns.value))
const searchedFlatAvailableCols = computed(() =>
  alphabetizedByLabel(availableColumns.value, ddSearchTerm('cols')),
)
// Declared here (rather than alongside its sibling groupDropdownRef further down) because the
// watch right below needs it, and `<script setup>` top-level consts execute in source order —
// referencing it before this point would hit the TDZ.
const filterDropdownRef = ref<InstanceType<typeof Dropdown> | null>(null)
// Snapshot of the Filter dropdown's left-pane column order, taken only at the moment the
// dropdown opens — active-filter columns first, then the rest (see `orderFilterColumnsByActive`'s
// own doc comment, core, for why this is a snapshot rather than a live sort: reordering while a
// filter is toggled with the panel still open would move a row out from under the pointer
// mid-interaction). `filterDropdownRef.value?.isOpen` is watched (rather than hoisting `isOpen`
// itself here) since Dropdown.vue already owns that state — see its own `isOpen` export.
const filterColOrderKeys = ref<string[] | null>(null)
// Which categories are collapsed (see docs/columns.md's "Column categories"). Seeded the same way as
// filterColOrderKeys above — a snapshot taken only on the closed→open transition, not recomputed
// live while the panel stays open (so toggling a category by hand isn't fought by an unrelated
// filter change elsewhere). Collapsed by default (matching Columns/Sort/Group's own category
// submenus, which always start closed), except a category containing an active filter at the
// moment the panel opens starts expanded instead — so opening the dropdown never hides the very
// filter you're currently using behind a collapsed section with no visual sign why.
const collapsedCategories = ref<Set<string>>(new Set())
function toggleCategoryCollapsed(name: string): void {
  const next = new Set(collapsedCategories.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  collapsedCategories.value = next
}
watch(
  () => filterDropdownRef.value?.isOpen,
  (open, prevOpen) => {
    if (open && !prevOpen) {
      filterShowValues.value = false
      filterColOrderKeys.value = orderFilterColumnsByActive(
        filterableCols.value,
        filters.value,
        excludeFilters.value,
        rangeFilters.value,
      )
      const startCollapsed = new Set<string>()
      for (const category of groupColumnsByCategory(filterableCols.value).categories) {
        const hasActiveInCategory = category.columns.some((c) =>
          columnHasActiveFilter(c.key, filters.value, excludeFilters.value, rangeFilters.value),
        )
        if (!hasActiveInCategory) startCollapsed.add(category.name)
      }
      collapsedCategories.value = startCollapsed
    }
  },
)
// Order follows filterColOrderKeys (falling back to plain alphabetical before the dropdown's
// first open — see applyColumnOrderSnapshot) instead of a plain alphabetize, since active-filter
// columns are the ones most worth finding at a glance in a long list.
const searchedFilterableCols = computed(() =>
  applyColumnOrderSnapshot(
    filterableCols.value.filter((c) => columnMatchesSearch(c, ddSearchTerm('filter'))),
    filterColOrderKeys.value,
  ),
)
// Buckets the (already searched/ordered) left-pane column list by category. Deliberately NOT
// re-sorted alphabetically afterward — searchedFilterableCols is already active-filtered-first-
// then-alphabetical (see its own comment above), not purely alphabetical, so re-sorting categories
// here would undo that active-first bubbling for whichever category contains the column currently
// being filtered on.
const categorizedFilterCols = computed(() => groupColumnsByCategory(searchedFilterableCols.value))
// A collapsed category force-expands whenever it currently has a search match — a category only
// ever appears in categorizedFilterCols at all when it has at least one (searchedFilterableCols
// is already narrowed), so this is always safe. collapsedCategories itself stays untouched:
// clearing the search reverts to whatever collapse state was there before (manual toggle, or the
// open-time snapshot) — see each template usage below.
const isFilterSearching = computed(() => ddSearchTerm('filter').trim() !== '')
const filterActiveCol = ref<string | null>(null)
const filterActiveKey = computed(
  () =>
    (filterActiveCol.value && filterableCols.value.some((c) => c.key === filterActiveCol.value)
      ? filterActiveCol.value
      : filterableCols.value[0]?.key) ?? null,
)
const filterDetailCol = computed(
  () => filterableCols.value.find((c) => c.key === filterActiveKey.value) ?? null,
)
// A date column can have both an active checklist selection (tree) *and* an active range filter
// above it at once — either one alone should light the dot, not just whichever one a plain
// type-based branch happened to check.
function hasActiveColFilter(col: ColumnDef<TRow>): boolean {
  return columnHasActiveFilter(col.key, filters.value, excludeFilters.value, rangeFilters.value)
}
// Clears every kind at once — the left pane's clear button (and Delete/Backspace, see
// onFilterDropdownKeydown) means "drop this column's filter entirely", unlike the active-bar's
// own per-kind chips.
function clearColFilter(key: string): void {
  clearColumnFilter(key, 'include')
  clearColumnFilter(key, 'exclude')
  clearColumnFilter(key, 'range')
}
// Exclusion chips name the kept values when fewer are kept than hidden
const exclusionChips = computed(() =>
  Object.entries(excludeFilters.value)
    .filter(([, vals]) => vals.size > 0)
    .map(([key, vals]) => {
      const col = props.columns.find((c) => c.key === key)
      return {
        key,
        label: col?.label,
        ...exclusionChip(
          vals,
          props.table.filter.valueMap.value[key],
          !!col && isExcludeOnlyColumn(props.data, col),
        ),
      }
    }),
)

// Raw on both sides: a row held in a consumer's `ref` is a reactive proxy, never `===` the rendered one
const currentRaw = computed(() => props.currentRow && toRaw(props.currentRow))
const isCurrent = (row: TRow) => toRaw(row) === currentRaw.value

// Narrow screen (U16): the Filter dropdown shows one pane at a time — columns, or values
const narrowFilter = ref(false)
let stopNarrowFilter = () => {}
onMounted(() => {
  stopNarrowFilter = watchMedia(FILTER_NARROW_QUERY, (matches) => (narrowFilter.value = matches))
})
onBeforeUnmount(() => stopNarrowFilter())
// On a phone the toolbar wraps: the toolbar-end slot ends the first line instead of taking a line of its own.
const endFirst = () => narrowFilter.value && hasSlot('toolbar-end')
const filterShowValues = ref(false)
async function showFilterValues(): Promise<void> {
  filterShowValues.value = true
  await nextTick()
  const root = rootRef.value
  // A number column has no value rows: fall back to the back button
  ;(
    root?.querySelector<HTMLElement>('.dt__filter-detail input, .dt__filter-detail button') ??
    root?.querySelector<HTMLElement>('.dt__filter-back')
  )?.focus()
}
async function showFilterColumns(): Promise<void> {
  filterShowValues.value = false
  await nextTick()
  rootRef.value?.querySelector<HTMLElement>('.dt__filter-col-item--active')?.focus()
}

function selectFilterCol(key: string): void {
  filterActiveCol.value = key
  if (narrowFilter.value) void showFilterValues()
}
// The left column pane behaves like a listbox/radiogroup rather than needing a separate
// Enter/Space "activate" step — moving focus onto a column button by *any* means (Tab, the
// arrow-key nav below, or a click, which focuses the button natively before its own @click even
// runs) immediately shows that column's detail pane. Unlike vanilla (which has to explicitly
// re-render + refocus a brand-new DOM node on every switch, since its whole panel is rebuilt via
// innerHTML), Vue's reconciliation keeps this same button element in place across the reactive
// update, so no refocus step is needed here at all.
function onFilterColFocus(key: string): void {
  if (key === filterActiveKey.value) return
  filterActiveCol.value = key
}
const filterColRefs = new Map<string, HTMLElement>()
function setFilterColRef(key: string, el: Element | null): void {
  if (el) filterColRefs.set(key, el as HTMLElement)
  else filterColRefs.delete(key)
}
// Active-bar filter chip body (see "Active-bar chip click actions"): opens the Filter dropdown
// straight to that column's detail pane, instead of requiring the dropdown to be reopened and the
// column re-found in the left list. `filterActiveCol` is set directly here (rather than relying
// solely on `onFilterColFocus`'s focus-follows-selection) so the right pane already shows the
// right thing on the very first render, before focus even lands on the button — and neither the
// column search nor a collapsed category can hide its button (U25).
async function onOpenFilterCol(key: string): Promise<void> {
  filterDropdownRef.value?.open()
  filterActiveCol.value = key
  setDdSearchTerm('filter', '')
  const category = filterableCols.value.find((c) => c.key === key)?.category
  if (category && collapsedCategories.value.has(category)) toggleCategoryCollapsed(category)
  await nextTick()
  filterColRefs.get(key)?.focus()
}
const hasActiveState = computed(
  () =>
    sorts.value.length > 0 ||
    activeFilterCount.value > 0 ||
    groupBy.value.length > 0 ||
    searchQuery.value !== '',
)
const hasAggregates = computed(() => activeColumns.value.some((c) => c.aggregate !== undefined))

function asRecord(row: object): Record<string, unknown> {
  return row as Record<string, unknown>
}

function formatValue(v: unknown, row: TRow, col: ColumnDef<TRow>): string {
  if (col.format) return col.format(v, row)
  if (Array.isArray(v)) return v.join(', ')
  return v != null ? String(v) : ''
}

function findCol(key: string): ColumnDef<TRow> | undefined {
  return props.columns.find((c) => c.key === key)
}

/** The raw value that defines a group for column `key` at groupBy index `i` — a single array item when the underlying value is an array, the raw value otherwise. Not used for a bucketed column (col.groupValue) — see groupBucketLabel below. */
function groupRawValue(group: PagedGroup<TRow>, key: string, i: number): unknown {
  const col = findCol(key)
  const raw = col ? getColumnValue(col, group.sampleRow!) : undefined
  return Array.isArray(raw) ? group.keyParts[i] : raw
}

/**
 * Label for a bucketed group column (col.groupValue set) — the group's own keyPart (the bucket
 * key) rendered via col.groupFormat, not the sample row's real value/format. A bucket's
 * representative row's real value (e.g. "47%") isn't the bucket it's displayed under
 * ("40–50%"), so this bypasses the normal formatValue/#group-{key} slot pipeline entirely,
 * same as React/vanilla.
 */
function groupBucketLabel(group: PagedGroup<TRow>, key: string, i: number): string {
  const col = findCol(key)
  return col?.groupFormat?.(group.keyParts[i]) ?? group.keyParts[i]
}

function hasSlot(name: string): boolean {
  return name in slots
}

const dragColKey = ref<string | null>(null)
// The open header menu's column: its <th> stops being draggable, or dragging a control inside the
// menu (a range slider) would drag the column instead
const menuColKey = ref<string | null>(null)
const dragOverColKey = ref<string | null>(null)

function onColDragStart(key: string): void {
  dragColKey.value = key
}
function onColDragOver(key: string): void {
  if (dragColKey.value && dragColKey.value !== key) dragOverColKey.value = key
}
function onColDrop(key: string): void {
  if (dragColKey.value && dragColKey.value !== key) moveColumn(dragColKey.value, key)
  dragColKey.value = null
  dragOverColKey.value = null
}
function onColDragEnd(): void {
  dragColKey.value = null
  dragOverColKey.value = null
}

// Only `sorts` entries for a currently-rendered header count toward numbering — a groupBy column
// can have its own sort entry (sortWithinGroups uses it to order the groups themselves), but it
// has no header of its own to attach a number to, and leaving it in would shift every later
// header's number for no visible reason.
const headerSorts = computed(() =>
  sorts.value.filter((s) => activeColumns.value.some((c) => c.key === s.key)),
)
function isHeaderSorted(key: string): boolean {
  return headerSorts.value.some((s) => s.key === key)
}
function headerAriaSort(key: string): 'ascending' | 'descending' | undefined {
  const dir = headerSorts.value.find((s) => s.key === key)?.dir
  return dir && (dir === 'asc' ? 'ascending' : 'descending')
}
function headerSortLabel(key: string): string {
  const icon = isHeaderSorted(key) ? getHeaderSortIcon(headerSorts.value, key) : '↕'
  // A number is only useful to disambiguate priority when more than one visible header is
  // sorted — with just one, "1↑" is noise next to a plain "↑".
  if (!isHeaderSorted(key) || headerSorts.value.length <= 1) return icon
  return `${getHeaderSortIndex(headerSorts.value, key)}${icon}`
}
// Plain click: sort by this column alone, discarding other active sorts. Shift-click: add this
// column to the multi-sort (or flip its direction if it's already in it) — never removes, so it
// can't surprise-clear a sort or bump a column to the end of the priority stack; that's the chip
// ×/dropdown's job. No-op entirely when the column opts out via sortable: false.
function onHeaderSortClick(col: ColumnDef<TRow>, event: MouseEvent): void {
  if (col.sortable === false) return
  if (event.shiftKey) appendOrToggleSort(col.key)
  else replaceSort(col.key)
}

// Sort/Group dropdowns split into an "active" section (priority order, reorderable) and an
// "add" section (everything else) — reordering only ever makes sense among active entries.
const addableSortCols = computed(() =>
  sortableCols.value.filter((c) => getSortIndex(c.key) === null),
)
const addableGroupCols = computed(() =>
  groupableCols.value.filter((c) => !groupBy.value.includes(c.key)),
)
// Search narrows each addable list only — the active-entries section above keeps its own
// priority order and is never hidden by a search term, since it's a short, already-visible list
// with its own remove/reorder controls. The addable list itself carries no ordering meaning (none
// of these are sorted/grouped yet), so it's alphabetized instead of raw column-definition order —
// and, via `categorizedAlphabetizedByLabel` (core, which also matches by category), bucketed by
// `ColumnDefBase.category`: a category collapses into a `CategorySubmenu` flyout trigger instead
// of a flat run of individual rows (see docs/columns.md's "Column categories").
const categorizedAddableSortCols = computed(() =>
  categorizedAlphabetizedByLabel(addableSortCols.value, ddSearchTerm('sort')),
)
const categorizedAddableGroupCols = computed(() =>
  categorizedAlphabetizedByLabel(addableGroupCols.value, ddSearchTerm('group')),
)
// While searching, a category match is flattened into a plain, category-tagged row instead of
// bucketed behind a CategorySubmenu trigger — see Columns' isColsSearching/searchedFlatAvailableCols
// above for the identical reasoning. Plain alphabetize+search (no bucketing) covers this, since
// the addable list already has no ordering meaning of its own to preserve.
const isSortSearching = computed(() => ddSearchTerm('sort').trim() !== '')
const isGroupSearching = computed(() => ddSearchTerm('group').trim() !== '')
const searchedFlatAddableSortCols = computed(() =>
  alphabetizedByLabel(addableSortCols.value, ddSearchTerm('sort')),
)
const searchedFlatAddableGroupCols = computed(() =>
  alphabetizedByLabel(addableGroupCols.value, ddSearchTerm('group')),
)
// Which category submenu is open, one independent value per dropdown — a single shared ref (not
// one per CategorySubmenu instance) so opening one always closes any other that was open in the
// same dropdown, see CategorySubmenu.vue's own doc.
const openSortCategory = ref<string | null>(null)
const openGroupCategory = ref<string | null>(null)
const openColsCategory = ref<string | null>(null)

// Activating an addable Sort/Group column (or removing an active one) moves its row into a
// *different* v-for list — Vue's keyed reconciliation can't preserve focus across that (the
// element that had focus is genuinely removed, a structurally new one takes its place elsewhere),
// so each side is refocused explicitly via a ref map, mirroring vanilla's identical fix. The same
// ref maps also back the Alt+↑/↓ reorder handlers below: reordering keeps a row in the *same*
// v-for list (no structurally-new element), yet Vue's keyed reconciliation still drops focus when
// it moves the DOM node to its new position (confirmed empirically) — `activateAndFocus` fixes
// both cases identically, since it just refocuses whatever `refMap` resolves `key` to now,
// regardless of whether the underlying element was replaced or merely repositioned.
const sortRowRefs = new Map<string, HTMLElement>()
const addableSortRefs = new Map<string, HTMLElement>()
function setSortRowRef(key: string, el: Element | null): void {
  if (el) sortRowRefs.set(key, el as HTMLElement)
  else sortRowRefs.delete(key)
}
function setAddableSortRef(key: string, el: Element | null): void {
  if (el) addableSortRefs.set(key, el as HTMLElement)
  else addableSortRefs.delete(key)
}
// Runs `action`, then focuses whatever `key` maps to in `refMap` once the resulting DOM update
// has committed — the shared shape behind every "activate/remove an addable Sort/Group entry (or
// open its dropdown from a chip), or reorder an active one via Alt+↑/↓, and (re)focus the row it
// ends up at" handler below.
async function activateAndFocus(
  action: () => void,
  refMap: Map<string, HTMLElement>,
  key: string,
): Promise<void> {
  action()
  await nextTick()
  refMap.get(key)?.focus()
}
function onAddSort(key: string): Promise<void> {
  return activateAndFocus(() => toggleSort(key), sortRowRefs, key)
}
function onRemoveSortClick(key: string): Promise<void> {
  return activateAndFocus(() => removeSort(key), addableSortRefs, key)
}

const groupRowRefs = new Map<string, HTMLElement>()
const addableGroupRefs = new Map<string, HTMLElement>()
function setGroupRowRef(key: string, el: Element | null): void {
  if (el) groupRowRefs.set(key, el as HTMLElement)
  else groupRowRefs.delete(key)
}
function setAddableGroupRef(key: string, el: Element | null): void {
  if (el) addableGroupRefs.set(key, el as HTMLElement)
  else addableGroupRefs.delete(key)
}
function onAddGroup(key: string): Promise<void> {
  return activateAndFocus(() => toggleGroup(key), groupRowRefs, key)
}
function onRemoveGroupClick(key: string): Promise<void> {
  return activateAndFocus(() => removeGroup(key), addableGroupRefs, key)
}

// Active-bar group chip body (see "Active-bar chip click actions"): opens the Group dropdown and
// focuses that entry's row. There's no single obvious inline toggle for a group entry the way
// direction is for a sort chip (the sort chip's body just calls toggleSortDir directly in the
// template — Vue's keyed reconciliation keeps that same <button> in place across the re-render,
// so it needs no explicit refocus at all, unlike this one), so opening the dropdown straight to
// it is the most useful available action. `groupDropdownRef` is read from plain script here (not
// a template expression), so `.value` is needed, unlike a template expression referencing the
// same top-level ref, which Vue's `<script setup>` compiler auto-unwraps.
function onOpenGroupEntry(key: string): Promise<void> {
  return activateAndFocus(() => groupDropdownRef.value?.open(), groupRowRefs, key)
}

// Drag-and-drop reordering for the Sort dropdown's active entries — kept as its own independent
// state (rather than reusing dragColKey/dragOverColKey above), mirroring how each dropdown gets
// its own drag state instead of a shared one.
const {
  dragKey: dragSortKey,
  dragOverKey: dragOverSortKey,
  dragOverAfter: dragOverSortAfter,
  onRowDragStart: onSortDragStart,
  onRowDragEnd: onSortDragEnd,
  onDragOver: onSortRowsDragOver,
  onDrop: onSortRowsDrop,
} = useDropdownReorder('data-sort-key', moveSort)
// Alt+↑/↓ mirrors the drag gesture for keyboard-only reorder; Enter/Space mirrors the row's own
// click (toggle direction) since a plain div gets no free keyboard activation the way a real
// <button> would (unlike the add-list, which renders real buttons and needs no handler here).
// The Alt+↑/↓ branch reuses `activateAndFocus`/`sortRowRefs` above — unlike activate/remove, the
// row stays in the *same* v-for list across a reorder, but Vue's keyed reconciliation still drops
// focus when it moves the DOM node to its new position (confirmed empirically), so an explicit
// refocus is needed here too, not just when a row crosses between lists.
function onSortRowKeyDown(event: KeyboardEvent, key: string): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    toggleSortDir(key)
  } else if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault()
    // Swap with the neighbor within the non-group subset (by key, via moveSort/reorderSort), not
    // the raw sorts-array neighbor (moveSortBy) — a group entry can sit between two non-group
    // ones in the underlying array, and swapping with it would silently do nothing visible in
    // this section (only non-group entries render here — see nonGroupSortEntries).
    const list = nonGroupSortEntries.value
    const delta = event.key === 'ArrowUp' ? -1 : 1
    const idx = list.findIndex((s) => s.key === key)
    const neighbor = list[idx + delta]
    if (neighbor) activateAndFocus(() => moveSort(key, neighbor.key, delta > 0), sortRowRefs, key)
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    // Keyboard equivalent of this row's own × button — matches the Filter dropdown's identical
    // Delete/Backspace-on-a-focused-active-row shortcut.
    event.preventDefault()
    onRemoveSortClick(key)
  }
}

// Same as above, for the Group dropdown's active entries — a group entry has nothing to toggle
// on click (no direction), so only Alt+↑/↓ reorder applies.
const {
  dragKey: dragGroupKey,
  dragOverKey: dragOverGroupKey,
  dragOverAfter: dragOverGroupAfter,
  onRowDragStart: onGroupDragStart,
  onRowDragEnd: onGroupDragEnd,
  onDragOver: onGroupRowsDragOver,
  onDrop: onGroupRowsDrop,
} = useDropdownReorder('data-group-key', moveGroup)
function onGroupRowKeyDown(event: KeyboardEvent, key: string): void {
  if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault()
    const delta = event.key === 'ArrowUp' ? -1 : 1
    activateAndFocus(() => moveGroupBy(key, delta), groupRowRefs, key)
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    // Keyboard equivalent of this row's own × button — matches the Filter dropdown's identical
    // Delete/Backspace-on-a-focused-active-row shortcut.
    event.preventDefault()
    onRemoveGroupClick(key)
  } else if (event.key === 'Enter' || event.key === ' ') {
    // No click action of its own (unlike Sort's active rows, which toggle direction) — but still
    // needs to preventDefault, or Space's native default action scrolls the nearest scrollable
    // ancestor (this panel, or the whole page once the panel itself has nothing left to scroll)
    // out from under the still-focused row, which reads as "focus was lost" even though it wasn't.
    event.preventDefault()
  }
}

// Drag-and-drop reordering for the Columns dropdown's Visible rows — replaces the old ▲▼ buttons.
const {
  dragKey: dragColRowKey,
  dragOverKey: dragOverColRowKey,
  dragOverAfter: dragOverColRowAfter,
  onRowDragStart: onColRowDragStart,
  onRowDragEnd: onColRowDragEnd,
  onDragOver: onColRowsDragOver,
  onDrop: onColRowsDrop,
} = useDropdownReorder('data-col-row-key', moveColumn)
// Same `activateAndFocus` reasoning as Sort/Group above — showing/hiding a column moves its row
// between the Visible/Available lists (a structurally new element), and Alt+↑/↓ keeps it in the
// same list yet Vue's keyed reconciliation still drops focus when it repositions the DOM node —
// both need an explicit refocus via a ref map.
const colRowRefs = new Map<string, HTMLElement>()
const addableColRefs = new Map<string, HTMLElement>()
function setColRowRef(key: string, el: Element | null): void {
  if (el) colRowRefs.set(key, el as HTMLElement)
  else colRowRefs.delete(key)
}
function setAddableColRef(key: string, el: Element | null): void {
  if (el) addableColRefs.set(key, el as HTMLElement)
  else addableColRefs.delete(key)
}
// One CategorySubmenu component instance per category, keyed by category name — lets `hideColumn`
// below focus a category's own trigger button (via the instance's exposed `triggerRef`) when a
// hidden column reappears inside a *closed* submenu with no addable row of its own rendered yet.
const categorySubmenuRefs = new Map<string, { triggerRef: HTMLButtonElement | null }>()
function setCategorySubmenuRef(name: string, el: unknown): void {
  if (el) categorySubmenuRefs.set(name, el as { triggerRef: HTMLButtonElement | null })
  else categorySubmenuRefs.delete(name)
}
// Shows `key`, refocusing its new Visible row (colRowRefs) — the same activate/remove reasoning
// as Sort/Group's onAddSort/onAddGroup above.
function showColumn(key: string): Promise<void> {
  return activateAndFocus(() => toggleColVisibility(key), colRowRefs, key)
}
// Hides `col`, refocusing whatever it reappears as in Available — shared by a visible row's own ×
// button and its Delete/Backspace keyboard equivalent. Unlike Sort/Group's activate/remove (always
// the same ref map), the refocus target here depends on whether `col` is categorized, so this
// can't just reuse `activateAndFocus` as-is.
async function hideColumn(col: ColumnDef<TRow>): Promise<void> {
  toggleColVisibility(col.key)
  await nextTick()
  // While searching, a categorized column reappears flattened out of its submenu (see
  // searchedFlatAvailableCols) — the addable ref map already covers that row too (same key), so
  // only the *not-searching* case still needs the category submenu trigger as its focus target.
  if (col.category && !isColsSearching.value)
    categorySubmenuRefs.get(col.category)?.triggerRef?.focus()
  else addableColRefs.get(col.key)?.focus()
}
function onColRowKeyDown(event: KeyboardEvent, key: string, col: ColumnDef<TRow>): void {
  if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault()
    const delta = event.key === 'ArrowUp' ? -1 : 1
    activateAndFocus(
      () => moveVisibleColumnBy(key, delta, colsReorderEligible.value),
      colRowRefs,
      key,
    )
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    // Keyboard equivalent of this row's own × button — matches the Filter dropdown's identical
    // Delete/Backspace-on-a-focused-active-row shortcut.
    event.preventDefault()
    hideColumn(col)
  } else if (event.key === 'Enter' || event.key === ' ') {
    // No click action of its own — but still needs to preventDefault, or Space's native default
    // action scrolls the nearest scrollable ancestor out from under the still-focused row, which
    // reads as "focus was lost" even though it wasn't (see onGroupRowKeyDown's identical comment).
    event.preventDefault()
  }
}

const searchInputRef = ref<HTMLInputElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)
// Focus target after a clear button unmounts itself: the search box, else the first toolbar button.
function focusSearch(): void {
  ;(searchInputRef.value ?? rootRef.value?.querySelector('button'))?.focus()
}
function clearSearchQuery(): void {
  setSearchQuery('')
  focusSearch()
}
function clearAllAndFocus(): void {
  clearAll()
  focusSearch()
}
function clearSearchAndFilters(): void {
  clearFilters()
  setSearchQuery('')
  focusSearch()
}

// ── Dropdown column search + keyboard navigation ──
// Escape (clear a non-empty column-search term first, then close on a second press) and the
// roving Up/Down/Home/End row-list nav are both now owned by Dropdown.vue itself (see its own
// `onEscapeClearable`/`rowSelector`/`navRoot` props) — this file only supplies each dropdown's own
// escape-clear callback (colsEscapeClearable/sortEscapeClearable/groupEscapeClearable above,
// filterEscapeClearable below) and, for the Filter dropdown only, the extra pane-crossing nav
// that Dropdown's own generic base nav doesn't cover (see onFilterDropdownKeydown below).
// `groupDropdownRef`'s own component instance is still needed here — not for Escape/nav anymore,
// but for the active-bar group chip's "open straight to this entry" action (onOpenGroupEntry).
const groupDropdownRef = ref<InstanceType<typeof Dropdown> | null>(null)
// filterDropdownRef itself is declared much earlier (see the filterColOrderKeys watch above) —
// this comment marks where it'd otherwise sit, alongside its sibling above.

// The Filter dropdown's own Escape callback for its left-pane column search (FilterPane handles
// Escape in its own value search).
function filterEscapeClearable(): boolean {
  const active = document.activeElement as HTMLElement | null
  // Scoped to focus actually being in the left-pane column search box — same reasoning as
  // makeDdEscapeClearable above: without it, Escape
  // pressed while focused elsewhere in the panel would still silently clear this term.
  if (active?.matches?.('.dt__filter-cols-search') && ddSearchTerm('filter') !== '') {
    setDdSearchTerm('filter', '')
    return true
  }
  return false
}

/**
 * Filter dropdown only: Left/Right crosses between the left column pane and the right detail
 * pane, and the right pane's own rows (value checklist / date tree) get the same Up/Down/Home/End
 * nav as every other dropdown's row list. This is layered on top of Dropdown.vue's own generic
 * Escape/base-nav handling (wired via its `on-escape-clearable`/`nav-root` props on the Filter
 * `<Dropdown>` below), not a replacement for it — the generic nav is scoped to `.dt__filter-cols`
 * (the left pane only, via `nav-root`), so it never conflicts with the right-pane handling here.
 */
async function onFilterDropdownKeydown(event: KeyboardEvent): Promise<void> {
  if (event.altKey) return
  {
    const targetEl = event.target as HTMLElement
    const filterColBtn = targetEl.closest<HTMLElement>('.dt__filter-col-item')
    const filterDetail = targetEl.closest<HTMLElement>('.dt__filter-detail')

    // Delete/Backspace on a focused left-pane column row clears that column's filter — the
    // keyboard equivalent of clicking its × clear button. Guarded to an actually-active column so
    // pressing it on an inert row is a true no-op (no page-reset churn from clearColumnFilter's
    // unconditional setPageState(1)).
    if (filterColBtn && (event.key === 'Delete' || event.key === 'Backspace')) {
      const key = filterColBtn.dataset.filterColKey
      const col = key && filterableCols.value.find((c) => c.key === key)
      if (col && hasActiveColFilter(col)) {
        event.preventDefault()
        clearColFilter(col.key)
      }
      return
    }

    if (filterColBtn && event.key === 'ArrowRight') {
      event.preventDefault()
      if (narrowFilter.value) {
        await showFilterValues()
        return
      }
      const menu = event.currentTarget as HTMLElement
      menu
        .querySelector<HTMLElement>('.dt__filter-detail input, .dt__filter-detail button')
        ?.focus()
      return
    }

    if (filterDetail && event.key === 'ArrowLeft') {
      const active = document.activeElement
      // Never hijack Left on an actual text/value-editing control — the value-search box, the
      // numeric/date range inputs, or a range-slider thumb (all <input> types other than
      // checkbox) — which all need their native cursor/value behavior. Every other control here
      // (checklist/date-tree checkboxes, select-all, the sort-order button) has no use for a bare
      // Left, so it's free to reuse.
      const isEditable = active instanceof HTMLInputElement && active.type !== 'checkbox'
      if (!isEditable) {
        event.preventDefault()
        if (narrowFilter.value) {
          await showFilterColumns()
          return
        }
        const menu = event.currentTarget as HTMLElement
        menu.querySelector<HTMLElement>('.dt__filter-col-item--active')?.focus()
        return
      }
    }
  }
}
</script>

<template>
  <div ref="rootRef" class="dt">
    <!-- ── Toolbar ── -->
    <div class="dt__toolbar">
      <div class="dt__toolbar-actions">
        <!-- Columns — "Visible columns" (every shown column, draggable/Alt+↑↓-reorderable, in
             real table order) above "Available columns" (hidden columns, click to show; a
             categorized one collapses into a CategorySubmenu). Mirrors the Sort/Group
             active/addable split above — a checkbox no longer fit once "shown" and "hidden"
             needed visually distinct rows (draggable + remove vs. plain click-to-add), the same
             reason Sort/Group never used one either. Reordering only ever happens within
             Visible — Available is click-only, so nesting it into category submenus (impossible
             for Visible, since submenu rows can't also be a drag surface) creates no conflict. -->
        <Dropdown
          v-if="showColumns && columns.length >= 2"
          @dragover="onColRowsDragOver"
          @drop="onColRowsDrop"
          :on-escape-clearable="colsEscapeClearable"
        >
          <template #trigger="{ open }">
            <ToolbarBtn :active="open">{{ L.columns }}</ToolbarBtn>
          </template>
          <!--
            Pinned at the top and always mounted (never conditionally rendered based on match
            count — an earlier version unmounted this whole box once Available's filtered list
            hit zero, which dropped focus out from under whoever was mid-typing). Narrows *both*
            Visible and Available now, unlike Sort/Group (search there narrows only what's being
            added) — a column you already show is just as often what you're hunting for.
          -->
          <div class="dt__dd-search-row">
            <span class="dt__dd-search-wrap">
              <input
                type="text"
                class="dt__dd-search"
                data-dd-search
                :placeholder="L.filterSearchPlaceholder"
                :value="ddSearchTerm('cols')"
                @input="setDdSearchTerm('cols', ($event.target as HTMLInputElement).value)"
              />
              <button
                v-if="ddSearchTerm('cols')"
                type="button"
                class="dt__dd-search-clear"
                :title="L.clearSearch"
                :aria-label="L.clearSearch"
                @click="setDdSearchTerm('cols', '')"
              >
                ×
              </button>
            </span>
          </div>
          <div class="dt__dd-section">{{ L.columnsSection }}</div>
          <!--
            @dragover/@drop are handled at the Dropdown panel level (see above), not per-row —
            that's what lets a drop past the last row still resolve to a valid target.
          -->
          <div
            v-for="col in searchedVisibleOrderedColumns"
            :key="col.key"
            :ref="(el) => setColRowRef(col.key, el as Element | null)"
            :data-col-row-key="col.key"
            class="dt__dd-item dt__dd-item--col dt__dd-item--colrow"
            :class="{
              'dt__dd-item--dragging': dragColRowKey === col.key,
              'dt__dd-item--drag-over': dragOverColRowKey === col.key && !dragOverColRowAfter,
              'dt__dd-item--drag-over-after': dragOverColRowKey === col.key && dragOverColRowAfter,
            }"
            draggable="true"
            tabindex="0"
            @dragstart="onColRowDragStart(col.key)"
            @dragend="onColRowDragEnd"
            @keydown="onColRowKeyDown($event, col.key, col)"
          >
            <span class="dt__dd-drag-handle" aria-hidden="true">⠿</span>
            <span class="dt__flex1">{{ col.label }}</span>
            <button
              type="button"
              class="dt__item-remove"
              :title="L.hideColumn"
              :aria-label="L.hideColumn"
              draggable="false"
              @click.stop="hideColumn(col)"
            >
              ×
            </button>
          </div>
          <template v-if="availableColumns.length > 0">
            <div class="dt__dd-section">{{ L.availableColumnsSection }}</div>
            <template v-if="isColsSearching">
              <button
                v-for="col in searchedFlatAvailableCols"
                :key="col.key"
                :ref="(el) => setAddableColRef(col.key, el as Element | null)"
                type="button"
                class="dt__dd-item dt__dd-item--clickable"
                @click="showColumn(col.key)"
              >
                <span class="dt__flex1">{{ col.label }}</span>
                <span v-if="col.category" class="dt__dd-item-category">{{ col.category }}</span>
              </button>
            </template>
            <template v-else>
              <button
                v-for="col in categorizedAvailableCols.uncategorized"
                :key="col.key"
                :ref="(el) => setAddableColRef(col.key, el as Element | null)"
                type="button"
                class="dt__dd-item dt__dd-item--clickable"
                @click="showColumn(col.key)"
              >
                <span class="dt__flex1">{{ col.label }}</span>
              </button>
              <CategorySubmenu
                v-for="category in categorizedAvailableCols.categories"
                :key="category.name"
                :ref="(el) => setCategorySubmenuRef(category.name, el)"
                :name="category.name"
                :is-open="openColsCategory === category.name"
                @open="openColsCategory = category.name"
                @close="
                  openColsCategory = openColsCategory === category.name ? null : openColsCategory
                "
              >
                <button
                  v-for="col in category.columns"
                  :key="col.key"
                  :ref="(el) => setAddableColRef(col.key, el as Element | null)"
                  type="button"
                  class="dt__dd-item dt__dd-item--clickable"
                  @click="showColumn(col.key)"
                >
                  <span class="dt__flex1">{{ col.label }}</span>
                </button>
              </CategorySubmenu>
            </template>
          </template>
        </Dropdown>

        <!-- Group before Sort — data is grouped first, then ordered (groups themselves, then
             rows within them), matching the Sort dropdown's own "Group order" section coming
             before "Active sorts" and the active bar's group-chips-before-sort-chips order.
             Both still "shape" the view (vs. Search/Filter narrowing it below) — see the
             divider below. -->
        <Dropdown
          v-if="groupableCols.length > 0"
          ref="groupDropdownRef"
          @dragover="onGroupRowsDragOver"
          @drop="onGroupRowsDrop"
          :on-escape-clearable="groupEscapeClearable"
        >
          <template #trigger="{ open }">
            <ToolbarBtn :active="open || groupBy.length > 0" :grouped="groupBy.length > 0">
              {{ L.group }}
            </ToolbarBtn>
          </template>
          <template #extra-trigger>
            <button
              v-if="groupBy.length > 0"
              type="button"
              class="dt__btn-clear"
              :title="L.clearGroups"
              :aria-label="L.clearGroups"
              @click="clearGroups"
            >
              ×
            </button>
          </template>
          <template v-if="groupBy.length > 0">
            <div class="dt__dd-section">{{ L.activeGroupsSection }}</div>
            <!--
              Same treatment as the Sort active rows, minus a click action — a group entry has
              nothing to toggle (no direction), so the row is draggable/focusable purely for
              reordering (drag, or Alt+↑/↓ when focused); `×` remove is the only button.
              @dragover/@drop are handled at the Dropdown panel level (see above), not per-row —
              that's what lets a drop past the last row still resolve to a valid target.
            -->
            <div
              v-for="(key, i) in groupBy"
              :key="key"
              :ref="(el) => setGroupRowRef(key, el as Element | null)"
              :data-group-key="key"
              class="dt__dd-item dt__dd-item--col dt__dd-item--grouprow"
              :class="{
                'dt__dd-item--dragging': dragGroupKey === key,
                'dt__dd-item--drag-over': dragOverGroupKey === key && !dragOverGroupAfter,
                'dt__dd-item--drag-over-after': dragOverGroupKey === key && dragOverGroupAfter,
              }"
              draggable="true"
              tabindex="0"
              @keydown="onGroupRowKeyDown($event, key)"
              @dragstart="onGroupDragStart(key)"
              @dragend="onGroupDragEnd"
            >
              <span class="dt__dd-drag-handle" aria-hidden="true">⠿</span>
              <span class="dt__sort-idx">{{ i + 1 }}</span>
              <span class="dt__flex1">{{ findCol(key)?.label ?? key }}</span>
              <button
                type="button"
                class="dt__item-remove"
                :title="L.removeGroup"
                :aria-label="L.removeGroup"
                draggable="false"
                @click="onRemoveGroupClick(key)"
              >
                ×
              </button>
            </div>
          </template>
          <template v-if="addableGroupCols.length > 0">
            <!-- Same search + alphabetize treatment as Sort's add list above, for the same reason. -->
            <div class="dt__dd-search-row">
              <span class="dt__dd-search-wrap">
                <input
                  type="text"
                  class="dt__dd-search"
                  data-dd-search
                  :placeholder="L.filterSearchPlaceholder"
                  :value="ddSearchTerm('group')"
                  @input="setDdSearchTerm('group', ($event.target as HTMLInputElement).value)"
                />
                <button
                  v-if="ddSearchTerm('group')"
                  type="button"
                  class="dt__dd-search-clear"
                  :title="L.clearSearch"
                  :aria-label="L.clearSearch"
                  @click="setDdSearchTerm('group', '')"
                >
                  ×
                </button>
              </span>
            </div>
            <div class="dt__dd-section">{{ L.groupSection }}</div>
            <template v-if="isGroupSearching">
              <button
                v-for="col in searchedFlatAddableGroupCols"
                :key="col.key"
                :ref="(el) => setAddableGroupRef(col.key, el as Element | null)"
                type="button"
                class="dt__dd-item dt__dd-item--clickable"
                @click="onAddGroup(col.key)"
              >
                <span class="dt__flex1">{{ col.label }}</span>
                <span v-if="col.category" class="dt__dd-item-category">{{ col.category }}</span>
              </button>
            </template>
            <template v-else>
              <button
                v-for="col in categorizedAddableGroupCols.uncategorized"
                :key="col.key"
                :ref="(el) => setAddableGroupRef(col.key, el as Element | null)"
                type="button"
                class="dt__dd-item dt__dd-item--clickable"
                @click="onAddGroup(col.key)"
              >
                <span class="dt__flex1">{{ col.label }}</span>
              </button>
              <CategorySubmenu
                v-for="category in categorizedAddableGroupCols.categories"
                :key="category.name"
                :name="category.name"
                :is-open="openGroupCategory === category.name"
                @open="openGroupCategory = category.name"
                @close="
                  openGroupCategory = openGroupCategory === category.name ? null : openGroupCategory
                "
              >
                <button
                  v-for="col in category.columns"
                  :key="col.key"
                  :ref="(el) => setAddableGroupRef(col.key, el as Element | null)"
                  type="button"
                  class="dt__dd-item dt__dd-item--clickable"
                  @click="onAddGroup(col.key)"
                >
                  <span class="dt__flex1">{{ col.label }}</span>
                </button>
              </CategorySubmenu>
            </template>
          </template>
        </Dropdown>

        <!-- Sort -->
        <Dropdown
          v-if="sortableCols.length > 0"
          @dragover="onSortRowsDragOver"
          @drop="onSortRowsDrop"
          :on-escape-clearable="sortEscapeClearable"
        >
          <template #trigger="{ open }">
            <ToolbarBtn :active="open || sorts.length > 0" :grouped="sorts.length > 0">
              {{ L.sort }}
            </ToolbarBtn>
          </template>
          <!--
            Rendered next to (not inside) the toggle button — replaces the old in-panel
            "Clear sorts" footer row (removed below) with a one-click affordance that doesn't
            require opening the dropdown first. See Dropdown's `extra-trigger` slot.
          -->
          <template #extra-trigger>
            <button
              v-if="sorts.length > 0"
              type="button"
              class="dt__btn-clear"
              :title="L.clearSorts"
              :aria-label="L.clearSorts"
              @click="clearSorts"
            >
              ×
            </button>
          </template>
          <template v-if="groupSortEntries.length > 0">
            <div class="dt__dd-section">{{ L.groupOrderSection }}</div>
            <div class="dt__dd-hint">{{ L.groupOrderHint }}</div>
            <!--
              Not draggable, no Alt+↑/↓ reorder — nesting order always follows groupBy's own
              order (see the Group dropdown), so reordering here would be a no-op; direction is
              still toggleable/removable in place, same as any other sort entry.
            -->
            <div
              v-for="(entry, i) in groupSortEntries"
              :key="entry.key"
              class="dt__dd-item dt__dd-item--col dt__dd-item--sortrow dt__dd-item--locked"
              tabindex="0"
              @click="toggleSortDir(entry.key)"
              @keydown="
                (e: KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggleSortDir(entry.key)
                  } else if (e.key === 'Delete' || e.key === 'Backspace') {
                    // Keyboard equivalent of this row's own × button — matches the Filter
                    // dropdown's identical Delete/Backspace-on-a-focused-active-row shortcut.
                    // This row isn't draggable/reorderable, but removing its sort entry still
                    // needs the same focus hand-off as any other (see onRemoveSortClick).
                    e.preventDefault()
                    onRemoveSortClick(entry.key)
                  }
                }
              "
            >
              <span class="dt__sort-idx">{{ i + 1 }}</span>
              <span class="dt__flex1">{{ findCol(entry.key)?.label ?? entry.key }}</span>
              <span class="dt__sort-icon dt__sort-icon--active">{{ getSortIcon(entry.key) }}</span>
              <button
                type="button"
                class="dt__item-remove"
                :title="L.removeSort"
                :aria-label="L.removeSort"
                draggable="false"
                @click.stop="onRemoveSortClick(entry.key)"
              >
                ×
              </button>
            </div>
          </template>
          <template v-if="nonGroupSortEntries.length > 0">
            <div class="dt__dd-section">{{ L.activeSortsSection }}</div>
            <!--
              The whole row is the click target (toggles direction) and the drag source (reorder
              priority); `×` stays a separate <button> (draggable="false" so starting a drag from
              it doesn't also drag the row) since removing isn't something a row click/drag
              should ever trigger. tabindex + @keydown give it Alt+↑/↓ reorder and
              Enter/Space-to-toggle from the keyboard — a plain div gets no free keyboard
              activation the way a real <button> would (unlike the add-list below).
              @dragover/@drop are handled at the Dropdown panel level (see above), not per-row —
              that's what lets a drop past the last row still resolve to a valid target.
            -->
            <div
              v-for="(entry, i) in nonGroupSortEntries"
              :key="entry.key"
              :ref="(el) => setSortRowRef(entry.key, el as Element | null)"
              :data-sort-key="entry.key"
              class="dt__dd-item dt__dd-item--col dt__dd-item--sortrow"
              :class="{
                'dt__dd-item--dragging': dragSortKey === entry.key,
                'dt__dd-item--drag-over': dragOverSortKey === entry.key && !dragOverSortAfter,
                'dt__dd-item--drag-over-after': dragOverSortKey === entry.key && dragOverSortAfter,
              }"
              draggable="true"
              tabindex="0"
              @click="toggleSortDir(entry.key)"
              @keydown="onSortRowKeyDown($event, entry.key)"
              @dragstart="onSortDragStart(entry.key)"
              @dragend="onSortDragEnd"
            >
              <span class="dt__dd-drag-handle" aria-hidden="true">⠿</span>
              <span class="dt__sort-idx">{{ i + 1 }}</span>
              <span class="dt__flex1">{{ findCol(entry.key)?.label ?? entry.key }}</span>
              <span class="dt__sort-icon dt__sort-icon--active">{{ getSortIcon(entry.key) }}</span>
              <button
                type="button"
                class="dt__item-remove"
                :title="L.removeSort"
                :aria-label="L.removeSort"
                draggable="false"
                @click.stop="onRemoveSortClick(entry.key)"
              >
                ×
              </button>
            </div>
          </template>
          <template v-if="addableSortCols.length > 0">
            <!--
              Search box narrows this "add" list only — the active-sorts section above keeps its
              own priority order and is never hidden by it. The add list itself carries no
              ordering meaning (none of these are sorted yet), so it's alphabetized by label
              instead of raw column-definition order, to make scanning a long list easier.
            -->
            <div class="dt__dd-search-row">
              <span class="dt__dd-search-wrap">
                <input
                  type="text"
                  class="dt__dd-search"
                  data-dd-search
                  :placeholder="L.filterSearchPlaceholder"
                  :value="ddSearchTerm('sort')"
                  @input="setDdSearchTerm('sort', ($event.target as HTMLInputElement).value)"
                />
                <button
                  v-if="ddSearchTerm('sort')"
                  type="button"
                  class="dt__dd-search-clear"
                  :title="L.clearSearch"
                  :aria-label="L.clearSearch"
                  @click="setDdSearchTerm('sort', '')"
                >
                  ×
                </button>
              </span>
            </div>
            <div class="dt__dd-section">{{ L.sortSection }}</div>
            <!--
              A real <button> (not a div) so it's a native Tab stop and Enter/Space "click" it
              for free — no manual tabindex/keydown wiring needed, unlike the active rows above
              (which need custom keyboard handling anyway for Alt+↑/↓ reorder).
            -->
            <template v-if="isSortSearching">
              <button
                v-for="col in searchedFlatAddableSortCols"
                :key="col.key"
                :ref="(el) => setAddableSortRef(col.key, el as Element | null)"
                type="button"
                class="dt__dd-item dt__dd-item--clickable"
                @click="onAddSort(col.key)"
              >
                <span class="dt__flex1">{{ col.label }}</span>
                <span v-if="col.category" class="dt__dd-item-category">{{ col.category }}</span>
              </button>
            </template>
            <template v-else>
              <button
                v-for="col in categorizedAddableSortCols.uncategorized"
                :key="col.key"
                :ref="(el) => setAddableSortRef(col.key, el as Element | null)"
                type="button"
                class="dt__dd-item dt__dd-item--clickable"
                @click="onAddSort(col.key)"
              >
                <span class="dt__flex1">{{ col.label }}</span>
              </button>
              <CategorySubmenu
                v-for="category in categorizedAddableSortCols.categories"
                :key="category.name"
                :name="category.name"
                :is-open="openSortCategory === category.name"
                @open="openSortCategory = category.name"
                @close="
                  openSortCategory = openSortCategory === category.name ? null : openSortCategory
                "
              >
                <button
                  v-for="col in category.columns"
                  :key="col.key"
                  :ref="(el) => setAddableSortRef(col.key, el as Element | null)"
                  type="button"
                  class="dt__dd-item dt__dd-item--clickable"
                  @click="onAddSort(col.key)"
                >
                  <span class="dt__flex1">{{ col.label }}</span>
                </button>
              </CategorySubmenu>
            </template>
          </template>
        </Dropdown>

        <div v-if="endFirst()" class="dt__toolbar-end">
          <slot name="toolbar-end" />
        </div>
        <!-- Divider between the "shape" controls above (Columns/Sort/Group) and the "find"
             controls below (Search/Filter). -->
        <span v-else class="dt__toolbar-divider" />

        <span v-if="showSearch" class="dt__search-wrap">
          <input
            ref="searchInputRef"
            type="text"
            class="dt__search-input"
            :placeholder="L.search"
            :value="searchQuery"
            @input="setSearchQuery(($event.target as HTMLInputElement).value)"
          />
          <button
            v-if="searchQuery"
            type="button"
            class="dt__search-clear"
            :title="L.clearSearch"
            :aria-label="L.clearSearch"
            @click="clearSearchQuery"
          >
            ×
          </button>
        </span>

        <!-- Filter -->
        <Dropdown
          v-if="filterableCols.length > 0"
          ref="filterDropdownRef"
          @keydown="onFilterDropdownKeydown"
          :on-escape-clearable="filterEscapeClearable"
          nav-root=".dt__filter-cols"
        >
          <template #trigger="{ open }">
            <ToolbarBtn :active="open || activeFilterCount > 0" :grouped="activeFilterCount > 0">
              {{ L.filter }}
            </ToolbarBtn>
          </template>
          <template #extra-trigger>
            <button
              v-if="activeFilterCount > 0"
              type="button"
              class="dt__btn-clear"
              :title="L.clearFilters"
              :aria-label="L.clearFilters"
              @click="clearFilters"
            >
              ×
            </button>
          </template>
          <div class="dt__filter-panel" :class="{ 'dt__filter-panel--narrow': narrowFilter }">
            <div v-if="!narrowFilter || !filterShowValues" class="dt__filter-cols" data-filter-cols>
              <!--
                Search box (sticky within this scrollable pane, see styles below) narrows the
                column list itself — separate from FilterPane's value search, which narrows the
                *values* shown in the right-hand detail pane. No inherent order to preserve here
                (unlike the Columns dropdown, this list isn't reorderable), so it's alphabetized
                by label rather than raw column-definition order.
              -->
              <span class="dt__dd-search-wrap dt__filter-cols-search-wrap">
                <input
                  type="text"
                  class="dt__dd-search dt__filter-cols-search"
                  data-dd-search
                  :placeholder="L.filterSearchPlaceholder"
                  :value="ddSearchTerm('filter')"
                  @input="setDdSearchTerm('filter', ($event.target as HTMLInputElement).value)"
                />
                <button
                  v-if="ddSearchTerm('filter')"
                  type="button"
                  class="dt__dd-search-clear"
                  :title="L.clearSearch"
                  :aria-label="L.clearSearch"
                  @click="setDdSearchTerm('filter', '')"
                >
                  ×
                </button>
              </span>
              <!--
                The row (not the item button alone) carries the selected-column highlight, so it
                spans the clear button too instead of stopping short of it — see
                .dt__filter-col-row/--active below. A <button> can't contain another interactive
                element, so the clear button is a sibling, not nested.
              -->
              <template v-for="col in categorizedFilterCols.uncategorized" :key="col.key">
                <div
                  class="dt__filter-col-row"
                  :class="{ 'dt__filter-col-row--active': col.key === filterActiveKey }"
                >
                  <!--
                    A real <button> (not a div) so it's a native Tab stop and Enter/Space "click"
                    it for free — same fix as the Sort/Group add-lists above; this had the
                    identical gap. @focus is what actually drives the detail pane (see
                    onFilterColFocus) — a listbox/radiogroup-style "focus follows selection" so
                    arrowing/Tabbing here needs no separate Enter/Space "activate" step; @click
                    stays wired too (harmlessly redundant, since focusing a button on click
                    already fires @focus first). Delete/Backspace clearing the column's filter is
                    handled by onFilterDropdownKeydown (bound on the whole panel), not here — same
                    action as the clear button below, reachable without leaving the row.
                  -->
                  <button
                    :ref="(el) => setFilterColRef(col.key, el as Element | null)"
                    type="button"
                    :data-filter-col-key="col.key"
                    class="dt__filter-col-item"
                    :class="{ 'dt__filter-col-item--active': col.key === filterActiveKey }"
                    @focus="onFilterColFocus(col.key)"
                    @click="selectFilterCol(col.key)"
                  >
                    <span class="dt__filter-col-label">{{ col.label }}</span>
                  </button>
                  <!--
                    Replaces the plain active-filter dot: a one-click way to drop this column's
                    filter without opening it first, matching the toolbar's own per-dropdown ×
                    buttons (see "Toolbar clear buttons" in docs/toolbar.md).
                  -->
                  <button
                    v-if="hasActiveColFilter(col)"
                    type="button"
                    class="dt__filter-col-clear"
                    :title="L.clearColumnFilter"
                    :aria-label="L.clearColumnFilter"
                    @click.stop="clearColFilter(col.key)"
                  >
                    ×
                  </button>
                </div>
              </template>
              <!--
                A category collapses its columns into a section instead of a flyout submenu
                (unlike Columns/Sort/Group) — ArrowRight is already taken here for left-pane→
                detail-pane crossing (see onFilterDropdownKeydown). Collapsed by default, except a
                category with an active filter at the moment the panel opens (see
                collapsedCategories' own comment above).
              -->
              <template v-for="category in categorizedFilterCols.categories" :key="category.name">
                <!--
                  A collapsed category force-expands whenever it currently has a search match —
                  always safe, since a category only ever appears here at all when it has one (see
                  isFilterSearching's own comment above). collapsedCategories itself stays
                  untouched, so clearing the search reverts to whatever it was before.
                -->
                <button
                  type="button"
                  class="dt__filter-category-header"
                  :data-filter-category-header="category.name"
                  :aria-expanded="isFilterSearching || !collapsedCategories.has(category.name)"
                  @click="toggleCategoryCollapsed(category.name)"
                >
                  <span class="dt__flex1">{{ category.name }}</span>
                  <span class="dt__filter-category-toggle">
                    {{ !isFilterSearching && collapsedCategories.has(category.name) ? '▸' : '▾' }}
                  </span>
                </button>
                <div
                  v-if="isFilterSearching || !collapsedCategories.has(category.name)"
                  class="dt__filter-category-cols"
                >
                  <div
                    v-for="col in category.columns"
                    :key="col.key"
                    class="dt__filter-col-row"
                    :class="{ 'dt__filter-col-row--active': col.key === filterActiveKey }"
                  >
                    <button
                      :ref="(el) => setFilterColRef(col.key, el as Element | null)"
                      type="button"
                      :data-filter-col-key="col.key"
                      class="dt__filter-col-item"
                      :class="{ 'dt__filter-col-item--active': col.key === filterActiveKey }"
                      @focus="onFilterColFocus(col.key)"
                      @click="selectFilterCol(col.key)"
                    >
                      <span class="dt__filter-col-label">{{ col.label }}</span>
                    </button>
                    <button
                      v-if="hasActiveColFilter(col)"
                      type="button"
                      class="dt__filter-col-clear"
                      :title="L.clearColumnFilter"
                      :aria-label="L.clearColumnFilter"
                      @click.stop="clearColFilter(col.key)"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </template>
            </div>
            <button
              v-if="narrowFilter && filterShowValues"
              type="button"
              class="dt__dd-item dt__dd-item--clickable dt__filter-back"
              data-filter-back
              @click="showFilterColumns"
            >
              ‹ {{ L.columns }}
            </button>
            <FilterPane
              v-if="filterDetailCol && (!narrowFilter || filterShowValues)"
              :key="filterDetailCol.key"
              :table="table"
              :col="filterDetailCol"
              :data="data"
              :columns="columns"
            >
              <!-- Slot #filter-{key}: custom value label in the filter checklist (not the date
                   tree), scope { value: string }; falls back to the raw value -->
              <template #value="{ value, label }">
                <slot :name="`filter-${filterDetailCol.key}`" :value="value">{{ label }}</slot>
              </template>
            </FilterPane>
          </div>
        </Dropdown>

        <!-- "Clear all" sits alone at the far right of the actions row (margin-left: auto, see
             .dt__clear-all) — nothing else in the row needs to reflow when it mounts/unmounts,
             unlike the old layout where it sat between search and the stats text. -->
        <button v-if="hasActiveState" class="dt__clear-all" @click="clearAllAndFocus">
          {{ L.clearAll }}
        </button>
        <div v-if="hasSlot('toolbar-end') && !endFirst()" class="dt__toolbar-end">
          <slot name="toolbar-end" />
        </div>
      </div>
    </div>

    <!--
      ── Active state bar ──
      Always rendered (even with nothing active) rather than only appearing once a filter is
      set — this gives the row-count stats a single stable home instead of bouncing between "end
      of the toolbar row" and nowhere, and means toggling a sort/filter/group never changes the
      toolbar's height. Shows one chip per active sort entry, group column, and filter column —
      sort/group chips were previously only visible as a bare count on their toolbar button (see
      above); giving them the same at-a-glance chip treatment filters already had removes that
      asymmetry. Sort/group chips reuse the plain neutral `.dt__chip` look (the same one the
      removed count badges used) — filter chips keep their existing blue `.dt__chip--info` tint,
      the one deliberate color accent in this bar, since filters already carried that "this is
      narrowing your view" meaning before this change.
    -->
    <!--
      Each chip's body is now a real, focusable <button> (a sibling of its × remove button, not
      nested inside it — a <button> can't contain another interactive element, the same reasoning
      already used for the toolbar's grouped clear buttons) rather than a plain, inert <span>:
      clicking (or Enter/Space-activating) it does something specific to that chip's own kind of
      active state, so tweaking an already-active sort/group/filter no longer requires reopening
      its dropdown and re-navigating to the same entry — see "Active-bar chip click actions".
      Sort's body toggles direction in place (no dropdown needed for the single most common
      tweak); Group's/Filter's open their dropdown straight to that entry/column, since neither
      has an equally obvious single inline toggle the way direction is for sort.
    -->
    <div class="dt__active-bar">
      <!-- A grouped column always carries its own sort entry now (insertGroupSort, issue #17),
           so rendering the sort loop and the group loop independently would show two
           identically-labeled chips for the same column with nothing visually linking them —
           nonGroupSortEntries below skips a sort entry when its key is also a groupBy key; it's
           rendered merged with its group chip here instead. Group chips render before plain sort
           chips — matches the Sort dropdown's own "Group order" section coming before "Active
           sorts", since grouping is the structural, primary concern and tie-break sorting is
           secondary. -->
      <template v-for="key in groupBy" :key="key">
        <span v-if="sorts.find((s) => s.key === key)" class="dt__chip dt__chip--grouped-sort">
          <button type="button" class="dt__chip-body" @click="toggleSortDir(key)">
            {{ getSortIcon(key) }} {{ findCol(key)?.label ?? key }}
          </button>
          <button
            type="button"
            class="dt__chip-remove"
            :title="L.removeSort"
            :aria-label="L.removeSort"
            @click="removeSort(key)"
          >
            ×
          </button>
          <!--
            Opens the Group dropdown focused on this entry — distinct from the chip body right
            before it, which toggles sort direction instead. Its own dedicated label
            (openGroupDropdown), not the generic L.group — a screen reader announcing plain
            "Group" on this button gave no indication what it actually does.
          -->
          <button
            type="button"
            class="dt__chip-group-mark"
            :title="L.openGroupDropdown"
            :aria-label="L.openGroupDropdown"
            :data-chip-group-mark="key"
            @click="onOpenGroupEntry(key)"
          >
            ⊞
          </button>
          <button
            type="button"
            class="dt__chip-remove"
            :title="L.removeGroup"
            :aria-label="L.removeGroup"
            @click="removeGroup(key)"
          >
            ×
          </button>
        </span>
        <span v-else class="dt__chip">
          <button type="button" class="dt__chip-body" @click="onOpenGroupEntry(key)">
            {{ findCol(key)?.label ?? key }}
          </button>
          <button
            type="button"
            class="dt__chip-remove"
            :title="L.removeGroup"
            :aria-label="L.removeGroup"
            @click="removeGroup(key)"
          >
            ×
          </button>
        </span>
      </template>
      <span v-for="entry in nonGroupSortEntries" :key="entry.key" class="dt__chip">
        <button type="button" class="dt__chip-body" @click="toggleSortDir(entry.key)">
          {{ getSortIcon(entry.key) }} {{ findCol(entry.key)?.label ?? entry.key }}
        </button>
        <button
          type="button"
          class="dt__chip-remove"
          :title="L.removeSort"
          :aria-label="L.removeSort"
          @click="removeSort(entry.key)"
        >
          ×
        </button>
      </span>
      <template v-if="activeFilterCount > 0">
        <template v-for="[key, vals] in Object.entries(filters)" :key="key">
          <span v-if="vals.size > 0" class="dt__chip dt__chip--info">
            <button type="button" class="dt__chip-body" @click="onOpenFilterCol(key)">
              {{ columns.find((c) => c.key === key)?.label }}:
              {{
                summarizeFilterValues(
                  vals,
                  L.moreValues,
                  (v) => formatFilterValue(findCol(key), v, L.emptyValue),
                  chipSeparator(filterMatchMode(filterModes, key, findCol(key))),
                )
              }}
            </button>
            <button
              type="button"
              class="dt__chip-remove"
              :title="L.clearColumnFilter"
              :aria-label="L.clearColumnFilter"
              @click="clearColumnFilter(key, 'include')"
            >
              ×
            </button>
          </span>
        </template>
        <!-- Exclude filters (see cycleFilterValue in the docs) get their own chip, distinguished
             by a "≠" prefix instead of a translated word — same reasoning the sort/value-sort
             icons already use symbols (↑/↓, ABC/#) rather than growing every locale file.
             dt__chip--danger tints it apart from a plain include chip so the two read as opposite
             actions at a glance, not just different text. -->
        <template v-for="chip in exclusionChips" :key="`exclude-${chip.key}`">
          <span class="dt__chip" :class="chip.kept ? 'dt__chip--info' : 'dt__chip--danger'">
            <button type="button" class="dt__chip-body" @click="onOpenFilterCol(chip.key)">
              {{ chip.label }}: {{ chip.kept ? '' : '≠' }}
              {{
                summarizeFilterValues(chip.values, L.moreValues, (v) =>
                  formatFilterValue(findCol(chip.key), v, L.emptyValue),
                )
              }}
            </button>
            <button
              type="button"
              class="dt__chip-remove"
              :title="L.clearColumnFilter"
              :aria-label="L.clearColumnFilter"
              @click="clearColumnFilter(chip.key, 'exclude')"
            >
              ×
            </button>
          </span>
        </template>
        <!-- A range filter (number or date) didn't get a chip at all before — it's a distinct
             active filter from the checklist above, so it needs its own (a date column can have
             both active at once). -->
        <template v-for="[key, rf] in Object.entries(rangeFilters)" :key="`range-${key}`">
          <span v-if="rf.min !== '' || rf.max !== ''" class="dt__chip dt__chip--info">
            <button type="button" class="dt__chip-body" @click="onOpenFilterCol(key)">
              {{ columns.find((c) => c.key === key)?.label }}:
              {{ rangeChipText(findCol(key), rf, L.emptyValue) }}
            </button>
            <button
              type="button"
              class="dt__chip-remove"
              :title="L.clearColumnFilter"
              :aria-label="L.clearColumnFilter"
              @click="clearColumnFilter(key, 'range')"
            >
              ×
            </button>
          </span>
        </template>
      </template>
      <span class="dt__stats">
        {{ L.rowCount(processedData.length, data.length) }}
        <template v-if="groupBy.length > 0">{{ L.groupCount(pageGroupCount) }}</template>
      </span>
    </div>

    <!-- ── Table ── -->
    <div class="dt__table-wrap">
      <table class="dt__table">
        <thead>
          <tr>
            <th
              v-if="selectable"
              class="dt__th dt__th--cb dt__check-cell"
              @click.stop.self="toggleSelectAll(processedData)"
            >
              <input
                v-indeterminate="someSelected"
                type="checkbox"
                :checked="allSelected"
                :aria-label="L.selectAll"
                @change="toggleSelectAll(processedData)"
              />
            </th>
            <th v-if="groupBy.length > 0" class="dt__th" style="width: 28px" />
            <th
              v-for="col in activeColumns"
              :key="col.key"
              class="dt__th"
              :aria-sort="headerAriaSort(col.key)"
              :class="{
                'dt__th--dragging': dragColKey === col.key,
                'dt__th--drag-over': dragOverColKey === col.key,
              }"
              :style="{ width: col.width ? `${col.width}px` : undefined }"
              :draggable="menuColKey === col.key ? 'false' : 'true'"
              @dragstart="onColDragStart(col.key)"
              @dragover.prevent="onColDragOver(col.key)"
              @drop.prevent="onColDrop(col.key)"
              @dragend="onColDragEnd"
              @click="onHeaderSortClick(col, $event)"
            >
              <span class="dt__th-inner">
                <!-- A button so keyboard users can sort; its click bubbles to the <th>'s handler -->
                <component
                  :is="col.sortable === false ? 'span' : 'button'"
                  :type="col.sortable === false ? undefined : 'button'"
                  class="dt__th-sort"
                >
                  {{ col.label }}
                  <span
                    v-if="col.sortable !== false"
                    class="dt__th-sort-icon"
                    :class="{ 'dt__th-sort-icon--sorted': isHeaderSorted(col.key) }"
                    aria-hidden="true"
                    :style="{
                      fontSize: '10px',
                      color: isHeaderSorted(col.key)
                        ? 'var(--color-text-primary)'
                        : 'var(--color-border-secondary)',
                    }"
                  >
                    {{ headerSortLabel(col.key) }}
                  </span>
                </component>
                <HeaderMenu
                  :table="table"
                  :col="col"
                  :data="data"
                  :columns="columns"
                  @open-change="
                    (open: boolean) =>
                      (menuColKey = open ? col.key : menuColKey === col.key ? null : menuColKey)
                  "
                >
                  <template #value="{ value, label }">
                    <slot :name="`filter-${col.key}`" :value="value">{{ label }}</slot>
                  </template>
                </HeaderMenu>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="group in groupedData" :key="group.key ?? '__root__'">
            <!-- Group header -->
            <tr
              v-if="group.key !== null"
              :ref="(el) => setItemRef(group.key!, el as Element | null)"
              :tabindex="isFocusTarget({ kind: 'group', key: group.key! }) ? 0 : -1"
              :aria-expanded="!groupCollapsed(group.key!)"
              class="dt__group-row"
              @click="toggleGroupCollapse(group.key!)"
              @keydown="handleKeyDown($event, { kind: 'group', key: group.key! })"
              @focusin="setFocusTarget({ kind: 'group', key: group.key! })"
            >
              <td
                v-if="selectable"
                class="dt__group-td dt__check-cell"
                style="width: 36px"
                @click.stop.self="toggleSelectAll(group.rows)"
              >
                <input
                  v-indeterminate="isGroupSomeSelected(group.rows)"
                  type="checkbox"
                  :checked="isGroupAllSelected(group.rows)"
                  :aria-label="
                    L.selectGroup(groupText(columns, groupBy, group.keyParts, group.sampleRow!))
                  "
                  @change="toggleSelectAll(group.rows)"
                />
              </td>
              <td class="dt__group-td">
                {{ groupCollapsed(group.key!) ? '▶' : '▼' }}
              </td>
              <td :colspan="activeColumns.length" class="dt__group-td">
                <template v-for="(g, i) in groupBy" :key="g">
                  <span v-if="i > 0" class="dt__group-sep">›</span>
                  <span class="dt__group-key-label">{{ findCol(g)?.label }}:</span>
                  <!--
                    A bucketed column (col.groupValue) has no single raw value the #group-{key}
                    slot's scope could meaningfully carry — same reasoning the date filter tree
                    skips its own per-value slot for branch nodes — so it bypasses the slot
                    entirely and renders groupFormat's label directly.
                  -->
                  <template v-if="findCol(g)?.groupValue">{{
                    groupBucketLabel(group, g, i)
                  }}</template>
                  <!--
                    Slot #group-{key} — custom rendering in the group header.
                    Slot scope: { value: unknown, row: TRow }
                    Falls back to format() or string coercion.
                  -->
                  <slot
                    v-else
                    :name="`group-${g}`"
                    :value="groupRawValue(group, g, i)"
                    :row="group.sampleRow!"
                  >
                    {{
                      findCol(g)
                        ? formatValue(groupRawValue(group, g, i), group.sampleRow!, findCol(g)!)
                        : String(groupRawValue(group, g, i) ?? '')
                    }}
                  </slot>
                </template>
                <span v-if="group.continued" class="dt__group-continued">{{
                  L.groupContinued
                }}</span>
                <span class="dt__group-count">{{ L.rowsInGroup(group.rows.length) }}</span>
              </td>
            </tr>

            <!-- Aggregate row -->
            <tr v-if="group.key !== null && hasAggregates" class="dt__agg-row">
              <td v-if="selectable" class="dt__agg-td" style="width: 36px" />
              <td class="dt__agg-td" style="width: 28px" />
              <td v-for="col in activeColumns" :key="col.key" class="dt__agg-td">
                {{
                  (() => {
                    const v = computeAggregate(col, group.rows)
                    if (v === undefined || v === null) return ''
                    return col.format ? col.format(v, group.sampleRow!) : String(v)
                  })()
                }}
              </td>
            </tr>

            <!-- Data rows -->
            <template v-if="group.key === null || !groupCollapsed(group.key!)">
              <tr
                v-for="(row, ri) in group.rows"
                :key="(asRecord(row)[rowKey] as string | number) ?? `${group.key}-${ri}`"
                :ref="(el) => setItemRef(row, el as Element | null)"
                :tabindex="
                  isRowNavEnabled ? (isFocusTarget({ kind: 'row', row }) ? 0 : -1) : undefined
                "
                :aria-selected="selectable ? selection.has(row) : undefined"
                :aria-current="isCurrent(row) ? 'true' : undefined"
                :class="{
                  'dt__tr--stripe': ri % 2 !== 0,
                  'dt__tr--selected': selectable && selection.has(row),
                  'dt__tr--clickable': isRowClickable,
                  'dt__tr--current': isCurrent(row),
                }"
                @click="handleRowClick(row, $event)"
                @keydown="handleKeyDown($event, { kind: 'row', row })"
                @focusin="setFocusTarget({ kind: 'row', row })"
              >
                <td
                  v-if="selectable"
                  class="dt__td dt__check-cell"
                  style="width: 36px"
                  @click.stop.self="toggleRowSelection(row, $event.shiftKey)"
                >
                  <input
                    type="checkbox"
                    tabindex="-1"
                    :checked="selection.has(row)"
                    :aria-label="L.selectRow(rowText(activeColumns, row))"
                    @click="toggleRowSelection(row, $event.shiftKey)"
                  />
                </td>
                <td v-if="group.key !== null" class="dt__td" style="width: 28px" />
                <td
                  v-for="col in activeColumns"
                  :key="col.key"
                  class="dt__td"
                  :style="{ width: col.width ? `${col.width}px` : undefined }"
                >
                  <!--
                    Slot #cell-{key} — custom cell rendering.
                    Slot scope: { value: unknown, row: TRow }
                    Falls back to format() or string coercion.
                  -->
                  <slot
                    v-if="hasSlot(`cell-${col.key}`)"
                    :name="`cell-${col.key}`"
                    :value="getColumnValue(col, row)"
                    :row="row"
                  />
                  <template v-else>{{ cellText(col, row) }}</template>
                </td>
              </tr>
            </template>
          </template>
          <tr v-if="processedData.length === 0">
            <td
              class="dt__td dt__empty"
              :colspan="activeColumns.length + (selectable ? 1 : 0) + (groupBy.length > 0 ? 1 : 0)"
            >
              <template v-if="data.length === 0">{{ L.noRows }}</template>
              <template v-else>
                {{ L.noMatchingRows }}
                <button class="dt__clear-all" @click="clearSearchAndFilters">
                  {{ L.clearSearchAndFilters }}
                </button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── Pagination ── -->
    <div v-if="pageSize > 0" class="dt__pagination">
      <button
        class="dt__page-btn"
        :disabled="page === 1"
        :aria-label="L.firstPage"
        @click="setPage(1)"
      >
        «
      </button>
      <button
        class="dt__page-btn"
        :disabled="page === 1"
        :aria-label="L.previousPage"
        @click="setPage(page - 1)"
      >
        ‹
      </button>
      <span class="dt__page-info">{{ L.pageOf(page, numPages) }}</span>
      <button
        class="dt__page-btn"
        :disabled="page >= numPages"
        :aria-label="L.nextPage"
        @click="setPage(page + 1)"
      >
        ›
      </button>
      <button
        class="dt__page-btn"
        :disabled="page >= numPages"
        :aria-label="L.lastPage"
        @click="setPage(numPages)"
      >
        »
      </button>
      <label class="dt__rows-per-page-group">
        <span class="dt__rows-per-page-label">{{ L.rowsPerPage }}:</span>
        <select
          class="dt__page-select"
          :value="pageSize"
          @change="setPageSize(Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="n in pageSizeOptions" :key="n" :value="n">{{ n }}</option>
        </select>
      </label>
    </div>
  </div>
</template>

<style scoped>
.dt {
  font-family: inherit;
  font-size: 14px;
  color: var(--color-text-primary);
}

/* Toolbar */
.dt__toolbar {
  padding: 12px 0;
  border-bottom: 0.5px solid var(--color-border-tertiary);
}
.dt__toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
/* Separates the "shape" controls (Columns/Sort/Group — what's shown and in what order) from
   the "find" controls (Search/Filter — which rows are shown at all). */
.dt__toolbar-divider {
  width: 1px;
  height: 22px;
  background: var(--color-border-secondary);
  flex-shrink: 0;
  margin: 0 2px;
}
/* Always rendered below the toolbar — see the "Active state bar" comment in the template — so
   the stats text has one stable home instead of bouncing between "end of the toolbar row" and
   nowhere, and toggling a sort/filter/group never changes the toolbar's height. */
.dt__active-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 10px 0;
}
.dt__stats {
  margin-left: auto;
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}
.dt__search-wrap {
  position: relative;
  display: inline-flex;
  flex: 1;
  min-width: 160px;
  max-width: 280px;
}
.dt__search-input {
  padding: 4px 24px 4px 8px;
  font-size: 13px;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-family: inherit;
  width: 100%;
}
.dt__search-clear {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  font-size: 14px;
  line-height: 1;
  color: var(--color-text-tertiary);
  font-family: inherit;
}
.dt__search-clear:hover {
  color: var(--color-text-primary);
}
/* Adjoining × button for the Sort/Group/Filter toolbar buttons — see Dropdown's
   `extra-trigger` slot and ToolbarBtn's `grouped` prop. Replaces the old in-panel "Clear
   sorts"/etc. footer rows with a one-click affordance that doesn't require opening the
   dropdown first. */
.dt__btn-clear {
  display: inline-flex;
  align-items: center;
  padding: 5px 8px;
  background: none;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 0 6px 6px 0;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  color: var(--color-text-tertiary);
  font-family: inherit;
}
.dt__btn-clear:hover {
  color: var(--color-text-primary);
}
.dt__clear-all {
  margin-left: auto;
  padding: 5px 10px;
  background: none;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  color: var(--color-text-secondary);
  font-family: inherit;
}
.dt__toolbar-end {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.dt__clear-all ~ .dt__toolbar-end {
  margin-left: 0;
}

/* Dropdown internals */
.dt__dd-section {
  padding: 6px 14px 2px;
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.dt__dd-hint {
  padding: 0 14px 6px;
  font-size: 11px;
  color: var(--color-text-tertiary);
}
:deep(.dt__dd-item) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  font-size: 13px;
  color: var(--color-text-primary);
  /* Button reset — some dd-items render as <button> (add-lists) instead of <div>, for Tab
     reachability + free Enter/Space activation. A no-op for the existing div/label usages. */
  border: none;
  background: none;
  font-family: inherit;
  text-align: left;
  margin: 0;
  width: 100%;
  box-sizing: border-box;
}
:deep(.dt__dd-item--clickable) {
  cursor: pointer;
}
:deep(.dt__dd-item--clickable:hover),
:deep(.dt__dd-item--clickable:focus) {
  background: var(--color-background-secondary);
}
.dt__dd-item--col {
  justify-content: space-between;
}
.dt__dd-item--sortrow {
  cursor: pointer;
}
.dt__dd-item--sortrow:hover,
.dt__dd-item--sortrow:focus {
  background: var(--color-background-secondary);
}
.dt__dd-item--grouprow,
.dt__dd-item--colrow {
  cursor: grab;
}
/* Sort/Group/Columns' active rows only ever got the browser's native focus outline, no
   background — unlike the Filter dropdown's own left-pane column row, which tints its background
   on selection (see .dt__filter-col-row--active further down) as well as outlining the focused
   button inside it. Matched here for the same reason: an outline alone is a much fainter "this is
   the currently focused row" cue than a filled background. --grouprow/--colrow had no hover
   feedback at all before this either (grab-cursor rows, no --clickable), gaining both. */
.dt__dd-item--grouprow:hover,
.dt__dd-item--grouprow:focus,
.dt__dd-item--colrow:hover,
.dt__dd-item--colrow:focus {
  background: var(--color-background-secondary);
}
/* A "Group order" row (see the Sort dropdown template above) is still clickable to toggle
   direction, just not draggable/Alt+Arrow-reorderable — its own section heading + hint text
   already explain why, so this only needs to cancel --sortrow's hover highlight (a cue that
   dragging would do something here, which it wouldn't), not restyle the row into looking
   disabled. Must come after .dt__dd-item--sortrow:hover above to win the cascade on the shared
   hover background; :focus is deliberately left alone (the row is still keyboard-toggleable, so
   focus stays a meaningful cue there). */
.dt__dd-item--locked:hover {
  background: none;
}
.dt__dd-item--dragging {
  opacity: 0.4;
}
.dt__dd-item--drag-over {
  box-shadow: inset 0 2px 0 var(--color-text-primary);
}
.dt__dd-item--drag-over-after {
  box-shadow: inset 0 -2px 0 var(--color-text-primary);
}
.dt__item-remove {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  font-size: 13px;
  color: var(--color-text-tertiary);
  line-height: 1;
}
.dt__item-remove:hover {
  color: var(--color-text-primary);
}
.dt__sort-icon {
  font-size: 15px;
  color: var(--color-border-secondary);
}
.dt__sort-icon--active {
  color: var(--color-text-primary);
}
.dt__filter-panel {
  display: flex;
  min-width: 460px;
  max-height: 380px;
  /* Safety net for the date tree (see .dt__date-tree-wrap below) — without it, content that
     outgrows max-height would bleed past the panel onto the page instead of being clipped. */
  overflow: hidden;
}
.dt__filter-panel--narrow {
  flex-direction: column;
  min-width: 0;
  /* 100vw counts a classic scrollbar too, hence more than twice the 8 px viewport margin */
  width: calc(100vw - 40px);
}
.dt__filter-panel--narrow .dt__filter-cols {
  width: auto;
  max-width: none;
  border-right: none;
}
.dt__filter-back {
  flex-shrink: 0;
  font-weight: 500;
  border-bottom: 0.5px solid var(--color-border-tertiary);
}
.dt__filter-cols {
  /* Sized to the column names; the search box fills it without widening it */
  width: max-content;
  min-width: 150px;
  max-width: 240px;
  flex-shrink: 0;
  overflow-y: auto;
  border-right: 0.5px solid var(--color-border-tertiary);
  padding: 4px 0;
}
.dt__filter-col-row {
  display: flex;
  align-items: stretch;
}
/* Hover/active highlight lives on the row (not the item button alone) so it spans the clear
   button too, instead of stopping short of it and leaving a gap that reads like a rendering
   glitch. */
.dt__filter-col-row:hover,
.dt__filter-col-row--active {
  background: var(--color-background-secondary);
}
/* flex/min-width/overflow here (not width: 100%) is what makes this button share its row with
   the clear button instead of claiming the whole row's width — see .dt__filter-col-clear. */
.dt__filter-col-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 7px 10px;
  font-size: 13px;
  cursor: pointer;
  color: var(--color-text-primary);
  border: none;
  background: none;
  font-family: inherit;
  text-align: left;
  margin: 0;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  box-sizing: border-box;
}
.dt__filter-col-item--active {
  font-weight: 500;
}
.dt__filter-col-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* Replaces the old plain active-filter dot — see the template's own comment. */
.dt__filter-col-clear {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0 10px;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  color: var(--color-text-tertiary);
  border: none;
  background: none;
  font-family: inherit;
}
.dt__filter-col-clear:hover {
  color: var(--color-text-primary);
}
/* A category collapses its columns into a section instead of a flyout submenu (unlike
   Columns/Sort/Group) — ArrowRight is already taken here for left-pane→detail-pane crossing. */
.dt__filter-category-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 7px 10px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  color: var(--color-text-secondary);
  border: none;
  background: none;
  font-family: inherit;
  text-align: left;
  margin: 0;
  box-sizing: border-box;
}
.dt__filter-category-header:hover {
  background: var(--color-background-secondary);
}
.dt__filter-category-toggle {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--color-text-tertiary);
}
.dt__filter-category-cols .dt__filter-col-item {
  padding-left: 22px;
}
/* A flex column (not just flex: 1) so the checklist/date-tree child below can flex: 1 to fill
   whatever height .dt__filter-cols (the column list) ends up stretching this to via the row's
   cross-axis stretch, instead of a hardcoded height leaving dead space below it once
   .dt__filter-cols renders taller than that default (see .dt__filter-list/.dt__date-tree-wrap). */
:deep(.dt__filter-detail) {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 6px 0;
  min-width: 220px;
}
/* flex: 1 (not a hardcoded height) lets this fill whatever room .dt__filter-detail actually has —
   FILTER_LIST_VIEWPORT_HEIGHT remains only the *assumed* viewport height fed to
   computeVirtualRange's windowing math, not this element's real rendered height. That's safe
   even when they diverge: .dt__filter-panel's own max-height: 380px bounds how much taller this
   can ever grow past the 260px default (~60-80px, given the search row/padding above it), well
   inside the 5-row (160px) overscan on each side — so the virtualized window always has enough
   pre-rendered rows to cover the actual visible box. min-height: 0 is required for a flex column
   child to actually shrink/scroll instead of overflowing its container (the default flex
   min-height: auto would let its content push .dt__filter-detail taller instead). The search row
   above stays outside this element (in normal flow, flex-shrink: 0 below), so it never scrolls
   away. */
:deep(.dt__filter-list) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
/* Same reasoning as .dt__filter-list above, applied to the date tree — which has no
   virtualization of its own, so this wrapper alone is what turns "overflow past the panel onto
   the page" (no wrapper at all previously) into "fills available space, scrolls the rest". */
:deep(.dt__date-tree-wrap) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
:deep(.dt__filter-search-row) {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 2px 12px 6px;
  flex-shrink: 0;
}
:deep(.dt__dd-search) {
  display: block;
  flex: 1;
  /* Right padding always reserved (whether or not the clear button is currently shown) so it
     never overlaps the text, and so the box doesn't reflow when the button appears/disappears. */
  padding: 5px 20px 5px 8px;
  font-size: 12px;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-family: inherit;
  box-sizing: border-box;
}
/* Wraps a .dt__dd-search input + its optional clear button — same idea as .dt__search-wrap for
   the toolbar's own search box, just reused here since every dropdown search box gained the same
   clear affordance (previously Escape-only). */
:deep(.dt__dd-search-wrap) {
  position: relative;
  display: flex;
  flex: 1;
  min-width: 0;
}
:deep(.dt__dd-search-clear) {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  font-size: 13px;
  line-height: 1;
  color: var(--color-text-tertiary);
  font-family: inherit;
}
:deep(.dt__dd-search-clear:hover) {
  color: var(--color-text-primary);
}
/* Wraps the Columns/Sort/Group dropdowns' own column-search box — sticky within the dropdown
   panel's own scroll (see .dropdown__menu's max-height/overflow-y in Dropdown.vue) so it stays
   pinned at the top instead of scrolling away with the rest of the list. */
.dt__dd-search-row {
  position: sticky;
  top: 0;
  display: flex;
  background: var(--color-background-primary);
  padding: 6px 12px;
  z-index: 1;
}
/* Same idea as .dt__dd-search-row above, but sticky within .dt__filter-cols's own scroll instead
   (the Filter dropdown's left pane doesn't have a dedicated wrapper row the way the others do).
   A distinct class from .dt__dd-search-wrap's own position:relative (applied to the same element,
   see the Filter dropdown's template) so there's no cascade-order conflict between the two. */
.dt__filter-cols-search {
  width: 0;
}
.dt__filter-cols-search-wrap {
  position: sticky;
  top: 0;
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 4px;
  background: var(--color-background-primary);
}
:deep(.dt__filter-select-all) {
  flex-shrink: 0;
  margin: 0;
}
:deep(.dt__value-sort-btn) {
  flex-shrink: 0;
  padding: 4px 7px;
  font-size: 11px;
  background: none;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 6px;
  cursor: pointer;
  color: var(--color-text-secondary);
  font-family: inherit;
  white-space: nowrap;
}
:deep(.dt__filter-match-mode-group) {
  display: inline-flex;
  flex-shrink: 0;
}
:deep(.dt__filter-match-mode--left) {
  border-radius: 6px 0 0 6px;
  border-right: none;
}
:deep(.dt__filter-match-mode--right) {
  border-radius: 0 6px 6px 0;
}
:deep(.dt__filter-match-mode--active) {
  background: var(--color-background-secondary);
  color: var(--color-text-primary);
  font-weight: 500;
}
.dt__sort-idx {
  width: 18px;
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-weight: 500;
}
:deep(.dt__flex1) {
  flex: 1;
}
/* Drag-handle glyph on Columns' Visible rows and Sort/Group's active rows (not Sort's
   non-draggable "Group order" rows) — purely visual, the whole row is still the drag surface. */
.dt__dd-drag-handle {
  flex-shrink: 0;
  color: var(--color-text-tertiary);
  font-size: 13px;
  line-height: 1;
}
/* Category tag on a flattened addable/available row while searching (see isColsSearching/
   isSortSearching/isGroupSearching) — the row's own category context, since it's no longer
   nested inside a CategorySubmenu trigger to convey that. */
.dt__dd-item-category {
  font-size: 11px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
  white-space: nowrap;
}
:deep(.dt__filter-count) {
  font-size: 12px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}
/* A multi-value checklist value excluded by its ≠ button */
:deep(.dt__dd-item--exclude) {
  color: var(--color-text-danger);
}
:deep(.dt__dd-item--exclude .dt__flex1) {
  text-decoration: line-through;
}
:deep(.dt__filter-value) {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  align-self: stretch;
  cursor: pointer;
}
:deep(.dt__filter-exclude) {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  margin: -3px -8px -3px 0;
  padding: 0;
  border: 0.5px solid transparent;
  border-radius: 4px;
  background: none;
  font: inherit;
  font-size: 14px;
  line-height: 1;
  color: var(--color-text-tertiary);
  cursor: pointer;
}
:deep(.dt__filter-exclude:hover) {
  color: var(--color-text-danger);
}
:deep(.dt__filter-exclude[aria-pressed='true']) {
  background: var(--color-background-danger);
  border-color: var(--color-border-danger);
  color: var(--color-text-danger);
}
/* The "Others" checklist row (see docs/filter-dropdown.md's "Filter dropdown") — shaded/italic/bordered so it
   reads as a distinct bulk control, not just another value blending into the results below it. */
:deep(.dt__filter-others) {
  background: var(--color-background-secondary);
  border-top: 0.5px solid var(--color-border-tertiary);
  border-bottom: 0.5px solid var(--color-border-secondary);
  font-style: italic;
  color: var(--color-text-secondary);
}

/* Chips — .dt__chip is just a flex wrapper now; the actual padding/background/border live on
   .dt__chip-body/.dt__chip-remove individually (each keeping only its own outer corner rounded,
   sharing a border between them — mirroring .dt__btn-clear's grouped-button seam) so the pair
   still reads as one pill while both halves are independently clickable/focusable buttons. */
.dt__chip {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
}
.dt__chip-body {
  background: var(--color-background-secondary);
  border: 0.5px solid var(--color-border-secondary);
  border-right: none;
  border-radius: 12px 0 0 12px;
  padding: 2px 4px 2px 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
  font-family: inherit;
  cursor: pointer;
  line-height: 1.4;
  min-height: 24px;
}
.dt__chip-body:hover {
  background: var(--color-background-tertiary);
}
.dt__chip--info .dt__chip-body,
.dt__chip--info .dt__chip-remove {
  background: var(--color-background-info);
  color: var(--color-text-info);
  border-color: var(--color-border-info);
}
.dt__chip--warning .dt__chip-body,
.dt__chip--warning .dt__chip-remove {
  background: var(--color-background-warning);
  color: var(--color-text-warning);
  border-color: var(--color-border-warning);
}
/* Exclude filters (see cycleFilterValue in the docs) get their own tint, distinct from the plain
   include .dt__chip--info above, so the two read as opposite actions at a glance. */
.dt__chip--danger .dt__chip-body,
.dt__chip--danger .dt__chip-remove {
  background: var(--color-background-danger);
  color: var(--color-text-danger);
  border-color: var(--color-border-danger);
}
.dt__chip-remove {
  cursor: pointer;
  background: var(--color-background-secondary);
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 0 12px 12px 0;
  padding: 2px 8px 2px 2px;
  font-size: 12px;
  color: var(--color-text-secondary);
  font-family: inherit;
  line-height: 1.4;
  /* 24 px touch target (docs/ui-guidelines.md) */
  min-height: 24px;
  min-width: 24px;
}
.dt__chip-remove:hover {
  color: var(--color-text-primary);
}
/* A grouped column's chip merges its sort chip and group chip into one pill (issue #17's
   follow-up) instead of showing two identically-labeled chips. dt__chip--grouped-sort's sort-
   remove × squares off its right edge — it's no longer the pill's last segment — so it butts
   cleanly against dt__chip-group-mark next to it; the trailing group-remove × stays a plain
   .dt__chip-remove (the pill's actual right end). Selected via the adjacent-sibling combinator
   (.dt__chip-body + .dt__chip-remove), not :first-of-type — :first-of-type counts by tag name,
   and .dt__chip-body is itself a <button> and the pill's actual first child, so a :first-of-type
   selector on .dt__chip-remove never matched anything. font-size matches the other segments' 12px
   so the middle segment isn't visibly shorter (line-height is relative to font-size). */
.dt__chip--grouped-sort .dt__chip-body + .dt__chip-remove {
  border-radius: 0;
  border-right: none;
}
.dt__chip-group-mark {
  cursor: pointer;
  background: var(--color-background-secondary);
  border: 0.5px solid var(--color-border-secondary);
  border-right: none;
  border-radius: 0;
  padding: 2px 5px;
  font-size: 12px;
  color: var(--color-text-tertiary);
  font-family: inherit;
  line-height: 1.4;
  min-height: 24px;
  min-width: 24px;
}
.dt__chip-group-mark:hover {
  background: var(--color-background-tertiary);
  color: var(--color-text-primary);
}

/* Pagination */
.dt__pagination {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 2px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
.dt__page-btn {
  padding: 5px 9px;
  background: none;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-primary);
  font-family: inherit;
  line-height: 1;
}
.dt__page-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.dt__page-info {
  font-size: 12px;
  color: var(--color-text-secondary);
  padding: 0 6px;
}
.dt__rows-per-page-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 10px;
}
.dt__rows-per-page-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}
.dt__page-select {
  padding: 4px 6px;
  font-size: 12px;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-family: inherit;
  cursor: pointer;
}

/* Table */
.dt__table-wrap {
  overflow-x: auto;
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 8px;
  margin-top: 12px;
}
.dt__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.dt__th {
  padding: 8px 12px;
  text-align: left;
  font-weight: 500;
  font-size: 12px;
  background: var(--color-background-tertiary);
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border-secondary);
  white-space: nowrap;
  user-select: none;
  cursor: pointer;
}
.dt__th-inner {
  display: flex;
  align-items: center;
  gap: 4px;
}
/* An unsorted column's ↕ shows only on hover or keyboard focus */
.dt__th-sort-icon {
  opacity: 0;
}
.dt__th-sort-icon--sorted,
.dt__th:hover .dt__th-sort-icon,
.dt__th-sort:focus-visible .dt__th-sort-icon {
  opacity: 1;
}
.dt__th-sort {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  cursor: inherit;
}
.dt__td {
  padding: 8px 12px;
  border-bottom: 0.5px solid var(--color-border-tertiary);
  color: var(--color-text-primary);
  vertical-align: middle;
}
.dt__tr--stripe {
  background: color-mix(in srgb, var(--color-background-secondary) 45%, transparent);
}
.dt__tr--selected {
  background: var(--color-background-info) !important;
}
.dt__tr--clickable {
  cursor: pointer;
}
.dt__tr--clickable:hover {
  background: var(--color-background-secondary);
}
.dt__check-cell {
  cursor: pointer;
}
.dt__th--cb {
  width: 36px;
}
.dt__th--dragging {
  opacity: 0.4;
}
.dt__th--drag-over {
  box-shadow: inset 2px 0 0 var(--color-text-primary);
}

/* Group rows */
.dt__group-row {
  background: var(--color-background-secondary);
  border-left: 3px solid var(--color-border-secondary);
  font-weight: 600;
  font-size: 12px;
  color: var(--color-text-primary);
  cursor: pointer;
}
.dt__empty {
  padding: 24px 12px;
  color: var(--color-text-secondary);
}
.dt__group-td {
  padding: 6px 12px;
  border-bottom: 1px solid var(--color-border-secondary);
}
.dt__group-sep {
  margin: 0 4px;
  opacity: 0.4;
}
.dt__group-key-label {
  margin-right: 4px;
  opacity: 0.6;
}
.dt__group-count {
  margin-left: 10px;
  font-weight: 400;
  opacity: 0.6;
}
.dt__group-continued {
  margin-left: 8px;
  font-weight: 400;
  opacity: 0.6;
}
.dt__agg-row {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: var(--color-background-secondary);
}
.dt__agg-td {
  padding: 4px 12px;
  border-bottom: 0.5px solid var(--color-border-tertiary);
}
</style>
