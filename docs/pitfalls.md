# Pitfalls

Symptom first, then cause and fix. Delete entries once obsolete.

<!-- check-docs-ignore: exceeded journalctl memory Killed chromium-browse Failed oom-kill _vts invoker -->

## Empty `dist/index.d.ts` after a dependency bump

- Symptom: `packages/{react,vue,solid,vanilla}/dist/index.d.ts` is empty; `build` still exits 0, so CI doesn't catch it.
- Cause: TypeScript 6 defaults `rootDir` to the tsconfig's directory instead of the common root of the sources, so declarations land in `dist/src/` (adapters: `dist/<pkg>/src/`, as they compile core's source through `paths`) while `vite-plugin-dts` writes entry stubs expecting them one level up. Also, `/// <reference lib="dom" />` is dropped from emitted `.d.ts` unless marked `preserve="true"`, and API Extractor then fails with `Unable to follow symbol for "HTMLElement"`.
- Fix: explicit `rootDir` in each package's `tsconfig.json` (core: `src`, adapters: `..`); `preserve="true"` on `dropdownDomUtils.ts`'s lib reference. Root `package.json`'s `typescript` override keeps a single TypeScript version (API Extractor pins its own) — keep it. After touching `typescript`, `typescript-eslint`, `vue-tsc` or `vite-plugin-dts`, check those `.d.ts` files are non-trivial.

## `vite-plugin-dts` 5: adapter `.d.ts` bundling fails or inlines core

- Symptom: `Internal Error: Unable to determine semantic information for declaration: …/packages/core/src/logic.ts:522:11`; mapping `paths` to core's `dist/` instead builds, but `dist/index.d.ts` triples in size with core's types inlined.
- Cause: API Extractor reads the tsconfig `paths` itself, so it follows them into core's source, and treats anything path-mapped as local rather than an external package. `overrideTsconfig` is deep-merged over the plugin's options, so `paths: {}` changes nothing.
- Fix: `overrideTsconfig: { compilerOptions: { paths: null } }` in each adapter's `bundleTypes`, so core resolves as a package and stays an external import.

## Adapters' `/theme` sub-path has no types, or clobbers `index.d.ts`

- Symptom: up to 0.16.0, `dist/theme.d.ts` was missing from the adapters though `exports["./theme"].types` points at it; with `vite-plugin-dts` 5 and `insertTypesEntry`, the theme pass overwrites `dist/index.d.ts` with the theme re-export.
- Cause: `insertTypesEntry` names the entry `index.d.ts`, and without `entryRoot` the declaration lands under `dist/<pkg>/src/` (`rootDir` is `..`).
- Fix: `vite.theme.config.ts` emits without bundling, with `entryRoot: 'src'`, producing `dist/theme.d.ts`.

## Checkbox stays checked in the browser, test passes in jsdom

- Symptom: clicking a filter checkbox applies the filter but the box keeps its old state; the adapter's test of the same click passes.
- Cause: a click handler calling `preventDefault()` makes the browser revert `.checked` after the click — after React's or Vue's DOM update, so the stale value sticks. jsdom never reverts, so tests can't see it.
- Fix: don't cancel the click when the binding can follow it (React: `readOnly`, no `preventDefault`), or re-apply the state after the revert with core's `deferCheckboxCorrection` (Solid, Vue). Tests simulate the revert: set `.checked` back after the framework's update, then assert after a macrotask. jsdom also lacks `matchMedia`: use each package's `stubMatchMedia`.

## Vue test: a key event on a just-opened menu does nothing, sometimes

- Symptom: a Vue test dispatching `keydown` right after opening a menu fails now and then (focus didn't move); the handler never runs.
- Cause: Vue stamps an event with `Date.now()` at the first handler it reaches, and any later handler attached at or after that stamp drops it (`e._vts <= invoker.attached`). The menu's handler gets re-attached a few ms after opening, so a key sent then is lost: 0 ms failed 6/80 runs, 2 ms 22/80, 5 ms none. Real key presses come much later.
- Fix: wait 10 ms before dispatching (the Vue tests' `tick` helpers do).

## Session dies during browser checks: OOM-killed Chromium

- Symptom: the terminal running Claude Code closes mid-task; `journalctl -k` shows `Out of memory: Killed process … (chromium-browse)` and the terminal's scope `Failed with result 'oom-kill'`.
- Cause: pages opened by `browser_run_code_unsafe` scripts and never closed (a step threw before `close()`) piled up to ~12 GB of Chromium; each held `#huge-dataset`'s 200k rows, which the demos now build only once that section scrolls into view.
- Fix: close pages in `try/finally` (`scripts/ux-measure.mjs` and `scripts/ux-step.mjs` do), reuse one page, and don't run several browser-driving agents at once.

## Demo type-check: "has no exported member" from a core sub-path

- Symptom: `npm run type-check` fails in `demo/*` with `Module '"@vates/data-table-core/internal"' has no exported member …` for a new core export, while every package type-checks.
- Cause: a demo's `tsconfig.json` `paths` lacked that sub-path, so the adapter source it compiles resolved it through core's stale built `dist/`.
- Fix: each demo maps every `@vates/data-table-core` sub-path (and vanilla's `@vates/data-table-solid`) to source; add new sub-paths there too.

## Pre-commit `size` passes locally, fails in CI

- Cause: an incrementally updated `node_modules` drifts from `package-lock.json` (different hoisting than `npm ci`).
- Fix: `.husky/post-merge`/`post-checkout` run `npm ci` when the lockfile changes; run `npm ci` manually if in doubt.

## A new label fails pre-commit `size` (vue, solid, vanilla)

- Symptom: `Package size limit has exceeded by N B` after adding a `DataTableLabels` key.
- Cause: each adapter's main entry re-exports every locale (`export * from '@vates/data-table-core/locales'`), so a label costs its string in all 5 locales; consumers tree-shake the unused ones, `size-limit` doesn't.
- Fix: budget about 5× the string per label; raising a limit needs approval.

## Vue boolean prop silently `false` when omitted

- Cause: Vue casts an absent boolean prop with no `withDefaults` default to `false`, not `undefined`.
- Fix: spell out the default in `withDefaults` in both `DataTable.vue` and `DataTableView.vue` (e.g. `showSearch: true`, `defaultGroupsCollapsed`).

## New `DataTableViewProps` field inert through `<DataTable>` (React/Solid)

- Cause: `DataTable.tsx` forwards props explicitly, not via spread.
- Fix: add a matching line at each `<DataTable>` wrapper's `<DataTableView>` call site; test through `<DataTable>`, not only `<DataTableView>`.

## React test grabs the wrong search box

- Cause: global search and the Filter dropdown's search share the `'Search…'` placeholder; global search comes first in DOM order.
- Fix: take the last `getAllByPlaceholderText('Search…')` match for the filter's box.

## Solid/vanilla tests: no DOM reactivity under Vitest

- Cause: Vitest's node-oriented resolution picks solid-js's SSR build.
- Fix: `conditions: ['browser']` in `vitest.config.ts` (see its comment).

## React tests: duplicate React instance / invalid hook call

- Cause: `react` is also a devDep of the package in the workspace.
- Fix: `resolve.dedupe: ['react', 'react-dom', 'react/jsx-runtime']` in `packages/react/vitest.config.ts`.

## E2E test hangs until "Test timeout of 30000ms exceeded"

- Symptom: a Playwright test stalls on a read like `getAttribute` or `innerText`, then fails at the test timeout, often reported on a later line.
- Cause: locator reads wait for the element to exist; a selector matching nothing waits the whole test timeout, even inside `.catch()`.
- Fix: check `isVisible()` or `count()` first (they don't wait), or pass `{ timeout }` to the read.

## E2E or a UX script fails with "Outdated Vite deps"

- Symptom: `npm run e2e` fails every test, or a `scripts/ux-step.mjs`/`scripts/ux-measure.mjs` script throws, with "Outdated Vite deps: restart the dev server" (before that check, each timed out finding the table). The browser got "504 (Outdated Optimize Dep)" for `node_modules/.vite/deps/…`.
- Cause: a demo dev server left running (E2E reuses the one on 58983) whose Vite dependency cache predates an `npm ci` (or a lockfile change).
- Fix: restart that dev server (`npm run dev:<demo>`, as the error names).

## E2E geometry check passes locally, fails in CI

- Symptom: a phone E2E check like `expect(box.x + box.width).toBeLessThanOrEqual(width)` fails only in CI ("Received: 390.625"), on retry too.
- Cause: CI's Linux fonts give different text widths, so controls shift differently; a layout bug that local metrics happen to hide (here: a dropdown's clamp measured once at open, then its trigger moved) shows up there.
- Fix: find the layout dependency rather than loosening the check; probing positions step by step locally shows what moves.

## Unit tests fail in CI with "webidl.util.markAsUncloneable is not a function"

- Cause: jsdom 30 needs Node `^22.22.2 || ^24.15.0 || >=26` (its undici, `>=22.19.0`); CI ran an older Node.
- Fix: workflows take Node from the root `package.json`'s `engines.node` (`node-version-file`); keep that range in line with jsdom's.
