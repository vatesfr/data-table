import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [dts({ include: ['src'], rollupTypes: true, insertTypesEntry: true })],
  build: {
    lib: {
      entry: {
        index: resolve(import.meta.dirname, 'src/index.ts'),
        locales: resolve(import.meta.dirname, 'src/locales.ts'),
        theme: resolve(import.meta.dirname, 'src/theme.ts'),
      },
      name: 'DataTableCore',
      formats: ['es', 'cjs'],
    },
  },
})
