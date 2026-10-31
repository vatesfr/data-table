import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      include: ['src'],
      insertTypesEntry: true,
      pathsToAliases: false,
      // API Extractor reads tsconfig `paths` itself: unset them so core stays an external import.
      bundleTypes: {
        extractorConfig: { compiler: { overrideTsconfig: { compilerOptions: { paths: null } } } },
      },
    }),
  ],
  build: {
    // Terser: smaller gzipped output than esbuild; no property mangling (object keys unaudited)
    minify: 'terser',
    lib: {
      // A UMD build allows one entry: `/theme` builds via ../vite.theme.config.mts
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
