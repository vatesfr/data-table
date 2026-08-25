import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  base: process.env.VITE_BASE_URL ?? '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@vates/data-table-core': resolve(import.meta.dirname, '../../packages/core/src'),
      '@vates/data-table-vue/theme': resolve(
        import.meta.dirname,
        '../../packages/vue/src/theme.ts',
      ),
      '@vates/data-table-vue': resolve(import.meta.dirname, '../../packages/vue/src/index.ts'),
    },
  },
})
