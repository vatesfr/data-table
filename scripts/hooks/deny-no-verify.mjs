#!/usr/bin/env node
// Claude Code PreToolUse hook (Bash): refuse git commands that skip git hooks (`--no-verify`,
// `git commit -n`, `HUSKY=0`). Quoted strings and heredoc bodies (commit messages) are ignored.

import { readFileSync } from 'node:fs'
import process from 'node:process'

function skipsHooks(command) {
  let heredocEnd
  for (const line of command.split('\n')) {
    if (heredocEnd !== undefined) {
      if (line.trim() === heredocEnd) heredocEnd = undefined
      continue
    }
    const code = line.replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, '')
    if (/\bgit\b[^|;&]*\s--no-verify\b/.test(code)) return true
    if (/\bgit\s+commit\b[^|;&]*\s-[a-zA-Z]*n/.test(code)) return true
    if (/\bHUSKY=0\b[^|;&]*\bgit\b/.test(code)) return true
    heredocEnd = /<<-?\s*['"]?(\w+)['"]?/.exec(line)?.[1]
  }
  return false
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { tool_input: { command = '' } = {} } = JSON.parse(readFileSync(0, 'utf8') || '{}')
  if (skipsHooks(command)) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'Git hooks must not be skipped: fix what they report instead.',
        },
      }),
    )
  }
}
