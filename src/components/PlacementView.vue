<script setup lang="ts">
// The optional "find my level" test: a 3-problem check per world. Every answer gets a verdict
// (a right one moves on by itself, a wrong one waits for Next), a passed check pauses on the
// world it opens, and the run always ends on a result screen, never straight back Home.
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

import MascotDrop from './MascotDrop.vue'
import { BUZZ, useHaptics } from '@/composables/useHaptics'
import { useI18n } from '@/composables/useI18n'
import { seconds, useStopwatch } from '@/composables/useStopwatch'
import type { Problem } from '@/engine/levels'
import { isCorrect, parseAnswer } from '@/engine/math'
import { CHECK_SIZE, CHECKS, checkResult, levelAt, passes, placeFrom } from '@/engine/placement'
import { createRng } from '@/engine/rng'
import { WORLDS, worldOf } from '@/engine/worlds'
import { useProgress } from '@/stores/progress'

const emit = defineEmits<{ done: [] }>()
const { t } = useI18n()
const { buzz } = useHaptics()
const progress = useProgress()
const rng = createRng()
const clock = useStopwatch()

/** How long a right answer's verdict and a passed world stay up before moving on. */
const RIGHT_MS = 900
const CLEARED_MS = 1200

type Phase = 'asking' | 'verdict' | 'cleared' | 'result'
const phase = ref<Phase>('asking')
const check = ref(0)
const results = ref<boolean[][]>([[]])
const problem = ref<Problem>()
const input = ref('')
const last = ref({ correct: false, ms: 0, slow: false })
/** Whether placement moved the learner up; the result screen says so either way. */
const moved = ref(false)

const inputEl = ref<HTMLInputElement>()
const nextEl = ref<HTMLButtonElement>()
const startEl = ref<HTMLButtonElement>()
const canSubmit = computed(() => parseAnswer(input.value) !== null)
const passed = computed(() => results.value[check.value])
const question = computed(() => passed.value.length)
const step = computed(() => check.value * CHECK_SIZE + Math.min(question.value + 1, CHECK_SIZE))
const resultWorld = computed(() => WORLDS[worldOf(progress.unlocked)])
const isNewLevel = computed(() => progress.statusOf(progress.unlocked).answered === 0)

let timer: ReturnType<typeof setTimeout> | undefined
function after(ms: number, fn: () => void) {
  timer = setTimeout(fn, ms)
}
onUnmounted(() => clearTimeout(timer))

function ask() {
  problem.value = levelAt(check.value, question.value).generate(rng)
  input.value = ''
  phase.value = 'asking'
  clock.start()
  nextTick(() => inputEl.value?.focus())
}

function submit() {
  if (phase.value !== 'asking' || !problem.value || !canSubmit.value) return
  const level = levelAt(check.value, question.value)
  const answer = { correct: isCorrect(input.value, problem.value.answer), ms: clock.stop() }
  last.value = { ...answer, slow: answer.correct && answer.ms > level.targetSeconds * 1000 }
  passed.value.push(passes(level, answer))
  phase.value = 'verdict'
  if (answer.correct) {
    buzz(BUZZ.right)
    after(RIGHT_MS, next)
  } else nextTick(() => nextEl.value?.focus())
}

function next() {
  clearTimeout(timer)
  const outcome = checkResult(passed.value)
  if (outcome === null) return ask()
  if (outcome === 'pass' && check.value < CHECKS.length - 1) {
    phase.value = 'cleared'
    after(CLEARED_MS, () => {
      check.value++
      results.value.push([])
      ask()
    })
    return
  }
  finish()
}

function finish() {
  const before = progress.unlocked
  progress.place(placeFrom(results.value))
  moved.value = progress.unlocked > before
  phase.value = 'result'
  nextTick(() => startEl.value?.focus())
}

onMounted(ask)
</script>

<template>
  <div class="mx-auto max-w-xl space-y-5 px-4 py-6">
    <header class="flex items-center gap-3">
      <button
        class="icon-btn text-xl"
        :aria-label="t('drill.back')"
        :title="t('drill.back')"
        @click="emit('done')"
      >
        <span aria-hidden="true">←</span>
      </button>
      <template v-if="phase !== 'result'">
        <span class="text-sm font-semibold text-cta">{{ t(`world.${WORLDS[check].id}`) }}</span>
        <span
          class="flex gap-1"
          role="img"
          :aria-label="t('placement.step', { n: step, total: CHECKS.length * CHECK_SIZE })"
        >
          <span
            v-for="i in CHECK_SIZE"
            :key="i"
            class="size-3 rounded-full"
            :class="
              i > passed.length
                ? 'border border-dashed border-ink-muted/50'
                : passed[i - 1]
                  ? 'bg-cta'
                  : 'bg-ink-muted/40'
            "
            aria-hidden="true"
          />
        </span>
      </template>
    </header>

    <section
      v-if="phase === 'cleared'"
      class="card animate-pop space-y-2 text-center"
      role="status"
    >
      <MascotDrop mood="cheer" :size="56" class="mx-auto" />
      <p class="text-lg font-semibold text-correct">
        <span aria-hidden="true">✓</span> {{ t(`world.${WORLDS[check].id}`) }}
      </p>
      <p class="text-3xl font-bold text-cta">
        <span aria-hidden="true">→ </span>{{ t(`world.${WORLDS[check + 1].id}`) }}
      </p>
    </section>

    <section v-else-if="phase === 'result'" class="card animate-pop space-y-4 text-center">
      <MascotDrop :mood="moved ? 'cheer' : 'idle'" :size="64" class="mx-auto" />
      <p class="text-3xl font-bold text-cta">{{ t(`world.${resultWorld.id}`) }}</p>
      <p v-if="!moved" class="text-ink-muted">{{ t('placement.same') }}</p>
      <button ref="startEl" class="btn btn-primary w-full" @click="emit('done')">
        {{ t(isNewLevel ? 'home.start' : 'home.continue', { n: progress.unlocked + 1 }) }}
      </button>
    </section>

    <section v-else-if="problem" class="card space-y-5 text-center">
      <p class="font-mono text-4xl font-semibold sm:text-5xl">{{ t(problem.prompt) }}</p>
      <form v-if="phase === 'asking'" class="flex gap-2" @submit.prevent="submit">
        <input
          ref="inputEl"
          v-model="input"
          inputmode="decimal"
          autocomplete="off"
          enterkeyhint="done"
          :placeholder="t('drill.answer')"
          :aria-label="t('drill.answer')"
          class="well min-w-0 flex-1 rounded-lg border-ink-muted/80 px-4 py-3 text-center font-mono text-2xl outline-none focus:border-ink"
        />
        <button class="btn btn-primary" :disabled="!canSubmit">{{ t('drill.check') }}</button>
      </form>
      <template v-else>
        <div class="animate-pop space-y-1" role="status">
          <div class="flex items-center justify-center gap-2">
            <MascotDrop :key="step" :mood="last.correct ? 'happy' : 'oops'" :size="30" />
            <p class="text-xl font-semibold" :class="last.correct ? 'text-correct' : 'text-wrong'">
              <span aria-hidden="true">{{ last.correct ? '✓' : '✗' }}</span>
              {{ last.correct ? t('drill.correct') : t('drill.wrong', { answer: problem.answer }) }}
            </p>
          </div>
          <p v-if="last.slow" class="font-mono text-ink-muted tabular-nums">
            <span aria-hidden="true">⏱ </span>{{ t(seconds(last.ms)) }}
          </p>
          <p v-if="!last.correct" class="font-mono text-ink-muted">
            <s aria-hidden="true">{{ input }}</s>
            <span class="sr-only">{{ t('drill.youAnswered', { input }) }}</span>
          </p>
        </div>
        <button v-if="!last.correct" ref="nextEl" class="btn btn-primary w-full" @click="next">
          {{ t('drill.next') }}
          <span class="ml-1" aria-hidden="true">⏎</span>
        </button>
      </template>
    </section>
  </div>
</template>
