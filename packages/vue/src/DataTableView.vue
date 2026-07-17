<script setup lang="ts" generic="TRow extends object">
import { computed, ref, shallowRef, watch, useSlots, getCurrentInstance } from 'vue'
import {
  computeAggregate,
  getColumnValue,
  filterValuesBySearch,
  filterValuesByCount,
  sortFilterValues,
  cycleValueSort,
  toggleSortDir,
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
  type PagedGroup,
  type DateTreeNode,
  type ValueSort,
  type VisibleItem,
} from '@vates/data-table-core'
import type { ColumnDef, DataTableViewProps } from './types'
import Dropdown from './components/Dropdown.vue'
import ToolbarBtn from './components/ToolbarBtn.vue'
import DateTreeItem from './components/DateTreeItem.vue'

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
  stringValueCounts,
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
  toggleFilter,
  toggleFilterAll,
  setFilterValues,
  setRangeFilter,
  clearColumnFilter,
  toggleGroup,
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
function hasActiveColFilter(col: ColumnDef<TRow>): boolean {
  if (col.type === 'number') {
    const rf = rangeFilters.value[col.key]
    return rf !== undefined && (rf.min !== '' || rf.max !== '')
  }
  return (filters.value[col.key]?.size ?? 0) > 0
}
function valueSortFor(key: string): ValueSort {
  return filterValueSort.value[key] ?? DEFAULT_VALUE_SORT
}
function cycleFilterValueSort(col: ColumnDef<TRow>): void {
  const current = valueSortFor(col.key)
  const next =
    col.type === 'date' ? { ...current, dir: toggleSortDir(current.dir) } : cycleValueSort(current)
  filterValueSort.value = { ...filterValueSort.value, [col.key]: next }
}
function filteredValuesFor(col: ColumnDef<TRow>): string[] {
  return sortFilterValues(
    filterValuesByCount(
      filterValuesBySearch(
        stringValueMap.value[col.key] ?? [],
        filterSearchTerms.value[col.key] ?? '',
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

/** The value that defines a group for column `key` at groupBy index `i` — a single array item when the underlying value is an array, the raw value otherwise. */
function groupValue(group: PagedGroup<TRow>, key: string, i: number): unknown {
  const col = findCol(key)
  const raw = col ? getColumnValue(col, group.sampleRow!) : undefined
  return Array.isArray(raw) ? group.keyParts[i] : raw
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
</script>

<template>
  <div class="dt">
    <!-- ── Toolbar ── -->
    <div class="dt__toolbar">
      <!-- Columns -->
      <Dropdown>
        <template #trigger="{ open }">
          <ToolbarBtn :active="open">{{ L.columns }}</ToolbarBtn>
        </template>
        <div class="dt__dd-section">{{ L.columnsSection }}</div>
        <div
          v-for="(col, idx) in orderedColumns"
          :key="col.key"
          class="dt__dd-item dt__dd-item--col"
        >
          <label class="dt__dd-item--clickable dt__flex1">
            <input
              type="checkbox"
              :checked="visibleCols.has(col.key)"
              @change="toggleColVisibility(col.key)"
            />
            {{ col.label }}
          </label>
          <span class="dt__reorder-btns">
            <button
              type="button"
              class="dt__reorder-btn"
              :disabled="idx === 0"
              @click="moveColumnBy(col.key, -1)"
            >
              ▲
            </button>
            <button
              type="button"
              class="dt__reorder-btn"
              :disabled="idx === orderedColumns.length - 1"
              @click="moveColumnBy(col.key, 1)"
            >
              ▼
            </button>
          </span>
        </div>
      </Dropdown>

      <!-- Sort -->
      <Dropdown>
        <template #trigger="{ open }">
          <ToolbarBtn :active="open || sorts.length > 0">
            {{ L.sort }}
            <span v-if="sorts.length > 0" class="dt__chip">{{ sorts.length }}</span>
          </ToolbarBtn>
        </template>
        <div class="dt__dd-section">{{ L.sortSection }}</div>
        <div v-for="col in columns" :key="col.key" class="dt__dd-item" @click="toggleSort(col.key)">
          <span class="dt__sort-idx">{{ getSortIndex(col.key) ?? '' }}</span>
          <span class="dt__flex1">{{ col.label }}</span>
          <span
            :style="{
              color: getSortIndex(col.key)
                ? 'var(--color-text-primary)'
                : 'var(--color-border-secondary)',
            }"
          >
            {{ getSortIcon(col.key) }}
          </span>
        </div>
        <div v-if="sorts.length > 0" class="dt__dd-footer">
          <button @click.stop="clearSorts">{{ L.clearSorts }}</button>
        </div>
      </Dropdown>

      <!-- Filter -->
      <Dropdown v-if="filterableCols.length > 0">
        <template #trigger="{ open }">
          <ToolbarBtn :active="open || activeFilterCount > 0">
            {{ L.filter }}
            <span v-if="activeFilterCount > 0" class="dt__chip">{{ activeFilterCount }}</span>
          </ToolbarBtn>
        </template>
        <div class="dt__filter-panel">
          <div class="dt__filter-cols">
            <div
              v-for="col in filterableCols"
              :key="col.key"
              class="dt__filter-col-item"
              :class="{ 'dt__filter-col-item--active': col.key === filterActiveKey }"
              @click="selectFilterCol(col.key)"
            >
              <span>{{ col.label }}</span>
              <span v-if="hasActiveColFilter(col)" class="dt__filter-col-dot" />
            </div>
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
              </div>
              <template v-else>
                <div class="dt__filter-search-row">
                  <input
                    v-if="filteredValuesFor(filterDetailCol).length > 0"
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
                <DateTreeItem
                  v-if="filterDetailCol.type === 'date'"
                  :nodes="filterDetailTree"
                  :depth="0"
                  :selected="filters[filterDetailCol.key] ?? new Set()"
                  :counts="stringValueCounts[filterDetailCol.key] ?? new Map()"
                  :expanded="expandedDateNodes[filterDetailCol.key] ?? new Set()"
                  :search-active="isDateSearchActive(filterDetailCol)"
                  @toggle-node="(node, event) => onDateNodeClick(filterDetailCol!, node, event)"
                  @toggle-expand="(path) => toggleDateNodeExpand(filterDetailCol!.key, path)"
                />
                <template v-else>
                  <label
                    v-for="v in filteredValuesFor(filterDetailCol)"
                    :key="v"
                    class="dt__dd-item dt__dd-item--clickable"
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
                      Not applied to `type: 'date'` columns (DateTreeItem.vue below) — a tree
                      branch node's label (a year/month) has no single raw value to pass through,
                      and even a day leaf can bundle more than one raw value.
                    -->
                    <span class="dt__flex1">
                      <slot :name="`filter-${filterDetailCol.key}`" :value="v">{{ v }}</slot>
                    </span>
                    <span class="dt__filter-count">{{ countFor(filterDetailCol, v) }}</span>
                  </label>
                </template>
              </template>
            </template>
          </div>
        </div>
        <div v-if="activeFilterCount > 0" class="dt__dd-footer">
          <button @click="clearFilters">{{ L.clearFilters }}</button>
        </div>
      </Dropdown>

      <!-- Group -->
      <Dropdown v-if="groupableCols.length > 0">
        <template #trigger="{ open }">
          <ToolbarBtn :active="open || groupBy.length > 0">
            {{ L.group }}
            <span v-if="groupBy.length > 0" class="dt__chip">{{ groupBy.length }}</span>
          </ToolbarBtn>
        </template>
        <div class="dt__dd-section">{{ L.groupSection }}</div>
        <div
          v-for="col in groupableCols"
          :key="col.key"
          class="dt__dd-item"
          @click="toggleGroup(col.key)"
        >
          <span class="dt__sort-idx">{{
            groupBy.includes(col.key) ? groupBy.indexOf(col.key) + 1 : ''
          }}</span>
          <span class="dt__flex1">{{ col.label }}</span>
          <span v-if="groupBy.includes(col.key)">✓</span>
        </div>
        <div v-if="groupBy.length > 0" class="dt__dd-footer">
          <button @click.stop="clearGroups">{{ L.clearGroups }}</button>
        </div>
      </Dropdown>

      <input
        type="text"
        class="dt__search-input"
        :placeholder="L.search"
        :value="searchQuery"
        @input="setSearchQuery(($event.target as HTMLInputElement).value)"
      />

      <button v-if="hasActiveState" class="dt__clear-all" @click="clearAll">
        {{ L.clearAll }}
      </button>

      <div class="dt__stats">
        {{ L.rowCount(processedData.length, data.length) }}
        <template v-if="groupBy.length > 0">{{ L.groupCount(pageGroupCount) }}</template>
      </div>
    </div>

    <!-- ── Active chips ── -->
    <div v-if="hasActiveState" class="dt__chips">
      <span v-for="(s, i) in sorts" :key="s.key" class="dt__chip">
        {{ i + 1 }}. {{ columns.find((c) => c.key === s.key)?.label }}
        {{ s.dir === 'asc' ? '↑' : '↓' }}
        <span class="dt__chip-remove" @click="toggleSort(s.key)">×</span>
      </span>
      <template v-for="[key, vals] in Object.entries(filters)" :key="key">
        <span v-if="vals.size > 0" class="dt__chip dt__chip--info">
          {{ columns.find((c) => c.key === key)?.label }}: {{ summarizeFilterValues(vals) }}
          <span class="dt__chip-remove" @click="clearColumnFilter(key)">×</span>
        </span>
      </template>
      <span v-for="(key, i) in groupBy" :key="key" class="dt__chip dt__chip--warning">
        {{ L.groupLabel(i + 1) }}: {{ columns.find((c) => c.key === key)?.label }}
        <span class="dt__chip-remove" @click="toggleGroup(key)">×</span>
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
      <span class="dt__rows-per-page-label">{{ L.rowsPerPage }}:</span>
      <select
        class="dt__page-select"
        :value="pageSize"
        @change="setPageSize(Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="n in pageSizeOptions" :key="n" :value="n">{{ n }}</option>
      </select>
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
                    Slot #group-{key} — custom rendering in the group header.
                    Slot scope: { value: unknown, row: TRow }
                    Falls back to format() or string coercion.
                  -->
                  <slot
                    :name="`group-${g}`"
                    :value="groupValue(group, g, i)"
                    :row="group.sampleRow!"
                  >
                    {{
                      findCol(g)
                        ? formatValue(groupValue(group, g, i), group.sampleRow!, findCol(g)!)
                        : String(groupValue(group, g, i) ?? '')
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
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  border-bottom: 0.5px solid var(--color-border-tertiary);
  flex-wrap: wrap;
}
.dt__stats {
  margin-left: auto;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.dt__search-input {
  padding: 4px 8px;
  font-size: 13px;
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-family: inherit;
  min-width: 160px;
}
.dt__clear-all {
  margin-left: 4px;
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
}
.dt__dd-item--clickable {
  cursor: pointer;
}
.dt__dd-item--col {
  justify-content: space-between;
}
.dt__reorder-btns {
  display: flex;
  gap: 2px;
}
.dt__reorder-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  font-size: 10px;
  color: var(--color-text-secondary);
  line-height: 1;
}
.dt__reorder-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
.dt__filter-panel {
  display: flex;
  min-width: 460px;
  max-height: 380px;
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
.dt__filter-detail {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0;
  min-width: 220px;
}
.dt__filter-search-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 2px 12px 6px;
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
.dt__dd-footer {
  padding: 4px 14px 6px;
}
.dt__dd-footer button {
  font-size: 12px;
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 0;
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

/* Chips */
.dt__chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 8px 0 0;
}
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
.dt__rows-per-page-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-left: 10px;
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
