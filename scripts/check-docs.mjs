#!/usr/bin/env node
// Fails if a code span in docs/*.md, CLAUDE.md or a skill names an identifier that appears nowhere in the
// repo's code — catches docs left stale by a rename/removal. Intentional mentions of things that
// don't exist (removed APIs, rejected alternatives, external names) go in a
// `<!-- check-docs-ignore: name1 name2 -->` comment in that doc.
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const CODE_EXT = /\.(m?[jt]sx?|vue|css|json|ya?ml|sh)$|^\.husky\/[^/]+$/

const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  encoding: 'utf8',
})
  .trim()
  .split('\n')
// Every non-ignored path counts too, so a doc can name a file (e.g. `solidScaffold`, `pitfalls`).
const corpus = [
  ...tracked,
  ...tracked.filter((p) => CODE_EXT.test(p)).map((p) => readFileSync(p, 'utf8')),
].join('\n')

const docs = [
  'CLAUDE.md',
  ...readdirSync('docs').map((f) => join('docs', f)),
  ...readdirSync('.claude/skills').map((s) => join('.claude/skills', s, 'SKILL.md')),
].filter((p) => p.endsWith('.md'))
let failed = false
for (const doc of docs) {
  const text = readFileSync(doc, 'utf8')
  const ignored = new Set(
    [...text.matchAll(/<!--\s*check-docs-ignore:([^>]*)-->/g)].flatMap((m) =>
      m[1].trim().split(/\s+/),
    ),
  )
  const missing = new Set()
  for (const line of text.replace(/^```[\s\S]*?^```/gm, '').split('\n')) {
    for (const [, , span] of line.matchAll(/(`+)(.+?)\1(?!`)/g)) {
      for (const [name] of span.matchAll(/[A-Za-z_$][\w$-]{3,}/g)) {
        if (!ignored.has(name) && !corpus.includes(name)) missing.add(name)
      }
    }
  }
  if (missing.size) {
    failed = true
    process.stderr.write(`${doc}: not found in code: ${[...missing].join(', ')}\n`)
  }
}
if (failed) {
  process.stderr.write(
    '\nFix the doc, or list intentional mentions in a <!-- check-docs-ignore: … --> comment.\n',
  )
  process.exit(1)
}
