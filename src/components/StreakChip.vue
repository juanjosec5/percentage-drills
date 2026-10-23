<script setup lang="ts">
import { useI18n } from '@/composables/useI18n'

defineProps<{ days: number }>()
const { t } = useI18n()
</script>

<template>
  <!-- role="img" so the chip is read as one phrase ("4-day streak"), not "fire 4". -->
  <span
    role="img"
    :aria-label="t('streak.aria', { n: days })"
    class="inline-flex min-h-6 shrink-0 items-center gap-1 rounded-full border border-line bg-panel px-2 text-sm font-semibold tabular-nums shadow-soft"
    >🔥 {{ days }}</span
  >
</template>
