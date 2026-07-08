import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  base: process.env.VITE_BASE_URL ?? '/',
  resolve: {
    alias: {
      '@vates/data-table-core': resolve(__dirname, '../../packages/core/src'),
      '@vates/data-table-vanilla': resolve(__dirname, '../../packages/vanilla/src/index.ts'),
    },
  },
})
