// Guards against copy creep: the UI shows progress instead of explaining it, and each PR that
// adds "just one sentence" would undo that.
import { LEVELS } from '@/engine/levels'
import { en } from '@/i18n/en'
import { es } from '@/i18n/es'
import { LOCALES, translate, type Entry } from '@/i18n'

/** Fits the CTA subtitle and a one-line list row at 320px. */
const TITLE_MAX = 24
/** One line above the prompt; the longest today is the Spanish fractions tip (41). */
const TIP_MAX = 42

const templates = (e: Entry) => (typeof e === 'function' ? [e({ n: 1 }), e({ n: 2 })] : [e])

describe('copy', () => {
  it.each(LOCALES)('keeps level titles and tips short (%s)', (lang) => {
    for (const level of LEVELS) {
      expect(translate(lang, level.title).length, level.id).toBeLessThanOrEqual(TITLE_MAX)
      if (level.strategy)
        expect(translate(lang, level.strategy).length, level.id).toBeLessThanOrEqual(TIP_MAX)
    }
  })

  it('gives every level but the mixed review a tip', () => {
    expect(LEVELS.filter((l) => !l.strategy).map((l) => l.id)).toEqual(['mixed'])
  })

  // "Typical time" was a median in disguise and "target" turned a drill into an exam: speed is
  // shown by the pips, not named.
  it.each([
    ['en', en, /typical|target/i],
    ['es', es, /típic|meta/i],
  ] as const)('never names the timing jargon (%s)', (_, dict, banned) => {
    for (const [key, entry] of Object.entries(dict)) {
      for (const t of templates(entry)) expect(t, key).not.toMatch(banned)
    }
  })
})
