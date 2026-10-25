import { expect, test } from '@playwright/test'

import { answer as answerDrill, cta, input, NOW, open, promptEl, solve, stored } from './helpers'

type Page = import('@playwright/test').Page

const skip = (page: Page) => page.getByRole('button', { name: 'Find my level →' })
const resultEl = (page: Page) =>
  page.locator('section.card').filter({ has: page.locator('p.text-3xl') })
const verdictEl = (page: Page) => page.locator('section.card p.text-xl')

/** Answers the placement problem on screen and waits for the verdict. */
async function answer(page: Page, right: boolean) {
  // The input is back only once the next problem is up (a right verdict moves on by itself).
  await expect(input(page)).toBeVisible()
  const prompt = await promptEl(page).innerText()
  await input(page).fill(String(solve(prompt) + (right ? 0 : 1)))
  await input(page).press('Enter')
  await expect(verdictEl(page)).toContainText(right ? '✓ Correct' : "✗ Not quite: it's")
  // A wrong answer waits for Next; a right one moves on by itself.
  if (!right) await page.getByRole('button', { name: /^Next/ }).press('Enter')
}

test('stays on offer after practising', async ({ page }) => {
  await open(page, {
    unlocked: 0,
    history: { 'ten-any': [{ correct: true, ms: 900 }] },
    days: {},
  })
  await expect(skip(page)).toBeVisible()
})

test('is gone once it could no longer move the learner up', async ({ page }) => {
  await open(page, { unlocked: 8, history: {}, days: {} })
  await expect(cta(page)).toBeVisible()
  await expect(skip(page)).toHaveCount(0)
})

test('passing Beginner and missing Intermediate starts the learner at Intermediate, with a verdict on every answer', async ({
  page,
}) => {
  await open(page)
  await skip(page).click()
  await expect(page.getByText('Beginner', { exact: true })).toBeVisible()
  for (let i = 0; i < 3; i++) {
    await expect(page.getByRole('img', { name: `${i + 1} of 6` })).toBeVisible()
    await answer(page, true)
  }
  // A pause on the world just opened before its check starts.
  await expect(page.getByRole('status')).toContainText('Intermediate')
  await expect(page.getByRole('img', { name: '4 of 6' })).toBeVisible()
  await answer(page, true)
  await answer(page, false)
  await answer(page, false)

  // Always a result screen, never straight back Home.
  await expect(resultEl(page)).toContainText('Intermediate')
  await expect(resultEl(page)).not.toContainText('Your level stays')
  await page.getByRole('button', { name: 'Start level 5' }).click()

  await expect(cta(page)).toContainText('Start level 5')
  await expect(cta(page)).not.toContainText('complete')
  const levels = page.getByRole('list', { name: 'Levels' })
  // Beginner is done, so it's folded to one line: open it to see the skipped levels.
  await levels.getByRole('button', { name: /Beginner/ }).click()
  await expect(levels.getByRole('img', { name: 'Skipped' })).toHaveCount(4)
  await expect(levels.getByRole('img', { name: 'Mastered' })).toHaveCount(0)
  // Placed at level 5, it could still open Advanced, so it stays.
  await expect(skip(page)).toBeVisible()

  const saved = await stored(page)
  expect(saved.unlocked).toBe(4)
  expect(saved.placedUpTo).toBe(4)
  expect(saved.history).toEqual({})
  expect(Object.keys(saved.days)).toHaveLength(0)
})

test('six right answers start the learner at Advanced', async ({ page }) => {
  await open(page)
  await skip(page).click()
  for (let i = 0; i < 6; i++) await answer(page, true)
  await expect(resultEl(page)).toContainText('Advanced')
  await page.getByRole('button', { name: 'Start level 9' }).click()
  await expect(cta(page)).toContainText('Start level 9')
  await expect(skip(page)).toHaveCount(0)
})

test('two misses end it on a result screen that changes nothing', async ({ page }) => {
  await open(page)
  await skip(page).click()
  await answer(page, false)
  await answer(page, false)
  await expect(resultEl(page)).toContainText('Beginner')
  await expect(resultEl(page)).toContainText('Your level stays')
  await page.getByRole('button', { name: 'Start level 1' }).click()
  await expect(cta(page)).toContainText('Start level 1')
  // Nothing was placed, so nothing was written.
  expect((await stored(page))?.unlocked ?? 0).toBe(0)
})

test('a right but very slow answer shows its time and still ends on the result screen', async ({
  page,
}) => {
  await page.clock.install({ time: NOW })
  await page.goto('/')
  await skip(page).click()
  for (let i = 0; i < 2; i++) {
    const prompt = await promptEl(page).innerText()
    await page.clock.fastForward(30_000)
    await input(page).fill(String(solve(prompt)))
    await input(page).press('Enter')
    await expect(verdictEl(page)).toContainText('✓ Correct')
    await expect(page.getByText(/⏱ \d+\.\ds/)).toBeVisible()
    await page.clock.runFor(1000)
  }
  // Past twice the time, both missed: the check is lost, but the screen says so.
  await expect(resultEl(page)).toContainText('Your level stays')
})

test('Back leaves without placing', async ({ page }) => {
  await open(page)
  await skip(page).click()
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(cta(page)).toContainText('Start level 1')
  await expect(skip(page)).toBeVisible()
})

test('three fast right answers at level 1 offer placement once, mid-drill', async ({ page }) => {
  await open(page)
  await cta(page).click()
  const chip = page.getByRole('button', { name: 'Too easy? Find my level →' })
  for (let i = 0; i < 2; i++) {
    await answerDrill(page, true)
    await expect(chip).toHaveCount(0)
    await page.keyboard.press('Enter')
  }
  await answerDrill(page, true)
  await expect(chip).toBeVisible()
  expect((await stored(page)).settings.offeredPlacement).toBe(true)

  await chip.click()
  await expect(page.getByRole('img', { name: '1 of 6' })).toBeVisible()
})

test('the mid-drill offer never comes back once shown', async ({ page }) => {
  await open(page, {
    unlocked: 0,
    history: {},
    days: {},
    settings: { showTimer: true, offeredPlacement: true },
  })
  await cta(page).click()
  for (let i = 0; i < 4; i++) {
    await answerDrill(page, true)
    await expect(page.getByRole('button', { name: /Too easy/ })).toHaveCount(0)
    await page.keyboard.press('Enter')
  }
})
