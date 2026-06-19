# Contributing

## Setup

```bash
git clone https://github.com/vatesfr/flexi-table.git
cd flexi-table
npm install
```

## Development

The repo is an npm workspace monorepo. The demos hot-reload directly from package source files — no build step needed during development.

```bash
# React demo
npm run dev:react

# Vue demo
npm run dev:vue
```

## Build

Packages must be built in order because `react` and `vue` depend on the compiled output of `core`:

```bash
npm run build          # builds core → react → vue
npm run build -w packages/core   # single package
```

## Type checking

```bash
npm run type-check     # checks core and react
# For Vue (uses vue-tsc):
npm run type-check -w packages/vue
```

## Project structure

```
packages/
  core/    — pure TS logic, no framework dependency
  react/   — React component + useTableState hook
  vue/     — Vue 3 component + useTableState composable
demo/
  react/   — Vite + React demo app
  vue/     — Vite + Vue demo app
```

All stateless data processing logic belongs in `packages/core`. Framework adapters should only wire up reactivity and rendering. If you find yourself duplicating logic between the React and Vue packages, it probably belongs in core.

## Generic constraint

The `TRow` generic is constrained as `TRow extends object`, not `TRow extends Record<string, unknown>`. This is intentional — TypeScript interfaces don't satisfy index signatures, so the wider constraint allows consumers to pass typed interfaces directly. Internal code uses the `asRecord()` helper in `packages/core/src/logic.ts` for arbitrary string-key access.

## Pull requests

- Keep changes focused — one feature or fix per PR.
- If you add a feature, update both the React and Vue adapters, and demonstrate it in both demo apps.
- The `labels` prop must cover any new UI string you introduce — don't hardcode text.
- There are no automated tests yet; manually verify your changes in both demo apps before submitting.
