import { expect, test } from '@playwright/test'

import { answers, open } from './helpers'

test('the map shows three worlds, in order, with the current level labelled', async ({ page }) => {
  await open(page, { unlocked: 5, history: { fifteen: answers(4) }, days: {} })
  const levels = page.getByRole('list', { name: 'Levels' })
  await expect(levels.getByText(/^(Beginner|Intermediate|Advanced)/)).toHaveText([
    /^Beginner/,
    /^Intermediate/,
    /^Advanced/,
  ])
  await expect(levels.getByRole('img', { name: 'Mastered' })).toHaveCount(5)
  await expect(levels.getByRole('img', { name: 'Locked' })).toHaveCount(5)
  await expect(levels.getByRole('img', { name: '4 of 10' })).toBeVisible()
  // Only the current node shows its title; the others show a short label.
  await expect(levels.getByText('15%', { exact: true })).toHaveCount(2)
  await expect(levels.getByRole('button', { name: /Level 7/ })).toBeDisabled()
})

test('the map fits a phone screen without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await open(page, { unlocked: 1, history: { five: answers(2) }, days: {} })
  const width = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(width).toBeLessThanOrEqual(320)
})
