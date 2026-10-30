import assert from 'node:assert/strict'
import { test } from 'node:test'
import process from 'node:process'
import { diffRows, formatRows, jsonOutput } from '../size-diff.mjs'

const entry = (pkg, size, sizeLimit = 1000) => ({ pkg, name: 'bundle (gzip)', size, sizeLimit })

test('pairs entries by package and name, with delta and budget headroom', () => {
  const rows = diffRows([entry('react', 900)], [entry('react', 950), entry('vue', 1010)])
  assert.deepEqual(
    rows.map(({ pkg, before, delta, headroom }) => ({ pkg, before, delta, headroom })),
    [
      { pkg: 'react', before: 900, delta: 50, headroom: 50 },
      { pkg: 'vue', before: null, delta: null, headroom: -10 },
    ],
  )
})

test('formats a signed delta and a dash for an entry new in the working tree', () => {
  const out = formatRows(diffRows([entry('react', 900)], [entry('react', 950), entry('vue', 10)]))
  assert.match(out, /react bundle \(gzip\) +900 +950 +\+50 +50/)
  assert.match(out, /vue bundle \(gzip\) +— +10 +— +990/)
})

test('reads JSON from a command that exits non-zero, as size-limit does over budget', () => {
  const script = 'console.log(\'[{"size":1}]\'); process.exit(1)'
  assert.deepEqual(jsonOutput(process.execPath, ['-e', script]), [{ size: 1 }])
})
