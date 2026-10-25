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
