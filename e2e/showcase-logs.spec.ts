import { expect, test } from './fixtures'

test('showcase logs: a saved search lands in the URL and survives a reload', async ({
  page,
  showcase,
}) => {
  const { dt, errors } = await showcase('logs')
  const levels = dt.locator('tbody tr td[data-col-key="level"]')
  await expect(levels.filter({ hasNotText: 'error' }).first()).toBeVisible()

  const errorsOnly = page.getByRole('button', { name: 'Errors only' })
  const slow = page.getByRole('button', { name: /^Slow/ })
  await expect(errorsOnly).toHaveAttribute('aria-pressed', 'false')
  await errorsOnly.click()
  await expect(page).toHaveURL(/[?&]view=/)
  await expect(errorsOnly).toHaveAttribute('aria-pressed', 'true')
  await expect(slow).toHaveAttribute('aria-pressed', 'false')
  await expect(levels.filter({ hasNotText: 'error' })).toHaveCount(0)
  await expect(dt.locator('tbody tr.log-error')).toHaveCount(100)

  await page.reload()
  await expect(dt.locator('tbody tr.log-error')).toHaveCount(100)
  await expect(levels.filter({ hasNotText: 'error' })).toHaveCount(0)
  await expect(errorsOnly).toHaveAttribute('aria-pressed', 'true')

  // Every saved search is recognized as active once applied
  for (const name of ['Slow (≥ 1 s)', '5xx by service', 'Checkout errors']) {
    const button = page.getByRole('button', { name })
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(errorsOnly).toHaveAttribute('aria-pressed', 'false')
  }
  expect(errors).toEqual([])
})
