# @vates/flexi-table-vanilla

Vanilla JS adapter for [flexi-table](../../README.md) — a flexible, fully-typed data table with sorting, filtering, column visibility, and row grouping. No framework required.

## Install

```bash
npm install @vates/flexi-table-vanilla
```

## Usage

```ts
import { createFlexiTable, type ColumnDef } from '@vates/flexi-table-vanilla'

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

const table = createFlexiTable(document.getElementById('table')!, {
  data: employees,
  columns: COLUMNS,
  rowKey: 'id',
})

// Update data or columns later
table.setData(newEmployees)
table.setColumns(newColumns)

// Remove the table and all event listeners
table.destroy()
```

CSS is injected automatically into `<head>` on the first `createFlexiTable` call. This includes all color tokens and dark-mode overrides that activate automatically via `prefers-color-scheme: dark`. The injected `<style>` tag is placed before any existing `<head>` children, so a stylesheet you define yourself (see [Theming](#theming)) always wins the cascade regardless of import order.

## Theming

All colors are CSS custom properties. Dark mode activates automatically when the OS preference is dark. You can force a theme by setting `data-theme` on any ancestor element (typically `<html>`):

```js
document.documentElement.dataset.theme = 'dark' // force dark
document.documentElement.dataset.theme = 'light' // force light
delete document.documentElement.dataset.theme // follow OS (default)
```

To override individual tokens, define the custom property in your own stylesheet:

```css
:root {
  --color-background-primary: #0f0f0f;
  --color-text-primary: #f5f5f5;
}
```

| Token                          | Light     | Dark      |
| ------------------------------ | --------- | --------- |
| `--color-background-primary`   | `#ffffff` | `#141413` |
| `--color-background-secondary` | `#f7f6f3` | `#1e1d1b` |
| `--color-background-info`      | `#e6f1fb` | `#0d2640` |
| `--color-background-warning`   | `#faeeda` | `#2a1900` |
| `--color-text-primary`         | `#1a1916` | `#e8e7e4` |
| `--color-text-secondary`       | `#6b6a66` | `#9b9a96` |
| `--color-text-tertiary`        | `#9b9a96` | `#6b6a66` |
| `--color-text-info`            | `#185fa5` | `#5b9fe0` |
| `--color-text-warning`         | `#854f0b` | `#e8a040` |
| `--color-border-secondary`     | `#dddcd8` | `#333230` |
| `--color-border-tertiary`      | `#eeedea` | `#252422` |
| `--color-border-info`          | `#b8d6f5` | `#1a4070` |
| `--color-border-warning`       | `#f0d4a8` | `#4a2c00` |

## Cell customization

Cell output is string-only. Use `col.format(value)` to control what is rendered:

```ts
{ key: 'status', label: 'Status', format: (v) => v === 1 ? 'Active' : 'Inactive' }
```

For richer DOM output (icons, interactive elements), post-process the container after `setData`.

## Row selection

Pass `selectable` to show a checkbox column. The header checkbox selects/deselects the full filtered dataset (all pages at once). Group header checkboxes select/deselect all rows in that group. Both support indeterminate state.

```ts
const table = createFlexiTable(container, {
  data: employees,
  columns: COLUMNS,
  rowKey: 'id',
  selectable: true,
  onSelectionChange: (rows) => console.log(rows.length, 'selected'),
})
```

Selection uses object identity, so it persists across sort/filter changes as long as row references are stable.

## Options

| Option                  | Type                       | Default | Description                                  |
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
  format?: (value: unknown) => string
  sortable?: boolean // default: true
  filterable?: boolean // default: true
  groupable?: boolean // default: false
}
```

## Instance methods

| Method                                | Description                                        |
| ------------------------------------- | -------------------------------------------------- |
| `setData(rows: TRow[])`               | Replace the data and re-render                     |
| `setColumns(cols: ColumnDef<TRow>[])` | Replace the column definitions and re-render       |
| `destroy()`                           | Remove all event listeners and clear the container |

## i18n

Use a built-in locale or supply any `Partial<DataTableLabels>` overrides (shallow-merged over English defaults):

```ts
import { LABELS_FR } from '@vates/flexi-table-vanilla'

createFlexiTable(container, { data, columns, labels: LABELS_FR })
```

Built-in locales: `LABELS_EN` (default), `LABELS_FR`, `LABELS_ES`, `LABELS_DE`, `LABELS_PT`.

## License

MIT
