<script setup lang="ts">
// A world's challenge: CHALLENGE_SIZE problems from across the world, each right and within twice
// its level's time, in a row. The first miss ends the run on its score, with the best kept and a
// retry one tap away; a full run opens the next world. Answers count toward the day like any.
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

import MascotDrop from './MascotDrop.vue'
import QuizCard, { RIGHT_MS, type Verdict } from './QuizCard.vue'
import { BUZZ, useHaptics } from '@/composables/useHaptics'
import { useI18n } from '@/composables/useI18n'
import { useStopwatch } from '@/composables/useStopwatch'
import {
  CHALLENGE_SIZE,
  challengeLevels,
  challengeResult,
  challengeTitle,
} from '@/engine/challenge'
import { LEVELS, type Problem } from '@/engine/levels'
import { isCorrect } from '@/engine/math'
import { passes, SLACK } from '@/engine/placement'
import { createRng } from '@/engine/rng'
import { WORLDS } from '@/engine/worlds'
import { useProgress } from '@/stores/progress'

const props = defineProps<{ world: number }>()
const emit = defineEmits<{ done: [] }>()
const { t } = useI18n()
const { buzz } = useHaptics()
const progress = useProgress()
const rng = createRng()
const clock = useStopwatch()

const title = computed(() => t(challengeTitle(props.world)))

const levels = ref<number[]>([])
const passed = ref<boolean[]>([])
const problem = ref<Problem>()
const verdict = ref<Verdict | null>(null)
const result = ref<'pass' | 'fail' | null>(null)
const best = computed(() => progress.challenges[WORLDS[props.world].id] ?? 0)
const isNewLevel = computed(() => progress.statusOf(progress.unlocked).answered === 0)
const score = computed(() => passed.value.filter(Boolean).length)

const mainEl = ref<HTMLButtonElement>()

let timer: ReturnType<typeof setTimeout> | undefined
onUnmounted(() => clearTimeout(timer))

function begin() {
  levels.value = challengeLevels(props.world, rng)
  passed.value = []
  result.value = null
  ask()
}

function ask() {
  const level = LEVELS[levels.value[passed.value.length]]
  const previous = JSON.stringify(problem.value?.prompt)
  // Never the same prompt twice running: it would read as the app stuck.
  let next = level.generate(rng)
  for (let tries = 0; JSON.stringify(next.prompt) === previous && tries < 10; tries++)
    next = level.generate(rng)
  problem.value = next
  verdict.value = null
  clock.start()
}

function submit(input: string) {
  if (verdict.value || !problem.value) return
  const level = LEVELS[levels.value[passed.value.length]]
  const answer = { correct: isCorrect(input, problem.value.answer), ms: clock.stop() }
  const ok = passes(level, answer)
  passed.value.push(ok)
  progress.logDay(answer)
  // Right but too slow ends the run too, so it says why.
  const tooSlow = answer.correct && !ok
  verdict.value = {
    correct: answer.correct,
    time: tooSlow ? t('challenge.slow', { s: level.targetSeconds * SLACK }) : undefined,
    wait: tooSlow,
  }
  if (ok) {
    buzz(BUZZ.right)
    timer = setTimeout(next, RIGHT_MS)
  }
}

function next() {
  clearTimeout(timer)
  const outcome = challengeResult(passed.value)
  if (outcome === null) return ask()
  progress.finishChallenge(props.world, score.value)
  result.value = outcome
  if (outcome === 'pass') buzz(BUZZ.cleared)
  nextTick(() => mainEl.value?.focus())
}

onMounted(begin)
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
      <span class="text-sm font-semibold text-cta">{{ title }}</span>
      <span
        v-if="!result"
        class="ml-auto flex gap-1"
        role="img"
        :aria-label="t('placement.step', { n: passed.length, total: CHALLENGE_SIZE })"
      >
        <span
          v-for="i in CHALLENGE_SIZE"
          :key="i"
          class="size-2.5 rounded-full"
          :class="
            i > passed.length
              ? 'border border-dashed border-ink-muted/50'
              : passed[i - 1]
                ? 'bg-cta'
                : 'bg-wrong'
          "
          aria-hidden="true"
        />
      </span>
    </header>

    <section v-if="result === 'pass'" class="card animate-pop space-y-4 text-center" role="status">
      <MascotDrop mood="cheer" :size="64" class="mx-auto" />
      <p class="text-lg font-semibold text-correct">
        <span aria-hidden="true">✓</span> {{ title }}
      </p>
      <p class="text-3xl font-bold text-cta">
        <span aria-hidden="true">→ </span>{{ t(`world.${WORLDS[world + 1].id}`) }}
      </p>
      <button ref="mainEl" class="btn btn-primary w-full" @click="emit('done')">
        {{ t(isNewLevel ? 'home.start' : 'home.continue', { n: progress.unlocked + 1 }) }}
      </button>
    </section>

    <section
      v-else-if="result === 'fail'"
      class="card animate-pop space-y-4 text-center"
      role="status"
    >
      <MascotDrop mood="oops" :size="64" class="mx-auto" />
      <p class="font-mono text-4xl font-bold tabular-nums">
        {{ t('challenge.score', { n: score, total: CHALLENGE_SIZE }) }}
      </p>
      <p class="text-ink-muted">
        {{ t('challenge.rule') }} ·
        {{ t('challenge.best', { n: best, total: CHALLENGE_SIZE }) }}
      </p>
      <button ref="mainEl" class="btn btn-primary w-full" @click="begin">
        {{ t('challenge.retry') }}
      </button>
      <button class="text-sm text-ink-muted underline" @click="emit('done')">
        {{ t('drill.home') }}
      </button>
    </section>

    <QuizCard
      v-else-if="problem"
      :problem="problem"
      :verdict="verdict"
      @answer="submit"
      @next="next"
    />
  </div>
</template>
