<script setup lang="ts">
// One problem at a time, timed. After each answer: right or wrong, the time, and a visual
// breakdown. Daily mode stops after the day's set; endless mode keeps going until you stop.
import { computed, nextTick, onMounted, ref } from 'vue'

import BreakdownBar from './BreakdownBar.vue'
import LevelCompleteDialog from './LevelCompleteDialog.vue'
import { seconds, useStopwatch } from '@/composables/useStopwatch'
import { LEVELS, nextProblem, type Problem } from '@/engine/levels'
import { fmt, isCorrect, parseAnswer } from '@/engine/math'
import { median, type Answer } from '@/engine/mastery'
import { createRng } from '@/engine/rng'
import { DAILY_COUNT, useProgress, type Mode } from '@/stores/progress'

const props = defineProps<{ mode: Mode; startLevel: number }>()
const emit = defineEmits<{ exit: [] }>()

type Phase = 'asking' | 'feedback' | 'done'

const progress = useProgress()
const rng = createRng()
const clock = useStopwatch()

const level = ref(props.startLevel)
const problem = ref<Problem>()
const problemLevel = ref(0)
const input = ref('')
const phase = ref<Phase>('asking')
const wasCorrect = ref(false)
/** Set when the problem is asked, so a level-up mid-problem doesn't relabel it as review. */
const reviewing = ref(false)
/** The level just mastered, while its popup is open. */
const finished = ref<number | null>(null)
const session = ref<Answer[]>([])

const inputEl = ref<HTMLInputElement>()
const nextEl = ref<HTMLButtonElement>()
const homeEl = ref<HTMLButtonElement>()

const current = computed(() => LEVELS[level.value])
/** The level this problem came from: the current one, or an earlier one for review. */
const asked = computed(() => LEVELS[problemLevel.value])
const canSubmit = computed(() => parseAnswer(input.value) !== null)
const invalid = computed(() => input.value.trim() !== '' && !canSubmit.value)
const tooSlow = computed(() => clock.ms.value / 1000 > asked.value.targetSeconds)
const verdictClass = computed(() => (wasCorrect.value ? 'text-correct' : 'text-wrong'))

const sessionCorrect = computed(() => session.value.filter((a) => a.correct).length)
const sessionMedian = computed(() => median(session.value.map((a) => a.ms)))
const dailyAnswered = computed(() => Math.min(progress.today.daily, DAILY_COUNT))
/** Daily mode with today's set complete: the drill ends after this answer. */
const dailySetDone = computed(() => props.mode === 'daily' && progress.dailyDone)
// Daily: how much of today's set is done. Endless: refills every DAILY_COUNT answers.
const progressDone = computed(() => {
  const n = session.value.length
  return props.mode === 'daily' ? dailyAnswered.value : n && ((n - 1) % DAILY_COUNT) + 1
})
const verdict = computed(() =>
  wasCorrect.value ? 'Correct' : `Not quite: it's ${fmt(problem.value?.answer ?? 0)}`,
)
/** Read out by screen readers: focus moves to Next, so the verdict itself is never focused. */
const announcement = computed(() => {
  if (phase.value === 'done') return 'Daily set done'
  return phase.value === 'feedback' ? verdict.value : ''
})

function ask() {
  const next = nextProblem(level.value, rng, problem.value?.prompt)
  problem.value = next.problem
  problemLevel.value = next.levelIndex
  reviewing.value = next.levelIndex !== level.value
  input.value = ''
  phase.value = 'asking'
  clock.start()
  nextTick(() => inputEl.value?.focus())
}

function submit() {
  if (phase.value !== 'asking' || !problem.value || !canSubmit.value) return
  const ms = clock.stop()
  wasCorrect.value = isCorrect(input.value, problem.value.answer)
  session.value.push({ correct: wasCorrect.value, ms })
  phase.value = 'feedback'
  if (progress.record(problemLevel.value, { correct: wasCorrect.value, ms }, props.mode)) {
    finished.value = problemLevel.value
    level.value = progress.unlocked
  } else {
    nextTick(() => nextEl.value?.focus())
  }
}

function onDialogClose() {
  finished.value = null
  if (phase.value === 'feedback') nextTick(() => nextEl.value?.focus())
}

function next() {
  if (dailySetDone.value) {
    phase.value = 'done'
    nextTick(() => homeEl.value?.focus())
  } else ask()
}

onMounted(ask)
</script>

<template>
  <div class="mx-auto max-w-xl space-y-5 px-4 py-6">
    <header class="flex items-center justify-between gap-3">
      <button class="text-sm text-ink-muted hover:text-ink" @click="emit('exit')">← Back</button>
      <div class="text-right text-sm text-ink-muted">
        <span v-if="mode === 'daily'">Daily · {{ dailyAnswered }}/{{ DAILY_COUNT }}</span>
        <span v-else>Endless · {{ sessionCorrect }}/{{ session.length }} right</span>
        <span v-if="session.length"> · median {{ seconds(sessionMedian) }}</span>
      </div>
    </header>

    <div
      class="h-1.5 overflow-hidden rounded-full bg-line/70 shadow-press"
      role="progressbar"
      :aria-label="mode === 'daily' ? 'Daily set' : 'This round of ten'"
      aria-valuemin="0"
      :aria-valuemax="DAILY_COUNT"
      :aria-valuenow="progressDone"
    >
      <div
        class="rainbow h-full animate-rainbow rounded-full transition-[width] duration-500 ease-out"
        :style="{ width: `${(progressDone / DAILY_COUNT) * 100}%` }"
      />
    </div>

    <p class="sr-only" aria-live="polite">{{ announcement }}</p>

    <p v-if="phase !== 'done'" class="text-xs tracking-wide text-ink-muted uppercase">
      Level {{ level + 1 }} · {{ current.title }}
      <span v-if="reviewing"> · review: {{ asked.title }}</span>
    </p>

    <template v-if="phase !== 'done' && problem">
      <section
        class="card space-y-5 text-center"
        :class="{ 'animate-glow': phase === 'feedback' && wasCorrect }"
      >
        <p class="font-mono text-4xl font-semibold sm:text-5xl">{{ problem.prompt }}</p>
        <p
          class="font-mono text-lg tabular-nums"
          :class="phase === 'asking' ? 'text-ink-muted' : verdictClass"
        >
          {{ seconds(clock.ms.value) }}
        </p>

        <form v-if="phase === 'asking'" class="space-y-2" @submit.prevent="submit">
          <div class="flex gap-2">
            <input
              ref="inputEl"
              v-model="input"
              inputmode="decimal"
              autocomplete="off"
              placeholder="Your answer"
              enterkeyhint="done"
              aria-label="Your answer"
              :aria-invalid="invalid"
              aria-describedby="answer-hint"
              class="well min-w-0 flex-1 rounded-lg border-ink-muted/80 px-4 py-3 text-center font-mono text-2xl outline-none focus:border-ink"
            />
            <button class="btn btn-primary" :disabled="!canSubmit">Check</button>
          </div>
          <p id="answer-hint" class="min-h-5 text-sm text-wrong">
            {{ invalid ? 'Type a number, like 12.5' : '' }}
          </p>
        </form>

        <div v-else class="animate-pop space-y-1">
          <p class="text-xl font-semibold" :class="verdictClass">
            {{ verdict }}
          </p>
          <p v-if="!wasCorrect" class="text-sm text-ink-muted">You answered {{ input }}</p>
          <p v-if="tooSlow" class="text-sm text-ink-muted">
            Target for this level: {{ asked.targetSeconds }}s
          </p>
        </div>
      </section>

      <section v-if="phase === 'feedback'" class="card space-y-4">
        <BreakdownBar :key="problem.prompt" :breakdown="problem.breakdown" />
        <button ref="nextEl" class="btn btn-primary w-full" @click="next">
          {{ dailySetDone ? 'Finish' : 'Next' }} <span class="ml-1" aria-hidden="true">⏎</span>
        </button>
      </section>
    </template>

    <section v-else-if="phase === 'done'" class="card animate-pop space-y-3 text-center">
      <p class="text-2xl font-semibold">Daily set done</p>
      <div class="rainbow mx-auto h-1.5 w-24 animate-rainbow rounded-full" />
      <p class="text-ink-muted">
        This session: {{ sessionCorrect }}/{{ session.length }} right · median
        {{ seconds(sessionMedian) }} per problem
      </p>
      <p class="text-ink-muted">
        Streak: {{ progress.streak }} day{{ progress.streak === 1 ? '' : 's' }}
      </p>
      <button ref="homeEl" class="btn btn-primary w-full" @click="emit('exit')">Back home</button>
    </section>

    <LevelCompleteDialog
      :level="finished"
      :next="level"
      :finishing="dailySetDone"
      @continue="next"
      @close="onDialogClose"
    />
  </div>
</template>
