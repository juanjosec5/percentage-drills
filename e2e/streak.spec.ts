import { expect, test, type Page } from '@playwright/test'

import { dayKey, open } from './helpers'

// Any 10 answers make a day count.
const PRACTISED = { answered: 10, correct: 9, totalMs: 20_000, bestMs: 900 }

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
  await expect(chip(page)).toContainText('4')
  await expect(chip(page)).toHaveAttribute('aria-label', '4-day streak · 0 of 10 today')
})

test('two missed days in a row end it', async ({ page }) => {
  await seed(page, [1, 4, 5])
  await expect(chip(page)).toContainText('1')
  await expect(chip(page)).toHaveAttribute('aria-label', '1-day streak · 0 of 10 today')
})

test('with no streak the chip still shows the goal for today', async ({ page }) => {
  await seed(page, [])
  await expect(chip(page)).toHaveAttribute('aria-label', '0 of 10 today')
})

test('the chip reads in Spanish', async ({ page }) => {
  await seed(page, [0, 2, 3])
  await page.getByRole('button', { name: 'Español' }).click()
  await expect(chip(page)).toContainText('3')
  await expect(chip(page)).toHaveAttribute('aria-label', 'Racha de 3 días · 10 de 10 hoy')
})
