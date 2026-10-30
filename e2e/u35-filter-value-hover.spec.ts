import { expect, test } from './fixtures'

test.skip(({ isMobile }) => !!isMobile, 'desktop only: hover')

test('U35 a Filter checklist value row gets the same hover background as a column row', async ({
  page,
  section,
}) => {
  const dt = await section('full-table')
  await dt.getByRole('button', { name: 'Filter', exact: true }).click()
  const background = async (selector: string) => {
    const row = page.locator(selector).first()
    await row.hover()
    return row.evaluate((el) => getComputedStyle(el).backgroundColor)
  }
  const columnRow = await background('.dt-filter-col-row:not(.dt-filter-col-row--active)')
  const valueRow = await background('.dt-filter-list .dt-dd-item')
  expect(columnRow).not.toBe('rgba(0, 0, 0, 0)')
  expect(valueRow).toBe(columnRow)
})
