import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    vue(),
    dts({ include: ['src'], insertTypesEntry: true, rollupTypes: true, pathsToAliases: false }),
  ],
  build: {
    // Terser over Vite's default esbuild minifier: negligible difference on the UMD build, but
    // ~11% smaller gzipped on the ES build specifically — the one most real consumers actually
    // pull in (any bundler resolves `exports.import`/`module`, not `main`/UMD). Property mangling
    // deliberately left off — safe for local variable/function names, not for object keys without
    // auditing every dynamic property access first. Matches packages/vanilla's own reasoning,
    // applied here too since the gain is real even without a checked-in size budget forcing it.
    minify: 'terser',
    lib: {
      // Only the main entry point here — a UMD build (this package's `main` field, so it still
      // works as a plain <script> global) can't have more than one entry point (Rollup
      // restriction), so the `/theme` sub-path re-export is built by a separate
      // `vite.theme.config.ts` pass instead (es+cjs only, no umd) — see that file and this
      // package.json's `build` script.
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'DataTableVue',
      fileName: 'data-table-vue',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: ['vue', '@vates/data-table-core', '@vates/data-table-core/internal'],
      output: {
        globals: {
          vue: 'Vue',
          '@vates/data-table-core': 'DataTableCore',
          '@vates/data-table-core/internal': 'DataTableCore',
        },
      },
    },
  },
})
