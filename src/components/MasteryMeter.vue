<script setup lang="ts">
// A level's countdown as GOAL pips: one fills with each right, on-time answer and never empties,
// so the learner can see exactly how many are left. The pips teach the rule; there's no legend.
import { computed } from 'vue'

import { useI18n } from '@/composables/useI18n'
import { LEVELS } from '@/engine/levels'
import { answersToMastery, GOAL } from '@/engine/mastery'
import { useProgress } from '@/stores/progress'

const props = defineProps<{
  levelIndex: number
  compact?: boolean
  /** Pips only: on Home the glass already shows how many more are needed. */
  hideCount?: boolean
}>()
const { t } = useI18n()
const progress = useProgress()

const level = computed(() => LEVELS[props.levelIndex])
const answers = computed(() => progress.history[level.value.id] ?? [])
const done = computed(() => Math.min(progress.statusOf(props.levelIndex).counted, GOAL))
const toGo = computed(() => answersToMastery(level.value, answers.value))
</script>

<template>
  <!-- Spans only: on Home this sits inside the level row's button. -->
  <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
    <span class="flex gap-1" role="img" :aria-label="t('meter.label', { done, goal: GOAL })">
      <span
        v-for="i in GOAL"
        :key="i"
        class="flex items-center justify-center rounded-full text-[10px] leading-none font-bold"
        :class="[
          i <= done ? 'bg-correct text-white' : 'border border-dashed border-ink-muted/50',
          compact ? 'size-3.5 text-[8px]' : 'size-4',
        ]"
        aria-hidden="true"
        >{{ i <= done ? '✓' : '' }}</span
      >
    </span>
    <span v-if="!hideCount" class="text-xs whitespace-nowrap text-ink-muted">
      {{ t('meter.toGoShort', { n: toGo }) }}
    </span>
  </span>
</template>
