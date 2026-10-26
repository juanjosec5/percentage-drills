<script lang="ts">
const lastSeen = { step: -1 }
</script>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'

import LanguageToggle from './LanguageToggle.vue'
import LevelPath, { type Stop } from './LevelPath.vue'
import LiquidCta from './LiquidCta.vue'
import StreakChip from './StreakChip.vue'
import { useI18n } from '@/composables/useI18n'
import { CHALLENGE_SIZE, challengeTitle } from '@/engine/challenge'
import { LEVELS } from '@/engine/levels'
import { answersToMastery, GOAL } from '@/engine/mastery'
import { WORLDS, worldOf } from '@/engine/worlds'
import { DAY_GOAL, dayKey, useProgress } from '@/stores/progress'
import { backupName, parseBackup } from '@/stores/save'

const emit = defineEmits<{ start: [level: number]; place: []; challenge: [world: number] }>()
const progress = useProgress()
const { t } = useI18n()

const isNewLevel = computed(() => progress.statusOf(progress.unlocked).answered === 0)
// The glass shows how close the current level is to done ("5 more" = half full), the same
// measure as the drill's meter, so the two never disagree.
const toGo = computed(() =>
  answersToMastery(LEVELS[progress.unlocked], progress.history[LEVELS[progress.unlocked].id] ?? []),
)
const done = computed(() => progress.allMastered || progress.gate !== null)
const levelFill = computed(() => (done.value ? 1 : (GOAL - toGo.value) / GOAL))
const firstRun = computed(() => Object.keys(progress.days).length === 0)

// A stop finished since Home was last shown (a level, or a world's challenge): the path plays
// the moment for it (module scope, so it survives the trip away and back). A jump from placement
// isn't one. Steps are whole at a level and half a step on at a checkpoint (progress.step).
const finished: Stop | null =
  lastSeen.step >= 0 && progress.step > lastSeen.step && !progress.justPlaced
    ? Number.isInteger(lastSeen.step)
      ? { level: lastSeen.step }
      : { challenge: worldOf(Math.floor(lastSeen.step)) }
    : null
lastSeen.step = progress.step
/** A passed challenge has no glass to pour: the next level's glass just fills, no celebration. */
const quiet = progress.justPlaced || (finished !== null && 'challenge' in finished)

// autofocus only fires on page load, not when coming back from a drill.
const ctaEl = ref<InstanceType<typeof LiquidCta>>()
const challengeEl = ref<HTMLButtonElement>()
/** A challenge's best score so far; 0 before the first try. */
const bestOf = (w: number) => progress.challenges[WORLDS[w].id] ?? 0
const focusMain = () => (ctaEl.value ?? challengeEl.value)?.focus()
onMounted(focusMain)

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

<template>
  <div class="mx-auto max-w-xl space-y-5 px-4 py-8">
    <header>
      <div class="flex items-center gap-2">
        <h1 class="mr-auto text-3xl font-bold">{{ t('app.title') }}</h1>
        <StreakChip :days="progress.streak" :today="progress.todayAnswered" :goal="DAY_GOAL" />
        <LanguageToggle />
      </div>
      <div class="rainbow mt-2 h-1.5 w-28 animate-rainbow rounded-full" />
    </header>

    <LevelPath
      :finished="finished"
      @start="(i) => emit('start', i)"
      @challenge="(w) => emit('challenge', w)"
      @settled="focusMain"
    >
      <template #current="{ onFull, level, challenge }">
        <!-- A world's challenge: same footprint as the glass, so the drop lands centred on it. -->
        <button
          v-if="challenge !== null"
          ref="challengeEl"
          class="btn-challenge group"
          @click="emit('challenge', challenge)"
        >
          <span class="text-sm font-semibold text-ink-muted">
            {{ t(challengeTitle(challenge)) }} ·
            {{ t('challenge.rule') }}
          </span>
          <span class="flex w-full items-baseline justify-between gap-2">
            <span class="text-lg font-bold sm:text-xl">
              {{ t(bestOf(challenge) ? 'challenge.retry' : 'challenge.start') }}
              <span class="inline-block transition-transform group-hover:translate-x-1">→</span>
            </span>
            <span v-if="bestOf(challenge)" class="font-mono text-sm text-ink-muted">
              {{ t('challenge.best', { n: bestOf(challenge), total: CHALLENGE_SIZE }) }}
            </span>
          </span>
        </button>
        <LiquidCta
          v-else
          ref="ctaEl"
          :fill="levelFill"
          :level-key="progress.step * 2"
          :heading="t(LEVELS[level].title)"
          :celebrate-label="t('drill.levelDone', { n: level + 1 })"
          :quiet="quiet"
          :label="t(isNewLevel ? 'home.start' : 'home.continue', { n: progress.unlocked + 1 })"
          :progress-label="done ? '' : t('meter.toGoShort', { n: toGo })"
          @click="emit('start', progress.unlocked)"
          @full="onFull"
        />
      </template>
    </LevelPath>

    <!-- Quiet secondary actions: the path and its glass are the main thing. -->
    <div class="flex flex-wrap gap-x-5 gap-y-2 text-sm">
      <!-- Offered on a fresh start in violet; later it stays available, but quiet. -->
      <button
        v-if="progress.canPlace"
        class="underline-offset-4 hover:underline"
        :class="firstRun ? 'font-semibold text-cta' : 'text-ink-muted hover:text-ink'"
        @click="emit('place')"
      >
        {{ t('home.findLevel') }}
      </button>
    </div>

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
