#!/usr/bin/env node
// Compares each package's gzip sizes between a git ref (default HEAD) and the working tree, with
// budget headroom: `node scripts/size-diff.mjs [ref]`. The ref is built in a temporary worktree
// with its own `npm ci`, so the working tree is never stashed or touched.
import { execFileSync } from 'node:child_process'
import console from 'node:console'
import { appendFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const PACKAGES = ['core', 'react', 'vue', 'solid', 'vanilla']

export function diffRows(before, after) {
  return after.map((a) => {
    const b = before.find((x) => x.pkg === a.pkg && x.name === a.name)
    return {
      ...a,
      before: b?.size ?? null,
      delta: b ? a.size - b.size : null,
      headroom: a.sizeLimit - a.size,
    }
  })
}

export function formatRows(rows) {
  const cell = (v) => (v === null ? '—' : String(v))
  const lines = rows.map((r) =>
    [
      `${r.pkg} ${r.name}`.padEnd(54),
      cell(r.before).padStart(7),
      String(r.size).padStart(7),
      (r.delta === null ? '—' : (r.delta > 0 ? '+' : '') + r.delta).padStart(6),
      String(r.headroom).padStart(6),
    ].join(' '),
  )
  return [
    `${'entry (gzip B)'.padEnd(54)} ${'before'.padStart(7)} ${'after'.padStart(7)} ${'delta'.padStart(6)} ${'room'.padStart(6)}`,
    ...lines,
  ].join('\n')
}

function measure(root) {
  const run = (args, cwd = root) =>
    execFileSync('npm', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  run(['run', 'build'])
  return PACKAGES.flatMap((pkg) =>
    JSON.parse(
      execFileSync('npx', ['size-limit', '--json'], {
        cwd: join(root, 'packages', pkg),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    ).map((e) => ({ pkg, name: e.name, size: e.size, sizeLimit: e.sizeLimit })),
  )
}

if (import.meta.main) {
  const start = Date.now()
  const ref = process.argv[2] ?? 'HEAD'
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  const tree = mkdtempSync(join(tmpdir(), 'size-diff-'))
  let rows
  try {
    execFileSync('git', ['worktree', 'add', '--detach', tree, ref], { cwd: root, stdio: 'ignore' })
    execFileSync('npm', ['ci', '--prefer-offline', '--ignore-scripts'], {
      cwd: tree,
      stdio: 'ignore',
    })
    rows = diffRows(measure(tree), measure(root))
  } finally {
    execFileSync('git', ['worktree', 'remove', '--force', tree], { cwd: root, stdio: 'ignore' })
    rmSync(tree, { recursive: true, force: true })
  }
  console.log(formatRows(rows))
  const logs = join(homedir(), '.claude/logs')
  if (existsSync(logs))
    appendFileSync(
      join(logs, 'size-diff.jsonl'),
      JSON.stringify({
        date: new Date().toISOString(),
        ref,
        seconds: Math.round((Date.now() - start) / 1000),
        overBudget: rows.filter((r) => r.headroom < 0).length,
        deltas: Object.fromEntries(rows.map((r) => [`${r.pkg} ${r.name}`, r.delta])),
      }) + '\n',
    )
  if (rows.some((r) => r.headroom < 0)) process.exit(1)
}
