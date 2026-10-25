import { expect, test } from '@playwright/test'

import { answer, open, promptEl } from './helpers'

const R = { correct: true, ms: 900 }
const W = { correct: false, ms: 900 }
const SLOW = { correct: true, ms: 99_000 }

test.beforeEach(async ({ page }) => {
  // Level 3 ("1%"): three right and fast, two wrong, one right but slow.
  await open(page, { unlocked: 2, history: { one: [R, W, SLOW, R, W, R] }, days: {} })
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
  // Endless has no end: a plain tally and no bar, nothing that reads as a target.
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expect(page.getByText(/^✓ 0 · avg/)).toBeVisible()
})
