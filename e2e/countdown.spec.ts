import { expect, test } from '@playwright/test'

import { answer, cta, open, promptEl } from './helpers'

const R = { correct: true, ms: 900 }
const W = { correct: false, ms: 900 }
const SLOW = { correct: true, ms: 99_000 }

test.beforeEach(async ({ page }) => {
  // Level 3 ("1%"): three right and fast, two wrong, one right but slow.
  await open(page, { unlocked: 2, history: { one: [R, W, SLOW, R, W, R] }, days: {} })
})

test('wrong answers never take one back, and review problems are tagged', async ({ page }) => {
  // Practice never stops early, so 12 answers in one go are fine.
  await cta(page).click()
  let sawReview = false
  for (let i = 0; i < 12; i++) {
    await expect(promptEl(page)).toBeVisible()
    if (await page.getByText('↺ review').isVisible()) sawReview = true
    await answer(page, false)
    await page.keyboard.press('Enter')
  }
  await expect(page.getByText('7 more')).toBeVisible()
  expect(sawReview).toBe(true)
  // The pips are the only count on screen: no bar, no tally of right answers, just the average.
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expect(page.getByText(/^\s*avg [\d.]+s\s*$/)).toBeVisible()
})
