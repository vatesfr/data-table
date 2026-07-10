<script setup lang="ts" generic="TRow extends object">
import { getCurrentInstance, useSlots, type Slots } from 'vue'
import { useTableState } from './useTableState'
import DataTableView from './DataTableView.vue'
import type { DataTableProps } from './types'

const props = withDefaults(defineProps<DataTableProps<TRow>>(), { rowKey: 'id' })

const emit = defineEmits<{
  selectionChange: [rows: TRow[]]
  rowClick: [row: TRow, event: MouseEvent]
}>()

// Detects whether our own caller passed a @row-click listener, so it can be forwarded to
// DataTableView as an explicit `rowClickable` prop — the row-click emit itself is always
// forwarded below regardless (clicking a row always emits, whether or not anyone's listening).
const isRowClickable = !!getCurrentInstance()?.vnode.props?.onRowClick

function forwardRowClick(row: TRow, event: MouseEvent): void {
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
  }),
)
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
