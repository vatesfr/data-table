import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [
    // Must run before vite-plugin-dts so .tsx sources are compiled before declaration rollup.
    solid(),
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
        index: resolve(import.meta.dirname, 'src/index.tsx'),
        theme: resolve(import.meta.dirname, 'src/theme.ts'),
      },
      // Entry `index` keeps the bundled types at dist/index.d.ts; the main JS keeps the package name.
      fileName: (format, name) =>
        `${name === 'index' ? 'data-table-vanilla' : name}.${format === 'es' ? 'js' : 'cjs'}`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      // solid-js AND @vates/data-table-solid (the package this one wraps — see index.tsx) are
      // deliberately NOT external here — both are bundled into dist/ as internal implementation
      // details (see package.json: both are devDependencies, not runtime ones), so a non-Solid
      // consumer never needs to install either themselves. Only @vates/data-table-core, the one
      // dependency genuinely shared across every adapter package, stays external.
      external: [
        '@vates/data-table-core',
        '@vates/data-table-core/theme',
        '@vates/data-table-core/internal',
      ],
    },
  },
})
