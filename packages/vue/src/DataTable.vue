<script setup lang="ts" generic="TRow extends object">
import { useSlots, watch, type Slots } from 'vue'
import { useTableState } from './useTableState'
import DataTableView from './DataTableView.vue'
import type { DataTableProps } from './types'

// Vue casts an absent boolean prop to `false`; the default keeps `defaultGroupsCollapsed` at `true`
const props = withDefaults(defineProps<DataTableProps<TRow>>(), {
  defaultGroupsCollapsed: true,
  showSearch: true,
  showColumns: true,
})

const emit = defineEmits<{
  selectionChange: [rows: TRow[]]
  'update:page': [page: number]
  'update:searchQuery': [query: string]
}>()

// Forwards every slot to DataTableView; the `Slots` annotation avoids vue-tsc declaration-emit errors on generic SFCs
const slots: Slots = useSlots()

const table = useTableState(
  () => props.data,
  () => props.columns,
  () => ({
    labels: props.labels,
    defaultGroupsCollapsed: props.defaultGroupsCollapsed,
    initialViewState: props.initialViewState,
    getRowId: props.getRowId,
  }),
)

// v-model:page / v-model:search-query: sync the bound value in and emit the table's out, both immediate
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
    :selectable="selectable"
    :current-row="currentRow"
    :row-class="rowClass"
    :show-search="showSearch"
    :show-columns="showColumns"
    :on-row-click="onRowClick"
    @selection-change="emit('selectionChange', $event)"
  >
    <template v-for="name in Object.keys(slots)" :key="name" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </DataTableView>
</template>
