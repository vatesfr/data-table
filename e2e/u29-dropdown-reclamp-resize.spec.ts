import { expect, test } from './fixtures'

test.skip(({ isMobile }) => !isMobile, 'phone only: the dropdown must overflow to be clamped')

test('U29 an open dropdown re-clamps when its size changes without a DOM change', async ({
  page,
  section,
}) => {
  const dt = await section('full-table')
  await dt.getByRole('button', { name: 'Sort', exact: true }).tap()
  const panel = page.locator('.dt-dd').first()
  const { width } = (await panel.boundingBox())!
  // A stylesheet in <head> (or a transition) resizes the panel without touching the DOM it watches
  await page.addStyleTag({
    content: `.dt-dd { min-width: ${Math.round(width) + 40}px !important }`,
  })
  await expect
    .poll(async () => {
      const box = (await panel.boundingBox())!
      return box.x + box.width <= page.viewportSize()!.width
    })
    .toBe(true)
})
