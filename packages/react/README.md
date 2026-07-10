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

A column whose cell value is an array — tags, genres, categories — is detected automatically, no flag required:

- The filter checklist lists each individual item instead of the stringified whole array (`"Action,RPG"` becomes separate `"Action"` and `"RPG"` entries), and a row matches if it contains any selected item (`multiMode: 'or'`, the default) or all of them (`multiMode: 'and'`).
- Grouping by an array column fans a row out into one group per item — a row tagged `['Action', 'RPG']` appears under both the "Action" and "RPG" groups. `render`/`format` receive the single item being grouped on, not the whole array.
- A row with an empty array (`tags: []`) is bucketed under a labeled placeholder — `(none)` by default, customizable via the `emptyValue` label — instead of a blank checklist entry or an unlabeled group.
- Cells without a custom `render`/`format` display the array joined with `, `.

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

## Computed columns

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

## Row selection

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

## Column reordering

Drag a column header to reorder it, or use the ▲▼ buttons next to each column in the Columns panel — both work out of the box, no extra props required. Order is tracked independently of visibility, so hiding and re-showing a column keeps its place. It's included in `getViewState()`/`setViewState()` (as `columnOrder`) for persistence and sharing.

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
| `onSelectionChange`     | `(rows: TRow[]) => void`   | —       | Called when selection changes                |

## Column definition

```ts
interface ColumnDef<TRow extends object> {
  key: string // unique column id; used for row[key] lookup unless `value` is set
  label: string
  type?: 'string' | 'number' | 'date' // controls filter UI; default: 'string'
  width?: number
  value?: (row: TRow) => unknown // compute the cell value from the whole row (also covers aliasing)
  format?: (value: unknown, row: TRow) => string
  sortable?: boolean // default: true
  filterable?: boolean // default: true
  groupable?: boolean // default: false
  multiMode?: 'and' | 'or' // match mode for array-valued columns; default: 'or'
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
} = useTableState(data, columns, defaultVisibleColumns, labelOverrides, defaultPageSize)
```

## View persistence & sharing

`getViewState()`/`setViewState()` capture and apply a serializable snapshot of sort, filters, groups, page, etc. — everything except selection, which is identity-based and not meaningful to persist or share. Two opt-in hooks wire this up to `localStorage` and the URL:

```tsx
import { useTableState, usePersistedView, useUrlView } from '@vates/data-table-react'

const table = useTableState(data, columns)
usePersistedView(table, 'my-table-view') // survives reloads
useUrlView(table) // reflected in ?view=... — reload the page or share the link
```

`usePersistedView(table, storageKey)` loads the view on mount and saves it on every change. `useUrlView(table, { paramName? })` loads from the URL on mount and on back/forward navigation, and writes back via `history.replaceState` (so sort/filter tweaks don't spam browser history). Both only act when their source actually has a view to apply — composed together, a plain reload with no `view` param keeps the localStorage-restored view instead of resetting it.

To persist a view somewhere else (e.g. a backend), call `getViewState()`/`setViewState(view)` directly — `usePersistedView`/`useUrlView` work with any object shaped like `{ getViewState(), setViewState(view) }`, so `table` (or anything else with that shape) can be passed in.

## i18n

Use a built-in locale or supply any `Partial<DataTableLabels>` overrides (shallow-merged over English defaults):

```tsx
import { LABELS_FR } from '@vates/data-table-react'

<DataTable labels={LABELS_FR} ... />
```

Built-in locales: `LABELS_EN` (default), `LABELS_FR`, `LABELS_ES`, `LABELS_DE`, `LABELS_PT`.

## Theming

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
