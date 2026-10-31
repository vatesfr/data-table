import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { after, test } from 'node:test'
import { createWorktree, gitEnv } from '../hooks/worktree-create.mjs'

// A throwaway repo whose post-checkout hook leaves a marker in the checked-out tree
const root = mkdtempSync(join(tmpdir(), 'worktree-create-'))
after(() => rmSync(root, { recursive: true, force: true }))
const git = (...args) =>
  execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', env: gitEnv() })
git('init', '-q')
git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init')
const hook = join(root, '.git', 'hooks', 'post-checkout')
writeFileSync(hook, '#!/bin/sh\ntouch post-checkout-ran\n')
chmodSync(hook, 0o755)

test('creates the worktree on its own branch and runs git hooks there', () => {
  const dir = createWorktree(root, 'demo')
  assert.equal(dir, join(root, '.claude', 'worktrees', 'demo'))
  assert.equal(git('-C', dir, 'branch', '--show-current').trim(), 'worktree-demo')
  assert.ok(existsSync(join(dir, 'post-checkout-ran')))
})

test('returns undefined when git refuses, e.g. a name already taken', () => {
  assert.equal(createWorktree(root, 'demo'), undefined)
})

test('as a hook: prints the path last on stdout and logs the run', () => {
  const home = join(root, 'home')
  const out = execFileSync(
    process.execPath,
    [join(import.meta.dirname, '..', 'hooks', 'worktree-create.mjs')],
    {
      input: JSON.stringify({ name: 'hook', cwd: root }),
      env: { ...gitEnv(), HOME: home, CLAUDE_PROJECT_DIR: root },
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    },
  )
  assert.equal(out, join(root, '.claude', 'worktrees', 'hook') + '\n')
  const log = JSON.parse(
    readFileSync(join(home, '.claude', 'logs', 'worktree-create.jsonl'), 'utf8'),
  )
  assert.equal(log.name, 'hook')
  assert.equal(log.created, true)
})
