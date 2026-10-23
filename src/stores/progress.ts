// Everything the learner has done, saved in localStorage: answers per level (for mastery),
// per-day totals (for the daily set and streak) and the highest unlocked level.
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { LEVELS } from '@/engine/levels'
import { mastery, type Answer, type MasteryStatus } from '@/engine/mastery'
import { dayKey, streakOf } from '@/engine/streak'

export const DAILY_COUNT = 10
const KEY = 'percent-drills:v1'
/**
 * Answers kept per level. Mastery counts on-time right answers in here, so the cap sits far above
 * GOAL: even a learner who misses most of them reaches GOAL long before old ones drop off.
 */
const HISTORY_CAP = 200

export type Mode = 'daily' | 'endless'

interface Day {
  answered: number
  correct: number
  totalMs: number
  bestMs: number | null
  daily: number
}

export interface Settings {
  /** Show the running clock while answering. Timing and mastery are the same either way. */
  showTimer: boolean
}

export interface Saved {
  unlocked: number
  history: Record<string, Answer[]>
  days: Record<string, Day>
  settings: Settings
}

const DEFAULT_SETTINGS: Settings = { showTimer: true }

export { dayKey }

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Accepts whatever was stored and fills missing or invalid fields from defaults, so a partial
 * or older save (before settings existed) can't leave the app with `unlocked: NaN`.
 */
export function normalize(raw: unknown): Saved {
  const s = isObject(raw) ? raw : {}
  const unlocked = Number.isInteger(s.unlocked) ? (s.unlocked as number) : 0
  const settings = isObject(s.settings) ? s.settings : {}
  return {
    unlocked: Math.min(Math.max(unlocked, 0), LEVELS.length - 1),
    history: isObject(s.history) ? (s.history as Saved['history']) : {},
    days: isObject(s.days) ? (s.days as Saved['days']) : {},
    settings: {
      showTimer:
        typeof settings.showTimer === 'boolean' ? settings.showTimer : DEFAULT_SETTINGS.showTimer,
    },
  }
}

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

  watch(
    [unlocked, history, days, settings],
    () => {
      try {
        const data: Saved = {
          unlocked: unlocked.value,
          history: history.value,
          days: days.value,
          settings: settings.value,
        }
        localStorage.setItem(KEY, JSON.stringify(data))
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

  /** Records one answer. Returns true when it unlocked the next level. */
  function record(levelIndex: number, answer: Answer, mode: Mode): boolean {
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
  }
})
