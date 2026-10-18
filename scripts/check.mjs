#!/usr/bin/env node
// Runs the checks in stages, a stage's steps in parallel, printing one line per step and a step's
// full output only when it fails; stops after a failed stage. With --staged (the pre-commit hook,
// via lint-staged), checks only what the staged files can affect.
import { execFileSync, spawn } from 'node:child_process'
import { appendFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import console from 'node:console'
import process from 'node:process'

const DOCS = /\.md$|^docs\/|^\.claude\//

// Stages of npm scripts, for 'full' (`npm run check`) or 'staged' (a commit touching `files`).
export function stepsFor(mode, files = []) {
  if (mode === 'staged' && files.length && files.every((f) => DOCS.test(f))) return [['check:docs']]
  const staged = mode === 'staged'
  return [
    // lint-staged already linted a commit's files; e2e stays out of pre-commit (CI runs it).
    ['check:docs', ...(staged ? [] : ['lint']), 'type-check', 'test', 'test:scripts', 'build'],
    ['check:dist-types', 'size'],
    // Alone: timing-sensitive, and its 200k-row page competes for memory (docs/pitfalls.md).
    ...(staged ? [] : [['e2e']]),
  ]
}

const run = (step) =>
  new Promise((resolve) => {
    const start = Date.now()
    const child = spawn('npm', ['run', '-s', step])
    let output = ''
    child.stdout.on('data', (d) => (output += d))
    child.stderr.on('data', (d) => (output += d))
    child.on('error', (err) => (output += err.message))
    child.on('close', (code) =>
      resolve({ step, ok: code === 0, seconds: Math.round((Date.now() - start) / 1000), output }),
    )
  })

if (import.meta.main) {
  const mode = process.argv.includes('--staged') ? 'staged' : 'full'
  const files =
    mode === 'staged'
      ? execFileSync('git', ['diff', '--cached', '--name-only', '--no-renames'], {
          encoding: 'utf8',
        })
          .split('\n')
          .filter(Boolean)
      : []
  const results = []
  for (const stage of stepsFor(mode, files)) {
    const stageResults = await Promise.all(stage.map(run))
    results.push(...stageResults)
    for (const r of stageResults) console.log(r.ok ? `✓ ${r.step} (${r.seconds}s)` : `✗ ${r.step}`)
    for (const r of stageResults.filter((r) => !r.ok)) console.log(r.output)
    if (stageResults.some((r) => !r.ok)) break
  }
  const logs = join(homedir(), '.claude/logs')
  if (existsSync(logs))
    appendFileSync(
      join(logs, 'check.jsonl'),
      JSON.stringify({
        date: new Date().toISOString(),
        mode,
        seconds: Object.fromEntries(results.map((r) => [r.step, r.seconds])),
        failed: results.filter((r) => !r.ok).map((r) => r.step),
      }) + '\n',
    )
  if (results.some((r) => !r.ok)) process.exit(1)
}
