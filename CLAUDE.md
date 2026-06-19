# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install all workspace dependencies
npm install

# Build all packages (must run in order: core → react → vue)
npm run build

# Start the React demo dev server (hot-reloads against package sources, no build needed)
npm run dev:react

# Start the Vue demo dev server
npm run dev:vue

# Type-check core and react packages
npm run type-check

# Build a single package
npm run build -w packages/core
npm run build -w packages/react
npm run build -w packages/vue
```

## Development workflow

After implementing any new feature: review existing tests to see if they need updating, add new tests if the feature isn't covered, update the demos (`demo/react` and `demo/vue`) to showcase the new feature if applicable, and update any affected Markdown files (CLAUDE.md, READMEs).

## Architecture

This is an **npm workspaces monorepo** with three publishable packages and two demo apps:

```
packages/
  core/    — @vates/flexi-table-core   (pure TS, zero dependencies)
  react/   — @vates/flexi-table-react  (peer dep: react)
  vue/     — @vates/flexi-table-vue    (peer dep: vue)
demo/
  react/   — Vite app consuming @vates/flexi-table-react
  vue/     — Vite app consuming @vates/flexi-table-vue
```

### Core package (`packages/core`)

All stateless logic lives here:
- **`types.ts`** — shared interfaces: `ColumnDefBase<TRow>`, `SortEntry`, `RangeFilter`, `DataTableLabels`, `DEFAULT_LABELS` (French default strings)
- **`logic.ts`** — pure functions: `processData`, `groupData`, `computeStringValues`, `toggleSort`, `toggleFilter`, `toggleGroupBy`, `toggleCollapse`, `getSortIcon`, `getSortIndex`, `countActiveFilters`

The internal `asRecord(row: object): Record<string, unknown>` helper exists because the generic constraint is `TRow extends object` (not `Record<string, unknown>`) — TypeScript interfaces lack index signatures so the wider constraint is needed, and `asRecord` lets internal logic access arbitrary keys.

### React package (`packages/react`)

- **`types.ts`** — `ColumnDef<TRow>` extends `ColumnDefBase` with `render?` and `renderFilterLabel?` (render props)
- **`useTableState.ts`** — wraps core logic with `useState`/`useMemo`; exposes all state, derived values, and actions
- **`DataTable.tsx`** — thin render layer; only owns 4 booleans for dropdown open state; delegates everything else to `useTableState`

Cell rendering priority: `col.render(value, row)` → `col.format(value)` → `String(value)`. Group headers use the same `cellValue()` function so custom renders apply there too.

### Vue package (`packages/vue`)

- **`types.ts`** — `ColumnDef<TRow>` extends `ColumnDefBase` (no render props; customization is via slots)
- **`useTableState.ts`** — same API as React but uses `ref`/`computed`; accepts `MaybeRefOrGetter` for reactive inputs
- **`DataTable.vue`** — uses `<script setup lang="ts" generic="TRow extends object">`
- **`components/Dropdown.vue`** — self-manages open/close state and exposes it to `#trigger` slot

Vue customization uses **scoped slots** instead of render props:
- `#cell-{key}` — custom table cell; slot scope: `{ value: unknown, row: TRow }`
- `#filter-{key}` — custom filter dropdown label; slot scope: `{ value: string }`
- `#group-{key}` — custom group header value; slot scope: `{ value: unknown, row: TRow }`

### Grouped columns

When a column is added to `groupBy`, `useTableState` removes it from `activeColumns`, so it disappears from the table header and cells automatically. When grouping is cleared, the column reappears. Group header values are rendered with the same `cellValue()` / slot logic as table cells.

### i18n

`DataTableLabels` in `packages/core/src/types.ts` defines 12 static string keys and 4 pluralization functions (`rowCount(filtered, total)`, `groupCount(n)`, `groupLabel(index)`, `rowsInGroup(n)`). `DEFAULT_LABELS` is English. Both adapters accept a `labels?: Partial<DataTableLabels>` prop/option that is shallow-merged over the defaults.

Built-in locales (`LABELS_EN`, `LABELS_FR`, `LABELS_ES`, `LABELS_DE`, `LABELS_PT`) live in `packages/core/src/locales.ts` and are re-exported from both adapter packages — consumers import them from `@vates/flexi-table-react` or `@vates/flexi-table-vue` without depending on core directly.

### Sub-path exports

Core exposes a `@vates/flexi-table-core/locales` sub-path export (built to `dist/locales.js/.cjs/.d.ts`) so adapter packages can barrel-re-export all locales with a single `export * from '@vates/flexi-table-core/locales'`. This means adding a new locale to `packages/core/src/locales.ts` automatically makes it available from both adapter packages with no further changes.

### Cross-package resolution in development

Packages and demo apps resolve each other without a build step via:
- **`tsconfig.json` `paths`** — maps `@vates/flexi-table-core` → `../core/src/index.ts` and `@vates/flexi-table-core/locales` → `../core/src/locales.ts` for type checking
- **`vite.config.ts` `resolve.alias`** — maps `@vates/flexi-table-core` to the `packages/core/src` **directory** (not `index.ts`) so Vite's prefix substitution resolves both the bare import and the `/locales` sub-path correctly

In production, `npm run build` must run `core` before `react` and `vue` since they import from its `dist/`.
