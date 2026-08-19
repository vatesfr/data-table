# Contributing

## Setup

```bash
git clone https://github.com/vatesfr/data-table.git
cd data-table
npm install
```

## Development

The repo is an npm workspace monorepo. The demos hot-reload directly from package source files — no build step needed during development.

```bash
# React demo
npm run dev:react

# Vue demo
npm run dev:vue

# Vanilla demo
npm run dev:vanilla
```

## Build

Packages must be built in order because `react`, `vue`, and `solid` depend on the compiled output of `core`, and `vanilla` in turn depends on `solid`'s:

```bash
npm run build          # builds core → react → vue → solid → vanilla
npm run build -w packages/core   # single package
```

## Type checking

```bash
npm run type-check     # checks all five packages (vue-tsc for Vue, tsc for the rest)
```

## Project structure

```
packages/
  core/    — pure TS logic, no framework dependency
  react/   — React component + useTableState hook
  vue/     — Vue 3 component + useTableState composable
  solid/   — Solid component + createTableState primitive
  vanilla/ — vanilla JS adapter, no framework required (wraps `solid`)
demo/
  react/   — Vite + React demo app
  vue/     — Vite + Vue demo app
  vanilla/ — Vite + vanilla demo app
```

All stateless data processing logic belongs in `packages/core`. Framework adapters should only wire up reactivity and rendering. If you find yourself duplicating logic between the React and Vue packages, it probably belongs in core. `packages/vanilla` should stay a thin wrapper around `packages/solid` — UI/state changes for the Solid+vanilla pairing belong in `packages/solid`, not duplicated into `packages/vanilla` directly.

## Generic constraint

The `TRow` generic is constrained as `TRow extends object`, not `TRow extends Record<string, unknown>`. This is intentional — TypeScript interfaces don't satisfy index signatures, so the wider constraint allows consumers to pass typed interfaces directly. Internal code uses the `asRecord()` helper in `packages/core/src/logic.ts` for arbitrary string-key access.

## Pull requests

- Keep changes focused — one feature or fix per PR.
- If you add a feature, update React, Vue, and Solid (a Solid-level change already covers `packages/vanilla`, since it wraps `packages/solid`) and demonstrate it in the React/Vue/vanilla demo apps.
- The `labels` prop must cover any new UI string you introduce — don't hardcode text.
- Run `npm run test` before submitting; every package has automated tests. Also manually verify your changes in the demo apps.
