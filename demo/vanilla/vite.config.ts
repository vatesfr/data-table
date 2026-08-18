import { defineConfig } from 'vite'
import { resolve } from 'path'
import solid from 'vite-plugin-solid'

export default defineConfig({
  base: process.env.VITE_BASE_URL ?? '/',
  // Resolving straight to packages/vanilla/src (not a built dist) means this demo also needs to
  // process the package's own .tsx source directly — same solid() plugin the package's own
  // vite.config.ts uses. This is purely a dev/demo-build concern: a real consumer installing
  // @vates/data-table-vanilla from npm only ever sees the pre-built, already-compiled dist/, with
  // no Solid-authoring detail leaking into their own toolchain.
  plugins: [solid()],
  resolve: {
    alias: {
      '@vates/data-table-core': resolve(__dirname, '../../packages/core/src'),
      '@vates/data-table-vanilla': resolve(__dirname, '../../packages/vanilla/src/index.tsx'),
    },
  },
})
