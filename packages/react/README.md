# @vates/data-table-react

React adapter for [data-table](../../README.md) — a flexible, fully-typed data table with sorting, filtering, column visibility/reordering, and row grouping.

## Install

```bash
npm install @vates/data-table-react
```

Requires React ≥ 17.

## Usage

```tsx
import { DataTable, type ColumnDef } from '@vates/data-table-react'

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

export default function App() {
  return <DataTable data={employees} columns={COLUMNS} rowKey="id" />
}
```

## Custom rendering

▶ [Try it in the demo](https://vatesfr.github.io/data-table/react/#full-table)

Use the `render` prop on a column for custom cell content, and `renderFilterLabel` for custom filter checklist items.

```tsx
const COLUMNS: ColumnDef<Employee>[] = [
  {
    key: 'department',
    label: 'Department',
    type: 'string',
    groupable: true,
    render: (value, row) => <Badge label={String(value)} />,
    renderFilterLabel: (value) => <Badge label={value} />,
  },
]
```

`render` also applies to group header values, so grouped columns display with the same badge/visual as table cells.

## Multi-value (array) columns

▶ [Try it in the demo](https://vatesfr.github.io/data-table/react/#full-table)

A column whose cell value is an array — tags, genres, categories — is detected automatically, no flag required:

- The filter checklist lists each individual item instead of the stringified whole array (`"Action,RPG"` becomes separate `"Action"` and `"RPG"` entries), and a row matches if it contains any selected item (`multiMode: 'or'`, the default) or all of them (`multiMode: 'and'`).
- Grouping by an array column fans a row out into one group per item — a row tagged `['Action', 'RPG']` appears under both the "Action" and "RPG" groups. `render`/`format` receive the single item being grouped on, not the whole array.
- A row with an empty array (`tags: []`) is bucketed under a labeled placeholder — `(none)` by default, customizable via the `emptyValue` label — instead of a blank checklist entry or an unlabeled group.
- Cells without a custom `render`/`format` display the array joined with `, `.
- Every checklist item (array-valued columns and plain string columns alike) shows how many rows currently match it — helpful for scanning a high-cardinality column like `tags` before picking a value. The count is faceted: it reflects every other active filter, but not the checklist's own column, so selecting a value elsewhere narrows the counts shown here without a value's own selection state affecting its neighbors. A value with a count of 0 is dropped from the checklist entirely — unless it's already selected, in which case it stays listed so it can still be unticked.
- A sort-order button next to the search input cycles the checklist between alphabetical (A→Z / Z→A) and by-count (high→low / low→high) order — default is alphabetical ascending.

```tsx
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

▶ [Try it in the demo](https://vatesfr.github.io/data-table/react/#full-table)

`type: 'date'` columns get a Year › Month › Day checkbox tree in the filter dropdown instead of a checklist or numeric range. Check a year or month to select every date under it in one click, or drill into individual days; the search box and per-value row counts work the same as for string columns. The same sort-order button toggles the tree's chronological order (ascending/descending) instead — there's no by-count order for a tree of grouped branches. Values that don't parse as dates are grouped under the `emptyValue` label rather than dropped.

```tsx
{ key: 'joined', label: 'Joined', type: 'date' }
```

`renderFilterLabel` isn't applied to date columns — a tree branch (a year or month) has no single raw value to hand it, and even a day leaf can bundle more than one.

## Computed columns

▶ [Try it in the demo](https://vatesfr.github.io/data-table/react/#full-table)

A column doesn't need a matching property on `TRow` — set `value` to a function to compute the cell value from the whole row. Sorting, filtering, grouping, and aggregation all work off the computed value, same as a regular column.

```tsx
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

```tsx
{ key: 'employeeName', label: 'Name', value: (row) => row.name }
```

## Aggregation

▶ [Try it in the demo](https://vatesfr.github.io/data-table/react/#full-table)

Set `aggregate` on a column to show a computed value in a row below each group header — try grouping by Department in the demo. Built-in types: `'sum' | 'count' | 'avg' | 'min' | 'max'`; or supply a function for anything else:

```tsx
{ key: 'salary', label: 'Salary', type: 'number', aggregate: 'sum' }
{ key: 'score', label: 'Score', type: 'number', aggregate: (rows) => Math.max(...rows.map((r) => r.score)) }
```

The aggregate row only appears once grouping is active and only shows values for columns that define `aggregate`; it's always visible regardless of a group's collapsed state.

## Row selection

▶ [Try it in the demo](https://vatesfr.github.io/data-table/react/#row-selection)

Pass `selectable` to show a checkbox column. The header checkbox selects/deselects the full filtered dataset (all pages at once). Group header checkboxes select/deselect all rows in that group. Both support indeterminate state.

```tsx
const [selected, setSelected] = useState<Employee[]>([])

<DataTable
  data={employees}
  columns={COLUMNS}
  rowKey="id"
  selectable
  onSelectionChange={setSelected}
/>

{selected.length > 0 && <p>{selected.length} rows selected</p>}
```

`onSelectionChange` receives the array of currently selected rows that are present in the filtered dataset. Selection uses object identity (`Set<TRow>`), so it persists across sort/filter changes as long as row references are stable.

## Row click

▶ [Try it in the demo](https://vatesfr.github.io/data-table/react/#row-click)

Pass `onRowClick` to react to a data row being clicked — it receives the full row object and the native click event, no key lookup needed. Group header rows, the aggregate row, and the selection checkbox cell never trigger it.

```tsx
<DataTable
  data={employees}
  columns={COLUMNS}
  rowKey="id"
  onRowClick={(row, event) => console.log('clicked', row.name)}
/>
```

## Column reordering

▶ [Try it in the demo](https://vatesfr.github.io/data-table/react/#full-table)

Drag a column header to reorder it, or use the ▲▼ buttons next to each column in the Columns panel — both work out of the box, no extra props required. Order is tracked independently of visibility, so hiding and re-showing a column keeps its place. It's included in `getViewState()`/`setViewState()` (as `columnOrder`) for persistence and sharing.

## `DataTable` props

| Prop                     | Type                                                          | Default | Description                                  |
| ------------------------ | ------------------------------------------------------------- | ------- | -------------------------------------------- |
| `data`                   | `TRow[]`                                                      | —       | Row data                                     |
| `columns`                | `ColumnDef<TRow>[]`                                           | —       | Column definitions                           |
| `rowKey`                 | `keyof TRow & string`                                         | —       | Unique row identifier                        |
| `defaultVisibleColumns`  | `string[]`                                                    | all     | Initially visible column keys                |
| `labels`                 | `Partial<DataTableLabels>`                                    | English | UI string overrides                          |
| `defaultPageSize`        | `number`                                                      | 0 (off) | Initial rows per page; 0 disables pagination |
| `defaultGroupsCollapsed` | `boolean`                                                     | `true`  | Whether newly-grouped groups start collapsed |
| `selectable`             | `boolean`                                                     | `false` | Show checkbox column for row selection       |
| `onSelectionChange`      | `(rows: TRow[]) => void`                                      | —       | Called when selection changes                |
| `onRowClick`             | `(row: TRow, event: MouseEvent<HTMLTableRowElement>) => void` | —       | Called when a data row is clicked            |

## Column definition

```ts
interface ColumnDef<TRow extends object> {
  key: string // unique column id; used for row[key] lookup unless `value` is set
  label: string
  type?: 'string' | 'number' | 'date' // controls filter UI: checklist / range / year-month-day tree; default: 'string'
  width?: number
  value?: (row: TRow) => unknown // compute the cell value from the whole row (also covers aliasing)
  format?: (value: unknown, row: TRow) => string
  sortable?: boolean // default: true
  filterable?: boolean // default: true
  groupable?: boolean // default: false
  multiMode?: 'and' | 'or' // match mode for array-valued columns; default: 'or'
  aggregate?: 'sum' | 'count' | 'avg' | 'min' | 'max' | ((rows: TRow[]) => unknown) // see Aggregation
  render?: (value: unknown, row: TRow) => ReactNode
  renderFilterLabel?: (value: string) => ReactNode
}
```

Cell value resolution order: `render` → `format` → `String(value)`.

## `useTableState` hook

If you need to build a custom layout, use the hook directly:

```tsx
import { useTableState, type ColumnDef } from '@vates/data-table-react'

const {
  // State
  visibleCols,
  columnOrder,
  sorts,
  filters,
  rangeFilters,
  groupBy,
  collapsedGroups,
  defaultGroupsCollapsed,
  page,
  pageSize,
  selection, // Set<TRow> — use .has(row) to check membership
  // Derived
  processedData,
  pagedData,
  groupedData,
  activeColumns,
  orderedColumns, // all columns (visible + hidden) sorted per columnOrder — for a custom columns panel
  stringValueMap,
  activeFilterCount,
  numPages,
  selectedRows,
  L,
  // Actions
  toggleColVisibility,
  moveColumn, // (dragKey: string, targetKey: string) => void — drag-and-drop reordering
  moveColumnBy, // (key: string, delta: number) => void — swap with the neighbor delta positions away
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
  getViewState, // () => TableViewState — snapshot of sort/filter/group/page/etc. (not selection)
  setViewState, // (view: TableViewState) => void — apply a snapshot; fields absent from it reset to default
} = useTableState(
  data,
  columns,
  defaultVisibleColumns,
  labelOverrides,
  defaultPageSize,
  defaultGroupsCollapsed, // default true — pass false to start groups expanded
)
```

## View persistence & sharing

▶ [Try it in the demo](https://vatesfr.github.io/data-table/react/#persisted-table)

`getViewState()`/`setViewState()` capture and apply a serializable snapshot of sort, filters, groups, page, etc. — everything except selection, which is identity-based and not meaningful to persist or share. Two opt-in hooks wire this up to `localStorage` and the URL:

```tsx
import { useTableState, usePersistedView, useUrlView } from '@vates/data-table-react'

const table = useTableState(data, columns)
usePersistedView(table, 'my-table-view') // survives reloads
useUrlView(table) // reflected in ?view=... — reload the page or share the link
```

`usePersistedView(table, storageKey)` loads the view on mount and saves it on every change. `useUrlView(table, { paramName? })` loads from the URL on mount and on back/forward navigation, and writes back via `history.replaceState` (so sort/filter tweaks don't spam browser history). Both only act when their source actually has a view to apply — composed together, a plain reload with no `view` param keeps the localStorage-restored view instead of resetting it.

To persist a view somewhere else (e.g. a backend), call `getViewState()`/`setViewState(view)` directly — `usePersistedView`/`useUrlView` work with any object shaped like `{ getViewState(), setViewState(view) }`, so `table` (or anything else with that shape) can be passed in.

`resetView(table, { storageKey?, paramName? })` puts a table back to its construction-time defaults and clears whatever `usePersistedView`/`useUrlView` persisted for it — pass the same `storageKey`/`paramName` you gave those hooks (both optional, since you might only be using one of them):

```tsx
import { resetView } from '@vates/data-table-react'

;<button onClick={() => resetView(table, { storageKey: 'my-table-view' })}>Reset</button>
```

`<DataTable>` builds its own `useTableState` internally, so these hooks can't reach it — see `DataTableView` below for the built-in UI wired to a `useTableState` instance you own.

## `DataTableView` — the built-in UI, state you own

▶ [Try it in the demo](https://vatesfr.github.io/data-table/react/#persisted-table)

`<DataTable>` is `useTableState` + a render layer bundled together, with no way to reach the state from outside. `DataTableView` is that same render layer, taking a `useTableState` result as a prop instead of creating its own — so you get the identical built-in UI while keeping full external access to it (persistence, imperative selection control, or anything else `useTableState` returns):

```tsx
import { useTableState, usePersistedView, useUrlView, DataTableView } from '@vates/data-table-react'

function EmployeeTable() {
  const table = useTableState(employees, COLUMNS, DEFAULT_VISIBLE, undefined, 20)
  usePersistedView(table, 'employee-table-view')
  useUrlView(table)
  return <DataTableView table={table} data={employees} columns={COLUMNS} rowKey="id" />
}
```

`DataTableView` takes the same props as `<DataTable>` minus `defaultVisibleColumns`/`labels`/`defaultPageSize` (those only make sense at `useTableState` construction time) plus `table`. In fact, `<DataTable>` is implemented as exactly this — a thin wrapper that calls `useTableState` and renders `<DataTableView table={table} .../>`.

## i18n

▶ [Try it in the demo](https://vatesfr.github.io/data-table/react/#i18n)

Use a built-in locale or supply any `Partial<DataTableLabels>` overrides (shallow-merged over English defaults):

```tsx
import { LABELS_FR } from '@vates/data-table-react'

<DataTable labels={LABELS_FR} ... />
```

Built-in locales: `LABELS_EN` (default), `LABELS_FR`, `LABELS_ES`, `LABELS_DE`, `LABELS_PT`.

## Theming

▶ [Try it in the demo](https://vatesfr.github.io/data-table/react/#theming)

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

```tsx
// Force dark / light / follow OS
document.documentElement.dataset.theme = 'dark'
document.documentElement.dataset.theme = 'light'
delete document.documentElement.dataset.theme
```

See the [vanilla README](../vanilla/README.md#theming) for the full token reference table.

## License

MIT
