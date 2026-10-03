#!/usr/bin/env node
// Prepares a release: bumps the packages changed since the last `v*` tag (plus every package
// depending on a bumped one, whose range must move) to <version>, points their
// `@vates/data-table-*` ranges at it, dates `## [Unreleased]` in CHANGELOG.md and refreshes
// package-lock.json. Commit, tag and push stay with the `release` skill.
//   node scripts/release.mjs <X.Y.Z> [--dry-run]
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'
import console from 'node:console'

const PACKAGES = ['core', 'react', 'vue', 'solid', 'vanilla']
const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies']

const args = process.argv.slice(2)
const version = args.find((a) => !a.startsWith('--'))
const dryRun = args.includes('--dry-run')
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error('Usage: node scripts/release.mjs <X.Y.Z> [--dry-run]')
  process.exit(1)
}

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim()
const lastTag = git('describe', '--tags', '--abbrev=0', '--match', 'v*')
if (lastTag === `v${version}`) throw new Error(`${lastTag} already exists`)

const path = (p) => `packages/${p}/package.json`
const pkgs = Object.fromEntries(PACKAGES.map((p) => [p, JSON.parse(readFileSync(path(p), 'utf8'))]))
const byName = Object.fromEntries(PACKAGES.map((p) => [pkgs[p].name, p]))
const deps = (p) =>
  DEP_FIELDS.flatMap((f) => Object.keys(pkgs[p][f] ?? {})).filter((n) => n in byName)

// Test-only changes don't change what's published.
const reasons = {}
for (const p of PACKAGES) {
  const changed = git('diff', '--name-only', `${lastTag}..HEAD`, '--', `packages/${p}`)
    .split('\n')
    .filter((f) => f && !f.includes('/__tests__/'))
  if (changed.length) reasons[p] = `${changed.length} file(s) changed since ${lastTag}`
}
for (let grew = true; grew;) {
  grew = false
  for (const p of PACKAGES) {
    const dep = !reasons[p] && deps(p).find((n) => reasons[byName[n]])
    if (dep) {
      reasons[p] = `depends on ${dep}`
      grew = true
    }
  }
}
if (!Object.keys(reasons).length) throw new Error(`nothing changed since ${lastTag}`)

const changelog = readFileSync('CHANGELOG.md', 'utf8')
const unreleased = changelog.match(/^## \[Unreleased\]\n([\s\S]*?)(?=^## \[)/m)
if (!unreleased?.[1].trim()) throw new Error('CHANGELOG.md has no entries under ## [Unreleased]')

for (const [p, why] of Object.entries(reasons))
  console.log(`${pkgs[p].name}: ${pkgs[p].version} → ${version} (${why})`)
if (dryRun) process.exit(0)

for (const p of Object.keys(reasons)) {
  pkgs[p].version = version
  for (const f of DEP_FIELDS)
    for (const n of Object.keys(pkgs[p][f] ?? {}))
      if (reasons[byName[n]]) pkgs[p][f][n] = `^${version}`
  writeFileSync(path(p), JSON.stringify(pkgs[p], null, 2) + '\n')
}
const today = new Date().toLocaleDateString('sv') // YYYY-MM-DD, local
writeFileSync(
  'CHANGELOG.md',
  changelog.replace('## [Unreleased]\n', `## [Unreleased]\n\n## [${version}] - ${today}\n`),
)
execFileSync('npm', ['install'], { stdio: 'inherit' })
