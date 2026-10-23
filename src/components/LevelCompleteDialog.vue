<script setup lang="ts">
// The popup after a level is mastered: how it went, and what the next level is about.
import { computed, ref, watch } from 'vue'

import { LEVELS } from '@/engine/levels'
import { summarize } from '@/engine/mastery'
import { useProgress } from '@/stores/progress'

const props = defineProps<{
  /** The level just mastered; the popup opens when this is set. */
  level: number | null
  next: number
  /** The answer that finished the level also finished the daily set. */
  finishing: boolean
}>()
const emit = defineEmits<{ continue: []; close: [] }>()

const progress = useProgress()
const dialogEl = ref<HTMLDialogElement>()

const stats = computed(() =>
  props.level === null ? '' : summarize(progress.statusOf(props.level)),
)

// Post flush, so the content is rendered (and the button can take autofocus) before it opens.
watch(
  () => props.level,
  (level) => {
    if (level !== null) dialogEl.value?.showModal()
  },
  { flush: 'post' },
)

function continueOn() {
  dialogEl.value?.close()
  emit('continue')
}
</script>

<template>
  <!-- `close` fires however the popup closes: the button, Esc, or the form below. -->
  <dialog
    ref="dialogEl"
    aria-labelledby="level-done-title"
    class="m-auto w-[min(92vw,26rem)] overflow-hidden rounded-2xl bg-panel text-ink shadow-lift backdrop:bg-ink/35 backdrop:backdrop-blur-sm open:animate-pop"
    @close="emit('close')"
  >
    <template v-if="level !== null">
      <div class="rainbow h-2 animate-rainbow" />
      <div class="space-y-4 p-6 text-center">
        <p class="text-4xl" aria-hidden="true">🎉</p>
        <h2 id="level-done-title" class="text-2xl font-bold">Level {{ level + 1 }} complete!</h2>
        <p class="text-sm text-ink-muted">{{ LEVELS[level].title }} · {{ stats }}</p>
        <div class="well rounded-xl p-4 text-left">
          <p class="text-xs tracking-wide text-ink-muted uppercase">
            Next up · Level {{ next + 1 }}
          </p>
          <p class="mt-1 font-semibold">{{ LEVELS[next].title }}</p>
          <p class="mt-1 text-sm text-ink-muted">{{ LEVELS[next].strategy }}</p>
        </div>
        <button class="btn btn-primary w-full" autofocus @click="continueOn">
          {{ finishing ? 'Finish the daily set' : `Start level ${next + 1}` }}
          <span class="ml-1" aria-hidden="true">⏎</span>
        </button>
        <form method="dialog">
          <button class="text-sm text-ink-muted underline hover:text-ink">
            See the breakdown first
          </button>
        </form>
      </div>
    </template>
  </dialog>
</template>
