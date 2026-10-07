// Runs a script written for the Playwright MCP's `browser_run_code_unsafe` (an async function of a
// page) in a local headless Chromium instead, printing its result — for ux-step/ux-measure's
// `--run`, when the MCP browser isn't available.
import { chromium } from '@playwright/test'
import { join } from 'node:path'
import process from 'node:process'
import console from 'node:console'

export async function runInBrowser(script) {
  // The scripts write screenshots to paths relative to the repo root
  process.chdir(join(import.meta.dirname, '..'))
  const browser = await chromium.launch()
  try {
    const page = await (await browser.newContext()).newPage()
    const fn = (0, eval)(script)
    console.log(JSON.stringify(await fn(page), null, 2))
  } finally {
    await browser.close()
  }
}
