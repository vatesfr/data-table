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
        index: resolve(import.meta.dirname, 'src/index.ts'),
        theme: resolve(import.meta.dirname, 'src/theme.ts'),
      },
      // Entry `index` keeps the bundled types at dist/index.d.ts; the main JS keeps the package name.
      fileName: (format, name) =>
        `${name === 'index' ? 'data-table-solid' : name}.${format === 'es' ? 'js' : 'cjs'}`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      // Unlike @vates/data-table-vanilla (which bundles solid-js as an internal implementation
      // detail so non-Solid consumers never install it), this package's whole point is to share
      // the *consuming app's own* solid-js instance — two separate bundled copies wouldn't just
      // cost bytes, Solid's reactivity tracking is module-scoped, so a signal created by one copy
      // is invisible to a computation running in the other. solid-js must stay a real peer/external
      // dependency here, same as react/react-dom in packages/react — sub-paths included, or
      // solid-js/web's browser build gets bundled (and touches `window` on import under Node).
      external: [
        'solid-js',
        'solid-js/web',
        '@vates/data-table-core',
        '@vates/data-table-core/internal',
        '@vates/data-table-core/theme',
      ],
    },
  },
})
