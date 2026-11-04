import { expect, test } from './fixtures'

test('showcase sports: the clubs view shows squad totals and top scorers', async ({
  page,
  showcase,
}) => {
  const { dt, errors } = await showcase('sports')
  // Initial multi-sort: points desc, then goals desc
  const pts = await dt.locator('tbody td[data-col-key="points"]').allTextContents()
  expect(pts.map(Number)).toEqual([...pts.map(Number)].sort((a, b) => b - a))

  await page.getByRole('button', { name: 'Clubs' }).click()
  const club = dt.locator('tr.dt-group-row').first()
  await expect(club).toContainText('Ashford Athletic')
  // The aggregate row under the (collapsed) club header: goal total and the club's top scorer
  const agg = dt.locator('tr.dt-agg-row').first()
  await expect(agg.locator('[data-col-key="name"]')).toHaveText(/^★ .+ \(\d+\)$/)
  await expect(agg.locator('[data-col-key="goals"]')).toHaveText(/^\d{2,}$/)
  await expect(dt.locator('tr.dt-group-row')).toHaveCount(20)
  await expect(page.getByRole('button', { name: 'Players' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  // Expanding a club splits it across pages, but keeps its whole count and totals
  const count = await club.locator('.dt-group-count').textContent()
  const games = await agg.locator('[data-col-key="games"]').textContent()
  await club.click()
  await expect(dt.locator('tbody tr:not(.dt-group-row):not(.dt-agg-row)')).not.toHaveCount(0)
  await expect(club.locator('.dt-group-count')).toHaveText(count!)
  await expect(agg.locator('[data-col-key="games"]')).toHaveText(games!)

  await page.getByRole('button', { name: 'Players' }).click()
  await expect(dt.locator('tr.dt-group-row')).toHaveCount(0)
  await expect(dt.locator('tbody td[data-col-key="points"]').first()).toHaveText(pts[0])
  expect(errors).toEqual([])
})
