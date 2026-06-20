import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [react(), dts({ include: ['src'], insertTypesEntry: true, rollupTypes: true, pathsToAliases: false })],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'FlexiTableReact',
      fileName: 'flexi-table-react',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: ['react', 'react/jsx-runtime', 'react-dom', '@vates/flexi-table-core'],
      output: {
        globals: {
          react: 'React',
          'react/jsx-runtime': 'ReactJSXRuntime',
          'react-dom': 'ReactDOM',
          '@vates/flexi-table-core': 'FlexiTableCore',
        },
      },
    },
  },
})
