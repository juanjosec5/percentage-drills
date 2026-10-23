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
const levelUp = ref(false)
const session = ref<{ correct: boolean; ms: number }[]>([])

const inputEl = ref<HTMLInputElement>()
const nextEl = ref<HTMLButtonElement>()

const sessionCorrect = computed(() => session.value.filter((a) => a.correct).length)
const sessionMedian = computed(() => median(session.value.map((a) => a.ms)))
const dailyLeft = computed(() => Math.max(0, DAILY_COUNT - progress.today.daily))

function ask() {
  const next = nextProblem(level.value, rng, problem.value?.prompt)
  problem.value = next.problem
  problemLevel.value = next.levelIndex
  input.value = ''
  levelUp.value = false
  phase.value = 'asking'
  clock.start()
  nextTick(() => inputEl.value?.focus())
}

function submit() {
  if (phase.value !== 'asking' || !problem.value || parseAnswer(input.value) === null) return
  const ms = clock.stop()
  wasCorrect.value = isCorrect(input.value, problem.value.answer)
  session.value.push({ correct: wasCorrect.value, ms })
  if (progress.record(problemLevel.value, { correct: wasCorrect.value, ms }, props.mode)) {
    levelUp.value = true
    level.value = progress.unlocked
  }
  phase.value = 'feedback'
  nextTick(() => nextEl.value?.focus())
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

    <p v-if="phase !== 'done'" class="text-xs tracking-wide text-ink-muted uppercase">
      Level {{ level + 1 }} · {{ LEVELS[level].title }}
      <span v-if="problemLevel !== level"> · review: {{ LEVELS[problemLevel].title }}</span>
    </p>

    <template v-if="phase !== 'done' && problem">
      <section class="card space-y-5 text-center">
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
            class="min-w-0 flex-1 rounded-lg border border-line bg-ground px-4 py-3 text-center font-mono text-2xl outline-none focus:border-accent"
          />
          <button class="btn bg-accent text-white" :disabled="parseAnswer(input) === null">
            Check
          </button>
        </form>

        <div v-else class="space-y-1">
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
        <p
          v-if="levelUp"
          class="rounded-lg bg-correct/15 px-3 py-2 text-sm font-medium text-correct"
        >
          Level up! Next: {{ LEVELS[level].title }}
        </p>
        <BreakdownBar :key="problem.prompt" :breakdown="problem.breakdown" />
        <button ref="nextEl" class="btn w-full bg-accent text-white" @click="next">
          {{ mode === 'daily' && progress.dailyDone ? 'Finish' : 'Next' }} ⏎
        </button>
      </section>
    </template>

    <section v-else-if="phase === 'done'" class="card space-y-3 text-center">
      <p class="text-2xl font-semibold">Daily set done</p>
      <p class="text-ink-muted">
        {{ sessionCorrect }}/{{ session.length }} right · median {{ seconds(sessionMedian) }} per
        problem
      </p>
      <p class="text-ink-muted">
        Streak: {{ progress.streak }} day{{ progress.streak === 1 ? '' : 's' }}
      </p>
      <button class="btn w-full bg-accent text-white" @click="emit('exit')">Back home</button>
    </section>
  </div>
</template>
