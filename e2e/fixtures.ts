import { test as base, type Locator } from '@playwright/test'

export { expect } from '@playwright/test'

// demo/showcase's dev server (playwright.config.ts starts it alongside the Solid demo's)
export const SHOWCASE_URL = 'http://localhost:58985'

export const test = base.extend<{
  section: (id: string) => Promise<Locator>
  showcase: (page: string) => Promise<{ dt: Locator; errors: string[] }>
}>({
  // Opens the demo with a clean view and returns the table following the section's heading, which
  // is a bare h2, not a container.
  section: async ({ page }, use) => {
    await page.addInitScript(() => localStorage.clear())
    // A reused dev server whose dep cache predates `npm ci` answers 504 and the page never renders
    let staleDeps = false
    page.on('response', (r) => {
      if (r.status() === 504 && r.url().includes('/node_modules/.vite/deps/')) staleDeps = true
    })
    await use(async (id) => {
      await page.goto('/')
      if (staleDeps)
        throw new Error('Outdated Vite deps: restart the dev server (npm run dev:solid)')
      const dt = page.locator(
        `xpath=//*[@id="${id}"]/following::*[contains(concat(" ", @class, " "), " dt ")][1]`,
      )
      await dt.scrollIntoViewIfNeeded()
      return dt
    })
  },
  // Opens a showcase page with a clean view; `errors` collects console errors and uncaught exceptions
  showcase: async ({ page }, use) => {
    await page.addInitScript(() => localStorage.clear())
    const errors: string[] = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
    await use(async (name) => {
      await page.goto(`${SHOWCASE_URL}/${name}/`)
      const dt = page.locator('.dt').first()
      await dt.locator('tbody tr').first().waitFor()
      return { dt, errors }
    })
  },
})
