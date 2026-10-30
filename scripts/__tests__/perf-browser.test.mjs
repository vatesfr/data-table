import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatSummary, summarize } from '../perf-browser.mjs'

const run = (n, demo, ms, load1 = 1) => ({
  run: n,
  demo,
  load1,
  steps: [
    { name: 'S2 sort', ms },
    { name: 'S4 open', error: 'Timeout' },
  ],
})

test('summarizes quiet runs per step and demo, skipping warm-up, loaded and failed steps', () => {
  const runs = [
    run(0, 'solid', 900),
    run(1, 'solid', 300),
    run(2, 'solid', 320),
    run(3, 'solid', 310),
    run(4, 'solid', 800, 5),
    { run: 5, demo: 'solid', load1: 1, error: 'crashed' },
  ]
  assert.deepEqual(summarize(runs), {
    'S2 sort': { solid: { median: 310, q1: 300, q3: 310, n: 3 } },
  })
})

test('formats before → after per demo, with a dash where a demo has no runs', () => {
  const before = summarize([run(1, 'react', 300), run(1, 'solid', 400)])
  const after = summarize([run(1, 'react', 200)])
  const out = formatSummary(after, before)
  assert.match(out, /S2 sort +300 \[300-300\] → 200 \[200-200\]/)
  assert.doesNotMatch(out, /solid/)
})
