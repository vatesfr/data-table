import { expect, test } from './fixtures'

test('showcase users: the "No 2FA" view filters rows and survives a reload', async ({
  page,
  showcase,
}) => {
  const { dt, errors } = await showcase('users')
  await page.getByRole('button', { name: 'Views ▾' }).click()
  await page.getByRole('button', { name: 'No 2FA', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No 2FA' })).toBeVisible()

  const mfaCells = dt.locator('tbody [data-col-key="mfa"]')
  await expect(mfaCells.first()).toHaveText('No')
  expect(await mfaCells.allTextContents()).not.toContain('Yes')

  // The fixture clears localStorage on every load: the view comes back from the URL
  await page.reload()
  await expect(page.getByRole('heading', { name: 'No 2FA' })).toBeVisible()
  await expect(mfaCells.first()).toHaveText('No')
  expect(await mfaCells.allTextContents()).not.toContain('Yes')
  expect(errors).toEqual([])
})

test('showcase users: the "Invited" view shows in the Status checklist, which can undo it', async ({
  page,
  showcase,
}) => {
  const { dt, errors } = await showcase('users')
  await page.getByRole('button', { name: 'Views ▾' }).click()
  await page.getByRole('button', { name: 'Invited', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Invited' })).toBeVisible()

  await dt.getByRole('button', { name: 'Filter', exact: true }).click()
  await page.locator('[data-filter-cols]').getByRole('button', { name: 'Status' }).click()
  const detail = page.locator('[data-filter-detail]')
  await expect(detail.getByRole('checkbox', { name: /^Invited/ })).toBeChecked()
  await expect(detail.getByRole('checkbox', { name: /^Active/ })).not.toBeChecked()
  await expect(detail.getByRole('checkbox', { name: /^Suspended/ })).not.toBeChecked()

  // Ticking a value back undoes the view
  await detail.getByRole('checkbox', { name: /^Active/ }).click()
  await expect(page.getByRole('heading', { name: 'Custom view' })).toBeVisible()
  await expect(
    dt.locator('tbody [data-col-key="status"]', { hasText: 'Active' }).first(),
  ).toBeVisible()
  expect(errors).toEqual([])
})
