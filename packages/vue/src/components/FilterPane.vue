<script lang="ts">
// Per data array and column key: revisiting a column (panes are recreated per column) otherwise
// reruns a full O(rows) scan, which never short-circuits for a scalar column. Multi-valueness is a
// property of the data shape, stable while `data` is.
</script>

<script setup lang="ts" generic="TRow extends object">
import { computed, nextTick, ref, watch } from 'vue'
import {
  computeStringValueCounts,
  isMultiValueColumnCached,
  formatFilterValue,
  filterValuesBySearch,
  filterValuesByCount,
  filterValuesByRange,
  computeValueBounds,
  computeRangeSliderGeometry,
  formatRangeBound,
  sortFilterValues,
  cycleValueSort,
  toggleSortDir,
  getValueSortIcon,
  getDateSortIcon,
  computeDateTree,
  checklistBulkState,
  clickChecklistValue,
  toggleChecklistExclude,
  clickDateTreeNode,
  toggleChecklistValues,
  deferCheckboxCorrection,
  computeVirtualRange,
  getVirtualScrollTarget,
  type DateTreeNode,
  filterMatchMode,
} from '@vates/data-table-core/internal'
import type { ValueSort } from '@vates/data-table-core'
import type { ColumnDef } from '../types'
import type { TableState } from '../useTableState'
import DateTreeItem from './DateTreeItem.vue'
import RangeInputs from './RangeInputs.vue'
import { vIndeterminate } from '../directives/vIndeterminate'

// One column's filter controls — checklist (string, virtualized), range + slider (number), or a
// Year›Month›Day tree + range + slider (date). Shown by the Filter dropdown's right pane and the
// header menu's Filter flyout; its view state (value search, value order, shift-click anchor,
// expanded date nodes) lives here, so render it keyed by column. Styled by DataTableView.vue's
// `:deep()` rules, like the rest of the Filter dropdown.
const props = defineProps<{
  table: TableState<TRow>
  col: ColumnDef<TRow>
  data: TRow[]
  columns: ColumnDef<TRow>[]
}>()
// `label`: the value through the column's `format`, the default content
defineSlots<{ value?: (props: { value: string; label: string }) => unknown }>()

const DEFAULT_VALUE_SORT: ValueSort = { by: 'alpha', dir: 'asc' }
// Fixed row height so the windowing math is exact; the assumed viewport height is safe because
// the pane's own max-height bounds how much taller the list can grow past it, well inside
// computeVirtualRange's overscan. Matches React/Solid's constants.
const FILTER_LIST_ITEM_HEIGHT = 32
const FILTER_LIST_VIEWPORT_HEIGHT = 260

const L = props.table.labels
const {
  include: filters,
  exclude: excludeFilters,
  ranges: rangeFilters,
  modes: filterModes,
  valueMap: stringValueMap,
  setMode: setFilterMode,
  setRange: setRangeFilter,
} = props.table.filter

const searchTerm = ref('')
const valueSort = ref<ValueSort>(props.col.defaultValueSort ?? DEFAULT_VALUE_SORT)
const anchor = ref<string | null>(null)
const expanded = ref(new Set<string>())

// Scoped to this one column (computeStringValueCounts's targetKeys) — computing it for every
// filterable column is this library's single biggest measured cost.
const valueCounts = computed(
  () =>
    computeStringValueCounts(
      props.data,
      filters.value,
      rangeFilters.value,
      props.columns,
      L.value.emptyValue,
      [props.col.key],
      excludeFilters.value,
      filterModes.value,
    )[props.col.key] ?? new Map<string, number>(),
)

// Any/all match mode — only for a column whose values are actually arrays (see
// isMultiValueColumn), and only for the string checklist.
const isMultiValue = computed(() => isMultiValueColumnCached(props.data, props.col))
// A non-multi-value string column uses a checked-by-default, exclude-only model (see
// docs/filter-dropdown.md's "Filter dropdown"): "checked" means "not in `excludeFilters`".
const usesExcludeOnly = computed(
  () => props.col.type !== 'date' && props.col.type !== 'number' && !isMultiValue.value,
)
const matchMode = computed(() => filterMatchMode(filterModes.value, props.col.key, props.col))

// The set a value must be in to stay visible even at a 0 facet count (see filterValuesByCount).
const alreadyTouched = computed(() =>
  usesExcludeOnly.value
    ? (excludeFilters.value[props.col.key] ?? new Set<string>())
    : (filters.value[props.col.key] ?? new Set<string>()),
)
// Range/count-filtered, not yet narrowed by the value search — `otherValues` diffs the two.
const beforeSearchValues = computed(() =>
  filterValuesByCount(
    filterValuesByRange(
      stringValueMap.value[props.col.key] ?? [],
      rangeFilters.value[props.col.key],
      props.col.parseDate,
    ),
    valueCounts.value,
    alreadyTouched.value,
  ),
)
const values = computed(() =>
  sortFilterValues(
    filterValuesBySearch(beforeSearchValues.value, searchTerm.value),
    valueCounts.value,
    valueSort.value,
    props.col.compare,
  ),
)
// "Others": the values the value search is hiding; empty without a search.
const otherValues = computed(() => {
  if (!searchTerm.value) return []
  const shown = new Set(values.value)
  return beforeSearchValues.value.filter((v) => !shown.has(v))
})

function isValueChecked(value: string): boolean {
  return usesExcludeOnly.value
    ? !(excludeFilters.value[props.col.key]?.has(value) ?? false)
    : (filters.value[props.col.key]?.has(value) ?? false)
}
function isValueExcluded(value: string): boolean {
  return usesExcludeOnly.value ? false : (excludeFilters.value[props.col.key]?.has(value) ?? false)
}
function valueTitle(value: string): string | undefined {
  if (!usesExcludeOnly.value) return undefined
  return isValueChecked(value) ? L.value.filterValueHideTitle : L.value.filterValueShowTitle
}
function excludeLabel(value: string): string {
  return L.value.excludeValue(formatFilterValue(props.col, value, L.value.emptyValue))
}
function onExcludeClick(value: string): void {
  toggleChecklistExclude(
    props.table.filter,
    props.col.key,
    value,
    excludeFilters.value[props.col.key],
  )
}

// Select-all and "Others" state and clicks: shared logic in core
const touched = () => (usesExcludeOnly.value ? excludeFilters.value : filters.value)[props.col.key]
const allState = computed(() => checklistBulkState(values.value, touched(), usesExcludeOnly.value))
const othersState = computed(() =>
  checklistBulkState(otherValues.value, touched(), usesExcludeOnly.value),
)
function toggleAllOf(vals: string[]): void {
  toggleChecklistValues(props.table.filter, props.col.key, vals, usesExcludeOnly.value)
}
function onOthersClick(event: MouseEvent): void {
  event.preventDefault()
  toggleAllOf(otherValues.value)
  deferCheckboxCorrection(event.currentTarget as HTMLInputElement, () => othersState.value)
}

function onValueClick(value: string, event: MouseEvent): void {
  // Vue's `:checked` only rewrites the DOM property when the bound value changes, so the native
  // toggle is prevented and the binding alone drives the checkbox — but the browser reverts a
  // prevented click after Vue's write, hence the deferred correction.
  event.preventDefault()
  deferCheckboxCorrection(event.currentTarget as HTMLInputElement, () => ({
    checked: isValueChecked(value),
    indeterminate: false,
  }))
  clickChecklistValue(props.table.filter, props.col.key, value, event.shiftKey, {
    anchor: anchor.value,
    values: values.value,
    include: filters.value[props.col.key],
    exclude: excludeFilters.value[props.col.key],
    excludeOnly: usesExcludeOnly.value,
  })
  anchor.value = value
}

function cycleSort(): void {
  valueSort.value =
    props.col.type === 'date'
      ? { ...valueSort.value, dir: toggleSortDir(valueSort.value.dir) }
      : cycleValueSort(valueSort.value)
}

// Bounds over the full, unfiltered data so the slider doesn't shift under a mid-drag user.
const bounds = computed(() =>
  props.col.type === 'number' || props.col.type === 'date'
    ? computeValueBounds(props.data, props.col)
    : null,
)
const slider = computed(() => {
  const b = bounds.value
  if (!b || b.min >= b.max) return null
  const geo = computeRangeSliderGeometry(
    rangeFilters.value[props.col.key],
    b,
    props.col.type === 'date',
  )
  return { min: b.min, max: b.max, low: geo.low, high: geo.high, step: geo.step }
})
function rangeValue(kind: 'min' | 'max'): string {
  return (
    rangeFilters.value[props.col.key]?.[kind] ??
    (bounds.value ? formatRangeBound(bounds.value[kind], props.col) : '')
  )
}
function onSliderChange(low: number, high: number): void {
  setRangeFilter(props.col.key, 'min', formatRangeBound(low, props.col))
  setRangeFilter(props.col.key, 'max', formatRangeBound(high, props.col))
}

const dateTree = computed(() =>
  props.col.type === 'date'
    ? computeDateTree(values.value, L.value.emptyValue, valueSort.value.dir, props.col.parseDate)
    : [],
)
function toggleExpand(path: string): void {
  const next = new Set(expanded.value)
  if (next.has(path)) next.delete(path)
  else next.add(path)
  expanded.value = next
}
function onDateNodeClick(node: DateTreeNode, event: MouseEvent): void {
  clickDateTreeNode(props.table.filter, props.col.key, node, event.shiftKey, {
    anchorPath: anchor.value,
    tree: dateTree.value,
    values: values.value,
    include: filters.value[props.col.key],
    parseDate: props.col.parseDate,
  })
  anchor.value = node.path
}

// --- Checklist virtualization ---
const scrollTop = ref(0)
const listRef = ref<HTMLElement | null>(null)
let rafPending = false
function onListScroll(): void {
  if (rafPending) return
  rafPending = true
  requestAnimationFrame(() => {
    rafPending = false
    if (listRef.value) scrollTop.value = listRef.value.scrollTop
  })
}
// A narrower list makes the old scroll position meaningless
watch(searchTerm, () => {
  scrollTop.value = 0
  if (listRef.value) listRef.value.scrollTop = 0
})
const virtualRange = computed(() =>
  computeVirtualRange(
    scrollTop.value,
    FILTER_LIST_VIEWPORT_HEIGHT,
    FILTER_LIST_ITEM_HEIGHT,
    values.value.length,
  ),
)

// --- Row nav (Up/Down/Home/End); Escape clears a non-empty value search first ---
async function onKeydown(event: KeyboardEvent): Promise<void> {
  if (event.key === 'Escape' && searchTerm.value) {
    event.preventDefault()
    event.stopPropagation()
    searchTerm.value = ''
    // Clearing can remove the focused element (the "Others" row): keep focus on the search box
    const pane = event.currentTarget as HTMLElement
    await nextTick()
    pane.querySelector<HTMLElement>('input.dt__dd-search')?.focus()
    return
  }
  // ←/→ cross between a value's checkbox and its ≠ button; ← from the checkbox leaves the pane
  const target = event.target as HTMLElement
  const partner = (selector: string) =>
    target.closest('.dt__dd-item')?.querySelector<HTMLElement>(selector)
  if (event.key === 'ArrowRight' && target.matches('input[data-dd-value-row]')) {
    const button = partner('[data-dd-value-exclude]')
    if (button) {
      event.preventDefault()
      button.focus()
    }
    return
  }
  if (event.key === 'ArrowLeft' && target.matches('[data-dd-value-exclude]')) {
    event.preventDefault()
    event.stopPropagation()
    partner('input[data-dd-value-row]')?.focus()
    return
  }
  if (event.altKey || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  const pane = event.currentTarget as HTMLElement
  // Only the value search joins the vertical chain; select-all and the sort button sit beside it
  const headerControls = Array.from(pane.querySelectorAll<HTMLElement>('input.dt__dd-search'))
  const rowInputs = Array.from(
    pane.querySelectorAll<HTMLInputElement>(
      '.dt__dd-item input[type="checkbox"], .dt__date-tree-item input[type="checkbox"]',
    ),
  )
  const focusables = [...headerControls, ...rowInputs]
  const active = document.activeElement as HTMLElement | null
  // Up/Down from a ≠ button stays in the ≠ column
  const onExclude = !!active?.matches('[data-dd-value-exclude]')
  if (!active || (focusables.indexOf(active) === -1 && !onExclude)) return

  // The flat checklist is virtualized: reaching a logical row outside the mounted window (or
  // Home/End) scrolls first, then focuses once Vue re-renders the window.
  const checklistEl = pane.querySelector<HTMLElement>('.dt__filter-list')
  if (checklistEl) {
    const vals = values.value
    const activeValue =
      onExclude || (active instanceof HTMLInputElement && rowInputs.includes(active))
        ? active.dataset.value
        : undefined
    let targetIdx: number | null = null
    if (event.key === 'Home') targetIdx = 0
    else if (event.key === 'End') targetIdx = vals.length - 1
    else if (activeValue !== undefined) {
      const curIdx = vals.indexOf(activeValue)
      targetIdx = event.key === 'ArrowDown' ? curIdx + 1 : curIdx - 1
    }
    // Up out of the first row falls through to the plain nav below, back to the search box
    if (targetIdx !== null && !(targetIdx < 0 && event.key === 'ArrowUp' && activeValue)) {
      event.preventDefault()
      if (targetIdx < 0 || targetIdx >= vals.length) return
      const next =
        getVirtualScrollTarget(
          scrollTop.value,
          FILTER_LIST_VIEWPORT_HEIGHT,
          FILTER_LIST_ITEM_HEIGHT,
          targetIdx,
        ) ?? scrollTop.value
      scrollTop.value = next
      if (listRef.value) listRef.value.scrollTop = next
      const targetValue = vals[targetIdx]
      await nextTick()
      const selector = onExclude ? '[data-dd-value-exclude]' : 'input[type="checkbox"]'
      for (const el of checklistEl.querySelectorAll<HTMLElement>(selector)) {
        if (el.dataset.value === targetValue) {
          el.focus()
          break
        }
      }
      return
    }
  }

  if (event.key === 'Home' || event.key === 'End') {
    if (rowInputs.length === 0) return
    event.preventDefault()
    ;(event.key === 'Home' ? rowInputs[0] : rowInputs[rowInputs.length - 1]).focus()
    return
  }
  const nextIdx = focusables.indexOf(active) + (event.key === 'ArrowDown' ? 1 : -1)
  if (nextIdx < 0 || nextIdx >= focusables.length) return
  event.preventDefault()
  focusables[nextIdx].focus()
}
</script>

<template>
  <div class="dt__filter-detail" data-filter-detail @keydown="onKeydown">
    <RangeInputs
      v-if="col.type === 'number' || col.type === 'date'"
      :is-date="col.type === 'date'"
      :min="rangeValue('min')"
      :max="rangeValue('max')"
      :min-label="L.min"
      :max-label="L.max"
      :slider="slider"
      @update:min="setRangeFilter(col.key, 'min', $event)"
      @update:max="setRangeFilter(col.key, 'max', $event)"
      @slider-change="onSliderChange"
    />
    <template v-if="col.type !== 'number'">
      <div class="dt__filter-search-row">
        <input
          v-if="values.length > 0"
          v-indeterminate="allState.indeterminate"
          type="checkbox"
          class="dt__filter-select-all"
          :checked="allState.checked"
          :title="L.selectAll"
          :aria-label="L.selectAll"
          @change="toggleAllOf(values)"
        />
        <span class="dt__dd-search-wrap">
          <input
            v-model="searchTerm"
            type="text"
            class="dt__dd-search"
            data-dd-value-search
            :placeholder="L.filterSearchPlaceholder"
          />
          <button
            v-if="searchTerm"
            type="button"
            class="dt__dd-search-clear"
            :title="L.clearSearch"
            :aria-label="L.clearSearch"
            @click="searchTerm = ''"
          >
            ×
          </button>
        </span>
        <button
          type="button"
          class="dt__value-sort-btn"
          :title="L.sortValues"
          :aria-label="L.sortValues"
          @click="cycleSort"
        >
          {{ col.type === 'date' ? getDateSortIcon(valueSort.dir) : getValueSortIcon(valueSort) }}
        </button>
        <div v-if="isMultiValue" class="dt__filter-match-mode-group" role="group">
          <button
            type="button"
            class="dt__value-sort-btn dt__filter-match-mode dt__filter-match-mode--left"
            :class="{ 'dt__filter-match-mode--active': matchMode === 'or' }"
            :title="L.filterMatchAny"
            :aria-label="L.filterMatchAny"
            :aria-pressed="matchMode === 'or'"
            @click="setFilterMode(col.key, 'or')"
          >
            {{ L.filterMatchAny }}
          </button>
          <button
            type="button"
            class="dt__value-sort-btn dt__filter-match-mode dt__filter-match-mode--right"
            :class="{ 'dt__filter-match-mode--active': matchMode === 'and' }"
            :title="L.filterMatchAll"
            :aria-label="L.filterMatchAll"
            :aria-pressed="matchMode === 'and'"
            @click="setFilterMode(col.key, 'and')"
          >
            {{ L.filterMatchAll }}
          </button>
        </div>
      </div>
      <div v-if="col.type === 'date'" class="dt__date-tree-wrap">
        <DateTreeItem
          :nodes="dateTree"
          :depth="0"
          :selected="filters[col.key] ?? new Set()"
          :counts="valueCounts"
          :expanded="expanded"
          :search-active="searchTerm !== ''"
          @toggle-node="onDateNodeClick"
          @toggle-expand="toggleExpand"
        />
      </div>
      <template v-else>
        <!-- Bulk (de)select what the value search is hiding; only shown while it hides something -->
        <label v-if="otherValues.length > 0" class="dt__dd-item dt__filter-others">
          <input
            v-indeterminate="othersState.indeterminate"
            type="checkbox"
            :title="L.filterOthers"
            :aria-label="L.filterOthers"
            :checked="othersState.checked"
            @click="onOthersClick"
          />
          <span class="dt__flex1">{{ L.filterOthers }}</span>
          <span class="dt__filter-count">{{ otherValues.length }}</span>
        </label>
        <!-- Virtualized: only rows scrolled into view (+ overscan) are mounted -->
        <div ref="listRef" class="dt__filter-list" @scroll="onListScroll">
          <div :style="{ height: virtualRange.totalHeight + 'px', position: 'relative' }">
            <div
              :style="{ position: 'absolute', top: virtualRange.offsetY + 'px', left: 0, right: 0 }"
            >
              <div
                v-for="v in values.slice(virtualRange.startIndex, virtualRange.endIndex)"
                :key="v"
                class="dt__dd-item dt__dd-item--clickable"
                :class="{ 'dt__dd-item--exclude': isValueExcluded(v) }"
                :style="{ height: FILTER_LIST_ITEM_HEIGHT + 'px', boxSizing: 'border-box' }"
              >
                <!-- Multi-value column: the checkbox includes, the ≠ button excludes -->
                <label class="dt__filter-value">
                  <input
                    type="checkbox"
                    data-dd-value-row
                    :data-value="v"
                    :checked="isValueChecked(v)"
                    :title="valueTitle(v)"
                    @click="onValueClick(v, $event)"
                  />
                  <span class="dt__flex1">
                    <slot name="value" :value="v" :label="formatFilterValue(col, v, L.emptyValue)">
                      {{ formatFilterValue(col, v, L.emptyValue) }}
                    </slot>
                  </span>
                  <span class="dt__filter-count">{{ valueCounts.get(v) ?? 0 }}</span>
                </label>
                <button
                  v-if="!usesExcludeOnly"
                  type="button"
                  class="dt__filter-exclude"
                  data-dd-value-exclude
                  :data-value="v"
                  :aria-pressed="isValueExcluded(v)"
                  :aria-label="excludeLabel(v)"
                  :title="excludeLabel(v)"
                  @click="onExcludeClick(v)"
                >
                  ≠
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
