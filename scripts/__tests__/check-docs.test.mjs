import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { test } from 'node:test'
import { codeNames, headingSlugs, repoFiles, staleRefs } from '../check-docs.mjs'

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
  workspaceScripts: (w) => (w === 'packages/core' ? new Set(['size']) : new Set(['size', 'test'])),
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
      '`npm run dev:react|vue` `npm run dev:<demo>` `npm run size -w packages/core` `npm run test -w packages/X`',
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

test('repo files skip a tracked file deleted but not staged', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'check-docs-'))
  t.after(() => rmSync(dir, { recursive: true }))
  // Under the pre-commit hook, an inherited GIT_INDEX_FILE would make `git add` write the real index.
  for (const k of Object.keys(process.env)) if (k.startsWith('GIT_')) delete process.env[k]
  const git = (...args) => execFileSync('git', args, { cwd: dir })
  git('init', '-q')
  for (const f of ['kept.ts', 'gone.ts', 'new.ts']) writeFileSync(join(dir, f), '')
  git('add', 'kept.ts', 'gone.ts')
  rmSync(join(dir, 'gone.ts'))
  assert.deepEqual(repoFiles(dir).sort(), ['kept.ts', 'new.ts'])
})

test('code names are whole identifiers, hyphenated runs split at their hyphens', () => {
  const names = codeNames("const anchored = 'dt-dd--up'\nimport x from './scripts/check-docs.mjs'")
  assert.equal(names.has('chore'), false)
  for (const n of ['anchored', 'dt-dd--up', 'dt-dd', 'dd--up', 'check-docs', 'scripts'])
    assert.ok(names.has(n), n)
})
