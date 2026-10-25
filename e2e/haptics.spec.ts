import { expect, test, type Page } from '@playwright/test'

import { answers, cta, input, NOW, nextButton, open, promptEl, solve } from './helpers'

/** Pretends to be a phone that can vibrate, and records every buzz. */
async function phone(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { buzzes: unknown[] }
    w.buzzes = []
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (pattern: unknown) => (w.buzzes.push(pattern), true),
    })
  })
}
const buzzes = (page: Page) =>
  page.evaluate(() => (window as unknown as { buzzes: unknown[] }).buzzes)

async function reply(page: Page, right: boolean) {
  await input(page).fill(String(solve(await promptEl(page).innerText()) + (right ? 0 : 1)))
  await input(page).press('Enter')
  await expect(nextButton(page)).toBeFocused()
}

test('a right answer gives a short buzz; a wrong one never does', async ({ page }) => {
  await phone(page)
  await open(page)
  await cta(page).click()
  await reply(page, true)
  expect(await buzzes(page)).toEqual([15])
  await nextButton(page).press('Enter')
  await reply(page, false)
  expect(await buzzes(page)).toEqual([15])
})

test('a right but slow answer says it did not count, and does not buzz', async ({ page }) => {
  await phone(page)
  await page.clock.install({ time: NOW })
  await open(page)
  await cta(page).click()
  // Level 1 allows 7s.
  await expect(page.getByText('/ 7s')).toBeVisible()
  await page.clock.fastForward(9000)
  await reply(page, true)
  await expect(page.getByText('⏱ over 7s, not counted')).toBeVisible()
  await expect(page.getByRole('img', { name: '0 of 10' })).toBeVisible()
  expect(await buzzes(page)).toEqual([])
})

test.describe('with motion', () => {
  // The level-up moment (and its buzz) only plays with motion on.
  test.use({ reducedMotion: 'no-preference' })
  test('a level-up buzzes on Home with the burst, then ticks as Plip lands', async ({ page }) => {
    await phone(page)
    await open(page, { unlocked: 2, history: { one: answers(9) }, days: {} })
    await cta(page).click()
    for (let i = 0; i < 10; i++) {
      await reply(page, true)
      if (await page.getByText('★ Level 3 complete!', { exact: true }).isVisible()) break
      await nextButton(page).press('Enter')
    }
    await nextButton(page).press('Enter')
    // The burst's pattern, then a light tick as Plip lands, in that order.
    await expect
      .poll(async () => JSON.stringify(await buzzes(page)), { timeout: 8000 })
      .toMatch(/\[20,60,20,60,40\],12\]$/)
    await expect(cta(page)).toContainText('Start level 4')
  })
})

test('the vibration switch turns it off, and the choice is kept', async ({ page }) => {
  await phone(page)
  await open(page)
  await cta(page).click()
  const toggle = page.getByRole('switch', { name: 'Vibration' })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await reply(page, true)
  expect(await buzzes(page)).toEqual([])
  expect(await page.evaluate(() => localStorage.getItem('percent-drills:haptics'))).toBe('off')
})

test('where the phone cannot vibrate, there is no switch', async ({ page }) => {
  await page.addInitScript(() => {
    // Like iPhone Safari: no Vibration API at all.
    delete (Navigator.prototype as unknown as { vibrate?: unknown }).vibrate
  })
  await open(page)
  await cta(page).click()
  await expect(promptEl(page)).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Vibration' })).toHaveCount(0)
})
