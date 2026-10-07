import { expect, test } from './fixtures'

test.skip(({ isMobile }) => !!isMobile, 'desktop only: a phone shows one pane at a time')

test('U4: the Filter dropdown column pane fits its content, search box included', async ({
  page,
  section,
}) => {
  const dt = await section('full-table')
  await dt.getByRole('button', { name: 'Filter', exact: true }).click()
  const cols = page.locator('[data-filter-cols]')
  await expect(cols).toBeVisible()
  const { scrollsX, searchRight, paneRight } = await cols.evaluate((el) => ({
    scrollsX: el.scrollWidth > el.clientWidth,
    searchRight: el.querySelector('input')!.getBoundingClientRect().right,
    paneRight: el.getBoundingClientRect().right,
  }))
  expect(scrollsX).toBe(false)
  expect(searchRight).toBeLessThanOrEqual(paneRight)
})
