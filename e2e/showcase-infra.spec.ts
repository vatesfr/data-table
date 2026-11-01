import { expect, test } from './fixtures'

test('showcase infra: bulk stop keeps the selection on the replaced rows', async ({
  page,
  showcase,
}) => {
  const { dt, errors } = await showcase('infra')
  const first = dt.locator('tbody tr', { hasText: 'Running' }).first()
  const name = (await first.locator('[data-col-key="name"]').textContent())!
  await first.getByRole('checkbox').check()
  await expect(page.getByText('1 selected')).toBeVisible()

  await page.getByRole('button', { name: '■ Stop' }).click()
  const row = dt.locator('tbody tr', { hasText: name })
  await expect(row).toHaveClass(/vm-halted/)
  // Stop replaces the row objects; getRowId keeps the selection
  await expect(row.getByRole('checkbox')).toBeChecked()
  await expect(page.getByText('1 selected')).toBeVisible()
  expect(errors).toEqual([])
})
