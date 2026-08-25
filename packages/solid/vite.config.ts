import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [
    // Must run before vite-plugin-dts so .tsx sources are compiled before declaration rollup.
    solid(),
    dts({ include: ['src'], insertTypesEntry: true, rollupTypes: true, pathsToAliases: false }),
  ],
  build: {
    // Terser over Vite's default esbuild minifier: negligible difference on the UMD build, but
    // ~12% smaller gzipped on the ES build specifically — the one most real consumers actually
    // pull in (any bundler resolves `exports.import`/`module`, not `main`/UMD). Property mangling
    // deliberately left off — safe for local variable/function names, not for object keys without
    // auditing every dynamic property access first. Matches packages/vanilla's own reasoning,
    // applied here too since the gain is real even without a checked-in size budget forcing it.
    minify: 'terser',
    lib: {
      // Only the main entry point here — a UMD build (this package's `main` field, so it still
      // works as a plain <script> global) can't have more than one entry point (Rollup
      // restriction), so the `/theme` sub-path re-export is built by a separate
      // `vite.theme.config.ts` pass instead (es+cjs only, no umd) — see that file and this
      // package.json's `build` script.
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'DataTableSolid',
      fileName: 'data-table-solid',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      // Unlike @vates/data-table-vanilla (which bundles solid-js as an internal implementation
      // detail so non-Solid consumers never install it), this package's whole point is to share
      // the *consuming app's own* solid-js instance — two separate bundled copies wouldn't just
      // cost bytes, Solid's reactivity tracking is module-scoped, so a signal created by one copy
      // is invisible to a computation running in the other. solid-js must stay a real peer/external
      // dependency here, same as react/react-dom in packages/react.
      external: ['solid-js', '@vates/data-table-core', '@vates/data-table-core/internal'],
      output: {
        globals: {
          'solid-js': 'Solid',
          '@vates/data-table-core': 'DataTableCore',
          '@vates/data-table-core/internal': 'DataTableCore',
        },
      },
    },
  },
})
