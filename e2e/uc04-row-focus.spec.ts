import { expect, test } from './fixtures'
import type { Locator } from '@playwright/test'

const ring = (el: Locator) =>
  el.evaluate((e) => {
    const cs = getComputedStyle(e)
    return { outline: cs.outlineStyle, shadow: cs.boxShadow }
  })

test('UC04.2 keyboard-moved row focus is visible, a clicked row draws no ring', async ({
  page,
  section,
}) => {
  const dt = await section('row-selection')
  const rows = dt.locator('tbody tr.dt-tr')
  await rows.nth(0).locator('td[data-col-key="salary"]').click()
  expect((await ring(rows.nth(0))).outline).toBe('none')

  await page.keyboard.press('ArrowDown')
  await expect(rows.nth(1)).toBeFocused()
  expect((await ring(rows.nth(1))).outline).toBe('solid')
  // The pinned cell paints above the row's outline, so it draws the ring's top and bottom itself
  expect((await ring(rows.nth(1).locator('td.dt-pinned'))).shadow).toContain('inset')
})
