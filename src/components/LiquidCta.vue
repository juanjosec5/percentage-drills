<script setup lang="ts">
// The main Start button as a glass tube that fills with violet liquid as the current level nears
// mastery. The surface is drawn every frame from out-of-step waves, so it never visibly repeats.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  /** Progress toward finishing the current level, 0..1. */
  fill: number
  /** The level being filled; when it goes up, the glass fills to the top, then starts over. */
  levelKey: number
  label: string
  /** Read by screen readers instead of the percentage. */
  progressLabel: string
}>()
defineEmits<{ click: [] }>()

const buttonEl = ref<HTMLButtonElement>()
defineExpose({ focus: () => buttonEl.value?.focus() })

/** [left %, size px, delay s] per bubble; fixed so the pattern doesn't jump between renders. */
const BUBBLES: [number, number, number][] = [
  [8, 3, 0],
  [16, 5, 0.9],
  [25, 3, 1.7],
  [33, 4, 0.4],
  [41, 6, 2.2],
  [50, 3, 1.1],
  [58, 4, 2.8],
  [66, 5, 0.6],
  [74, 3, 1.9],
  [82, 4, 2.5],
  [89, 3, 0.2],
  [94, 5, 1.4],
]

// The level on screen. It starts where Home last left it, so coming back after a problem shows
// the liquid rising, and from 0 on the first visit.
const level = ref(lastShown.fill)
const backEl = ref<SVGPathElement>()
const frontEl = ref<SVGPathElement>()
const still = matchMedia('(prefers-reduced-motion: reduce)').matches

/** viewBox units: the tube is W wide and H tall, stretched to the button. */
const W = 1000
const H = 100

/** The liquid's outline: a front edge built from three sines at unrelated speeds. */
function surface(fill: number, t: number, stir: number, phase: number): string {
  if (fill <= 0) return ''
  if (fill >= 1) return `M0 0H${W}V${H}H0Z`
  const amp = (18 + 9 * Math.sin(t * 0.37 + phase)) * stir
  let d = 'M0 0'
  for (let y = 0; y <= H; y += 4) {
    const x =
      fill * W +
      amp *
        (0.6 * Math.sin(y * 0.11 + t * 1.3 + phase) +
          0.9 * Math.sin(y * 0.047 - t * 0.8 + phase * 2) +
          0.3 * Math.sin(y * 0.23 + t * 2.1))
    d += `L${x.toFixed(1)} ${y}`
  }
  return `${d}L0 ${H}Z`
}

/** A rise in progress: from, to, start time, length. */
let pour: { from: number; to: number; start: number; ms: number; then?: () => void } | null = null
let frame = 0

/** The surface is redrawn at most 30 times a second: smooth enough, and half the work on phones. */
const FRAME_MS = 1000 / 30
let lastDraw = -Infinity

function draw(now: number) {
  if (!still) frame = requestAnimationFrame(draw)
  if (now - lastDraw < FRAME_MS) return
  lastDraw = now
  const t = now / 1000
  let stir = 1
  if (pour) {
    const p = Math.min((now - pour.start) / pour.ms, 1)
    // Ease out with a couple of surges, so it pours in glugs rather than sliding.
    const glug = 0.04 * Math.sin(p * Math.PI * 4) * (1 - p)
    level.value = pour.from + (pour.to - pour.from) * (1 - (1 - p) ** 3 + glug)
    stir = 1 + 1.6 * (1 - p)
    if (p >= 1) {
      level.value = pour.to
      const then = pour.then
      pour = null
      then?.()
    }
  }
  backEl.value?.setAttribute('d', surface(Math.min(level.value + 0.02, 1), t, stir, 2.1))
  frontEl.value?.setAttribute('d', surface(level.value, t, stir, 0))
}

function pourTo(to: number, then?: () => void) {
  pour = {
    from: level.value,
    to,
    start: performance.now(),
    ms: 900 + 1400 * Math.abs(to - level.value),
    then,
  }
}

function rise(fill: number, key: number) {
  // -1 means nothing shown yet this visit: a first load is not a level-up.
  const levelledUp = lastShown.key >= 0 && key > lastShown.key
  lastShown.fill = fill
  lastShown.key = key
  if (still) {
    level.value = fill
    lastDraw = -Infinity
    draw(0)
  } else if (levelledUp) {
    pourTo(1, () => {
      level.value = 0
      pourTo(fill)
    })
  } else pourTo(fill)
}

onMounted(() => {
  if (!still) frame = requestAnimationFrame(draw)
  rise(props.fill, props.levelKey)
})
watch(
  () => [props.fill, props.levelKey] as const,
  ([fill, key]) => rise(fill, key),
)
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<script lang="ts">
// Module scope, shared by every mount: where the liquid stood when Home was last left.
const lastShown = { fill: 0, key: -1 }
</script>

<template>
  <button
    ref="buttonEl"
    class="btn-cta group relative flex h-36 w-full flex-col items-start justify-between p-4 overflow-hidden border-2 border-cta/35 bg-white/45 text-left"
    @click="$emit('click')"
  >
    <svg
      class="absolute inset-0 h-full w-full"
      :viewBox="`0 0 ${W} ${H}`"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path ref="backEl" class="fill-cta/40" />
      <path ref="frontEl" class="fill-cta" />
    </svg>
    <span
      class="absolute inset-y-0 left-0 overflow-hidden"
      :style="{ width: `${level * 100}%` }"
      aria-hidden="true"
    >
      <span
        v-for="([left, size, delay], i) in BUBBLES"
        :key="i"
        class="absolute bottom-0 animate-bubble rounded-full bg-white/50"
        :style="{
          left: `${left}%`,
          width: `${size}px`,
          height: `${size}px`,
          animationDelay: `${delay}s`,
        }"
      />
    </span>
    <!-- Glass sheen over everything, so the tube reads as glass, not a flat box. -->
    <span
      class="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-white/45 to-transparent"
      aria-hidden="true"
    />

    <span
      class="relative inline-flex items-center gap-2 rounded-xl bg-panel/90 px-4 py-2 text-2xl font-bold text-cta shadow-soft sm:text-3xl"
    >
      {{ label }}
      <span class="inline-block transition-transform group-hover:translate-x-1">→</span>
    </span>
    <!-- An empty glass shows no number: "0%" in a percentages app reads like a failing score. -->
    <span
      v-if="Math.round(level * 100) > 0"
      class="relative pl-1 font-mono text-lg font-bold tabular-nums"
      :class="level >= 0.15 ? 'text-white' : 'text-cta'"
      aria-hidden="true"
    >
      {{ Math.round(level * 100) }}%<template v-if="level >= 1"> ✓</template>
    </span>
    <span class="sr-only">{{ progressLabel }}</span>
  </button>
</template>
