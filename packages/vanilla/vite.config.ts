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
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'DataTableVanilla',
      fileName: 'data-table-vanilla',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      // solid-js is deliberately NOT external here — it's bundled into dist/ as an internal
      // implementation detail (see package.json: it's a devDependency, not a runtime one), so
      // consumers never need to install it themselves. Only @vates/data-table-core, the one
      // dependency genuinely shared across all four adapter packages, stays external.
      external: ['@vates/data-table-core', '@vates/data-table-core/theme'],
      output: {
        globals: {
          '@vates/data-table-core': 'DataTableCore',
          '@vates/data-table-core/theme': 'DataTableCore',
        },
      },
    },
  },
})
