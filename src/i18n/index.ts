// Translation without Vue, so the engine can describe its text as messages and the UI (or a
// test) renders them in either language. Messages hold numbers, not formatted strings: the
// decimal mark is chosen at render time, and switching language mid-drill re-renders everything.
import { fmt } from '@/engine/math'

import { en } from './en'
import { es } from './es'

export const LOCALES = ['en', 'es'] as const
export type Locale = (typeof LOCALES)[number]

export type MessageKey = keyof typeof en
/** A number is formatted for the locale, a message is translated, a list is joined. */
export type Param = number | string | Msg | Param[]
export type Params = Record<string, Param>
export interface Msg {
  key: MessageKey
  params?: Params
}

/**
 * A template with {name} placeholders ({name:1} fixes one decimal, for seconds). A function
 * picks the template from the raw params, for plurals.
 */
export type Entry = string | ((p: Record<string, unknown>) => string)
/** Every locale must define every key, so a missing translation fails the type-check. */
export type Dictionary = Record<MessageKey, Entry>

const DICTIONARIES: Record<Locale, Dictionary> = { en, es }
const PLACEHOLDER = /\{(\w+)(?::(\d))?\}/g

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale)
}

/** Spanish for any Spanish browser (es, es-CO, es-419…), English otherwise. */
export function detectLocale(tag = ''): Locale {
  return tag.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export function msg(key: MessageKey, params?: Params): Msg {
  return params ? { key, params } : { key }
}

function render(lang: Locale, p: Param, digits?: number): string {
  if (typeof p === 'number') return fmt(p, lang, digits)
  if (typeof p === 'string') return p
  if (Array.isArray(p)) return p.map((x) => render(lang, x)).join('')
  return translate(lang, p)
}

export function translate(lang: Locale, m: Msg): string {
  const entry = DICTIONARIES[lang][m.key]
  const params = m.params ?? {}
  const template = typeof entry === 'function' ? entry(params) : entry
  return (
    template
      // An unknown placeholder stays visible, so tests can catch it.
      .replace(PLACEHOLDER, (whole, name: string, digits?: string) =>
        name in params ? render(lang, params[name], digits ? Number(digits) : undefined) : whole,
      )
  )
}
