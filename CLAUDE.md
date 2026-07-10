# CLAUDE.md

## Working style

When a request is ambiguous, ask clarifying questions **one at a time** before proceeding. Do not ask several questions at once.

Be concise: short responses, no filler, no restating what was just done.

Do not re-read a file that was already read in the current session unless it may have changed.

When there are multiple valid approaches to a request, present the options and trade-offs first and wait for a choice before starting implementation.

## Git workflow

- Make commits atomic: each commit should represent one logical change and pass tests on its own.
- Write descriptive commit messages that explain the _why_, not just the _what_. Use a short subject line and a body when context is needed.
- If a commit fixes a bug reported in a GitHub issue, include a closing keyword (e.g. `Fixes #N` / `Closes #N`) in the commit body. If the issue number isn't known, ask before committing rather than omitting it.
- Only create a dedicated branch and close it with a merge commit when a feature's development required multiple commits; otherwise commit directly to `main`.

## Commands

```bash
npm install                      # install all workspace dependencies
npm run build                    # build all packages (core → react → vue → vanilla; order matters)
npm run dev:react|vue|vanilla    # start a demo dev server
npm run test                     # run tests for all packages
npm run test -w packages/X       # run tests for one package (core | react | vue)
npm run test:watch -w packages/X # watch mode for one package
npm run type-check               # type-check all packages
npm run build -w packages/X      # build one package
```

## Development workflow

After implementing any new feature:

1. Review existing tests to see if they need updating; add new tests if the feature isn't covered.
2. Run `npm run test` to verify nothing regressed.
3. Run `npm run type-check` to verify no type errors.
4. Update the demos (`demo/react`, `demo/vue`, and `demo/vanilla`) to showcase the new feature if applicable.
5. Update any affected Markdown files (CLAUDE.md, READMEs).

## Architecture

This is an **npm workspaces monorepo** with four publishable packages and three demo apps:

```
packages/
  core/    — @vates/data-table-core    (pure TS, zero dependencies)
  react/   — @vates/data-table-react   (peer dep: react)
  vue/     — @vates/data-table-vue     (peer dep: vue)
  vanilla/ — @vates/data-table-vanilla (no framework dependency)
demo/
  react/   — Vite app consuming @vates/data-table-react
  vue/     — Vite app consuming @vates/data-table-vue
  vanilla/ — Vite app consuming @vates/data-table-vanilla
```

### Core package (`packages/core`)

All stateless logic lives here:

- **`types.ts`** — shared interfaces: `ColumnDefBase<TRow>`, `AggregateType`, `SortEntry`, `RangeFilter`, `DataTableLabels`, `DEFAULT_LABELS` (English default strings)
- **`logic.ts`** — pure functions: `getColumnValue`, `processData`, `searchData`, `groupData`, `computeStringValues`, `computeAggregate`, `paginateData`, `calcTotalPages`, `toggleSort`, `toggleFilter`, `toggleGroupBy`, `toggleCollapse`, `getOrderedColumns`, `reorderColumn`, `moveColumnBy`, `getSortIcon`, `getSortIndex`, `countActiveFilters`
- **`locales.ts`** — built-in locale objects: `LABELS_EN`, `LABELS_FR`, `LABELS_ES`, `LABELS_DE`, `LABELS_PT`

The internal `asRecord(row: object): Record<string, unknown>` helper exists because the generic constraint is `TRow extends object` (not `Record<string, unknown>`) — TypeScript interfaces lack index signatures so the wider constraint is needed, and `asRecord` lets internal logic access arbitrary keys.

### React package (`packages/react`)

- **`types.ts`** — `ColumnDef<TRow>` extends `ColumnDefBase` with `render?` and `renderFilterLabel?` (render props)
- **`useTableState.ts`** — wraps core logic with `useState`/`useMemo`; exposes all state, derived values, and actions; also exports `TableState<TRow>` (`ReturnType<typeof useTableState<TRow>>`)
- **`DataTableView.tsx`** — the actual render layer; takes a `TableState<TRow>` (the `useTableState` return value) as a `table` prop instead of calling the hook itself
- **`DataTable.tsx`** — thin wrapper: calls `useTableState` internally and renders `<DataTableView table={table} .../>`

Cell rendering priority: `col.render(value, row)` → `col.format(value)` → `String(value)`. Group headers use the same `cellValue()` function so custom renders apply there too.

### Vue package (`packages/vue`)

- **`types.ts`** — `ColumnDef<TRow>` extends `ColumnDefBase` (no render props; customization is via slots)
- **`useTableState.ts`** — same purpose as React but different signature: `useTableState(data, columns, options?)` where `options` is `{ defaultVisibleColumns?, labels?, defaultPageSize? }`; uses `ref`/`computed` and accepts `MaybeRefOrGetter` for reactive inputs; also exports `TableState<TRow>` (`ReturnType<typeof useTableState<TRow>>`)
- **`DataTableView.vue`** — the actual render layer; uses `<script setup lang="ts" generic="TRow extends object">` and takes a `TableState<TRow>` as a `table` prop instead of calling `useTableState` itself
- **`DataTable.vue`** — thin wrapper: calls `useTableState` internally, renders `<DataTableView :table="table" .../>`, and forwards its own slots straight through
- **`components/Dropdown.vue`** — self-manages open/close state and exposes it to `#trigger` slot

Vue customization uses **scoped slots** instead of render props:

- `#cell-{key}` — custom table cell; slot scope: `{ value: unknown, row: TRow }`
- `#filter-{key}` — custom filter dropdown label; slot scope: `{ value: string }`
- `#group-{key}` — custom group header value; slot scope: `{ value: unknown, row: TRow }`

### Vanilla package (`packages/vanilla`)

- **`types.ts`** — `ColumnDef<TRow>` is a type alias for `ColumnDefBase<TRow>` (no render props; only `format` for string output)
- **`styles.ts`** — CSS string injected once into `<head>` via a `<style data-dt-styles>` tag on first `createDataTable` call
- **`index.ts`** — exports `createDataTable(container, options)` which returns `{ setData, setColumns, destroy }`

`createDataTable` manages all state in a closure, re-renders via `innerHTML` on every state change, and uses **event delegation** (single `click`/`input`/`change` listener on the container). All interactive elements carry `data-action` attributes; the handler dispatches on those. Dropdowns open/close state is tracked in the closure (`openDropdown: string | null`) and re-rendered into the HTML on each update.

Focus is saved/restored across re-renders (via `data-focus-key` attributes on range filter inputs and the search input) so typing doesn't lose cursor position.

Cell customization uses `col.format(value) → string` only — no JSX/DOM nodes. For richer cells, consumers can post-process the container DOM after `setData`.

### Row selection

Selection lives in `useTableState` in both adapters. Key design notes:

- Selection is tracked as `Set<TRow>` by **object identity** — no `rowKey` dependency. Row references must be stable (the same object in memory) across re-renders for selection to persist through sort/filter changes.
- React uses `useState<Set<TRow>>` (always assigns a new Set on mutation). Vue uses `shallowRef<Set<TRow>>` — `ref` would cause `UnwrapRefSimple<TRow>` type errors because Vue's deep-unwrap conflicts with generic constraints.
- `selectedRows` is `processedData.filter(r => selection.has(r))` — rows removed by filtering disappear from `selectedRows` but stay in `selection` and reappear if the filter is cleared.
- `toggleSelectAll(rows: TRow[])` takes an explicit row array — the caller decides what to pass (typically `processedData`, not just the current page). It selects all if any are unselected, deselects all if all are already selected.
- Vue uses a local `vIndeterminate` directive (mounted + updated hooks) to set `el.indeterminate` reactively; React uses inline callback refs (re-run on every render because they are arrow functions).

### Row click

`onRowClick` (React/vanilla prop) / `rowClick` (Vue emit) fires when a data row is clicked, receiving the full row object and the native click event — no `rowKey` lookup needed. Group header rows, the aggregate row, and the selection checkbox cell never trigger it:

- **React** — the checkbox `<td>` already calls `e.stopPropagation()`, which is what keeps checkbox clicks from bubbling to the row's `onClick`. A `cursor: 'pointer'` inline style is applied to the row only when `onRowClick` is set. Since rows are styled with inline `style` objects (no stylesheet to hold a `:hover` rule), the hover highlight is JS-driven: `onMouseEnter`/`onMouseLeave` track a single `hoveredRow` state value, which the row's background ternary checks ahead of the stripe/selected fallback.
- **Vue** — the checkbox `<td>` uses `@click.stop` for the same reason. Since `rowClick` is a declared emit, Vue strips any `onRowClick` listener out of `$attrs` before it reaches the component, so presence can't be detected via `useAttrs()`; `getCurrentInstance()?.vnode.props?.onRowClick` reads the raw incoming listener instead, and drives the `dt__tr--clickable` class (which sets the pointer cursor and a `:hover` background rule — real CSS pseudo-classes work here because rows are styled via classes, not inline styles). `.dt__tr--selected` uses `!important` so a selected row's highlight always wins over the hover background.
- **Vanilla** — the row `<tr>` carries `data-action="row-click"` and `data-proc-idx`; the checkbox `<td>` carries `data-no-row-click`, which the `row-click` case in `handleClick` checks via `target.closest('[data-no-row-click]')` before invoking the callback (same guard pattern as `data-no-collapse` for group-row checkboxes). The `dt-tr--clickable` class is added whenever `onRowClick` is set; its `:hover` rule is declared in `styles.ts` _before_ `.dt-tr--selected .dt-td` so a selected+hovered row keeps the selected color on the equal-specificity tie. Firing the callback returns early without calling `render()`, since no state changes.

Custom cell renders (React `render`, Vue `#cell-*` slots) that put clickable elements (buttons, links) inside a cell are responsible for calling `stopPropagation()` themselves if they don't want the click to also reach `onRowClick`.

### Pagination

`pageSize: 0` disables pagination — all rows are returned on a single page. Both adapters default to `0`. When pagination is active, `pagedData` holds the current page's rows while `processedData` holds all filtered/sorted rows (used for `toggleSelectAll`, total count, etc.).

### Filter dropdown

Originally a flat list — one section header + checkbox list per string column, stacked in a single scrolling box — which became unusable for high-cardinality columns (hundreds of checkboxes; see GitHub issue #8). Now a master-detail layout:

- **Left pane** lists every filterable column, string and numeric unified: `filterableCols = columns.filter(c => c.type !== 'date' && c.filterable !== false)`, in column order. A dot indicator marks a column with an active filter.
- **Right pane** shows the selected column's controls — a search input + checklist for string columns, min/max range inputs for numeric columns. Selected column defaults to the first filterable column (`filterActiveKey` falls back to `filterableCols[0]?.key`) so the detail pane is never empty on open.
- `filterActiveCol` (selected column) and `filterSearchTerms` (per-column search term) are local, ephemeral UI state — closure vars in vanilla, `useState`/`ref` in React/Vue — same category as `openDropdown`/`dragColKey`: never touches `filters`/`TableViewState`, not persisted or shared.
- `filterValuesBySearch(values, term)` (core) narrows a checklist by case-insensitive substring, called with the active column's `stringValueMap[col.key]` and its search term. No count threshold gates the search input's visibility — because only one column's checklist is shown at a time (not all of them stacked, as before), showing it unconditionally isn't visual noise the way it would've been in the old flat layout.
- A **select-all checkbox** sits on the same row as the search input — no visible label (to save vertical space in an already dense dropdown), accessible via `title`/`aria-label` (`L.selectAll`) instead. It toggles every value _currently listed_, i.e. post-search-narrowing, not the column's full value set: `toggleFilterAll(filters, key, values)` (core) selects all given values if any is unselected, else deselects all of them — same select-all-if-any-unselected convention as row selection's `toggleSelectAll`. Indeterminate when some but not all listed values are selected.
- The `numericRanges` label was removed — it only existed for the old layout's "Numeric ranges" section header, which the per-column detail pane has no equivalent of.

### Global search

`searchData(data, query, columns)` filters rows before `processData` runs — it matches any column's string value (using `col.format` when defined) case-insensitively against the query. Both adapters expose `searchQuery` state and a `setSearchQuery` action; `clearAll` resets it. The vanilla adapter restores focus on the search input across re-renders via `data-focus-key="search"`.

### Computed columns

`ColumnDefBase.value?: (row: TRow) => unknown` decouples a column's cell value from its `key`. `key` stays a plain `string` (loosened from `keyof TRow & string`) and is only ever used as the column's identity — for sort/filter/group/visibility state and list keys. `value` governs how the cell value is actually read: omitted reads `row[key]` (unchanged default behavior), a function computes the value from the whole row — covering both simple aliasing (`value: (row) => row.name`) and true computed columns with no single backing property (`value: (row) => row.price * row.qty`). A string form (reading a named property instead of `key`) was considered and rejected: it's strictly redundant with the function form (which already covers aliasing, plus nested access like `value: (row) => row.address.city`, at no extra API cost), so it would just be a second way to do the same thing. `getColumnValue(col, row)` in `logic.ts` is the single accessor implementing this and is used everywhere a cell value is read: `processData`'s filter/range-filter/sort, `groupData`, `computeStringValues`, `searchData`, and `computeAggregate`. All of these already accepted a `columns` array except `groupData`, which gained one (`groupData(data, groupBy, columns, emptyLabel)`) so groupBy columns can be computed too.

Each adapter's own cell/group-header rendering (React `cellValue()`, Vue `cellText()`/`groupValue()`, vanilla `cellStr()`) calls `getColumnValue` instead of reading `row[col.key]` directly. `rowKey` (React/vanilla prop, Vue prop) is a separate, unrelated concept — it identifies a row for list keys/DOM identity and still reads a real row property directly, untouched by this.

### Grouped columns

When a column is added to `groupBy`, `useTableState` removes it from `activeColumns`, so it disappears from the table header and cells automatically. When grouping is cleared, the column reappears. Group header values are rendered with the same `cellValue()` / slot logic as table cells.

### Column reordering

`columnOrder: string[]` is a separate piece of state from `visibleCols` — it lists _all_ column keys (visible and hidden) in display order, not just the visible ones, so hiding a column and showing it again doesn't lose its position. It starts as `[]` (natural order, i.e. `columns` as passed in) and is only materialized on the first reorder.

`getOrderedColumns(columns, order)` in core sorts the full column list per `order`, appending any column missing from it (added later, or `order` still `[]`) at the end in its original relative position — the same "stale/partial state still renders something sane" pattern used for `visibleCols` in `setViewState`. `activeColumns` in each adapter is `getOrderedColumns(columns, columnOrder).filter(visible && !grouped)`; a second derived value, `orderedColumns`, is the unfiltered version — all columns in display order, visible or not — used to render the Columns panel with its own drag/order controls.

Two interactions both write to `columnOrder`, backed by two core primitives:

- **Drag-and-drop on headers** — native HTML5 Drag and Drop API (`draggable`, `dragstart`/`dragover`/`drop`), not a pointer-events implementation, to keep the per-adapter diff small and avoid a dependency. `reorderColumn(order, dragKey, targetKey)` moves `dragKey` to just before `targetKey`; dropping doesn't distinguish drop-before vs drop-after halves of the target header, it always inserts before — a deliberate simplification.
- **▲▼ buttons in the Columns panel** — a keyboard-reachable fallback, since native drag-and-drop has no keyboard path. `moveColumnBy(order, key, delta)` swaps `key` with its neighbor `delta` positions away (`-1`/`+1`), and is a no-op past either boundary (button `disabled` when at the start/end of `orderedColumns`).

Both actions materialize `columnOrder` from `columns.map(c => c.key)` before calling the core primitive if it's still `[]`, so the first reorder always operates on a complete key list rather than an empty one.

Per-adapter drag wiring:

- **React/Vue** — `dragColKey`/`dragOverColKey` local state (React `useState`, Vue `ref`) drives inline opacity/box-shadow feedback on the dragged and hovered-over headers; both are cleared on `dragend` as well as `drop`, since a drag cancelled outside a valid target (e.g. dropped off the table) still fires `dragend` but not `drop`.
- **Vanilla** — drag feedback bypasses the render()/innerHTML flow entirely: replacing the dragged `<th>`'s DOM node mid-drag (as a `render()` call would) aborts the native drag operation in most browsers. So `dragstart`/`dragover`/`dragend` only toggle CSS classes directly on the existing DOM nodes via `classList`; only `drop` (the terminal action, after which a fresh render is safe) mutates `columnOrder` and calls `render()`. These four drag listeners are registered on the container alongside the existing `click`/`input`/`change` delegation, since native drag events aren't part of that delegation.

`TableViewState.columnOrder?: string[]` persists/shares the order the same way as every other field in `view.ts` — omitted when empty (natural order), wire key `o`.

### Aggregation in group headers

`ColumnDefBase.aggregate` accepts `'sum' | 'count' | 'avg' | 'min' | 'max'` or a custom `(rows: TRow[]) => unknown` function. When any active column defines an aggregate, a secondary `dt__agg-row` / `dt-agg-row` row is rendered below each group header with per-column values. `computeAggregate(col, rows)` in core handles all built-in types; `col.format` is used for display when available. The aggregate row is always visible regardless of collapse state.

### i18n

`DataTableLabels` in `packages/core/src/types.ts` defines static string keys and 5 formatting functions (`rowCount(filtered, total)`, `groupCount(n)`, `groupLabel(index)`, `rowsInGroup(n)`, `pageOf(page, total)`). `DEFAULT_LABELS` is English. Both adapters accept a `labels?: Partial<DataTableLabels>` prop/option that is shallow-merged over the defaults.

Built-in locales live in `packages/core/src/locales.ts` and are re-exported from both adapter packages via a `@vates/data-table-core/locales` sub-path export — consumers import from `@vates/data-table-react` or `@vates/data-table-vue` directly. Adding a new locale to `locales.ts` makes it available from both adapters with no further changes.

### View persistence

`TableViewState` in `packages/core/src/view.ts` is a serializable snapshot of everything a user can change through the UI — `visibleCols`, `columnOrder`, `sorts`, `filters`, `rangeFilters`, `groupBy`, `collapsedGroups`, `page`, `pageSize`, `searchQuery` — except `selection`, which is tracked by object identity and isn't meaningful to persist or share. All fields are optional: a partial view (e.g. just a sort) applies on top of whatever defaults are already in place.

`encodeViewState`/`decodeViewState` serialize a view to/from a compact, URL-safe string, kept small by three rules: 1-letter wire keys, tuples instead of objects (`sorts` as `[key, dirFlag]`, `filters` as `[key, values[]]` pairs, `rangeFilters` as `[key, min, max]`), and omitting any field at its natural default (empty array/object/string, `page: 1`, `pageSize: 0`) — most shared/persisted views differ from the defaults in only one or two fields. The string itself is base64url of that compact JSON — hand-rolled (not `btoa`/`TextEncoder`) since core targets ES2020 with no DOM/Node lib and must run identically in browsers, Node (SSR), and the vanilla adapter; base64url is cheaper here than `encodeURIComponent(JSON.stringify(...))` because JSON's punctuation would otherwise be percent-escaped at 3 chars apiece.

Each adapter's `useTableState`/`createDataTable` exposes `getViewState()` (builds a `TableViewState` from current state, omitting `visibleCols` when it equals the full column set) and `setViewState(view)` (applies a partial view, resetting every field absent from it back to its default — so it's idempotent with `getViewState`). `setViewState` falls back to the default visible columns if `view.visibleCols` contains no keys present in the current `columns` (e.g. a stale shared link against a changed column set). The vanilla adapter also exposes `onViewChange(cb)` since it has no reactivity system for external code to hook into; it fires after any UI action that changes the view, but not on selection-only changes.

Actually writing a view to `localStorage` or the URL is opt-in, via separate helpers rather than baked into the main hook (`persistence.ts` in each adapter package):

- `usePersistedView(table, storageKey)` (React/Vue) / `persistViewToLocalStorage(table, storageKey)` (vanilla) — loads on mount/init, saves on every change.
- `useUrlView(table, options?)` (React/Vue) / `syncViewToUrl(table, options?)` (vanilla) — loads from the `view` query param (configurable via `paramName`) on mount/init and on `popstate`, writes back via `history.replaceState` (not `pushState`, so per-change sort/filter/etc. tweaks don't spam browser history).

Both URL helpers only apply state when the param is actually present and decodes successfully — an absent or malformed param leaves whatever state is already there alone rather than forcing a reset to defaults. This matters when composing both helpers (as the demos do): on a plain reload with no `view` param, the URL helper's hydration step must not clobber the localStorage-restored view with an empty one.

### DataTableView — reaching state that `<DataTable>` can't expose (React/Vue)

`usePersistedView`/`useUrlView` (and any other external code wanting imperative selection control, e.g. `table.clearSelection()`) need the actual `useTableState` return value — but `<DataTable>` builds one internally and never exposes it, so nothing outside the component can reach it. Rather than bolt on an escape hatch (a `forwardRef`/`useImperativeHandle` or `defineExpose` handle), the render layer itself was split out: `DataTableView` takes a `table: TableState<TRow>` prop (the `useTableState` return value, type-aliased as `TableState<TRow>` and exported from `useTableState.ts`) instead of calling the hook itself, and `DataTable` is now a thin wrapper — `useTableState(...)` + `<DataTableView table={table} .../>`.

This is fully declarative (no ref timing/SSR concerns) and stays complete automatically as `useTableState` grows — passing the whole object through means every current and future action/derived value is reachable via `table`, with no separate "exposed API" surface to keep in sync by hand. A consumer who needs external control does exactly what the "Custom layout"/headless demos already did, just rendering the built-in UI instead of a hand-rolled one:

```tsx
const table = useTableState(data, columns)
usePersistedView(table, 'my-table-view')
return <DataTableView table={table} data={data} columns={columns} />
```

`DataTableViewProps<TRow>` (in each adapter's `types.ts`) holds every prop `DataTableView` needs beyond `table` — `data` (for the unfiltered row count) and `columns` (for filter/sort/group panels, which list _all_ columns, not just active ones) can't be derived from `table` alone, so they're passed separately, same as `<DataTable>` already required them. `DataTableProps` is `Omit<DataTableViewProps<TRow>, 'table'> & { defaultVisibleColumns?, labels?, defaultPageSize? }` — the three fields that only make sense at `useTableState` construction time.

Vue's split has one extra wrinkle around `onRowClick`/`rowClick` detection (see Row click above): `DataTableView`'s `isRowClickable` check reads its own `vnode.props.onRowClick`, but `DataTable` always forwards the `row-click` emit unconditionally (clicking a row always emits, matching the emit's own semantics, regardless of whether anyone's listening) — so if `DataTableView` self-detected off its incoming listener, it would always see one and always show clickable styling. `DataTable` instead does its own `vnode.props` check (reflecting whether _its_ caller passed a listener) and forwards the result down as an explicit `rowClickable` prop, which `DataTableView` prefers over self-detection when present; `DataTableView` used directly (no wrapper) falls back to self-detection since there's no wrapper to supply the prop.

### Testing

Each package has its own Vitest setup under `src/__tests__/`:

- **`packages/core`** — tests for all pure logic functions (`logic.ts`) and locale pluralization (`locales.ts`).
- **`packages/react`** — tests for `useTableState` via `@testing-library/react`'s `renderHook` + `act`. Runs in jsdom. Important: `vitest.config.ts` must include `resolve.dedupe: ['react', 'react-dom', 'react/jsx-runtime']` to prevent the duplicate-React-instance trap that arises when `react` is also a devDep of the package in a workspace. Behavior that lives in `DataTable.tsx` itself rather than the hook (e.g. `onRowClick`) is tested with `@testing-library/react`'s `render` + `fireEvent` instead.
- **`packages/vue`** — tests for `useTableState` called directly (no component wrapper needed; `ref`/`computed` work outside a component context in Vue 3). Behavior that lives in `DataTable.vue`'s template (e.g. `rowClick`) is tested by mounting the component with `@vue/test-utils`; this requires `vitest.config.ts` to load the `@vitejs/plugin-vue` plugin and set `environment: 'jsdom'`. Since `vue-tsc` can't carry the SFC's `generic="TRow extends object"` parameter through to an externally-imported component, `mount()` needs the component cast (see `DataTable.test.ts`) rather than typed per-test.

### Cross-package resolution in development

Packages and demo apps resolve each other without a build step via:

- **`tsconfig.json` `paths`** — maps `@vates/data-table-core` → `../core/src/index.ts` and `@vates/data-table-core/locales` → `../core/src/locales.ts` for type checking
- **`vite.config.ts` `resolve.alias`** — maps `@vates/data-table-core` to the `packages/core/src` **directory** (not `index.ts`) so Vite's prefix substitution resolves both the bare import and the `/locales` sub-path correctly

In production, `npm run build` must run `core` before `react`, `vue`, and `vanilla` since they import from its `dist/`.
