// Shared setup for the browser tests: a seeded save, a fixed clock and a solver for the prompts.
import { expect, type Page } from '@playwright/test'

export const KEY = 'percent-drills:v1'
export const LANG_KEY = 'percent-drills:lang'
/** Stamped on every seed, so seeds use today's level indexes instead of being migrated. */
export const SAVE_VERSION = 4

/**
 * Noon on Friday 2026-10-23 in Bogotá (the configured timezone). The drill seeds its problems
 * from Date.now(), so a fixed clock also fixes the problem sequence.
 */
export const NOW = new Date('2026-10-23T12:00:00-05:00')

/** The app's day key (YYYY-MM-DD, local time), `n` days before NOW. */
export const dayKey = (n = 0) =>
  new Date(+NOW - n * 86_400_000).toLocaleDateString('sv', { timeZone: 'America/Bogota' })

export interface Answer {
  correct: boolean
  ms: number
}
export const answers = (n: number, a: Answer = { correct: true, ms: 900 }) =>
  Array.from({ length: n }, () => ({ ...a }))

export interface Seed {
  unlocked?: number
  history?: Record<string, Answer[]>
  days?: Record<string, unknown>
  settings?: { showTimer: boolean; offeredPlacement?: boolean }
}

/**
 * Opens the app at NOW with `saved` in localStorage. The save is written once per tab (guarded
 * in sessionStorage), so a reload keeps what the app stored since.
 */
export async function open(page: Page, saved?: Seed | string) {
  await page.clock.setFixedTime(NOW)
  if (saved !== undefined) {
    const raw =
      typeof saved === 'string' ? saved : JSON.stringify({ version: SAVE_VERSION, ...saved })
    await page.addInitScript(
      ([key, value]) => {
        if (sessionStorage.getItem('e2e-seeded')) return
        localStorage.setItem(key, value)
        sessionStorage.setItem('e2e-seeded', '1')
      },
      [KEY, raw],
    )
  }
  await page.goto('/')
}

export const stored = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), KEY)

export const cta = (page: Page) => page.locator('button.btn-cta')
export const promptEl = (page: Page) => page.locator('section.card p.text-4xl')
export const input = (page: Page) => page.getByRole('textbox')
export const live = (page: Page) => page.locator('[aria-live]')
export const nextButton = (page: Page) => page.getByRole('button', { name: /^(Next|Siguiente)$/ })

/** Works out the answer to an English or Spanish prompt from its text alone. */
export function solve(text: string): number {
  // Thousands are grouped with a narrow no-break space (43 720).
  const prompt = text.replaceAll('\u202f', '')
  const n = (s: string) => Number(s.replace(',', '.'))
  const r2 = (x: number) => Math.round(x * 100) / 100
  let m
  if ((m = prompt.match(/^([\d.,]+)% (?:of|de) ([\d.,]+)$/))) return r2((n(m[1]) * n(m[2])) / 100)
  if ((m = prompt.match(/^¿?([\d.,]+) (?:is what|es qué) % (?:of|de) ([\d.,]+)\?$/)))
    return r2((n(m[1]) / n(m[2])) * 100)
  if ((m = prompt.match(/^([\d.,]+) ([+−]) ([\d.,]+)%$/)))
    return r2(n(m[1]) * (1 + ((m[2] === '+' ? 1 : -1) * n(m[3])) / 100))
  throw new Error(`Unknown prompt: ${prompt}`)
}

/** Types an answer to the problem on screen and submits it; `right: false` types a wrong one. */
export async function answer(page: Page, right = true, lang: 'en' | 'es' = 'en') {
  const value = solve(await promptEl(page).innerText()) + (right ? 0 : 1)
  await input(page).fill(lang === 'es' ? String(value).replace('.', ',') : String(value))
  await input(page).press('Enter')
  await expect(nextButton(page)).toBeFocused()
}

/** Pretends the tab was hidden and shown again, as when the learner switches apps. */
export async function setVisibility(page: Page, state: 'hidden' | 'visible') {
  await page.evaluate((v) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v })
    document.dispatchEvent(new Event('visibilitychange'))
  }, state)
}
