import assert from 'node:assert/strict'
import { test } from 'node:test'
import { missingEntry, structureProblems } from '../check-changelog.mjs'

const changelog = (unreleased) =>
  `# Changelog\n\n## [Unreleased]\n${unreleased}\n## [0.1.0] - 2026-01-01\n\n### Docs\n\n- old\n`

test('accepts an empty Unreleased and Keep a Changelog sections, ignoring releases', () => {
  assert.deepEqual(structureProblems(changelog('')), [])
  assert.deepEqual(structureProblems(changelog('\n### Added\n\n- a\n\n### Fixed\n\n- b\n')), [])
})

test('flags a repeated or unknown subsection, and a missing Unreleased', () => {
  assert.deepEqual(structureProblems(changelog('\n### Fixed\n\n- a\n\n### Docs\n\n### Fixed\n')), [
    'repeated "### Fixed"',
    '"### Docs" isn\'t one of Added, Changed, Deprecated, Removed, Fixed, Security',
  ])
  assert.deepEqual(structureProblems('# Changelog\n\n## [0.1.0]\n'), [
    'no "## [Unreleased]" section before the first release',
  ])
})

test('source changes outside tests need an entry', () => {
  assert.equal(missingEntry(['packages/core/src/sort.ts']), true)
  assert.equal(missingEntry(['demo/vue/src/App.vue']), true)
  assert.equal(missingEntry(['packages/core/src/sort.ts', 'CHANGELOG.md']), false)
  assert.equal(missingEntry(['packages/core/src/__tests__/sort.test.ts']), false)
  assert.equal(missingEntry(['scripts/check.mjs', 'docs/sorting.md']), false)
})
