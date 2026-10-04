#!/usr/bin/env node
// Writes .playwright-mcp/measure.js, a Playwright MCP `browser_run_code_unsafe` script (pass it as
// `filename`) measuring demo sections at desktop and phone widths, with screenshots — the layout
// checks ux-review/ux-fix need, instead of hand-writing them each time.
//   node scripts/ux-measure.mjs [--demo=<demo>[,<demo>…]] [--name=<prefix>] [--keep] [--view=<param>:<json>…] [#section…]
//   --demo  which demos' dev servers to hit, comma-separated among react, vue, solid, vanilla
//           (default solid; start each with `npm run dev:<demo>`)
//   --name  screenshot prefix (default "measure"): .playwright-mcp/<name>-<demo>-<section>-<width>.png
//   --keep  keep the demo's persisted views (localStorage, URL); cleared by default
//   --view  open with a section's view set, e.g. --view=sel:'{"groupBy":["department"]}' (repeatable;
//           <param> is the section's URL param in the demo's VIEW_KEYS, <json> a TableViewState)
// Sections default to every one rendering a table. Per demo, section and width it returns: how far below
// the heading the first row starts, the height of the library's controls above the table, page
// and in-table horizontal overflow, interactive elements under 24×24 px or without an accessible
// name, and console errors (the demos' missing favicon aside).
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import process from 'node:process'
import console from 'node:console'
// measureSection runs in the page, not in Node.
/* global document, Node, innerWidth, getComputedStyle */

const PORTS = { react: 58981, vue: 58982, solid: 58983, vanilla: 58984 }
const SECTIONS = [
  '#full-table',
  '#row-selection',
  '#row-click',
  '#persisted-table',
  '#huge-dataset',
]
const SIZES = [
  [1440, 900],
  [390, 844],
]

const args = process.argv.slice(2)
const opt = (key) => args.find((a) => a.startsWith(`--${key}=`))?.split('=')[1]
const demos = (opt('demo') ?? 'solid').split(',')
const name = opt('name') ?? 'measure'
const keep = args.includes('--keep')
const views = args
  .filter((a) => a.startsWith('--view='))
  .map((a) => {
    const [param, ...json] = a.slice('--view='.length).split(':')
    return [param, JSON.parse(json.join(':'))]
  })
const sections = args.filter((a) => a.startsWith('#'))
if (
  demos.some((d) => !(d in PORTS)) ||
  args.some((a) => !a.startsWith('#') && !a.startsWith('--'))
) {
  console.error(
    'Usage: node scripts/ux-measure.mjs [--demo=<demo>[,<demo>…]] [--name=<prefix>] [--keep] [--view=<param>:<json>…] [#section…]',
  )
  process.exit(1)
}

// Runs in the page: `id` is a section heading's id.
function measureSection(id) {
  const heading = document.getElementById(id)
  if (!heading) return { missing: true }
  const next = [...document.querySelectorAll('h2')].find(
    (h) => heading.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING,
  )
  const table = [...document.querySelectorAll('table')].find(
    (t) =>
      heading.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING &&
      !(next && next.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING),
  )
  if (!table) return { table: false }
  // The library's root: the table's ancestor sitting next to the heading (demo controls are siblings).
  let root = table
  while (root.parentElement && !root.parentElement.contains(heading)) root = root.parentElement
  const rect = (el) => el.getBoundingClientRect()
  const nameOf = (el) =>
    (
      el.getAttribute('aria-label') ||
      (el.getAttribute('aria-labelledby') &&
        document.getElementById(el.getAttribute('aria-labelledby'))?.textContent) ||
      (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent) ||
      el.closest('label')?.textContent ||
      (el.tagName === 'INPUT' ? '' : el.textContent) ||
      el.getAttribute('title') ||
      el.getAttribute('placeholder') ||
      ''
    ).trim()
  const describe = (el) => el.outerHTML.slice(0, 100)
  const interactive = [
    ...root.querySelectorAll('button, input, select, a[href], [role="button"], [tabindex="0"]'),
  ].filter((el) => rect(el).width > 0 && el.type !== 'hidden')
  const small = interactive.filter((el) => rect(el).width < 24 || rect(el).height < 24)
  const unnamed = interactive.filter((el) => !nameOf(el))
  const firstRow = table.querySelector('tbody tr')
  return {
    firstRowBelowHeading: firstRow ? Math.round(rect(firstRow).top - rect(heading).top) : null,
    controlsAboveTable: Math.round(rect(table).top - rect(root).top),
    pageOverflowX: document.documentElement.scrollWidth > innerWidth,
    tableScrollsX: [...root.querySelectorAll('*')].some(
      (el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible',
    ),
    smallTargets: { count: small.length, samples: small.slice(0, 5).map(describe) },
    unnamed: { count: unnamed.length, samples: unnamed.slice(0, 5).map(describe) },
  }
}

// encodeViewState is served from core's source by every demo's dev server.
const viewModule = '/@fs' + resolve(import.meta.dirname, '../packages/core/src/view.ts')

// Runs on a page of its own, closed at the end: its init script clears the persisted views before
// the demo's code runs on each navigation (clearing after load loses to the demo re-saving its view).
const script = `async (mcpPage) => {
  const page = await mcpPage.context().newPage();
  ${keep ? '' : 'await page.addInitScript(() => localStorage.clear());'}
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && !/favicon/.test(m.location().url) && errors.push(m.text() + ' ' + m.location().url));
  page.on('pageerror', (e) => errors.push(e.message));
  const measureSection = ${measureSection.toString()};
  const views = ${JSON.stringify(views)};
  const out = {};
  // Closed even when a step throws: each demo page holds #huge-dataset's 200k rows, and leaked
  // pages grew Chromium past 10 GB until the OOM killer took down the terminal with it.
  try {
    for (const [demo, port] of ${JSON.stringify(demos.map((d) => [d, PORTS[d]]))}) {
      const base = 'http://localhost:' + port + '/';
      await page.goto(base);
      if (views.length) {
        const query = await page.evaluate(async ([mod, views]) => {
          const { encodeViewState } = await import(mod);
          return views.map(([param, view]) => param + '=' + encodeViewState(view)).join('&');
        }, [${JSON.stringify(viewModule)}, views]);
        await page.goto(base + '?' + query);
      }
      await page.locator('table').first().waitFor({ timeout: 15000 });
      for (const [w, h] of ${JSON.stringify(SIZES)}) {
        await page.setViewportSize({ width: w, height: h });
        for (const section of ${JSON.stringify(sections.length ? sections : SECTIONS)}) {
          const id = section.slice(1);
          await page.evaluate((id) => document.getElementById(id)?.scrollIntoView(), id);
          // #huge-dataset builds its table only once scrolled into view
          await page
            .waitForFunction(
              (id) => document.evaluate('//*[@id="' + id + '"]/following::table[1]', document, null, 9, null).singleNodeValue,
              id,
              { timeout: 15000 },
            )
            .catch(() => {});
          await page.waitForTimeout(300);
          const m = await page.evaluate(measureSection, id);
          out[demo + ' ' + section + ' @' + w] = m;
          if (m.missing || m.table === false) continue;
          await page.screenshot({ path: '.playwright-mcp/${name}-' + demo + '-' + id + '-' + w + '.png' });
        }
      }
    }
  } finally {
    await page.close();
  }
  return { ...out, consoleErrors: errors };
}`

const dir = join(import.meta.dirname, '..', '.playwright-mcp')
mkdirSync(dir, { recursive: true })
const file = join(dir, 'measure.js')
writeFileSync(file, script)
console.log(relative(process.cwd(), file))
