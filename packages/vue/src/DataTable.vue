<script setup lang="ts" generic="TRow extends object">
import { computed, ref, watch, useSlots, getCurrentInstance } from 'vue'
import { computeAggregate, getColumnValue, type GroupResult } from '@vates/data-table-core'
import { useTableState } from './useTableState'
import type { ColumnDef } from './types'
import type { DataTableLabels } from '@vates/data-table-core'
import Dropdown from './components/Dropdown.vue'
import ToolbarBtn from './components/ToolbarBtn.vue'

const props = withDefaults(
  defineProps<{
    data: TRow[]
    columns: ColumnDef<TRow>[]
    rowKey?: string
    defaultVisibleColumns?: string[]
    labels?: Partial<DataTableLabels>
    defaultPageSize?: number
    selectable?: boolean
  }>(),
  { rowKey: 'id' },
)

const emit = defineEmits<{
  selectionChange: [rows: TRow[]]
  rowClick: [row: TRow, event: MouseEvent]
}>()

const slots = useSlots()

// vnode.props holds the raw incoming listeners regardless of the emits declaration
// above (declared emits are stripped from $attrs), so this is the only reliable way
// to detect whether the caller passed a @row-click listener.
const isRowClickable = !!getCurrentInstance()?.vnode.props?.onRowClick

function handleRowClick(row: TRow, event: MouseEvent) {
  emit('rowClick', row, event)
}

const state = useTableState(
  () => props.data,
  () => props.columns,
  () => ({
    defaultVisibleColumns: props.defaultVisibleColumns,
    labels: props.labels,
    defaultPageSize: props.defaultPageSize,
  }),
)

const {
  visibleCols,
  sorts,
  filters,
  rangeFilters,
  groupBy,
  collapsedGroups,
  selection,
  selectedRows,
  processedData,
  pagedData,
  groupedData,
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
  toggleFilter,
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
} = state

watch(selectedRows, (rows) => {
  emit('selectionChange', rows)
})

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

const numericFilterCols = computed(() =>
  props.columns.filter((c) => c.type === 'number' && c.filterable !== false),
)
const stringFilterCols = computed(() =>
  props.columns.filter((c) => c.type !== 'number' && c.type !== 'date' && c.filterable !== false),
)
const groupableCols = computed(() => props.columns.filter((c) => c.groupable === true))
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

function findCol(key: string): ColumnDef<TRow> | undefined {
  return props.columns.find((c) => c.key === key)
}

/** The value that defines a group for column `key` at groupBy index `i` — a single array item when the underlying value is an array, the raw value otherwise. */
function groupValue(group: GroupResult<TRow>, key: string, i: number): unknown {
  const col = findCol(key)
  const raw = col ? getColumnValue(col, group.rows[0]) : undefined
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
      <Dropdown v-if="stringFilterCols.length > 0 || numericFilterCols.length > 0">
        <template #trigger="{ open }">
          <ToolbarBtn :active="open || activeFilterCount > 0">
            {{ L.filter }}
            <span v-if="activeFilterCount > 0" class="dt__chip">{{ activeFilterCount }}</span>
          </ToolbarBtn>
        </template>
        <div class="dt__dd-scroll">
          <template v-for="col in stringFilterCols" :key="col.key">
            <div class="dt__dd-section">{{ col.label }}</div>
            <label
              v-for="v in stringValueMap[col.key]"
              :key="v"
              class="dt__dd-item dt__dd-item--clickable"
            >
              <input
                type="checkbox"
                :checked="filters[col.key]?.has(v) ?? false"
                @change="toggleFilter(col.key, v)"
              />
              <!--
                Slot #filter-{key} — custom label in the filter dropdown.
                Slot scope: { value: string }
                Falls back to the raw string value.
              -->
              <slot :name="`filter-${col.key}`" :value="v">{{ v }}</slot>
            </label>
          </template>
          <template v-if="numericFilterCols.length > 0">
            <div class="dt__dd-section">{{ L.numericRanges }}</div>
            <div v-for="col in numericFilterCols" :key="col.key" class="dt__range">
              <div class="dt__range-label">{{ col.label }}</div>
              <div class="dt__range-inputs">
                <input
                  type="number"
                  :placeholder="L.min"
                  :value="rangeFilters[col.key]?.min ?? ''"
                  @input="setRangeFilter(col.key, 'min', ($event.target as HTMLInputElement).value)"
                  class="dt__range-input"
                />
                <span class="dt__range-sep">–</span>
                <input
                  type="number"
                  :placeholder="L.max"
                  :value="rangeFilters[col.key]?.max ?? ''"
                  @input="setRangeFilter(col.key, 'max', ($event.target as HTMLInputElement).value)"
                  class="dt__range-input"
                />
              </div>
            </div>
          </template>
          <div v-if="activeFilterCount > 0" class="dt__dd-footer">
            <button @click="clearFilters">{{ L.clearFilters }}</button>
          </div>
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
        <template v-if="groupBy.length > 0">{{ L.groupCount(groupedData.length) }}</template>
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
          {{ columns.find((c) => c.key === key)?.label }}: {{ [...vals].join(', ') }}
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
        <option v-for="n in [10, 20, 50, 100]" :key="n" :value="n">{{ n }}</option>
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
              class="dt__group-row"
              @click="toggleGroupCollapse(group.key!)"
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
                {{ collapsedGroups.has(group.key!) ? '▶' : '▼' }}
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
                  <slot :name="`group-${g}`" :value="groupValue(group, g, i)" :row="group.rows[0]">
                    {{
                      findCol(g)
                        ? formatValue(groupValue(group, g, i), group.rows[0], findCol(g)!)
                        : String(groupValue(group, g, i) ?? '')
                    }}
                  </slot>
                </template>
                <span class="dt__group-count">{{ L.rowsInGroup(group.rows.length) }}</span>
              </td>
            </tr>

            <!-- Aggregate row -->
            <tr v-if="hasAggregates" class="dt__agg-row">
              <td v-if="selectable" class="dt__agg-td" style="width: 36px" />
              <td class="dt__agg-td" style="width: 28px" />
              <td v-for="col in activeColumns" :key="col.key" class="dt__agg-td">
                {{
                  (() => {
                    const v = computeAggregate(col, group.rows)
                    if (v === undefined || v === null) return ''
                    return col.format ? col.format(v, group.rows[0]) : String(v)
                  })()
                }}
              </td>
            </tr>

            <!-- Data rows -->
            <template v-if="group.key === null || !collapsedGroups.has(group.key!)">
              <tr
                v-for="(row, ri) in group.rows"
                :key="(asRecord(row)[rowKey] as string | number) ?? ri"
                :class="{
                  'dt__tr--stripe': ri % 2 !== 0,
                  'dt__tr--selected': selectable && selection.has(row),
                  'dt__tr--clickable': isRowClickable,
                }"
                @click="handleRowClick(row, $event)"
              >
                <td v-if="selectable" class="dt__td" style="width: 36px" @click.stop>
                  <input
                    type="checkbox"
                    :checked="selection.has(row)"
                    @change="toggleRowSelection(row)"
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
.dt__dd-scroll {
  max-height: 380px;
  overflow-y: auto;
  min-width: 240px;
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

/* Range filter */
.dt__range {
  padding: 4px 14px 8px;
}
.dt__range-label {
  font-size: 12px;
  margin-bottom: 4px;
  color: var(--color-text-secondary);
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
  background: var(--color-background-secondary);
  color: var(--color-text-secondary);
  border-bottom: 0.5px solid var(--color-border-tertiary);
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
  background: var(--color-background-secondary);
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
  font-weight: 500;
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
}
.dt__group-td {
  padding: 6px 12px;
  border-bottom: 0.5px solid var(--color-border-tertiary);
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
