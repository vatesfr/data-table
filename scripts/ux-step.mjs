#!/usr/bin/env node
// Wraps a browser step for the Playwright MCP tool with the helpers every ux-review/ux-fix check
// needs, so steps stay short and close their page even when they throw.
//
//   node scripts/ux-step.mjs <step.js>   → writes .playwright-mcp/step.js
//
// then `browser_run_code_unsafe` with `filename: .playwright-mcp/step.js`. The step file holds one
// async function receiving the helpers:
//
//   async ({ page, open, after, clickAt, rowCount, encodeView }) => { … return result }
//
// - open(demo, { width, height, view }): load a demo (solid, react, vue, vanilla) with cleared
//   storage, optionally a view for the full table, and scroll #full-table into view
// - after(id, tail): XPath locator for what follows a section's heading, which is a bare h2, not a
//   container — `after('full-table', 'table[1]')`, `after('row-selection', 'button[.="Delete"][1]')`
// - clickAt(locator): a real mouse click at the element's centre — needed inside fixed menus,
//   where Playwright's own scroll-into-view misjudges visibility
// - rowCount(id): the "x / y rows" text of a section
// Shared markers across adapters: data-col-menu, data-filter-cols, data-filter-detail,
// data-filter-back, data-filter-col-key, data-dd-value-search, data-dd-value-row.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import process from 'node:process'
import console from 'node:console'

const file = process.argv[2]
if (!file) {
  console.error('Usage: node scripts/ux-step.mjs <step.js>')
  process.exit(1)
}
const step = readFileSync(file, 'utf8').trim()
const viewModule = '/@fs' + resolve(import.meta.dirname, '../packages/core/src/view.ts')

const script = `async (mcpPage) => {
  const page = await mcpPage.context().newPage();
  await page.addInitScript(() => localStorage.clear());
  // A dev server whose dep cache predates \`npm ci\` answers 504 and the page never renders
  let staleDeps = false;
  page.on('response', (r) => { if (r.status() === 504 && r.url().includes('/node_modules/.vite/deps/')) staleDeps = true; });
  const PORTS = { react: 58981, vue: 58982, solid: 58983, vanilla: 58984 };
  const encodeView = async (view) =>
    page.evaluate(async ([mod, view]) => (await import(mod)).encodeViewState(view), [${JSON.stringify(viewModule)}, view]);
  const open = async (demo, { width = 1440, height = 900, view } = {}) => {
    await page.setViewportSize({ width, height });
    const base = 'http://localhost:' + PORTS[demo] + '/';
    await page.goto(base);
    if (staleDeps) throw new Error('Outdated Vite deps: restart the dev server (npm run dev:' + demo + ')');
    if (view) await page.goto(base + '?full=' + (await encodeView(view)));
    await page.locator('table').first().waitFor({ timeout: 15000 });
    await page.evaluate(() => document.getElementById('full-table')?.scrollIntoView());
    await page.waitForTimeout(200);
  };
  const after = (id, tail) => page.locator('xpath=//*[@id="' + id + '"]/following::' + tail);
  const clickAt = async (locator) => {
    const b = await locator.boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  };
  const rowCount = (id) =>
    page.locator('xpath=//*[@id="' + id + '"]/following::*[contains(text()," rows")][1]').first().innerText();
  try {
    const step = ${step};
    return await step({ page, open, after, clickAt, rowCount, encodeView });
  } finally {
    await page.close();
  }
}`

const dir = join(import.meta.dirname, '..', '.playwright-mcp')
mkdirSync(dir, { recursive: true })
const out = join(dir, 'step.js')
writeFileSync(out, script)
console.log(relative(process.cwd(), out))
