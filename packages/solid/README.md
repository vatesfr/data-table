# @vates/data-table-solid

[![npm](https://img.shields.io/npm/v/@vates/data-table-solid)](https://www.npmjs.com/package/@vates/data-table-solid)
[![node](https://img.shields.io/node/v/@vates/data-table-solid)](https://www.npmjs.com/package/@vates/data-table-solid)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@vates/data-table-solid)](https://bundlephobia.com/package/@vates/data-table-solid)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Solid.js adapter for [data-table](../../README.md) — a flexible, fully-typed data table with sorting, filtering, column visibility/reordering, and row grouping.

If you're not already using Solid, use [`@vates/data-table-vanilla`](../vanilla) instead — it wraps this package behind a plain `createDataTable(container, options)` API and bundles Solid internally, so it needs no framework installed.

## Install

```bash
npm install @vates/data-table-solid solid-js
```

`solid-js` is a peer dependency (`>=1.9.0`) — install it alongside this package rather than letting it be bundled, so the table shares your app's own reactive runtime. Two separate copies of `solid-js` in one page don't just cost bytes: Solid's dependency tracking is scoped to whichever module instance created a signal, so a computation running under a _different_ copy silently never sees updates to it.

## Usage

```tsx
import { createEffect } from 'solid-js'
import { createTableState, DataTableView, type ColumnDef } from '@vates/data-table-solid'

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

export default function EmployeeTable(props: { employees: Employee[] }) {
  // createTableState takes plain initial values (same shape as react/vue's useTableState),
  // then owns `data`/`columns` as its own signals via `setData`/`setColumns` — sync a reactive
  // prop into it with a plain createEffect, the same pattern @vates/data-table-vanilla's own
  // createDataTable wrapper uses internally.
  const table = createTableState(props.employees, COLUMNS)
  createEffect(() => table.setData(props.employees))

  return <DataTableView table={table} data={table.data()} columns={table.columns()} rowKey="id" />
}
```

CSS is injected automatically into `<head>` the first time a `<DataTableView>` mounts — there's nothing extra to import. This includes all color tokens and dark-mode overrides that activate automatically via `prefers-color-scheme: dark`; see the [theming section of the vanilla README](../vanilla#theming) for the full token table and how to override it (the CSS itself is shared between both packages).

## `createTableState`/`DataTableView`, and reaching state a wrapper can't expose

`createTableState(data, columns, options?)` mirrors `packages/react`/`packages/vue`'s own `useTableState` in state shape and action names, and returns a `TableState<TRow>` of signals/derived values/actions — but unlike those two (which get fresh `data`/`columns` arguments on every re-invocation), this one owns `data`/`columns` as its own signals, with `setData`/`setColumns` setters to update them (see the `createEffect` above). `<DataTableView table={...} data={...} columns={...} .../>` is the render layer, taking that `TableState` as a prop rather than building one itself — the same split React/Vue use for their own `DataTableView` — so external code (view persistence, an imperative selection API, etc.) can hold onto `table` and act on it directly:

```tsx
const table = createTableState(data, columns)
return <DataTableView table={table} data={table.data()} columns={table.columns()} />
```

## View persistence & sharing

There's no `usePersistedView`/`useUrlView`-style helper in this package yet (React/Vue each have one) — `getViewState()`/`setViewState()` capture and apply a serializable snapshot of sort, filters, groups, page, etc. (everything except selection, which is identity-based and not meaningful to persist or share), and a plain `createEffect` reading `table.getViewState()` covers the same ground in a couple of lines:

```tsx
import { createEffect } from 'solid-js'
import { decodeViewState, encodeViewState } from '@vates/data-table-core'

const table = createTableState(data, columns)

// Restore once on mount...
const stored = localStorage.getItem('my-table-view')
if (stored) table.setViewState(decodeViewState(stored) ?? {})

// ...and save on every subsequent change.
createEffect(() => {
  localStorage.setItem('my-table-view', encodeViewState(table.getViewState()))
})
```

## Selection, row click, keyboard navigation, view persistence

Same model as every other adapter — see the [root README](../../README.md#features) and [CLAUDE.md](../../CLAUDE.md) for the full behavior (selection is tracked by object identity, not `rowKey`; shift-click/shift-arrow range selection; roving-tabindex keyboard nav; `getViewState()`/`setViewState()` for persistence/sharing). `TableState<TRow>` exposes the same actions/derived values React's and Vue's `useTableState` do — `selection`, `selectedRows`, `toggleRowSelection`, `toggleSelectAll`, `clearSelection`, `sorts`, `filters`, `groupBy`, `page`, `pageSize`, and so on, all as Solid signals/accessors instead of `useState`/`ref`.

## License

MIT
