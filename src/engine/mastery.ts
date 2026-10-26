// Kumon-style mastery as a plain countdown: a level is done after GOAL right answers within its
// target time. Wrong or slow answers just don't count; nothing ever goes backwards, so the
// learner always knows exactly how many are left.
import type { Level } from './levels'

/** Right, on-time answers that finish a level. */
export const GOAL = 10

export interface Answer {
  correct: boolean
  ms: number
}

export interface MasteryStatus {
  mastered: boolean
  /** Every answer given at this level. */
  answered: number
  /** The answers that count: right and within the target time. */
  counted: number
}

export const counts = (level: Level, a: Answer) => a.correct && a.ms <= level.targetSeconds * 1000

export function mastery(level: Level, answers: Answer[]): MasteryStatus {
  const counted = answers.filter((a) => counts(level, a)).length
  return { mastered: counted >= GOAL, answered: answers.length, counted }
}

/** Answers still needed: 1..GOAL. Never 0, since a level unlocks on the answer that finishes it. */
export function answersToMastery(level: Level, answers: Answer[]): number {
  return Math.max(GOAL - mastery(level, answers).counted, 1)
}

/** The answers a review weighs: a level's latest few, so a slip long ago is forgotten. */
export const RECENT = 10
/** A shaky level comes up in review at most this many times as often as a solid one. */
export const MAX_WEIGHT = 4

/**
 * How often a level comes up in review, relative to the others: 1 plus its recent misses (wrong
 * or slow), capped so no other level is starved. A level with no answers yet is unverified, not
 * weak, so it weighs 1 like a solid one.
 */
export function reviewWeight(level: Level, answers: Answer[]): number {
  const misses = answers.slice(-RECENT).filter((a) => !counts(level, a)).length
  return 1 + Math.min(misses, MAX_WEIGHT - 1)
}
