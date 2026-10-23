<script setup lang="ts">
// The levels as a winding road through three worlds, so the order is something you can see:
// finished stretches are violet, the current node pulses, and what's ahead stays grey. Rows have
// fixed heights, so the road behind the nodes is drawn from the same numbers as the layout.
import { computed } from 'vue'

import MascotDrop from './MascotDrop.vue'
import MasteryMeter from './MasteryMeter.vue'
import { useI18n } from '@/composables/useI18n'
import { LEVELS } from '@/engine/levels'
import { WORLDS, worldOf } from '@/engine/worlds'
import { useProgress } from '@/stores/progress'

const props = defineProps<{
  /** The level that just opened: its node pops and the stretch leading to it fades in. */
  justOpened: number | null
}>()
const emit = defineEmits<{ start: [level: number] }>()
const { t } = useI18n()
const progress = useProgress()

/** Row heights in px: a node, a world heading above a world's first node, the current node's label. */
const ROW = 88
const HEADING = 52
const LABEL = 44
/** Horizontal swing of the road, in % of the width either side of the centre. */
const SWING = 22

const isMastered = (i: number) => i < progress.unlocked || progress.allMastered
const isCurrent = (i: number) => i === progress.unlocked && !progress.allMastered
const startsWorld = (i: number) => WORLDS.some((w) => w.from === i)
const worldLocked = (i: number) => WORLDS[worldOf(i)].from > progress.unlocked

/** Each node's centre: x in % of the width, y in px from the top. */
const nodes = computed(() => {
  let y = 0
  return LEVELS.map((_, i) => {
    if (startsWorld(i)) y += HEADING
    const node = { x: 50 + SWING * Math.sin((i * Math.PI) / 2), y: y + ROW / 2 }
    y += ROW + (isCurrent(i) ? LABEL : 0)
    return node
  })
})
const height = computed(() => {
  const last = nodes.value.at(-1)!
  return last.y + ROW / 2 + (isCurrent(LEVELS.length - 1) ? LABEL : 0)
})

/** An S-bend from node i − 1 to node i. */
function segment(i: number): string {
  const a = nodes.value[i - 1]
  const b = nodes.value[i]
  const mid = (a.y + b.y) / 2
  return `M ${a.x} ${a.y} C ${a.x} ${mid} ${b.x} ${mid} ${b.x} ${b.y}`
}
</script>

<template>
  <div class="relative" :style="{ height: `${height}px` }">
    <svg
      class="absolute inset-0 h-full w-full"
      :viewBox="`0 0 100 ${height}`"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        v-for="i in LEVELS.length - 1"
        :key="i"
        :d="segment(i)"
        fill="none"
        stroke-width="7"
        stroke-linecap="round"
        vector-effect="non-scaling-stroke"
        :class="[
          i <= progress.unlocked ? 'stroke-cta' : 'stroke-line',
          { 'animate-fade [animation-delay:1.1s]': i === props.justOpened },
        ]"
      />
    </svg>

    <ol class="relative" :aria-label="t('home.levels')">
      <li
        v-for="(level, i) in LEVELS"
        :key="level.id"
        :style="{
          height: `${ROW + (isCurrent(i) ? LABEL : 0) + (startsWorld(i) ? HEADING : 0)}px`,
        }"
      >
        <p
          v-if="startsWorld(i)"
          class="relative flex h-9 items-center justify-center gap-2 rounded-full text-sm font-semibold tracking-wide uppercase"
          :class="{
            'bg-[color-mix(in_srgb,rgb(var(--rainbow-4))_16%,rgb(var(--palette-ground)))]':
              worldOf(i) === 0,
            'bg-[color-mix(in_srgb,rgb(var(--rainbow-5))_18%,rgb(var(--palette-ground)))]':
              worldOf(i) === 1,
            'bg-[color-mix(in_srgb,rgb(var(--rainbow-6))_18%,rgb(var(--palette-ground)))]':
              worldOf(i) === 2,
            'opacity-60': worldLocked(i),
          }"
        >
          {{ t(`world.${WORLDS[worldOf(i)].id}`) }}
          <span v-if="worldLocked(i)" aria-hidden="true">🔒</span>
        </p>

        <div
          class="absolute -translate-x-1/2"
          :style="{ left: `${nodes[i].x}%`, top: `${nodes[i].y - 32}px` }"
        >
          <button
            class="relative flex size-16 items-center justify-center rounded-full border-4 font-mono text-lg font-bold shadow-soft transition-transform outline-offset-4 enabled:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-cta disabled:shadow-none"
            :class="[
              isCurrent(i)
                ? 'animate-ring border-cta bg-panel text-cta'
                : !isMastered(i)
                  ? 'border-line bg-ground text-ink-muted/70'
                  : progress.isPlaced(i)
                    ? 'border-cta/50 bg-panel text-cta'
                    : 'border-cta bg-cta text-white',
              { 'animate-pop': i === props.justOpened || i === (props.justOpened ?? 0) - 1 },
            ]"
            :disabled="i > progress.unlocked"
            @click="emit('start', i)"
          >
            <span aria-hidden="true">{{ t(level.short) }}</span>
            <span class="sr-only">{{ t('drill.level', { n: i + 1 }) }} · {{ t(level.title) }}</span>
            <span
              v-if="isMastered(i) && progress.isPlaced(i)"
              role="img"
              :aria-label="t('home.placed')"
              class="absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full border-2 border-star bg-panel text-xs text-ink-muted"
              >☆</span
            >
            <span
              v-else-if="isMastered(i)"
              role="img"
              :aria-label="t('home.mastered')"
              class="absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full bg-star text-xs text-ink shadow-soft"
              >★</span
            >
            <span
              v-else-if="!isCurrent(i)"
              role="img"
              :aria-label="t('home.locked')"
              class="absolute -right-1 -bottom-1 text-xs"
              >🔒</span
            >
          </button>
          <!-- The mascot waits beside the current node, on the side facing the middle. -->
          <MascotDrop
            v-if="isCurrent(i)"
            :mood="i === props.justOpened ? 'cheer' : progress.dailyDone ? 'sleep' : 'idle'"
            class="absolute top-3"
            :class="nodes[i].x > 50 ? '-left-13' : '-right-13'"
          />
        </div>
        <!-- Its own centred row: under a node near the edge it would run off the screen. -->
        <div
          v-if="isCurrent(i)"
          class="absolute inset-x-0 mx-auto flex w-fit flex-col items-center gap-1.5 rounded-xl bg-ground px-3 py-1"
          :style="{ top: `${nodes[i].y + 38}px` }"
        >
          <span class="text-sm font-semibold">{{ t(level.title) }}</span>
          <MasteryMeter :level-index="i" hide-count />
        </div>
      </li>
    </ol>
  </div>
</template>
