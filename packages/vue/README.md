# @vates/flexi-table-vue

Vue 3 adapter for [flexi-table](../../README.md) — a flexible, fully-typed data table with sorting, filtering, column visibility, and row grouping.

## Install

```bash
npm install @vates/flexi-table-vue
```

Requires Vue ≥ 3.3.

## Usage

```vue
<script setup lang="ts">
import { DataTable, type ColumnDef } from '@vates/flexi-table-vue'

interface Employee {
  id: number
  name: string
  department: string
  salary: number
}

const COLUMNS: ColumnDef<Employee>[] = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'department', label: 'Department', type: 'string', groupable: true },
  {
    key: 'salary',
    label: 'Salary',
    type: 'number',
    format: (v) => Number(v).toLocaleString() + ' €',
  },
]
</script>

<template>
  <DataTable :data="employees" :columns="COLUMNS" row-key="id" />
</template>
```

## Custom rendering

Use named scoped slots to customize how cells, filter labels, and group headers render.

```vue
<DataTable :data="employees" :columns="COLUMNS" row-key="id">
  <!-- Custom table cell -->
  <template #cell-department="{ value, row }">
    <Badge :label="String(value)" />
  </template>

  <!-- Custom filter checklist item -->
  <template #filter-department="{ value }">
    <Badge :label="value" />
  </template>

  <!-- Custom group header value (same slot as cell) -->
  <template #group-department="{ value }">
    <Badge :label="String(value)" />
  </template>
</DataTable>
```

Slot naming: `#cell-{key}`, `#filter-{key}`, `#group-{key}` where `{key}` matches the column's `key`.

`#group-{key}` applies to group header rows when that column is used for grouping, so values display with the same visual as table cells.

## Row selection

Pass `:selectable="true"` to show a checkbox column. The header checkbox selects/deselects the full filtered dataset (all pages at once). Group header checkboxes select/deselect all rows in that group. Both support indeterminate state.

```vue
<script setup lang="ts">
const selected = ref<Employee[]>([])
</script>

<template>
  <DataTable
    :data="employees"
    :columns="COLUMNS"
    row-key="id"
    :selectable="true"
    @selection-change="selected = $event"
  />
  <p v-if="selected.length > 0">{{ selected.length }} rows selected</p>
</template>
```

`selectionChange` receives the array of currently selected rows that are present in the filtered dataset. Selection uses object identity (`Set<TRow>`), so it persists across sort/filter changes as long as row references are stable.

## `DataTable` props

| Prop                    | Type                       | Default | Description                                  |
| ----------------------- | -------------------------- | ------- | -------------------------------------------- |
| `data`                  | `TRow[]`                   | —       | Row data                                     |
| `columns`               | `ColumnDef<TRow>[]`        | —       | Column definitions                           |
| `rowKey`                | `keyof TRow & string`      | —       | Unique row identifier                        |
| `defaultVisibleColumns` | `string[]`                 | all     | Initially visible column keys                |
| `labels`                | `Partial<DataTableLabels>` | English | UI string overrides                          |
| `defaultPageSize`       | `number`                   | 0 (off) | Initial rows per page; 0 disables pagination |
| `selectable`            | `boolean`                  | `false` | Show checkbox column for row selection       |

All props accept `MaybeRefOrGetter` — you can pass refs, computed values, or plain values.

## Events

| Event             | Payload  | Description                                                                                  |
| ----------------- | -------- | -------------------------------------------------------------------------------------------- |
| `selectionChange` | `TRow[]` | Emitted when selection changes; payload is the selected rows present in the filtered dataset |

## Column definition

```ts
interface ColumnDef<TRow extends object> {
  key: keyof TRow & string
  label: string
  type?: 'string' | 'number' | 'date' // controls filter UI; default: 'string'
  width?: number
  format?: (value: unknown) => string
  sortable?: boolean // default: true
  filterable?: boolean // default: true
  groupable?: boolean // default: false
}
```

For custom rendering, provide a `#cell-{key}` slot instead of a `render` function.

## `useTableState` composable

If you need to build a custom layout, use the composable directly:

```ts
import { useTableState } from '@vates/flexi-table-vue'

const {
  // Reactive state (refs)
  visibleCols,
  sorts,
  filters,
  rangeFilters,
  groupBy,
  collapsedGroups,
  page,
  pageSize,
  selection, // ShallowRef<Set<TRow>> — use selection.value.has(row) to check membership
  // Computed
  processedData,
  pagedData,
  groupedData,
  activeColumns,
  stringValueMap,
  activeFilterCount,
  numPages,
  selectedRows,
  L,
  // Actions
  toggleColVisibility,
  toggleSort,
  toggleFilter,
  setRangeFilter,
  toggleGroup,
  toggleGroupCollapse,
  clearColumnFilter,
  clearSorts,
  clearFilters,
  clearGroups,
  clearAll,
  setPage,
  setPageSize,
  getSortIcon,
  getSortIndex,
  toggleRowSelection, // (row: TRow) => void
  toggleSelectAll, // (rows: TRow[]) => void — selects all if any unselected, else deselects all
  clearSelection, // () => void
} = useTableState(data, columns, options)
```

`data`, `columns`, and `options` can be refs, computed values, or plain values.

## i18n

Use a built-in locale or supply any `Partial<DataTableLabels>` overrides (shallow-merged over English defaults):

```ts
import { LABELS_FR } from '@vates/flexi-table-vue'
```

```vue
<DataTable :labels="LABELS_FR" ... />
```

Built-in locales: `LABELS_EN` (default), `LABELS_FR`, `LABELS_ES`, `LABELS_DE`, `LABELS_PT`.

## License

MIT
