<script setup lang="ts">
// A challenge's lives as Plip-shaped drops: full while they last, an outline once spent. A drop
// that's just been lost falls a little and fades into its outline.
import { useI18n } from '@/composables/useI18n'
import { LIVES } from '@/engine/challenge'

defineProps<{ left: number }>()
const { t } = useI18n()
</script>

<template>
  <span class="flex gap-0.5" role="img" :aria-label="t('challenge.lives', { n: left })">
    <svg
      v-for="i in LIVES"
      :key="i"
      viewBox="0 0 12 16"
      class="h-4 w-3"
      :class="i > left ? 'lost text-ink-muted/50' : 'text-cta'"
      aria-hidden="true"
    >
      <path
        d="M6 1 C6 1 1 7.5 1 10.5 A5 5 0 0 0 11 10.5 C11 7.5 6 1 6 1 Z"
        :fill="i > left ? 'none' : 'currentColor'"
        stroke="currentColor"
        stroke-width="1.4"
      />
    </svg>
  </span>
</template>

<style scoped>
.lost {
  animation: drain 0.4s ease-in both;
}
@keyframes drain {
  from {
    transform: translateY(-3px);
    opacity: 0.2;
  }
}
@media (prefers-reduced-motion: reduce) {
  .lost {
    animation: none;
  }
}
</style>
