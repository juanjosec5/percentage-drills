<script lang="ts">
// Module scope, shared by every mount: whether the locks have wobbled yet this visit.
const seen = { locks: false }
const PEEK_MS = 2000
/** The level-up moment: the burst plays this long before the hop; the hop itself; and the most
 * the pour may take before the moment moves on anyway. */
const BURST_MS = 550
const HOP_MS = 600
const POUR_MAX_MS = 3500
/** The mascot's box is 45px tall; its round body centres 26px below its top. */
const BODY_Y = 26
</script>

<script setup lang="ts">
// The levels as a path: one straight rail down the left, a node per level, grouped by world.
// The current level's row holds the glass button (the #current slot), so where you are and what
// you press are the same thing. Each row draws its own two stretches of rail, so the line can't
// break between rows. Finished worlds fold to one line.
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import BurstRing from './BurstRing.vue'
import MascotDrop from './MascotDrop.vue'
import { useI18n } from '@/composables/useI18n'
import { LEVELS } from '@/engine/levels'
import { createRng } from '@/engine/rng'
import { WORLDS, worldOf } from '@/engine/worlds'
import { useProgress } from '@/stores/progress'

const props = defineProps<{
  /** The level just finished, when Home opens straight after a level-up: plays the moment. */
  levelUp: number | null
}>()
const emit = defineEmits<{ start: [level: number]; settled: [] }>()
const { t } = useI18n()
const progress = useProgress()

// The level-up moment, in phases. 'pour': the glass fills to the top on the finished row.
// 'burst': that row turns into a ★ with a burst. 'hop': the drop hops down the rail to the next
// level, whose glass is laid out (hidden) before the hop, so the landing spot never moves.
// Any tap or key skips to the end; with reduced motion there is no moment at all.
type Phase = 'pour' | 'burst' | 'hop' | null
const still = matchMedia('(prefers-reduced-motion: reduce)').matches
const phase = ref<Phase>(props.levelUp !== null && !still ? 'pour' : null)
const from = props.levelUp ?? -1

/** The row holding the glass: the finished level while it pours, then the new current level. */
const cardRow = computed(() =>
  phase.value === 'pour' ? from : phase.value === 'burst' ? -1 : progress.unlocked,
)
const isCurrent = (i: number) => i === cardRow.value
const isMastered = (i: number) =>
  (i < progress.unlocked || progress.allMastered) && !(phase.value === 'pour' && i === from)
/** The rail lags during the moment: the stretch into the new level is drawn as the drop hops. */
const litUpTo = computed(() => (phase.value ? from : progress.unlocked))
const worldDone = (w: number) =>
  WORLDS[w].to < progress.unlocked || (progress.allMastered && w === WORLDS.length - 1)
const reached = (w: number) => WORLDS[w].from <= progress.unlocked

/** Finished worlds the learner opened again. */
const unfolded = ref(new Set<number>())
// The finished level's world stays open during the moment, so the hop starts from a real row.
const folded = (w: number) =>
  worldDone(w) && !unfolded.value.has(w) && !(phase.value && worldOf(from) === w)
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

// The flying mascot and the rail that fills behind it, positioned from the rendered rows.
const rows = new Map<number, HTMLElement>()
const rowRef = (i: number) => (el: unknown) => {
  if (el) rows.set(i, el as HTMLElement)
  else rows.delete(i)
}
const nodeY = (i: number) => {
  const li = rows.get(i)!
  return li.offsetTop + parseFloat(getComputedStyle(li).getPropertyValue('--node-y'))
}
const flyerEl = ref<HTMLElement>()
const flyerTop = ref<number | null>(null)
const railFill = ref<{ top: number; height: number } | null>(null)
/** The new glass has landed: it pops in. */
const arrived = ref(false)

let timer: ReturnType<typeof setTimeout> | undefined
let hopAnim: Animation | undefined

/** The glass reached the top (or took too long): burst, then hop. */
function onFull() {
  if (phase.value !== 'pour') return
  clearTimeout(timer)
  phase.value = 'burst'
  nextTick(() => (flyerTop.value = nodeY(from) - BODY_Y))
  timer = setTimeout(hop, BURST_MS)
}

async function hop() {
  phase.value = 'hop'
  await nextTick()
  const a = nodeY(from)
  const b = nodeY(progress.unlocked)
  flyerTop.value = a - BODY_Y
  // Across a world's border there's no rail between the rows to fill.
  if (worldOf(from) === worldOf(progress.unlocked)) railFill.value = { top: a, height: b - a }
  await nextTick()
  const dy = b - a
  hopAnim = flyerEl.value?.animate(
    [
      { transform: 'translateY(0) scale(1.15, 0.85)' },
      { transform: `translateY(${dy / 2 - 34}px) scale(0.92, 1.1)`, offset: 0.45 },
      { transform: `translateY(${dy}px) scale(1.12, 0.88)`, offset: 0.85 },
      { transform: `translateY(${dy}px)` },
    ],
    { duration: HOP_MS, easing: 'ease-in-out' },
  )
  if (hopAnim) hopAnim.onfinish = settle
  else settle()
}

/** Any tap or key during the moment skips to its end. */
function skipOnInput(on: boolean) {
  const toggle = on ? addEventListener : removeEventListener
  toggle('pointerdown', settle, true)
  toggle('keydown', settle, true)
}

function settle() {
  if (phase.value === null) return
  clearTimeout(timer)
  hopAnim?.cancel()
  phase.value = null
  flyerTop.value = null
  railFill.value = null
  arrived.value = true
  skipOnInput(false)
  emit('settled')
}

onMounted(() => {
  if (!phase.value) return
  timer = setTimeout(onFull, POUR_MAX_MS)
  skipOnInput(true)
})
onBeforeUnmount(() => {
  clearTimeout(timer)
  hopAnim?.cancel()
  skipOnInput(false)
})
</script>

<template>
  <ol class="relative" :aria-label="t('home.levels')">
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
          :ref="rowRef(i)"
          class="row"
          :class="{
            first: i === world.from,
            last: i === LEVELS.length - 1,
            'lit-in': i <= litUpTo && i !== world.from,
            'lit-out': i < litUpTo && i !== world.to,
            current: isCurrent(i),
          }"
        >
          <template v-if="isCurrent(i)">
            <span class="node node-current" aria-hidden="true">
              <MascotDrop v-if="flyerTop === null" mood="idle" :size="40" />
            </span>
            <!-- Laid out but hidden during the hop, so the drop lands where the glass will be. -->
            <div
              class="min-w-0 flex-1 py-2"
              :class="{ 'opacity-0': phase === 'hop', 'animate-pop': arrived }"
            >
              <slot name="current" :on-full="onFull" :level="cardRow" />
            </div>
          </template>

          <button v-else-if="isMastered(i)" class="row-btn group" @click="emit('start', i)">
            <span
              class="node bg-star text-ink shadow-soft"
              :class="{ stamp: phase === 'hop' && i === from }"
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
          <BurstRing
            v-if="phase === 'burst' && i === from"
            class="left-[18px]"
            :style="{ top: 'var(--node-y)' }"
          />
        </li>
      </template>
    </template>

    <span
      v-if="railFill"
      class="rail-fill"
      :style="{ top: `${railFill.top}px`, height: `${railFill.height}px` }"
      aria-hidden="true"
    />
    <span
      v-if="flyerTop !== null"
      ref="flyerEl"
      class="flyer"
      :style="{ top: `${flyerTop}px` }"
      aria-hidden="true"
    >
      <MascotDrop mood="happy" :size="40" />
    </span>
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
/* The level-up moment: the rail fills down to the new level as the drop hops along it. */
.rail-fill {
  position: absolute;
  left: 16px;
  z-index: 1;
  width: 4px;
  background: rgb(var(--palette-cta));
  transform-origin: top;
  animation: rail 0.55s ease-in-out both;
}
.flyer {
  position: absolute;
  left: -2px;
  z-index: 2;
  width: 40px;
  height: 45px;
  transform-origin: 50% 100%;
}
.stamp {
  animation: stamp 0.5s cubic-bezier(0.3, 1.6, 0.5, 1) both;
}
@keyframes rail {
  from {
    transform: scaleY(0);
  }
}
@keyframes stamp {
  from {
    transform: scale(1.8);
    opacity: 0;
  }
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
