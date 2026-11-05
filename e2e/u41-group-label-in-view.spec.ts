import { expect, test } from './fixtures'

test.skip(({ isMobile }) => !isMobile, 'phone only')

test('U41 a group label stays in view and wraps while the table scrolls sideways', async ({
  page,
  section,
}) => {
  const dt = await section('full-table')
  for (const col of ['Department', 'Joined']) {
    await dt.getByRole('button', { name: 'Group', exact: true }).tap()
    const dd = page.locator('.dt-dd').first()
    // Both sit in a category submenu: reach them through the dropdown's search
    await dd.getByRole('textbox', { name: 'Search…' }).fill(col)
    await dd.getByRole('button', { name: col }).first().tap()
    await page.keyboard.press('Escape')
  }
  const wrap = dt.locator('.dt-table-wrap')
  const header = dt.locator('.dt-group-row').first()
  await expect(header).toContainText('Department:')
  // The label's two ends: its first column name, and the row count that closes it
  const ends = [header.locator('.dt-group-colname').first(), header.locator('.dt-group-count')]

  for (const scrollLeft of [0, 1e6]) {
    await wrap.evaluate((el, x) => (el.scrollLeft = x), scrollLeft)
    const w = (await wrap.boundingBox())!
    for (const end of ends) {
      const box = (await end.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(w.x)
      expect(box.x + box.width).toBeLessThanOrEqual(w.x + w.width)
    }
  }
})
