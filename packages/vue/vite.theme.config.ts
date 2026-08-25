import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

// Builds this package's `/theme` sub-path (a plain re-export of
// `@vates/data-table-core/theme`) as a separate pass from `vite.config.ts`'s main build — Rollup
// disallows multiple entry points when the output formats include "umd"/"iife", and the main build
// needs "umd" (so `@vates/data-table-vue` still works as a plain <script> global), so this entry
// only ships "es"/"cjs", matching every other adapter package's own sub-path exports
// (`@vates/data-table-core/locales`, `/theme`, `/internal`).
export default defineConfig({
  plugins: [dts({ include: ['src/theme.ts'], rollupTypes: true, insertTypesEntry: true })],
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/theme.ts'),
      name: 'DataTableVueTheme',
      fileName: 'theme',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['@vates/data-table-core/theme'],
      output: {
        globals: {
          '@vates/data-table-core/theme': 'DataTableCore',
        },
      },
    },
  },
})
