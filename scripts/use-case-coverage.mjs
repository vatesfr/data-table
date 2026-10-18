#!/usr/bin/env node
// Prints which steps of docs/use-cases.md the e2e tests walk (★), from their titles: `UC01.1-7 …`
// claims those steps, `U<n> …` (a backlog item) and `#<n> …` (a GitHub issue) are regression tests,
// a title with no ID is listed under "other". With --check (`npm run check:use-cases`), prints
// nothing and fails on a title naming no step, an unknown use case or step, or a ◇ step.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import console from 'node:console'
import process from 'node:process'

// Map of `UC<nn>` → { title, steps: Map(n → { target }) }.
export function parseUseCases(md) {
  const useCases = new Map()
  let current
  for (const line of md.split('\n')) {
    const heading = /^## (UC\d+) (.+)$/.exec(line)
    if (heading) useCases.set(heading[1], (current = { title: heading[2], steps: new Map() }))
    else if (/^## |^\*\*Edges\*\*/.test(line)) current = undefined
    const step = current && /^(\d+)\. (.*)$/.exec(line)
    if (step) current.steps.set(Number(step[1]), { target: step[2].startsWith('◇') })
  }
  return useCases
}

// "1,3-4" → [1, 3, 4]
const expandSteps = (spec) =>
  spec.split(',').flatMap((part) => {
    const [from, to = from] = part.split('-').map(Number)
    return Array.from({ length: to - from + 1 }, (_, i) => from + i)
  })

// → { covered: Map(UC → Set of steps), regressions: [title], other: [title], problems: [string] }
export function coverage(useCases, titles) {
  const covered = new Map([...useCases.keys()].map((id) => [id, new Set()]))
  const out = { covered, regressions: [], other: [], problems: [] }
  for (const title of titles) {
    const uc = /^(UC\d+)(?:\.(\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*))?[: ]/.exec(title)
    if (!uc) {
      ;(/^(U|#)\d+[: ]/.test(title) ? out.regressions : out.other).push(title)
      continue
    }
    const [, id, spec] = uc
    const useCase = useCases.get(id)
    if (!useCase) out.problems.push(`"${title}": no ${id} in docs/use-cases.md`)
    else if (!spec) out.problems.push(`"${title}": name the steps it walks (${id}.1-3 …)`)
    else
      for (const n of expandSteps(spec)) {
        const step = useCase.steps.get(n)
        if (!step) out.problems.push(`"${title}": ${id} has no step ${n}`)
        else if (step.target) out.problems.push(`"${title}": ${id}.${n} is ◇ — drop the ◇ with it`)
        else covered.get(id).add(n)
      }
  }
  return out
}

export function format(useCases, { covered, regressions, other }) {
  const lines = [...useCases].map(([id, { title, steps }]) => {
    const marks = [...steps].map(([n, s]) => (s.target ? '◇' : covered.get(id).has(n) ? '★' : '·'))
    return `${id} ${marks.join('').padEnd(8)} ${title}`
  })
  return [...lines, '', `Regressions: ${regressions.length}`, `Other: ${other.join('; ')}`].join(
    '\n',
  )
}

// Test titles from Playwright's JSON listing, once each across projects.
const listTitles = () => {
  const report = JSON.parse(
    execFileSync('npx', ['playwright', 'test', '-c', 'e2e', '--list', '--reporter=json'], {
      encoding: 'utf8',
    }),
  )
  const specs = (suite) => [...(suite.specs ?? []), ...(suite.suites ?? []).flatMap(specs)]
  return [...new Set(report.suites.flatMap(specs).map((s) => s.title))]
}

if (import.meta.main) {
  const useCases = parseUseCases(readFileSync('docs/use-cases.md', 'utf8'))
  const result = coverage(useCases, listTitles())
  if (!process.argv.includes('--check')) console.log(format(useCases, result))
  if (result.problems.length) {
    console.error(`use-case-coverage:\n  ${result.problems.join('\n  ')}`)
    process.exit(1)
  }
}
