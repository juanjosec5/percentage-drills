import { expect, test, type Page } from '@playwright/test'

import { answer, answers, cta, nextButton, open } from './helpers'

// The celebration is the glass pouring full: it only happens with motion on.
test.use({ reducedMotion: 'no-preference' })

const DONE = '★ Level 3 complete!'

/** One answer short of finishing level 3, then right answers until it's done. */
async function finishLevel(page: Page) {
  await open(page, { unlocked: 2, history: { one: answers(9) }, days: {} })
  await page.getByRole('button', { name: 'Endless practice →' }).click()
  // Review problems don't count, so it can take a few.
  for (let i = 0; i < 10; i++) {
    await answer(page)
    if (await page.getByText(DONE, { exact: true }).isVisible()) return
    await nextButton(page).press('Enter')
  }
  throw new Error('Level never finished')
}

test('Enter goes Home straight away', async ({ page }) => {
  await finishLevel(page)
  await page.keyboard.press('Enter')
  // Well before the automatic return (1.6 s).
  await expect(cta(page)).toBeVisible({ timeout: 1000 })
})

const row = (page: Page, name: RegExp) =>
  page.getByRole('list', { name: 'Levels' }).locator('li.row', { hasText: name })

test('back Home, the glass pours full, the node bursts and the drop hops into the next level', async ({
  page,
}) => {
  await finishLevel(page)
  // The finished level's row holds the glass while it pours to the top.
  await expect(row(page, /1%/)).toContainText(DONE, { timeout: 3000 })
  // Then the drop flies down the rail…
  await expect(page.locator('.flyer')).toBeVisible({ timeout: 4000 })
  // …and lands on the next level, whose glass opens with focus.
  await expect(page.locator('.flyer')).toHaveCount(0, { timeout: 3000 })
  await expect(row(page, /20% … 90%/)).toContainText('Start level 4')
  await expect(cta(page)).toBeFocused()
  await expect(row(page, /★\s*1%/).getByRole('img', { name: 'Mastered' })).toBeVisible()
})

test('a tap skips the moment', async ({ page }) => {
  await finishLevel(page)
  await expect(cta(page)).toContainText(DONE, { timeout: 3000 })
  await page.mouse.click(5, 5)
  await expect(row(page, /20% … 90%/)).toContainText('Start level 4', { timeout: 500 })
  await expect(page.locator('.flyer')).toHaveCount(0)
})

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })
  test('there is no moment: the next level is current at once', async ({ page }) => {
    await finishLevel(page)
    await expect(row(page, /20% … 90%/)).toContainText('Start level 4', { timeout: 3000 })
    await expect(cta(page)).not.toContainText(DONE)
  })
})
