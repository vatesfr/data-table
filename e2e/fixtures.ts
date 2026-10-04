import { test as base, type Locator } from '@playwright/test'

export { expect } from '@playwright/test'

export const test = base.extend<{ section: (id: string) => Promise<Locator> }>({
  // Opens the demo with a clean view and returns the table following the section's heading, which
  // is a bare h2, not a container.
  section: async ({ page }, use) => {
    await page.addInitScript(() => localStorage.clear())
    await use(async (id) => {
      await page.goto('/')
      const dt = page.locator(
        `xpath=//*[@id="${id}"]/following::*[contains(concat(" ", @class, " "), " dt ")][1]`,
      )
      await dt.scrollIntoViewIfNeeded()
      return dt
    })
  },
})
