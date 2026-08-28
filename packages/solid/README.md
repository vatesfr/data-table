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

- **`createTableState(data, columns, options?)`** mirrors `packages/react`/`packages/vue`'s own `useTableState` in internal state/action logic, and returns a `TableState<TRow>` — but namespaced by concern (`table.sort.*`, `table.filter.*`, `table.group.*`, `table.selection.*`, `table.pagination.*`, `table.search.*`, `table.columns.*`, plus a handful of top-level entries like `processedData`/`pagedData`/`getViewState`) rather than the flat ~45-field shape react/vue still return — see [CLAUDE.md](../../CLAUDE.md)'s "Namespaced TableState" for the full design. Unlike those two (which get fresh `data`/`columns` arguments on every re-invocation), this one owns `data`/`columns` as its own signals, with `setData`/`columns.set` setters to update them. `data`/`columns` each accept a plain array (a one-time initial value, exactly like `packages/vanilla`'s own `createDataTable`) _or_ a Solid `Accessor` — pass one and it's tracked reactively for the table's whole lifetime, with no `createEffect` to write yourself (this is what `<DataTable>` itself is built on).

  The 3rd `options` argument accepts either a plain `CreateTableStateOptions` object or an `Accessor` returning one — unlike `data`/`columns`, individual option fields can't each independently be "value or Accessor" (`getRowId` is itself a function, indistinguishable at runtime from an Accessor returning one), so reactivity is lifted to the whole options object instead. Passing an Accessor keeps `labels`/`defaultGroupsCollapsed`/`getRowId` live (a later change takes effect immediately, no need to recreate the table); `initialViewState` — construction-time defaults for columns/sort/filters/grouping/page/search, also what `resetView` restores — stays seed-only either way.

  Two fields on `TableState` exist only here, not on React/Vue's: `table.columns.list`/`table.columns.set` (the raw column signal/setter — React/Vue never had this on `TableState` at all, since they get fresh `columns` as a constructor argument instead) and `table.selection.setAll` (replaces the selection outright by reference; mainly exists to back `@vates/data-table-vanilla`'s imperative `setSelection(rows)`). `table.labels` is also the one field that differs in kind from React/Vue: it's a `createMemo`, called as `table.labels()`, not a plain object — it has to react to a changed `labels` option itself.

```tsx
const table = createTableState(data, columns)
table.sort.toggle('score') // was table.toggleSort('score')
table.filter.cycleValue('dept', 'Eng') // was table.cycleFilterValue('dept', 'Eng')
table.selection.toggle(row) // was table.toggleRowSelection(row)
table.pagination.setPage(2) // was table.setPage(2)
```

- **`<DataTableView table={...} data={...} columns={...} .../>`** is the render layer, taking that `TableState` as a prop rather than building one itself — the same split React/Vue use for their own `DataTableView`.

```tsx
const table = createTableState(
  () => props.data,
  () => props.columns,
)

return <DataTableView table={table} />
```

`DataTableViewProps` only takes `table` (plus `rowKey`/`selectable`/`onRowClick`) — no separate `data`/`columns` props, since `table.data()`/`table.columns.list()` already are that value.

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

Same model as every other adapter — see the [root README](../../README.md#features) and [CLAUDE.md](../../CLAUDE.md) for the full behavior (selection is tracked by object identity, not `rowKey`; shift-click/shift-arrow range selection; roving-tabindex keyboard nav; `getViewState()`/`setViewState()` for persistence/sharing). `TableState<TRow>` exposes the same actions/derived values React's and Vue's `useTableState` do, namespaced by concern (see `createTableState`'s own entry above) — `table.selection.all`/`.rows`/`.toggle`/`.toggleAll`/`.clear`, `table.sort.entries`, `table.filter.include`, `table.group.by`, `table.pagination.page`/`.pageSize`, and so on, all as Solid signals/accessors instead of `useState`/`ref`. `<DataTable>` doesn't expose any of that directly (see above) — pass `selectable` to turn selection on, and `onSelectionChange` to observe it, the same two props `@vates/data-table-vanilla`'s own `createDataTable` accepts.

Object-identity selection silently drops on a `setData`/refetch that produces new row objects, since a `Set` can only ever match by reference. Pass `getRowId` (to `createTableState`'s options, or `<DataTable>`'s own prop) to opt into id-based matching instead — a selected id is remapped to its fresh object reference whenever `data` changes, and dropped if the id no longer exists:

```tsx
const table = createTableState(data, columns, { getRowId: (row) => row.id })
```

▶ [Try it in the demo](https://vatesfr.github.io/data-table/solid/#row-selection)

## Known limitations

Full keyboard-nav and virtualization parity with React/Vue: the flat filter checklist is virtualized, roving Up/Down/Home/End nav inside an open dropdown, dropdown focus-on-open, Sort/Group's activate/remove focus retention, the Filter dropdown's Left/Right pane-crossing nav, and `TableBody`'s cross-page Home/End/Arrow nav are all implemented. See [docs/solid-package.md](../../docs/solid-package.md) for the full detail.

## License

MIT
