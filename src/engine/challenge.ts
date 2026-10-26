// World challenges: the checkpoint at the end of a world. CHALLENGE_SIZE right answers to problems
// drawn from the whole world, each within placement's slack, with LIVES to spare: each miss (wrong
// or too slow) costs one, and the last one ends the run. A miss brings another problem from the
// same level, so the slip gets a second look. Passing opens the next world; failing costs
// nothing, and it can be retried at once.
import { msg, type Msg } from '@/i18n'

import { int, type Rng } from './rng'
import { WORLDS } from './worlds'

export const CHALLENGE_SIZE = 10
/** Misses a run can take: the LIVES-th ends it, so a run asks at most CHALLENGE_SIZE + LIVES - 1. */
export const LIVES = 3

/** Every world but the last ends in a challenge; the last ends in Mixed, its finale. */
export const hasChallenge = (world: number) => world >= 0 && world < WORLDS.length - 1

/** "Challenge 1": numbered in path order, under its world's heading. */
export const challengeTitle = (world: number): Msg => msg('challenge.title', { n: world + 1 })

/**
 * The level each question comes from: every level of the world as evenly as CHALLENGE_SIZE
 * allows (the remainder at random), in shuffled order.
 */
export function challengeLevels(world: number, rng: Rng): number[] {
  const { from, to } = WORLDS[world]
  const count = to - from + 1
  const levels = Array.from({ length: CHALLENGE_SIZE }, (_, k) =>
    k < CHALLENGE_SIZE - (CHALLENGE_SIZE % count) ? from + (k % count) : int(rng, from, to),
  )
  for (let i = levels.length - 1; i > 0; i--) {
    const j = int(rng, 0, i)
    ;[levels[i], levels[j]] = [levels[j], levels[i]]
  }
  return levels
}

export const livesLeft = (passed: boolean[]) => LIVES - passed.filter((p) => !p).length

/** 'fail' once the lives run out, 'pass' at CHALLENGE_SIZE right, otherwise null. */
export function challengeResult(passed: boolean[]): 'pass' | 'fail' | null {
  if (livesLeft(passed) <= 0) return 'fail'
  return passed.filter(Boolean).length >= CHALLENGE_SIZE ? 'pass' : null
}
