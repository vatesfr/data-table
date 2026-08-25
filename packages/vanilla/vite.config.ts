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
    lib: {
      // Only the main entry point here — a UMD/IIFE build (needed so this package still works as a
      // plain <script> global, unlike core/react/vue/solid which only ever ship es+cjs) can't have
      // more than one entry point (Rollup restriction), so the `/theme` sub-path re-export is built
      // by a separate `vite.theme.config.ts` pass instead (es+cjs only, no umd) — see that file and
      // this package.json's `build` script.
      entry: resolve(import.meta.dirname, 'src/index.tsx'),
      name: 'DataTableVanilla',
      fileName: 'data-table-vanilla',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      // solid-js AND @vates/data-table-solid (the package this one wraps — see index.tsx) are
      // deliberately NOT external here — both are bundled into dist/ as internal implementation
      // details (see package.json: both are devDependencies, not runtime ones), so a non-Solid
      // consumer never needs to install either themselves. Only @vates/data-table-core, the one
      // dependency genuinely shared across every adapter package, stays external.
      external: [
        '@vates/data-table-core',
        '@vates/data-table-core/theme',
        '@vates/data-table-core/internal',
      ],
      output: {
        globals: {
          '@vates/data-table-core': 'DataTableCore',
          '@vates/data-table-core/theme': 'DataTableCore',
          '@vates/data-table-core/internal': 'DataTableCore',
        },
      },
    },
  },
})
