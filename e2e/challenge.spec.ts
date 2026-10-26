import { expect, test, type Page } from '@playwright/test'

import {
  answer as answerDrill,
  answers,
  cta,
  input,
  NOW,
  open,
  promptEl,
  solve,
  stored,
} from './helpers'

const levels = (page: Page) => page.getByRole('list', { name: 'Levels' })
const challengeCta = (page: Page) => page.locator('button.btn-challenge')
const verdictEl = (page: Page) => page.locator('section.card p.text-xl')
/** Beginner's last level (20% … 90%) mastered: its challenge is the way on. */
const AT_GATE = { unlocked: 3, history: { tens: answers(10) }, days: {} }

/** Answers the challenge problem on screen; a right one moves on by itself. */
async function answer(page: Page, right: boolean) {
  await expect(input(page)).toBeVisible()
  const prompt = await promptEl(page).innerText()
  await input(page).fill(String(solve(prompt) + (right ? 0 : 1)))
  await input(page).press('Enter')
  await expect(verdictEl(page)).toContainText(right ? '✓ Correct' : "✗ Not quite: it's")
}

test("a world's last level mastered: the checkpoint is the current stop, the next world stays shut", async ({
  page,
}) => {
  await open(page, AT_GATE)
  await expect(cta(page)).toHaveCount(0)
  await expect(challengeCta(page)).toContainText('Beginner challenge · 10 in a row')
  await expect(challengeCta(page)).toContainText('Start challenge')
  await expect(challengeCta(page)).toBeFocused()
  await expect(levels(page).locator('li.row.gate.current')).toHaveCount(1)
  // Its last level shows as mastered; Intermediate is still locked.
  await expect(levels(page).getByRole('img', { name: 'Mastered' })).toHaveCount(4)
  await expect(levels(page).getByText('50%, 25%, 75%, 20%')).toHaveCount(0)
})

test('ten in a row opens the next world', async ({ page }) => {
  await open(page, AT_GATE)
  await challengeCta(page).click()
  await expect(page.getByText('Beginner challenge')).toBeVisible()
  for (let i = 0; i < 10; i++) await answer(page, true)
  await expect(page.getByRole('status')).toContainText('→ Intermediate')
  await page.getByRole('button', { name: 'Start level 5' }).click()

  await expect(cta(page)).toContainText('Start level 5')
  // Beginner folds as done; its flag is gold once opened.
  const beginner = levels(page).getByRole('button', { name: /Beginner/ })
  await beginner.click()
  await expect(levels(page).getByRole('img', { name: 'Passed' })).toBeVisible()
  expect((await stored(page)).challenges).toEqual({ beginner: 10 })
})

test('the first miss ends the run; the best stays and a retry is one tap away', async ({
  page,
}) => {
  await open(page, AT_GATE)
  await challengeCta(page).click()
  for (let i = 0; i < 3; i++) await answer(page, true)
  await answer(page, false)
  await page.getByRole('button', { name: /^Next/ }).press('Enter')

  const result = page.getByRole('status')
  await expect(result).toContainText('3/10')
  await expect(result).toContainText('Best 3/10')
  const retry = page.getByRole('button', { name: 'Try again' })
  await expect(retry).toBeFocused()
  await retry.press('Enter')
  await expect(input(page)).toBeFocused()
  await page.getByRole('button', { name: 'Back' }).click()

  await expect(challengeCta(page)).toContainText('Try again')
  await expect(challengeCta(page)).toContainText('Best 3/10')
  expect((await stored(page)).challenges).toEqual({ beginner: 3 })
})

test('right but past twice the time ends the run too, and says why', async ({ page }) => {
  await page.clock.install({ time: NOW })
  await open(page, AT_GATE)
  await challengeCta(page).click()
  const prompt = await promptEl(page).innerText()
  await page.clock.fastForward(60_000)
  await input(page).fill(String(solve(prompt)))
  await input(page).press('Enter')
  await expect(verdictEl(page)).toContainText('✓ Correct')
  await expect(page.getByText(/^⏱ over \d+s$/)).toBeVisible()
  await page.getByRole('button', { name: /^Next/ }).click()
  await expect(page.getByRole('status')).toContainText('0/10')
})

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' })

  test("finishing a world's last level hops the drop onto the flag", async ({ page }) => {
    await open(page, { unlocked: 3, history: { tens: answers(9) }, days: {} })
    await cta(page).click()
    for (let i = 0; i < 10; i++) {
      await answerDrill(page)
      if (await page.getByText('★ Level 4 complete!', { exact: true }).isVisible()) break
      await page.getByRole('button', { name: /^Next/ }).press('Enter')
    }
    await page.keyboard.press('Enter')
    await expect(page.locator('.flyer')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.flyer')).toHaveCount(0, { timeout: 3000 })
    await expect(challengeCta(page)).toBeFocused()
  })
})
