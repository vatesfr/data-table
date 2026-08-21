import { defineConfig } from 'vite'
import { resolve } from 'path'
import solid from 'vite-plugin-solid'

export default defineConfig({
  base: process.env.VITE_BASE_URL ?? '/',
  plugins: [solid()],
  resolve: {
    alias: {
      '@vates/data-table-core': resolve(import.meta.dirname, '../../packages/core/src'),
      '@vates/data-table-solid': resolve(import.meta.dirname, '../../packages/solid/src/index.ts'),
    },
  },
})
