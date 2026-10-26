// Everything the learner has done, saved in localStorage: answers per level (for mastery),
// per-day totals (for the day's goal and the streak), the highest unlocked level and the world
// challenges' best scores.
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { CHALLENGE_SIZE, hasChallenge } from '@/engine/challenge'
import { LEVELS } from '@/engine/levels'
import {
  counts,
  mastery,
  MAX_WEIGHT,
  reviewWeight,
  type Answer,
  type MasteryStatus,
} from '@/engine/mastery'
import { PLACEMENT_MAX } from '@/engine/placement'
import { afterAnswer, dueOn, isDue, type Spacing } from '@/engine/spaced'
import { dayKey, streakOf } from '@/engine/streak'
import { WORLDS, worldOf } from '@/engine/worlds'

import {
  HISTORY_CAP,
  KEY,
  normalize,
  SAVE_VERSION,
  serialize,
  type Challenges,
  type Day,
  type Saved,
  type Stored,
} from './save'

/** Answers that make a day count toward the streak: the day's goal. */
export const DAY_GOAL = 10
/** Review answers that turn a placed level (☆) into a mastered one (★). */
export const CONFIRM = 3

export { dayKey, normalize }
export type { Saved, Settings } from './save'

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return normalize(JSON.parse(raw))
  } catch {
    // Private mode or corrupt data: start fresh.
  }
  return normalize(null)
}

export const useProgress = defineStore('progress', () => {
  const saved = load()
  const unlocked = ref(saved.unlocked)
  const history = ref(saved.history)
  const days = ref(saved.days)
  const settings = ref(saved.settings)
  const placedUpTo = ref(saved.placedUpTo)
  const challenges = ref<Challenges>(saved.challenges)
  const spaced = ref<Record<string, Spacing>>(saved.spaced)
  /** Not saved: tells Home the last jump came from placement, so it doesn't celebrate it. */
  const justPlaced = ref(false)

  /** Progress in its stored form (levels by id): what's saved, and what Export writes. */
  function snapshot(): Stored {
    return serialize({
      version: SAVE_VERSION,
      unlocked: unlocked.value,
      history: history.value,
      days: days.value,
      settings: settings.value,
      placedUpTo: placedUpTo.value,
      challenges: challenges.value,
      spaced: spaced.value,
    })
  }

  watch(
    [unlocked, history, days, settings, placedUpTo, challenges, spaced],
    () => {
      try {
        localStorage.setItem(KEY, JSON.stringify(snapshot()))
      } catch {
        // Storage full or blocked: progress just won't persist this session.
      }
    },
    { deep: true },
  )

  const today = computed<Day>(
    () => days.value[dayKey()] ?? { answered: 0, correct: 0, totalMs: 0, bestMs: null },
  )
  /**
   * Today's answers toward the day's goal, 0..DAY_GOAL. It never stops practice: there is one
   * way to practise, the current level, and this only feeds the streak. (A separate "daily set"
   * that ended the drill used to fight level progress on the same button.)
   */
  const todayAnswered = computed(() => Math.min(today.value.answered, DAY_GOAL))

  /** Any DAY_GOAL answers make a day practised. */
  const streak = computed(
    () => streakOf((key) => (days.value[key]?.answered ?? 0) >= DAY_GOAL).days,
  )

  function statusOf(index: number): MasteryStatus {
    const level = LEVELS[index]
    return mastery(level, history.value[level.id] ?? [])
  }

  /**
   * How often each level before `index` comes up in review: shaky ones more (see reviewWeight),
   * and a level due for spaced review as often as the shakiest.
   */
  function reviewWeights(index: number): number[] {
    return LEVELS.slice(0, index).map((level, i) =>
      isDueAt(i) ? MAX_WEIGHT : reviewWeight(level, history.value[level.id] ?? []),
    )
  }

  /** A mastered level whose spaced review has come due. */
  function isDueAt(index: number): boolean {
    const s = spaced.value[LEVELS[index].id]
    return !!s && isDue(s)
  }

  /** Every level due for review, longest overdue first. */
  const dueLevels = computed(() =>
    LEVELS.map((_, i) => i)
      .filter(isDueAt)
      .sort((a, b) =>
        dueOn(spaced.value[LEVELS[a].id]).localeCompare(dueOn(spaced.value[LEVELS[b].id])),
      ),
  )

  /** An answer at a mastered level moves its spaced review (see afterAnswer). */
  function check(levelIndex: number, counted: boolean) {
    const id = LEVELS[levelIndex].id
    const s = spaced.value[id]
    if (s) spaced.value[id] = afterAnswer(s, counted)
  }

  // Every level behind the frontier is on the schedule; one without a record (an older save, or
  // skipped by placement) starts from today, so it first comes due tomorrow.
  watch(
    unlocked,
    (frontier) => {
      for (const level of LEVELS.slice(0, frontier))
        spaced.value[level.id] ??= { stage: 0, last: dayKey() }
    },
    { immediate: true },
  )

  const passed = (world: number) => (challenges.value[WORLDS[world].id] ?? 0) >= CHALLENGE_SIZE

  /**
   * The world whose challenge stands between the learner and the next world: its last level is
   * mastered and the challenge isn't passed yet. Null while a level is the way forward.
   */
  const gate = computed(() => {
    const w = worldOf(unlocked.value)
    const open =
      hasChallenge(w) &&
      unlocked.value === WORLDS[w].to &&
      statusOf(unlocked.value).mastered &&
      !passed(w)
    return open ? w : null
  })

  /**
   * Where the learner stands on the path, as one number that only grows: a level's index, or
   * half a step past a world's last level while its challenge is the way forward.
   */
  const step = computed(() => unlocked.value + (gate.value === null ? 0 : 0.5))

  /** Records a challenge run's score; a full one opens the next world. */
  function finishChallenge(world: number, score: number) {
    const id = WORLDS[world].id
    challenges.value[id] = Math.max(challenges.value[id] ?? 0, score)
    if (passed(world) && unlocked.value <= WORLDS[world].to) unlocked.value = WORLDS[world + 1].from
  }

  // Placement only ever moves the learner up and writes no answers, so it stays on offer for as
  // long as it could still open a higher level.
  const canPlace = computed(() => unlocked.value < PLACEMENT_MAX)

  /**
   * A level skipped by placement shows as placed (☆) until CONFIRM review answers there count;
   * then it is as mastered (★) as any other.
   */
  function isPlaced(index: number): boolean {
    return index < placedUpTo.value && statusOf(index).counted < CONFIRM
  }

  function place(start: number) {
    if (start <= unlocked.value) return
    unlocked.value = start
    placedUpTo.value = start
    // Placement's check for a world stands in for that world's challenge.
    for (const [w, world] of WORLDS.entries())
      if (hasChallenge(w) && world.to < start) challenges.value[world.id] = CHALLENGE_SIZE
    justPlaced.value = true
  }

  /** The last level has no next one to unlock, so its mastery is read directly. */
  const allMastered = computed(
    () => unlocked.value === LEVELS.length - 1 && statusOf(unlocked.value).mastered,
  )

  let persistAsked = false

  /**
   * Records one answer. Returns true when it finished the current level, which opens the next
   * level or, at the end of a world, its challenge.
   */
  function record(levelIndex: number, answer: Answer): boolean {
    const id = LEVELS[levelIndex].id
    const wasMastered = statusOf(levelIndex).mastered
    history.value[id] = [...(history.value[id] ?? []), answer].slice(-HISTORY_CAP)
    logDay(answer)
    check(levelIndex, counts(LEVELS[levelIndex], answer))

    // Only a right answer can finish a level: celebrating straight after "Not quite" feels wrong.
    const atFrontier = levelIndex === unlocked.value && levelIndex < LEVELS.length - 1
    if (!atFrontier || !answer.correct || !statusOf(levelIndex).mastered) return false
    // A world's last level opens its challenge (see gate) rather than the next level: only the
    // answer that finished it counts as finishing, not more practice there while the gate is up.
    const w = worldOf(levelIndex)
    // Mastered just now: its spaced review starts today.
    if (!wasMastered) spaced.value[id] = { stage: 0, last: dayKey() }
    if (hasChallenge(w) && levelIndex === WORLDS[w].to && !passed(w)) return !wasMastered
    unlocked.value++
    return true
  }

  /** Adds an answer to today's totals: every answer counts toward the day's goal and the streak. */
  function logDay(answer: Answer) {
    // Asks the browser not to evict the save under storage pressure. Once there is something
    // worth keeping, not on load: some browsers weigh engagement when they decide.
    if (!persistAsked) {
      persistAsked = true
      navigator.storage?.persist?.().catch(() => {})
    }
    const key = dayKey()
    const day = { ...today.value }
    day.answered++
    day.totalMs += answer.ms
    if (answer.correct) {
      day.correct++
      day.bestMs = day.bestMs === null ? answer.ms : Math.min(day.bestMs, answer.ms)
    }
    days.value[key] = day
  }

  function setShowTimer(show: boolean) {
    settings.value.showTimer = show
  }

  /** Erases progress; settings are preferences, not progress, so they stay. */
  function reset() {
    unlocked.value = 0
    history.value = {}
    days.value = {}
    placedUpTo.value = 0
    challenges.value = {}
    spaced.value = {}
  }

  /** Replaces progress with an imported save; settings stay, as they do on reset. */
  function restore(saved: Saved) {
    unlocked.value = saved.unlocked
    history.value = saved.history
    days.value = saved.days
    placedUpTo.value = saved.placedUpTo
    challenges.value = saved.challenges
    spaced.value = saved.spaced
  }

  return {
    unlocked,
    history,
    days,
    settings,
    placedUpTo,
    challenges,
    justPlaced,
    gate,
    step,
    passed,
    finishChallenge,
    reviewWeights,
    logDay,
    spaced,
    isDueAt,
    dueLevels,
    check,
    canPlace,
    isPlaced,
    place,
    today,
    todayAnswered,
    streak,
    allMastered,
    statusOf,
    record,
    setShowTimer,
    reset,
    restore,
    snapshot,
  }
})
