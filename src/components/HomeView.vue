<script lang="ts">
const lastSeen = { unlocked: -1 }
</script>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'

import LanguageToggle from './LanguageToggle.vue'
import LevelPath from './LevelPath.vue'
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
const firstRun = computed(() => Object.keys(progress.days).length === 0)

// A level finished since Home was last shown: the path plays the level-up moment for it
// (module scope, so it survives the trip to the drill and back). A jump from placement isn't one.
const levelUp =
  lastSeen.unlocked >= 0 && progress.unlocked > lastSeen.unlocked && !progress.justPlaced
    ? progress.unlocked - 1
    : null
lastSeen.unlocked = progress.unlocked

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

    <LevelPath
      :level-up="levelUp"
      @start="(i) => emit('start', 'endless', i)"
      @settled="ctaEl?.focus()"
    >
      <template #current="{ onFull, level }">
        <LiquidCta
          ref="ctaEl"
          :fill="levelFill"
          :level-key="progress.unlocked"
          :heading="t(LEVELS[level].title)"
          :celebrate-label="t('drill.levelDone', { n: progress.unlocked })"
          :quiet="progress.justPlaced"
          :label="
            progress.dailyDone
              ? t('home.endless')
              : t(isNewLevel ? 'home.start' : 'home.continue', { n: progress.unlocked + 1 })
          "
          :progress-label="progress.allMastered ? '' : t('meter.toGoShort', { n: toGo })"
          @click="emit('start', ctaMode, progress.unlocked)"
          @full="onFull"
        />
      </template>
    </LevelPath>

    <!-- Quiet secondary actions: the path and its glass are the main thing. -->
    <div class="flex flex-wrap gap-x-5 gap-y-2 text-sm">
      <button
        v-if="!progress.dailyDone"
        class="text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        @click="emit('start', 'endless', progress.unlocked)"
      >
        {{ t('home.endlessLink') }}
      </button>
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
