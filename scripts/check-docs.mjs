#!/usr/bin/env node
// Fails if a code span in docs/*.md, CLAUDE.md or a skill names an identifier that appears nowhere in the
// repo's code — catches docs left stale by a rename/removal. Those docs and the READMEs are also checked
// for relative links to missing files or headings, `npm run` scripts that don't exist and `scripts/`
// paths that don't. Intentional mentions of things that don't exist (removed APIs, rejected
// alternatives, external names) go in a `<!-- check-docs-ignore: name1 name2 -->` comment in that doc.
import { execFileSync } from 'node:child_process'
import { existsSync, globSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, posix } from 'node:path'
import process from 'node:process'

const CODE_EXT = /\.(m?[jt]sx?|vue|css|json|ya?ml|sh)$|^\.husky\/[^/]+$/

const stripFences = (text) => text.replace(/^ *```[\s\S]*?^ *```/gm, '')

// GitHub's heading anchors: lowercased, punctuation dropped, spaces to hyphens, `-1`… on repeats.
export function headingSlugs(markdown) {
  const slugs = new Set()
  for (const [, heading] of stripFences(markdown).matchAll(/^#{1,6} (.*)$/gm)) {
    const base = heading
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .toLowerCase()
      .replace(/[^\p{L}\p{N} _-]/gu, '')
      .replace(/ /g, '-')
    let slug = base
    for (let n = 1; slugs.has(slug); n++) slug = `${base}-${n}`
    slugs.add(slug)
  }
  return slugs
}

// `dev:react|vue` → ['dev:react', 'dev:vue']
const expandAlternatives = (name) => {
  const [first, ...rest] = name.split('|')
  const prefix = first.slice(0, first.lastIndexOf(':') + 1)
  return [first, ...rest.map((r) => prefix + r)]
}

// Whether `name` (`<…>` a wildcard) is one of `scripts`.
const scriptExists = (name, scripts) => {
  const pattern = new RegExp(
    `^${name
      .split(/<[^>]*>/)
      .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('.+')}$`,
  )
  return [...scripts].some((s) => pattern.test(s))
}

// Problems in `doc` (path from the repo root) other than identifiers. `ctx`: `exists(path)`,
// `isDir(path)`, `slugs(path)`, `glob(pattern)` (matching paths), `rootScripts` and
// `workspaceScripts(path)` (a Set of npm script names; for a path that isn't a workspace, every
// workspace's), `ignored` (the doc's check-docs-ignore names).
export function staleRefs(doc, text, ctx) {
  const stale = []
  for (const line of stripFences(text).split('\n')) {
    for (const [, link, anchor] of line.matchAll(/\]\(([^)#\s]*)(?:#([^)\s]+))?[^)]*\)/g)) {
      if (/^[a-z]+:/.test(link) || ctx.ignored.has(link)) continue
      let target = link ? posix.join(posix.dirname(doc), link) : doc
      if (!ctx.exists(target)) {
        stale.push(`link to missing ${link}`)
        continue
      }
      if (ctx.isDir(target)) target = posix.join(target, 'README.md')
      if (anchor && target.endsWith('.md') && !ctx.slugs(target).has(anchor))
        stale.push(`no heading #${anchor} in ${target}`)
    }
    for (const [, name, workspace] of line.matchAll(
      /npm run (?:-s )?([\w:<>|-]+)(?: (?:-w|--workspace) ([\w./-]+))?/g,
    )) {
      if (ctx.ignored.has(name)) continue
      const scripts = workspace ? ctx.workspaceScripts(workspace) : ctx.rootScripts
      for (const n of expandAlternatives(name))
        if (!scriptExists(n, scripts)) stale.push(`no npm script ${n}`)
    }
    for (const [path] of line.matchAll(/(?<![\w/.-])scripts\/[\w.*/-]*[\w*/]/g))
      if (!ctx.ignored.has(path) && !ctx.glob(path).length) stale.push(`no ${path}`)
  }
  return stale
}

if (import.meta.main) {
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
  const readmes = ['README.md', ...globSync('packages/*/README.md')]

  const scriptsOf = (dir) =>
    new Set(Object.keys(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).scripts ?? {}))
  const workspaces = globSync(['packages/*/package.json', 'demo/*/package.json']).map(dirname)
  const allWorkspaceScripts = new Set(workspaces.flatMap((w) => [...scriptsOf(w)]))
  const ctx = {
    exists: existsSync,
    isDir: (p) => statSync(p).isDirectory(),
    slugs: (p) => headingSlugs(readFileSync(p, 'utf8')),
    glob: (p) => globSync(p),
    rootScripts: scriptsOf('.'),
    workspaceScripts: (w) => (workspaces.includes(w) ? scriptsOf(w) : allWorkspaceScripts),
  }

  let failed = false
  for (const doc of [...docs, ...readmes]) {
    const text = readFileSync(doc, 'utf8')
    const ignored = new Set(
      [...text.matchAll(/<!--\s*check-docs-ignore:([^>]*)-->/g)].flatMap((m) =>
        m[1].trim().split(/\s+/),
      ),
    )
    const problems = staleRefs(doc, text, { ...ctx, ignored })
    if (docs.includes(doc)) {
      const missing = new Set()
      for (const line of stripFences(text).split('\n')) {
        for (const [, , span] of line.matchAll(/(`+)(.+?)\1(?!`)/g)) {
          for (const [name] of span.matchAll(/[A-Za-z_$][\w$-]{3,}/g)) {
            if (!ignored.has(name) && !corpus.includes(name)) missing.add(name)
          }
        }
      }
      if (missing.size) problems.unshift(`not found in code: ${[...missing].join(', ')}`)
    }
    if (problems.length) {
      failed = true
      process.stderr.write(`${doc}: ${problems.join('; ')}\n`)
    }
  }
  if (failed) {
    process.stderr.write(
      '\nFix the doc, or list intentional mentions in a <!-- check-docs-ignore: … --> comment.\n',
    )
    process.exit(1)
  }
}
