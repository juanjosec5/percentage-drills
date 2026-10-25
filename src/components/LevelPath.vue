<script lang="ts">
// Module scope, shared by every mount: whether the locks have wobbled yet this visit.
const seen = { locks: false }
const PEEK_MS = 2000
</script>

<script setup lang="ts">
// The levels as a path: one straight rail down the left, a node per level, grouped by world.
// The current level's row holds the glass button (the #current slot), so where you are and what
// you press are the same thing. Each row draws its own two stretches of rail, so the line can't
// break between rows. Finished worlds fold to one line.
import { computed, onBeforeUnmount, ref } from 'vue'

import MascotDrop from './MascotDrop.vue'
import { useI18n } from '@/composables/useI18n'
import { LEVELS } from '@/engine/levels'
import { createRng } from '@/engine/rng'
import { WORLDS } from '@/engine/worlds'
import { useProgress } from '@/stores/progress'

const props = defineProps<{
  /** The level that just opened: its row and the ★ before it pop in. */
  justOpened: number | null
}>()
const emit = defineEmits<{ start: [level: number] }>()
const { t } = useI18n()
const progress = useProgress()

const isMastered = (i: number) => i < progress.unlocked || progress.allMastered
/** The row holding the glass. Once everything is mastered it stays on the last level. */
const isCurrent = (i: number) => i === progress.unlocked
const worldDone = (w: number) =>
  WORLDS[w].to < progress.unlocked || (progress.allMastered && w === WORLDS.length - 1)
const reached = (w: number) => WORLDS[w].from <= progress.unlocked

/** Finished worlds the learner opened again. */
const unfolded = ref(new Set<number>())
const folded = (w: number) => worldDone(w) && !unfolded.value.has(w)
function toggle(w: number) {
  const next = new Set(unfolded.value)
  if (!next.delete(w)) next.add(w)
  unfolded.value = next
}

const levelsIn = (w: number) =>
  Array.from({ length: WORLDS[w].to - WORLDS[w].from + 1 }, (_, k) => WORLDS[w].from + k)
const doneIn = (w: number) => levelsIn(w).filter(isMastered).length

/** One fixed opening problem per level, so a locked row always shows the same taste of what's coming. */
const samples = computed(() =>
  LEVELS.map((level, i) => t(level.generate(createRng(i + 1), 0).prompt)),
)
/** The locked row being previewed after a tap. */
const peeking = ref<number | null>(null)
let peekTimer: ReturnType<typeof setTimeout> | undefined
function peek(i: number) {
  peeking.value = i
  clearTimeout(peekTimer)
  peekTimer = setTimeout(() => (peeking.value = null), PEEK_MS)
}
onBeforeUnmount(() => clearTimeout(peekTimer))
const showsSample = (i: number) => i === progress.unlocked + 1 || peeking.value === i

// The locks wobble once per visit to the app, the first time Home shows them: a hint that rows
// respond to a tap, without a word of copy.
const wobble = !seen.locks
seen.locks = true

const mascotMood = computed(() => (progress.dailyDone ? 'sleep' : 'idle'))
</script>

<template>
  <ol :aria-label="t('home.levels')">
    <template v-for="(world, w) in WORLDS" :key="world.id">
      <li class="band" :class="{ 'opacity-55': !reached(w) }">
        <button
          v-if="worldDone(w)"
          class="band-line text-ink"
          :aria-expanded="!folded(w)"
          @click="toggle(w)"
        >
          <span class="text-correct" aria-hidden="true">✓</span>
          {{ t(`world.${world.id}`) }}
          <span class="band-rule" />
          <span class="font-mono tracking-normal">
            ★ {{ doneIn(w) }}/{{ levelsIn(w).length }}
            <span aria-hidden="true">{{ folded(w) ? '▸' : '▾' }}</span>
          </span>
        </button>
        <p v-else class="band-line">
          {{ t(`world.${world.id}`) }}
          <span class="band-rule" />
          <span v-if="reached(w)" class="font-mono tracking-normal"
            >{{ doneIn(w) }}/{{ levelsIn(w).length }}</span
          >
          <span v-else role="img" :aria-label="t('home.locked')">🔒</span>
        </p>
      </li>

      <template v-if="reached(w) && !folded(w)">
        <li
          v-for="i in levelsIn(w)"
          :key="LEVELS[i].id"
          class="row"
          :class="{
            first: i === world.from,
            last: i === LEVELS.length - 1,
            'lit-in': i <= progress.unlocked && i !== world.from,
            'lit-out': isMastered(i) && i !== world.to,
            current: isCurrent(i),
            'animate-pop':
              props.justOpened !== null && (i === props.justOpened || i === props.justOpened - 1),
          }"
        >
          <template v-if="isCurrent(i)">
            <span class="node node-current" aria-hidden="true">
              <MascotDrop :mood="mascotMood" :size="40" />
            </span>
            <div class="min-w-0 flex-1 py-2">
              <slot name="current" />
            </div>
          </template>

          <button v-else-if="isMastered(i)" class="row-btn group" @click="emit('start', i)">
            <span
              class="node bg-star text-ink shadow-soft"
              role="img"
              :aria-label="t(progress.isPlaced(i) ? 'home.placed' : 'home.mastered')"
              >★</span
            >
            <span class="font-medium group-hover:underline group-hover:underline-offset-4">
              {{ t(LEVELS[i].title) }}
            </span>
            <span v-if="progress.isPlaced(i)" class="text-xs text-ink-muted" aria-hidden="true"
              >↷</span
            >
          </button>

          <button
            v-else
            class="row-btn locked group"
            :aria-label="`${t(LEVELS[i].title)}, ${t('home.locked')}`"
            @click="peek(i)"
          >
            <span class="node border-3 border-line bg-ground" aria-hidden="true" />
            <span class="flex min-w-0 flex-col" :class="{ wiggle: peeking === i }">
              <span class="font-medium text-ink-muted group-hover:text-ink">
                {{ t(LEVELS[i].title) }}
              </span>
              <span v-if="showsSample(i)" class="font-mono text-xs text-ink-muted">
                {{ samples[i] }}
              </span>
            </span>
            <span
              class="lock ml-auto text-xs"
              :class="{ peek: wobble, wiggle: peeking === i }"
              :style="{ animationDelay: `${(i % 4) * 70}ms` }"
              role="img"
              :aria-label="t('home.locked')"
              >🔒</span
            >
          </button>
        </li>
      </template>
    </template>
  </ol>
</template>

<style scoped>
/* The rail sits at x = 18px; nodes and the mascot centre on it. */
.band {
  padding: 0.75rem 0 0.25rem;
}
.band-line {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgb(var(--palette-ink-muted));
}
.band-rule {
  flex: 1;
  height: 1px;
  background: rgb(var(--palette-line));
}

.row {
  --node-y: 26px;
  position: relative;
  display: flex;
  min-height: 52px;
  align-items: center;
  padding-left: 44px;
}
.row.current {
  --node-y: 40px;
}
/* The two stretches of rail each row owns: above its node and below it. */
.row::before,
.row::after {
  content: '';
  position: absolute;
  left: 16px;
  width: 4px;
  background: rgb(var(--palette-line));
}
.row::before {
  top: 0;
  height: var(--node-y);
}
.row::after {
  top: var(--node-y);
  bottom: 0;
}
.row.lit-in::before,
.row.lit-out::after {
  background: rgb(var(--palette-cta));
}
.row.first::before,
.row.last::after {
  display: none;
}

.node {
  position: absolute;
  left: 4px;
  top: calc(var(--node-y) - 14px);
  z-index: 1;
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 9999px;
  font-size: 0.8125rem;
}
/* The mascot is the current node: its round body covers the rail. */
.node-current {
  left: -2px;
  top: calc(var(--node-y) - 26px);
  width: 40px;
  height: 45px;
}

.row-btn {
  display: flex;
  width: 100%;
  min-height: 52px;
  align-items: center;
  gap: 0.5rem;
  text-align: left;
  border-radius: 0.75rem;
}
.row-btn:focus-visible {
  outline: 2px solid rgb(var(--palette-cta));
  outline-offset: 2px;
}
.locked .lock {
  display: inline-block;
  transition: transform 0.2s;
}
.locked:hover .lock,
.locked:active .lock {
  transform: rotate(-18deg) translateY(-1px);
}
/* Only the words and the lock move: the node and the rail stay put. */
.wiggle {
  animation: wiggle 0.4s ease-in-out;
}
.peek {
  animation: peek 0.3s ease-in-out;
}
@keyframes wiggle {
  25% {
    transform: translateX(-4px);
  }
  75% {
    transform: translateX(4px);
  }
}
@keyframes peek {
  30% {
    transform: rotate(-14deg);
  }
  70% {
    transform: rotate(10deg);
  }
}
</style>
