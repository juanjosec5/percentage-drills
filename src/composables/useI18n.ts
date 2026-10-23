// The current language, shared app-wide. Separate from the progress store so its saved format
// (percent-drills:v1) stays untouched.
import { ref, watchEffect } from 'vue'

import {
  detectLocale,
  isLocale,
  msg,
  translate,
  type Locale,
  type MessageKey,
  type Msg,
  type Params,
} from '@/i18n'

const KEY = 'percent-drills:lang'

function load(): Locale {
  try {
    const saved = localStorage.getItem(KEY)
    if (isLocale(saved)) return saved
  } catch {
    // Private mode: fall back to the browser language.
  }
  return detectLocale(navigator.language)
}

const locale = ref<Locale>(load())

watchEffect(() => {
  document.documentElement.lang = locale.value
  document.title = translate(locale.value, msg('app.title'))
})

function setLocale(next: Locale) {
  locale.value = next
  // Saved only when chosen, so until then a change of browser language still applies.
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // Storage blocked: the choice just won't persist.
  }
}

/** Reads `locale`, so templates re-render when the language changes. */
function t(key: MessageKey | Msg, params?: Params): string {
  return translate(locale.value, typeof key === 'string' ? msg(key, params) : key)
}

export function useI18n() {
  return { locale, setLocale, t }
}
