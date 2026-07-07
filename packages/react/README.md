# @vates/flexi-table-react

React adapter for [flexi-table](../../README.md) — a flexible, fully-typed data table with sorting, filtering, column visibility, and row grouping.

## Install

```bash
npm install @vates/flexi-table-react
```

Requires React ≥ 17.

## Usage

```tsx
import { DataTable, type ColumnDef } from '@vates/flexi-table-react'

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
  key: keyof TRow & string
  label: string
  type?: 'string' | 'number' | 'date' // controls filter UI; default: 'string'
  width?: number
  format?: (value: unknown, row: TRow) => string
  sortable?: boolean // default: true
  filterable?: boolean // default: true
  groupable?: boolean // default: false
  render?: (value: unknown, row: TRow) => ReactNode
  renderFilterLabel?: (value: string) => ReactNode
}
```

Cell value resolution order: `render` → `format` → `String(value)`.

## `useTableState` hook

If you need to build a custom layout, use the hook directly:

```tsx
import { useTableState, type ColumnDef } from '@vates/flexi-table-react'

const {
  // State
  visibleCols,
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
} = useTableState(data, columns, defaultVisibleColumns, labelOverrides, defaultPageSize)
```

## i18n

Use a built-in locale or supply any `Partial<DataTableLabels>` overrides (shallow-merged over English defaults):

```tsx
import { LABELS_FR } from '@vates/flexi-table-react'

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
