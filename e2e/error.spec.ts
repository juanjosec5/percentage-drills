import { expect, test } from '@playwright/test'

import { KEY, open } from './helpers'

test('a render failure shows a way out that erases the save', async ({ page }) => {
  // Number formatting runs in every render of Home, so breaking it fails the first render.
  await page.addInitScript(() => {
    Intl.NumberFormat = function () {
      throw new Error('broken on purpose')
    } as unknown as typeof Intl.NumberFormat
  })
  await open(page, { unlocked: 2, history: {}, days: {} })

  await expect(page.getByText('Something went wrong')).toBeVisible()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Reset' }).click()
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), KEY), { timeout: 5000 })
    .toBeNull()
})

test('an app that renders gets no fallback', async ({ page }) => {
  await open(page)
  await expect(page.locator('h1')).toBeVisible()
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
})
