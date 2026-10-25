import { expect, test } from '@playwright/test'

import { answer, answers, cta, dayKey, input, live, nextButton, open } from './helpers'

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

test('reaching the goal for today mid-level announces it, and practice goes on', async ({
  page,
}) => {
  await open(page, {
    unlocked: 1,
    history: { five: answers(2) },
    days: { [dayKey()]: { answered: 9, correct: 9, totalMs: 9000, bestMs: 900 } },
  })
  await expect(page.getByRole('img', { name: '9 of 10 today' })).toBeVisible()
  await cta(page).click()
  await answer(page)
  await expect(live(page)).toContainText('Day done')
  await expect(page.getByText('🔥 Day done')).toBeVisible()
  // No stop: Next asks another problem at the same level, and the toast doesn't repeat.
  await nextButton(page).press('Enter')
  await answer(page)
  await expect(page.getByText('🔥 Day done')).toHaveCount(0)
  // Back Home the card still names the level, and the ring is full.
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(cta(page)).toContainText('Continue level 2')
  await expect(page.getByRole('img', { name: /10 of 10 today/ })).toBeVisible()
})
