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
- For complex features (multiple concerns, significant refactoring, new subsystems), use a dedicated branch and close it with a merge commit rather than committing directly to `main`.

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
  core/    — @vates/flexi-table-core    (pure TS, zero dependencies)
  react/   — @vates/flexi-table-react   (peer dep: react)
  vue/     — @vates/flexi-table-vue     (peer dep: vue)
  vanilla/ — @vates/flexi-table-vanilla (no framework dependency)
demo/
  react/   — Vite app consuming @vates/flexi-table-react
  vue/     — Vite app consuming @vates/flexi-table-vue
  vanilla/ — Vite app consuming @vates/flexi-table-vanilla
```

### Core package (`packages/core`)

All stateless logic lives here:

- **`types.ts`** — shared interfaces: `ColumnDefBase<TRow>`, `AggregateType`, `SortEntry`, `RangeFilter`, `DataTableLabels`, `DEFAULT_LABELS` (English default strings)
- **`logic.ts`** — pure functions: `processData`, `searchData`, `groupData`, `computeStringValues`, `computeAggregate`, `paginateData`, `calcTotalPages`, `toggleSort`, `toggleFilter`, `toggleGroupBy`, `toggleCollapse`, `getSortIcon`, `getSortIndex`, `countActiveFilters`
- **`locales.ts`** — built-in locale objects: `LABELS_EN`, `LABELS_FR`, `LABELS_ES`, `LABELS_DE`, `LABELS_PT`

The internal `asRecord(row: object): Record<string, unknown>` helper exists because the generic constraint is `TRow extends object` (not `Record<string, unknown>`) — TypeScript interfaces lack index signatures so the wider constraint is needed, and `asRecord` lets internal logic access arbitrary keys.

### React package (`packages/react`)

- **`types.ts`** — `ColumnDef<TRow>` extends `ColumnDefBase` with `render?` and `renderFilterLabel?` (render props)
- **`useTableState.ts`** — wraps core logic with `useState`/`useMemo`; exposes all state, derived values, and actions
- **`DataTable.tsx`** — thin render layer; delegates all state and logic to `useTableState`

Cell rendering priority: `col.render(value, row)` → `col.format(value)` → `String(value)`. Group headers use the same `cellValue()` function so custom renders apply there too.

### Vue package (`packages/vue`)

- **`types.ts`** — `ColumnDef<TRow>` extends `ColumnDefBase` (no render props; customization is via slots)
- **`useTableState.ts`** — same purpose as React but different signature: `useTableState(data, columns, options?)` where `options` is `{ defaultVisibleColumns?, labels?, defaultPageSize? }`; uses `ref`/`computed` and accepts `MaybeRefOrGetter` for reactive inputs
- **`DataTable.vue`** — uses `<script setup lang="ts" generic="TRow extends object">`
- **`components/Dropdown.vue`** — self-manages open/close state and exposes it to `#trigger` slot

Vue customization uses **scoped slots** instead of render props:

- `#cell-{key}` — custom table cell; slot scope: `{ value: unknown, row: TRow }`
- `#filter-{key}` — custom filter dropdown label; slot scope: `{ value: string }`
- `#group-{key}` — custom group header value; slot scope: `{ value: unknown, row: TRow }`

### Vanilla package (`packages/vanilla`)

- **`types.ts`** — `ColumnDef<TRow>` is a type alias for `ColumnDefBase<TRow>` (no render props; only `format` for string output)
- **`styles.ts`** — CSS string injected once into `<head>` via a `<style data-ft-styles>` tag on first `createFlexiTable` call
- **`index.ts`** — exports `createFlexiTable(container, options)` which returns `{ setData, setColumns, destroy }`

`createFlexiTable` manages all state in a closure, re-renders via `innerHTML` on every state change, and uses **event delegation** (single `click`/`input`/`change` listener on the container). All interactive elements carry `data-action` attributes; the handler dispatches on those. Dropdowns open/close state is tracked in the closure (`openDropdown: string | null`) and re-rendered into the HTML on each update.

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
- **Vue** — the checkbox `<td>` uses `@click.stop` for the same reason. Since `rowClick` is a declared emit, Vue strips any `onRowClick` listener out of `$attrs` before it reaches the component, so presence can't be detected via `useAttrs()`; `getCurrentInstance()?.vnode.props?.onRowClick` reads the raw incoming listener instead, and drives the `ft__tr--clickable` class (which sets the pointer cursor and a `:hover` background rule — real CSS pseudo-classes work here because rows are styled via classes, not inline styles). `.ft__tr--selected` uses `!important` so a selected row's highlight always wins over the hover background.
- **Vanilla** — the row `<tr>` carries `data-action="row-click"` and `data-proc-idx`; the checkbox `<td>` carries `data-no-row-click`, which the `row-click` case in `handleClick` checks via `target.closest('[data-no-row-click]')` before invoking the callback (same guard pattern as `data-no-collapse` for group-row checkboxes). The `ft-tr--clickable` class is added whenever `onRowClick` is set; its `:hover` rule is declared in `styles.ts` _before_ `.ft-tr--selected .ft-td` so a selected+hovered row keeps the selected color on the equal-specificity tie. Firing the callback returns early without calling `render()`, since no state changes.

Custom cell renders (React `render`, Vue `#cell-*` slots) that put clickable elements (buttons, links) inside a cell are responsible for calling `stopPropagation()` themselves if they don't want the click to also reach `onRowClick`.

### Pagination

`pageSize: 0` disables pagination — all rows are returned on a single page. Both adapters default to `0`. When pagination is active, `pagedData` holds the current page's rows while `processedData` holds all filtered/sorted rows (used for `toggleSelectAll`, total count, etc.).

### Global search

`searchData(data, query, columns)` filters rows before `processData` runs — it matches any column's string value (using `col.format` when defined) case-insensitively against the query. Both adapters expose `searchQuery` state and a `setSearchQuery` action; `clearAll` resets it. The vanilla adapter restores focus on the search input across re-renders via `data-focus-key="search"`.

### Grouped columns

When a column is added to `groupBy`, `useTableState` removes it from `activeColumns`, so it disappears from the table header and cells automatically. When grouping is cleared, the column reappears. Group header values are rendered with the same `cellValue()` / slot logic as table cells.

### Aggregation in group headers

`ColumnDefBase.aggregate` accepts `'sum' | 'count' | 'avg' | 'min' | 'max'` or a custom `(rows: TRow[]) => unknown` function. When any active column defines an aggregate, a secondary `ft__agg-row` / `ft-agg-row` row is rendered below each group header with per-column values. `computeAggregate(col, rows)` in core handles all built-in types; `col.format` is used for display when available. The aggregate row is always visible regardless of collapse state.

### i18n

`DataTableLabels` in `packages/core/src/types.ts` defines static string keys and 5 formatting functions (`rowCount(filtered, total)`, `groupCount(n)`, `groupLabel(index)`, `rowsInGroup(n)`, `pageOf(page, total)`). `DEFAULT_LABELS` is English. Both adapters accept a `labels?: Partial<DataTableLabels>` prop/option that is shallow-merged over the defaults.

Built-in locales live in `packages/core/src/locales.ts` and are re-exported from both adapter packages via a `@vates/flexi-table-core/locales` sub-path export — consumers import from `@vates/flexi-table-react` or `@vates/flexi-table-vue` directly. Adding a new locale to `locales.ts` makes it available from both adapters with no further changes.

### Testing

Each package has its own Vitest setup under `src/__tests__/`:

- **`packages/core`** — tests for all pure logic functions (`logic.ts`) and locale pluralization (`locales.ts`).
- **`packages/react`** — tests for `useTableState` via `@testing-library/react`'s `renderHook` + `act`. Runs in jsdom. Important: `vitest.config.ts` must include `resolve.dedupe: ['react', 'react-dom', 'react/jsx-runtime']` to prevent the duplicate-React-instance trap that arises when `react` is also a devDep of the package in a workspace. Behavior that lives in `DataTable.tsx` itself rather than the hook (e.g. `onRowClick`) is tested with `@testing-library/react`'s `render` + `fireEvent` instead.
- **`packages/vue`** — tests for `useTableState` called directly (no component wrapper needed; `ref`/`computed` work outside a component context in Vue 3). Behavior that lives in `DataTable.vue`'s template (e.g. `rowClick`) is tested by mounting the component with `@vue/test-utils`; this requires `vitest.config.ts` to load the `@vitejs/plugin-vue` plugin and set `environment: 'jsdom'`. Since `vue-tsc` can't carry the SFC's `generic="TRow extends object"` parameter through to an externally-imported component, `mount()` needs the component cast (see `DataTable.test.ts`) rather than typed per-test.

### Cross-package resolution in development

Packages and demo apps resolve each other without a build step via:

- **`tsconfig.json` `paths`** — maps `@vates/flexi-table-core` → `../core/src/index.ts` and `@vates/flexi-table-core/locales` → `../core/src/locales.ts` for type checking
- **`vite.config.ts` `resolve.alias`** — maps `@vates/flexi-table-core` to the `packages/core/src` **directory** (not `index.ts`) so Vite's prefix substitution resolves both the bare import and the `/locales` sub-path correctly

In production, `npm run build` must run `core` before `react`, `vue`, and `vanilla` since they import from its `dist/`.
