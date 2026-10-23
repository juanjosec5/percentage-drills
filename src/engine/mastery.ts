// Kumon-style mastery: you move up only when a level is both accurate and fast.
// Repeating a level until it's automatic is the point, not a failure.
import type { Level } from './levels'

/** How many recent answers at a level decide mastery. */
export const WINDOW = 10
/** Share of those answers that must be right. */
export const PASS_ACCURACY = 0.9

export interface Answer {
  correct: boolean
  ms: number
}

export interface MasteryStatus {
  mastered: boolean
  answered: number
  accuracy: number
  /** Median seconds over the window, so one slow problem doesn't sink it. */
  medianSeconds: number
}

export function median(nums: number[]): number {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function mastery(level: Level, recent: Answer[]): MasteryStatus {
  const window = recent.slice(-WINDOW)
  const accuracy = window.length ? window.filter((a) => a.correct).length / window.length : 0
  const medianSeconds = median(window.map((a) => a.ms)) / 1000
  return {
    mastered:
      window.length === WINDOW && accuracy >= PASS_ACCURACY && medianSeconds <= level.targetSeconds,
    answered: window.length,
    accuracy,
    medianSeconds,
  }
}
