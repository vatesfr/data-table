import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  base: process.env.VITE_BASE_URL ?? '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@vates/flexi-table-core': resolve(__dirname, '../../packages/core/src'),
      '@vates/flexi-table-react': resolve(__dirname, '../../packages/react/src/index.ts'),
    },
  },
})
