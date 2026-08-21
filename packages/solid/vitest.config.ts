import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: {
      '@vates/data-table-core': resolve(import.meta.dirname, '../core/src'),
    },
    // vite-plugin-solid needs the "solid" export condition resolved to solid-js's client-side
    // build even under Vitest's default (node-oriented) test transform — without it, imports
    // resolve to the server/SSR build, which doesn't wire up DOM reactivity for jsdom tests.
    conditions: ['browser'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
