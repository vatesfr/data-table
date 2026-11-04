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
      entry: {
        index: resolve(import.meta.dirname, 'src/index.ts'),
        theme: resolve(import.meta.dirname, 'src/theme.ts'),
      },
      // Entry `index` keeps the bundled types at dist/index.d.ts; the main JS keeps the package name.
      fileName: (format, name) =>
        `${name === 'index' ? 'data-table-react' : name}.${format === 'es' ? 'js' : 'cjs'}`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [
        'react',
        'react/jsx-runtime',
        'react-dom',
        '@vates/data-table-core',
        '@vates/data-table-core/internal',
        '@vates/data-table-core/theme',
      ],
    },
  },
})
