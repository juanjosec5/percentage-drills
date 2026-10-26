<script lang="ts">
/** How long a right answer's verdict stays up before a quiz moves on by itself. */
export const RIGHT_MS = 900

export interface Verdict {
  correct: boolean
  /** Shown under the verdict when time mattered, e.g. "⏱ over 16s". */
  time?: string
  /** Right but past the limit, so it didn't count: a neutral verdict that waits for Next. */
  slow?: boolean
}
</script>

<script setup lang="ts">
// One question of a quiz (placement, a world challenge): the prompt, the answer box, then the
// verdict in its place. A right answer moves on by itself (the parent's timer); a wrong one waits
// for Next, which takes focus so Enter carries on.
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import MascotDrop from './MascotDrop.vue'
import { useI18n } from '@/composables/useI18n'
import type { Problem } from '@/engine/levels'
import { parseAnswer } from '@/engine/math'

const props = defineProps<{
  problem: Problem
  /** Null while asking. */
  verdict: Verdict | null
  /** The time limit, shown under the prompt while asking (e.g. "/ 16s"). */
  limit?: string
}>()
const emit = defineEmits<{ answer: [input: string]; next: [] }>()
const { t } = useI18n()

const waits = (v: Verdict) => !v.correct || !!v.slow
const input = ref('')
const inputEl = ref<HTMLInputElement>()
const nextEl = ref<HTMLButtonElement>()
const canSubmit = computed(() => parseAnswer(input.value) !== null)

function submit() {
  if (!props.verdict && canSubmit.value) emit('answer', input.value)
}

const focusInput = () => nextTick(() => inputEl.value?.focus())
onMounted(focusInput)
watch(
  () => props.problem,
  () => {
    input.value = ''
    focusInput()
  },
)
watch(
  () => props.verdict,
  (v) => v && waits(v) && nextTick(() => nextEl.value?.focus()),
)
</script>

<template>
  <section class="card space-y-5 text-center">
    <div>
      <p class="font-mono text-4xl font-semibold sm:text-5xl">{{ t(problem.prompt) }}</p>
      <p v-if="limit" class="mt-1 font-mono text-sm text-ink-muted tabular-nums">
        <span aria-hidden="true">⏱ </span>{{ limit }}
      </p>
    </div>
    <form v-if="!verdict" class="flex gap-2" @submit.prevent="submit">
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
          <MascotDrop
            :mood="verdict.slow ? 'idle' : verdict.correct ? 'happy' : 'oops'"
            :size="30"
          />
          <p
            class="text-xl font-semibold"
            :class="
              verdict.slow ? 'text-ink-muted' : verdict.correct ? 'text-correct' : 'text-wrong'
            "
          >
            <span aria-hidden="true">{{ verdict.correct ? '✓' : '✗' }}</span>
            {{
              verdict.correct ? t('drill.correct') : t('drill.wrong', { answer: problem.answer })
            }}
          </p>
        </div>
        <p v-if="verdict.time" class="font-mono text-ink-muted tabular-nums">
          {{ verdict.time }}
        </p>
        <p v-if="!verdict.correct" class="font-mono text-ink-muted">
          <s aria-hidden="true">{{ input }}</s>
          <span class="sr-only">{{ t('drill.youAnswered', { input }) }}</span>
        </p>
      </div>
      <button
        v-if="waits(verdict)"
        ref="nextEl"
        class="btn btn-primary w-full"
        @click="emit('next')"
      >
        {{ t('drill.next') }}
        <span class="ml-1" aria-hidden="true">⏎</span>
      </button>
    </template>
  </section>
</template>
