import { expect, test } from './fixtures'

test('showcase catalog: hero search narrows rows, row click opens the detail panel', async ({
  page,
  showcase,
}) => {
  const { dt, errors } = await showcase('catalog')
  const count = page.locator('.result-count')
  await expect(count).toHaveText('300 of 300 products')

  await page.getByRole('searchbox', { name: 'Search products' }).fill('kettle')
  await expect(count).not.toHaveText('300 of 300 products')
  const rows = dt.locator('tbody tr')
  await expect(rows.first()).toContainText(/kettle/i)
  // Search matches cell text, so a non-matching row would be a bug
  for (const text of await rows.allTextContents()) expect(text).toMatch(/kettle/i)

  const first = rows.first()
  const name = (await first.locator('.product-name').textContent())!
  await first.locator('[data-col-key="sku"]').click()
  const panel = page.getByRole('complementary', { name: 'Product details' })
  await expect(panel.getByRole('heading', { name })).toBeVisible()
  await expect(first).toHaveAttribute('aria-current', 'true')

  // Escape closes the panel and focus goes back to the row that opened it
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await expect(first).toBeFocused()

  // So does the close button
  await first.locator('[data-col-key="sku"]').click()
  await panel.getByRole('button', { name: 'Close details' }).click()
  await expect(panel).toBeHidden()
  await expect(first).toBeFocused()
  expect(errors).toEqual([])
})

test('showcase catalog: cards keep focus on close and show a custom table sort', async ({
  page,
  showcase,
}) => {
  const { dt, errors } = await showcase('catalog')
  // Sort by a column the cards don't offer
  await dt.getByRole('button', { name: /^SKU/ }).first().click()
  await page.getByRole('button', { name: 'Cards' }).click()
  await expect(page.getByLabel('Sort by')).toHaveValue('')
  await expect(page.getByLabel('Sort by').locator('option:checked')).toHaveText(
    'Custom (set in table)',
  )

  const card = page.locator('.card').first()
  await card.click()
  const panel = page.getByRole('complementary', { name: 'Product details' })
  await expect(panel).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await expect(card).toBeFocused()
  expect(errors).toEqual([])
})

test('showcase catalog: category chips and the Filter dropdown show the same categories', async ({
  page,
  showcase,
}) => {
  const { dt, errors } = await showcase('catalog')
  const chips = page.getByRole('group', { name: 'Categories' })
  await chips.getByRole('button', { name: /Kitchen/ }).click()
  await expect(chips.getByRole('button', { name: /Kitchen/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(chips.getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'false')

  await dt.getByRole('button', { name: 'Filter', exact: true }).click()
  await page.locator('[data-filter-cols]').getByRole('button', { name: 'Category' }).click()
  const detail = page.locator('[data-filter-detail]')
  await expect(detail.getByRole('checkbox', { name: /Kitchen/ })).toBeChecked()
  await expect(detail.getByRole('checkbox', { name: /Audio/ })).not.toBeChecked()
  await expect(detail.locator('[data-dd-value-exclude]')).toHaveCount(0)

  // Ticking a category in the table presses its chip
  await detail.getByRole('checkbox', { name: /Audio/ }).click()
  await expect(chips.getByRole('button', { name: /Audio/ })).toHaveAttribute('aria-pressed', 'true')
  expect(errors).toEqual([])
})
