import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatRows, median } from '../bench-ab.mjs'

test('median of an odd and an even count', () => {
  assert.equal(median([5, 1, 3]), 3)
  assert.equal(median([4, 1, 3, 2]), 2.5)
})

test('formats median (min–max), speedup, a difference and a skipped scenario', () => {
  const out = formatRows([
    { name: 'sort', before: [100, 90, 110], after: [50, 40, 60] },
    { name: 'search', before: [10], after: [10], differs: true },
    { name: 'old ref', skipped: 'L.sortData is not a function' },
  ])
  assert.match(out, /sort +100 \(90–110\) +50 \(40–60\) +2\.00x/)
  assert.match(out, /search .*1\.00x +results differ/)
  assert.match(out, /old ref +skipped \(L\.sortData is not a function\)/)
})
