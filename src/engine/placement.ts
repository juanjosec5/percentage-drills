// The optional placement ladder: one problem per level, easiest first, stopping at the first
// miss. Five answers can't prove mastery (that takes GOAL), so placement only unlocks levels;
// the skipped ones keep coming back as review problems.
import { LEVELS } from './levels'
import { counts, type Answer } from './mastery'

/** Level indexes asked, in order: 10% of any number, 5%, 1%, 20%…90%, then fractions. */
export const RUNGS = [1, 2, 3, 4, 5]

/** The level to start at after these answers: the one above the last rung passed in a row. */
export function placeFrom(answers: Answer[]): number {
  let start = 0
  for (const [i, answer] of answers.slice(0, RUNGS.length).entries()) {
    if (!counts(LEVELS[RUNGS[i]], answer)) break
    start = RUNGS[i] + 1
  }
  return start
}
