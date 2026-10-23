import { readFile } from 'node:fs/promises'

import { expect, test, type Page } from '@playwright/test'

import { answers, cta, dayKey, open, stored } from './helpers'

const SAVE = {
  unlocked: 4,
  history: { tens: answers(3) },
  days: { [dayKey()]: { answered: 10, correct: 9, totalMs: 9000, bestMs: 800, daily: 0 } },
}

/** Picks `contents` in the file chooser that the Import button opens. */
async function importFile(page: Page, contents: string) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Import' }).click()
  await (
    await chooser
  ).setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(contents) })
}

test('export downloads the save, and importing it brings the progress back', async ({ page }) => {
  await open(page, SAVE)
  await expect(cta(page)).toContainText('level 5')

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('percent-drills-2026-10-23.json')
  const contents = await readFile(await file.path(), 'utf8')
  expect(JSON.parse(contents)).toMatchObject({ version: 3, placedUpTo: 0, ...SAVE })

  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Reset progress' }).click()
  await expect(cta(page)).toContainText('Start level 1')

  let question = ''
  page.once('dialog', (d) => {
    question = d.message()
    return d.accept()
  })
  // Import reloads the page once the save is written.
  const reloaded = page.waitForEvent('load')
  await importFile(page, contents)
  await reloaded
  await expect(cta(page)).toContainText('level 5')
  expect(question).toBe('Replace your progress with this file?')
  expect(await stored(page)).toMatchObject({ version: 3, placedUpTo: 0, ...SAVE })
})

test('declining the confirm keeps the current progress', async ({ page }) => {
  await open(page, SAVE)
  page.once('dialog', (d) => d.dismiss())
  await importFile(page, JSON.stringify({ unlocked: 0, history: {}, days: {} }))
  await expect(cta(page)).toContainText('level 5')
  expect((await stored(page))?.unlocked ?? SAVE.unlocked).toBe(SAVE.unlocked)
})

test('a file that is not a save is turned away', async ({ page }) => {
  await open(page, SAVE)
  const alert = page.waitForEvent('dialog')
  await importFile(page, '{"name":"something else"}')
  const dialog = await alert
  expect(dialog.type()).toBe('alert')
  expect(dialog.message()).toBe('Not a Percent Drills file')
  await dialog.accept()
  await expect(cta(page)).toContainText('level 5')
})
