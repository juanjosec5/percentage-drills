<script lang="ts">
// Module scope: the reactions a poke can play, and the timings that shape them.
type Reaction = 'squish' | 'hop' | 'spin' | 'giggle' | 'puddle'
const REACTIONS: Reaction[] = ['squish', 'hop', 'spin', 'giggle']
/** Pokes this close together, this many times, and Plip melts into a puddle. */
const PUDDLE_POKES = 5
const PUDDLE_WINDOW_MS = 2000
/** Taps closer than this read as poking jelly: each one squishes, building up to the puddle. */
const RAPID_MS = 400
/** Gravity for the hop, px/s² at Plip's 40px size. */
const GRAVITY = 1700
/** The glow and breath redraw at most this often when nothing else is moving. */
const IDLE_FRAME_MS = 1000 / 20
</script>

<script setup lang="ts">
// Plip on Home: alive and pokeable. A soft glow and breath that never quite repeat (three sines
// at unrelated speeds), the odd blink, and a jelly reaction to every tap — squash, hop, spin or
// giggle, never the same twice in a row; five quick taps melt it into a puddle that pulls itself
// back together. Springs drive the body (jelly.ts), so a new tap carries on from wherever the
// last one left it instead of snapping back. Pure play: no buzz, no reward.
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

import MascotDrop, { type Eyes, type Mood } from './MascotDrop.vue'
import { atRest, easeOutBack, spring, squashScale, step } from '@/composables/jelly'

withDefaults(defineProps<{ mood?: Mood; size?: number }>(), { mood: 'idle', size: 40 })

const still = matchMedia('(prefers-reduced-motion: reduce)').matches

// The body: squash (negative = flatter) and tilt are springs; lift is a hop under gravity; spin is
// a short tween with a little overshoot.
const squash = reactive(spring(380, 11))
const tilt = reactive(spring(520, 7))
const lift = reactive({ y: 0, v: 0, airborne: false })
const spin = reactive({ angle: 0, start: 0, ms: 0 })
const eyes = ref<Eyes>()
/** The reaction playing, for tests and for picking the next one. */
const reaction = ref<Reaction | ''>('')
/** 0..1, how bright the glow is right now. */
const glow = ref(0.5)
const breath = ref(1)

let timers: ReturnType<typeof setTimeout>[] = []
function later(ms: number, fn: () => void) {
  timers.push(setTimeout(fn, ms))
}
/** A new poke drops the old reaction's pending steps, but the body keeps its motion. */
function cancelPending() {
  timers.forEach(clearTimeout)
  timers = []
}

const pokes: number[] = []
let giggleSide = 1

function poke() {
  const now = performance.now()
  pokes.push(now)
  while (pokes.length && now - pokes[0] > PUDDLE_WINDOW_MS) pokes.shift()
  const rapid = pokes.length > 1 && now - pokes[pokes.length - 2] < RAPID_MS
  const next: Reaction =
    pokes.length >= PUDDLE_POKES
      ? 'puddle'
      : rapid
        ? 'squish'
        : pick(REACTIONS.filter((r) => r !== reaction.value))
  if (next === 'puddle') pokes.length = 0
  cancelPending()
  reaction.value = next
  if (still) {
    // Reduced motion: a tiny squash and a squint, no movement across the screen.
    squash.x = -0.08
    eyes.value = 'shut'
    later(140, () => (squash.x = 0))
    later(320, () => (eyes.value = undefined))
    return
  }
  PLAY[next]()
  wake()
}

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

// Each reaction: anticipation, then the action, then the springs' follow-through.
const PLAY: Record<Reaction, () => void> = {
  squish() {
    eyes.value = 'shut'
    squash.target = -0.32
    later(90, () => (squash.target = 0))
    later(650, () => (eyes.value = undefined))
  },
  hop() {
    eyes.value = 'wide'
    squash.target = -0.18
    later(80, () => {
      squash.target = 0.14
      lift.v = -320
      lift.airborne = true
    })
  },
  spin() {
    eyes.value = 'shut'
    squash.target = -0.14
    later(70, () => {
      squash.target = 0
      spin.start = performance.now()
      spin.ms = 560
    })
    later(760, () => (eyes.value = undefined))
  },
  giggle() {
    eyes.value = 'shut'
    giggleSide = -giggleSide
    tilt.v += 260 * giggleSide
    squash.v += 1.4
    later(140, () => (tilt.v -= 320 * giggleSide))
    later(300, () => (squash.v += 1))
    later(820, () => (eyes.value = undefined))
  },
  puddle() {
    // Upright first: a spin still going would tilt the puddle into a frisbee.
    spin.ms = 0
    spin.angle = 0
    // Rise a little, then melt flat with eyes wide; hold; pull back up past round and settle.
    eyes.value = 'wide'
    squash.target = 0.12
    later(70, () => {
      squash.target = -0.58
      eyes.value = 'blink'
    })
    later(260, () => (eyes.value = 'wide'))
    later(760, () => {
      squash.target = 0
      squash.v += 2.5
      eyes.value = 'shut'
    })
    later(1300, () => (eyes.value = undefined))
  },
}

// One loop for everything: full rate while the body moves, ~20fps when only the glow breathes.
let frame = 0
let last = 0
let lastDraw = 0
const moving = () =>
  !atRest(squash) || !atRest(tilt) || lift.airborne || spin.ms > 0 || lift.y !== 0

function tick(now: number) {
  frame = requestAnimationFrame(tick)
  const dt = Math.min((now - last) / 1000, 0.05)
  last = now
  const busy = moving()
  if (!busy && now - lastDraw < IDLE_FRAME_MS) return
  lastDraw = now
  if (busy) {
    step(squash, dt)
    step(tilt, dt)
    if (lift.airborne) {
      lift.v += GRAVITY * dt
      lift.y += lift.v * dt
      if (lift.y >= 0 && lift.v > 0) land()
    }
    if (spin.ms > 0) {
      const p = Math.min((now - spin.start) / spin.ms, 1)
      spin.angle = 360 * easeOutBack(p)
      if (p >= 1) {
        spin.ms = 0
        spin.angle = 0
      }
    }
  }
  // The glow and breath: three sines at unrelated speeds, so it never settles into a beat.
  const t = now / 1000
  glow.value =
    0.5 + 0.28 * Math.sin(t * 1.13) + 0.15 * Math.sin(t * 0.47 + 1.7) + 0.07 * Math.sin(t * 2.9)
  breath.value = 1 + 0.015 * Math.sin(t * 0.83 + 0.4 * Math.sin(t * 0.31))
}

function land() {
  lift.y = 0
  lift.v = 0
  lift.airborne = false
  // The landing squashes it, and the spring wobbles it back.
  squash.target = 0
  squash.v -= 3.8
  later(220, () => (eyes.value = undefined))
}

function wake() {
  if (!frame) {
    last = performance.now()
    frame = requestAnimationFrame(tick)
  }
}

// The odd blink, at uneven gaps, while nothing else is going on with the eyes.
let blinkTimer: ReturnType<typeof setTimeout> | undefined
function scheduleBlink() {
  blinkTimer = setTimeout(
    () => {
      if (!eyes.value) {
        eyes.value = 'blink'
        setTimeout(() => eyes.value === 'blink' && (eyes.value = undefined), 110)
      }
      scheduleBlink()
    },
    2400 + Math.random() * 4200,
  )
}

onMounted(() => {
  if (still) return
  wake()
  scheduleBlink()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  cancelPending()
  clearTimeout(blinkTimer)
})

const scale = computed(() => squashScale(squash.x))
// Spin wraps the squash, not the other way round: a rotation inside an uneven scale skews the
// shape, so the body squashes first and then turns as one rigid piece.
const spinStyle = computed(() => `transform: rotate(${spin.angle.toFixed(1)}deg)`)
const bodyStyle = computed(
  () =>
    `transform: translateY(${lift.y.toFixed(2)}px) rotate(${tilt.x.toFixed(2)}deg) ` +
    `scale(${scale.value.sx.toFixed(3)}, ${scale.value.sy.toFixed(3)})`,
)
const breathStyle = computed(() => `transform: scale(${breath.value.toFixed(4)})`)
const glowStyle = computed(() => {
  const g = still ? 0.5 : glow.value
  return (
    `filter: drop-shadow(0 0 ${(3 + 6 * g).toFixed(1)}px rgb(var(--palette-cta) / ${(0.18 + 0.32 * g).toFixed(2)})) ` +
    `brightness(${(1 + 0.08 * g).toFixed(3)})`
  )
})
/** Flat as a puddle, the eyes keep their own shape instead of squashing with the body. */
const eyeStyle = computed(() => {
  const { sx, sy } = scale.value
  return sy < 0.75 ? `transform: scale(${(1 / sx).toFixed(3)}, ${(1 / sy).toFixed(3)})` : undefined
})
</script>

<template>
  <span
    class="plip block cursor-pointer touch-manipulation select-none"
    :data-reaction="reaction"
    :style="glowStyle"
    @pointerdown="poke"
  >
    <span class="block origin-[50%_62%]" :style="spinStyle">
      <span class="block origin-bottom" :style="bodyStyle">
        <span class="block origin-bottom" :style="breathStyle">
          <MascotDrop :mood="mood" :size="size" :eyes="eyes" :eye-style="eyeStyle" />
        </span>
      </span>
    </span>
  </span>
</template>
