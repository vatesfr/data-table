import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [dts({ include: ['src'], insertTypesEntry: true, rollupTypes: true })],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'FlexiTableVanilla',
      fileName: 'flexi-table-vanilla',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: ['@vates/flexi-table-core'],
      output: {
        globals: {
          '@vates/flexi-table-core': 'FlexiTableCore',
        },
      },
    },
  },
})
