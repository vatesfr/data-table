# flexi-table

[![CI](https://github.com/vatesfr/flexi-table/actions/workflows/ci.yml/badge.svg)](https://github.com/vatesfr/flexi-table/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@vates/flexi-table-react?label=react)](https://www.npmjs.com/package/@vates/flexi-table-react)
[![npm](https://img.shields.io/npm/v/@vates/flexi-table-vue?label=vue)](https://www.npmjs.com/package/@vates/flexi-table-vue)
[![npm](https://img.shields.io/npm/v/@vates/flexi-table-vanilla?label=vanilla)](https://www.npmjs.com/package/@vates/flexi-table-vanilla)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A flexible, fully-typed data table for React, Vue 3, and vanilla JS — with sorting, filtering, column visibility, and row grouping built in.

## Live demo

[React demo](https://vatesfr.github.io/flexi-table/react/) · [Vue demo](https://vatesfr.github.io/flexi-table/vue/) · [Vanilla demo](https://vatesfr.github.io/flexi-table/vanilla/)

## Packages

| Package                                            | Description                        |
| -------------------------------------------------- | ---------------------------------- |
| [`@vates/flexi-table-react`](./packages/react)     | React component and hook           |
| [`@vates/flexi-table-vue`](./packages/vue)         | Vue 3 component and composable     |
| [`@vates/flexi-table-vanilla`](./packages/vanilla) | Vanilla JS, no framework required  |
| [`@vates/flexi-table-core`](./packages/core)       | Framework-agnostic logic (pure TS) |

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
npm install @vates/flexi-table-react
```

```tsx
import { DataTable, type ColumnDef } from '@vates/flexi-table-react'

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
npm install @vates/flexi-table-vue
```

```vue
<script setup lang="ts">
import { DataTable, type ColumnDef } from '@vates/flexi-table-vue'

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
npm install @vates/flexi-table-vanilla
```

```ts
import { createFlexiTable, type ColumnDef } from '@vates/flexi-table-vanilla'

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

const table = createFlexiTable(document.getElementById('table')!, {
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
import { LABELS_FR } from '@vates/flexi-table-react' // or -vue or -vanilla

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
  key: keyof TRow & string // must be a key of TRow
  label: string
  type?: 'string' | 'number' | 'date' // controls filter UI; default: 'string'
  width?: number
  format?: (value: unknown, row: TRow) => string // plain-string formatter (both adapters)
  sortable?: boolean // default: true
  filterable?: boolean // default: true
  groupable?: boolean // default: false
  multiMode?: 'and' | 'or' // match mode for array-valued columns in the filter checklist; default: 'or'
}
```

React extends this with `render?` and `renderFilterLabel?`. Vue uses scoped slots instead.

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
