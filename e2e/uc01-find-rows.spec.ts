import { expect, test } from './fixtures'

test('UC01 find rows in a list', async ({ page, section }) => {
  const dt = await section('full-table')
  const names = () => dt.locator('tbody tr td:first-child').allInnerTexts()
  const column = (index: number) => dt.locator(`tbody tr td:nth-child(${index})`).allInnerTexts()
  const salaries = async () => (await column(4)).map((s) => Number(s.replace(/\D/g, '')))
  const initialNames = await names()

  // 1. Search
  await dt.getByRole('textbox', { name: 'Search…' }).fill('lead')
  await expect(dt.getByText('7 / 20 rows')).toBeVisible()
  for (const row of await dt.locator('tbody tr').allInnerTexts()) expect(row).toMatch(/lead/i)

  // 2. Department to Engineering and Product
  await dt.getByRole('button', { name: 'Filter' }).click()
  const cols = page.locator('[data-filter-cols]')
  const detail = page.locator('[data-filter-detail]')
  const pick = async (name: string) => {
    // On a phone the panes take turns: back from a column's values to the column list.
    if (!(await cols.isVisible())) await page.locator('[data-filter-back]').click()
    await cols.getByRole('textbox').fill(name)
    await cols.getByRole('button', { name, exact: true }).click()
  }
  await pick('Department')
  await detail.getByRole('checkbox', { name: 'Select all' }).click()
  await detail.getByRole('checkbox', { name: 'Engineering' }).click()
  await detail.getByRole('checkbox', { name: 'Product' }).click()
  expect(new Set(await column(2))).toEqual(new Set(['Engineering', 'Product']))
  const bar = dt.locator('.dt-active-bar')
  await expect(bar.getByRole('button', { name: /^Department: / })).toBeVisible()

  // 3. Salary range; its bounds' format is U5
  await pick('Salary')
  await detail.getByRole('textbox', { name: 'Salary Min' }).fill('90000')
  await detail.getByRole('textbox', { name: 'Salary Min' }).press('Enter')
  await expect(bar.getByRole('button', { name: 'Salary: $90,000–' })).toBeVisible()
  for (const salary of await salaries()) expect(salary).toBeGreaterThanOrEqual(90000)
  expect(await names()).toEqual(['Clara Dubois', 'Olivia Smith', 'Sam Patel'])

  // 4. Exclude Leadership: its row's ≠ button
  await pick('Skills')
  const exclude = detail.getByRole('button', { name: 'Exclude Leadership' })
  await exclude.click()
  await expect(exclude).toHaveAttribute('aria-pressed', 'true')
  await expect(bar.getByRole('button', { name: 'Skills: ≠ Leadership' })).toBeVisible()
  expect(await names()).toEqual(['Clara Dubois'])
  await page.keyboard.press('Escape')

  // 5. Sort by Salary, then shift-click Joined
  await dt.getByRole('button', { name: 'Salary', exact: true }).click()
  await dt.getByRole('button', { name: 'Joined', exact: true }).click({ modifiers: ['Shift'] })
  const salarySort = bar.getByRole('button', { name: /^↑ Salary/ })
  await expect(salarySort).toBeVisible()
  await expect(bar.getByRole('button', { name: /^↓ Joined/ })).toBeVisible()

  // 6. Flip the sort from its chip, remove the Skills filter from its ×
  await salarySort.click()
  await expect(bar.getByRole('button', { name: /^↓ Salary/ })).toBeVisible()
  await bar
    .locator('.dt-chip', { hasText: 'Skills' })
    .getByRole('button', { name: 'Clear filter' })
    .click()
  expect(await names()).toHaveLength(3)
  const flipped = await salaries()
  expect(flipped).toEqual(flipped.toSorted((a, b) => b - a))

  // 7. Clear all
  await dt.getByRole('button', { name: '× Clear all' }).click()
  await expect(dt.getByText('20 / 20 rows')).toBeVisible()
  expect(await names()).toEqual(initialNames)
})
