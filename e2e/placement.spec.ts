import { expect, test } from '@playwright/test'

import { answer as answerDrill, cta, input, open, promptEl, solve, stored } from './helpers'

type Page = import('@playwright/test').Page

const skip = (page: Page) => page.getByRole('button', { name: 'Find my level · 5 questions' })

/** Placement has no Next button: answering moves straight on, so wait for the prompt to change. */
async function answer(page: Page, right: boolean) {
  const prompt = await promptEl(page).innerText()
  await input(page).fill(String(solve(prompt) + (right ? 0 : 1)))
  await input(page).press('Enter')
}

test('is offered only to a new learner', async ({ page }) => {
  await open(page)
  await expect(skip(page)).toBeVisible()
  await open(page, {
    unlocked: 0,
    history: { 'ten-round': [{ correct: true, ms: 900 }] },
    days: {},
  })
  await expect(skip(page)).toHaveCount(0)
})

test('three right answers then a miss start the learner at level 5, with ☆ on the skipped levels', async ({
  page,
}) => {
  await open(page)
  await skip(page).click()
  for (let i = 0; i < 3; i++) {
    await expect(page.getByRole('img', { name: `${i + 1} of 5` })).toBeVisible()
    await answer(page, true)
  }
  await expect(page.getByRole('img', { name: '4 of 5' })).toBeVisible()
  // No verdicts on the way: the 4th problem simply appears.
  await expect(page.getByText(/Correct|Not quite/)).toHaveCount(0)
  await answer(page, false)

  await expect(cta(page)).toContainText('Start level 5')
  await expect(cta(page)).not.toContainText('complete')
  const levels = page.getByRole('list', { name: 'Levels' })
  await expect(levels.getByRole('img', { name: 'Skipped' })).toHaveCount(4)
  await expect(levels.getByRole('img', { name: 'Mastered' })).toHaveCount(0)
  await expect(skip(page)).toHaveCount(0)

  const saved = await stored(page)
  expect(saved.unlocked).toBe(4)
  expect(saved.placedUpTo).toBe(4)
  expect(saved.history).toEqual({})
  expect(Object.keys(saved.days)).toHaveLength(0)
})

test('missing the first problem changes nothing', async ({ page }) => {
  await open(page)
  await skip(page).click()
  await expect(promptEl(page)).toBeVisible()
  await answer(page, false)
  await expect(cta(page)).toContainText('Start level 1')
  // Nothing was placed, so nothing was written.
  expect((await stored(page))?.unlocked ?? 0).toBe(0)
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
  await expect(page.getByRole('img', { name: '1 of 5' })).toBeVisible()
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
