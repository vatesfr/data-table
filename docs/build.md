# Build and cross-package resolution

## Cross-package resolution in development

Packages and demo apps resolve each other without a build step via:

- **`tsconfig.json` `paths`** — maps `@vates/data-table-core` → `../core/src/index.ts`, `@vates/data-table-core/locales` → `../core/src/locales.ts`, and (solid only, the sole consumer) `@vates/data-table-core/theme` → `../core/src/theme.ts` for type checking. `packages/vanilla/tsconfig.json` additionally maps `@vates/data-table-solid` → `../solid/src/index.ts`, so `tsc --noEmit` type-checks against solid's source without needing its `dist/` built first.
- **`vite.config.ts` `resolve.alias`** — maps `@vates/data-table-core` to the `packages/core/src` **directory** (not `index.ts`) so Vite's prefix substitution resolves the bare import and any sub-path (`/locales`, `/theme`) correctly. `packages/vanilla/vitest.config.ts` has the equivalent alias for `@vates/data-table-solid` → `../solid/src` — but only in the _test_ config, not `vite.config.ts` itself: unlike `@vates/data-table-core` (always external, so its production build never actually resolves the import), `@vates/data-table-solid` is bundled into vanilla's `dist/` (see [Vanilla package](packages.md#vanilla-package-packagesvanilla)), which means the production build genuinely needs its real built output, not source aliased in — hence the build-order requirement below.

- **`demo/vanilla`** also aliases `@vates/data-table-solid` to `packages/solid/src`, which `packages/vanilla/src` imports; without it the demo ran Solid's last build, so it showed stale Solid code and reloaded mid-check after each rebuild.

In production, `npm run build` must run `core` before `react`, `vue`, and `solid` (all three import from its `dist/`), and `solid` before `vanilla` (which bundles `@vates/data-table-solid`'s own `dist/` into its own).

Root `package.json` pins `typescript` via `overrides` — see [pitfalls](pitfalls.md#empty-distindexdts-after-a-dependency-bump).
