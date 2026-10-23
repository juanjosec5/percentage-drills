<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'

import LanguageToggle from './LanguageToggle.vue'
import LiquidCta from './LiquidCta.vue'
import MasteryMeter from './MasteryMeter.vue'
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
const isMastered = (i: number) => i < progress.unlocked || progress.allMastered
const isCurrent = (i: number) => i === progress.unlocked && !progress.allMastered

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

    <div class="-mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
      <!-- Once the set is done the main button already starts endless practice. -->
      <button
        v-if="!progress.dailyDone"
        class="underline-offset-4 hover:text-ink hover:underline"
        @click="emit('start', 'endless', progress.unlocked)"
      >
        {{ t('home.endlessLink') }}
      </button>
      <!-- Offered, never forced: the default stays Kumon's, start at the easy level. -->
      <button
        v-if="progress.canPlace"
        class="underline-offset-4 hover:text-ink hover:underline"
        @click="emit('place')"
      >
        {{ t('home.skipAhead') }}
      </button>
    </div>

    <ol class="space-y-1" :aria-label="t('home.levels')">
      <li v-for="(level, i) in LEVELS" :key="level.id">
        <button
          class="relative flex min-h-11 w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-2 text-left transition-colors enabled:hover:bg-panel disabled:opacity-45"
          :class="{
            'card-action bg-panel py-3 shadow-soft': isCurrent(i),
            'animate-pop': justOpened !== null && (i === justOpened || i === justOpened - 1),
          }"
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
            v-if="isMastered(i) && progress.isPlaced(i)"
            role="img"
            :aria-label="t('home.placed')"
            class="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-star text-sm text-ink-muted"
            >☆</span
          >
          <span
            v-else-if="isMastered(i)"
            :class="{ 'animate-pop': justOpened !== null && i === justOpened - 1 }"
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
