import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatResults } from '../perf-core.mjs'

test('formats each case, before → after when saved results are given', () => {
  const after = [{ case: 'search', instructionsM: 120, allocatedMB: 0.4, retainedMB: 0.1 }]
  const before = [{ case: 'search', instructionsM: 2425, allocatedMB: 147, retainedMB: 0.1 }]
  assert.match(formatResults(after, before), /search +2425 → 120 +147 → 0\.4 +0\.1 → 0\.1/)
})

test('shows a dash for instructions measured without perf', () => {
  assert.match(
    formatResults([{ case: 'copy', allocatedMB: 1.6, retainedMB: 1.6 }]),
    /copy +— +1\.6/,
  )
})
