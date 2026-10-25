<script setup lang="ts">
// Plip, the mascot: a drop of the violet liquid from the Start glass. It only reacts (no speech, no
// text), so it's always decorative and hidden from screen readers. Every animation plays a few
// times and stops: nothing here moves for longer than 5s.
import { computed } from 'vue'

export type Mood = 'idle' | 'happy' | 'oops' | 'cheer' | 'sleep'
/** Eyes set from outside (PlipAlive's reactions), instead of the mood's. */
export type Eyes = 'open' | 'shut' | 'wide' | 'blink'

const props = withDefaults(
  defineProps<{
    mood?: Mood
    size?: number
    eyes?: Eyes
    /** A transform for the eyes alone, e.g. to keep them round while the body squashes. */
    eyeStyle?: string
  }>(),
  { mood: 'idle', size: 40, eyes: undefined, eyeStyle: undefined },
)
/** Eye radii for the free eyes: wide when startled, a sliver mid-blink. */
const eyeR = computed(() => ({
  rx: props.eyes === 'wide' ? 4.5 : 3.5,
  ry: props.eyes === 'blink' ? 0.8 : props.eyes === 'wide' ? 6.5 : 5,
}))
</script>

<template>
  <svg
    class="drop shrink-0 overflow-visible"
    :class="`drop-${mood}`"
    :width="size"
    :height="size * 1.125"
    viewBox="0 0 64 72"
    aria-hidden="true"
  >
    <g class="drop-body">
      <path d="M32 3C32 3 8 33 8 46a24 24 0 0 0 48 0C56 33 32 3 32 3Z" class="fill-cta" />
      <ellipse
        cx="21"
        cy="40"
        rx="5"
        ry="8"
        fill="white"
        opacity="0.35"
        transform="rotate(20 21 40)"
      />
      <!-- Eyes driven from outside: open, squeezed shut (^ ^), wide, or mid-blink. -->
      <g v-if="eyes" class="drop-eyes-free" :style="eyeStyle">
        <path
          v-if="eyes === 'shut'"
          d="M21 50l4-5 4 5M35 50l4-5 4 5"
          class="fill-none stroke-ink"
          stroke-width="3.5"
          stroke-linecap="round"
        />
        <g v-else class="fill-ink">
          <ellipse cx="25" cy="47" v-bind="eyeR" />
          <ellipse cx="39" cy="47" v-bind="eyeR" />
        </g>
      </g>
      <g v-else class="fill-none stroke-ink" stroke-width="3.5" stroke-linecap="round">
        <!-- Happy and cheering: ^ ^ eyes. -->
        <template v-if="mood === 'happy' || mood === 'cheer'">
          <path d="M21 50l4-5 4 5M35 50l4-5 4 5" />
        </template>
        <!-- Oops: squinting, a little crooked. -->
        <template v-else-if="mood === 'oops'">
          <path d="M21 46l7 3M43 46l-7 3" />
        </template>
        <!-- Asleep: closed, curving down. -->
        <template v-else-if="mood === 'sleep'">
          <path d="M21 48q4 3 8 0M35 48q4 3 8 0" />
        </template>
      </g>
      <g v-if="!eyes && mood === 'idle'" class="drop-eyes fill-ink">
        <ellipse cx="25" cy="47" rx="3.5" ry="5" />
        <ellipse cx="39" cy="47" rx="3.5" ry="5" />
      </g>
    </g>
    <!-- Splash droplets for a celebration. -->
    <g v-if="mood === 'cheer'" class="drop-splash fill-cta">
      <circle cx="6" cy="20" r="3" />
      <circle cx="58" cy="18" r="3.5" />
      <circle cx="14" cy="6" r="2" />
      <circle cx="52" cy="4" r="2" />
    </g>
  </svg>
</template>

<style scoped>
.drop-body,
.drop-eyes {
  transform-box: fill-box;
  transform-origin: 50% 100%;
}
.drop-idle .drop-body {
  animation: drop-bob 2.4s ease-in-out 2;
}
.drop-idle .drop-eyes {
  transform-origin: 50% 50%;
  animation: drop-blink 2.4s 0.8s 2;
}
.drop-happy .drop-body {
  animation: drop-hop 0.6s cubic-bezier(0.3, 1.4, 0.5, 1);
}
.drop-oops .drop-body {
  animation: drop-droop 0.7s ease-out both;
}
.drop-cheer .drop-body {
  animation: drop-hop 0.6s cubic-bezier(0.3, 1.4, 0.5, 1) 3;
}
.drop-splash {
  transform-box: fill-box;
  transform-origin: 50% 50%;
  animation: drop-splash 0.9s ease-out both;
}
.drop-eyes-free {
  transform-box: fill-box;
  transform-origin: 50% 50%;
}
.drop-sleep .drop-body {
  transform: scaleY(0.94);
}

@keyframes drop-bob {
  50% {
    transform: translateY(-3px);
  }
}
@keyframes drop-blink {
  0%,
  90%,
  100% {
    transform: scaleY(1);
  }
  95% {
    transform: scaleY(0.1);
  }
}
@keyframes drop-hop {
  0% {
    transform: scale(1.1, 0.88);
  }
  45% {
    transform: translateY(-10px) scale(0.94, 1.06);
  }
  80% {
    transform: scale(1.04, 0.96);
  }
}
@keyframes drop-droop {
  to {
    transform: scale(1.06, 0.9) rotate(-6deg);
  }
}
@keyframes drop-splash {
  from {
    opacity: 0;
    transform: scale(0.4);
  }
  40% {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: scale(1.3);
  }
}
</style>
