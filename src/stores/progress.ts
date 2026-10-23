// Everything the learner has done, saved in localStorage: answers per level (for mastery),
// per-day totals (for the daily set and streak) and the highest unlocked level.
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { LEVELS } from '@/engine/levels'
import { mastery, type Answer } from '@/engine/mastery'

export const DAILY_COUNT = 10
const KEY = 'percent-drills:v1'
/** Answers kept per level; mastery only reads the last WINDOW. */
const HISTORY_CAP = 50

export type Mode = 'daily' | 'endless'

interface Day {
  answered: number
  correct: number
  totalMs: number
  bestMs: number | null
  daily: number
}

interface Saved {
  unlocked: number
  history: Record<string, Answer[]>
  days: Record<string, Day>
}

export function dayKey(d = new Date()): string {
  return d.toLocaleDateString('sv') // YYYY-MM-DD in local time
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Saved
  } catch {
    // Private mode or corrupt data: start fresh.
  }
  return { unlocked: 0, history: {}, days: {} }
}

export const useProgress = defineStore('progress', () => {
  const saved = load()
  const unlocked = ref(Math.min(saved.unlocked, LEVELS.length - 1))
  const history = ref(saved.history)
  const days = ref(saved.days)

  watch(
    [unlocked, history, days],
    () => {
      try {
        localStorage.setItem(
          KEY,
          JSON.stringify({ unlocked: unlocked.value, history: history.value, days: days.value }),
        )
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

  /** Consecutive days with the daily set finished, counting back from today (or yesterday). */
  const streak = computed(() => {
    const d = new Date()
    if (!dailyDone.value) d.setDate(d.getDate() - 1)
    let n = 0
    while ((days.value[dayKey(d)]?.daily ?? 0) >= DAILY_COUNT) {
      n++
      d.setDate(d.getDate() - 1)
    }
    return n
  })

  function statusOf(index: number) {
    const level = LEVELS[index]
    return mastery(level, history.value[level.id] ?? [])
  }

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

    const atFrontier = levelIndex === unlocked.value && levelIndex < LEVELS.length - 1
    if (atFrontier && statusOf(levelIndex).mastered) {
      unlocked.value++
      return true
    }
    return false
  }

  function reset() {
    unlocked.value = 0
    history.value = {}
    days.value = {}
  }

  return { unlocked, history, days, today, dailyDone, streak, statusOf, record, reset }
})
