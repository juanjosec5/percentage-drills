import { en } from '@/i18n/en'
import { es } from '@/i18n/es'
import { detectLocale, msg, translate, type Entry } from '@/i18n'

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort()
// Plural entries pick a template from the count; check both forms.
const templates = (e: Entry) => (typeof e === 'function' ? [e({ n: 1 }), e({ n: 2 })] : [e])

describe('dictionaries', () => {
  it('have the same keys in both languages', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort())
  })

  it('have no empty values', () => {
    for (const dict of [en, es]) {
      for (const [key, entry] of Object.entries(dict)) {
        for (const t of templates(entry)) expect(t.trim(), key).not.toBe('')
      }
    }
  })

  it('use the same placeholders in both languages', () => {
    for (const [key, entry] of Object.entries(en)) {
      const want = placeholders(templates(entry)[0])
      for (const t of templates(es[key as keyof typeof en]))
        expect(placeholders(t), key).toEqual(want)
    }
  })
})

describe('translate', () => {
  it('formats numbers for the locale and keeps "%" on its number', () => {
    expect(translate('en', msg('prompt.of', { pct: 15, base: 640 }))).toBe('15% of 640')
    expect(translate('es', msg('prompt.of', { pct: 15, base: 640 }))).toBe('15 % de 640')
    expect(translate('es', msg('drill.wrong', { answer: 63.5 }))).toBe('Uy, no: es 63,5')
    expect(translate('es', msg('seconds', { s: 1.23 }))).toBe('1,2 s')
    expect(translate('en', msg('seconds', { s: 1.23 }))).toBe('1.2s')
  })

  it('translates nested messages and joins lists', () => {
    const how = msg('how.half')
    const step = msg('step.pieceOf', { pct: 50, base: 7, value: 3.5, how })
    expect(translate('es', step)).toBe('50 % de 7 = 3,5 · ÷ 2')
    const sum = msg('result.sum', { pct: 15, sum: [7, ' + ', 3.5], answer: 10.5 })
    expect(translate('en', sum)).toBe('15% = 7 + 3.5 = 10.5')
  })

  it('picks plural forms', () => {
    expect(translate('en', msg('streak.aria', { n: 1 }))).toBe('1-day streak')
    expect(translate('es', msg('streak.aria', { n: 1 }))).toBe('Racha de 1 día')
    expect(translate('es', msg('streak.aria', { n: 3 }))).toBe('Racha de 3 días')
  })
})

describe('detectLocale', () => {
  it('picks Spanish for any Spanish browser, English otherwise', () => {
    expect(detectLocale('es-CO')).toBe('es')
    expect(detectLocale('es')).toBe('es')
    expect(detectLocale('ES-419')).toBe('es')
    expect(detectLocale('en-US')).toBe('en')
    expect(detectLocale('pt-BR')).toBe('en')
    expect(detectLocale('')).toBe('en')
  })
})
