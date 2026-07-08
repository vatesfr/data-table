# data-table

[![CI](https://github.com/vatesfr/data-table/actions/workflows/ci.yml/badge.svg)](https://github.com/vatesfr/data-table/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@vates/data-table-react?label=react)](https://www.npmjs.com/package/@vates/data-table-react)
[![npm](https://img.shields.io/npm/v/@vates/data-table-vue?label=vue)](https://www.npmjs.com/package/@vates/data-table-vue)
[![npm](https://img.shields.io/npm/v/@vates/data-table-vanilla?label=vanilla)](https://www.npmjs.com/package/@vates/data-table-vanilla)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A flexible, fully-typed data table for React, Vue 3, and vanilla JS — with sorting, filtering, column visibility, and row grouping built in.

## Live demo

[React demo](https://vatesfr.github.io/data-table/react/) · [Vue demo](https://vatesfr.github.io/data-table/vue/) · [Vanilla demo](https://vatesfr.github.io/data-table/vanilla/)

## Packages

| Package                                           | Description                        |
| ------------------------------------------------- | ---------------------------------- |
| [`@vates/data-table-react`](./packages/react)     | React component and hook           |
| [`@vates/data-table-vue`](./packages/vue)         | Vue 3 component and composable     |
| [`@vates/data-table-vanilla`](./packages/vanilla) | Vanilla JS, no framework required  |
| [`@vates/data-table-core`](./packages/core)       | Framework-agnostic logic (pure TS) |

## Features

- Multi-column sort
- Value checklist filters and numeric range filters
- Column visibility toggle
- Row grouping (grouped column hides from the table automatically)
- Row selection with checkboxes — select all (across pages), group selection, indeterminate state
- Client-side pagination
- i18n via a `labels` prop — defaults to English, with built-in locales for FR, ES, DE, PT
- Custom cell rendering via render props (React), scoped slots (Vue), or `format` string functions (vanilla)
- Fully typed with TypeScript generics (`TRow extends object`)

## Quick start

### React

```bash
npm install @vates/data-table-react
```

```tsx
import { DataTable, type ColumnDef } from '@vates/data-table-react'

interface User {
  id: number
  name: string
  role: string
  salary: number
}

const COLUMNS: ColumnDef<User>[] = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'role', label: 'Role', type: 'string', groupable: true },
  {
    key: 'salary',
    label: 'Salary',
    type: 'number',
    format: (v) => Number(v).toLocaleString() + ' €',
  },
]

export default function App() {
  return <DataTable data={users} columns={COLUMNS} rowKey="id" />
}
```

Custom cell rendering with render props:

```tsx
{ key: 'role', label: 'Role', type: 'string',
  render: (value, row) => <Badge label={String(value)} />,
  renderFilterLabel: value => <Badge label={value} /> }
```

### Vue

```bash
npm install @vates/data-table-vue
```

```vue
<script setup lang="ts">
import { DataTable, type ColumnDef } from '@vates/data-table-vue'

interface User {
  id: number
  name: string
  role: string
  salary: number
}

const COLUMNS: ColumnDef<User>[] = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'role', label: 'Role', type: 'string', groupable: true },
  {
    key: 'salary',
    label: 'Salary',
    type: 'number',
    format: (v) => Number(v).toLocaleString() + ' €',
  },
]
</script>

<template>
  <DataTable :data="users" :columns="COLUMNS" row-key="id">
    <template #cell-role="{ value }">
      <Badge :label="String(value)" />
    </template>
    <template #filter-role="{ value }">
      <Badge :label="value" />
    </template>
    <template #group-role="{ value }">
      <Badge :label="String(value)" />
    </template>
  </DataTable>
</template>
```

### Vanilla JS

```bash
npm install @vates/data-table-vanilla
```

```ts
import { createDataTable, type ColumnDef } from '@vates/data-table-vanilla'

const COLUMNS: ColumnDef<User>[] = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'role', label: 'Role', type: 'string', groupable: true },
  {
    key: 'salary',
    label: 'Salary',
    type: 'number',
    format: (v) => Number(v).toLocaleString() + ' €',
  },
]

const table = createDataTable(document.getElementById('table')!, {
  data: users,
  columns: COLUMNS,
  rowKey: 'id',
})

// Update later
table.setData(newUsers)
table.destroy()
```

CSS is injected automatically into `<head>`. Cell output is string-only — use `format` to control rendering.

## i18n

All UI strings are in English by default. Use a built-in locale or supply any overrides via the `labels` prop:

```tsx
import { LABELS_FR } from '@vates/data-table-react' // or -vue or -vanilla

<DataTable labels={LABELS_FR} ... />
```

Built-in locales: `LABELS_EN` (default), `LABELS_FR`, `LABELS_ES`, `LABELS_DE`, `LABELS_PT`.

You can also pass a `Partial<DataTableLabels>` to override individual strings — it is shallow-merged over the default English labels.

## Theming

All colors are CSS custom properties (`--color-background-primary`, `--color-text-primary`, etc.). Dark mode activates automatically via `prefers-color-scheme: dark` and can be forced with `data-theme="dark"` or `data-theme="light"` on any ancestor element.

**Vanilla** — tokens and dark-mode rules are injected automatically. No setup required.

**React / Vue** — define the tokens in your own global stylesheet. See the [vanilla README](./packages/vanilla/README.md#theming) for the full token list and default values.

```js
// Force dark / light / follow OS preference
document.documentElement.dataset.theme = 'dark'
document.documentElement.dataset.theme = 'light'
delete document.documentElement.dataset.theme
```

## Column definition

```ts
interface ColumnDefBase<TRow extends object> {
  key: string // unique column id; used for row[key] lookup unless `value` is set
  label: string
  type?: 'string' | 'number' | 'date' // controls filter UI; default: 'string'
  width?: number
  value?: (row: TRow) => unknown // compute the cell value from the whole row (also covers aliasing)
  format?: (value: unknown, row: TRow) => string // plain-string formatter (both adapters)
  sortable?: boolean // default: true
  filterable?: boolean // default: true
  groupable?: boolean // default: false
  multiMode?: 'and' | 'or' // match mode for array-valued columns in the filter checklist; default: 'or'
}
```

React extends this with `render?` and `renderFilterLabel?`. Vue uses scoped slots instead.

### Computed columns

A column doesn't need a matching property on `TRow` — set `value` to a function to compute the cell value from the whole row, or to a string to read a different property than `key`. Sorting, filtering, grouping, and aggregation all work off the resolved value, same as a regular column:

```ts
{ key: 'total', label: 'Total Comp', type: 'number', value: (row) => row.salary + row.bonus, aggregate: 'sum' }
```

### Array-valued (multi-value) columns

A column whose cell value is an array — tags, genres, categories — is detected automatically, no
flag required:

- The filter checklist lists each individual item instead of the stringified whole array, and a
  row matches if it contains any selected item (`multiMode: 'or'`, the default) or all of them
  (`multiMode: 'and'`).
- Grouping by an array column fans a row out into one group per item — a row tagged
  `['Action', 'RPG']` appears under both the "Action" and "RPG" groups.
- A row with an empty array (`tags: []`) is bucketed under a labeled placeholder — `(none)` by
  default, customizable via the `emptyValue` label — instead of a blank checklist entry or an
  unlabeled group.
- Cells without a custom `format`/`render` display the array joined with `, `.

```ts
{ key: 'tags', label: 'Tags' } // tags: string[] — no extra config needed
```

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
