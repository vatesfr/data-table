// Loads each adapter's built CommonJS entries the way a `require()` consumer does. Run after `npm run build`,
// with `--conditions=browser`: otherwise solid-js resolves to its server build, which throws on load.
import assert from 'node:assert'
import { createRequire } from 'node:module'
import { JSDOM } from 'jsdom'

const require = createRequire(import.meta.url)

// solid-js/web and the vanilla bundle touch the DOM on load: give them a browser-like global scope.
const { window } = new JSDOM('')
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'Element'])
  globalThis[key] ??= window[key]

const expected = {
  react: 'DataTable',
  vue: 'DataTable',
  solid: 'DataTable',
  vanilla: 'createDataTable',
}
for (const [pkg, name] of Object.entries(expected)) {
  const main = require(`@vates/data-table-${pkg}`)
  const theme = require(`@vates/data-table-${pkg}/theme`)
  assert.ok(main[name], `@vates/data-table-${pkg} exports ${name}`)
  assert.equal(typeof theme.renderThemeCss, 'function', `@vates/data-table-${pkg}/theme`)
}
