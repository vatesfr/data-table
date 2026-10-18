import assert from 'node:assert/strict'
import { test } from 'node:test'
import { headingSlugs, staleRefs } from '../check-docs.mjs'

const files = {
  'docs/a.md': '# Title\n\n## `toolbarEnd` / slots (#18)\n\n## Title\n\n```\n# not a heading\n```',
  'packages/solid': null,
  'packages/solid/README.md': '## Theming',
  'scripts/check.mjs': '',
}
const ctx = {
  exists: (p) => p in files,
  isDir: (p) => files[p] === null,
  slugs: (p) => headingSlugs(files[p]),
  glob: (p) => Object.keys(files).filter((f) => new RegExp(`^${p.replace('*', '[^/]*')}$`).test(f)),
  rootScripts: new Set(['check', 'dev:react', 'dev:vue']),
  workspaceScripts: (w) =>
    w === 'packages/core' ? new Set(['bench']) : new Set(['bench', 'test']),
  ignored: new Set(),
}
const stale = (text, extra = {}) => staleRefs('docs/b.md', text, { ...ctx, ...extra })

test('heading slugs follow GitHub: punctuation dropped, repeats numbered, fences skipped', () => {
  assert.deepEqual(
    [...headingSlugs(files['docs/a.md'])],
    ['title', 'toolbarend--slots-18', 'title-1'],
  )
})

test('links resolve relative to the doc, directories through their README', () => {
  assert.deepEqual(stale('[a](a.md#title-1) [s](../packages/solid#theming) [x](https://x.y/z)'), [])
  assert.deepEqual(stale('[a](missing.md) [b](a.md#nope) [s](../packages/solid#nope)'), [
    'link to missing missing.md',
    'no heading #nope in docs/a.md',
    'no heading #nope in packages/solid/README.md',
  ])
})

test('npm scripts: alternatives, wildcards, workspaces and placeholder workspaces', () => {
  assert.deepEqual(
    stale(
      '`npm run dev:react|vue` `npm run dev:<demo>` `npm run bench -w packages/core` `npm run test -w packages/X`',
    ),
    [],
  )
  assert.deepEqual(stale('`npm run dev:react|solid` `npm run test -w packages/core`'), [
    'no npm script dev:solid',
    'no npm script test',
  ])
})

test('scripts/ paths must exist, globs allowed', () => {
  assert.deepEqual(stale('`scripts/check.mjs` `scripts/*.mjs` and packages/x/scripts/gone.sh'), [])
  assert.deepEqual(stale('`scripts/check.sh`'), ['no scripts/check.sh'])
})

test('check-docs-ignore covers link targets, script names and paths verbatim', () => {
  const ignored = new Set(['gone.md', 'dev:solid', 'scripts/check.sh'])
  assert.deepEqual(stale('[g](gone.md) `npm run dev:solid` `scripts/check.sh`', { ignored }), [])
})
