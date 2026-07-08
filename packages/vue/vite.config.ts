import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    vue(),
    dts({ include: ['src'], insertTypesEntry: true, rollupTypes: true, pathsToAliases: false }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'DataTableVue',
      fileName: 'data-table-vue',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: ['vue', '@vates/data-table-core'],
      output: {
        globals: {
          vue: 'Vue',
          '@vates/data-table-core': 'DataTableCore',
        },
      },
    },
  },
})
