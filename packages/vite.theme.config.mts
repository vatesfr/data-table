import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

// Each adapter's `/theme` sub-path (a re-export of `@vates/data-table-core/theme`), run from the
// package's directory: a separate pass because Rollup allows a single entry in a "umd" build.
export default defineConfig({
  plugins: [dts({ include: ['src/theme.ts'], entryRoot: 'src', pathsToAliases: false })],
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve('src/theme.ts'),
      fileName: 'theme',
      formats: ['es', 'cjs'],
    },
    rollupOptions: { external: ['@vates/data-table-core/theme'] },
  },
})
