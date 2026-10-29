#!/usr/bin/env node
// Costs of core's pipeline functions on a synthetic dataset, independent of machine load: bytes
// allocated per call and retained by its result (heap deltas, GC held off), and instructions per
// call when Linux `perf` is installed. Each case runs in a fresh Node process.
//   node scripts/perf-core.mjs [--rows=200000] [--out=<file.json>] [--compare=<file.json>] [case…]
//   --out      save the results, e.g. before a change
//   --compare  print before → after against results saved with --out
import { execFileSync, spawnSync } from 'node:child_process'
import console from 'node:console'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { setTimeout } from 'node:timers'
import { fileURLToPath } from 'node:url'
import { PerformanceObserver } from 'node:perf_hooks'

const CORE = join(dirname(fileURLToPath(import.meta.url)), '../packages/core/src')
const ITERATIONS = 5

// Each takes the dataset, the core logic module and the bench columns; `index` caches the search
// index across calls, so `search` measures a keystroke, not the first one.
const CASES = {
  copy: (d, L, C) => L.processData(d, {}, {}, [], C),
  sortString: (d, L, C) => L.processData(d, {}, {}, [{ key: 'name', dir: 'asc' }], C),
  sortNumber: (d, L, C) => L.processData(d, {}, {}, [{ key: 'price', dir: 'asc' }], C),
  sortDate: (d, L, C) => L.processData(d, {}, {}, [{ key: 'createdAt', dir: 'asc' }], C),
  filterSort: (d, L, C) =>
    L.processData(d, { status: new Set(['active']) }, {}, [{ key: 'price', dir: 'desc' }], C),
  searchIndex: (d, L, C) => L.buildSearchIndex(d, C),
  search: (d, L, C, cache) =>
    L.searchData(d, 'category 7', (cache.index ??= L.buildSearchIndex(d, C))),
  groupData: (d, L, C) => L.groupData(d, ['category'], C),
  groupVisible: (d, L, C) => L.getVisibleRows(L.groupData(d, ['category'], C), new Set(), false),
  stringValues: (d, L, C) =>
    L.computeStringValues(
      d,
      C.find((c) => c.key === 'name'),
    ),
  valueCounts: (d, L, C) =>
    L.computeStringValueCounts(d, {}, {}, [C.find((c) => c.key === 'category')]),
  dateTree: (d, L) => L.computeDateTree([...new Set(d.map((r) => r.createdAt))]),
}

async function load(rows) {
  const L = await import(join(CORE, 'logic.ts'))
  const { makeDataset, benchColumns } = await import(join(CORE, '__tests__/bench-utils.ts'))
  // Round-tripped through JSON so strings are flat, as in data an app parses
  return { L, C: benchColumns, data: JSON.parse(JSON.stringify(makeDataset(rows))) }
}

// Child: heap allocated by one call (young generation sized so no GC runs during it) and retained
// by its result. Garbage from module evaluation is only freed after a tick, hence `settle`.
async function measureMemory(name, rows) {
  const gc = globalThis.gc
  const settle = async () => {
    await new Promise((r) => setTimeout(r))
    gc()
    gc()
  }
  let gcs = 0
  new PerformanceObserver((l) => (gcs += l.getEntries().length)).observe({ entryTypes: ['gc'] })
  const { L, C, data } = await load(rows)
  const cache = {}
  CASES[name](data, L, C, cache)
  await settle()
  const before = process.memoryUsage().heapUsed
  gcs = 0
  globalThis.kept = CASES[name](data, L, C, cache)
  const allocated = process.memoryUsage().heapUsed - before
  const gcDuringCall = gcs
  await settle()
  const retained = process.memoryUsage().heapUsed - before
  console.log(JSON.stringify({ allocated, retained, gcDuringCall }))
}

// Child: runs a case `iterations` times after one warm-up call, for `perf stat` to count
async function runIterations(name, rows, iterations) {
  const { L, C, data } = await load(rows)
  const cache = {}
  CASES[name](data, L, C, cache)
  for (let i = 0; i < iterations; i++) globalThis.kept = CASES[name](data, L, C, cache)
}

function child(args, perf) {
  const node = [
    '--expose-gc',
    '--max-semi-space-size=1024',
    '--min-semi-space-size=1024',
    fileURLToPath(import.meta.url),
    ...args,
  ]
  const cmd = perf ? 'perf' : process.execPath
  const argv = perf ? ['stat', '-x,', '-e', 'instructions:u', process.execPath, ...node] : node
  const res = spawnSync(cmd, argv, { encoding: 'utf8' })
  if (res.status !== 0) throw new Error(`${name(args)} failed: ${res.stderr}`)
  return res
}
const name = (args) => args.find((a) => !a.startsWith('--'))

const instructionsOf = (stderr) =>
  Number(
    stderr
      .split('\n')
      .find((l) => l.includes('instructions'))
      ?.split(',')[0],
  )

export function hasPerf() {
  try {
    execFileSync('perf', ['stat', '-x,', '-e', 'instructions:u', 'true'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function measureCase(caseName, rows, perf) {
  const mem = JSON.parse(child(['--memory', caseName, `--rows=${rows}`]).stdout)
  const result = {
    case: caseName,
    allocatedMB: +(mem.allocated / 1e6).toFixed(1),
    retainedMB: +(mem.retained / 1e6).toFixed(1),
    // A GC during the call makes `allocated` an undercount
    gcDuringCall: mem.gcDuringCall,
  }
  if (perf) {
    const count = (n) =>
      instructionsOf(child(['--iterations', caseName, `--rows=${rows}`, `--n=${n}`], true).stderr)
    result.instructionsM = Math.round((count(ITERATIONS) - count(0)) / ITERATIONS / 1e6)
  }
  return result
}

export function formatResults(after, before = []) {
  const cols = ['instructionsM', 'allocatedMB', 'retainedMB']
  const cell = (b, a) => (b === undefined ? String(a ?? '—') : `${b} → ${a ?? '—'}`)
  const lines = after.map((r) => {
    const b = before.find((x) => x.case === r.case) ?? {}
    return [r.case.padEnd(14), ...cols.map((c) => cell(b[c], r[c]).padStart(18))].join(' ')
  })
  const head = ['case'.padEnd(14), ...cols.map((c) => c.padStart(18))].join(' ')
  return [head, ...lines].join('\n')
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const opt = (key) => args.find((a) => a.startsWith(`--${key}=`))?.split('=')[1]
  const rows = Number(opt('rows') ?? 200_000)
  if (args.includes('--memory')) await measureMemory(name(args), rows)
  else if (args.includes('--iterations')) await runIterations(name(args), rows, Number(opt('n')))
  else {
    const start = Date.now()
    const picked = args.filter((a) => !a.startsWith('--'))
    if (picked.some((c) => !(c in CASES))) {
      console.error(`Cases: ${Object.keys(CASES).join(', ')}`)
      process.exit(1)
    }
    const perf = hasPerf()
    if (!perf) console.error('perf unavailable: instructions skipped (dnf/apt install perf)')
    const results = (picked.length ? picked : Object.keys(CASES)).map((c) =>
      measureCase(c, rows, perf),
    )
    const compare = opt('compare')
    console.log(formatResults(results, compare ? JSON.parse(readFileSync(compare, 'utf8')) : []))
    if (opt('out')) writeFileSync(opt('out'), JSON.stringify(results, null, 1))
    const logs = join(homedir(), '.claude/logs')
    if (existsSync(logs))
      appendFileSync(
        join(logs, 'perf-core.jsonl'),
        JSON.stringify({
          date: new Date().toISOString(),
          rows,
          cases: results.length,
          perf,
          gcDuringCall: results.filter((r) => r.gcDuringCall).length,
          seconds: Math.round((Date.now() - start) / 1000),
        }) + '\n',
      )
  }
}
