import { expect, test, type Page } from '@playwright/test'

import { answer, answers, cta, live, nextButton, open } from './helpers'

// The celebration is the glass pouring full: it only happens with motion on.
test.use({ reducedMotion: 'no-preference' })

const DONE = '★ Level 4 complete!'

/** One answer short of finishing level 4, then right answers until it's done. */
async function finishLevel(page: Page) {
  await open(page, { unlocked: 3, history: { one: answers(9) }, days: {} })
  await page.getByRole('button', { name: 'Endless practice →' }).click()
  // Review problems don't count, so it can take a few.
  for (let i = 0; i < 10; i++) {
    await answer(page)
    if (await page.getByText(DONE, { exact: true }).isVisible()) return
    await nextButton(page).press('Enter')
  }
  throw new Error('Level never finished')
}

test('a level-up goes back Home, where the glass celebrates and the next row pops', async ({
  page,
}) => {
  await finishLevel(page)
  await expect(page.locator('dialog')).toHaveCount(0)
  await expect(live(page)).toContainText('Level 4 complete')

  await expect(cta(page)).toBeVisible({ timeout: 3000 })
  await expect(cta(page)).toContainText(DONE)
  await expect(cta(page)).toContainText('Start level 5', { timeout: 8000 })
  await expect(page.getByRole('listitem').nth(4).getByRole('button')).toHaveClass(/animate-pop/)
})

test('Enter goes Home straight away', async ({ page }) => {
  await finishLevel(page)
  await page.keyboard.press('Enter')
  // Well before the automatic return (1.6 s).
  await expect(cta(page)).toBeVisible({ timeout: 1000 })
})
