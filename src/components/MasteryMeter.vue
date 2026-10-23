<script setup lang="ts">
// The last WINDOW answers at a level as pips, and how few more right answers could finish it:
// a goal close enough to see pulls harder than a percentage.
import { computed } from 'vue'

import { useI18n } from '@/composables/useI18n'
import { LEVELS } from '@/engine/levels'
import { answersToMastery, summarize, WINDOW } from '@/engine/mastery'
import { useProgress } from '@/stores/progress'

const props = defineProps<{ levelIndex: number; compact?: boolean }>()
const { t } = useI18n()
const progress = useProgress()

const level = computed(() => LEVELS[props.levelIndex])
const recent = computed(() => (progress.history[level.value.id] ?? []).slice(-WINDOW))
const status = computed(() => progress.statusOf(props.levelIndex))
const toGo = computed(() => answersToMastery(level.value, recent.value))
const right = computed(() => recent.value.filter((a) => a.correct).length)

type Pip = 'fast' | 'slow' | 'wrong' | 'empty'
// Shapes as well as colour (✓ filled, ✓ outlined, ✗, empty ring), so colour-blind eyes can read it.
const pips = computed<Pip[]>(() => {
  const target = level.value.targetSeconds * 1000
  const shown = recent.value.map<Pip>((a) =>
    !a.correct ? 'wrong' : a.ms <= target ? 'fast' : 'slow',
  )
  return [...shown, ...Array<Pip>(WINDOW - shown.length).fill('empty')]
})

const PIP_CLASS: Record<Pip, string> = {
  fast: 'bg-correct text-white',
  slow: 'border-2 border-correct text-correct',
  wrong: 'bg-line text-ink-muted',
  empty: 'border border-dashed border-ink-muted/50',
}
const PIP_MARK: Record<Pip, string> = { fast: '✓', slow: '✓', wrong: '✗', empty: '' }
</script>

<template>
  <!-- Spans only: on Home this sits inside the level card's button. -->
  <span :class="compact ? 'flex items-center gap-2' : 'mt-2 block space-y-1.5'">
    <span
      class="flex gap-1"
      role="img"
      :aria-label="t('meter.label', { right, wrong: recent.length - right })"
      :title="t('meter.legend')"
    >
      <span
        v-for="(pip, i) in pips"
        :key="i"
        class="flex items-center justify-center rounded-full text-[10px] leading-none font-bold"
        :class="[PIP_CLASS[pip], compact ? 'size-3.5' : 'size-5']"
        aria-hidden="true"
        >{{ compact ? '' : PIP_MARK[pip] }}</span
      >
    </span>
    <span v-if="compact" class="text-xs whitespace-nowrap text-ink-muted">
      {{ t('meter.toGoShort', { n: toGo }) }}
    </span>
    <template v-else>
      <span class="block text-sm font-medium text-ink">
        {{
          recent.length
            ? t('meter.toGo', { n: toGo, target: level.targetSeconds })
            : t('meter.start', { window: WINDOW, target: level.targetSeconds })
        }}
      </span>
      <span v-if="recent.length" class="block font-mono text-xs text-ink-muted">
        {{
          t('home.status', {
            answered: status.answered,
            window: WINDOW,
            summary: summarize(status),
            target: level.targetSeconds,
          })
        }}
      </span>
    </template>
  </span>
</template>
