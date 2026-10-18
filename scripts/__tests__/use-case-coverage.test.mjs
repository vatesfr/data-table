import assert from 'node:assert/strict'
import { test } from 'node:test'
import { coverage, format, parseUseCases } from '../use-case-coverage.mjs'

const useCases = parseUseCases(`# Use cases

1. Not a step: before any use case.

## UC01 Find rows

1. Search.
2. Filter.
3. ◇ Save the search.

**Edges**: 1. not a step either.

## UC02 Group

1. Group.
`)

test('parses steps up to Edges, ◇ steps as targets', () => {
  assert.deepEqual([...useCases.keys()], ['UC01', 'UC02'])
  assert.deepEqual(
    [...useCases.get('UC01').steps],
    [
      [1, { target: false }],
      [2, { target: false }],
      [3, { target: true }],
    ],
  )
})

test('titles claim steps; regressions and other titles are listed apart', () => {
  const result = coverage(useCases, [
    'UC01.1-2 find',
    'UC02.1: group',
    'U21 on a phone',
    '#39 x',
    'axe',
  ])
  assert.deepEqual(result.problems, [])
  assert.deepEqual([...result.covered.get('UC01')], [1, 2])
  assert.deepEqual(result.regressions, ['U21 on a phone', '#39 x'])
  assert.deepEqual(result.other, ['axe'])
  assert.match(format(useCases, result), /^UC01 ★★◇ +Find rows$/m)
})

test('flags a missing step list, an unknown use case or step, and a ◇ step', () => {
  assert.deepEqual(coverage(useCases, ['UC01 find', 'UC09.1 x', 'UC02.2 y', 'UC01.3 z']).problems, [
    '"UC01 find": name the steps it walks (UC01.1-3 …)',
    '"UC09.1 x": no UC09 in docs/use-cases.md',
    '"UC02.2 y": UC02 has no step 2',
    '"UC01.3 z": UC01.3 is ◇ — drop the ◇ with it',
  ])
})
