import { expect, test } from './fixtures'

test.skip(({ isMobile }) => !!isMobile, 'desktop only: the phone pane names its column')

for (const colorScheme of ['light', 'dark'] as const)
  test(`U38 the Filter column shown in the pane looks different from a hovered one (${colorScheme})`, async ({
    page,
    section,
  }) => {
    await page.emulateMedia({ colorScheme })
    const dt = await section('full-table')
    await dt.getByRole('button', { name: 'Filter', exact: true }).click()
    const look = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((row) => {
          const item = row.querySelector('.dt-filter-col-item')!
          return [getComputedStyle(row).backgroundColor, getComputedStyle(item).color]
        })
    const active = '.dt-filter-col-row--active'
    const hovered = '.dt-filter-col-row:not(.dt-filter-col-row--active)'
    await page.locator(hovered).first().hover()
    const hoveredLook = await look(hovered)
    expect(await look(active)).not.toEqual(hoveredLook)
    // Hovering the active row keeps its look
    const activeLook = await look(active)
    await page.locator(active).hover()
    expect(await look(active)).toEqual(activeLook)
  })
