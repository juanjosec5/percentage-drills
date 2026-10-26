// World challenges: the checkpoint at the end of a world. CHALLENGE_SIZE problems drawn from the
// whole world, every one right and within placement's slack, in a row: the first miss ends the
// run. Passing opens the next world; failing costs nothing, and it can be retried at once.
import { msg, type Msg } from '@/i18n'

import { int, type Rng } from './rng'
import { WORLDS } from './worlds'

export const CHALLENGE_SIZE = 10

/** Every world but the last ends in a challenge; the last ends in Mixed, its finale. */
export const hasChallenge = (world: number) => world >= 0 && world < WORLDS.length - 1

/** "Beginner challenge". */
export const challengeTitle = (world: number): Msg =>
  msg('challenge.title', { world: msg(`world.${WORLDS[world].id}`) })

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

/** 'fail' on the first miss, 'pass' once CHALLENGE_SIZE have passed, otherwise null. */
export function challengeResult(passed: boolean[]): 'pass' | 'fail' | null {
  if (passed.includes(false)) return 'fail'
  return passed.length >= CHALLENGE_SIZE ? 'pass' : null
}
