import { expect, test, type Page } from '@playwright/test'

import { cta, input, nextButton, open, promptEl, solve } from './helpers'

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
