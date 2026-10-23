import { expect, test } from '@playwright/test'

import { answer, cta, open, promptEl } from './helpers'

const R = { correct: true, ms: 900 }
const W = { correct: false, ms: 900 }
const SLOW = { correct: true, ms: 99_000 }

test.beforeEach(async ({ page }) => {
  // Level 4 ("1%"): three right and fast, two wrong, one right but slow.
  await open(page, { unlocked: 3, history: { one: [R, W, SLOW, R, W, R] }, days: {} })
})

test('counts only right, on-time answers', async ({ page }) => {
  const meter = page.getByRole('list', { name: 'Levels' }).getByRole('img', { name: '3 of 10' })
  await expect(meter).toBeVisible()
  await expect(meter.locator('span.bg-correct')).toHaveCount(3)
  await expect(cta(page)).toContainText('30%')

  await cta(page).click()
  await expect(page.getByText('7 more')).toBeVisible()
})

test('wrong answers never take one back, and review problems are tagged', async ({ page }) => {
  // Endless: the daily set would stop after 10.
  await page.getByRole('button', { name: 'Endless practice →' }).click()
  let sawReview = false
  for (let i = 0; i < 12; i++) {
    await expect(promptEl(page)).toBeVisible()
    if (await page.getByText('↺ review').isVisible()) sawReview = true
    await answer(page, false)
    await page.keyboard.press('Enter')
  }
  await expect(page.getByText('7 more')).toBeVisible()
  expect(sawReview).toBe(true)
})
