import { expect, test } from '@playwright/test'

import { answers, cta, dayKey, input, open, promptEl, solve, stored } from './helpers'

const levels = (page: import('@playwright/test').Page) => page.getByRole('list', { name: 'Levels' })

/** "5%" mastered and last checked a week ago: due again. */
const DUE = {
  unlocked: 2,
  history: { 'ten-any': answers(10), five: answers(10) },
  days: {},
  spaced: { five: { stage: 0, last: dayKey(7) }, 'ten-any': { stage: 3, last: dayKey(1) } },
}

test('a level due for review is marked on the path and opens the next drill as a warm-up', async ({
  page,
}) => {
  await open(page, DUE)
  await expect(levels(page).getByRole('img', { name: 'Due for review' })).toHaveCount(1)
  await expect(levels(page).locator('li', { hasText: /^\s*★\s*5%/ })).toContainText('↻')

  await cta(page).click()
  await expect(page.getByText('↻ warm-up, not counted')).toBeVisible()
  await expect(promptEl(page)).toHaveText(/^5% of /)
  await input(page).fill(String(solve(await promptEl(page).innerText())))
  await input(page).press('Enter')
  // Checked once due: its next review is further off.
  await expect.poll(async () => (await stored(page)).spaced.five.stage).toBe(1)
  await page.getByRole('button', { name: /^Next/ }).press('Enter')
  await expect(page.getByText('↻ warm-up, not counted')).toHaveCount(0)
})

test('a wrong answer with a misplaced decimal point says so', async ({ page }) => {
  await open(page, { unlocked: 0, history: {}, days: {} })
  await cta(page).click()
  await input(page).fill(String(solve(await promptEl(page).innerText()) * 10))
  await input(page).press('Enter')
  await expect(page.getByText('Close: check the decimal point')).toBeVisible()
})

test('the warm-up tag fits on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await open(page, DUE)
  await cta(page).click()
  await expect(page.getByText('↻ warm-up, not counted')).toBeInViewport({ ratio: 1 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
})
