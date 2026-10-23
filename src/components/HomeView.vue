<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import LanguageToggle from './LanguageToggle.vue'
import LiquidCta from './LiquidCta.vue'
import MasteryMeter from './MasteryMeter.vue'
import StreakChip from './StreakChip.vue'
import { useI18n } from '@/composables/useI18n'
import { LEVELS } from '@/engine/levels'
import { answersToMastery, GOAL } from '@/engine/mastery'
import { useProgress, type Mode } from '@/stores/progress'

const emit = defineEmits<{ start: [mode: Mode, level: number] }>()
const progress = useProgress()
const { t } = useI18n()

// The main button: today's daily set first, endless practice after.
const ctaMode = computed<Mode>(() => (progress.dailyDone ? 'endless' : 'daily'))
const isNewLevel = computed(() => progress.statusOf(progress.unlocked).answered === 0)
// The glass shows how close the current level is to done ("5 more" = half full), the same
// measure as the drill's meter, so the two never disagree.
const toGo = computed(() =>
  answersToMastery(LEVELS[progress.unlocked], progress.history[LEVELS[progress.unlocked].id] ?? []),
)
const levelFill = computed(() => (progress.allMastered ? 1 : (GOAL - toGo.value) / GOAL))
const isMastered = (i: number) => i < progress.unlocked || progress.allMastered
const isCurrent = (i: number) => i === progress.unlocked && !progress.allMastered

// autofocus only fires on page load, not when coming back from a drill.
const ctaEl = ref<InstanceType<typeof LiquidCta>>()
onMounted(() => ctaEl.value?.focus())

function confirmReset() {
  if (confirm(t('home.resetConfirm'))) progress.reset()
}
</script>

<template>
  <div class="mx-auto max-w-xl space-y-5 px-4 py-8">
    <header>
      <div class="flex items-center gap-2">
        <h1 class="mr-auto text-3xl font-bold">{{ t('app.title') }}</h1>
        <StreakChip v-if="progress.streak" :days="progress.streak" />
        <LanguageToggle />
      </div>
      <div class="rainbow mt-2 h-1.5 w-28 animate-rainbow rounded-full" />
    </header>

    <LiquidCta
      ref="ctaEl"
      :fill="levelFill"
      :level-key="progress.unlocked"
      :label="
        progress.dailyDone
          ? t('home.endless')
          : t(isNewLevel ? 'home.start' : 'home.continue', { n: progress.unlocked + 1 })
      "
      :progress-label="progress.allMastered ? '' : t('meter.toGoShort', { n: toGo })"
      @click="emit('start', ctaMode, progress.unlocked)"
    />

    <!-- Once the set is done the main button already starts endless practice. -->
    <button
      v-if="!progress.dailyDone"
      class="-mt-2 block text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
      @click="emit('start', 'endless', progress.unlocked)"
    >
      {{ t('home.endlessLink') }}
    </button>

    <ol class="space-y-1" :aria-label="t('home.levels')">
      <li v-for="(level, i) in LEVELS" :key="level.id">
        <button
          class="relative flex min-h-11 w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-2 text-left transition-colors enabled:hover:bg-panel disabled:opacity-45"
          :class="{ 'card-action bg-panel py-3 shadow-soft': isCurrent(i) }"
          :disabled="i > progress.unlocked"
          @click="emit('start', 'endless', i)"
        >
          <span
            v-if="isCurrent(i)"
            class="absolute inset-y-0 left-0 w-1 bg-cta"
            aria-hidden="true"
          />
          <span class="w-6 shrink-0 font-mono text-ink-muted">{{ i + 1 }}</span>
          <span class="min-w-0 flex-1 space-y-1.5">
            <span class="block font-medium">{{ t(level.title) }}</span>
            <MasteryMeter v-if="isCurrent(i)" :level-index="i" hide-count />
          </span>
          <span
            v-if="isMastered(i)"
            role="img"
            :aria-label="t('home.mastered')"
            class="flex size-6 shrink-0 items-center justify-center rounded-full bg-star text-sm text-ink shadow-soft"
            >★</span
          >
          <span
            v-else-if="!isCurrent(i)"
            role="img"
            :aria-label="t('home.locked')"
            class="flex size-6 shrink-0 items-center justify-center text-sm"
            >🔒</span
          >
        </button>
      </li>
    </ol>

    <button class="text-xs text-ink-muted underline" @click="confirmReset">
      {{ t('home.reset') }}
    </button>
  </div>
</template>
