#!/usr/bin/env node
// Fails the commit if the staged CHANGELOG.md's Unreleased section repeats a subsection or uses one
// outside Keep a Changelog's, or if source changes aren't accompanied by a CHANGELOG.md update.
// Bypass the latter for a genuinely changelog-exempt commit with `SKIP_CHANGELOG=1 git commit`.
import { execFileSync } from 'node:child_process'
import console from 'node:console'
import process from 'node:process'

export const UNRELEASED = /^## \[Unreleased\]\n([\s\S]*?)(?=^## \[)/m
const SECTIONS = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security']
const SOURCE = /^(packages|demo)\/[^/]+\/src\/(?!(.*\/)?__tests__\/)/

export function structureProblems(changelog) {
  const unreleased = changelog.match(UNRELEASED)
  if (!unreleased) return ['no "## [Unreleased]" section before the first release']
  const headings = [...unreleased[1].matchAll(/^### (.+)$/gm)].map((m) => m[1].trim())
  return [
    ...headings.filter((h, i) => headings.indexOf(h) !== i).map((h) => `repeated "### ${h}"`),
    ...headings
      .filter((h) => !SECTIONS.includes(h))
      .map((h) => `"### ${h}" isn't one of ${SECTIONS.join(', ')}`),
  ]
}

export const missingEntry = (files) =>
  !files.includes('CHANGELOG.md') && files.some((f) => SOURCE.test(f))

if (import.meta.main) {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' })
  const problems = structureProblems(git('show', ':CHANGELOG.md'))
  const staged = git('diff', '--cached', '--name-only', '--diff-filter=ACMR').split('\n')
  if (!process.env.SKIP_CHANGELOG && missingEntry(staged))
    problems.push(
      "source files changed but CHANGELOG.md wasn't updated: add an entry under '## [Unreleased]', or commit with SKIP_CHANGELOG=1 if this change genuinely doesn't need one",
    )
  if (problems.length) {
    console.error(`\nerror: CHANGELOG.md: ${problems.join('; ')}\n`)
    process.exit(1)
  }
}
