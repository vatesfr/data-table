import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Known violations: the library's are backlog items (docs/improvements.md), removed with their fix;
// the demo's own cell renderers aren't the library's.
const KNOWN = [
  { rule: 'select-name', html: 'class="dt-page-select"', item: 'U23' },
  { rule: 'color-contrast', html: 'class="dt-th-sort"', item: 'U24' },
  { rule: 'color-contrast', html: 'min-width: 26px', item: 'demo scoreBar' },
  { rule: 'color-contrast', html: 'No review yet', item: 'demo muted()' },
]

for (const colorScheme of ['light', 'dark'] as const) {
  test(`the tables have no axe violations (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme })
    await page.goto('/')
    await page.locator('table').first().waitFor()
    // Scoped to the tables: the demo page's own landmarks aren't the library's.
    const { violations } = await new AxeBuilder({ page }).include('.dt').analyze()
    const found = violations.flatMap((v) =>
      v.nodes
        .filter((n) => !KNOWN.some((k) => k.rule === v.id && n.html.includes(k.html)))
        .map((n) => `${v.id}: ${n.html}`),
    )
    expect(found).toEqual([])
  })
}
