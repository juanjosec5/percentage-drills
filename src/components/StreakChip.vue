<script setup lang="ts">
// The streak, plus today's goal as a ring around the flame: it fills with each answer and closes
// at the day's goal. It never stops practice; it only says whether today counts yet.
import { computed } from 'vue'

import { useI18n } from '@/composables/useI18n'

const props = defineProps<{ days: number; today: number; goal: number }>()
const { t } = useI18n()

/** The ring's circumference, for a circle of r = 9 in a 22×22 box. */
const RING = 2 * Math.PI * 9
const dash = computed(() => `${(Math.min(props.today, props.goal) / props.goal) * RING} ${RING}`)
const label = computed(() =>
  [
    props.days ? t('streak.aria', { n: props.days }) : '',
    t('streak.today', { n: props.today, goal: props.goal }),
  ]
    .filter(Boolean)
    .join(' · '),
)
</script>

<template>
  <!-- role="img" so the chip is read as one phrase, not "fire 4". -->
  <span
    role="img"
    :aria-label="label"
    class="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-full border border-line bg-panel py-0.5 pr-2 pl-0.5 text-sm font-semibold tabular-nums shadow-soft"
  >
    <span class="relative grid size-6 place-items-center" aria-hidden="true">
      <svg class="absolute inset-0 -rotate-90" viewBox="0 0 22 22">
        <circle cx="11" cy="11" r="9" fill="none" class="stroke-line" stroke-width="2.5" />
        <circle
          cx="11"
          cy="11"
          r="9"
          fill="none"
          class="stroke-star transition-[stroke-dasharray] duration-500"
          stroke-width="2.5"
          stroke-linecap="round"
          :stroke-dasharray="dash"
        />
      </svg>
      <span class="relative text-xs">🔥</span>
    </span>
    <span aria-hidden="true">{{ days }}</span>
  </span>
</template>
