<script setup lang="ts">
// The popup after a level is mastered: a celebration and one button. The next level's tip shows
// on its first problem instead.
import { ref, watch } from 'vue'

import { useI18n } from '@/composables/useI18n'

const props = defineProps<{
  /** The level just mastered; the popup opens when this is set. */
  level: number | null
  next: number
  /** The answer that finished the level also finished the daily set. */
  finishing: boolean
}>()
const emit = defineEmits<{ continue: []; close: [] }>()

const { t } = useI18n()
const dialogEl = ref<HTMLDialogElement>()

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
  <!-- `close` fires however the popup closes: the button or Esc. -->
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
        <h2 id="level-done-title" class="text-2xl font-bold">
          {{ t('dialog.title', { n: level + 1 }) }}
        </h2>
        <button class="btn btn-primary w-full" autofocus @click="continueOn">
          {{ finishing ? t('drill.next') : t('dialog.startNext', { n: next + 1 }) }}
          <span class="ml-1" aria-hidden="true">⏎</span>
        </button>
      </div>
    </template>
  </dialog>
</template>
