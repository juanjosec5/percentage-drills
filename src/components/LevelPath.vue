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

/** A place on the path: a level, or the challenge at the end of a world. */
export type Stop = { level: number } | { challenge: number }
</script>

<script setup lang="ts">
// The levels as a path: one straight rail down the left, a node per level, grouped by world.
// The current level's row holds the glass button (the #current slot), so where you are and what
// you press are the same thing. Each row draws its own two stretches of rail, so the line can't
// break between rows. Finished worlds fold to one line. A world that ends in a challenge has a
// checkpoint row after its last level: a flag planted on the rail.
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import BurstRing from './BurstRing.vue'
import MascotDrop from './MascotDrop.vue'
import PlipAlive from './PlipAlive.vue'
import { BUZZ, useHaptics } from '@/composables/useHaptics'
import { useI18n } from '@/composables/useI18n'
import { challengeTitle, hasChallenge } from '@/engine/challenge'
import { LEVELS } from '@/engine/levels'
import { createRng } from '@/engine/rng'
import { WORLDS, worldOf } from '@/engine/worlds'
import { useProgress } from '@/stores/progress'

const props = defineProps<{
  /** The stop just finished, when Home opens straight after one: plays the moment. */
  finished: Stop | null
}>()
const emit = defineEmits<{ start: [level: number]; challenge: [world: number]; settled: [] }>()
const { t } = useI18n()
const progress = useProgress()
const haptics = useHaptics()

// The moment after finishing a stop, in phases. 'pour': the glass fills to the top on the
// finished level's row. 'burst': that row turns into a ★ (or the flag, for a passed challenge)
// with a burst. 'hop': the drop hops down the rail to the next stop, whose card is laid out
// (hidden) before the hop, so the landing spot never moves. A passed challenge has no glass, so
// its moment starts at the burst. Any tap or key skips to the end; with reduced motion there is
// no moment at all.
type Phase = 'pour' | 'burst' | 'hop' | null
const still = matchMedia('(prefers-reduced-motion: reduce)').matches
const from = props.finished
const fromLevel = from && 'level' in from ? from.level : -1
const fromGate = from && 'challenge' in from ? from.challenge : -1
const phase = ref<Phase>(from && !still ? (fromLevel >= 0 ? 'pour' : 'burst') : null)

// Rows are keyed by stop: 'l3' is level 3, 'g0' the first world's checkpoint.
const levelKey = (i: number) => `l${i}`
const gateKey = (w: number) => `g${w}`
const fromKey = fromGate >= 0 ? gateKey(fromGate) : levelKey(fromLevel)
const fromWorld = fromGate >= 0 ? fromGate : worldOf(fromLevel)
const here = computed(() =>
  progress.gate !== null ? gateKey(progress.gate) : levelKey(progress.unlocked),
)

/** The row holding the main card: the finished level while it pours, then the next stop. */
const cardKey = computed(() =>
  phase.value === 'pour' ? fromKey : phase.value === 'burst' ? '' : here.value,
)
const isCurrent = (key: string) => key === cardKey.value
/** Done: before the current level, or the current one itself once it's the last or at a gate. */
const isMastered = (i: number) =>
  (i < progress.unlocked ||
    (i === progress.unlocked && (progress.allMastered || progress.gate !== null))) &&
  !(phase.value === 'pour' && i === fromLevel)

// Positions along the path, to light the rail: a level at its index, a checkpoint half a step
// past its world's last level (the same scale as progress.step). The rail lags during the
// moment: the stretch into the new stop is drawn as the drop hops.
const gatePos = (w: number) => WORLDS[w].to + 0.5
const fromPos = fromGate >= 0 ? gatePos(fromGate) : fromLevel
const litTo = computed(() => (phase.value ? fromPos : progress.step))
/** The world's last row: its checkpoint, if it has one, else its last level. */
const lastPos = (w: number) => (hasChallenge(w) ? gatePos(w) : WORLDS[w].to)

const worldDone = (w: number) =>
  WORLDS[w].to < progress.unlocked || (progress.allMastered && w === WORLDS.length - 1)
const reached = (w: number) => WORLDS[w].from <= progress.unlocked

/** Finished worlds the learner opened again. */
const unfolded = ref(new Set<number>())
// The finished stop's world stays open during the moment, so the hop starts from a real row.
const folded = (w: number) =>
  worldDone(w) && !unfolded.value.has(w) && !(phase.value && fromWorld === w)
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
const showsSample = (i: number) =>
  (i === progress.unlocked + 1 && progress.gate === null) || peeking.value === i

// The locks wobble once per visit to the app, the first time Home shows them: a hint that rows
// respond to a tap, without a word of copy.
const wobble = !seen.locks
seen.locks = true

// The flying mascot and the rail that fills behind it, positioned from the rendered rows.
const rows = new Map<string, HTMLElement>()
const rowRef = (key: string) => (el: unknown) => {
  if (el) rows.set(key, el as HTMLElement)
  else rows.delete(key)
}
const nodeY = (key: string) => {
  const li = rows.get(key)!
  return li.offsetTop + parseFloat(getComputedStyle(li).getPropertyValue('--node-y'))
}
const flyerEl = ref<HTMLElement>()
const flyerTop = ref<number | null>(null)
const railFill = ref<{ top: number; height: number } | null>(null)
/** The new glass has landed: it pops in. */
const arrived = ref(false)

let timer: ReturnType<typeof setTimeout> | undefined
let landTimer: ReturnType<typeof setTimeout> | undefined
let hopAnim: Animation | undefined

/** The glass reached the top (or took too long): burst, then hop. */
function onFull() {
  if (phase.value !== 'pour') return
  clearTimeout(timer)
  burst()
}

function burst() {
  phase.value = 'burst'
  haptics.buzz(BUZZ.levelUp)
  nextTick(() => (flyerTop.value = nodeY(fromKey) - BODY_Y))
  timer = setTimeout(hop, BURST_MS)
}

async function hop() {
  phase.value = 'hop'
  await nextTick()
  const a = nodeY(fromKey)
  const b = nodeY(here.value)
  flyerTop.value = a - BODY_Y
  // Across a world's border there's no rail between the rows to fill.
  const toWorld = progress.gate ?? worldOf(progress.unlocked)
  if (fromWorld === toWorld) railFill.value = { top: a, height: b - a }
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
  // A light tick as Plip touches down (the hop's 85% keyframe).
  landTimer = setTimeout(() => haptics.buzz(BUZZ.land), HOP_MS * 0.85)
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
  const skipped = phase.value !== 'hop' || (hopAnim?.playState ?? 'finished') !== 'finished'
  clearTimeout(timer)
  hopAnim?.cancel()
  // Skipped mid-moment: the buzz that belonged to it stops too.
  if (skipped) {
    clearTimeout(landTimer)
    haptics.stop()
  }
  phase.value = null
  flyerTop.value = null
  railFill.value = null
  arrived.value = true
  skipOnInput(false)
  emit('settled')
}

onMounted(() => {
  if (!phase.value) return
  if (phase.value === 'burst') burst()
  else timer = setTimeout(onFull, POUR_MAX_MS)
  skipOnInput(true)
})
onBeforeUnmount(() => {
  clearTimeout(timer)
  clearTimeout(landTimer)
  haptics.stop()
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
          :ref="rowRef(levelKey(i))"
          class="row"
          :class="{
            first: i === world.from,
            last: i === LEVELS.length - 1,
            'lit-in': i <= litTo && i !== world.from,
            'lit-out': i < litTo && i !== lastPos(w),
            current: isCurrent(levelKey(i)),
          }"
        >
          <template v-if="isCurrent(levelKey(i))">
            <span class="node node-current" aria-hidden="true">
              <PlipAlive v-if="flyerTop === null" :size="40" />
            </span>
            <!-- Laid out but hidden during the hop, so the drop lands where the glass will be. It
                 fades in rather than scaling: a scale moved it under the drop that just landed. -->
            <div
              class="min-w-0 flex-1 py-2"
              :class="{ 'opacity-0': phase === 'hop', 'animate-fade': arrived }"
            >
              <slot name="current" :on-full="onFull" :level="i" :challenge="null" />
            </div>
          </template>

          <button v-else-if="isMastered(i)" class="row-btn group" @click="emit('start', i)">
            <span
              class="node bg-star text-ink shadow-soft"
              :class="{ stamp: phase === 'hop' && i === fromLevel }"
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
            <!-- Spaced review: the ★ stays, a small mark says it's time for another look. -->
            <span
              v-if="progress.isDueAt(i)"
              class="text-xs text-cta"
              role="img"
              :aria-label="t('home.due')"
              >↻</span
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
            v-if="phase === 'burst' && i === fromLevel"
            class="left-[18px]"
            :style="{ top: 'var(--node-y)' }"
          />
        </li>

        <!-- The checkpoint: the rail runs up into the flag's pole. Grey until it's reached, then
             the current stop (Plip on it, the challenge card beside), gold once passed. -->
        <li
          v-if="hasChallenge(w)"
          :ref="rowRef(gateKey(w))"
          class="row last gate"
          :class="{
            'lit-in': gatePos(w) <= litTo,
            current: isCurrent(gateKey(w)),
          }"
        >
          <template v-if="isCurrent(gateKey(w))">
            <span class="node node-current" aria-hidden="true">
              <PlipAlive v-if="flyerTop === null" :size="40" />
            </span>
            <div
              class="min-w-0 flex-1 py-2"
              :class="{ 'opacity-0': phase === 'hop', 'animate-fade': arrived }"
            >
              <slot name="current" :on-full="onFull" :level="world.to" :challenge="w" />
            </div>
          </template>

          <button
            v-else-if="progress.passed(w)"
            class="row-btn group"
            @click="emit('challenge', w)"
          >
            <span
              class="node text-star"
              :class="{ stamp: phase === 'hop' && w === fromGate }"
              role="img"
              :aria-label="t('challenge.passed')"
            >
              <svg viewBox="0 0 28 28" class="size-7" aria-hidden="true">
                <rect x="12.5" y="1" width="3" height="26" rx="1.5" class="fill-ink/70" />
                <path d="M15.5 2 Q21 0 27 3.5 L27 13 Q21 10 15.5 13 Z" fill="currentColor" />
              </svg>
            </span>
            <span class="font-medium group-hover:underline group-hover:underline-offset-4">
              {{ t(challengeTitle(w)) }}
            </span>
          </button>

          <div v-else class="row-btn locked">
            <span class="node text-ink-muted/45" aria-hidden="true">
              <svg viewBox="0 0 28 28" class="size-7">
                <rect x="12.5" y="1" width="3" height="26" rx="1.5" fill="currentColor" />
                <!-- Furled: the cloth hangs wrapped against the pole. -->
                <path d="M15.5 2 Q22 7 15.5 19 Z" fill="currentColor" />
              </svg>
            </span>
            <span class="flex min-w-0 flex-col">
              <span class="font-medium text-ink-muted">{{ t(challengeTitle(w)) }}</span>
              <span class="font-mono text-xs text-ink-muted">{{ t('challenge.rule') }}</span>
            </span>
            <span class="lock ml-auto text-xs" role="img" :aria-label="t('home.locked')">🔒</span>
          </div>
          <BurstRing
            v-if="phase === 'burst' && w === fromGate"
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
/* The drop sits level with the middle of the glass: 8px of row padding + half its 112px. */
.row.current {
  --node-y: 64px;
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
