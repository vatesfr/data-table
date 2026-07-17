import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  base: process.env.VITE_BASE_URL ?? '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@vates/data-table-core': resolve(__dirname, '../../packages/core/src'),
      '@vates/data-table-react': resolve(__dirname, '../../packages/react/src/index.ts'),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
})
