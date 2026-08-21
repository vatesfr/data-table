# @vates/data-table-vue

[![npm](https://img.shields.io/npm/v/@vates/data-table-vue)](https://www.npmjs.com/package/@vates/data-table-vue)
[![node](https://img.shields.io/node/v/@vates/data-table-vue)](https://www.npmjs.com/package/@vates/data-table-vue)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@vates/data-table-vue)](https://bundlephobia.com/package/@vates/data-table-vue)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Vue 3 adapter for [data-table](../../README.md) — a flexible, fully-typed data table with sorting, filtering, column visibility/reordering, and row grouping.

## Install

```bash
npm install @vates/data-table-vue
```

Requires Vue ≥ 3.3.

Import the stylesheet once, e.g. in your app's entry point:

```ts
import '@vates/data-table-vue/style.css'
```

## Usage

```vue
<script setup lang="ts">
import { DataTable, type ColumnDef } from '@vates/data-table-vue'

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

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vue/#full-table)

Use named scoped slots to customize how cells, filter labels, and group headers render. `Badge` below is your own component — this library ships no presentational components of its own, only the table logic/chrome.

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

## Multi-value (array) columns

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vue/#full-table)

A column whose cell value is an array — tags, genres, categories — is detected automatically, no flag required:

- The filter checklist lists each individual item instead of the stringified whole array (`"Action,RPG"` becomes separate `"Action"` and `"RPG"` entries), and a row matches if it contains any selected item (`multiMode: 'or'`, the default) or all of them (`multiMode: 'and'`).
- Grouping by an array column fans a row out into one group per item — a row tagged `['Action', 'RPG']` appears under both the "Action" and "RPG" groups. The `#group-{key}` slot and `format` receive the single item being grouped on, not the whole array.
- A row with an empty array (`tags: []`) is bucketed under a labeled placeholder — `(none)` by default, customizable via the `emptyValue` label — instead of a blank checklist entry or an unlabeled group.
- Cells without a custom `#cell-{key}` slot or `format` display the array joined with `, `.
- Every checklist item (array-valued columns and plain string columns alike) shows how many rows currently match it — helpful for scanning a high-cardinality column like `tags` before picking a value. The count is faceted: it reflects every other active filter, but not the checklist's own column, so selecting a value elsewhere narrows the counts shown here without a value's own selection state affecting its neighbors. A value with a count of 0 is dropped from the checklist entirely — unless it's already selected, in which case it stays listed so it can still be unticked.
- A sort-order button next to the search input cycles the checklist between alphabetical (A→Z / Z→A) and by-count (high→low / low→high) order — default is alphabetical ascending.
- Each checklist value cycles through a tri-state: neutral → include → exclude → neutral (`table.filter.cycleValue`), so a value can be explicitly excluded, not just included. Include/exclude are kept mutually exclusive per value. Active-bar chips are per-kind — an include-values chip, an exclude-values chip, and a range chip for a column can all appear at once, each independently removable.

```ts
interface Game {
  id: number
  name: string
  tags: string[]
}

const COLUMNS: ColumnDef<Game>[] = [
  { key: 'name', label: 'Name' },
  { key: 'tags', label: 'Tags', groupable: true }, // no extra config needed
]
```

## Date filter tree

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vue/#full-table)

`type: 'date'` columns get a Year › Month › Day checkbox tree in the filter dropdown instead of a checklist, plus a range filter (2 date inputs + a slider) above it that narrows the tree itself — dates outside the range drop out of the tree, not just the final row set. Check a year or month to select every date under it in one click, or drill into individual days; the search box and per-value row counts work the same as for string columns. The same sort-order button toggles the tree's chronological order (ascending/descending) instead — there's no by-count order for a tree of grouped branches. Values that don't parse as dates are grouped under the `emptyValue` label rather than dropped.

```ts
{ key: 'joined', label: 'Joined', type: 'date' }
```

The `#filter-{key}` slot isn't applied to date columns — a tree branch (a year or month) has no single raw value to hand it, and even a day leaf can bundle more than one.

## Computed columns

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vue/#full-table)

A column doesn't need a matching property on `TRow` — set `value` to a function to compute the cell value from the whole row. Sorting, filtering, grouping, and aggregation all work off the computed value, same as a regular column.

```ts
const COLUMNS: ColumnDef<Employee>[] = [
  { key: 'salary', label: 'Salary', type: 'number' },
  { key: 'bonus', label: 'Bonus', type: 'number' },
  {
    key: 'total',
    label: 'Total Comp',
    type: 'number',
    value: (row) => row.salary + row.bonus,
    aggregate: 'sum',
  },
]
```

`value` also covers simple aliasing, reading a different property than `key`:

```ts
{ key: 'employeeName', label: 'Name', value: (row) => row.name }
```

## Custom sort order

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vue/#full-table)

`compare` overrides the default numeric-or-alphabetical comparison for a column whose natural order is neither, e.g. an enum/tier column:

```ts
const TIER_ORDER = ['Bronze', 'Silver', 'Gold', 'Platinum']

{
  key: 'tier',
  label: 'Tier',
  compare: (a, b) => TIER_ORDER.indexOf(String(a)) - TIER_ORDER.indexOf(String(b)),
}
```

It applies everywhere the column's values are ordered: row sort, group order (for a groupBy column), and the filter checklist's default and explicit ordering.

`compare` also receives a 3rd `dir` argument (the active ascending/descending direction) — ignore it for an ordinary comparator like the one above, since every call site already flips the _return value_'s sign for a descending sort, the same way the default comparison does. It's there for the rarer case of a value that has to stay pinned to one end regardless of which direction is active, e.g. a missing value that should sort last whether ascending or descending — impossible to express as a plain `(a, b) => number` return, since that gets sign-flipped right along with everything else. `compareMissingLast` is a ready-made comparator for exactly this:

```ts
import { compareMissingLast } from '@vates/data-table-vue'

{ key: 'score', label: 'Score', type: 'number', compare: compareMissingLast() } // null/undefined/'' always last, in both directions
```

Its default `isMissing` check is `(v) => v == null || v === ''`; pass your own `compare`/`isMissing` to `compareMissingLast(compare?, isMissing?)` to combine it with a custom order — e.g. `compareMissingLast((a, b) => TIER_ORDER.indexOf(String(a)) - TIER_ORDER.indexOf(String(b)))` sorts by tier rank with an empty tier always last.

## Grouped columns

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vue/#full-table)

Set `groupable: true` on a column to make it available in the toolbar's Group dropdown; a grouped column disappears from the table header/cells and its rows are bucketed under a header row instead.

```ts
{ key: 'department', label: 'Department', groupable: true }
```

Grouping buckets rows by **exact value** by default — fine for low-cardinality columns (department, status), but a continuous or near-unique column (a percentage, a raw timestamp) would create one group per row. Set `groupValue` to bucket into coarser groups instead — it only affects grouping; sort/filter/aggregate/cell rendering keep reading the column's real value, untouched:

```ts
import { bucketNumericRange, formatNumericRange, bucketDatePart, formatDatePart } from '@vates/data-table-vue'

{
  key: 'salary',
  label: 'Salary',
  type: 'number',
  groupable: true,
  groupValue: bucketNumericRange(20000), // 47000 -> 40000 (the range's lower bound)
  groupFormat: formatNumericRange(20000, ' USD'), // "40000–60000 USD" in the group header
}

{
  key: 'joined',
  label: 'Joined',
  type: 'date',
  groupable: true,
  groupValue: bucketDatePart('year'), // any date -> "2019-01-01"
  groupFormat: formatDatePart('year'), // "2019" in the group header
}
```

`groupValue(value, row)` returns the bucket key — return a value whose type matches `col.type` (a number for `type: 'number'`, a `parseDate`-parseable string for `type: 'date'`) so groups still sort correctly, the same type-aware comparison a plain groupBy column already gets. `groupFormat(keyPart)` renders that bucket key for the group header (`bucketNumericRange`'s lower bound alone, e.g. `40000`, usually isn't fit to display on its own); omit it to show the raw bucket key. A bucketed column's group header bypasses the `#group-{key}` slot entirely (there's no single raw value the slot's scope could meaningfully carry) — `groupFormat` is the only display hook for it. `bucketDatePart`/`formatDatePart` accept `'year' | 'month' | 'day'` granularity.

A grouped column normally disappears from the row cells too, since its value is already shown in the group header — but that's a loss for a bucketed column (the header only shows `"40000–60000 USD"`, not the row's exact `47000`) or a multi-value column (a `["Roguelike", "Deckbuilder"]` row shows up in both groups, and hiding the column removes the only way to see its _other_ tags from within one group). Set `keepVisibleWhenGrouped: true` on such a column to keep it in the row cells even while grouped:

```ts
{ key: 'salary', label: 'Salary', type: 'number', groupable: true, groupValue: bucketNumericRange(20000), keepVisibleWhenGrouped: true }
```

## Aggregation

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vue/#full-table)

Set `aggregate` on a column to show a computed value in a row below each group header — try grouping by Department in the demo. Built-in types: `'sum' | 'count' | 'avg' | 'min' | 'max'`; or supply a function for anything else:

```ts
{ key: 'salary', label: 'Salary', type: 'number', aggregate: 'sum' }
{ key: 'score', label: 'Score', type: 'number', aggregate: (rows) => Math.max(...rows.map((r) => r.score)) }
```

The aggregate row only appears once grouping is active and only shows values for columns that define `aggregate`; it's always visible regardless of a group's collapsed state.

## Row selection

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vue/#row-selection)

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

Refetching or re-mapping `data` breaks that assumption — even identical content in a new array of new objects silently drops selection, since a `Set` can only ever match by reference. Pass `:get-row-id` to opt into id-based matching instead, so selection survives a refresh:

```vue
<DataTable
  :data="employees"
  :columns="COLUMNS"
  row-key="id"
  :selectable="true"
  @selection-change="selected = $event"
  :get-row-id="(employee) => employee.id"
/>
```

With `getRowId` set, a selected id is remapped to its fresh object reference whenever `data` changes, and dropped if the id no longer exists. Omit it to keep the default object-identity behavior exactly as above.

## Row click

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vue/#row-click)

Listen to `@row-click` to react to a data row being clicked — it receives the full row object and the native event, no key lookup needed. Group header rows, the aggregate row, and the selection checkbox cell never trigger it. A focused row also fires it on `Enter` (see "Keyboard navigation" above), so the event is `MouseEvent | KeyboardEvent`, not just `MouseEvent`.

```vue
<DataTable
  :data="employees"
  :columns="COLUMNS"
  row-key="id"
  @row-click="(row, event) => console.log('clicked', row.name)"
/>
```

## Header click sorting

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vue/#full-table)

Clicking a column header is a single-column-sort shortcut, distinct from the Sort dropdown (which stays the tool for a deliberate multi-column sort with explicit priority):

- **Plain click** sorts by that column alone, discarding every other active sort (`table.sort.replace(key)`) — or cycles its direction if it's already the sole active sort.
- **Shift-click** adds the column to the existing multi-sort, or flips its direction in place if it's already part of it (`table.sort.appendOrToggle(key)`) — it never removes a column from the sort; use the active-bar chip's `×` or the Sort dropdown's remove button for that.

The header's own sort-icon index (`1↑`, `2↓`, …) only appears once more than one currently-visible header is sorted.

## Keyboard navigation

Table rows use a **roving tabindex**: exactly one row — a data row or a group header — is a Tab stop at a time, and arrow keys move it:

- `ArrowUp`/`ArrowDown` move focus, crossing page boundaries when paginated.
- `Home`/`End` jump within the current page; `Ctrl`/`Cmd+Home`/`End` jump across all pages.
- `Space` toggles the focused row's/group's selection (when `selectable`).
- `Enter` fires `rowClick` on a data row, or toggles a group header's collapsed state.
- `Shift+ArrowUp/Down/Home/End` range-selects from the last-clicked/focused anchor, same as shift-click.

## Column reordering

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vue/#full-table)

Drag a column header to reorder it, or drag a row (or press Alt+ArrowUp/Alt+ArrowDown on it) in the Columns panel — both work out of the box, no extra props required. Order is tracked independently of visibility, so hiding and re-showing a column keeps its place. It's included in `getViewState()`/`setViewState()` (as `columnOrder`) for persistence and sharing.

## `DataTable` props

| Prop                     | Type                              | Default | Description                                                    |
| ------------------------ | --------------------------------- | ------- | -------------------------------------------------------------- |
| `data`                   | `TRow[]`                          | —       | Row data                                                       |
| `columns`                | `ColumnDef<TRow>[]`               | —       | Column definitions                                             |
| `rowKey`                 | `string`                          | —       | Vue `:key` only — not selection identity                       |
| `defaultVisibleColumns`  | `string[]`                        | all     | Initially visible column keys                                  |
| `labels`                 | `Partial<DataTableLabels>`        | English | UI string overrides                                            |
| `defaultPageSize`        | `number`                          | 0 (off) | Initial rows per page; 0 disables pagination                   |
| `defaultGroupsCollapsed` | `boolean`                         | `true`  | Whether newly-grouped groups start collapsed                   |
| `getRowId`               | `(row: TRow) => string \| number` | —       | Opt-in id-based selection identity (see "Row selection" above) |
| `selectable`             | `boolean`                         | `false` | Show checkbox column for row selection                         |
| `page`                   | `number`                          | —       | `v-model:page` — the table's current page                      |
| `searchQuery`            | `string`                          | —       | `v-model:search-query` — the global search box's value         |

All props accept `MaybeRefOrGetter` — you can pass refs, computed values, or plain values.

`page`/`searchQuery` are the two pieces of state `<DataTable>` otherwise has no way to read or set from outside at all (selection already has `selectionChange`/`onSelectionChange` — see "Row selection" above). Bind them with `v-model` for two-way sync — a parent can read the current page/search term, or jump/search programmatically:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { DataTable } from '@vates/data-table-vue'

const page = ref(1)
const searchQuery = ref('')
</script>

<template>
  <DataTable v-model:page="page" v-model:search-query="searchQuery" :data :columns />
</template>
```

Omit either prop entirely to just let `<DataTable>` manage its own state, as before.

## Events

| Event                | Payload                                           | Description                                                                                  |
| -------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `selectionChange`    | `TRow[]`                                          | Emitted when selection changes; payload is the selected rows present in the filtered dataset |
| `rowClick`           | `[row: TRow, event: MouseEvent \| KeyboardEvent]` | Emitted when a data row is clicked or activated via Enter                                    |
| `update:page`        | `number`                                          | Emitted whenever the current page changes — pair with `v-model:page`                         |
| `update:searchQuery` | `string`                                          | Emitted whenever the search query changes — pair with `v-model:search-query`                 |

## Column definition

This is a non-exhaustive illustrative subset — see core's [`ColumnDefBase`](../core/src/types.ts) for the full field list, including `parseDate`, `defaultSortDir`, `defaultValueSort`, and `searchable` below.

```ts
interface ColumnDef<TRow extends object> {
  key: string // unique column id; used for row[key] lookup unless `value` is set
  label: string
  type?: 'string' | 'number' | 'date' // controls filter UI: checklist / range / year-month-day tree; default: 'string'
  parseDate?: (value: string) => number // parses a `type: 'date'` column's raw value for sorting/filtering; default: `(v) => new Date(v).getTime()`
  width?: number
  value?: (row: TRow) => unknown // compute the cell value from the whole row (also covers aliasing)
  format?: (value: unknown, row: TRow) => string
  compare?: (a: unknown, b: unknown, dir: SortDir) => number // custom ordering for row sort, group order, and the filter checklist; see Custom sort order
  defaultSortDir?: SortDir // direction a fresh sort on this column starts at; default: 'asc'; see Header click sorting
  defaultValueSort?: ValueSort // starting sort order for this column's filter checklist/date tree; default: `{ by: 'alpha', dir: 'asc' }`
  sortable?: boolean // default: true
  filterable?: boolean // default: true
  groupable?: boolean // default: false
  searchable?: boolean // excludes this column from global search; default: true
  groupValue?: (value: unknown, row: TRow) => unknown // bucket a groupBy value into a coarser group key; see Grouped columns
  groupFormat?: (keyPart: string) => string // render a groupValue bucket key in the group header
  keepVisibleWhenGrouped?: boolean // default: false; keep this column's cells visible even while it's grouped
  multiMode?: 'and' | 'or' // match mode for array-valued columns; default: 'or'
  aggregate?: 'sum' | 'count' | 'avg' | 'min' | 'max' | ((rows: TRow[]) => unknown) // see Aggregation
}
```

For custom rendering, provide a `#cell-{key}` slot instead of a `render` function.

## `useTableState` composable

If you need to build a custom layout, use the composable directly:

`useTableState`'s return value is grouped by concern instead of one flat object — `table.sort`, `table.filter`, `table.group`, `table.selection`, `table.pagination`, `table.search`, and `table.columns` each hold their own refs and actions, with a handful of cross-cutting things (`processedData`, `pagedData`, `getViewState`, `clearAll`, etc.) staying top-level:

```ts
import { useTableState } from '@vates/data-table-vue'

const table = useTableState(data, columns, options) // data/columns/options can be refs, computed values, or plain values

const {
  processedData,
  pagedData,
  groupedData,
  labels: L,
  getViewState, // () => TableViewState — snapshot of sort/filter/group/page/etc. (not selection)
  setViewState, // (view: TableViewState) => void — apply a snapshot; fields absent from it reset to default
  clearAll,
} = table

const {
  visible: visibleCols,
  active: activeColumns,
  ordered: orderedColumns, // all columns (visible + hidden) sorted per columnOrder — for a custom columns panel
  toggleVisibility: toggleColVisibility,
  move: moveColumn, // (dragKey: string, targetKey: string) => void — drag-and-drop reordering
  moveBy: moveColumnBy, // (key: string, delta: number) => void — swap with the neighbor delta positions away
} = table.columns

const {
  entries: sorts,
  toggle: toggleSort, // append-or-cycle a column into the multi-sort; used by the Sort dropdown's "add" rows
  replace: replaceSort, // (key: string) => void — sort by this column alone, discarding other sorts; header plain-click
  appendOrToggle: appendOrToggleSort, // (key: string) => void — add/flip in place, never removes; header shift-click
  clear: clearSorts,
  icon: getSortIcon,
  index: getSortIndex,
} = table.sort

const {
  include: filters,
  ranges: rangeFilters,
  activeCount: activeFilterCount,
  valueMap: stringValueMap,
  cycleValue: cycleFilterValue,
  setRange: setRangeFilter,
  clearColumn: clearColumnFilter,
  clear: clearFilters,
} = table.filter

const {
  by: groupBy,
  collapsed: collapsedGroups,
  toggle: toggleGroup,
  toggleCollapse: toggleGroupCollapse,
  clear: clearGroups,
} = table.group

const {
  all: selection, // ShallowRef<Set<TRow>> — use selection.value.has(row) to check membership
  rows: selectedRows,
  toggle: toggleRowSelection, // (row: TRow) => void
  toggleAll: toggleSelectAll, // (rows: TRow[]) => void — selects all if any unselected, else deselects all
  clear: clearSelection, // () => void
} = table.selection

const { page, pageSize, numPages, setPage, setPageSize } = table.pagination
```

## View persistence & sharing

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vue/#persisted-table)

`getViewState()`/`setViewState()` capture and apply a serializable snapshot of sort, filters, groups, page, etc. — everything except selection, which is identity-based and not meaningful to persist or share. `usePersistence` wires this up to both `localStorage` and the URL from one options object:

```ts
import { useTableState, usePersistence } from '@vates/data-table-vue'

const table = useTableState(data, columns)
const { reset } = usePersistence(table, { storageKey: 'my-table-view', paramName: 'view' })
```

`usePersistence` combines `usePersistedView` (loads on mount, saves on every change) and `useUrlView` (loads from `?view=...` on mount and on back/forward navigation, writes back via `history.replaceState`) — both only act when their source actually has a view to apply, so a plain reload with no `view` param keeps the localStorage-restored view instead of resetting it. Its returned `reset()` puts the table back to its construction-time defaults and clears whatever was persisted:

```vue
<template>
  <button @click="reset">Reset</button>
</template>
```

Use `usePersistedView(table, storageKey)`/`useUrlView(table, { paramName? })`/`resetView(table, { storageKey?, paramName? })` directly instead if you only want one of the two (e.g. URL sharing with no `localStorage`) — pass the same `storageKey`/`paramName` to each, since `usePersistence` is just these three sharing one options object under the hood:

```vue
<script setup>
import { useTableState, usePersistedView, useUrlView, resetView } from '@vates/data-table-vue'

const table = useTableState(data, columns)
useUrlView(table) // reflected in ?view=... — reload the page or share the link
</script>

<template>
  <button @click="resetView(table)">Reset</button>
</template>
```

To persist a view somewhere else (e.g. a backend), call `getViewState()`/`setViewState(view)` directly — these composables work with any object shaped like `{ getViewState(), setViewState(view) }`, so `table` (or anything else with that shape) can be passed in.

`<DataTable>` builds its own `useTableState` internally, so these composables can't reach it — see `DataTableView` below for the built-in UI wired to a `useTableState` instance you own.

## `DataTableView` — the built-in UI, state you own

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vue/#persisted-table)

`<DataTable>` is `useTableState` + a render layer bundled together, with no way to reach the state from outside. `DataTableView` is that same render layer, taking a `useTableState` result as a prop instead of creating its own — so you get the identical built-in UI while keeping full external access to it (persistence, imperative selection control, or anything else `useTableState` returns):

```vue
<script setup lang="ts">
import { useTableState, usePersistence, DataTableView } from '@vates/data-table-vue'

const table = useTableState(employees, COLUMNS, {
  defaultVisibleColumns: DEFAULT_VISIBLE,
  defaultPageSize: 20,
})
usePersistence(table, { storageKey: 'employee-table-view', paramName: 'view' })
</script>

<template>
  <DataTableView :table="table" :data="employees" :columns="COLUMNS" row-key="id" />
</template>
```

`DataTableView` takes the same props as `<DataTable>` minus `defaultVisibleColumns`/`labels`/`defaultPageSize` (those only make sense at `useTableState` construction time) plus `table`, and supports the same `#cell-{key}`/`#filter-{key}`/`#group-{key}` scoped slots. In fact, `<DataTable>` is implemented as exactly this — a thin wrapper that calls `useTableState` and renders `<DataTableView :table="table" .../>`, forwarding its own slots straight through.

## i18n

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vue/#i18n)

Use a built-in locale or supply any `Partial<DataTableLabels>` overrides (shallow-merged over English defaults):

```ts
import { LABELS_FR } from '@vates/data-table-vue'
```

```vue
<DataTable :labels="LABELS_FR" ... />
```

Built-in locales: `LABELS_EN` (default), `LABELS_FR`, `LABELS_ES`, `LABELS_DE`, `LABELS_PT`.

## Theming

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vue/#theming)

All colors are CSS custom properties. Define them in your own stylesheet (typically on `:root`). Dark mode activates automatically when the OS preference is dark via `prefers-color-scheme: dark`, and can be forced with a `data-theme` attribute:

```css
/* in your global stylesheet */
:root {
  --color-background-primary: #ffffff;
  --color-background-secondary: #f7f6f3;
  --color-text-primary: #1a1916;
  --color-text-secondary: #6b6a66;
  /* ... other tokens ... */
}
@media (prefers-color-scheme: dark) {
  :root {
    --color-background-primary: #141413;
    --color-text-primary: #e8e7e4;
    /* ... */
  }
}
[data-theme='dark'] {
  /* same dark values */
}
[data-theme='light'] {
  /* same light values */
}
```

```ts
// Force dark / light / follow OS
document.documentElement.dataset.theme = 'dark'
document.documentElement.dataset.theme = 'light'
delete document.documentElement.dataset.theme
```

See the [vanilla README](../vanilla/README.md#theming) for the full token reference table.

## License

MIT
