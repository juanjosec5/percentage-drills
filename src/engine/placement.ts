// The optional placement test: a short check per world, easiest world first. Passing a check
// starts the learner at the next world. A few answers can't prove mastery (that takes GOAL), so
// placement only unlocks levels; the skipped ones keep coming back as review problems.
import { LEVELS, type Level } from './levels'
import type { Answer } from './mastery'
import { WORLDS } from './worlds'

/** Problems per check, and how many of them must pass. */
export const CHECK_SIZE = 3
export const CHECK_PASS = 2
/** Placement asks what you know, not how fast: up to twice the drill's time still passes. */
export const SLACK = 2

/** The level indexes each check asks, in order. A check is passed to reach the world after it. */
export const CHECKS: number[][] = [
  [1, 2, 3], // Beginner: 5%, 1%, 20%…90%
  [4, 5, 6], // Intermediate: fractions, 15%, built percentages
]
/** The highest level placement can open; from there on it has nothing to offer. */
export const PLACEMENT_MAX = WORLDS[CHECKS.length].from

export const passes = (level: Level, a: Answer) =>
  a.correct && a.ms <= level.targetSeconds * 1000 * SLACK

/**
 * A check's outcome so far: 'fail' as soon as too many misses make passing impossible, otherwise
 * null until all CHECK_SIZE are answered. Every problem is asked, so a run is never cut short
 * after a right answer.
 */
export function checkResult(passed: boolean[]): 'pass' | 'fail' | null {
  const misses = passed.filter((p) => !p).length
  if (misses > CHECK_SIZE - CHECK_PASS) return 'fail'
  if (passed.length < CHECK_SIZE) return null
  return 'pass'
}

/** The level to start at: the first level of the world after the last check passed in a row. */
export function placeFrom(results: boolean[][]): number {
  let start = 0
  for (const [i, passed] of results.slice(0, CHECKS.length).entries()) {
    if (checkResult(passed) !== 'pass') break
    start = WORLDS[i + 1].from
  }
  return start
}

/** The level a placement problem comes from. */
export const levelAt = (check: number, question: number) => LEVELS[CHECKS[check][question]]
