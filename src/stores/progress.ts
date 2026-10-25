// Everything the learner has done, saved in localStorage: answers per level (for mastery),
// per-day totals (for the day's goal and the streak) and the highest unlocked level.
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { LEVELS } from '@/engine/levels'
import { mastery, type Answer, type MasteryStatus } from '@/engine/mastery'
import { PLACEMENT_MAX } from '@/engine/placement'
import { dayKey, streakOf } from '@/engine/streak'

import { HISTORY_CAP, KEY, normalize, SAVE_VERSION, type Day, type Saved } from './save'

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
  /** Not saved: tells Home the last jump came from placement, so it doesn't celebrate it. */
  const justPlaced = ref(false)

  function snapshot(): Saved {
    return {
      version: SAVE_VERSION,
      unlocked: unlocked.value,
      history: history.value,
      days: days.value,
      settings: settings.value,
      placedUpTo: placedUpTo.value,
    }
  }

  watch(
    [unlocked, history, days, settings, placedUpTo],
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
    justPlaced.value = true
  }

  /** The last level has no next one to unlock, so its mastery is read directly. */
  const allMastered = computed(
    () => unlocked.value === LEVELS.length - 1 && statusOf(unlocked.value).mastered,
  )

  let persistAsked = false

  /** Records one answer. Returns true when it unlocked the next level. */
  function record(levelIndex: number, answer: Answer): boolean {
    // Asks the browser not to evict the save under storage pressure. Once there is something
    // worth keeping, not on load: some browsers weigh engagement when they decide.
    if (!persistAsked) {
      persistAsked = true
      navigator.storage?.persist?.().catch(() => {})
    }
    const id = LEVELS[levelIndex].id
    history.value[id] = [...(history.value[id] ?? []), answer].slice(-HISTORY_CAP)

    const key = dayKey()
    const day = { ...today.value }
    day.answered++
    day.totalMs += answer.ms
    if (answer.correct) {
      day.correct++
      day.bestMs = day.bestMs === null ? answer.ms : Math.min(day.bestMs, answer.ms)
    }
    days.value[key] = day

    // Only a right answer can finish a level: celebrating straight after "Not quite" feels wrong.
    const atFrontier = levelIndex === unlocked.value && levelIndex < LEVELS.length - 1
    if (atFrontier && answer.correct && statusOf(levelIndex).mastered) {
      unlocked.value++
      return true
    }
    return false
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
  }

  /** Replaces progress with an imported save; settings stay, as they do on reset. */
  function restore(saved: Saved) {
    unlocked.value = saved.unlocked
    history.value = saved.history
    days.value = saved.days
    placedUpTo.value = saved.placedUpTo
  }

  return {
    unlocked,
    history,
    days,
    settings,
    placedUpTo,
    justPlaced,
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
