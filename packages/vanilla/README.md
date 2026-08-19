# @vates/data-table-vanilla

[![npm](https://img.shields.io/npm/v/@vates/data-table-vanilla)](https://www.npmjs.com/package/@vates/data-table-vanilla)
[![node](https://img.shields.io/node/v/@vates/data-table-vanilla)](https://www.npmjs.com/package/@vates/data-table-vanilla)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@vates/data-table-vanilla)](https://bundlephobia.com/package/@vates/data-table-vanilla)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Vanilla JS adapter for [data-table](../../README.md) — a flexible, fully-typed data table with sorting, filtering, column visibility/reordering, and row grouping. No framework required.

## Install

```bash
npm install @vates/data-table-vanilla
```

## Usage

```ts
import { createDataTable, type ColumnDef } from '@vates/data-table-vanilla'

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

const table = createDataTable(document.getElementById('table')!, {
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

CSS is injected automatically into `<head>` on the first `createDataTable` call. This includes all color tokens and dark-mode overrides that activate automatically via `prefers-color-scheme: dark`. The injected `<style>` tag is placed before any existing `<head>` children, so a stylesheet you define yourself (see [Theming](#theming)) always wins the cascade regardless of import order.

## Theming

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vanilla/#theming)

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
| `--color-background-secondary` | `#f7f6f3` | `#2b2a26` |
| `--color-background-tertiary`  | `#eae9e5` | `#3a3830` |
| `--color-background-info`      | `#e6f1fb` | `#0d2640` |
| `--color-background-warning`   | `#faeeda` | `#2a1900` |
| `--color-text-primary`         | `#1a1916` | `#e8e7e4` |
| `--color-text-secondary`       | `#6b6a66` | `#9b9a96` |
| `--color-text-tertiary`        | `#9b9a96` | `#86847e` |
| `--color-text-info`            | `#185fa5` | `#5b9fe0` |
| `--color-text-warning`         | `#854f0b` | `#e8a040` |
| `--color-border-secondary`     | `#dddcd8` | `#504d46` |
| `--color-border-tertiary`      | `#eeedea` | `#333029` |
| `--color-border-info`          | `#b8d6f5` | `#1a4070` |
| `--color-border-warning`       | `#f0d4a8` | `#4a2c00` |

## Cell customization

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vanilla/#full-table)

Use `col.format(value, row)` to control the plain-text string rendered for a cell — the second argument gives access to the rest of the row for cross-field conditional formatting:

```ts
{ key: 'status', label: 'Status', format: (v) => v === 1 ? 'Active' : 'Inactive' }
{ key: 'playtime', label: 'Played (h)', format: (v, row) => row.score > 90 ? `⭐ ${v}` : String(v) }
```

`format`'s return value is always HTML-escaped, so it can't be used to render markup. For richer cells — images, links, colored badges — use `col.render(value, row)` instead: it returns a DOM node that's mounted directly into the cell, taking priority over `format` when both are set. It also applies to group header values and aggregate cells for the same column.

```ts
{
  key: 'name',
  label: 'Name',
  render: (v, row) => {
    const a = document.createElement('a')
    a.href = `/games/${row.id}`
    a.textContent = String(v)
    return a
  },
}
```

## Multi-value (array) columns

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vanilla/#full-table)

A column whose cell value is an array — tags, genres, categories — is detected automatically, no flag required:

```ts
interface Game {
  id: number
  name: string
  tags: string[]
}

const COLUMNS: ColumnDef<Game>[] = [
  { key: 'name', label: 'Name' },
  { key: 'tags', label: 'Tags', groupable: true }, // no extra config needed
]

const data = [
  { id: 1, name: 'Game A', tags: ['Action', 'RPG'] },
  { id: 2, name: 'Game B', tags: ['Action', 'Adventure'] },
]

createDataTable(container, { data, columns: COLUMNS, rowKey: 'id' })
// Filter dropdown shows individual items: "Action" | "Adventure" | "RPG"
// Selecting "Action" matches both games
```

- The filter checklist lists each individual item instead of the stringified whole array, and a row matches if it contains any selected item (`multiMode: 'or'`, the default) or all of them (`multiMode: 'and'`).
- Grouping by an array column fans a row out into one group per item — a row tagged `['Action', 'RPG']` appears under both the "Action" and "RPG" groups.
- A row with an empty array (`tags: []`) is bucketed under a labeled placeholder — `(none)` by default, customizable via the `emptyValue` label — instead of a blank checklist entry or an unlabeled group.
- Cells without a custom `format` display the array joined with `, `.
- Every checklist item (array-valued columns and plain string columns alike) shows how many rows currently match it — helpful for scanning a high-cardinality column like `tags` before picking a value. The count is faceted: it reflects every other active filter, but not the checklist's own column, so selecting a value elsewhere narrows the counts shown here without a value's own selection state affecting its neighbors. A value with a count of 0 is dropped from the checklist entirely — unless it's already selected, in which case it stays listed so it can still be unticked.
- A sort-order button next to the search input cycles the checklist between alphabetical (A→Z / Z→A) and by-count (high→low / low→high) order — default is alphabetical ascending.

## Date filter tree

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vanilla/#full-table)

`type: 'date'` columns get a Year › Month › Day checkbox tree in the filter dropdown instead of a checklist, plus a range filter (2 date inputs + a slider) above it that narrows the tree itself — dates outside the range drop out of the tree, not just the final row set. Check a year or month to select every date under it in one click, or drill into individual days; the search box and per-value row counts work the same as for string columns. The same sort-order button toggles the tree's chronological order (ascending/descending) instead — there's no by-count order for a tree of grouped branches. Values that don't parse as dates are grouped under the `emptyValue` label rather than dropped.

```ts
{ key: 'joined', label: 'Joined', type: 'date' }
```

## Computed columns

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vanilla/#full-table)

A column doesn't need a matching property on `TRow` — set `value` to a function to compute the cell value from the whole row. Sorting, filtering, grouping, and aggregation all work off the computed value, same as a regular column.

```ts
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

```ts
{ key: 'employeeName', label: 'Name', value: (row) => row.name }
```

## Custom sort order

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vanilla/#full-table)

`compare` overrides the default numeric-or-alphabetical comparison for a column whose natural order is neither, e.g. an enum/tier column:

```ts
const TIER_ORDER = ['Bronze', 'Silver', 'Gold', 'Platinum']

{
  key: 'tier',
  label: 'Tier',
  compare: (a, b) => TIER_ORDER.indexOf(String(a)) - TIER_ORDER.indexOf(String(b)),
}
```

It applies everywhere the column's values are ordered: row sort, group order (for a groupBy column), and the filter checklist's default and explicit ordering.

`compare` also receives a 3rd `dir` argument (the active ascending/descending direction) — ignore it for an ordinary comparator like the one above, since every call site already flips the _return value_'s sign for a descending sort, the same way the default comparison does. It's there for the rarer case of a value that has to stay pinned to one end regardless of which direction is active, e.g. a missing value that should sort last whether ascending or descending — impossible to express as a plain `(a, b) => number` return, since that gets sign-flipped right along with everything else. `compareMissingLast` is a ready-made comparator for exactly this:

```ts
import { compareMissingLast } from '@vates/data-table-vanilla'

{ key: 'score', label: 'Score', type: 'number', compare: compareMissingLast() } // null/undefined/'' always last, in both directions
```

Its default `isMissing` check is `(v) => v == null || v === ''`; pass your own `compare`/`isMissing` to `compareMissingLast(compare?, isMissing?)` to combine it with a custom order — e.g. `compareMissingLast((a, b) => TIER_ORDER.indexOf(String(a)) - TIER_ORDER.indexOf(String(b)))` sorts by tier rank with an empty tier always last.

## Grouped columns

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vanilla/#full-table)

Set `groupable: true` on a column to make it available in the toolbar's Group dropdown; a grouped column disappears from the table header/cells and its rows are bucketed under a header row instead.

```ts
{ key: 'department', label: 'Department', groupable: true }
```

Grouping buckets rows by **exact value** by default — fine for low-cardinality columns (department, status), but a continuous or near-unique column (a percentage, a raw timestamp) would create one group per row. Set `groupValue` to bucket into coarser groups instead — it only affects grouping; sort/filter/aggregate/cell rendering keep reading the column's real value, untouched:

```ts
import { bucketNumericRange, formatNumericRange, bucketDatePart, formatDatePart } from '@vates/data-table-vanilla'

{
  key: 'salary',
  label: 'Salary',
  type: 'number',
  groupable: true,
  groupValue: bucketNumericRange(20000), // 47000 -> 40000 (the range's lower bound)
  groupFormat: formatNumericRange(20000, ' USD'), // "40000–60000 USD" in the group header
}

{
  key: 'joined',
  label: 'Joined',
  type: 'date',
  groupable: true,
  groupValue: bucketDatePart('year'), // any date -> "2019-01-01"
  groupFormat: formatDatePart('year'), // "2019" in the group header
}
```

`groupValue(value, row)` returns the bucket key — return a value whose type matches `col.type` (a number for `type: 'number'`, a `parseDate`-parseable string for `type: 'date'`) so groups still sort correctly, the same type-aware comparison a plain groupBy column already gets. `groupFormat(keyPart)` renders that bucket key for the group header (`bucketNumericRange`'s lower bound alone, e.g. `40000`, usually isn't fit to display on its own); omit it to show the raw bucket key. `bucketDatePart`/`formatDatePart` accept `'year' | 'month' | 'day'` granularity.

## Aggregation

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vanilla/#full-table)

Set `aggregate` on a column to show a computed value in a row below each group header — try grouping by Department in the demo. Built-in types: `'sum' | 'count' | 'avg' | 'min' | 'max'`; or supply a function for anything else:

```ts
{ key: 'salary', label: 'Salary', type: 'number', aggregate: 'sum' }
{ key: 'score', label: 'Score', type: 'number', aggregate: (rows) => Math.max(...rows.map((r) => r.score)) }
```

The aggregate row only appears once grouping is active and only shows values for columns that define `aggregate`; it's always visible regardless of a group's collapsed state.

## Row selection

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vanilla/#row-selection)

Pass `selectable` to show a checkbox column. The header checkbox selects/deselects the full filtered dataset (all pages at once). Group header checkboxes select/deselect all rows in that group. Both support indeterminate state.

```ts
const table = createDataTable(container, {
  data: employees,
  columns: COLUMNS,
  rowKey: 'id',
  selectable: true,
  onSelectionChange: (rows) => console.log(rows.length, 'selected'),
})
```

Selection uses object identity, so it persists across sort/filter changes as long as row references are stable.

## Row click

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vanilla/#row-click)

Pass `onRowClick` to react to a data row being clicked — it receives the full row object and the native click event, no key lookup needed. Group header rows, the aggregate row, and the selection checkbox cell never trigger it.

```ts
const table = createDataTable(container, {
  data: employees,
  columns: COLUMNS,
  rowKey: 'id',
  onRowClick: (row, event) => console.log('clicked', row.name),
})
```

## Column reordering

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vanilla/#full-table)

Drag a column header to reorder it, or drag a row (or press Alt+ArrowUp/Alt+ArrowDown on it) in the Columns panel — both work out of the box, no extra options required. Order is tracked independently of visibility, so hiding and re-showing a column keeps its place. It's included in `getViewState()`/`setViewState()` (as `columnOrder`) for persistence and sharing.

## Options

| Option                   | Type                                     | Default | Description                                  |
| ------------------------ | ---------------------------------------- | ------- | -------------------------------------------- |
| `data`                   | `TRow[]`                                 | —       | Row data                                     |
| `columns`                | `ColumnDef<TRow>[]`                      | —       | Column definitions                           |
| `rowKey`                 | `keyof TRow & string`                    | —       | DOM key only — not selection identity        |
| `defaultVisibleColumns`  | `string[]`                               | all     | Initially visible column keys                |
| `labels`                 | `Partial<DataTableLabels>`               | English | UI string overrides                          |
| `defaultPageSize`        | `number`                                 | 0 (off) | Initial rows per page; 0 disables pagination |
| `defaultGroupsCollapsed` | `boolean`                                | `true`  | Whether newly-grouped groups start collapsed |
| `selectable`             | `boolean`                                | `false` | Show checkbox column for row selection       |
| `onSelectionChange`      | `(rows: TRow[]) => void`                 | —       | Called when selection changes                |
| `onRowClick`             | `(row: TRow, event: MouseEvent) => void` | —       | Called when a data row is clicked            |

## Column definition

```ts
interface ColumnDef<TRow extends object> {
  key: string // unique column id; used for row[key] lookup unless `value` is set
  label: string
  type?: 'string' | 'number' | 'date' // controls filter UI: checklist / range / year-month-day tree; default: 'string'
  width?: number
  value?: (row: TRow) => unknown // compute the cell value from the whole row (also covers aliasing)
  format?: (value: unknown, row: TRow) => string
  compare?: (a: unknown, b: unknown, dir: SortDir) => number // custom ordering for row sort, group order, and the filter checklist; see Custom sort order
  sortable?: boolean // default: true
  filterable?: boolean // default: true
  groupable?: boolean // default: false
  groupValue?: (value: unknown, row: TRow) => unknown // bucket a groupBy value into a coarser group key; see Grouped columns
  groupFormat?: (keyPart: string) => string // render a groupValue bucket key in the group header
  multiMode?: 'and' | 'or' // match mode for array-valued columns; default: 'or'
  aggregate?: 'sum' | 'count' | 'avg' | 'min' | 'max' | ((rows: TRow[]) => unknown) // see Aggregation
}
```

## Instance methods

| Method                                | Description                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| `setData(rows: TRow[])`               | Replace the data and re-render                                                   |
| `setColumns(cols: ColumnDef<TRow>[])` | Replace the column definitions and re-render                                     |
| `getViewState()`                      | Returns a serializable snapshot of sort/filter/group/page/etc. (not selection)   |
| `setViewState(view: TableViewState)`  | Applies a view snapshot; fields absent from it reset to default                  |
| `onViewChange(cb)`                    | Subscribes to view changes (not selection-only); returns an unsubscribe function |
| `getSelection()`                      | Current selection (by object identity), including rows hidden by a filter        |
| `setSelection(rows: TRow[])`          | Replaces the selection outright — e.g. to pre-select rows on load                |
| `clearSelection()`                    | Empties the selection — e.g. to wire an external "Clear selection" button        |
| `destroy()`                           | Remove all event listeners and clear the container                               |

## View persistence & sharing

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vanilla/#persisted-table)

`getViewState()`/`setViewState()` capture and apply a serializable snapshot of sort, filters, groups, page, etc. — everything except selection, which is identity-based and not meaningful to persist or share. Two opt-in helpers wire this up to `localStorage` and the URL:

```ts
import {
  createDataTable,
  persistViewToLocalStorage,
  syncViewToUrl,
} from '@vates/data-table-vanilla'

const table = createDataTable(container, { data, columns })
const unpersist = persistViewToLocalStorage(table, 'my-table-view') // survives reloads
const unsync = syncViewToUrl(table) // reflected in ?view=... — reload the page or share the link

// call these alongside table.destroy() if the table can be torn down before a full page unload
unpersist()
unsync()
```

`persistViewToLocalStorage(table, storageKey)` loads the view immediately and saves it on every change (via `onViewChange`). `syncViewToUrl(table, { paramName? })` loads from the URL immediately and on back/forward navigation, and writes back via `history.replaceState` (so sort/filter tweaks don't spam browser history). Both only act when their source actually has a view to apply — composed together, a plain reload with no `view` param keeps the localStorage-restored view instead of resetting it.

To persist a view somewhere else (e.g. a backend), call `getViewState()`/`setViewState(view)`/`onViewChange(cb)` directly — the two helpers above work with any object shaped like that, so `table` (or anything else with that shape) can be passed in.

`resetView(table, { storageKey?, paramName? })` puts a table back to its construction-time defaults and clears whatever `persistViewToLocalStorage`/`syncViewToUrl` persisted for it — pass the same `storageKey`/`paramName` you gave those functions (both optional, since you might only be using one of them):

```ts
import { resetView } from '@vates/data-table-vanilla'

resetButton.addEventListener('click', () => resetView(table, { storageKey: 'my-table-view' }))
```

## i18n

▶ [Try it in the demo](https://vatesfr.github.io/data-table/vanilla/#i18n)

Use a built-in locale or supply any `Partial<DataTableLabels>` overrides (shallow-merged over English defaults):

```ts
import { LABELS_FR } from '@vates/data-table-vanilla'

createDataTable(container, { data, columns, labels: LABELS_FR })
```

Built-in locales: `LABELS_EN` (default), `LABELS_FR`, `LABELS_ES`, `LABELS_DE`, `LABELS_PT`.

## License

MIT
