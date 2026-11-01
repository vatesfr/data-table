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
