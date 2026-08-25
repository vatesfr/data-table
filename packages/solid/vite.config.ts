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
      external: [
        'solid-js',
        '@vates/data-table-core',
        '@vates/data-table-core/theme',
        '@vates/data-table-core/dropdownDomUtils',
      ],
      output: {
        globals: {
          'solid-js': 'Solid',
          '@vates/data-table-core': 'DataTableCore',
          '@vates/data-table-core/theme': 'DataTableCore',
          '@vates/data-table-core/dropdownDomUtils': 'DataTableCore',
        },
      },
    },
  },
})
