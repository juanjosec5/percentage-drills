<script setup lang="ts">
// One problem at a time, timed. After a right answer, just the verdict; after a wrong one, the
// correct answer and a visual breakdown. It keeps going until the level is mastered or you leave:
// the day's goal (DAY_GOAL answers, for the streak) is a brief toast, never a stop.
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import BreakdownBar from './BreakdownBar.vue'
import LanguageToggle from './LanguageToggle.vue'
import MascotDrop from './MascotDrop.vue'
import MasteryMeter from './MasteryMeter.vue'
import { useI18n } from '@/composables/useI18n'
import { seconds, useStopwatch } from '@/composables/useStopwatch'
import { LEVELS, nextProblem, type Problem } from '@/engine/levels'
import { isCorrect, isPartialAnswer, parseAnswer } from '@/engine/math'
import { counts, GOAL, type Answer } from '@/engine/mastery'
import { createRng } from '@/engine/rng'
import type { Msg } from '@/i18n'
import { DAY_GOAL, useProgress } from '@/stores/progress'

const props = defineProps<{ startLevel: number }>()
const emit = defineEmits<{ exit: []; place: [] }>()

type Phase = 'asking' | 'feedback'

const progress = useProgress()
const rng = createRng()
const clock = useStopwatch()
const { t } = useI18n()

const level = ref(props.startLevel)
const problem = ref<Problem>()
/** Counts problems asked, to replay the breakdown animation for each one. */
const serial = ref(0)
const problemLevel = ref(0)
const input = ref('')
const phase = ref<Phase>('asking')
const wasCorrect = ref(false)
/** Set when the problem is asked, so a level-up mid-problem doesn't relabel it as review. */
const reviewing = ref(false)
/** The level's tip, on its first problem only: the one moment it helps before answering. */
const tip = ref<Msg>()
/** The level just mastered, while its popup is open. */
const finished = ref<number | null>(null)
const session = ref<Answer[]>([])
/** The last problem was dropped because the page was hidden mid-answer. */
const voided = ref(false)
let leftMidProblem = false

const inputEl = ref<HTMLInputElement>()
const nextEl = ref<HTMLButtonElement>()

const canSubmit = computed(() => parseAnswer(input.value) !== null)
const invalid = computed(() => !canSubmit.value && !isPartialAnswer(input.value))
// With the timer off nothing ticks while answering; the time still shows once it's answered.
const showTime = computed(() => progress.settings.showTimer || phase.value !== 'asking')
const verdictClass = computed(() => (wasCorrect.value ? 'text-correct' : 'text-wrong'))

const sessionCorrect = computed(() => session.value.filter((a) => a.correct).length)
// A plain average for the session header: it is labelled "avg". Mastery doesn't use it: a level
// counts right answers within its target time, one by one.
const sessionAverage = computed(() =>
  session.value.length ? session.value.reduce((sum, a) => sum + a.ms, 0) / session.value.length : 0,
)
/** This answer reached the day's goal: a brief toast, and practice goes on. */
const dayDone = ref(false)
const verdict = computed(() =>
  wasCorrect.value ? t('drill.correct') : t('drill.wrong', { answer: problem.value?.answer ?? 0 }),
)
/** Read out by screen readers: focus moves to Next, so the verdict itself is never focused. */
const announcement = computed(() => {
  if (finished.value !== null)
    return `${verdict.value}. ${t('drill.levelDone', { n: finished.value + 1 })}`
  if (phase.value !== 'feedback') return ''
  return dayDone.value ? `${verdict.value}. ${t('drill.dayDone')}` : verdict.value
})

function ask() {
  // How far into the level, so its numbers can grow as the learner does.
  const ramp = Math.min(progress.statusOf(level.value).counted / GOAL, 1)
  const next = nextProblem(level.value, rng, problem.value?.prompt, ramp)
  problem.value = next.problem
  serial.value++
  problemLevel.value = next.levelIndex
  reviewing.value = next.levelIndex !== level.value
  tip.value =
    !reviewing.value && progress.statusOf(level.value).answered === 0
      ? LEVELS[level.value].strategy
      : undefined
  input.value = ''
  phase.value = 'asking'
  clock.start()
  nextTick(() => inputEl.value?.focus())
}

function submit() {
  if (phase.value !== 'asking' || !problem.value || !canSubmit.value) return
  const ms = clock.stop()
  voided.value = false
  wasCorrect.value = isCorrect(input.value, problem.value.answer)
  session.value.push({ correct: wasCorrect.value, ms })
  phase.value = 'feedback'
  offerPlacement.value = tooEasy({ correct: wasCorrect.value, ms })
  const before = progress.today.answered
  const levelledUp = progress.record(problemLevel.value, { correct: wasCorrect.value, ms })
  dayDone.value = before < DAY_GOAL && progress.today.answered >= DAY_GOAL
  if (levelledUp) {
    finished.value = problemLevel.value
    level.value = progress.unlocked
    // Back to Home, where the glass pours full and the next level opens: hard to miss, unlike a
    // popup. Enter (Next has focus) goes straight away.
    homeTimer = setTimeout(() => emit('exit'), LEVEL_UP_MS)
  }
  nextTick(() => nextEl.value?.focus())
}

// Placement offered at the moment it's earned: TOO_EASY right, on-time answers in a row on one of
// the first levels. Shown once, ever, so it never nags.
const TOO_EASY = 3
const offerPlacement = ref(false)
let fastInARow = 0
function tooEasy(answer: Answer): boolean {
  if (reviewing.value || problemLevel.value > 1) return false
  fastInARow = counts(LEVELS[problemLevel.value], answer) ? fastInARow + 1 : 0
  if (fastInARow < TOO_EASY || progress.settings.offeredPlacement) return false
  progress.settings.offeredPlacement = true
  return true
}

const LEVEL_UP_MS = 1600
let homeTimer: ReturnType<typeof setTimeout> | undefined

// An interruption shouldn't record a 90-second answer, so a problem left mid-answer doesn't
// count: the same outcome as pressing Back, so it opens no new way to skip a hard one.
function onVisibility() {
  if (document.visibilityState === 'hidden' && phase.value === 'asking') {
    clock.cancel()
    leftMidProblem = true
  } else if (document.visibilityState === 'visible' && leftMidProblem) {
    leftMidProblem = false
    voided.value = true
    ask()
  }
}

onMounted(() => {
  ask()
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility)
  clearTimeout(homeTimer)
})
</script>

<template>
  <div class="mx-auto max-w-xl space-y-4 px-4 py-6">
    <header class="space-y-3">
      <div class="flex items-center gap-2">
        <button
          class="icon-btn mr-auto text-xl"
          :aria-label="t('drill.back')"
          :title="t('drill.back')"
          @click="emit('exit')"
        >
          <span aria-hidden="true">←</span>
        </button>
        <LanguageToggle />
        <!-- Struck through and dimmed when off, so the state reads without a label. -->
        <button
          type="button"
          role="switch"
          :aria-checked="progress.settings.showTimer"
          :aria-label="t('drill.timer')"
          :title="t('drill.timer')"
          class="icon-btn relative text-lg"
          :class="progress.settings.showTimer ? 'border-line bg-panel shadow-soft' : 'opacity-45'"
          @click="progress.setShowTimer(!progress.settings.showTimer)"
        >
          <span aria-hidden="true">⏱</span>
          <span
            v-if="!progress.settings.showTimer"
            class="absolute h-0.5 w-7 rotate-45 rounded-full bg-ink"
            aria-hidden="true"
          />
        </button>
      </div>

      <div class="flex min-h-7 items-center gap-3">
        <!-- A tally, not a fraction or a bar: practice has no fixed end. The level's pips below
             are the progress that matters. -->
        <p v-if="session.length" class="text-sm whitespace-nowrap text-ink-muted tabular-nums">
          ✓ {{ sessionCorrect }} · {{ t('drill.average', { time: seconds(sessionAverage) }) }}
        </p>
        <p
          v-if="dayDone && phase === 'feedback'"
          class="ml-auto animate-pop rounded-full bg-star/25 px-2.5 py-0.5 text-sm font-semibold"
          aria-hidden="true"
        >
          🔥 {{ t('drill.dayDone') }}
        </p>
      </div>
    </header>

    <p class="sr-only" aria-live="polite">{{ announcement }}</p>

    <div class="flex items-center gap-3">
      <p class="text-xs font-medium whitespace-nowrap text-ink-muted">
        {{ t('drill.level', { n: level + 1 }) }}
      </p>
      <!-- Tracks the level being climbed; review answers don't move it, so it dims for them. -->
      <MasteryMeter
        v-if="level === progress.unlocked && !progress.allMastered"
        :level-index="level"
        compact
        class="transition-opacity"
        :class="{ 'opacity-50': reviewing }"
      />
      <!-- A review problem from an earlier level doesn't count toward this one: say so. -->
      <span
        v-if="reviewing"
        class="shrink-0 rounded-full bg-line px-2 py-0.5 text-xs font-medium text-ink-muted"
        >{{ t('drill.reviewTag') }}</span
      >
    </div>

    <p v-if="voided" class="text-sm text-ink-muted" role="status">{{ t('drill.voided') }}</p>

    <section
      v-if="problem"
      class="card space-y-5 text-center"
      :class="{ 'animate-glow': phase === 'feedback' && wasCorrect }"
    >
      <p v-if="tip" class="font-mono text-sm text-ink-muted">{{ t(tip) }}</p>
      <p class="font-mono text-4xl font-semibold sm:text-5xl">{{ t(problem.prompt) }}</p>
      <!-- Stays grey after answering: the verdict line alone carries right/wrong. -->
      <p v-if="showTime" class="font-mono text-lg text-ink-muted tabular-nums">
        {{ t(seconds(clock.ms.value)) }}
      </p>

      <form v-if="phase === 'asking'" class="space-y-2" @submit.prevent="submit">
        <div class="flex gap-2">
          <input
            ref="inputEl"
            v-model="input"
            inputmode="decimal"
            autocomplete="off"
            placeholder="?"
            enterkeyhint="done"
            :aria-label="t('drill.answer')"
            :aria-invalid="invalid"
            aria-describedby="answer-hint"
            class="well min-w-0 flex-1 rounded-lg border-ink-muted/80 px-4 py-3 text-center font-mono text-2xl outline-none focus:border-ink"
          />
          <button class="btn btn-primary" :disabled="!canSubmit">
            {{ t('drill.check') }}
          </button>
        </div>
        <p id="answer-hint" class="min-h-5 text-sm text-wrong">
          {{ invalid ? t('drill.invalid') : '' }}
        </p>
      </form>

      <template v-else>
        <div class="animate-pop space-y-1">
          <div class="flex items-center justify-center gap-2">
            <MascotDrop :key="serial" :mood="wasCorrect ? 'happy' : 'oops'" :size="30" />
            <p class="text-xl font-semibold" :class="verdictClass">
              <span aria-hidden="true">{{ wasCorrect ? '✓' : '✗' }}</span> {{ verdict }}
            </p>
          </div>
          <p v-if="finished !== null" class="animate-pop text-2xl font-bold text-cta">
            {{ t('drill.levelDone', { n: finished + 1 }) }}
          </p>
          <button
            v-if="offerPlacement && finished === null"
            class="mx-auto mt-2 block rounded-full border-2 border-cta/40 px-4 py-1.5 text-sm font-semibold text-cta hover:border-cta hover:bg-cta/5"
            @click="emit('place')"
          >
            {{ t('drill.tooEasy') }}
          </button>
          <p v-if="!wasCorrect" class="font-mono text-ink-muted">
            <s aria-hidden="true">{{ input }}</s>
            <span class="sr-only">{{ t('drill.youAnswered', { input }) }}</span>
          </p>
        </div>
        <!-- Teaching is for mistakes: a right answer goes straight to Next. -->
        <BreakdownBar
          v-if="!wasCorrect"
          :key="serial"
          :breakdown="problem.breakdown"
          class="text-left"
        />
        <button
          ref="nextEl"
          class="btn btn-primary w-full"
          @click="finished === null ? ask() : emit('exit')"
        >
          {{ t('drill.next') }}
          <span class="ml-1" aria-hidden="true">⏎</span>
        </button>
      </template>
    </section>
  </div>
</template>
