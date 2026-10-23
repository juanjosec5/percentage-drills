<script setup lang="ts">
// The optional "skip ahead" ladder: one problem per level, no verdicts on the way (grading every
// answer would make it feel like an exam). The first miss or slow answer ends it, and Home opens
// at the level reached.
import { computed, nextTick, onMounted, ref } from 'vue'

import GroupedText from './GroupedText.vue'
import { useI18n } from '@/composables/useI18n'
import { useStopwatch } from '@/composables/useStopwatch'
import { LEVELS, type Problem } from '@/engine/levels'
import { counts, type Answer } from '@/engine/mastery'
import { isCorrect, parseAnswer } from '@/engine/math'
import { placeFrom, RUNGS } from '@/engine/placement'
import { createRng } from '@/engine/rng'
import { useProgress } from '@/stores/progress'

const emit = defineEmits<{ done: [] }>()
const { t } = useI18n()
const progress = useProgress()
const rng = createRng()
const clock = useStopwatch()

const step = ref(0)
const problem = ref<Problem>()
const input = ref('')
const answers: Answer[] = []
const inputEl = ref<HTMLInputElement>()
const canSubmit = computed(() => parseAnswer(input.value) !== null)

function ask() {
  problem.value = LEVELS[RUNGS[step.value]].generate(rng)
  input.value = ''
  clock.start()
  nextTick(() => inputEl.value?.focus())
}

function submit() {
  if (!problem.value || !canSubmit.value) return
  const answer = { correct: isCorrect(input.value, problem.value.answer), ms: clock.stop() }
  answers.push(answer)
  if (counts(LEVELS[RUNGS[step.value]], answer) && step.value < RUNGS.length - 1) {
    step.value++
    ask()
  } else {
    progress.place(placeFrom(answers))
    emit('done')
  }
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
      <span
        class="flex gap-1"
        role="img"
        :aria-label="t('placement.step', { n: step + 1, total: RUNGS.length })"
      >
        <span
          v-for="i in RUNGS.length"
          :key="i"
          class="size-3 rounded-full"
          :class="i <= step ? 'bg-cta' : 'border border-dashed border-ink-muted/50'"
          aria-hidden="true"
        />
      </span>
    </header>

    <section v-if="problem" class="card space-y-5 text-center">
      <p class="font-mono text-4xl font-semibold sm:text-5xl">
        <GroupedText :text="t(problem.prompt)" />
      </p>
      <form class="flex gap-2" @submit.prevent="submit">
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
    </section>
  </div>
</template>
