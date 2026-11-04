<script setup lang="ts" generic="TRow extends object">
import { computed, ref, toRaw, watch, nextTick, useSlots, onMounted, onBeforeUnmount } from 'vue'
import {
  computeAggregate,
  getColumnAlign,
  getColumnValue,
  cellText,
  rowText,
  groupText,
  isGroupCollapsed,
  isSameVisibleItem,
  isSameRow,
  isNewRowFocusTarget,
  indexOfVisibleItem,
  paginateVisibleItems,
  pageSizeOptions,
  showsPager,
  tableStatus,
  chipRemovalFocusTarget,
  filterDetailFocusTarget,
  planRowNav,
  activeRowKeyDown,
  getSortIndex as getHeaderSortIndex,
  getSortIcon as getHeaderSortIcon,
  summarizeFilterValues,
  filterMatchMode,
  chipSeparator,
  formatFilterValue,
  rangeChipText,
  columnHasActiveFilter,
  filterOpenState,
  applyColumnOrderSnapshot,
  addableLists,
  columnsDropdownLists,
  columnMatchesSearch,
  groupColumnsByCategory,
  type PagedGroup,
  type VisibleItem,
  watchMedia,
  FILTER_NARROW_QUERY,
  exclusionChip,
  exclusionValueKeys,
  exclusionValues,
  injectStyles,
} from '@vates/data-table-core/internal'
import { type SortEntry } from '@vates/data-table-core'
import type { ColumnDef, DataTableViewProps } from './types'
import Dropdown from './components/Dropdown.vue'
import AddableColumnList from './components/AddableColumnList.vue'
import HeaderMenu from './components/HeaderMenu.vue'
import FilterPane from './components/FilterPane.vue'
import ToolbarBtn from './components/ToolbarBtn.vue'
import { vIndeterminate } from './directives/vIndeterminate'
import { useDropdownReorder } from './composables/useDropdownReorder'

// Vue casts an absent boolean prop with no explicit default to `false`, not `undefined` — an
// explicit `true` default is required here so an omitted `showSearch` still shows the search box
// (same gotcha `<DataTable>`'s own `defaultGroupsCollapsed` default works around).
const props = withDefaults(defineProps<DataTableViewProps<TRow>>(), {
  rowKey: 'id',
  showSearch: true,
  showColumns: true,
})

// The shared stylesheet, without tokens: Vue apps define the --color-* tokens themselves
injectStyles()

const emit = defineEmits<{
  selectionChange: [rows: TRow[]]
}>()

const slots = useSlots()

const isRowClickable = computed(() => !!props.onRowClick)

// Bare local names for `table`'s namespaced fields (docs/table-state.md), also exposed to the template
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

// Read once on purpose: the starting size, kept among the choices (U27)
const initialPageSize = pageSize.value
const pageSizes = computed(() => pageSizeOptions(pageSize.value, initialPageSize))

function setItemRef(key: TRow | string, el: Element | null): void {
  if (el) rowRefs.set(key, el as HTMLTableRowElement)
  else rowRefs.delete(key)
}

function focusItem(target: VisibleItem<TRow>): void {
  setFocusTarget(target)
  const refKey = target.kind === 'row' ? target.row : target.key
  rowRefs.get(refKey)?.focus()
}

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
    if (isNewRowFocusTarget(target, lastScrolledFocusTarget, props.table.getRowId.value)) {
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
    } else lastScrolledFocusTarget = target
  },
  { flush: 'post' },
)

function handleKeyDown(event: KeyboardEvent, target: VisibleItem<TRow>): void {
  const plan = planRowNav(event, target, {
    visibleItems: visibleItems.value,
    navigableItems: navigableItems.value,
    page: page.value,
    numPages: numPages.value,
    pageSize: pageSize.value,
    selectable: props.selectable,
    rowClickable: isRowClickable.value,
  })
  if (!plan) return
  event.preventDefault()
  if (plan.kind === 'focus') {
    if (plan.extend) toggleRowSelection(plan.extend, true)
    if (plan.page) {
      pendingFocusTarget = plan.item
      setPage(plan.page)
    } else focusItem(plan.item)
  } else if (plan.kind === 'toggleRow') toggleRowSelection(plan.row, event.shiftKey)
  else if (plan.kind === 'toggleGroupSelection') {
    const group = groupedData.value.find((g) => g.key === plan.key)
    if (group) toggleSelectAll(group.rows)
  } else if (plan.kind === 'toggleCollapse') toggleGroupCollapse(plan.key)
  else props.onRowClick?.(plan.row, event)
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
    if (!(document.activeElement as HTMLElement | null)?.matches?.('.dt-dd-search')) return false
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
// Columns dropdown lists: see columnsDropdownLists (core).
const colsLists = computed(() =>
  columnsDropdownLists(orderedColumns.value, visibleCols.value, ddSearchTerm('cols')),
)
const isColsSearching = computed(() => colsLists.value[0])
const searchedVisibleOrderedColumns = computed(() => colsLists.value[1])
const searchedFlatAvailableCols = computed(() => colsLists.value[2])
const categorizedAvailableCols = computed(() => colsLists.value[3])
const colsReorderEligible = computed(() => colsLists.value[4])
// One open toolbar dropdown per table, as in React and Solid: opening one closes the others (U33)
type DdId = 'cols' | 'sort' | 'filter' | 'group'
const openDD = ref<DdId | null>(null)
function setDDOpen(id: DdId, open: boolean): void {
  if (open) openDD.value = id
  else if (openDD.value === id) openDD.value = null
}
// Snapshot of the Filter dropdown's left-pane column order, taken only at the moment the
// dropdown opens — active-filter columns first, then the rest (see `orderFilterColumnsByActive`'s
// own doc comment, core, for why this is a snapshot rather than a live sort: reordering while a
// filter is toggled with the panel still open would move a row out from under the pointer
// mid-interaction).
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
  () => openDD.value === 'filter',
  (open, prevOpen) => {
    if (open && !prevOpen) {
      filterShowValues.value = false
      const state = filterOpenState(
        filterableCols.value,
        filters.value,
        excludeFilters.value,
        rangeFilters.value,
        filterActiveCol.value,
      )
      filterColOrderKeys.value = state.orderKeys
      collapsedCategories.value = state.collapsed
      filterActiveCol.value = state.shownKey
      setDdSearchTerm('filter', '')
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
const exclusionKeys = computed(() =>
  exclusionValueKeys(props.data, props.columns, excludeFilters.value),
)
const exclusionAllValues = computed(() =>
  exclusionValues(props.data, props.columns, exclusionKeys.value, L.value.emptyValue),
)
// Exclusion chips name the kept values when fewer are kept than hidden
const exclusionChips = computed(() =>
  Object.entries(excludeFilters.value)
    .filter(([, vals]) => vals.size > 0)
    .map(([key, vals]) => {
      const col = props.columns.find((c) => c.key === key)
      return {
        key,
        label: col?.label,
        ...exclusionChip(vals, exclusionAllValues.value[key]),
      }
    }),
)

// Raw on both sides: a row held in a consumer's `ref` is a reactive proxy, never `===` the rendered one
const currentRaw = computed(() => props.currentRow && toRaw(props.currentRow))
const isCurrent = (row: TRow) => isSameRow(toRaw(row), currentRaw.value, props.table.getRowId.value)

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
    filterDetailFocusTarget(root?.querySelector('.dt-filter-detail')) ??
    root?.querySelector<HTMLElement>('.dt-filter-back')
  )?.focus()
}
async function showFilterColumns(): Promise<void> {
  filterShowValues.value = false
  await nextTick()
  rootRef.value?.querySelector<HTMLElement>('.dt-filter-col-item--active')?.focus()
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
  openDD.value = 'filter'
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
// The divider separates the shape controls from the find ones: only drawn with both sides
const hasShapeControls = computed(
  () =>
    (props.showColumns && props.columns.length >= 2) ||
    groupableCols.value.length > 0 ||
    sortableCols.value.length > 0,
)
const hasFindControls = computed(
  () => props.showSearch || filterableCols.value.length > 0 || hasActiveState.value,
)

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
// "add" section (everything else) — reordering only ever makes sense among active entries; see
// addableLists (core).
const sortLists = computed(() =>
  addableLists(sortableCols.value, (key) => getSortIndex(key) !== null, ddSearchTerm('sort')),
)
const groupLists = computed(() =>
  addableLists(groupableCols.value, (key) => groupBy.value.includes(key), ddSearchTerm('group')),
)
const addableSortCols = computed(() => sortLists.value[0])
const isSortSearching = computed(() => sortLists.value[1])
const searchedFlatAddableSortCols = computed(() => sortLists.value[2])
const categorizedAddableSortCols = computed(() => sortLists.value[3])
const addableGroupCols = computed(() => groupLists.value[0])
const isGroupSearching = computed(() => groupLists.value[1])
const searchedFlatAddableGroupCols = computed(() => groupLists.value[2])
const categorizedAddableGroupCols = computed(() => groupLists.value[3])
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
// it is the most useful available action.
function onOpenGroupEntry(key: string): Promise<void> {
  return activateAndFocus(() => (openDD.value = 'group'), groupRowRefs, key)
}

// Drag-and-drop reordering for the Sort dropdown's active entries — kept as its own independent
// state (rather than reusing dragColKey/dragOverColKey above), mirroring how each dropdown gets
// its own drag state instead of a shared one.
const {
  dragOverKey: dragOverSortKey,
  dragOverAfter: dragOverSortAfter,
  onRowDragStart: onSortDragStart,
  onRowDragEnd: onSortDragEnd,
  onDragOver: onSortRowsDragOver,
  onDrop: onSortRowsDrop,
} = useDropdownReorder('data-sort-key', moveSort)
// Keyboard reorder/remove/toggle (activeRowKeyDown, core). Vue's keyed reconciliation drops focus
// when a reorder moves the row's DOM node, hence the `activateAndFocus` refocus.
// Alt+↑/↓ swaps within the non-group subset, not the raw sorts array, where a group entry can sit
// between two non-group ones.
function onSortRowKeyDown(event: KeyboardEvent, key: string, i: number): void {
  activeRowKeyDown(
    event,
    (delta) => {
      const neighbor = nonGroupSortEntries.value[i + delta]
      if (!neighbor) return false
      activateAndFocus(() => moveSort(key, neighbor.key, delta > 0), sortRowRefs, key)
    },
    () => onRemoveSortClick(key),
    () => toggleSortDir(key),
  )
}

// Same as above, for the Group dropdown's active entries — a group entry has nothing to toggle
// on click (no direction), so only Alt+↑/↓ reorder applies.
const {
  dragOverKey: dragOverGroupKey,
  dragOverAfter: dragOverGroupAfter,
  onRowDragStart: onGroupDragStart,
  onRowDragEnd: onGroupDragEnd,
  onDragOver: onGroupRowsDragOver,
  onDrop: onGroupRowsDrop,
} = useDropdownReorder('data-group-key', moveGroup)
function onGroupRowKeyDown(event: KeyboardEvent, key: string): void {
  activeRowKeyDown(
    event,
    (delta) => {
      activateAndFocus(() => moveGroupBy(key, delta), groupRowRefs, key)
    },
    () => onRemoveGroupClick(key),
  )
}

// Drag-and-drop reordering for the Columns dropdown's Visible rows — replaces the old ▲▼ buttons.
const {
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
  activeRowKeyDown(
    event,
    (delta) => {
      activateAndFocus(
        () => moveVisibleColumnBy(key, delta, colsReorderEligible.value),
        colRowRefs,
        key,
      )
    },
    () => hideColumn(col),
  )
}

const searchInputRef = ref<HTMLInputElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)
// Focus target after a clear button unmounts itself: the search box, else the first toolbar button.
function focusSearch(): void {
  ;(searchInputRef.value ?? rootRef.value?.querySelector('button'))?.focus()
}
// Before a chip's × removes it, so focus doesn't drop to the page (U30)
function focusChipNeighbor(e: MouseEvent): void {
  chipRemovalFocusTarget(e.currentTarget as HTMLElement)?.focus()
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
// `onEscapeClearable` prop and `data-dd-row` markers) — this file only supplies each dropdown's own
// escape-clear callback (colsEscapeClearable/sortEscapeClearable/groupEscapeClearable above,
// filterEscapeClearable below) and, for the Filter dropdown only, the extra pane-crossing nav
// that Dropdown's own generic base nav doesn't cover (see onFilterDropdownKeydown below).

// The Filter dropdown's own Escape callback for its left-pane column search (FilterPane handles
// Escape in its own value search).
function filterEscapeClearable(): boolean {
  const active = document.activeElement as HTMLElement | null
  // Scoped to focus actually being in the left-pane column search box — same reasoning as
  // makeDdEscapeClearable above: without it, Escape
  // pressed while focused elsewhere in the panel would still silently clear this term.
  if (active?.matches?.('.dt-filter-cols-search') && ddSearchTerm('filter') !== '') {
    setDdSearchTerm('filter', '')
    return true
  }
  return false
}

/**
 * Filter dropdown only: Left/Right crosses between the left column pane and the right detail
 * pane, and the right pane's own rows (value checklist / date tree) get the same Up/Down/Home/End
 * nav as every other dropdown's row list. This is layered on top of Dropdown.vue's own generic
 * Escape/base-nav handling (wired via its `on-escape-clearable` prop on the Filter
 * `<Dropdown>` below), not a replacement for it — the generic nav only reaches `data-dd-row`
 * rows (the left pane only), so it never conflicts with the right-pane handling here.
 */
async function onFilterDropdownKeydown(event: KeyboardEvent): Promise<void> {
  if (event.altKey) return
  {
    const targetEl = event.target as HTMLElement
    const filterColBtn = targetEl.closest<HTMLElement>('.dt-filter-col-item')
    const filterDetail = targetEl.closest<HTMLElement>('.dt-filter-detail')

    // Delete/Backspace on a focused left-pane column row clears that column's filter — the
    // keyboard equivalent of clicking its × clear button. Guarded to an actually-active column so
    // pressing it on an inert row is a true no-op (no page-reset churn from clearColumnFilter's
    // unconditional setPageState(1)).
    if (filterColBtn && (event.key === 'Delete' || event.key === 'Backspace')) {
      const key = filterColBtn.dataset.filterColKey
      const col = key && filterableCols.value.find((c) => c.key === key)
      if (col && hasActiveColFilter(col)) {
        event.preventDefault()
        clearColumnFilter(col.key)
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
      filterDetailFocusTarget(menu.querySelector('.dt-filter-detail'))?.focus()
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
        menu.querySelector<HTMLElement>('.dt-filter-col-item--active')?.focus()
        return
      }
    }
  }
}
</script>

<template>
  <div ref="rootRef" class="dt">
    <!-- ── Toolbar ── -->
    <div v-if="hasShapeControls || hasFindControls || hasSlot('toolbar-end')" class="dt-toolbar">
      <div class="dt-toolbar-actions">
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
          :open="openDD === 'cols'"
          @update:open="setDDOpen('cols', $event)"
          @dragover="onColRowsDragOver"
          @drop="onColRowsDrop"
          :on-escape-clearable="colsEscapeClearable"
        >
          <template #trigger>
            <ToolbarBtn>{{ L.columns }}</ToolbarBtn>
          </template>
          <!-- Always mounted: a search matching nothing must not unmount the box and drop focus -->
          <div class="dt-dd-search-row">
            <span class="dt-dd-search-wrap">
              <input
                type="text"
                class="dt-dd-search"
                data-dd-search
                :placeholder="L.filterSearchPlaceholder"
                :value="ddSearchTerm('cols')"
                @input="setDdSearchTerm('cols', ($event.target as HTMLInputElement).value)"
              />
              <button
                v-if="ddSearchTerm('cols')"
                type="button"
                class="dt-dd-search-clear"
                :title="L.clearSearch"
                :aria-label="L.clearSearch"
                @click="setDdSearchTerm('cols', '')"
              >
                ×
              </button>
            </span>
          </div>
          <div v-if="searchedVisibleOrderedColumns.length > 0" class="dt-dd-section">
            {{ L.columnsSection }}
          </div>
          <!--
            @dragover/@drop are handled at the Dropdown panel level (see above), not per-row —
            that's what lets a drop past the last row still resolve to a valid target.
          -->
          <div
            v-for="col in searchedVisibleOrderedColumns"
            :key="col.key"
            :ref="(el) => setColRowRef(col.key, el as Element | null)"
            :data-col-row-key="col.key"
            class="dt-dd-item dt-dd-item--col dt-dd-item--colrow"
            data-dd-row
            :class="{
              'dt-dd-item--drag-over': dragOverColRowKey === col.key && !dragOverColRowAfter,
              'dt-dd-item--drag-over-after': dragOverColRowKey === col.key && dragOverColRowAfter,
            }"
            draggable="true"
            tabindex="0"
            @dragstart="onColRowDragStart(col.key)"
            @dragend="onColRowDragEnd"
            @keydown="onColRowKeyDown($event, col.key, col)"
          >
            <span class="dt-dd-drag-handle" aria-hidden="true">⠿</span>
            <span class="dt-flex1">{{ col.label }}</span>
            <button
              type="button"
              class="dt-item-remove"
              :title="L.hideColumn"
              :aria-label="L.hideColumn"
              draggable="false"
              @click.stop="hideColumn(col)"
            >
              ×
            </button>
          </div>
          <!-- Stands in for a column list that a search narrowed to nothing (U26) -->
          <div
            v-if="
              searchedVisibleOrderedColumns.length === 0 && searchedFlatAvailableCols.length === 0
            "
            class="dt-dd-no-match"
            data-dd-no-match
          >
            {{ L.noMatchingColumns }}
          </div>
          <template v-if="searchedFlatAvailableCols.length > 0">
            <div class="dt-dd-section">{{ L.availableColumnsSection }}</div>
            <AddableColumnList
              v-model:open-category="openColsCategory"
              :searching="isColsSearching"
              :flat="searchedFlatAvailableCols"
              :categorized="categorizedAvailableCols"
              :set-row-ref="setAddableColRef"
              :set-category-ref="setCategorySubmenuRef"
              @activate="showColumn"
            />
          </template>
        </Dropdown>

        <!-- Group before Sort — data is grouped first, then ordered (groups themselves, then
             rows within them), matching the Sort dropdown's own "Group order" section coming
             before "Active sorts" and the active bar's group-chips-before-sort-chips order.
             Both still "shape" the view (vs. Search/Filter narrowing it below) — see the
             divider below. -->
        <Dropdown
          v-if="groupableCols.length > 0"
          :open="openDD === 'group'"
          @update:open="setDDOpen('group', $event)"
          @dragover="onGroupRowsDragOver"
          @drop="onGroupRowsDrop"
          :on-escape-clearable="groupEscapeClearable"
        >
          <template #trigger>
            <ToolbarBtn :active="groupBy.length > 0">
              {{ L.group }}
            </ToolbarBtn>
          </template>
          <template #extra-trigger>
            <button
              v-if="groupBy.length > 0"
              type="button"
              class="dt-btn-clear dt-btn-clear--groups"
              :title="L.clearGroups"
              :aria-label="L.clearGroups"
              @click="clearGroups"
            >
              ×
            </button>
          </template>
          <template v-if="groupBy.length > 0">
            <div class="dt-dd-section">{{ L.activeGroupsSection }}</div>
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
              class="dt-dd-item dt-dd-item--col dt-dd-item--grouprow"
              data-dd-row
              :class="{
                'dt-dd-item--drag-over': dragOverGroupKey === key && !dragOverGroupAfter,
                'dt-dd-item--drag-over-after': dragOverGroupKey === key && dragOverGroupAfter,
              }"
              draggable="true"
              tabindex="0"
              @keydown="onGroupRowKeyDown($event, key)"
              @dragstart="onGroupDragStart(key)"
              @dragend="onGroupDragEnd"
            >
              <span class="dt-dd-drag-handle" aria-hidden="true">⠿</span>
              <span class="dt-sort-idx">{{ i + 1 }}</span>
              <span class="dt-flex1">{{ findCol(key)?.label ?? key }}</span>
              <button
                type="button"
                class="dt-item-remove"
                :title="L.removeGroup(findCol(key)?.label ?? key)"
                :aria-label="L.removeGroup(findCol(key)?.label ?? key)"
                draggable="false"
                @click="onRemoveGroupClick(key)"
              >
                ×
              </button>
            </div>
          </template>
          <template v-if="addableGroupCols.length > 0">
            <!-- Same search + alphabetize treatment as Sort's add list above, for the same reason. -->
            <div class="dt-dd-search-row">
              <span class="dt-dd-search-wrap">
                <input
                  type="text"
                  class="dt-dd-search"
                  data-dd-search
                  :placeholder="L.filterSearchPlaceholder"
                  :value="ddSearchTerm('group')"
                  @input="setDdSearchTerm('group', ($event.target as HTMLInputElement).value)"
                />
                <button
                  v-if="ddSearchTerm('group')"
                  type="button"
                  class="dt-dd-search-clear"
                  :title="L.clearSearch"
                  :aria-label="L.clearSearch"
                  @click="setDdSearchTerm('group', '')"
                >
                  ×
                </button>
              </span>
            </div>
            <div class="dt-dd-section">{{ L.groupSection }}</div>
            <div
              v-if="isGroupSearching && searchedFlatAddableGroupCols.length === 0"
              class="dt-dd-no-match"
              data-dd-no-match
            >
              {{ L.noMatchingColumns }}
            </div>
            <AddableColumnList
              v-model:open-category="openGroupCategory"
              :searching="isGroupSearching"
              :flat="searchedFlatAddableGroupCols"
              :categorized="categorizedAddableGroupCols"
              :set-row-ref="setAddableGroupRef"
              @activate="onAddGroup"
            />
          </template>
        </Dropdown>

        <!-- Sort -->
        <Dropdown
          v-if="sortableCols.length > 0"
          :open="openDD === 'sort'"
          @update:open="setDDOpen('sort', $event)"
          @dragover="onSortRowsDragOver"
          @drop="onSortRowsDrop"
          :on-escape-clearable="sortEscapeClearable"
        >
          <template #trigger>
            <ToolbarBtn :active="sorts.length > 0">
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
              class="dt-btn-clear dt-btn-clear--sorts"
              :title="L.clearSorts"
              :aria-label="L.clearSorts"
              @click="clearSorts"
            >
              ×
            </button>
          </template>
          <template v-if="groupSortEntries.length > 0">
            <div class="dt-dd-section">{{ L.groupOrderSection }}</div>
            <div class="dt-dd-hint">{{ L.groupOrderHint }}</div>
            <!--
              Not draggable, no Alt+↑/↓ reorder — nesting order always follows groupBy's own
              order (see the Group dropdown), so reordering here would be a no-op; direction is
              still toggleable/removable in place, same as any other sort entry.
            -->
            <div
              v-for="(entry, i) in groupSortEntries"
              :key="entry.key"
              class="dt-dd-item dt-dd-item--col dt-dd-item--sortrow dt-dd-item--locked"
              data-dd-row
              tabindex="0"
              @click="toggleSortDir(entry.key)"
              @keydown="
                activeRowKeyDown(
                  $event,
                  undefined,
                  () => onRemoveSortClick(entry.key),
                  () => toggleSortDir(entry.key),
                )
              "
            >
              <span class="dt-sort-idx">{{ i + 1 }}</span>
              <span class="dt-flex1">{{ findCol(entry.key)?.label ?? entry.key }}</span>
              <span class="dt-sort-icon dt-sort-icon--active">{{ getSortIcon(entry.key) }}</span>
              <button
                type="button"
                class="dt-item-remove"
                :title="L.removeSort(findCol(entry.key)?.label ?? entry.key)"
                :aria-label="L.removeSort(findCol(entry.key)?.label ?? entry.key)"
                draggable="false"
                @click.stop="onRemoveSortClick(entry.key)"
              >
                ×
              </button>
            </div>
          </template>
          <template v-if="nonGroupSortEntries.length > 0">
            <div class="dt-dd-section">{{ L.activeSortsSection }}</div>
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
              class="dt-dd-item dt-dd-item--col dt-dd-item--sortrow"
              data-dd-row
              :class="{
                'dt-dd-item--drag-over': dragOverSortKey === entry.key && !dragOverSortAfter,
                'dt-dd-item--drag-over-after': dragOverSortKey === entry.key && dragOverSortAfter,
              }"
              draggable="true"
              tabindex="0"
              @click="toggleSortDir(entry.key)"
              @keydown="onSortRowKeyDown($event, entry.key, i)"
              @dragstart="onSortDragStart(entry.key)"
              @dragend="onSortDragEnd"
            >
              <span class="dt-dd-drag-handle" aria-hidden="true">⠿</span>
              <span class="dt-sort-idx">{{ i + 1 }}</span>
              <span class="dt-flex1">{{ findCol(entry.key)?.label ?? entry.key }}</span>
              <span class="dt-sort-icon dt-sort-icon--active">{{ getSortIcon(entry.key) }}</span>
              <button
                type="button"
                class="dt-item-remove"
                :title="L.removeSort(findCol(entry.key)?.label ?? entry.key)"
                :aria-label="L.removeSort(findCol(entry.key)?.label ?? entry.key)"
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
            <div class="dt-dd-search-row">
              <span class="dt-dd-search-wrap">
                <input
                  type="text"
                  class="dt-dd-search"
                  data-dd-search
                  :placeholder="L.filterSearchPlaceholder"
                  :value="ddSearchTerm('sort')"
                  @input="setDdSearchTerm('sort', ($event.target as HTMLInputElement).value)"
                />
                <button
                  v-if="ddSearchTerm('sort')"
                  type="button"
                  class="dt-dd-search-clear"
                  :title="L.clearSearch"
                  :aria-label="L.clearSearch"
                  @click="setDdSearchTerm('sort', '')"
                >
                  ×
                </button>
              </span>
            </div>
            <div class="dt-dd-section">{{ L.sortSection }}</div>
            <div
              v-if="isSortSearching && searchedFlatAddableSortCols.length === 0"
              class="dt-dd-no-match"
              data-dd-no-match
            >
              {{ L.noMatchingColumns }}
            </div>
            <!--
              A real <button> (not a div) so it's a native Tab stop and Enter/Space "click" it
              for free — no manual tabindex/keydown wiring needed, unlike the active rows above
              (which need custom keyboard handling anyway for Alt+↑/↓ reorder).
            -->
            <AddableColumnList
              v-model:open-category="openSortCategory"
              :searching="isSortSearching"
              :flat="searchedFlatAddableSortCols"
              :categorized="categorizedAddableSortCols"
              :set-row-ref="setAddableSortRef"
              @activate="onAddSort"
            />
          </template>
        </Dropdown>

        <div v-if="endFirst()" class="dt-toolbar-end">
          <slot name="toolbar-end" />
        </div>
        <!-- Divider between the "shape" controls above (Columns/Sort/Group) and the "find"
             controls below (Search/Filter). -->
        <span v-else-if="hasShapeControls && hasFindControls" class="dt-toolbar-divider" />

        <span v-if="showSearch" class="dt-search-wrap">
          <input
            ref="searchInputRef"
            type="text"
            class="dt-search-input"
            :placeholder="L.search"
            :value="searchQuery"
            @input="setSearchQuery(($event.target as HTMLInputElement).value)"
          />
          <button
            v-if="searchQuery"
            type="button"
            class="dt-search-clear"
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
          :open="openDD === 'filter'"
          @update:open="setDDOpen('filter', $event)"
          @keydown="onFilterDropdownKeydown"
          :on-escape-clearable="filterEscapeClearable"
        >
          <template #trigger>
            <ToolbarBtn :active="activeFilterCount > 0">
              {{ L.filter }}
            </ToolbarBtn>
          </template>
          <template #extra-trigger>
            <button
              v-if="activeFilterCount > 0"
              type="button"
              class="dt-btn-clear dt-btn-clear--filters"
              :title="L.clearFilters"
              :aria-label="L.clearFilters"
              @click="clearFilters"
            >
              ×
            </button>
          </template>
          <div class="dt-filter-panel" :class="{ 'dt-filter-panel--narrow': narrowFilter }">
            <div v-if="!narrowFilter || !filterShowValues" class="dt-filter-cols" data-filter-cols>
              <!--
                Search box (sticky within this scrollable pane, `.dt-filter-cols-search-wrap`) narrows the
                column list itself — separate from FilterPane's value search, which narrows the
                *values* shown in the right-hand detail pane. No inherent order to preserve here
                (unlike the Columns dropdown, this list isn't reorderable), so it's alphabetized
                by label rather than raw column-definition order.
              -->
              <span class="dt-dd-search-wrap dt-filter-cols-search-wrap">
                <input
                  type="text"
                  class="dt-dd-search dt-filter-cols-search"
                  data-dd-search
                  :placeholder="L.filterSearchPlaceholder"
                  :value="ddSearchTerm('filter')"
                  @input="setDdSearchTerm('filter', ($event.target as HTMLInputElement).value)"
                />
                <button
                  v-if="ddSearchTerm('filter')"
                  type="button"
                  class="dt-dd-search-clear"
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
                .dt-filter-col-row/--active below. A <button> can't contain another interactive
                element, so the clear button is a sibling, not nested.
              -->
              <div
                v-if="searchedFilterableCols.length === 0"
                class="dt-dd-no-match"
                data-dd-no-match
              >
                {{ L.noMatchingColumns }}
              </div>
              <template v-for="col in categorizedFilterCols.uncategorized" :key="col.key">
                <div
                  class="dt-filter-col-row"
                  :class="{ 'dt-filter-col-row--active': col.key === filterActiveKey }"
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
                    class="dt-filter-col-item"
                    data-dd-row
                    :class="{ 'dt-filter-col-item--active': col.key === filterActiveKey }"
                    :aria-current="col.key === filterActiveKey || undefined"
                    @focus="onFilterColFocus(col.key)"
                    @click="selectFilterCol(col.key)"
                  >
                    <span>{{ col.label }}</span>
                  </button>
                  <!--
                    Replaces the plain active-filter dot: a one-click way to drop this column's
                    filter without opening it first, matching the toolbar's own per-dropdown ×
                    buttons (see "Toolbar clear buttons" in docs/toolbar.md).
                  -->
                  <button
                    v-if="hasActiveColFilter(col)"
                    type="button"
                    class="dt-filter-col-clear"
                    :title="L.clearColumnFilter"
                    :aria-label="L.clearColumnFilter"
                    @click.stop="clearColumnFilter(col.key)"
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
              <div
                v-for="category in categorizedFilterCols.categories"
                :key="category.name"
                class="dt-filter-category"
              >
                <!--
                  A collapsed category force-expands whenever it currently has a search match —
                  always safe, since a category only ever appears here at all when it has one (see
                  isFilterSearching's own comment above). collapsedCategories itself stays
                  untouched, so clearing the search reverts to whatever it was before.
                -->
                <button
                  type="button"
                  class="dt-filter-category-header"
                  data-dd-row
                  :data-filter-category-header="category.name"
                  :aria-expanded="isFilterSearching || !collapsedCategories.has(category.name)"
                  @click="toggleCategoryCollapsed(category.name)"
                >
                  <span class="dt-filter-category-toggle">
                    {{ !isFilterSearching && collapsedCategories.has(category.name) ? '▶' : '▼' }}
                  </span>
                  <span class="dt-flex1">{{ category.name }}</span>
                </button>
                <div
                  v-if="isFilterSearching || !collapsedCategories.has(category.name)"
                  class="dt-filter-category-cols"
                >
                  <div
                    v-for="col in category.columns"
                    :key="col.key"
                    class="dt-filter-col-row"
                    :class="{ 'dt-filter-col-row--active': col.key === filterActiveKey }"
                  >
                    <button
                      :ref="(el) => setFilterColRef(col.key, el as Element | null)"
                      type="button"
                      :data-filter-col-key="col.key"
                      class="dt-filter-col-item"
                      data-dd-row
                      :class="{ 'dt-filter-col-item--active': col.key === filterActiveKey }"
                      :aria-current="col.key === filterActiveKey || undefined"
                      @focus="onFilterColFocus(col.key)"
                      @click="selectFilterCol(col.key)"
                    >
                      <span>{{ col.label }}</span>
                    </button>
                    <button
                      v-if="hasActiveColFilter(col)"
                      type="button"
                      class="dt-filter-col-clear"
                      :title="L.clearColumnFilter"
                      :aria-label="L.clearColumnFilter"
                      @click.stop="clearColumnFilter(col.key)"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <button
              v-if="narrowFilter && filterShowValues"
              type="button"
              class="dt-dd-item dt-dd-item--click dt-filter-back"
              data-filter-back
              @click="showFilterColumns"
            >
              ‹ {{ L.columns }} · {{ filterDetailCol?.label }}
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
             .dt-clear-all) — nothing else in the row needs to reflow when it mounts/unmounts,
             unlike the old layout where it sat between search and the stats text. -->
        <button
          v-if="hasActiveState"
          type="button"
          class="dt-btn dt-clear-all"
          @click="clearAllAndFocus"
        >
          {{ L.clearAll }}
        </button>
        <div v-if="hasSlot('toolbar-end') && !endFirst()" class="dt-toolbar-end">
          <slot name="toolbar-end" />
        </div>
      </div>
    </div>

    <!-- ── Active state bar ── always rendered so the stats keep one home; chip bodies are buttons
         (docs/toolbar.md's "Active-bar chip click actions") -->
    <div class="dt-active-bar">
      <!-- Group chips render before sort chips — matches the Sort dropdown's own "Group order"
           section coming before "Active sorts", since grouping is the structural, primary
           concern and tie-break sorting is secondary. -->
      <span v-for="key in groupBy" :key="key" class="dt-chip">
        <!-- ⊞ tells it apart from the same column's sort chip (U6), groupedBy for screen readers (U28) -->
        <button
          type="button"
          class="dt-chip-body"
          :aria-label="L.groupedBy(findCol(key)?.label ?? key)"
          @click="onOpenGroupEntry(key)"
        >
          <span aria-hidden="true">⊞</span> {{ findCol(key)?.label ?? key }}
        </button>
        <button
          type="button"
          class="dt-chip-x"
          :title="L.removeGroup(findCol(key)?.label ?? key)"
          :aria-label="L.removeGroup(findCol(key)?.label ?? key)"
          @click="(focusChipNeighbor($event), removeGroup(key))"
        >
          ×
        </button>
      </span>
      <span v-for="entry in sorts" :key="entry.key" class="dt-chip">
        <button type="button" class="dt-chip-body" @click="toggleSortDir(entry.key)">
          {{ getSortIcon(entry.key) }} {{ findCol(entry.key)?.label ?? entry.key }}
        </button>
        <button
          type="button"
          class="dt-chip-x"
          :title="L.removeSort(findCol(entry.key)?.label ?? entry.key)"
          :aria-label="L.removeSort(findCol(entry.key)?.label ?? entry.key)"
          @click="(focusChipNeighbor($event), removeSort(entry.key))"
        >
          ×
        </button>
      </span>
      <template v-if="activeFilterCount > 0">
        <template v-for="[key, vals] in Object.entries(filters)" :key="key">
          <span v-if="vals.size > 0" class="dt-chip dt-chip--filter">
            <button type="button" class="dt-chip-body" @click="onOpenFilterCol(key)">
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
              class="dt-chip-x"
              :title="L.clearColumnFilter"
              :aria-label="L.clearColumnFilter"
              @click="(focusChipNeighbor($event), clearColumnFilter(key, 'include'))"
            >
              ×
            </button>
          </span>
        </template>
        <!-- Exclude filters (see cycleFilterValue in the docs) get their own chip, distinguished
             by a "≠" prefix instead of a translated word — same reasoning the sort/value-sort
             icons already use symbols (↑/↓, ABC/#) rather than growing every locale file.
             dt-chip--exclude tints it apart from a plain include chip so the two read as opposite
             actions at a glance, not just different text. -->
        <template v-for="chip in exclusionChips" :key="`exclude-${chip.key}`">
          <span class="dt-chip dt-chip--filter" :class="{ 'dt-chip--exclude': !chip.kept }">
            <button type="button" class="dt-chip-body" @click="onOpenFilterCol(chip.key)">
              {{ chip.label }}: {{ chip.kept ? '' : '≠' }}
              {{
                summarizeFilterValues(chip.values, L.moreValues, (v) =>
                  formatFilterValue(findCol(chip.key), v, L.emptyValue),
                )
              }}
            </button>
            <button
              type="button"
              class="dt-chip-x"
              :title="L.clearColumnFilter"
              :aria-label="L.clearColumnFilter"
              @click="(focusChipNeighbor($event), clearColumnFilter(chip.key, 'exclude'))"
            >
              ×
            </button>
          </span>
        </template>
        <!-- A range filter (number or date) didn't get a chip at all before — it's a distinct
             active filter from the checklist above, so it needs its own (a date column can have
             both active at once). -->
        <template v-for="[key, rf] in Object.entries(rangeFilters)" :key="`range-${key}`">
          <span v-if="rf.min !== '' || rf.max !== ''" class="dt-chip dt-chip--filter">
            <button type="button" class="dt-chip-body" @click="onOpenFilterCol(key)">
              {{ columns.find((c) => c.key === key)?.label }}:
              {{ rangeChipText(findCol(key), rf, L.emptyValue) }}
            </button>
            <button
              type="button"
              class="dt-chip-x"
              :title="L.clearColumnFilter"
              :aria-label="L.clearColumnFilter"
              @click="(focusChipNeighbor($event), clearColumnFilter(key, 'range'))"
            >
              ×
            </button>
          </span>
        </template>
      </template>
      <span class="dt-stats">
        {{ L.rowCount(processedData.length, data.length) }}
        <template v-if="groupBy.length > 0">{{ L.groupCount(pageGroupCount) }}</template>
      </span>
    </div>

    <!-- ── Table ── -->
    <div class="dt-table-wrap">
      <table class="dt-table">
        <thead>
          <tr>
            <th
              v-if="selectable"
              class="dt-th dt-check-cell"
              style="width: 36px"
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
            <th v-if="groupBy.length > 0" class="dt-th dt-th--no-sort" style="width: 28px" />
            <th
              v-for="col in activeColumns"
              :key="col.key"
              class="dt-th"
              :data-col-key="col.key"
              :aria-sort="headerAriaSort(col.key)"
              :class="{
                'dt-pinned': col.pinned,
                'dt-dd-item--drag-over': dragOverColKey === col.key,
              }"
              :style="{ width: col.width ? `${col.width}px` : undefined }"
              :draggable="menuColKey === col.key ? 'false' : 'true'"
              @dragstart="onColDragStart(col.key)"
              @dragover.prevent="onColDragOver(col.key)"
              @drop.prevent="onColDrop(col.key)"
              @dragend="onColDragEnd"
              @click="onHeaderSortClick(col, $event)"
            >
              <span class="dt-th-inner">
                <!-- Takes the free space before the label, since the menu's auto margin defeats justify-content -->
                <span v-if="getColumnAlign(col)" class="dt-th-spacer" />
                <!-- A button so keyboard users can sort; its click bubbles to the <th>'s handler -->
                <component
                  :is="col.sortable === false ? 'span' : 'button'"
                  :type="col.sortable === false ? undefined : 'button'"
                  class="dt-th-sort"
                >
                  {{ col.label }}
                  <span
                    v-if="col.sortable !== false"
                    class="dt-sort-icon"
                    :class="{ 'dt-sort-icon--active': isHeaderSorted(col.key) }"
                    aria-hidden="true"
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
              class="dt-group-row"
              @click="toggleGroupCollapse(group.key!)"
              @keydown="handleKeyDown($event, { kind: 'group', key: group.key! })"
              @focusin="setFocusTarget({ kind: 'group', key: group.key! })"
            >
              <td
                v-if="selectable"
                class="dt-group-td dt-check-cell"
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
              <td class="dt-group-td" style="width: 28px">
                {{ groupCollapsed(group.key!) ? '▶' : '▼' }}
              </td>
              <td :colspan="activeColumns.length" class="dt-group-td">
                <template v-for="(g, i) in groupBy" :key="g">
                  <span v-if="i > 0" class="dt-group-sep">›</span>
                  <span class="dt-group-colname">{{ findCol(g)?.label }}:</span>
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
                <span v-if="group.continued" class="dt-group-continued">{{
                  L.groupContinued
                }}</span>
                <span class="dt-group-count">{{ L.rowsInGroup(group.rows.length) }}</span>
              </td>
            </tr>

            <!-- Aggregate row -->
            <tr v-if="group.key !== null && hasAggregates" class="dt-agg-row">
              <td v-if="selectable" class="dt-agg-td" style="width: 36px" />
              <td class="dt-agg-td" style="width: 28px" />
              <td
                v-for="col in activeColumns"
                :key="col.key"
                class="dt-agg-td"
                :class="{ 'dt-pinned': col.pinned }"
                :data-col-key="col.key"
                :style="{ textAlign: getColumnAlign(col) }"
              >
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
                class="dt-tr"
                :class="[
                  {
                    'dt-tr--odd': ri % 2 !== 0 && !(selectable && selection.has(row)),
                    'dt-tr--selected': selectable && selection.has(row),
                    'dt-tr--clickable': isRowClickable,
                    'dt-tr--current': isCurrent(row),
                  },
                  rowClass?.(row),
                ]"
                @click="onRowClick?.(row, $event)"
                @keydown="handleKeyDown($event, { kind: 'row', row })"
                @focusin="setFocusTarget({ kind: 'row', row })"
              >
                <td
                  v-if="selectable"
                  class="dt-td dt-check-cell"
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
                <td v-if="group.key !== null" class="dt-td" style="width: 28px" />
                <td
                  v-for="col in activeColumns"
                  :key="col.key"
                  class="dt-td"
                  :class="{ 'dt-pinned': col.pinned }"
                  :data-col-key="col.key"
                  :style="{
                    width: col.width ? `${col.width}px` : undefined,
                    textAlign: getColumnAlign(col),
                  }"
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
              class="dt-td dt-empty"
              :colspan="activeColumns.length + (selectable ? 1 : 0) + (groupBy.length > 0 ? 1 : 0)"
            >
              <template v-if="data.length === 0">{{ L.noRows }}</template>
              <template v-else>
                {{ L.noMatchingRows }}
                <button type="button" class="dt-btn" @click="clearSearchAndFilters">
                  {{ L.clearSearchAndFilters }}
                </button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── Pagination ── -->
    <div v-if="pageSize > 0 && showsPager(visibleItems.length, pageSizes)" class="dt-pagination">
      <template v-if="numPages > 1">
        <button
          class="dt-page-btn"
          :disabled="page === 1"
          :aria-label="L.firstPage"
          @click="setPage(1)"
        >
          «
        </button>
        <button
          class="dt-page-btn"
          :disabled="page === 1"
          :aria-label="L.previousPage"
          @click="setPage(page - 1)"
        >
          ‹
        </button>
        <span class="dt-page-info">{{ L.pageOf(page, numPages) }}</span>
        <button
          class="dt-page-btn"
          :disabled="page >= numPages"
          :aria-label="L.nextPage"
          @click="setPage(page + 1)"
        >
          ›
        </button>
        <button
          class="dt-page-btn"
          :disabled="page >= numPages"
          :aria-label="L.lastPage"
          @click="setPage(numPages)"
        >
          »
        </button>
      </template>
      <label class="dt-rows-per-page-group">
        <span class="dt-rows-per-page">{{ L.rowsPerPage }}:</span>
        <select
          class="dt-page-select"
          :value="pageSize"
          @change="setPageSize(Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="n in pageSizes" :key="n" :value="n">{{ n }}</option>
        </select>
      </label>
    </div>
    <div role="status" class="dt-status">
      {{ tableStatus(L, processedData.length, data.length, page, numPages) }}
    </div>
  </div>
</template>
