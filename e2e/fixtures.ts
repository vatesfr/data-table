import { test as base, type Locator } from '@playwright/test'

export { expect } from '@playwright/test'

export const test = base.extend<{ section: (id: string) => Promise<Locator> }>({
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
})
