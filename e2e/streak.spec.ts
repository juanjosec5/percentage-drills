import { expect, test, type Page } from '@playwright/test'

import { dayKey, open } from './helpers'

// Endless-only days (daily: 0): any 10 answers make a day count.
const PRACTISED = { answered: 10, correct: 9, totalMs: 20_000, bestMs: 900, daily: 0 }

/** Opens Home with the given days practised, counted back from today (0 = today). */
const seed = (page: Page, daysAgo: number[]) =>
  open(page, {
    unlocked: 0,
    history: {},
    days: Object.fromEntries(daysAgo.map((n) => [dayKey(n), PRACTISED])),
  })

const chip = (page: Page) => page.locator('header').getByRole('img')

test('one missed day is a rest day: the run goes on', async ({ page }) => {
  await seed(page, [1, 3, 4, 5])
  await expect(chip(page)).toHaveText('🔥 4')
  await expect(chip(page)).toHaveAttribute('aria-label', '4-day streak')
})

test('two missed days in a row end it', async ({ page }) => {
  await seed(page, [1, 4, 5])
  await expect(chip(page)).toHaveText('🔥 1')
  await expect(chip(page)).toHaveAttribute('aria-label', '1-day streak')
})

test('no streak, no chip', async ({ page }) => {
  await seed(page, [])
  await expect(page.locator('h1')).toBeVisible()
  await expect(chip(page)).toHaveCount(0)
})

test('the chip reads in Spanish', async ({ page }) => {
  await seed(page, [0, 2, 3])
  await page.getByRole('button', { name: 'Español' }).click()
  await expect(chip(page)).toHaveText('🔥 3')
  await expect(chip(page)).toHaveAttribute('aria-label', 'Racha de 3 días')
})
