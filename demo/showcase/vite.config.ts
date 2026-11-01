import { defineConfig } from 'vite'
import { resolve } from 'path'
import solid from 'vite-plugin-solid'

// One HTML document per page: theme tokens are document-wide, so a page's style can't leak into another
const PAGES = ['infra', 'ledger', 'logs', 'catalog', 'sports', 'users']

export default defineConfig({
  base: process.env.VITE_BASE_URL ?? '/',
  server: { port: 58985, strictPort: true },
  plugins: [solid()],
  resolve: {
    alias: {
      '@vates/data-table-core': resolve(import.meta.dirname, '../../packages/core/src'),
      '@vates/data-table-solid': resolve(import.meta.dirname, '../../packages/solid/src/index.ts'),
    },
  },
  build: {
    rollupOptions: {
      input: Object.fromEntries([
        ['index', resolve(import.meta.dirname, 'index.html')],
        ...PAGES.map((p) => [p, resolve(import.meta.dirname, `${p}/index.html`)]),
      ]),
    },
  },
})
