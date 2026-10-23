import { expect, test, type Page } from '@playwright/test'

import { answer, answers, cta, nextButton, open, stored } from './helpers'

const pct = (page: Page) => cta(page).locator('span.font-mono')
const surface = (page: Page) => cta(page).locator('svg path').nth(1)

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('the glass shows how far the current level is, and keeps moving', async ({ page }) => {
    await open(page, { unlocked: 2, history: { one: answers(5) }, days: {} })
    await expect(pct(page)).toHaveText('50%', { timeout: 5000 })
    await expect(cta(page).locator('.sr-only')).toHaveText('5 more')
    const before = await surface(page).getAttribute('d')
    await expect.poll(() => surface(page).getAttribute('d')).not.toBe(before)
  })

  test('it rises when Home comes back after a right answer', async ({ page }) => {
    await open(page, { unlocked: 2, history: { one: answers(5) }, days: {} })
    await expect(pct(page)).toHaveText('50%', { timeout: 5000 })
    await cta(page).click()
    // Review problems don't fill it: answer until one at this level is saved.
    for (let i = 0; i < 10; i++) {
      await answer(page)
      if ((await stored(page)).history.one.length === 6) break
      await nextButton(page).press('Enter')
    }
    await page.getByRole('button', { name: 'Back' }).click()
    const start = parseInt(await pct(page).innerText())
    expect(start).toBeGreaterThanOrEqual(50)
    expect(start).toBeLessThan(60)
    await expect(pct(page)).toHaveText('60%', { timeout: 5000 })
  })
})

test('with reduced motion it fills at once and holds still', async ({ page }) => {
  await open(page, { unlocked: 2, history: { one: answers(7) }, days: {} })
  // A pour to 70% takes about 1.9 s; reduced motion skips it.
  await expect(pct(page)).toHaveText('70%', { timeout: 500 })
  const before = await surface(page).getAttribute('d')
  await page.waitForTimeout(400)
  expect(await surface(page).getAttribute('d')).toBe(before)
})
