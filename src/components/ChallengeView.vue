<script setup lang="ts">
// A world's challenge: CHALLENGE_SIZE right answers to problems from across the world, each within
// twice its level's time, with LIVES to spare. A miss costs a life and brings a follow-up from the
// same level; the last life ends the run as a failed try, straight back Home, where the best is
// kept and the retry is one tap away. A full run opens the next world. Answers count toward the
// day like any, and a miss also goes into its level's history, so review aims at it later.
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

import LifeDrops from './LifeDrops.vue'
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
  livesLeft,
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

/** The level of each question still to come, starting with the one on screen. */
const queue = ref<number[]>([])
const passed = ref<boolean[]>([])
const problem = ref<Problem>()
const verdict = ref<Verdict | null>(null)
const result = ref<'pass' | null>(null)
const isNewLevel = computed(() => progress.statusOf(progress.unlocked).answered === 0)
const score = computed(() => passed.value.filter(Boolean).length)
const lives = computed(() => livesLeft(passed.value))
const level = computed(() => LEVELS[queue.value[0]])

const limitS = computed(() => level.value.targetSeconds * SLACK)

const mainEl = ref<HTMLButtonElement>()

let timer: ReturnType<typeof setTimeout> | undefined
onUnmounted(() => clearTimeout(timer))

function begin() {
  queue.value = challengeLevels(props.world, rng)
  passed.value = []
  result.value = null
  ask()
}

function ask() {
  const previous = JSON.stringify(problem.value?.prompt)
  // Never the same prompt twice running: it would read as the app stuck.
  let next = level.value.generate(rng)
  for (let tries = 0; JSON.stringify(next.prompt) === previous && tries < 10; tries++)
    next = level.value.generate(rng)
  problem.value = next
  verdict.value = null
  clock.start()
}

function submit(input: string) {
  if (verdict.value || !problem.value) return
  const answer = { correct: isCorrect(input, problem.value.answer), ms: clock.stop() }
  const ok = passes(level.value, answer)
  passed.value.push(ok)
  // A miss is the best sign a level is slipping: it joins that level's history (which also
  // logs the day). A pass only logs the day, so challenges can't pad a level's record.
  if (ok) {
    progress.logDay(answer)
    progress.check(queue.value[0], true)
  } else progress.record(queue.value[0], answer)
  // Right but too slow costs a life too, so it says why.
  const tooSlow = answer.correct && !ok
  verdict.value = {
    correct: answer.correct,
    time: tooSlow ? t('challenge.slow', { s: limitS.value }) : undefined,
    slow: tooSlow,
  }
  if (ok) {
    buzz(BUZZ.right)
    timer = setTimeout(next, RIGHT_MS)
  }
}

function next() {
  clearTimeout(timer)
  const outcome = challengeResult(passed.value)
  if (outcome === null) {
    // A pass moves on; a miss keeps its level at the front, so the next problem comes from the
    // same level: a second look at the slip.
    if (passed.value.at(-1)) queue.value = queue.value.slice(1)
    return ask()
  }
  progress.finishChallenge(props.world, score.value)
  // Out of lives: a failed try, straight back Home, where the card offers the retry and the best.
  if (outcome === 'fail') return emit('done')
  result.value = outcome
  buzz(BUZZ.cleared)
  nextTick(() => mainEl.value?.focus())
}

onMounted(begin)
</script>

<template>
  <div class="mx-auto max-w-xl space-y-5 px-4 py-6">
    <header class="flex items-center gap-2 sm:gap-3">
      <button
        class="icon-btn text-xl"
        :aria-label="t('drill.back')"
        :title="t('drill.back')"
        @click="emit('done')"
      >
        <span aria-hidden="true">←</span>
      </button>
      <span class="text-sm font-semibold whitespace-nowrap text-cta">{{ title }}</span>
      <template v-if="!result">
        <LifeDrops :left="lives" class="ml-auto" />
        <!-- Right answers only, so the row never goes backwards: a miss shows on the drops. -->
        <span
          class="flex gap-0.5 sm:gap-1"
          role="img"
          :aria-label="t('meter.label', { done: score, goal: CHALLENGE_SIZE })"
        >
          <span
            v-for="i in CHALLENGE_SIZE"
            :key="i"
            class="size-2 rounded-full sm:size-2.5"
            :class="i > score ? 'border border-dashed border-ink-muted/50' : 'bg-cta'"
            aria-hidden="true"
          />
        </span>
      </template>
    </header>

    <section v-if="result === 'pass'" class="card animate-pop space-y-4 text-center" role="status">
      <MascotDrop mood="cheer" :size="64" class="mx-auto" />
      <p class="text-lg font-semibold text-correct">
        <span aria-hidden="true">✓</span> {{ title }}
      </p>
      <p class="text-3xl font-bold text-cta">
        <span aria-hidden="true">→ </span>{{ t(`world.${WORLDS[world + 1].id}`) }}
      </p>
      <LifeDrops :left="lives" class="justify-center" />
      <button ref="mainEl" class="btn btn-primary w-full" @click="emit('done')">
        {{ t(isNewLevel ? 'home.start' : 'home.continue', { n: progress.unlocked + 1 }) }}
      </button>
    </section>

    <QuizCard
      v-else-if="problem"
      :problem="problem"
      :verdict="verdict"
      :limit="t('challenge.limit', { s: limitS })"
      @answer="submit"
      @next="next"
    />
  </div>
</template>
