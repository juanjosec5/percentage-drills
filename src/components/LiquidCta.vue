<script setup lang="ts">
// The main Start button as a glass tube that today's progress fills with violet liquid. The
// level rises from wherever it was last shown, so coming home after a problem shows it filling.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  /** Today's progress, 0..1. */
  fill: number
  label: string
  /** Read by screen readers instead of the percentage. */
  progressLabel: string
}>()
defineEmits<{ click: [] }>()

const buttonEl = ref<HTMLButtonElement>()
defineExpose({ focus: () => buttonEl.value?.focus() })

// Temporary: a picker to compare bubble styles while the owner chooses one. Remove with it.
const BUBBLES_KEY = 'percent-drills:debug-bubbles'
const showPicker = import.meta.env.DEV || new URLSearchParams(location.search).has('debug')
const bubbles = ref<Bubbles>(readBubbles())
function readBubbles(): Bubbles {
  try {
    const v = localStorage.getItem(BUBBLES_KEY)
    if (v === 'none' || v === 'few' || v === 'lively') return v
  } catch {
    // Storage blocked: use the default.
  }
  return 'few'
}
watch(bubbles, (v) => {
  try {
    localStorage.setItem(BUBBLES_KEY, v)
  } catch {
    // Storage blocked: the choice lasts this visit.
  }
})

/** [left %, size px, delay s] per bubble; fixed so the pattern doesn't jump between renders. */
const BUBBLE_SETS: Record<Bubbles, { spots: [number, number, number][]; seconds: number }> = {
  none: { spots: [], seconds: 0 },
  few: {
    spots: [
      [18, 4, 0],
      [42, 3, 2.1],
      [66, 5, 3.6],
      [84, 3, 1.2],
    ],
    seconds: 6,
  },
  lively: {
    spots: [
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
    ],
    seconds: 3,
  },
}
const bubbleSet = computed(() => BUBBLE_SETS[bubbles.value])

// The level on screen, tweened toward `fill`. It starts where Home last left it, so coming back
// after a problem shows the liquid rising (10% → 20%), and from 0 on the first visit.
const level = ref(lastShown.fill)
/** The wave rolls faster while the liquid is rising. */
const filling = ref(false)
const FILL_MS = 1600
let frame = 0

function rise(to: number) {
  cancelAnimationFrame(frame)
  lastShown.fill = to
  const from = level.value
  if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    level.value = to
    return
  }
  filling.value = true
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min((now - start) / FILL_MS, 1)
    level.value = from + (to - from) * (1 - (1 - t) ** 3) // ease-out
    if (t < 1) frame = requestAnimationFrame(step)
    else filling.value = false
  }
  frame = requestAnimationFrame(step)
}

onMounted(() => rise(props.fill))
watch(() => props.fill, rise)
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<script lang="ts">
type Bubbles = 'none' | 'few' | 'lively'
// Module scope, shared by every mount: where the liquid stood when Home was last left.
const lastShown = { fill: 0 }
</script>

<template>
  <div>
    <button
      ref="buttonEl"
      class="btn-cta group relative flex h-36 w-full flex-col items-start justify-between p-4 overflow-hidden border-2 border-cta/35 bg-white/45 text-left backdrop-blur-sm"
      @click="$emit('click')"
    >
      <!-- The liquid; its front edge is a wave that keeps rolling. -->
      <span class="absolute inset-y-0 left-0 bg-cta" :style="{ width: `${level * 100}%` }">
        <span
          v-for="([left, size, delay], i) in bubbleSet.spots"
          :key="`${bubbles}-${i}`"
          class="absolute bottom-0 animate-bubble rounded-full bg-white/50"
          :style="{
            left: `${left}%`,
            width: `${size}px`,
            height: `${size}px`,
            animationDuration: `${bubbleSet.seconds}s`,
            animationDelay: `${delay}s`,
          }"
          aria-hidden="true"
        />
      </span>
      <span
        v-if="level > 0 && level < 1"
        class="liquid-edge absolute inset-y-0 w-3"
        :class="filling ? 'animate-wave-fast' : 'animate-wave'"
        :style="{ left: `${level * 100}%` }"
        aria-hidden="true"
      />
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
      <span
        class="relative pl-1 font-mono text-lg font-bold tabular-nums"
        :class="level >= 0.15 ? 'text-white' : 'text-cta'"
        aria-hidden="true"
      >
        {{ Math.round(level * 100) }}%<template v-if="level >= 1"> ✓</template>
      </span>
      <span class="sr-only">{{ progressLabel }}</span>
    </button>

    <div
      v-if="showPicker"
      class="mt-2 flex gap-3 text-xs text-ink-muted"
      role="radiogroup"
      aria-label="Bubbles (debug)"
    >
      <span>Bubbles (debug):</span>
      <label v-for="b in ['none', 'few', 'lively'] as const" :key="b" class="flex gap-1">
        <input v-model="bubbles" type="radio" name="bubbles" :value="b" />
        {{ b }}
      </label>
    </div>
  </div>
</template>
