import {
  CHALLENGE_SIZE,
  challengeLevels,
  challengeResult,
  hasChallenge,
  LIVES,
  livesLeft,
} from '@/engine/challenge'
import { LEVELS } from '@/engine/levels'
import { MAX_WEIGHT, reviewWeight } from '@/engine/mastery'
import { createRng, weighted } from '@/engine/rng'
import { WORLDS } from '@/engine/worlds'

describe('challenges', () => {
  it('end every world but the last, which ends in Mixed', () => {
    expect(WORLDS.map((_, w) => hasChallenge(w))).toEqual([true, true, false])
  })

  it('ask every level of the world, as evenly as the size allows', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const levels = challengeLevels(0, createRng(seed))
      expect(levels).toHaveLength(CHALLENGE_SIZE)
      const { from, to } = WORLDS[0]
      for (let i = from; i <= to; i++) {
        const n = levels.filter((l) => l === i).length
        expect(n).toBeGreaterThanOrEqual(2)
        expect(n).toBeLessThanOrEqual(4)
      }
      expect(levels.every((l) => l >= from && l <= to)).toBe(true)
    }
  })

  it('pass at CHALLENGE_SIZE right, with up to LIVES - 1 misses on the way', () => {
    expect(challengeResult([])).toBeNull()
    expect(challengeResult(Array(9).fill(true))).toBeNull()
    expect(challengeResult([true, false, true, false])).toBeNull()
    expect(livesLeft([true, false, true, false])).toBe(1)
    const twoSlips = [false, ...Array(5).fill(true), false, ...Array(5).fill(true)]
    expect(twoSlips).toHaveLength(CHALLENGE_SIZE + LIVES - 1)
    expect(challengeResult(twoSlips)).toBe('pass')
  })

  it('end when the lives run out', () => {
    expect(challengeResult([true, false, false, true, false])).toBe('fail')
    expect(challengeResult(Array(LIVES).fill(false))).toBe('fail')
  })
})

describe('weighted review', () => {
  const level = LEVELS[1]
  const ok = { correct: true, ms: 1000 }
  const miss = { correct: false, ms: 1000 }
  const slow = { correct: true, ms: level.targetSeconds * 1000 + 1 }

  it('weighs a level by its recent misses, wrong or slow, up to a cap', () => {
    expect(reviewWeight(level, [])).toBe(1)
    expect(reviewWeight(level, [ok, ok])).toBe(1)
    expect(reviewWeight(level, [miss, slow, ok])).toBe(3)
    expect(reviewWeight(level, Array(20).fill(miss))).toBe(MAX_WEIGHT)
  })

  it('forgets misses older than the recent answers', () => {
    expect(reviewWeight(level, [...Array(5).fill(miss), ...Array(10).fill(ok)])).toBe(1)
  })

  it('draws in proportion to the weights', () => {
    const rng = createRng(7)
    const counts = [0, 0]
    for (let i = 0; i < 4000; i++) counts[weighted(rng, [1, 3])]++
    expect(counts[1] / counts[0]).toBeGreaterThan(2.5)
    expect(counts[1] / counts[0]).toBeLessThan(3.5)
  })
})
