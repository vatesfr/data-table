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
      name: 'FlexiTableVue',
      fileName: 'flexi-table-vue',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: ['vue', '@vates/flexi-table-core'],
      output: {
        globals: {
          vue: 'Vue',
          '@vates/flexi-table-core': 'FlexiTableCore',
        },
      },
    },
  },
})
