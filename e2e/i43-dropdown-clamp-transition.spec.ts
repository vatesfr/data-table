import { expect, test } from './fixtures'

test.skip(({ isMobile }) => !isMobile, 'phone only: the dropdown must overflow to be clamped')

test('#43 an open dropdown re-clamps once while its transform is transitioning', async ({
  page,
  section,
}) => {
  const dt = await section('full-table')
  // Narrower than full width, so widening it below gives the clamp room to shift it
  await page.addStyleTag({
    content: '.dt-dd { transition: transform 200ms } .dt-filter-panel--narrow { width: 300px }',
  })
  await dt.getByRole('button', { name: 'Filter', exact: true }).tap()
  const panel = page.locator('.dt-dd').first()
  await expect(panel).toHaveAttribute('style', /translateX/)
  const before = await panel.getAttribute('style')

  // Wider content forces a new offset mid-transition; the bug looped forever, freezing the page
  await panel.evaluate((el) => {
    const pad = document.createElement('div')
    pad.style.cssText = `width: ${el.clientWidth + 10}px; height: 1px`
    el.append(pad)
  })
  await expect(panel).not.toHaveAttribute('style', before!)
  // Measured once the transition has settled
  await expect
    .poll(async () => {
      const box = (await panel.boundingBox())!
      return box.x >= 0 && box.x + box.width <= page.viewportSize()!.width
    })
    .toBe(true)
})
