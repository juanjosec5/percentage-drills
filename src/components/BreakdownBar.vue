<script setup lang="ts">
// Draws a problem's breakdown: a bar standing for the whole (100%), with each piece of the
// calculation laid on it in turn, then the steps written out.
import { onMounted, ref } from 'vue'

import { fmt } from '@/engine/math'
import type { Breakdown, Segment } from '@/engine/levels'

const props = defineProps<{ breakdown: Breakdown }>()

// Segments grow in one after another once mounted.
const shown = ref(false)
onMounted(() => requestAnimationFrame(() => (shown.value = true)))

const pos = (pct: number) => `${(pct / props.breakdown.scale) * 100}%`

/** Number of --rainbow-N colour tokens in style.css. */
const RAINBOW = 6
/** Segments narrower than this share of the bar are too thin for a label (the tooltip still has it). */
const LABEL_MIN_SHARE = 0.08

function fill(seg: Segment, i: number): string {
  if (seg.kind === 'base') return 'rgb(var(--palette-line))'
  if (seg.kind === 'remove')
    return 'repeating-linear-gradient(135deg, rgb(var(--palette-ink) / 0.3) 0 4px, rgb(var(--palette-ink) / 0.08) 4px 8px)'
  // Each added piece takes the next colour of the rainbow.
  const adds = props.breakdown.segments
    .slice(0, i)
    .filter((s) => s.kind === 'add' || s.kind === 'part')
  return `rgb(var(--rainbow-${(adds.length % RAINBOW) + 1}))`
}

const ticks = Array.from({ length: Math.floor(props.breakdown.scale / 10) + 1 }, (_, i) => i * 10)
</script>

<template>
  <div class="space-y-4">
    <div>
      <div class="well relative h-10 overflow-hidden rounded-lg">
        <div
          v-for="t in ticks"
          :key="t"
          class="absolute inset-y-0 w-px bg-line"
          :style="{ left: pos(t) }"
        />
        <div
          v-for="(seg, i) in breakdown.segments"
          :key="i"
          class="absolute inset-y-0 flex items-center justify-center overflow-hidden text-xs font-semibold whitespace-nowrap text-ink transition-all duration-500 ease-out"
          :style="{
            left: pos(seg.from),
            width: shown ? pos(seg.to - seg.from) : '0%',
            minWidth: shown ? '3px' : '0',
            background: fill(seg, i),
            transitionDelay: `${i * 350}ms`,
          }"
          :title="seg.label"
        >
          <span v-if="(seg.to - seg.from) / breakdown.scale >= LABEL_MIN_SHARE" class="px-1">{{
            seg.label
          }}</span>
        </div>
      </div>
      <div class="relative mt-1 h-4 font-mono text-[11px] text-ink-muted">
        <span class="absolute left-0">0</span>
        <span class="absolute -translate-x-full whitespace-nowrap" :style="{ left: pos(100) }"
          >{{ fmt(breakdown.base) }} = 100%</span
        >
        <span v-if="breakdown.scale > 100" class="absolute right-0">{{ breakdown.scale }}%</span>
      </div>
    </div>

    <ol class="space-y-1 font-mono text-sm text-ink-muted">
      <li v-for="(step, i) in breakdown.steps" :key="i">{{ step }}</li>
    </ol>
    <p class="font-mono text-base font-semibold">{{ breakdown.result }}</p>
  </div>
</template>
