import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    react(),
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
      name: 'DataTableReact',
      fileName: 'data-table-react',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: [
        'react',
        'react/jsx-runtime',
        'react-dom',
        '@vates/data-table-core',
        '@vates/data-table-core/internal',
      ],
      output: {
        globals: {
          react: 'React',
          'react/jsx-runtime': 'ReactJSXRuntime',
          'react-dom': 'ReactDOM',
          '@vates/data-table-core': 'DataTableCore',
          '@vates/data-table-core/internal': 'DataTableCore',
        },
      },
    },
  },
})
