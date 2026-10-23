<script setup lang="ts">
// One problem at a time, timed. After each answer: right or wrong, the time, and a visual
// breakdown. Daily mode stops after the day's set; endless mode keeps going until you stop.
import { computed, nextTick, onMounted, ref } from 'vue'

import BreakdownBar from './BreakdownBar.vue'
import { seconds, useStopwatch } from '@/composables/useStopwatch'
import { LEVELS, nextProblem, type Problem } from '@/engine/levels'
import { fmt, isCorrect, parseAnswer } from '@/engine/math'
import { median } from '@/engine/mastery'
import { createRng } from '@/engine/rng'
import { DAILY_COUNT, useProgress, type Mode } from '@/stores/progress'

const props = defineProps<{ mode: Mode; startLevel: number }>()
const emit = defineEmits<{ exit: [] }>()

const progress = useProgress()
const rng = createRng()
const clock = useStopwatch()

const level = ref(props.startLevel)
const problem = ref<Problem>()
const problemLevel = ref(0)
const input = ref('')
const phase = ref<'asking' | 'feedback' | 'done'>('asking')
const wasCorrect = ref(false)
/** The level just mastered, while its popup is open. */
const finished = ref<number | null>(null)
const session = ref<{ correct: boolean; ms: number }[]>([])

const inputEl = ref<HTMLInputElement>()
const nextEl = ref<HTMLButtonElement>()
const dialogEl = ref<HTMLDialogElement>()

const sessionCorrect = computed(() => session.value.filter((a) => a.correct).length)
const sessionMedian = computed(() => median(session.value.map((a) => a.ms)))
const dailyLeft = computed(() => Math.max(0, DAILY_COUNT - progress.today.daily))
// Daily: how much of today's set is done. Endless: refills every DAILY_COUNT answers.
const progressWidth = computed(() => {
  const n = session.value.length
  const done =
    props.mode === 'daily' ? DAILY_COUNT - dailyLeft.value : n && ((n - 1) % DAILY_COUNT) + 1
  return `${(done / DAILY_COUNT) * 100}%`
})

function ask() {
  const next = nextProblem(level.value, rng, problem.value?.prompt)
  problem.value = next.problem
  problemLevel.value = next.levelIndex
  input.value = ''
  phase.value = 'asking'
  clock.start()
  nextTick(() => inputEl.value?.focus())
}

function submit() {
  if (phase.value !== 'asking' || !problem.value || parseAnswer(input.value) === null) return
  const ms = clock.stop()
  wasCorrect.value = isCorrect(input.value, problem.value.answer)
  session.value.push({ correct: wasCorrect.value, ms })
  phase.value = 'feedback'
  if (progress.record(problemLevel.value, { correct: wasCorrect.value, ms }, props.mode)) {
    finished.value = problemLevel.value
    level.value = progress.unlocked
    nextTick(() => dialogEl.value?.showModal())
  } else {
    nextTick(() => nextEl.value?.focus())
  }
}

/** Runs however the popup closes: a button, Esc, or the form below. */
function onDialogClose() {
  finished.value = null
  if (phase.value === 'feedback') nextTick(() => nextEl.value?.focus())
}

function continueFromDialog() {
  dialogEl.value?.close()
  next()
}

function next() {
  if (props.mode === 'daily' && progress.dailyDone) phase.value = 'done'
  else ask()
}

onMounted(ask)
</script>

<template>
  <div class="mx-auto max-w-xl space-y-5 px-4 py-6">
    <header class="flex items-center justify-between gap-3">
      <button class="text-sm text-ink-muted hover:text-ink" @click="emit('exit')">← Back</button>
      <div class="text-right text-sm text-ink-muted">
        <span v-if="mode === 'daily'">Daily · {{ DAILY_COUNT - dailyLeft }}/{{ DAILY_COUNT }}</span>
        <span v-else>Endless · {{ sessionCorrect }}/{{ session.length }} right</span>
        <span v-if="session.length"> · median {{ seconds(sessionMedian) }}</span>
      </div>
    </header>

    <div class="h-1.5 overflow-hidden rounded-full bg-line/70 shadow-press">
      <div
        class="rainbow h-full animate-rainbow rounded-full transition-[width] duration-500 ease-out"
        :style="{ width: progressWidth }"
      />
    </div>

    <p v-if="phase !== 'done'" class="text-xs tracking-wide text-ink-muted uppercase">
      Level {{ level + 1 }} · {{ LEVELS[level].title }}
      <span v-if="problemLevel !== level"> · review: {{ LEVELS[problemLevel].title }}</span>
    </p>

    <template v-if="phase !== 'done' && problem">
      <section
        class="card space-y-5 text-center"
        :class="{ 'animate-glow': phase === 'feedback' && wasCorrect }"
      >
        <p class="font-mono text-4xl font-semibold sm:text-5xl">{{ problem.prompt }}</p>
        <p
          class="font-mono text-lg tabular-nums"
          :class="
            phase === 'asking' ? 'text-ink-muted' : wasCorrect ? 'text-correct' : 'text-wrong'
          "
        >
          {{ seconds(clock.ms.value) }}
        </p>

        <form v-if="phase === 'asking'" class="flex gap-2" @submit.prevent="submit">
          <input
            ref="inputEl"
            v-model="input"
            inputmode="decimal"
            autocomplete="off"
            placeholder="Your answer"
            aria-label="Your answer"
            class="min-w-0 flex-1 rounded-lg border border-line bg-ground px-4 py-3 text-center font-mono text-2xl shadow-press outline-none focus:border-ink-muted"
          />
          <button class="btn btn-primary" :disabled="parseAnswer(input) === null">Check</button>
        </form>

        <div v-else class="animate-pop space-y-1">
          <p class="text-xl font-semibold" :class="wasCorrect ? 'text-correct' : 'text-wrong'">
            {{ wasCorrect ? 'Correct' : `Not quite: it's ${fmt(problem.answer)}` }}
          </p>
          <p v-if="!wasCorrect" class="text-sm text-ink-muted">You answered {{ input }}</p>
          <p
            v-if="clock.ms.value / 1000 > LEVELS[problemLevel].targetSeconds"
            class="text-sm text-ink-muted"
          >
            Target for this level: {{ LEVELS[problemLevel].targetSeconds }}s
          </p>
        </div>
      </section>

      <section v-if="phase === 'feedback'" class="card space-y-4">
        <BreakdownBar :key="problem.prompt" :breakdown="problem.breakdown" />
        <button ref="nextEl" class="btn btn-primary w-full" @click="next">
          {{ mode === 'daily' && progress.dailyDone ? 'Finish' : 'Next' }} ⏎
        </button>
      </section>
    </template>

    <section v-else-if="phase === 'done'" class="card animate-pop space-y-3 text-center">
      <p class="text-2xl font-semibold">Daily set done</p>
      <div class="rainbow mx-auto h-1.5 w-24 animate-rainbow rounded-full" />
      <p class="text-ink-muted">
        {{ sessionCorrect }}/{{ session.length }} right · median {{ seconds(sessionMedian) }} per
        problem
      </p>
      <p class="text-ink-muted">
        Streak: {{ progress.streak }} day{{ progress.streak === 1 ? '' : 's' }}
      </p>
      <button class="btn btn-primary w-full" @click="emit('exit')">Back home</button>
    </section>

    <dialog
      ref="dialogEl"
      aria-labelledby="level-done-title"
      class="m-auto w-[min(92vw,26rem)] overflow-hidden rounded-2xl bg-panel text-ink shadow-lift backdrop:bg-ink/35 backdrop:backdrop-blur-sm open:animate-pop"
      @close="onDialogClose"
    >
      <template v-if="finished !== null">
        <div class="rainbow h-2 animate-rainbow" />
        <div class="space-y-4 p-6 text-center">
          <p class="text-4xl" aria-hidden="true">🎉</p>
          <h2 id="level-done-title" class="text-2xl font-bold">
            Level {{ finished + 1 }} complete!
          </h2>
          <p class="text-sm text-ink-muted">
            {{ LEVELS[finished].title }} ·
            {{ Math.round(progress.statusOf(finished).accuracy * 100) }}% right · median
            {{ progress.statusOf(finished).medianSeconds.toFixed(1) }}s
          </p>
          <div class="rounded-xl border border-line bg-ground p-4 text-left shadow-press">
            <p class="text-xs tracking-wide text-ink-muted uppercase">
              Next up · Level {{ level + 1 }}
            </p>
            <p class="mt-1 font-semibold">{{ LEVELS[level].title }}</p>
            <p class="mt-1 text-sm text-ink-muted">{{ LEVELS[level].strategy }}</p>
          </div>
          <button class="btn btn-primary w-full" autofocus @click="continueFromDialog">
            {{
              mode === 'daily' && progress.dailyDone
                ? 'Finish the daily set'
                : `Start level ${level + 1}`
            }}
            ⏎
          </button>
          <form method="dialog">
            <button class="text-sm text-ink-muted underline hover:text-ink">
              See the breakdown first
            </button>
          </form>
        </div>
      </template>
    </dialog>
  </div>
</template>
