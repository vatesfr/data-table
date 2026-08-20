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
import { DataTable, type ColumnDef } from '@vates/data-table-solid'

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
  return <DataTable data={props.employees} columns={COLUMNS} rowKey="id" />
}
```

`data`/`columns` are tracked reactively — `props.employees` changing later is all it takes, no `createEffect` needed. CSS is injected automatically into `<head>` the first time the table mounts — there's nothing extra to import. This includes all color tokens and dark-mode overrides that activate automatically via `prefers-color-scheme: dark`; see the [theming section of the vanilla README](../vanilla#theming) for the full token table and how to override it (the CSS itself is shared between both packages).

▶ [Try it in the demo](https://vatesfr.github.io/data-table/solid/#full-table)

## `createTableState`/`DataTableView`, and reaching state `<DataTable>` can't expose

`<DataTable>` covers the common case, but it never hands back the underlying `TableState` — so it can't be used for view persistence, an imperative selection API, or anything else that needs to act on the table from outside. For that, build the two pieces `<DataTable>` itself is made of directly:

- **`createTableState(data, columns, options?)`** mirrors `packages/react`/`packages/vue`'s own `useTableState` in state shape and action names, and returns a `TableState<TRow>` of signals/derived values/actions — but unlike those two (which get fresh `data`/`columns` arguments on every re-invocation), this one owns `data`/`columns` as its own signals, with `setData`/`setColumns` setters to update them. `data`/`columns` each accept a plain array (a one-time initial value, exactly like `packages/vanilla`'s own `createDataTable`) _or_ a Solid `Accessor` — pass one and it's tracked reactively for the table's whole lifetime, with no `createEffect` to write yourself (this is what `<DataTable>` itself is built on).
- **`<DataTableView table={...} data={...} columns={...} .../>`** is the render layer, taking that `TableState` as a prop rather than building one itself — the same split React/Vue use for their own `DataTableView`.

```tsx
const table = createTableState(
  () => props.data,
  () => props.columns,
)

return <DataTableView table={table} data={table.data()} columns={table.columns()} />
```

▶ [Try it in the demo](https://vatesfr.github.io/data-table/solid/#custom-layout)

## View persistence & sharing

▶ [Try it in the demo](https://vatesfr.github.io/data-table/solid/#persisted-table)

`getViewState()`/`setViewState()` capture and apply a serializable snapshot of sort, filters, groups, page, etc. — everything except selection, which is identity-based and not meaningful to persist or share. Opt-in helpers wire this up to `localStorage` and the URL, matching React/Vue's own:

```tsx
import { createTableState, usePersistence } from '@vates/data-table-solid'

const table = createTableState(data, columns)
const { reset } = usePersistence(table, { storageKey: 'my-table-view', paramName: 'view' })
```

`usePersistence` combines `usePersistedView` (loads on mount, saves on every change) and `useUrlView` (loads from `?view=...` on mount and on back/forward navigation, writes back via `history.replaceState`) behind one options object, so `storageKey`/`paramName` are written down once instead of separately at each call site. Its returned `reset()` puts the table back to its construction-time defaults and clears whatever was persisted — equivalent to calling `resetView(table, { storageKey: 'my-table-view', paramName: 'view' })` yourself. Use `usePersistedView`/`useUrlView`/`resetView` directly instead if you only want one of the two (e.g. URL sharing with no `localStorage`).

To persist a view somewhere else (e.g. a backend), call `getViewState()`/`setViewState(view)` directly — these helpers work with any object shaped like `{ getViewState(), setViewState(view) }`.

`<DataTable>` builds its own `createTableState` internally, so these helpers can't reach it — see the `createTableState`/`DataTableView` section above for the split that lets you own the state yourself.

## Selection, row click, keyboard navigation, view persistence

Same model as every other adapter — see the [root README](../../README.md#features) and [CLAUDE.md](../../CLAUDE.md) for the full behavior (selection is tracked by object identity, not `rowKey`; shift-click/shift-arrow range selection; roving-tabindex keyboard nav; `getViewState()`/`setViewState()` for persistence/sharing). `TableState<TRow>` exposes the same actions/derived values React's and Vue's `useTableState` do — `selection`, `selectedRows`, `toggleRowSelection`, `toggleSelectAll`, `clearSelection`, `sorts`, `filters`, `groupBy`, `page`, `pageSize`, and so on, all as Solid signals/accessors instead of `useState`/`ref`. `<DataTable>` doesn't expose any of that directly (see above) — pass `selectable` to turn selection on, and `onSelectionChange` to observe it, the same two props `@vates/data-table-vanilla`'s own `createDataTable` accepts.

▶ [Try it in the demo](https://vatesfr.github.io/data-table/solid/#row-selection)

## License

MIT
