import { expect, test } from '@playwright/test'

import { answer, cta, dayKey, input, live, nextButton, open } from './helpers'

test('focus moves with the flow: CTA, input, Next, back to the CTA', async ({ page }) => {
  await open(page)
  await expect(cta(page)).toBeFocused()
  await cta(page).click()
  await expect(input(page)).toBeFocused()
  await answer(page)
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(cta(page)).toBeFocused()
})

test('invalid input is flagged and cannot be submitted', async ({ page }) => {
  await open(page)
  await cta(page).click()
  await input(page).fill('abc')
  await expect(page.locator('#answer-hint')).toHaveText('Numbers only')
  await expect(input(page)).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('button', { name: 'Check' })).toBeDisabled()
})

test('the live region announces each verdict', async ({ page }) => {
  await open(page)
  await cta(page).click()
  await answer(page, false)
  await expect(live(page)).toHaveText(/^Not quite: it's /)
  await expect(page.locator('ol.font-mono')).toBeVisible()
  await nextButton(page).press('Enter')

  await answer(page)
  await expect(live(page)).toHaveText('Correct')
  await expect(page.locator('ol.font-mono')).toHaveCount(0)
})

test('finishing the daily set announces it and focuses Home', async ({ page }) => {
  await open(page, {
    unlocked: 0,
    history: {},
    days: { [dayKey()]: { answered: 9, correct: 9, totalMs: 9000, bestMs: 900, daily: 9 } },
  })
  await cta(page).click()
  await answer(page)
  await nextButton(page).press('Enter')
  await expect(live(page)).toHaveText('Daily set done')
  await expect(page.getByText('1/1 right')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Home' })).toBeFocused()
})
