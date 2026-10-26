// Spaced review of mastered levels: a skill that isn't used fades, so each mastered level comes
// due again after a growing gap. A counted answer once it's due pushes it to the next gap; a miss
// at any time brings it back tomorrow. Due levels open the next drill as a short warm-up and come
// up more in review; mastery itself (the ★) is never taken back.
import { dayKey } from './streak'

/** Days until a level is due again, by stage. */
export const INTERVALS = [1, 3, 7, 21]

export interface Spacing {
  stage: number
  /** The day it was last checked (or mastered), YYYY-MM-DD. */
  last: string
}

/** The day a level comes due: its stage's gap after it was last checked. */
export function dueOn({ stage, last }: Spacing): string {
  const d = new Date(`${last}T12:00:00`)
  d.setDate(d.getDate() + INTERVALS[stage])
  return dayKey(d)
}

// Day keys sort as dates.
export const isDue = (s: Spacing, today = dayKey()) => today >= dueOn(s)

/** The spacing after one answer at a mastered level: `counted` is right and on time. */
export function afterAnswer(s: Spacing, counted: boolean, today = dayKey()): Spacing {
  if (!counted) return { stage: 0, last: today }
  if (!isDue(s, today)) return s
  return { stage: Math.min(s.stage + 1, INTERVALS.length - 1), last: today }
}
