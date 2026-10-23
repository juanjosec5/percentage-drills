<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'

import LanguageToggle from './LanguageToggle.vue'
import LevelMap from './LevelMap.vue'
import LiquidCta from './LiquidCta.vue'
import StreakChip from './StreakChip.vue'
import { useI18n } from '@/composables/useI18n'
import { LEVELS } from '@/engine/levels'
import { answersToMastery, GOAL } from '@/engine/mastery'
import { dayKey, useProgress, type Mode } from '@/stores/progress'
import { backupName, parseBackup } from '@/stores/save'

const emit = defineEmits<{ start: [mode: Mode, level: number]; place: [] }>()
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

// The level that opened since Home was last shown: its row and the new ★ pop in, timed after the
// glass has poured full (module scope, so it survives the trip to the drill and back).
const justOpened = ref<number | null>(null)
onMounted(() => {
  // A jump from placement isn't a level-up: no pop.
  if (lastSeen.unlocked >= 0 && progress.unlocked > lastSeen.unlocked && !progress.justPlaced)
    setTimeout(() => (justOpened.value = progress.unlocked), OPEN_DELAY_MS)
  lastSeen.unlocked = progress.unlocked
})

// autofocus only fires on page load, not when coming back from a drill.
const ctaEl = ref<InstanceType<typeof LiquidCta>>()
onMounted(() => ctaEl.value?.focus())

function confirmReset() {
  if (confirm(t('home.resetConfirm'))) progress.reset()
}

// A backup is the save itself, so an exported file imports through the same checks as storage.
function exportProgress() {
  const blob = new Blob([JSON.stringify(progress.snapshot())], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = backupName(dayKey())
  link.click()
  // Later, not now: Safari can drop a download whose URL is revoked in the same task.
  setTimeout(() => URL.revokeObjectURL(link.href))
}

const fileEl = ref<HTMLInputElement>()

async function importProgress(event: Event) {
  const el = event.target as HTMLInputElement
  const file = el.files?.[0]
  // Cleared, so picking the same file again still fires change.
  el.value = ''
  if (!file) return
  const saved = parseBackup(await file.text())
  if (!saved) {
    alert(t('home.importInvalid'))
    return
  }
  if (!confirm(t('home.importConfirm'))) return
  progress.restore(saved)
  // Reload once it's saved, so Home starts clean instead of animating the jump as a level-up.
  await nextTick()
  location.reload()
}
</script>

<script lang="ts">
const lastSeen = { unlocked: -1 }
/** About when the glass reaches the top on a level-up. */
const OPEN_DELAY_MS = 1100
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
      :celebrate-label="t('drill.levelDone', { n: progress.unlocked })"
      :quiet="progress.justPlaced"
      :label="
        progress.dailyDone
          ? t('home.endless')
          : t(isNewLevel ? 'home.start' : 'home.continue', { n: progress.unlocked + 1 })
      "
      :progress-label="progress.allMastered ? '' : t('meter.toGoShort', { n: toGo })"
      @click="emit('start', ctaMode, progress.unlocked)"
    />

    <!-- Offered, never forced: outlined so it can't outrank Start. Shown while it could still
         open a higher level. -->
    <button
      v-if="progress.canPlace"
      class="group relative -mt-1 flex min-h-13 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-cta/40 bg-white px-4 font-semibold text-cta transition-colors duration-300 hover:border-cta hover:text-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-cta"
      @click="emit('place')"
    >
      <!-- The violet fills in from the left on hover. -->
      <span
        class="absolute inset-0 origin-left scale-x-0 bg-cta transition-transform duration-300 ease-out group-hover:scale-x-100"
        aria-hidden="true"
      />
      <span class="relative">{{ t('home.findLevel') }}</span>
      <span class="relative" aria-hidden="true">≫</span>
    </button>

    <!-- Once the set is done the main button already starts endless practice. -->
    <button
      v-if="!progress.dailyDone"
      class="-mt-2 block text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
      @click="emit('start', 'endless', progress.unlocked)"
    >
      {{ t('home.endlessLink') }}
    </button>

    <LevelMap :just-opened="justOpened" @start="(i) => emit('start', 'endless', i)" />

    <div class="flex gap-4 text-xs text-ink-muted [&>button]:underline">
      <button @click="confirmReset">{{ t('home.reset') }}</button>
      <button @click="exportProgress">{{ t('home.export') }}</button>
      <button @click="fileEl?.click()">{{ t('home.import') }}</button>
      <input
        ref="fileEl"
        type="file"
        accept=".json,application/json"
        class="hidden"
        @change="importProgress"
      />
    </div>
  </div>
</template>
