#!/usr/bin/env node
// Times interactions on each demo's 200k-row #huge-dataset table, from production builds, in a
// headless Chromium: Event Timing's longest event per interaction (input to next paint), runs
// interleaved across demos, the first per demo discarded as warm-up. A run waits (up to 5 min) for
// the 1-minute load average to drop below 2 and records it; summaries skip runs above that.
//   node scripts/perf-browser.mjs [--runs=6] [--demo=react,vue,solid,vanilla] [--out=<file.jsonl>]
//                                 [--leak] [--compare=<before.jsonl>] [--summary=<file.jsonl>]
//   --out      append each run as it completes (default: a temp file, printed at the end)
//   --leak     also open/close the Filter dropdown 40 times, with a control loop, and report the
//              heap/DOM node/listener growth per cycle after forced GC
//   --compare  print before → after against runs saved with --out
//   --summary  only print the summary of saved runs, without running anything
import { execFileSync } from 'node:child_process'
import console from 'node:console'
import {
  appendFileSync,
  createReadStream,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs'
import http from 'node:http'
import { homedir, loadavg, tmpdir } from 'node:os'
import { dirname, extname, join } from 'node:path'
import process from 'node:process'
import { setTimeout } from 'node:timers'
import { URL, fileURLToPath } from 'node:url'
/* global window, PerformanceObserver, requestAnimationFrame, localStorage */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEMOS = ['react', 'vue', 'solid', 'vanilla']
const MAX_LOAD = 2
const METRICS = ['JSHeapUsedSize', 'Nodes', 'JSEventListeners']

const median = (v) => quantile(v, 0.5)
function quantile(values, q) {
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor(q * (s.length - 1))]
}

// Per demo and step: median and interquartile range of the runs taken below MAX_LOAD, warm-up
// (run 0) excluded.
export function summarize(runs) {
  const out = {}
  for (const run of runs) {
    if (run.run === 0 || run.load1 >= MAX_LOAD || run.error) continue
    for (const step of run.steps) {
      if (step.ms === undefined) continue
      ;((out[step.name] ??= {})[run.demo] ??= []).push(step.ms)
    }
  }
  for (const steps of Object.values(out))
    for (const [demo, v] of Object.entries(steps))
      steps[demo] = { median: median(v), q1: quantile(v, 0.25), q3: quantile(v, 0.75), n: v.length }
  return out
}

export function formatSummary(after, before = {}) {
  const cell = (s) => (s ? `${s.median} [${s.q1}-${s.q3}]` : '—')
  const demos = DEMOS.filter((d) => Object.values(after).some((s) => s[d]))
  const head = ['ms (median [IQR])'.padEnd(26), ...demos.map((d) => d.padStart(26))].join(' ')
  const lines = Object.entries(after).map(([step, s]) =>
    [
      step.padEnd(26),
      ...demos.map((d) =>
        (before[step] ? `${cell(before[step][d])} → ${cell(s[d])}` : cell(s[d])).padStart(26),
      ),
    ].join(' '),
  )
  return [head, ...lines].join('\n')
}

export const readRuns = (file) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))

function serve(dir) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }
  const server = http.createServer((req, res) => {
    let file = join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname))
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(dir, 'index.html')
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
    createReadStream(file).pipe(res)
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}

async function waitForQuiet() {
  for (let i = 0; i < 60 && loadavg()[0] >= MAX_LOAD; i++)
    await new Promise((r) => setTimeout(r, 5000))
  return +loadavg()[0].toFixed(2)
}

async function measureDemo(browser, url, leak) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  // Clean view each run: the demos persist theirs to localStorage and the URL
  await page.addInitScript(() => {
    localStorage.clear()
    window.__events = []
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__events.push(e.duration)
    }).observe({ type: 'event', durationThreshold: 16, buffered: true })
  })
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Performance.enable')
  const settle = () =>
    page.evaluate(
      () =>
        new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r)))),
    )
  const steps = []
  // ms: the interaction's longest event (Event Timing); S1 has no input event, so wall time
  const step = async (name, fn, { wall = false } = {}) => {
    await page.evaluate(() => (window.__events = []))
    const t0 = Date.now()
    try {
      await fn()
      await settle()
      await page.waitForTimeout(150) // Event Timing entries arrive after paint
    } catch (e) {
      steps.push({ name, error: String(e).split('\n')[0] })
      return
    }
    const events = await page.evaluate(() => window.__events)
    steps.push({ name, ms: wall ? Date.now() - t0 : Math.max(0, ...events) })
  }
  const metrics = async () => {
    for (let i = 0; i < 3; i++) {
      await cdp.send('HeapProfiler.collectGarbage')
      await page.evaluate(() => new Promise((r) => setTimeout(r)))
    }
    const { metrics } = await cdp.send('Performance.getMetrics')
    return Object.fromEntries(
      metrics.filter((m) => METRICS.includes(m.name)).map((m) => [m.name, m.value]),
    )
  }

  await page.goto(url)
  const dt = page.locator(
    'xpath=//*[@id="huge-dataset"]/following::*[contains(concat(" ", @class, " "), " dt ")][1]',
  )
  await step(
    'S1 scroll + mount',
    async () => {
      await page.locator('#huge-dataset').scrollIntoViewIfNeeded()
      await dt.locator('tbody tr').first().waitFor({ timeout: 60_000 })
    },
    { wall: true },
  )
  const heap = (await metrics()).JSHeapUsedSize
  for (const col of ['Customer', 'Amount', 'Order Date'])
    await step(`S2 sort ${col}`, () => dt.getByRole('button', { name: col, exact: true }).click())
  await step('S6 next page', () => dt.getByRole('button', { name: 'Next page' }).click())
  const search = dt.getByRole('textbox', { name: 'Search…' })
  await step('S3 first keystroke', async () => {
    await search.click()
    await page.keyboard.type('a')
  })
  await step('S3 10 keys @50ms', () => page.keyboard.type('nderson x', { delay: 50 }))
  await search.fill('')
  await settle()

  const filterBtn = dt.getByRole('button', { name: 'Filter' })
  let leakSlopes
  if (leak) {
    const loop = async (cycle) => {
      const samples = []
      for (let i = 0; i < 40; i++) {
        await cycle()
        await page.evaluate(() => (window.__events = []))
        if (i >= 5) samples.push({ i, ...(await metrics()) })
      }
      return Object.fromEntries(METRICS.map((k) => [k, slope(samples, k)]))
    }
    const control = await loop(async () => {
      await page.locator('#huge-dataset').click()
      await page.keyboard.press('Escape')
    })
    const dropdown = await loop(async () => {
      await filterBtn.click()
      await page.locator('[data-filter-cols]').waitFor()
      await page.keyboard.press('Escape')
      await page.locator('[data-filter-cols]').waitFor({ state: 'hidden' })
    })
    leakSlopes = { control, dropdown }
  }

  await filterBtn.click()
  const detail = page.locator('[data-filter-detail]')
  await step('S4 open Customer values', () =>
    page
      .locator('[data-filter-cols]')
      .getByRole('button', { name: 'Customer', exact: true })
      .click(),
  )
  // Unchecks every value, then checks them all again: leaves the rows in place for S5
  for (const name of ['S4 uncheck all', 'S4 check all'])
    await step(name, () => detail.getByRole('checkbox', { name: 'Select all' }).click())
  await page.keyboard.press('Escape')
  await dt.getByRole('button', { name: 'Group' }).click()
  await step('S5 group by Category', () =>
    page
      .locator('.dt-dd-item:visible')
      .filter({ hasText: /^Category$/ })
      .first()
      .click(),
  )
  await page.keyboard.press('Escape')
  await settle()
  await step('S5 expand a group', () => dt.locator('tbody tr[aria-expanded]').first().click())
  await ctx.close()
  return { steps, heapMB: +(heap / 1e6).toFixed(1), leakSlopes }
}

// Least-squares growth per cycle
function slope(samples, key) {
  const mx = samples.reduce((a, s) => a + s.i, 0) / samples.length
  const my = samples.reduce((a, s) => a + s[key], 0) / samples.length
  const num = samples.reduce((a, s) => a + (s.i - mx) * (s[key] - my), 0)
  return Math.round(num / samples.reduce((a, s) => a + (s.i - mx) ** 2, 0))
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const opt = (key) => args.find((a) => a.startsWith(`--${key}=`))?.split('=')[1]
  const compare = opt('compare') ? summarize(readRuns(opt('compare'))) : {}
  if (opt('summary')) {
    console.log(formatSummary(summarize(readRuns(opt('summary'))), compare))
    process.exit(0)
  }
  const demos = (opt('demo') ?? DEMOS.join(',')).split(',')
  const runs = Number(opt('runs') ?? 6)
  const leak = args.includes('--leak')
  const out = opt('out') ?? join(mkdtempSync(join(tmpdir(), 'perf-browser-')), 'runs.jsonl')
  if (demos.some((d) => !DEMOS.includes(d)) || !(runs > 1)) {
    console.error(
      'Usage: node scripts/perf-browser.mjs [--runs=6] [--demo=react,vue,solid,vanilla] [--out=<file.jsonl>] [--leak] [--compare=<before.jsonl>] [--summary=<file.jsonl>]',
    )
    process.exit(1)
  }
  const start = Date.now()
  const builds = mkdtempSync(join(tmpdir(), 'perf-browser-dist-'))
  for (const demo of demos)
    execFileSync('npx', ['vite', 'build', '--outDir', join(builds, demo), '--emptyOutDir'], {
      cwd: join(ROOT, 'demo', demo),
      stdio: 'ignore',
    })
  const servers = Object.fromEntries(
    await Promise.all(demos.map(async (d) => [d, await serve(join(builds, d))])),
  )
  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch()
  const all = []
  try {
    for (let run = 0; run < runs; run++)
      for (const demo of demos) {
        const load1 = await waitForQuiet()
        let result
        try {
          result = await measureDemo(
            browser,
            `http://127.0.0.1:${servers[demo].address().port}/`,
            leak,
          )
        } catch (e) {
          result = { error: String(e).split('\n')[0] }
        }
        const record = { run, demo, load1, ...result }
        all.push(record)
        appendFileSync(out, JSON.stringify(record) + '\n')
        console.error(
          `run ${run} ${demo} load ${load1}${record.error ? ` ERROR ${record.error}` : ''}`,
        )
      }
  } finally {
    await browser.close()
    for (const s of Object.values(servers)) s.close()
    rmSync(builds, { recursive: true, force: true })
  }
  console.log(formatSummary(summarize(all), compare))
  if (leak)
    for (const r of all.filter((r) => r.leakSlopes))
      console.log(`leak/cycle ${r.demo} run ${r.run}: ${JSON.stringify(r.leakSlopes)}`)
  console.log(`runs: ${out}`)
  const logs = join(homedir(), '.claude/logs')
  if (existsSync(logs))
    appendFileSync(
      join(logs, 'perf-browser.jsonl'),
      JSON.stringify({
        date: new Date().toISOString(),
        demos,
        runs,
        leak,
        errors: all.filter((r) => r.error || r.steps?.some((s) => s.error)).length,
        loaded: all.filter((r) => r.load1 >= MAX_LOAD).length,
        seconds: Math.round((Date.now() - start) / 1000),
      }) + '\n',
    )
}
