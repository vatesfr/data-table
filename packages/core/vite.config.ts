import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [dts({ include: ['src'], rollupTypes: true, insertTypesEntry: true })],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        locales: resolve(__dirname, 'src/locales.ts'),
      },
      name: 'DataTableCore',
      formats: ['es', 'cjs'],
    },
  },
})
