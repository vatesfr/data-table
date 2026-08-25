import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  base: process.env.VITE_BASE_URL ?? '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@vates/data-table-core': resolve(import.meta.dirname, '../../packages/core/src'),
      '@vates/data-table-react': resolve(import.meta.dirname, '../../packages/react/src'),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
})
