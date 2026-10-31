#!/usr/bin/env node
// Claude Code WorktreeCreate hook: creates the worktree with plain `git worktree add`, so git's
// post-checkout hook installs its dependencies (Claude Code's own creation skips git hooks).
// Replaces Claude Code's creation: prints the worktree path as the last stdout line, everything
// else goes to stderr. Logs one JSON line per run to ~/.claude/logs/worktree-create.jsonl.

import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

// Run from inside a git hook (a test under pre-commit), GIT_DIR & co. would override `-C root`
export const gitEnv = () =>
  Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')))

export function createWorktree(root, name) {
  const dir = join(root, '.claude', 'worktrees', name)
  // stdout to stderr: Claude Code reads the path from stdout, and npm ci prints there
  const { status } = spawnSync(
    'git',
    ['-C', root, 'worktree', 'add', '-q', '-b', `worktree-${name}`, dir, 'HEAD'],
    { stdio: ['ignore', 2, 2], env: gitEnv() },
  )
  return status === 0 ? dir : undefined
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const start = Date.now()
  const { name, cwd } = JSON.parse(readFileSync(0, 'utf8'))
  const dir = createWorktree(process.env.CLAUDE_PROJECT_DIR ?? cwd, name)
  const logDir = join(homedir(), '.claude', 'logs')
  mkdirSync(logDir, { recursive: true })
  appendFileSync(
    join(logDir, 'worktree-create.jsonl'),
    JSON.stringify({
      ts: new Date().toISOString(),
      name,
      created: dir !== undefined,
      depsInstalled: dir !== undefined && existsSync(join(dir, 'node_modules')),
      ms: Date.now() - start,
    }) + '\n',
  )
  if (dir === undefined) process.exit(1)
  process.stdout.write(dir + '\n')
}
