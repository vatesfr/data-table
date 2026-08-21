<script setup lang="ts" generic="TRow extends object">
import { useSlots, watch, type Slots } from 'vue'
import { useTableState } from './useTableState'
import DataTableView from './DataTableView.vue'
import { useSelfDetectedListener } from './composables/useSelfDetectedListener'
import type { DataTableProps } from './types'

// Vue casts an absent boolean prop with no explicit default to `false`, not `undefined` — an
// explicit default here is required so an omitted `defaultGroupsCollapsed` still falls through to
// useTableState's own `?? true` default instead of being silently forced to `false`.
const props = withDefaults(defineProps<DataTableProps<TRow>>(), {
  rowKey: 'id',
  defaultGroupsCollapsed: true,
})

const emit = defineEmits<{
  selectionChange: [rows: TRow[]]
  rowClick: [row: TRow, event: MouseEvent | KeyboardEvent]
  'update:page': [page: number]
  'update:searchQuery': [query: string]
}>()

// Detects whether our own caller passed a @row-click listener, so it can be forwarded to
// DataTableView as an explicit `rowClickable` prop — the row-click emit itself is always
// forwarded below regardless (clicking a row always emits, whether or not anyone's listening).
// See useSelfDetectedListener for why this needs onUpdated rather than a plain computed.
const isRowClickable = useSelfDetectedListener('onRowClick')

function forwardRowClick(row: TRow, event: MouseEvent | KeyboardEvent): void {
  emit('rowClick', row, event)
}

// Forwards every slot passed to <DataTable> straight through to DataTableView, so consumers
// using #cell-{key}/#filter-{key}/#group-{key} don't need to know about this wrapper. The
// explicit `Slots` annotation and named `forwardRowClick` function (rather than an inline
// template lambda) avoid self-referential `any`/generic-erasure errors that vue-tsc's isolated
// declaration-emit pass (used when building .d.ts files) hits with generic SFCs.
const slots: Slots = useSlots()

const table = useTableState(
  () => props.data,
  () => props.columns,
  () => ({
    defaultVisibleColumns: props.defaultVisibleColumns,
    labels: props.labels,
    defaultPageSize: props.defaultPageSize,
    defaultGroupsCollapsed: props.defaultGroupsCollapsed,
    getRowId: props.getRowId,
  }),
)

// v-model:page / v-model:search-query — the two pieces of <DataTable>'s internal state that,
// unlike selection (already observable via selectionChange/onSelectionChange), otherwise have no
// way to be read from outside at all, let alone set. `props.page`/`props.searchQuery` stay
// `undefined` unless the caller actually binds v-model:page/v-model:search-query, in which case
// these two watch pairs re-sync useTableState's own state whenever the bound value changes
// externally (immediate: true also applies it once at mount, not just on later changes) and emit
// the table's own value back out on every change (immediate: true here too, so a freshly-bound
// v-model reflects the table's real initial value even before any user interaction).
watch(
  () => props.page,
  (page) => {
    if (page !== undefined && page !== table.pagination.page.value) table.pagination.setPage(page)
  },
  { immediate: true },
)
watch(table.pagination.page, (page) => emit('update:page', page), { immediate: true })

watch(
  () => props.searchQuery,
  (query) => {
    if (query !== undefined && query !== table.search.query.value) table.search.setQuery(query)
  },
  { immediate: true },
)
watch(table.search.query, (query) => emit('update:searchQuery', query), { immediate: true })
</script>

<template>
  <DataTableView
    :table="table"
    :data="data"
    :columns="columns"
    :row-key="rowKey"
    :selectable="selectable"
    :row-clickable="isRowClickable"
    @selection-change="emit('selectionChange', $event)"
    @row-click="forwardRowClick"
  >
    <template v-for="name in Object.keys(slots)" :key="name" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </DataTableView>
</template>
