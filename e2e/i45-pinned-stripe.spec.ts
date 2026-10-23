import { expect, test } from './fixtures'
import type { Locator } from '@playwright/test'

const bg = (cell: Locator) =>
  cell.evaluate((el) => {
    const cs = getComputedStyle(el)
    return { color: cs.backgroundColor, image: cs.backgroundImage }
  })

test('#45 pinned cells follow --dt-stripe-background, so transparent turns striping off everywhere', async ({
  section,
}) => {
  const dt = await section('full-table')
  const odd = dt.locator('tbody tr.dt-tr--odd').first()
  const pinned = odd.locator('td.dt-pinned')
  const regular = odd.locator('td:not(.dt-pinned)').last()

  // Default: the pinned cell layers the same stripe over its opaque base
  const stripe = (await bg(regular)).color
  expect(stripe).not.toBe('rgba(0, 0, 0, 0)')
  expect(await bg(pinned)).toEqual({
    color: 'rgb(255, 255, 255)',
    image: `linear-gradient(${stripe}, ${stripe}), none`,
  })

  await dt.evaluate((el) => el.style.setProperty('--dt-stripe-background', 'transparent'))
  expect((await bg(regular)).color).toBe('rgba(0, 0, 0, 0)')
  expect(await bg(pinned)).toEqual({
    color: 'rgb(255, 255, 255)',
    image: 'linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 0)), none',
  })
})
