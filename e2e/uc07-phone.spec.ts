import { expect, test } from './fixtures'
import type { Locator, Page } from '@playwright/test'

test.skip(({ isMobile }) => !isMobile, 'phone only')

const pageScrollsSideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)

async function expectInViewport(page: Page, locator: Locator) {
  const box = (await locator.boundingBox())!
  const { width } = page.viewportSize()!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(width)
}

test('UC07 on a phone', async ({ page, section }) => {
  const dt = await section('full-table')

  // 1. Search, then Filter: the dropdown fits and both panes are reachable
  await dt.getByRole('textbox', { name: 'Search…' }).fill('a')
  await dt.getByRole('button', { name: 'Filter', exact: true }).tap()
  const panel = page.locator('.dt-dd').first()
  await expectInViewport(page, panel)
  const cols = page.locator('[data-filter-cols]')
  await cols.getByRole('button', { name: 'Name', exact: true }).tap()
  await expect(cols).toBeHidden()
  await page.locator('[data-filter-detail]').getByRole('checkbox', { name: 'Alice Martin' }).tap()
  await page.locator('[data-filter-back]').tap()
  await expect(cols).toBeVisible()
  await expectInViewport(page, panel)
  await page.keyboard.press('Escape')
  await expect(dt.locator('.dt-active-bar').getByRole('button', { name: /^Name: / })).toBeVisible()

  // 2. Sort from the Sort dropdown
  await dt.getByRole('button', { name: 'Sort', exact: true }).tap()
  await expectInViewport(page, page.locator('.dt-dd').first())
  await page.locator('.dt-dd').first().getByRole('button', { name: 'Name', exact: true }).tap()
  await page.keyboard.press('Escape')
  await expect(dt.locator('.dt-active-bar').getByRole('button', { name: /^↑ Name/ })).toBeVisible()

  // 3. The table scrolls sideways in its own area, not the page
  expect(await pageScrollsSideways(page)).toBe(false)
  const wrap = dt.locator('.dt-table-wrap')
  expect(await wrap.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
  await wrap.evaluate((el) => el.scrollBy(200, 0))
  expect(await wrap.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
  expect(await pageScrollsSideways(page)).toBe(false)

  // 4. Select a few rows by tapping
  const sel = await section('row-selection')
  const boxes = sel.locator('tbody').getByRole('checkbox')
  await boxes.nth(0).tap()
  await boxes.nth(2).tap()
  await expect(boxes.nth(0)).toBeChecked()
  await expect(boxes.nth(1)).not.toBeChecked()
  await expect(boxes.nth(2)).toBeChecked()
})
