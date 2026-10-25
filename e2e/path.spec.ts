import { expect, test } from '@playwright/test'

import { answers, cta, open } from './helpers'

const levels = (page: import('@playwright/test').Page) => page.getByRole('list', { name: 'Levels' })

test('the current level holds the glass, finished worlds fold, and the next level shows a sample', async ({
  page,
}) => {
  await open(page, { unlocked: 5, history: { fifteen: answers(2) }, days: {} })
  // The glass sits in the current level's row, not above the path.
  await expect(levels(page).locator('li.row.current')).toContainText('Continue level 6')

  // Beginner is done: one line, opened with a tap.
  const beginner = levels(page).getByRole('button', { name: /Beginner/ })
  await expect(beginner).toHaveAttribute('aria-expanded', 'false')
  await expect(levels(page).getByText('5%', { exact: true })).toHaveCount(0)
  await beginner.click()
  await expect(levels(page).getByText('5%', { exact: true })).toBeVisible()

  // Advanced isn't reached: a locked heading, no rows.
  await expect(levels(page).getByText('What %?')).toHaveCount(0)

  // The next level shows a real problem from it.
  const next = levels(page).getByRole('button', { name: '12%, 19%, 35%…, Locked' })
  await expect(next.locator('.font-mono')).toHaveText(/^\d+% of [\d,]+$/)
})

test('a locked level shows a sample when tapped; a mastered one starts practice', async ({
  page,
}) => {
  await open(page, { unlocked: 5, history: {}, days: {} })
  const swap = levels(page).getByRole('button', { name: 'Swap trick, Locked' })
  await expect(swap.locator('.font-mono')).toHaveCount(0)
  await swap.click()
  await expect(swap.locator('.font-mono')).toHaveText(/% of /)
  await expect(swap.locator('.font-mono')).toHaveCount(0, { timeout: 3000 })

  await levels(page)
    .getByRole('button', { name: /50%, 25%, 75%, 20%/ })
    .click()
  await expect(cta(page)).toHaveCount(0)
  await expect(page.getByText('Level 5', { exact: true })).toBeVisible()
})

test('no sideways scroll on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await open(page, { unlocked: 5, history: {}, days: {} })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
})
