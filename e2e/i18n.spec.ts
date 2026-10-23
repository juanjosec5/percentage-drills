import { expect, test, type Page } from '@playwright/test'

import { answer, answers, cta, LANG_KEY, nextButton, open, promptEl, solve } from './helpers'

const ENGLISH =
  /\b(the|of|and|is|your|level|levels|right|today|next|back|check|correct|answer|answered|daily|endless|start|continue|streak|review|mastered|reset|progress|what|half|home|not quite|day|days|complete|swap|build|increase|decrease|mixed)\b/gi
const englishIn = (text: string) => [...new Set(text.match(ENGLISH)?.map((w) => w.toLowerCase()))]

const htmlLang = (page: Page) => page.locator('html')
const pressed = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

test.describe('Spanish browser', () => {
  test.use({ locale: 'es-CO' })

  test('starts in Spanish and saves nothing until chosen', async ({ page }) => {
    await open(page)
    await expect(htmlLang(page)).toHaveAttribute('lang', 'es')
    await expect(pressed(page, 'Español')).toHaveAttribute('aria-pressed', 'true')
    expect(await page.evaluate((k) => localStorage.getItem(k), LANG_KEY)).toBeNull()
  })

  test('a Spanish drill has no English, "15%" with no space and a decimal comma', async ({
    page,
  }) => {
    // Level 7 ("15%"), part-way through.
    await open(page, { unlocked: 6, history: { fifteen: answers(3) }, days: {} })
    expect(englishIn(await page.locator('body').innerText())).toEqual([])
    await expect(cta(page)).toContainText('Continuar el nivel 7')

    let confirmText = ''
    page.once('dialog', (d) => {
      confirmText = d.message()
      return d.dismiss()
    })
    await page.getByRole('button', { name: 'Borrar progreso' }).click()
    await expect.poll(() => confirmText).toBe('¿Borrar todo tu progreso?')

    await cta(page).click()
    await expect(page.getByText('Nivel 7', { exact: true })).toBeVisible()
    // Answer right until a 15% problem with a decimal answer comes up (reviews come first sometimes).
    const wanted = (q: string) => /^15% de \d+$/.test(q) && !Number.isInteger(solve(q))
    for (let i = 0; i < 20 && !wanted(await promptEl(page).innerText()); i++) {
      await answer(page, true, 'es')
      await nextButton(page).press('Enter')
    }
    const right = String(solve(await promptEl(page).innerText())).replace('.', ',')
    expect(right).toMatch(/^\d+,\d+$/)
    await answer(page, false, 'es')
    await expect(page.locator('section.card p.text-xl')).toHaveText(`✗ Uy, no: es ${right}`)
    await expect(page.locator('section.card p.tabular-nums')).toHaveText(/^\d+,\d s$/)
    // 15% is 10% + 5%, and every decimal shows with a comma.
    await expect(page.locator('ol.font-mono')).toContainText('½ del 10%')
    await expect(page.locator('section.card')).not.toContainText(/\d\.\d/)
    expect(englishIn(await page.locator('body').innerText())).toEqual([])
  })
})

test('the language toggle switches and persists', async ({ page }) => {
  await open(page)
  await expect(htmlLang(page)).toHaveAttribute('lang', 'en')
  await expect(cta(page)).toBeFocused()

  await pressed(page, 'Español').click()
  await expect(htmlLang(page)).toHaveAttribute('lang', 'es')
  await expect(pressed(page, 'English')).toHaveAttribute('aria-pressed', 'false')
  expect(await page.evaluate((k) => localStorage.getItem(k), LANG_KEY)).toBe('es')

  await page.reload()
  await expect(htmlLang(page)).toHaveAttribute('lang', 'es')
  await expect(cta(page)).toContainText('Empezar nivel 1')

  await pressed(page, 'English').click()
  await page.reload()
  await expect(cta(page)).toContainText('Start level 1')
})
