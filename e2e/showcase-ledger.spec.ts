import { expect, test } from './fixtures'

test('showcase ledger: the Dépenses preset keeps only debits, months still summed', async ({
  page,
  showcase,
}) => {
  const { dt, errors } = await showcase('ledger')
  await expect(dt.locator('tbody .amount:not(.amount--neg)').first()).toBeVisible()
  // Internal transfers are excluded by the initial view
  await expect(dt.getByText(/VIR INTERNE/)).toHaveCount(0)

  await dt.getByRole('button', { name: 'Filtrer', exact: true }).click()
  await page.locator('[data-filter-cols]').getByRole('button', { name: 'Montant' }).click()
  await page.getByRole('button', { name: 'Dépenses', exact: true }).click()
  await page.keyboard.press('Escape')

  await expect(dt.locator('tbody .amount:not(.amount--neg)')).toHaveCount(0)
  await expect(
    dt.locator('.dt-agg-row [data-col-key="montant"] .amount--neg').first(),
  ).toBeVisible()
  await expect(page.locator('.report-totals')).toContainText('0,00 €')
  expect(errors).toEqual([])
})

test('showcase ledger: Imprimer prints every line, then restores the page', async ({
  page,
  showcase,
}) => {
  await page.addInitScript(
    () => (window.print = () => void window.dispatchEvent(new Event('beforeprint'))),
  )
  const { dt, errors } = await showcase('ledger')
  const lines = dt.locator('tbody .check')
  const count = Number((await page.locator('.report-count').innerText()).replace(/\D/g, ''))
  expect(count).toBeGreaterThan(100)

  await page.getByRole('button', { name: 'Imprimer' }).click()
  await expect(lines).toHaveCount(count)

  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await expect(lines).not.toHaveCount(count)
  expect(await lines.count()).toBeLessThanOrEqual(100)
  expect(errors).toEqual([])
})
