<script setup lang="ts">
// Draws a problem's breakdown: for multi-step problems, a bar made of the pieces of the
// calculation, each with its value; then the steps written out.
import { computed } from 'vue'

import type { Breakdown, Segment } from '@/engine/levels'

const props = defineProps<{ breakdown: Breakdown }>()

/** --rainbow-N tokens for added pieces, in turn. Blue first: a red first piece reads as "wrong". */
const ADD_COLORS = [5, 2, 4, 6, 3, 1]
/** Segments narrower than this share of the bar are too thin for a label (the tooltip still has it). */
const LABEL_MIN_SHARE = 0.08

// A single piece adds nothing the steps don't say, and a lone slice on an empty track read as a
// score. So the bar only appears when pieces combine, and it is always filled edge to edge.
const showBar = computed(() => props.breakdown.segments.length > 1)
const extent = computed(() => Math.max(...props.breakdown.segments.map((s) => s.to)))
const pos = (pct: number) => `${(pct / extent.value) * 100}%`

function fill(seg: Segment, i: number): string {
  if (seg.kind === 'base') return 'rgb(var(--palette-line))'
  if (seg.kind === 'remove')
    return 'repeating-linear-gradient(135deg, rgb(var(--palette-ink) / 0.3) 0 4px, rgb(var(--palette-ink) / 0.08) 4px 8px)'
  const adds = props.breakdown.segments
    .slice(0, i)
    .filter((s) => s.kind === 'add' || s.kind === 'part')
  return `rgb(var(--rainbow-${ADD_COLORS[adds.length % ADD_COLORS.length]}))`
}

// Steps line up with the coloured pieces one to one in most levels; give each its piece's
// colour then, so the bar and the written steps read as the same thing.
const swatches = computed(() => {
  const { segments, steps } = props.breakdown
  const coloured = segments.flatMap((s, i) => (s.kind === 'base' ? [] : [fill(s, i)]))
  return showBar.value && coloured.length === steps.length ? coloured : []
})
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="showBar"
      class="well relative h-10 overflow-hidden rounded-lg"
      role="img"
      :aria-label="breakdown.segments.map((s) => s.label).join(', ')"
    >
      <div
        v-for="(seg, i) in breakdown.segments"
        :key="i"
        class="absolute inset-y-0 flex animate-fade items-center justify-center overflow-hidden border-r border-panel text-xs font-semibold whitespace-nowrap text-ink last:border-r-0"
        :style="{
          left: pos(seg.from),
          width: pos(seg.to - seg.from),
          background: fill(seg, i),
          animationDelay: `${i * 250}ms`,
        }"
        :class="{ 'justify-start! pl-2': seg.kind === 'base' }"
        :title="seg.label"
      >
        <span v-if="(seg.to - seg.from) / extent >= LABEL_MIN_SHARE" class="px-1">{{
          seg.label
        }}</span>
      </div>
    </div>

    <ol class="space-y-1 font-mono text-sm text-ink-muted">
      <li v-for="(step, i) in breakdown.steps" :key="i" class="flex items-baseline gap-2">
        <span
          v-if="swatches[i]"
          class="size-2.5 shrink-0 rounded-sm"
          :style="{ background: swatches[i] }"
          aria-hidden="true"
        />
        {{ step }}
      </li>
    </ol>
    <p class="font-mono text-base font-semibold">{{ breakdown.result }}</p>
  </div>
</template>
