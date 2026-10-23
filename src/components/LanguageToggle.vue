<script setup lang="ts">
// A quiet EN / ES switch: small and muted so the Start button stays the focus.
import { useI18n } from '@/composables/useI18n'
import { LOCALES, type Locale } from '@/i18n'

const { locale, setLocale, t } = useI18n()

// Each name in its own language: someone looking for theirs reads it that way.
const NAMES: Record<Locale, string> = { en: 'English', es: 'Español' }
</script>

<template>
  <div
    role="group"
    :aria-label="t('lang.label')"
    class="inline-flex shrink-0 rounded-lg border border-line bg-panel p-0.5 text-xs font-semibold"
  >
    <button
      v-for="l in LOCALES"
      :key="l"
      type="button"
      :lang="l"
      :aria-label="NAMES[l]"
      :title="NAMES[l]"
      :aria-pressed="locale === l"
      class="rounded-md px-2 py-1 text-ink-muted outline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-ink aria-pressed:bg-ink aria-pressed:text-ground"
      @click="setLocale(l)"
    >
      {{ l.toUpperCase() }}
    </button>
  </div>
</template>
