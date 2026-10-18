import assert from 'node:assert/strict'
import { test } from 'node:test'
import { stepsFor } from '../check.mjs'

test('a full run lints and ends with e2e alone', () => {
  const stages = stepsFor('full')
  assert.ok(stages[0].includes('lint'))
  assert.deepEqual(stages.at(-1), ['e2e'])
})

test('a commit skips lint and e2e', () => {
  const steps = stepsFor('staged', ['packages/core/src/index.ts']).flat()
  assert.ok(!steps.includes('lint'))
  assert.ok(!steps.includes('e2e'))
  assert.ok(steps.includes('build'))
})

test('a docs-only commit runs only the doc checks', () => {
  assert.deepEqual(
    stepsFor('staged', ['docs/sorting.md', 'README.md', '.claude/skills/x/SKILL.md']),
    [['check:docs', 'check:use-cases']],
  )
})

test('a commit touching code alongside docs runs everything', () => {
  assert.ok(stepsFor('staged', ['docs/sorting.md', 'package.json']).flat().includes('test'))
})

test('a commit with no listed file runs everything', () => {
  assert.ok(stepsFor('staged', []).flat().includes('test'))
})

test('dist/ is built before the steps that read it', () => {
  const stages = stepsFor('full')
  const stageOf = (step) => stages.findIndex((s) => s.includes(step))
  assert.ok(stageOf('build') < stageOf('size'))
  assert.ok(stageOf('build') < stageOf('check:dist-types'))
})
