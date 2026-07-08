import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
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
      external: ['@vates/data-table-core'],
      output: {
        globals: {
          '@vates/data-table-core': 'DataTableCore',
        },
      },
    },
  },
})
