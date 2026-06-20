# flexi-table

A flexible, fully-typed data table for React and Vue 3 — with sorting, filtering, column visibility, and row grouping built in.

## Live demo

[React demo](https://vatesfr.github.io/flexi-table/react/) · [Vue demo](https://vatesfr.github.io/flexi-table/vue/)

## Packages

| Package                                        | Description                        |
| ---------------------------------------------- | ---------------------------------- |
| [`@vates/flexi-table-react`](./packages/react) | React component and hook           |
| [`@vates/flexi-table-vue`](./packages/vue)     | Vue 3 component and composable     |
| [`@vates/flexi-table-core`](./packages/core)   | Framework-agnostic logic (pure TS) |

## Features

- Multi-column sort
- Value checklist filters and numeric range filters
- Column visibility toggle
- Row grouping (grouped column hides from the table automatically)
- Row selection with checkboxes — select all (across pages), group selection, indeterminate state
- Client-side pagination
- i18n via a `labels` prop — defaults to English, with built-in locales for FR, ES, DE, PT
- Custom cell rendering via render props (React) or scoped slots (Vue)
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

## i18n

All UI strings are in English by default. Use a built-in locale or supply any overrides via the `labels` prop:

```tsx
import { LABELS_FR } from '@vates/flexi-table-core'

<DataTable labels={LABELS_FR} ... />
```

Built-in locales: `LABELS_EN` (default), `LABELS_FR`, `LABELS_ES`, `LABELS_DE`, `LABELS_PT`.

You can also pass a `Partial<DataTableLabels>` to override individual strings — it is shallow-merged over the default English labels.

## Column definition

```ts
interface ColumnDefBase<TRow extends object> {
  key: keyof TRow & string // must be a key of TRow
  label: string
  type?: 'string' | 'number' | 'date' // controls filter UI; default: 'string'
  width?: number
  format?: (value: unknown) => string // plain-string formatter (both adapters)
  sortable?: boolean // default: true
  filterable?: boolean // default: true
  groupable?: boolean // default: false
}
```

React extends this with `render?` and `renderFilterLabel?`. Vue uses scoped slots instead.

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
