import { expect, test } from './fixtures'

test.skip(({ isMobile }) => isMobile, 'one viewport is enough: the overflow is vertical')

test('U37 a dropdown with room on neither side of its trigger stays inside the viewport', async ({
  page,
  section,
}) => {
  // Too short for the Columns panel (max 420 px) both above and below a trigger near the bottom
  await page.setViewportSize({ width: 1440, height: 500 })
  const dt = await section('full-table')
  const trigger = dt.getByRole('button', { name: 'Columns', exact: true })
  await trigger.evaluate((el) => {
    el.scrollIntoView({ block: 'end' })
    window.scrollBy(0, 90)
  })
  await trigger.click()
  const box = (await page.locator('.dt-dd').first().boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(500)
})
