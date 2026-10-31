import type { Locator } from '@playwright/test'
import { expect, test } from './fixtures'

test.skip(({ isMobile }) => !isMobile, 'phone only: the table scrolls sideways')

// Leaves the trigger `shown` px past the table's right edge, so opening it scrolls it into view
async function hiddenTrigger(dt: Locator, name: RegExp, shown: number): Promise<Locator> {
  const trigger = dt.getByRole('button', { name })
  const wrap = dt.locator('.dt-table-wrap')
  const t = (await trigger.boundingBox())!
  const w = (await wrap.boundingBox())!
  await wrap.evaluate((el, d) => (el.scrollLeft += d), t.x - (w.x + w.width - shown))
  return trigger
}

for (const [how, shown, open] of [
  ['clicked on a half-hidden trigger', 12, (trigger: Locator) => trigger.click()],
  // Enter pressed within a frame of the focus scroll, the only way a keyboard user meets it
  [
    'focused off-screen and activated at once',
    -4,
    (trigger: Locator) =>
      trigger.evaluate((el: HTMLElement) => {
        el.focus()
        el.click()
      }),
  ],
] as const)
  test(`UC11.2 on a phone: a header menu ${how} stays open`, async ({ page, section }) => {
    const dt = await section('full-table')
    const trigger = await hiddenTrigger(dt, /^Tenure \(yrs\) options/, shown)
    const scrollLeft = () => dt.locator('.dt-table-wrap').evaluate((el) => el.scrollLeft)
    const before = await scrollLeft()
    await open(trigger)
    expect(await scrollLeft()).toBeGreaterThan(before)
    // The scroll event arrives after the menu opened: wait two frames for it
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    )
    await expect(page.getByRole('dialog', { name: 'Tenure (yrs) options' })).toBeVisible()
  })
