<script setup lang="ts" generic="TRow extends object">
import { computed, ref, shallowRef, watch, useSlots, getCurrentInstance } from 'vue'
import {
  computeAggregate,
  computeStringValueCounts,
  getColumnValue,
  filterValuesBySearch,
  filterValuesByCount,
  filterValuesByRange,
  computeValueBounds,
  sortFilterValues,
  cycleValueSort,
  toggleSortDir as toggleValueSortDir,
  getValueSortIcon,
  getDateSortIcon,
  computeDateTree,
  getDateTreeNodeState,
  findDateTreeNode,
  selectDateRange,
  selectRange,
  isGroupCollapsed,
  isSameVisibleItem,
  indexOfVisibleItem,
  paginateVisibleItems,
  mergePageSizeOptions,
  computeVirtualRange,
  type PagedGroup,
  type DateTreeNode,
  type ValueSort,
  type VisibleItem,
} from '@vates/data-table-core'
import type { ColumnDef, DataTableViewProps } from './types'
import Dropdown from './components/Dropdown.vue'
import ToolbarBtn from './components/ToolbarBtn.vue'
import DateTreeItem from './components/DateTreeItem.vue'
import RangeSlider from './components/RangeSlider.vue'

const props = withDefaults(defineProps<DataTableViewProps<TRow>>(), { rowKey: 'id' })

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
const isRowClickable = computed(
  () => props.rowClickable ?? !!getCurrentInstance()?.vnode.props?.onRowClick,
)

function handleRowClick(row: TRow, event: MouseEvent | KeyboardEvent) {
  emit('rowClick', row, event)
}

const {
  visibleCols,
  sorts,
  filters,
  rangeFilters,
  groupBy,
  collapsedGroups,
  defaultGroupsCollapsed,
  selection,
  selectedRows,
  processedData,
  groupedData,
  visibleItems,
  activeColumns,
  orderedColumns,
  stringValueMap,
  activeFilterCount,
  page,
  pageSize,
  numPages,
  searchQuery,
  L,
  toggleColVisibility,
  moveColumn,
  moveColumnBy,
  toggleSort,
  removeSort,
  toggleSortDir,
  moveSortBy,
  moveSort,
  toggleFilter,
  toggleFilterAll,
  setFilterValues,
  setRangeFilter,
  clearColumnFilter,
  toggleGroup,
  removeGroup,
  moveGroupBy,
  moveGroup,
  toggleGroupCollapse,
  clearSorts,
  clearFilters,
  clearGroups,
  clearAll,
  setPage,
  setPageSize,
  setSearchQuery,
  getSortIcon,
  getSortIndex,
  toggleRowSelection,
  toggleSelectAll,
} = props.table

watch(selectedRows, (rows) => {
  emit('selectionChange', rows)
})

// Roving tabindex: exactly one item (a data row or a group header row) is a Tab stop at a time
// (the rest are tabindex="-1"), arrow keys move it — mirrors the anchor/range idea the
// checklist/date-tree checkboxes already use for shift-click. Data rows only join the tab
// sequence when they're actually interactive; group headers always do, since collapsing a group
// is already a click away regardless of selectable/onRowClick.
// shallowRef (not ref) — VisibleItem<TRow> embeds a TRow field, and Vue's deep-unwrap conflicts
// with the generic constraint here the same way it does for `selection` (see "Row selection").
const focusTarget = shallowRef<VisibleItem<TRow> | null>(null)
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

// A plain <select> bound to a value absent from its own options (e.g. a custom defaultPageSize
// not in the four defaults) silently shows the wrong option as selected — merge the current
// pageSize in so the dropdown always reflects it.
const pageSizeOptions = computed(() => mergePageSizeOptions([10, 20, 50, 100], pageSize.value))

function setItemRef(key: TRow | string, el: Element | null): void {
  if (el) rowRefs.set(key, el as HTMLTableRowElement)
  else rowRefs.delete(key)
}

function setFocusTarget(target: VisibleItem<TRow>): void {
  focusTarget.value = target
}

function focusItem(target: VisibleItem<TRow>): void {
  setFocusTarget(target)
  const refKey = target.kind === 'row' ? target.row : target.key
  rowRefs.get(refKey)?.focus()
}

// Arrow-key/Ctrl+Home/Ctrl+End navigation can target an item that isn't on the current page —
// `visibleItems` (from `table`) already covers the *full* filtered/grouped dataset, so jumping to
// an arbitrary page is just slicing it again (with the same continuation-header handling as the
// current page), no re-grouping needed.
function visibleItemsForPage(p: number): VisibleItem<TRow>[] {
  return paginateVisibleItems(visibleItems.value, p, pageSize.value).filter(
    (item) => item.kind === 'group' || isRowNavEnabled.value,
  )
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
      } else if (delta === 1 && page.value < numPages.value) {
        const next = visibleItemsForPage(page.value + 1)[0]
        if (next) {
          event.preventDefault()
          if (event.shiftKey && props.selectable && next.kind === 'row')
            toggleRowSelection(next.row, true)
          pendingFocusTarget = next
          setPage(page.value + 1)
        }
      } else if (delta === -1 && page.value > 1) {
        const prevItems = visibleItemsForPage(page.value - 1)
        const next = prevItems[prevItems.length - 1]
        if (next) {
          event.preventDefault()
          if (event.shiftKey && props.selectable && next.kind === 'row')
            toggleRowSelection(next.row, true)
          pendingFocusTarget = next
          setPage(page.value - 1)
        }
      }
      break
    }
    case 'Home':
    case 'End': {
      if (event.ctrlKey || event.metaKey) {
        const targetPage = event.key === 'Home' ? 1 : numPages.value
        const targetItems = targetPage === page.value ? items : visibleItemsForPage(targetPage)
        const next = event.key === 'Home' ? targetItems[0] : targetItems[targetItems.length - 1]
        if (next) {
          event.preventDefault()
          if (event.shiftKey && props.selectable && next.kind === 'row')
            toggleRowSelection(next.row, true)
          if (targetPage === page.value) {
            focusItem(next)
          } else {
            pendingFocusTarget = next
            setPage(targetPage)
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
      event.preventDefault()
      if (target.kind === 'group') {
        toggleGroupCollapse(target.key)
      } else {
        handleRowClick(target.row, event)
      }
      break
  }
}

const allSelected = computed(
  () => processedData.value.length > 0 && selectedRows.value.length === processedData.value.length,
)
const someSelected = computed(() => selectedRows.value.length > 0 && !allSelected.value)

const vIndeterminate = {
  mounted: (el: HTMLInputElement, b: { value: boolean }) => {
    el.indeterminate = b.value
  },
  updated: (el: HTMLInputElement, b: { value: boolean }) => {
    el.indeterminate = b.value
  },
}

function isGroupAllSelected(rows: TRow[]) {
  return rows.length > 0 && rows.every((r) => selection.value.has(r))
}
function isGroupSomeSelected(rows: TRow[]) {
  return rows.some((r) => selection.value.has(r)) && !isGroupAllSelected(rows)
}

const DEFAULT_VALUE_SORT: ValueSort = { by: 'alpha', dir: 'asc' }
// Fixed row height for the filter dropdown's virtualized checklist (see computeVirtualRange) —
// must match the actual rendered height of a checklist row exactly, which is why each row gets
// an explicit inline height below instead of relying on dt__dd-item's padding + line-height.
const FILTER_LIST_ITEM_HEIGHT = 32
// The checklist itself no longer has a fixed height (see .dt__filter-list, which flex-fills
// .dt__filter-detail instead) — this is now only the *assumed* viewport height fed to
// computeVirtualRange's windowing math. Safe to leave un-measured: .dt__filter-panel's own
// max-height:380px bounds how much taller the checklist can actually grow past this default,
// well within computeVirtualRange's own overscan margin (see .dt__filter-list's CSS comment for
// the full math).
const FILTER_LIST_VIEWPORT_HEIGHT = 260

const filterableCols = computed(() => props.columns.filter((c) => c.filterable !== false))
const groupableCols = computed(() => props.columns.filter((c) => c.groupable === true))
const filterActiveCol = ref<string | null>(null)
const filterSearchTerms = ref<Record<string, string>>({})
const filterSelectionAnchor = ref<Record<string, string>>({})
const filterValueSort = ref<Record<string, ValueSort>>({})

function onFilterValueClick(col: ColumnDef<TRow>, value: string, event: MouseEvent) {
  const anchor = filterSelectionAnchor.value[col.key]
  if (event.shiftKey && anchor != null) {
    const shouldSelect = !(filters.value[col.key]?.has(value) ?? false)
    setFilterValues(col.key, selectRange(filteredValuesFor(col), anchor, value), shouldSelect)
  } else {
    toggleFilter(col.key, value)
  }
  filterSelectionAnchor.value = { ...filterSelectionAnchor.value, [col.key]: value }
}
const filterActiveKey = computed(
  () =>
    (filterActiveCol.value && filterableCols.value.some((c) => c.key === filterActiveCol.value)
      ? filterActiveCol.value
      : filterableCols.value[0]?.key) ?? null,
)
const filterDetailCol = computed(
  () => filterableCols.value.find((c) => c.key === filterActiveKey.value) ?? null,
)
// The filter dropdown is master-detail — only filterDetailCol's checklist is ever rendered —
// so facet counts only need computing for that one column, not every filterable column (see
// computeStringValueCounts's targetKeys param).
const stringValueCounts = computed(() =>
  computeStringValueCounts(
    props.data,
    filters.value,
    rangeFilters.value,
    props.columns,
    L.value.emptyValue,
    filterDetailCol.value ? [filterDetailCol.value.key] : [],
  ),
)
// A date column can have both an active checklist selection (tree) *and* an active range filter
// above it at once — either one alone should light the dot, not just whichever one a plain
// type-based branch happened to check.
function hasActiveColFilter(col: ColumnDef<TRow>): boolean {
  const rf = rangeFilters.value[col.key]
  return (
    (filters.value[col.key]?.size ?? 0) > 0 ||
    (rf !== undefined && (rf.min !== '' || rf.max !== ''))
  )
}
function valueSortFor(key: string): ValueSort {
  return filterValueSort.value[key] ?? DEFAULT_VALUE_SORT
}
function cycleFilterValueSort(col: ColumnDef<TRow>): void {
  const current = valueSortFor(col.key)
  const next =
    col.type === 'date'
      ? { ...current, dir: toggleValueSortDir(current.dir) }
      : cycleValueSort(current)
  filterValueSort.value = { ...filterValueSort.value, [col.key]: next }
}
function filteredValuesFor(col: ColumnDef<TRow>): string[] {
  return sortFilterValues(
    filterValuesByCount(
      // Narrowed by the date range filter (if any), same as by search — a value outside the
      // active range never becomes a tree leaf, rather than merely being ANDed onto the final
      // row set once ticked. A no-op for string columns (they never populate rangeFilters).
      filterValuesByRange(
        filterValuesBySearch(
          stringValueMap.value[col.key] ?? [],
          filterSearchTerms.value[col.key] ?? '',
        ),
        rangeFilters.value[col.key],
        col.parseDate,
      ),
      stringValueCounts.value[col.key] ?? new Map(),
      filters.value[col.key] ?? new Set(),
    ),
    stringValueCounts.value[col.key] ?? new Map(),
    valueSortFor(col.key),
  )
}
function countFor(col: ColumnDef<TRow>, value: string): number {
  return stringValueCounts.value[col.key]?.get(value) ?? 0
}
// Slider bounds are the column's actual min/max across the full, unfiltered props.data (not
// filtered/processed data) — see computeValueBounds — so they don't shift under a mid-drag user
// just because some other filter narrowed the row set. null when the column has no parseable
// values at all, or all its values are identical (nothing to bound a slider to) — callers hide
// the slider in that case, the two plain min/max inputs above it keep working regardless.
function rangeSliderFor(
  col: ColumnDef<TRow>,
): { min: number; max: number; low: number; high: number; step: number | 'any' } | null {
  const bounds = computeValueBounds(props.data, col)
  if (!bounds || bounds.min >= bounds.max) return null
  const rf = rangeFilters.value[col.key]
  const isDate = col.type === 'date'
  const toNum = (v: string) => (isDate ? new Date(v).getTime() : Number(v))
  const low = rf?.min ? toNum(rf.min) : bounds.min
  const high = rf?.max ? toNum(rf.max) : bounds.max
  return {
    min: bounds.min,
    max: bounds.max,
    low: Math.min(low, high),
    high: Math.max(low, high),
    step: isDate ? 24 * 60 * 60 * 1000 : 'any',
  }
}
// Single memoized source for filterDetailCol's own slider config, mirroring filterDetailValues
// below — filterDetailCol changes identity whenever the active column switches, so this
// recomputes exactly when needed and no more.
const filterDetailSlider = computed(() =>
  filterDetailCol.value ? rangeSliderFor(filterDetailCol.value) : null,
)
function onRangeSliderChange(col: ColumnDef<TRow>, low: number, high: number): void {
  const isDate = col.type === 'date'
  const fmt = (n: number) => (isDate ? new Date(n).toISOString().slice(0, 10) : String(n))
  setRangeFilter(col.key, 'min', fmt(low))
  setRangeFilter(col.key, 'max', fmt(high))
}
// Single memoized source for the checklist's rendered/sliced values — filteredValuesFor(col) is
// a plain function re-run on every call, so computing it once here (rather than once for the
// v-if length check and again for the v-for) avoids doubling the search/count/sort pipeline's
// cost on top of what virtualization itself needs (slicing the array).
const filterDetailValues = computed(() =>
  filterDetailCol.value ? filteredValuesFor(filterDetailCol.value) : [],
)
const filterListScrollTop = ref(0)
const filterListRef = ref<HTMLElement | null>(null)
let filterListRafPending = false
function onFilterListScroll(): void {
  if (!filterListRafPending) {
    filterListRafPending = true
    requestAnimationFrame(() => {
      filterListRafPending = false
      // Read the live scrollTop here (not a value captured back in the triggering scroll
      // event) — several scroll events can fire before this callback runs, and only the
      // latest position matters.
      if (filterListRef.value) filterListScrollTop.value = filterListRef.value.scrollTop
    })
  }
}
// Reset scroll whenever the checklist's values change identity — switching columns or
// narrowing by search both shift what row 0 even means.
watch([filterActiveKey, () => filterSearchTerms.value[filterActiveKey.value ?? '']], () => {
  filterListScrollTop.value = 0
  if (filterListRef.value) filterListRef.value.scrollTop = 0
})
const filterListVirtualRange = computed(() =>
  computeVirtualRange(
    filterListScrollTop.value,
    FILTER_LIST_VIEWPORT_HEIGHT,
    FILTER_LIST_ITEM_HEIGHT,
    filterDetailValues.value.length,
  ),
)
function selectFilterCol(key: string): void {
  filterActiveCol.value = key
}
function setFilterSearchTerm(key: string, term: string): void {
  filterSearchTerms.value = { ...filterSearchTerms.value, [key]: term }
}
function filterSelectedCount(col: ColumnDef<TRow>): number {
  return filteredValuesFor(col).filter((v) => filters.value[col.key]?.has(v)).length
}
function isFilterAllSelected(col: ColumnDef<TRow>): boolean {
  const values = filteredValuesFor(col)
  return values.length > 0 && filterSelectedCount(col) === values.length
}
function isFilterSomeSelected(col: ColumnDef<TRow>): boolean {
  const count = filterSelectedCount(col)
  return count > 0 && count < filteredValuesFor(col).length
}
function onToggleFilterAll(col: ColumnDef<TRow>): void {
  toggleFilterAll(col.key, filteredValuesFor(col))
}
const expandedDateNodes = ref<Record<string, Set<string>>>({})
const filterDetailTree = computed(() =>
  filterDetailCol.value && filterDetailCol.value.type === 'date'
    ? computeDateTree(
        filteredValuesFor(filterDetailCol.value),
        L.value.emptyValue,
        valueSortFor(filterDetailCol.value.key).dir,
        filterDetailCol.value.parseDate,
      )
    : [],
)
function isDateSearchActive(col: ColumnDef<TRow>): boolean {
  return (filterSearchTerms.value[col.key] ?? '') !== ''
}
function toggleDateNodeExpand(colKey: string, path: string): void {
  const next = new Set(expandedDateNodes.value[colKey] ?? [])
  if (next.has(path)) next.delete(path)
  else next.add(path)
  expandedDateNodes.value = { ...expandedDateNodes.value, [colKey]: next }
}
function onDateNodeClick(col: ColumnDef<TRow>, node: DateTreeNode, event: MouseEvent): void {
  const key = col.key
  const anchor = filterSelectionAnchor.value[key]
  const anchorNode = anchor != null ? findDateTreeNode(filterDetailTree.value, anchor) : null
  const state = getDateTreeNodeState(node, filters.value[key] ?? new Set())
  if (event.shiftKey && anchorNode) {
    const values = selectDateRange(filteredValuesFor(col), anchorNode, node, col.parseDate)
    setFilterValues(key, values, state !== 'checked')
  } else {
    toggleFilterAll(key, node.values)
  }
  filterSelectionAnchor.value = { ...filterSelectionAnchor.value, [key]: node.path }
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

function cellText(row: TRow, col: ColumnDef<TRow>): string {
  return formatValue(getColumnValue(col, row), row, col)
}

const FILTER_CHIP_MAX = 3
function summarizeFilterValues(vals: Set<string>): string {
  const arr = [...vals]
  if (arr.length <= FILTER_CHIP_MAX) return arr.join(', ')
  return `${arr.slice(0, FILTER_CHIP_MAX).join(', ')}, ${L.value.moreValues(arr.length - FILTER_CHIP_MAX)}`
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

// Sort/Group dropdowns split into an "active" section (priority order, reorderable) and an
// "add" section (everything else) — reordering only ever makes sense among active entries.
const addableSortCols = computed(() => props.columns.filter((c) => getSortIndex(c.key) === null))
const addableGroupCols = computed(() =>
  groupableCols.value.filter((c) => !groupBy.value.includes(c.key)),
)

/**
 * Resolves the drop target for the Sort/Group/Columns dropdown drag-and-drop lists below: the
 * specific row under the cursor, and whether the dragged item should land before or after it.
 * Cursor position within the hovered row's own bounds decides before/after (top half vs bottom
 * half) so a row can be a valid "insert after" target too — including the *last* row, which
 * "insert before" alone could never reach. When the cursor isn't directly over any row (e.g.
 * past the last row, in the dead space below it, or over the dropdown's "add" section) it snaps
 * to the nearest edge row instead, so there's no dead zone that silently rejects the drop. `e` is
 * expected to be handled at the Dropdown panel level (`e.currentTarget` is the panel, not a
 * row), so it can see every row via `attr`, a `data-*` attribute unique to that list's rows.
 */
function resolveDropdownDragRow(
  e: DragEvent,
  attr: string,
): { key: string; after: boolean } | null {
  const root = e.currentTarget as HTMLElement
  const selector = `[${attr}]`
  const rows = Array.from(root.querySelectorAll<HTMLElement>(selector))
  if (rows.length === 0) return null
  const readKey = (el: HTMLElement) => el.getAttribute(attr)!
  const hit = (e.target as HTMLElement).closest<HTMLElement>(selector)
  if (hit) {
    const rect = hit.getBoundingClientRect()
    return { key: readKey(hit), after: e.clientY > rect.top + rect.height / 2 }
  }
  const first = rows[0]
  const last = rows[rows.length - 1]
  if (e.clientY <= first.getBoundingClientRect().top) return { key: readKey(first), after: false }
  if (e.clientY >= last.getBoundingClientRect().bottom) return { key: readKey(last), after: true }
  return null
}

// Drag-and-drop reordering for the Sort dropdown's active entries — kept as its own independent
// state (rather than reusing dragColKey/dragOverColKey above), mirroring how each dropdown gets
// its own drag state instead of a shared one.
const dragSortKey = ref<string | null>(null)
const dragOverSortKey = ref<string | null>(null)
const dragOverSortAfter = ref(false)
function onSortDragStart(key: string): void {
  dragSortKey.value = key
}
function onSortDragEnd(): void {
  dragSortKey.value = null
  dragOverSortKey.value = null
}
// @dragover/@drop for the whole active-sorts list — bound to the Dropdown panel (via its
// forwarded $attrs) rather than per-row, so a drop past the last row still resolves.
function onSortRowsDragOver(e: DragEvent): void {
  if (!dragSortKey.value) return
  const target = resolveDropdownDragRow(e, 'data-sort-key')
  if (!target || target.key === dragSortKey.value) return
  e.preventDefault()
  dragOverSortKey.value = target.key
  dragOverSortAfter.value = target.after
}
function onSortRowsDrop(e: DragEvent): void {
  if (!dragSortKey.value) return
  const target = resolveDropdownDragRow(e, 'data-sort-key')
  if (!target) return
  e.preventDefault()
  if (target.key !== dragSortKey.value) moveSort(dragSortKey.value, target.key, target.after)
  dragSortKey.value = null
  dragOverSortKey.value = null
}
// Alt+↑/↓ mirrors the drag gesture for keyboard-only reorder; Enter/Space mirrors the row's own
// click (toggle direction) since a plain div gets no free keyboard activation the way a real
// <button> would (unlike the add-list, which renders real buttons and needs no handler here).
function onSortRowKeyDown(event: KeyboardEvent, key: string): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    toggleSortDir(key)
  } else if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault()
    moveSortBy(key, event.key === 'ArrowUp' ? -1 : 1)
  }
}

// Same as above, for the Group dropdown's active entries — a group entry has nothing to toggle
// on click (no direction), so only Alt+↑/↓ reorder applies.
const dragGroupKey = ref<string | null>(null)
const dragOverGroupKey = ref<string | null>(null)
const dragOverGroupAfter = ref(false)
function onGroupDragStart(key: string): void {
  dragGroupKey.value = key
}
function onGroupDragEnd(): void {
  dragGroupKey.value = null
  dragOverGroupKey.value = null
}
function onGroupRowsDragOver(e: DragEvent): void {
  if (!dragGroupKey.value) return
  const target = resolveDropdownDragRow(e, 'data-group-key')
  if (!target || target.key === dragGroupKey.value) return
  e.preventDefault()
  dragOverGroupKey.value = target.key
  dragOverGroupAfter.value = target.after
}
function onGroupRowsDrop(e: DragEvent): void {
  if (!dragGroupKey.value) return
  const target = resolveDropdownDragRow(e, 'data-group-key')
  if (!target) return
  e.preventDefault()
  if (target.key !== dragGroupKey.value) moveGroup(dragGroupKey.value, target.key, target.after)
  dragGroupKey.value = null
  dragOverGroupKey.value = null
}
function onGroupRowKeyDown(event: KeyboardEvent, key: string): void {
  if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault()
    moveGroupBy(key, event.key === 'ArrowUp' ? -1 : 1)
  }
}

// Drag-and-drop reordering for the Columns dropdown's rows — replaces the old ▲▼ buttons. The
// row itself gets no tabindex: the checkbox inside is already a native Tab stop, so a second one
// on the row would just be a redundant, visually-identical stop for the same rectangle.
const dragColRowKey = ref<string | null>(null)
const dragOverColRowKey = ref<string | null>(null)
const dragOverColRowAfter = ref(false)
function onColRowDragStart(key: string): void {
  dragColRowKey.value = key
}
function onColRowDragEnd(): void {
  dragColRowKey.value = null
  dragOverColRowKey.value = null
}
function onColRowsDragOver(e: DragEvent): void {
  if (!dragColRowKey.value) return
  const target = resolveDropdownDragRow(e, 'data-col-row-key')
  if (!target || target.key === dragColRowKey.value) return
  e.preventDefault()
  dragOverColRowKey.value = target.key
  dragOverColRowAfter.value = target.after
}
function onColRowsDrop(e: DragEvent): void {
  if (!dragColRowKey.value) return
  const target = resolveDropdownDragRow(e, 'data-col-row-key')
  if (!target) return
  e.preventDefault()
  if (target.key !== dragColRowKey.value) moveColumn(dragColRowKey.value, target.key, target.after)
  dragColRowKey.value = null
  dragOverColRowKey.value = null
}
function onColRowKeyDown(event: KeyboardEvent, key: string): void {
  if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault()
    moveColumnBy(key, event.key === 'ArrowUp' ? -1 : 1)
  }
}

const searchInputRef = ref<HTMLInputElement | null>(null)
function clearSearchQuery(): void {
  setSearchQuery('')
  searchInputRef.value?.focus()
}
</script>

<template>
  <div class="dt">
    <!-- ── Toolbar ── -->
    <div class="dt__toolbar">
      <div class="dt__toolbar-actions">
        <!-- Columns -->
        <Dropdown @dragover="onColRowsDragOver" @drop="onColRowsDrop">
          <template #trigger="{ open }">
            <ToolbarBtn :active="open">{{ L.columns }}</ToolbarBtn>
          </template>
          <div class="dt__dd-section">{{ L.columnsSection }}</div>
          <!--
            @dragover/@drop are handled at the Dropdown panel level (see above), not per-row —
            that's what lets a drop past the last row still resolve to a valid target.
          -->
          <div
            v-for="col in orderedColumns"
            :key="col.key"
            :data-col-row-key="col.key"
            class="dt__dd-item dt__dd-item--col dt__dd-item--colrow"
            :class="{
              'dt__dd-item--dragging': dragColRowKey === col.key,
              'dt__dd-item--drag-over': dragOverColRowKey === col.key && !dragOverColRowAfter,
              'dt__dd-item--drag-over-after': dragOverColRowKey === col.key && dragOverColRowAfter,
            }"
            draggable="true"
            @dragstart="onColRowDragStart(col.key)"
            @dragend="onColRowDragEnd"
          >
            <label class="dt__dd-item--clickable dt__flex1">
              <input
                type="checkbox"
                :checked="visibleCols.has(col.key)"
                @change="toggleColVisibility(col.key)"
                @keydown="onColRowKeyDown($event, col.key)"
              />
              {{ col.label }}
            </label>
          </div>
        </Dropdown>

        <!-- Sort -->
        <Dropdown @dragover="onSortRowsDragOver" @drop="onSortRowsDrop">
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
          <template v-if="sorts.length > 0">
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
              v-for="(entry, i) in sorts"
              :key="entry.key"
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
              <span class="dt__sort-idx">{{ i + 1 }}</span>
              <span class="dt__flex1">{{ findCol(entry.key)?.label ?? entry.key }}</span>
              <span class="dt__sort-icon dt__sort-icon--active">{{ getSortIcon(entry.key) }}</span>
              <button
                type="button"
                class="dt__item-remove"
                draggable="false"
                @click.stop="removeSort(entry.key)"
              >
                ×
              </button>
            </div>
          </template>
          <template v-if="addableSortCols.length > 0">
            <div class="dt__dd-section">{{ L.sortSection }}</div>
            <!--
              A real <button> (not a div) so it's a native Tab stop and Enter/Space "click" it
              for free — no manual tabindex/keydown wiring needed, unlike the active rows above
              (which need custom keyboard handling anyway for Alt+↑/↓ reorder).
            -->
            <button
              v-for="col in addableSortCols"
              :key="col.key"
              type="button"
              class="dt__dd-item dt__dd-item--clickable"
              @click="toggleSort(col.key)"
            >
              <span class="dt__flex1">{{ col.label }}</span>
            </button>
          </template>
        </Dropdown>

        <!-- Group — placed right after Sort (both "shape" the view — order/columns) rather than
             after Filter, so the toolbar reads as two clusters: Columns/Sort/Group shape the
             view, Search/Filter narrow it — see the divider below. -->
        <Dropdown
          v-if="groupableCols.length > 0"
          @dragover="onGroupRowsDragOver"
          @drop="onGroupRowsDrop"
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
              <span class="dt__sort-idx">{{ i + 1 }}</span>
              <span class="dt__flex1">{{ findCol(key)?.label ?? key }}</span>
              <button
                type="button"
                class="dt__item-remove"
                draggable="false"
                @click="removeGroup(key)"
              >
                ×
              </button>
            </div>
          </template>
          <template v-if="addableGroupCols.length > 0">
            <div class="dt__dd-section">{{ L.groupSection }}</div>
            <button
              v-for="col in addableGroupCols"
              :key="col.key"
              type="button"
              class="dt__dd-item dt__dd-item--clickable"
              @click="toggleGroup(col.key)"
            >
              <span class="dt__flex1">{{ col.label }}</span>
            </button>
          </template>
        </Dropdown>

        <!-- Divider between the "shape" controls above (Columns/Sort/Group) and the "find"
             controls below (Search/Filter). -->
        <span class="dt__toolbar-divider" />

        <span class="dt__search-wrap">
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
        <Dropdown v-if="filterableCols.length > 0">
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
          <div class="dt__filter-panel">
            <div class="dt__filter-cols">
              <!--
                A real <button> (not a div) so it's a native Tab stop and Enter/Space "click" it
                for free — same fix as the Sort/Group add-lists above; this had the identical gap.
              -->
              <button
                v-for="col in filterableCols"
                :key="col.key"
                type="button"
                class="dt__filter-col-item"
                :class="{ 'dt__filter-col-item--active': col.key === filterActiveKey }"
                @click="selectFilterCol(col.key)"
              >
                <span>{{ col.label }}</span>
                <span v-if="hasActiveColFilter(col)" class="dt__filter-col-dot" />
              </button>
            </div>
            <div class="dt__filter-detail">
              <template v-if="filterDetailCol">
                <div v-if="filterDetailCol.type === 'number'" class="dt__range">
                  <div class="dt__range-inputs">
                    <input
                      type="number"
                      :placeholder="L.min"
                      :value="rangeFilters[filterDetailCol.key]?.min ?? ''"
                      @input="
                        setRangeFilter(
                          filterDetailCol.key,
                          'min',
                          ($event.target as HTMLInputElement).value,
                        )
                      "
                      class="dt__range-input"
                    />
                    <span class="dt__range-sep">–</span>
                    <input
                      type="number"
                      :placeholder="L.max"
                      :value="rangeFilters[filterDetailCol.key]?.max ?? ''"
                      @input="
                        setRangeFilter(
                          filterDetailCol.key,
                          'max',
                          ($event.target as HTMLInputElement).value,
                        )
                      "
                      class="dt__range-input"
                    />
                  </div>
                  <RangeSlider
                    v-if="filterDetailSlider"
                    v-bind="filterDetailSlider"
                    @change="(lo, hi) => onRangeSliderChange(filterDetailCol!, lo, hi)"
                  />
                </div>
                <template v-else>
                  <div v-if="filterDetailCol.type === 'date'" class="dt__range">
                    <div class="dt__range-inputs">
                      <input
                        type="date"
                        :aria-label="L.min"
                        :value="rangeFilters[filterDetailCol.key]?.min ?? ''"
                        @input="
                          setRangeFilter(
                            filterDetailCol.key,
                            'min',
                            ($event.target as HTMLInputElement).value,
                          )
                        "
                        class="dt__range-input dt__range-input--date"
                      />
                      <span class="dt__range-sep">–</span>
                      <input
                        type="date"
                        :aria-label="L.max"
                        :value="rangeFilters[filterDetailCol.key]?.max ?? ''"
                        @input="
                          setRangeFilter(
                            filterDetailCol.key,
                            'max',
                            ($event.target as HTMLInputElement).value,
                          )
                        "
                        class="dt__range-input dt__range-input--date"
                      />
                    </div>
                    <RangeSlider
                      v-if="filterDetailSlider"
                      v-bind="filterDetailSlider"
                      @change="(lo, hi) => onRangeSliderChange(filterDetailCol!, lo, hi)"
                    />
                  </div>
                  <div class="dt__filter-search-row">
                    <input
                      v-if="filterDetailValues.length > 0"
                      v-indeterminate="isFilterSomeSelected(filterDetailCol)"
                      type="checkbox"
                      class="dt__filter-select-all"
                      :checked="isFilterAllSelected(filterDetailCol)"
                      :title="L.selectAll"
                      :aria-label="L.selectAll"
                      @change="onToggleFilterAll(filterDetailCol)"
                    />
                    <input
                      type="text"
                      class="dt__dd-search"
                      :placeholder="L.filterSearchPlaceholder"
                      :value="filterSearchTerms[filterDetailCol.key] ?? ''"
                      @input="
                        setFilterSearchTerm(
                          filterDetailCol.key,
                          ($event.target as HTMLInputElement).value,
                        )
                      "
                    />
                    <button
                      type="button"
                      class="dt__value-sort-btn"
                      :title="L.sortValues"
                      :aria-label="L.sortValues"
                      @click="cycleFilterValueSort(filterDetailCol)"
                    >
                      {{
                        filterDetailCol.type === 'date'
                          ? getDateSortIcon(valueSortFor(filterDetailCol.key).dir)
                          : getValueSortIcon(valueSortFor(filterDetailCol.key))
                      }}
                    </button>
                  </div>
                  <div v-if="filterDetailCol.type === 'date'" class="dt__date-tree-wrap">
                    <DateTreeItem
                      :nodes="filterDetailTree"
                      :depth="0"
                      :selected="filters[filterDetailCol.key] ?? new Set()"
                      :counts="stringValueCounts[filterDetailCol.key] ?? new Map()"
                      :expanded="expandedDateNodes[filterDetailCol.key] ?? new Set()"
                      :search-active="isDateSearchActive(filterDetailCol)"
                      @toggle-node="(node, event) => onDateNodeClick(filterDetailCol!, node, event)"
                      @toggle-expand="(path) => toggleDateNodeExpand(filterDetailCol!.key, path)"
                    />
                  </div>
                  <!--
                  Virtualized: only the rows scrolled into view (+ overscan) are ever mounted,
                  regardless of how many thousands of distinct values filterDetailValues holds —
                  see computeVirtualRange/FILTER_LIST_*. Select-all/shift-range above still
                  operate on the full filterDetailValues array, so behavior is unaffected by how
                  much of it is actually rendered.
                -->
                  <template v-else>
                    <div ref="filterListRef" class="dt__filter-list" @scroll="onFilterListScroll">
                      <div
                        :style="{
                          height: filterListVirtualRange.totalHeight + 'px',
                          position: 'relative',
                        }"
                      >
                        <div
                          :style="{
                            position: 'absolute',
                            top: filterListVirtualRange.offsetY + 'px',
                            left: 0,
                            right: 0,
                          }"
                        >
                          <label
                            v-for="v in filterDetailValues.slice(
                              filterListVirtualRange.startIndex,
                              filterListVirtualRange.endIndex,
                            )"
                            :key="v"
                            class="dt__dd-item dt__dd-item--clickable"
                            :style="{
                              height: FILTER_LIST_ITEM_HEIGHT + 'px',
                              boxSizing: 'border-box',
                            }"
                          >
                            <input
                              type="checkbox"
                              :checked="filters[filterDetailCol.key]?.has(v) ?? false"
                              @click="onFilterValueClick(filterDetailCol, v, $event)"
                            />
                            <!--
                            Slot #filter-{key} — custom label in the filter dropdown.
                            Slot scope: { value: string }
                            Falls back to the raw string value.
                            Not applied to `type: 'date'` columns (DateTreeItem.vue below) — a
                            tree branch node's label (a year/month) has no single raw value to
                            pass through, and even a day leaf can bundle more than one raw value.
                          -->
                            <span class="dt__flex1">
                              <slot :name="`filter-${filterDetailCol.key}`" :value="v">{{
                                v
                              }}</slot>
                            </span>
                            <span class="dt__filter-count">{{ countFor(filterDetailCol, v) }}</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </template>
                </template>
              </template>
            </div>
          </div>
        </Dropdown>

        <!-- "Clear all" sits alone at the far right of the actions row (margin-left: auto, see
             .dt__clear-all) — nothing else in the row needs to reflow when it mounts/unmounts,
             unlike the old layout where it sat between search and the stats text. -->
        <button v-if="hasActiveState" class="dt__clear-all" @click="clearAll">
          {{ L.clearAll }}
        </button>
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
    <div class="dt__active-bar">
      <span v-for="entry in sorts" :key="entry.key" class="dt__chip">
        {{ getSortIcon(entry.key) }} {{ findCol(entry.key)?.label ?? entry.key }}
        <span class="dt__chip-remove" @click="removeSort(entry.key)">×</span>
      </span>
      <span v-for="key in groupBy" :key="key" class="dt__chip">
        {{ findCol(key)?.label ?? key }}
        <span class="dt__chip-remove" @click="removeGroup(key)">×</span>
      </span>
      <template v-if="activeFilterCount > 0">
        <template v-for="[key, vals] in Object.entries(filters)" :key="key">
          <span v-if="vals.size > 0" class="dt__chip dt__chip--info">
            {{ columns.find((c) => c.key === key)?.label }}: {{ summarizeFilterValues(vals) }}
            <span class="dt__chip-remove" @click="clearColumnFilter(key)">×</span>
          </span>
        </template>
        <!-- A range filter (number or date) didn't get a chip at all before — it's a distinct
             active filter from the checklist above, so it needs its own (a date column can have
             both active at once). Reuses clearColumnFilter, which now resets rangeFilters too,
             so the × here is a full per-column reset regardless of which kind is actually active. -->
        <template v-for="[key, rf] in Object.entries(rangeFilters)" :key="`range-${key}`">
          <span v-if="rf.min !== '' || rf.max !== ''" class="dt__chip dt__chip--info">
            {{ columns.find((c) => c.key === key)?.label }}: {{ rf.min }}–{{ rf.max }}
            <span class="dt__chip-remove" @click="clearColumnFilter(key)">×</span>
          </span>
        </template>
      </template>
      <span class="dt__stats">
        {{ L.rowCount(processedData.length, data.length) }}
        <template v-if="groupBy.length > 0">{{ L.groupCount(pageGroupCount) }}</template>
      </span>
    </div>

    <!-- ── Pagination ── -->
    <div v-if="pageSize > 0" class="dt__pagination">
      <button class="dt__page-btn" :disabled="page === 1" @click="setPage(1)">«</button>
      <button class="dt__page-btn" :disabled="page === 1" @click="setPage(page - 1)">‹</button>
      <span class="dt__page-info">{{ L.pageOf(page, numPages) }}</span>
      <button class="dt__page-btn" :disabled="page >= numPages" @click="setPage(page + 1)">
        ›
      </button>
      <button class="dt__page-btn" :disabled="page >= numPages" @click="setPage(numPages)">
        »
      </button>
      <span class="dt__rows-per-page-group">
        <span class="dt__rows-per-page-label">{{ L.rowsPerPage }}:</span>
        <select
          class="dt__page-select"
          :value="pageSize"
          @change="setPageSize(Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="n in pageSizeOptions" :key="n" :value="n">{{ n }}</option>
        </select>
      </span>
    </div>

    <!-- ── Table ── -->
    <div class="dt__table-wrap">
      <table class="dt__table">
        <thead>
          <tr>
            <th v-if="selectable" class="dt__th dt__th--cb" @click.stop>
              <input
                v-indeterminate="someSelected"
                type="checkbox"
                :checked="allSelected"
                @change="toggleSelectAll(processedData)"
              />
            </th>
            <th v-if="groupBy.length > 0" class="dt__th" style="width: 28px" />
            <th
              v-for="col in activeColumns"
              :key="col.key"
              class="dt__th"
              :class="{
                'dt__th--dragging': dragColKey === col.key,
                'dt__th--drag-over': dragOverColKey === col.key,
              }"
              :style="{ width: col.width ? `${col.width}px` : undefined }"
              draggable="true"
              @dragstart="onColDragStart(col.key)"
              @dragover.prevent="onColDragOver(col.key)"
              @drop.prevent="onColDrop(col.key)"
              @dragend="onColDragEnd"
              @click="toggleSort(col.key)"
            >
              {{ col.label }}
              <span
                :style="{
                  fontSize: '10px',
                  color: getSortIndex(col.key)
                    ? 'var(--color-text-primary)'
                    : 'var(--color-border-secondary)',
                }"
              >
                {{
                  getSortIndex(col.key) ? `${getSortIndex(col.key)}${getSortIcon(col.key)}` : '↕'
                }}
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
              <td v-if="selectable" class="dt__group-td" style="width: 36px" @click.stop>
                <input
                  v-indeterminate="isGroupSomeSelected(group.rows)"
                  type="checkbox"
                  :checked="isGroupAllSelected(group.rows)"
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
                :key="(asRecord(row)[rowKey] as string | number) ?? ri"
                :ref="(el) => setItemRef(row, el as Element | null)"
                :tabindex="
                  isRowNavEnabled ? (isFocusTarget({ kind: 'row', row }) ? 0 : -1) : undefined
                "
                :aria-selected="selectable ? selection.has(row) : undefined"
                :class="{
                  'dt__tr--stripe': ri % 2 !== 0,
                  'dt__tr--selected': selectable && selection.has(row),
                  'dt__tr--clickable': isRowClickable,
                }"
                @click="handleRowClick(row, $event)"
                @keydown="handleKeyDown($event, { kind: 'row', row })"
                @focusin="setFocusTarget({ kind: 'row', row })"
              >
                <td v-if="selectable" class="dt__td" style="width: 36px" @click.stop>
                  <input
                    type="checkbox"
                    tabindex="-1"
                    :checked="selection.has(row)"
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
                  <template v-else>{{ cellText(row, col) }}</template>
                </td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
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

/* Dropdown internals */
.dt__dd-section {
  padding: 6px 14px 2px;
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.dt__dd-item {
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
.dt__dd-item--clickable {
  cursor: pointer;
}
.dt__dd-item--clickable:hover {
  background: var(--color-background-secondary);
}
.dt__dd-item--col {
  justify-content: space-between;
}
.dt__dd-item--sortrow {
  cursor: pointer;
}
.dt__dd-item--sortrow:hover {
  background: var(--color-background-secondary);
}
.dt__dd-item--grouprow,
.dt__dd-item--colrow {
  cursor: grab;
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
.dt__filter-cols {
  width: 150px;
  flex-shrink: 0;
  overflow-y: auto;
  border-right: 0.5px solid var(--color-border-tertiary);
  padding: 4px 0;
}
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
  width: 100%;
  box-sizing: border-box;
}
.dt__filter-col-item:hover {
  background: var(--color-background-secondary);
}
.dt__filter-col-item--active {
  background: var(--color-background-secondary);
  font-weight: 500;
}
.dt__filter-col-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-info);
  flex-shrink: 0;
}
/* A flex column (not just flex: 1) so the checklist/date-tree child below can flex: 1 to fill
   whatever height .dt__filter-cols (the column list) ends up stretching this to via the row's
   cross-axis stretch, instead of a hardcoded height leaving dead space below it once
   .dt__filter-cols renders taller than that default (see .dt__filter-list/.dt__date-tree-wrap). */
.dt__filter-detail {
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
.dt__filter-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
/* Same reasoning as .dt__filter-list above, applied to the date tree — which has no
   virtualization of its own, so this wrapper alone is what turns "overflow past the panel onto
   the page" (no wrapper at all previously) into "fills available space, scrolls the rest". */
.dt__date-tree-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.dt__filter-search-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 2px 12px 6px;
  flex-shrink: 0;
}
.dt__dd-search {
  display: block;
  flex: 1;
  padding: 5px 8px;
  font-size: 12px;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-family: inherit;
  box-sizing: border-box;
}
.dt__filter-select-all {
  flex-shrink: 0;
  margin: 0;
}
.dt__value-sort-btn {
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
.dt__sort-idx {
  width: 18px;
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-weight: 500;
}
.dt__flex1 {
  flex: 1;
}
.dt__filter-count {
  font-size: 12px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

/* Range filter */
.dt__range {
  padding: 4px 14px 8px;
}
.dt__range-inputs {
  display: flex;
  gap: 6px;
  align-items: center;
}
.dt__range-sep {
  font-size: 12px;
  color: var(--color-text-tertiary);
}
.dt__range-input {
  width: 80px;
  padding: 3px 6px;
  font-size: 12px;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 4px;
  font-family: inherit;
  background: transparent;
  color: inherit;
}
.dt__range-input--date {
  width: 118px;
}

/* Chips */
.dt__chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: var(--color-background-secondary);
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 12px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.dt__chip--info {
  background: var(--color-background-info);
  color: var(--color-text-info);
  border-color: var(--color-border-info);
}
.dt__chip--warning {
  background: var(--color-background-warning);
  color: var(--color-text-warning);
  border-color: var(--color-border-warning);
}
.dt__chip-remove {
  cursor: pointer;
  margin-left: 2px;
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
  padding: 4px 9px;
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
.dt__th--cb {
  width: 36px;
  cursor: default;
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
