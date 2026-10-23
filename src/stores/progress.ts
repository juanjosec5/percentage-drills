// Everything the learner has done, saved in localStorage: answers per level (for mastery),
// per-day totals (for the daily set and streak) and the highest unlocked level.
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { LEVELS } from '@/engine/levels'
import { mastery, type Answer, type MasteryStatus } from '@/engine/mastery'
import { dayKey, streakOf } from '@/engine/streak'

import { HISTORY_CAP, KEY, normalize, SAVE_VERSION, type Day, type Saved } from './save'

export const DAILY_COUNT = 10

export type Mode = 'daily' | 'endless'

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

  function snapshot(): Saved {
    return {
      version: SAVE_VERSION,
      unlocked: unlocked.value,
      history: history.value,
      days: days.value,
      settings: settings.value,
    }
  }

  watch(
    [unlocked, history, days, settings],
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
    () => days.value[dayKey()] ?? { answered: 0, correct: 0, totalMs: 0, bestMs: null, daily: 0 },
  )
  const dailyDone = computed(() => today.value.daily >= DAILY_COUNT)

  /**
   * Any DAILY_COUNT answers make a day practised, in either mode: practising a level from its
   * card counts as much as the daily set does.
   */
  const streak = computed(
    () => streakOf((key) => (days.value[key]?.answered ?? 0) >= DAILY_COUNT).days,
  )

  function statusOf(index: number): MasteryStatus {
    const level = LEVELS[index]
    return mastery(level, history.value[level.id] ?? [])
  }

  /** The last level has no next one to unlock, so its mastery is read directly. */
  const allMastered = computed(
    () => unlocked.value === LEVELS.length - 1 && statusOf(unlocked.value).mastered,
  )

  let persistAsked = false

  /** Records one answer. Returns true when it unlocked the next level. */
  function record(levelIndex: number, answer: Answer, mode: Mode): boolean {
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
    if (mode === 'daily') day.daily++
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
  }

  /** Replaces progress with an imported save; settings stay, as they do on reset. */
  function restore(saved: Saved) {
    unlocked.value = saved.unlocked
    history.value = saved.history
    days.value = saved.days
  }

  return {
    unlocked,
    history,
    days,
    settings,
    today,
    dailyDone,
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
