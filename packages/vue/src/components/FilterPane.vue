<script setup lang="ts" generic="TRow extends object">
import { computed, nextTick, ref, watch } from 'vue'
import {
  computeStringValues,
  computeStringValueCounts,
  isMultiValueColumnCached,
  formatFilterValue,
  computeValueBounds,
  computeRangeSliderGeometry,
  formatRangeBound,
  rangeInputProps,
  matchingRangePreset,
  nextValueSort,
  checklistValues,
  isExcludeOnlyColumn,
  toggleCollapse,
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
  rovingFocusTarget,
  checklistNavIndex,
  FILTER_DETAIL_NAV_SELECTOR,
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
// expanded date nodes) lives here, so render it keyed by column. Styled by core's `DT_STYLES`.
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
  setMode: setFilterMode,
  setRange: setRangeFilter,
} = props.table.filter

const searchTerm = ref('')
const valueSort = ref<ValueSort>(props.col.defaultValueSort ?? DEFAULT_VALUE_SORT)
const anchor = ref<string | null>(null)
const expanded = ref(new Set<string>())

const allValues = computed(() => computeStringValues(props.data, props.col, L.value.emptyValue))
const valueCounts = computed(() =>
  computeStringValueCounts(
    props.data,
    props.col,
    filters.value,
    rangeFilters.value,
    props.columns,
    L.value.emptyValue,
    excludeFilters.value,
    filterModes.value,
  ),
)

// Any/all match mode — only for a column whose values are actually arrays (see
// isMultiValueColumn), and only for the string checklist.
const isMultiValue = computed(() => isMultiValueColumnCached(props.data, props.col))
// A plain string column's checklist is checked-by-default, exclude-only (see
// docs/filter-dropdown.md's "Filter dropdown"): "checked" means "not in `excludeFilters`",
// unless an include filter narrows it.
const usesExcludeOnly = computed(() => isExcludeOnlyColumn(props.data, props.col, filters.value))
const matchMode = computed(() => filterMatchMode(filterModes.value, props.col.key, props.col))

// The set the column's model writes
const touched = () => (usesExcludeOnly.value ? excludeFilters.value : filters.value)[props.col.key]
const checklist = computed(() =>
  checklistValues(
    props.col,
    allValues.value,
    valueCounts.value,
    touched(),
    rangeFilters.value[props.col.key],
    searchTerm.value,
    valueSort.value,
  ),
)
const values = computed(() => checklist.value[0])
// "Others": the values the value search is hiding; empty without a search.
const otherValues = computed(() => checklist.value[1])

function isValueChecked(value: string): boolean {
  return usesExcludeOnly.value
    ? !(excludeFilters.value[props.col.key]?.has(value) ?? false)
    : (filters.value[props.col.key]?.has(value) ?? false)
}
function isValueExcluded(value: string): boolean {
  return isMultiValue.value && (excludeFilters.value[props.col.key]?.has(value) ?? false)
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
  valueSort.value = nextValueSort(props.col, valueSort.value)
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
function rangeInput(kind: 'min' | 'max') {
  const label = kind === 'min' ? L.value.min : L.value.max
  return rangeInputProps(props.col, kind, rangeFilters.value[props.col.key], bounds.value, label)
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
  expanded.value = toggleCollapse(expanded.value, path)
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
    pane.querySelector<HTMLElement>('input.dt-dd-search')?.focus()
    return
  }
  if (event.altKey) return
  // ←/→ cross between a value's checkbox and its ≠ button; ← from the checkbox leaves the pane
  const target = event.target as HTMLElement
  const partner = (selector: string) =>
    target.closest('.dt-dd-item')?.querySelector<HTMLElement>(selector)
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
  const pane = event.currentTarget as HTMLElement
  // Only the value search joins the vertical chain; select-all and the sort button sit beside it
  const focusables = Array.from(pane.querySelectorAll<HTMLElement>(FILTER_DETAIL_NAV_SELECTOR))
  const rows = focusables.filter((el) => !el.matches('input[data-dd-value-search]'))
  const active = document.activeElement as HTMLElement | null
  // Up/Down from a ≠ button stays in the ≠ column
  const onExclude = !!active?.matches('[data-dd-value-exclude]')
  if (!active || (!focusables.includes(active) && !onExclude)) return

  // The flat checklist is virtualized: reaching a logical row outside the mounted window (or
  // Home/End) scrolls first, then focuses once Vue re-renders the window.
  const checklistEl = pane.querySelector<HTMLElement>('.dt-filter-list')
  const vals = values.value
  const i = checklistEl ? checklistNavIndex(event.key, vals, active.dataset.value) : null
  if (checklistEl && i !== null) {
    event.preventDefault()
    const targetValue = vals[i]
    if (targetValue === undefined) return
    const top =
      getVirtualScrollTarget(
        scrollTop.value,
        FILTER_LIST_VIEWPORT_HEIGHT,
        FILTER_LIST_ITEM_HEIGHT,
        i,
      ) ?? scrollTop.value
    scrollTop.value = top
    if (listRef.value) listRef.value.scrollTop = top
    await nextTick()
    const selector = onExclude ? '[data-dd-value-exclude]' : 'input[data-dd-value-row]'
    for (const el of checklistEl.querySelectorAll<HTMLElement>(selector)) {
      if (el.dataset.value === targetValue) {
        el.focus()
        break
      }
    }
    return
  }

  const next = rovingFocusTarget(event.key, focusables, active, rows)
  if (!next) return
  event.preventDefault()
  next.focus()
}
</script>

<template>
  <div class="dt-filter-detail" data-filter-detail @keydown="onKeydown">
    <RangeInputs
      v-if="col.type === 'number' || col.type === 'date'"
      :is-date="col.type === 'date'"
      :min="rangeInput('min')"
      :max="rangeInput('max')"
      :presets="col.rangePresets"
      :active-preset="matchingRangePreset(col, rangeFilters[col.key])"
      :slider="slider"
      @update:min="setRangeFilter(col.key, 'min', $event)"
      @update:max="setRangeFilter(col.key, 'max', $event)"
      @slider-change="onSliderChange"
      @set-range="
        (range) => {
          setRangeFilter(col.key, 'min', range.min)
          setRangeFilter(col.key, 'max', range.max)
        }
      "
    />
    <template v-if="col.type !== 'number'">
      <div class="dt-filter-search-row">
        <input
          v-if="values.length > 0"
          v-indeterminate="allState.indeterminate"
          type="checkbox"
          :checked="allState.checked"
          :title="L.selectAll"
          :aria-label="L.selectAll"
          @change="toggleAllOf(values)"
        />
        <span class="dt-dd-search-wrap">
          <input
            v-model="searchTerm"
            type="text"
            class="dt-dd-search"
            data-dd-value-search
            :placeholder="L.filterSearchPlaceholder"
          />
          <button
            v-if="searchTerm"
            type="button"
            class="dt-dd-search-clear"
            :title="L.clearSearch"
            :aria-label="L.clearSearch"
            @click="searchTerm = ''"
          >
            ×
          </button>
        </span>
        <button
          type="button"
          class="dt-value-sort-btn"
          :title="L.sortValues"
          :aria-label="L.sortValues"
          @click="cycleSort"
        >
          {{ col.type === 'date' ? getDateSortIcon(valueSort.dir) : getValueSortIcon(valueSort) }}
        </button>
        <div v-if="isMultiValue" class="dt-filter-match-mode-group" role="group">
          <button
            type="button"
            class="dt-value-sort-btn dt-filter-match-mode dt-filter-match-mode--left"
            :class="{ 'dt-filter-match-mode--active': matchMode === 'or' }"
            :title="L.filterMatchAny"
            :aria-label="L.filterMatchAny"
            :aria-pressed="matchMode === 'or'"
            @click="setFilterMode(col.key, 'or')"
          >
            {{ L.filterMatchAny }}
          </button>
          <button
            type="button"
            class="dt-value-sort-btn dt-filter-match-mode dt-filter-match-mode--right"
            :class="{ 'dt-filter-match-mode--active': matchMode === 'and' }"
            :title="L.filterMatchAll"
            :aria-label="L.filterMatchAll"
            :aria-pressed="matchMode === 'and'"
            @click="setFilterMode(col.key, 'and')"
          >
            {{ L.filterMatchAll }}
          </button>
        </div>
      </div>
      <div v-if="col.type === 'date'" class="dt-date-tree-wrap">
        <DateTreeItem
          :nodes="dateTree"
          :depth="0"
          :selected="filters[col.key] ?? new Set()"
          :counts="valueCounts"
          :format-count="L.formatCount"
          :expanded="expanded"
          :search-active="searchTerm !== ''"
          @toggle-node="onDateNodeClick"
          @toggle-expand="toggleExpand"
        />
      </div>
      <template v-else>
        <!-- Bulk (de)select what the value search is hiding; only shown while it hides something -->
        <label v-if="otherValues.length > 0" class="dt-dd-item dt-filter-others">
          <input
            v-indeterminate="othersState.indeterminate"
            type="checkbox"
            :title="L.filterOthers"
            :aria-label="L.filterOthers"
            :checked="othersState.checked"
            @click="onOthersClick"
          />
          <span class="dt-flex1">{{ L.filterOthers }}</span>
          <span class="dt-filter-count">{{ L.formatCount(otherValues.length) }}</span>
        </label>
        <!-- Virtualized: only rows scrolled into view (+ overscan) are mounted -->
        <div ref="listRef" class="dt-filter-list" @scroll="onListScroll">
          <div :style="{ height: virtualRange.totalHeight + 'px', position: 'relative' }">
            <div
              :style="{ position: 'absolute', top: virtualRange.offsetY + 'px', left: 0, right: 0 }"
            >
              <div
                v-for="v in values.slice(virtualRange.startIndex, virtualRange.endIndex)"
                :key="v"
                class="dt-dd-item"
                :class="{ 'dt-dd-item--exclude': isValueExcluded(v) }"
                :style="{ height: FILTER_LIST_ITEM_HEIGHT + 'px', boxSizing: 'border-box' }"
              >
                <!-- Multi-value column: the checkbox includes, the ≠ button excludes -->
                <label class="dt-filter-value">
                  <input
                    type="checkbox"
                    data-dd-value-row
                    :data-value="v"
                    :checked="isValueChecked(v)"
                    :title="valueTitle(v)"
                    @click="onValueClick(v, $event)"
                  />
                  <span class="dt-flex1">
                    <slot name="value" :value="v" :label="formatFilterValue(col, v, L.emptyValue)">
                      {{ formatFilterValue(col, v, L.emptyValue) }}
                    </slot>
                  </span>
                  <span class="dt-filter-count">{{ L.formatCount(valueCounts.get(v) ?? 0) }}</span>
                </label>
                <button
                  v-if="isMultiValue"
                  type="button"
                  class="dt-filter-exclude"
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
