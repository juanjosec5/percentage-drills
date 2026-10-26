import { expect, test, type Page } from '@playwright/test'

import { answer, cta, dayKey, nextButton, open, promptEl, setVisibility, stored } from './helpers'

const timer = (page: Page) => page.getByRole('switch', { name: 'Timer' })
const time = (page: Page) => page.locator('section.card p.tabular-nums')
const answeredToday = async (page: Page) => (await stored(page))?.days[dayKey()]?.answered ?? 0

test('a corrupt save still opens at level 1', async ({ page }) => {
  await open(page, '{"unlocked":"x","days":null}')
  await expect(cta(page)).toContainText('Start level 1')
})

test('the timer switch hides the running clock, and the choice is saved', async ({ page }) => {
  await open(page)
  await cta(page).click()
  await expect(timer(page)).toHaveAttribute('aria-checked', 'true')
  await expect(time(page)).toHaveText(/^\d+\.\ds \/ \d+s$/)

  await timer(page).click()
  await expect(timer(page)).toHaveAttribute('aria-checked', 'false')
  await expect(time(page)).toHaveCount(0)
  expect((await stored(page)).settings.showTimer).toBe(false)

  // The time still shows once answered.
  await answer(page, false)
  await expect(time(page)).toHaveText(/^\d+\.\ds \/ \d+s$/)

  await page.reload()
  await cta(page).click()
  await expect(timer(page)).toHaveAttribute('aria-checked', 'false')
})

test('leaving the page mid-problem drops it and asks a new one', async ({ page }) => {
  await open(page)
  await cta(page).click()
  const first = await promptEl(page).innerText()

  await setVisibility(page, 'hidden')
  await setVisibility(page, 'visible')
  await expect(page.getByRole('status')).toHaveText('You left · new problem')
  await expect(promptEl(page)).not.toHaveText(first)
  expect(await answeredToday(page)).toBe(0)
  expect(parseFloat(await time(page).innerText())).toBeLessThan(1.5)

  await answer(page)
  expect(await answeredToday(page)).toBe(1)
  await expect(page.getByRole('status')).toHaveCount(0)

  // Hidden during feedback: nothing to drop.
  await setVisibility(page, 'hidden')
  await setVisibility(page, 'visible')
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(nextButton(page)).toBeVisible()
})

test('reset erases progress but keeps the timer setting', async ({ page }) => {
  await open(page, {
    unlocked: 2,
    history: {},
    days: { [dayKey()]: { answered: 3, correct: 3, totalMs: 3000, bestMs: 900 } },
    settings: { showTimer: false },
  })
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Reset progress' }).click()
  await expect(cta(page)).toContainText('level 1')
  const saved = await stored(page)
  expect(saved).toMatchObject({ current: 'ten-any', days: {}, settings: { showTimer: false } })
})
