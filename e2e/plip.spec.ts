import { expect, test } from '@playwright/test'

import { open } from './helpers'

const plip = (page: import('@playwright/test').Page) => page.locator('.plip')

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('a tap starts a reaction, and five quick taps melt Plip into a puddle', async ({ page }) => {
    await open(page)
    await plip(page).dispatchEvent('pointerdown')
    await expect(plip(page)).toHaveAttribute('data-reaction', /^(squish|hop|spin|giggle)$/)
    await page.waitForTimeout(2200)
    for (let i = 0; i < 5; i++) await plip(page).dispatchEvent('pointerdown')
    await expect(plip(page)).toHaveAttribute('data-reaction', 'puddle')
  })

  test('it glows and breathes on its own, without settling into a beat', async ({ page }) => {
    await open(page)
    const filter = () => plip(page).evaluate((el) => (el as HTMLElement).style.filter)
    const first = await filter()
    await page.waitForTimeout(400)
    expect(await filter()).not.toBe(first)
  })
})

test('with reduced motion a tap is only a tiny squash, and nothing glows by itself', async ({
  page,
}) => {
  await open(page)
  const filter = () => plip(page).evaluate((el) => (el as HTMLElement).style.filter)
  const first = await filter()
  await plip(page).dispatchEvent('pointerdown')
  await expect(plip(page)).toHaveAttribute('data-reaction', /.+/)
  await page.waitForTimeout(400)
  expect(await filter()).toBe(first)
})
