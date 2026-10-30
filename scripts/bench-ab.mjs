#!/usr/bin/env node
// Times core's pure functions at a git ref (default HEAD) against the working tree, in one Node
// process with interleaved runs: `npm run bench:ab -- [ref] [--rows=500000] [--rounds=5]`.
// Scenarios live in packages/core/src/__tests__/ab.scenarios.ts. Needs `--expose-gc` (the npm
// script passes it) so one side's garbage isn't collected during the other side's timing.
import { execFileSync } from 'node:child_process'
import console from 'node:console'
import { appendFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { performance } from 'node:perf_hooks'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual, parseArgs } from 'node:util'

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function formatRows(rows) {
  const ms = (times) =>
    `${median(times).toFixed(0)} (${Math.min(...times).toFixed(0)}–${Math.max(...times).toFixed(0)})`
  const lines = rows.map((r) =>
    r.skipped
      ? `${r.name.padEnd(36)} skipped (${r.skipped})`
      : [
          r.name.padEnd(36),
          ms(r.before).padStart(18),
          ms(r.after).padStart(18),
          `${(median(r.before) / median(r.after)).toFixed(2)}x`.padStart(8) +
            (r.differs ? '   results differ' : ''),
        ].join(' '),
  )
  return [
    `${'scenario (ms: median (min–max))'.padEnd(36)} ${'before'.padStart(18)} ${'after'.padStart(18)} ${'speedup'.padStart(8)}`,
    ...lines,
  ].join('\n')
}

const gc = () => globalThis.gc?.()

function time(run) {
  gc()
  const start = performance.now()
  run()
  return performance.now() - start
}

if (import.meta.main) {
  const start = Date.now()
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      rows: { type: 'string', default: '500000' },
      rounds: { type: 'string', default: '5' },
    },
  })
  const ref = positionals[0] ?? 'HEAD'
  const rowCount = Number(values.rows)
  const rounds = Number(values.rounds)
  if (!globalThis.gc) console.warn('no --expose-gc: GC pauses may land in the other side’s timing')

  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], { cwd: root, stdio: 'ignore' })
  const core = join(root, 'packages/core/src')
  // `logic.ts` only has `import type` imports, which type stripping erases: one file is enough
  const tmp = mkdtempSync(join(tmpdir(), 'bench-ab-'))
  let rows
  try {
    const refLogic = join(tmp, 'logic.mts') // .mts: ESM without a package.json
    writeFileSync(
      refLogic,
      execFileSync('git', ['show', `${ref}:packages/core/src/logic.ts`], { cwd: root }),
    )
    const before = await import(pathToFileURL(refLogic).href)
    const after = await import(pathToFileURL(join(core, 'logic.ts')).href)
    const { makeDataset, benchColumns } = await import(
      pathToFileURL(join(core, '__tests__/bench-utils.ts')).href
    )
    const { scenarios } = await import(pathToFileURL(join(core, '__tests__/ab.scenarios.ts')).href)
    const data = makeDataset(rowCount)
    const sides = {
      before: scenarios(before, data, benchColumns),
      after: scenarios(after, data, benchColumns),
    }

    rows = sides.after.map(({ name, run }, i) => {
      const runBefore = sides.before[i].run
      let differs
      try {
        differs = !isDeepStrictEqual(runBefore(), run())
      } catch (error) {
        return { name, skipped: error.message.split('\n')[0] }
      }
      const times = { before: [], after: [] }
      for (let round = 0; round < rounds; round++) {
        const order = round % 2 ? ['after', 'before'] : ['before', 'after']
        for (const side of order) times[side].push(time(side === 'before' ? runBefore : run))
      }
      return { name, differs, ...times }
    })
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }

  console.log(`${rowCount.toLocaleString()} rows, ${rounds} rounds, ${ref} → working tree`)
  console.log(formatRows(rows))
  const logs = join(homedir(), '.claude/logs')
  if (existsSync(logs))
    appendFileSync(
      join(logs, 'bench-ab.jsonl'),
      JSON.stringify({
        date: new Date().toISOString(),
        ref,
        rows: rowCount,
        rounds,
        seconds: Math.round((Date.now() - start) / 1000),
        skipped: rows.filter((r) => r.skipped).length,
        differs: rows.filter((r) => r.differs).length,
        scenarios: Object.fromEntries(
          rows
            .filter((r) => !r.skipped)
            .map((r) => [r.name, { before: median(r.before), after: median(r.after) }]),
        ),
      }) + '\n',
    )
  if (rows.some((r) => r.differs) || rows.every((r) => r.skipped)) process.exit(1)
}
