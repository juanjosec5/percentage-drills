<script setup lang="ts">
// Draws a problem's breakdown: for multi-step problems, a bar made of the pieces of the
// calculation, each with its value; then the steps written out.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import GroupedText from './GroupedText.vue'
import { useI18n } from '@/composables/useI18n'
import type { Breakdown, Segment } from '@/engine/levels'
import type { Msg } from '@/i18n'

const props = defineProps<{ breakdown: Breakdown }>()
const { locale, t } = useI18n()

/**
 * --rainbow-N tokens for added pieces, in turn. Blue first: a red first piece reads as "wrong".
 * Yellow between blue and green keeps neighbours apart for red/green colour-blind eyes.
 */
const ADD_COLORS = [5, 3, 4, 6, 2, 1]

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

/** The segment each step describes, when steps and coloured pieces line up one to one. */
const pieceOf = computed(() => {
  const { segments, steps } = props.breakdown
  const pieces = segments.flatMap((s, i) => (s.kind === 'base' ? [] : [i]))
  return showBar.value && pieces.length === steps.length ? pieces : []
})

// Labels are measured rather than guessed from the slice's share: "5% = 24" overflowed a 5%
// slice at 390px. A label that doesn't fit is hidden, and its step is written out in full.
const labelEls: (HTMLElement | null)[] = []
const clipped = ref(new Set<number>())
const barEl = ref<HTMLElement>()

function measure() {
  const next = new Set<number>()
  labelEls.forEach((label, i) => {
    const seg = label?.parentElement
    if (!label || !seg) return
    const room = seg.clientWidth - parseFloat(getComputedStyle(seg).paddingLeft)
    if (label.getBoundingClientRect().width > room + 0.5) next.add(i)
  })
  clipped.value = next
}

let observer: ResizeObserver | undefined
onMounted(() => {
  if (!barEl.value) return
  observer = new ResizeObserver(measure)
  observer.observe(barEl.value)
})
onBeforeUnmount(() => observer?.disconnect())
watch(locale, () => nextTick(measure))

// The bar label already says "30% = 144", so the step only adds the method ("10% × 3").
function stepText(step: Msg, i: number): string {
  const seg = pieceOf.value[i]
  const how = step.params?.how
  const short = step.key === 'step.pieceOf' && seg !== undefined && !clipped.value.has(seg)
  return short && how ? t(how as Msg) : t(step)
}

// One step and no bar: the result line would repeat the step.
const showResult = computed(() => showBar.value || props.breakdown.steps.length > 1)
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="showBar"
      ref="barEl"
      class="well relative h-10 overflow-hidden rounded-lg"
      role="img"
      :aria-label="breakdown.segments.map((s) => t(s.label)).join(', ')"
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
        :title="t(seg.label)"
      >
        <span
          :ref="(el) => (labelEls[i] = el as HTMLElement | null)"
          class="px-1"
          :class="{ invisible: clipped.has(i) }"
          ><GroupedText :text="t(seg.label)"
        /></span>
      </div>
    </div>

    <ol class="space-y-1 font-mono text-sm text-ink-muted">
      <li v-for="(step, i) in breakdown.steps" :key="i" class="flex items-baseline gap-2">
        <span
          v-if="pieceOf[i] !== undefined"
          class="size-2.5 shrink-0 rounded-sm"
          :style="{ background: fill(breakdown.segments[pieceOf[i]], pieceOf[i]) }"
          aria-hidden="true"
        />
        <GroupedText :text="stepText(step, i)" />
      </li>
    </ol>
    <p v-if="showResult" class="font-mono text-base font-semibold">
      <GroupedText :text="t(breakdown.result)" />
    </p>
  </div>
</template>
