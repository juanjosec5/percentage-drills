import { LEVELS } from '@/engine/levels'
import {
  CHECK_SIZE,
  CHECKS,
  checkResult,
  passes,
  PLACEMENT_MAX,
  placeFrom,
  SLACK,
} from '@/engine/placement'
import { WORLDS, worldOf } from '@/engine/worlds'

const P = true
const F = false

describe('worlds', () => {
  it('cover every level once, in order', () => {
    expect(WORLDS[0].from).toBe(0)
    for (let i = 1; i < WORLDS.length; i++) expect(WORLDS[i].from).toBe(WORLDS[i - 1].to + 1)
    expect(WORLDS.at(-1)!.to).toBe(LEVELS.length - 1)
  })

  it('finds the world of a level', () => {
    expect(worldOf(0)).toBe(0)
    expect(worldOf(4)).toBe(1)
    expect(worldOf(LEVELS.length - 1)).toBe(2)
  })
})

describe('checks', () => {
  it('ask three levels from the world they test', () => {
    CHECKS.forEach((levels, i) => {
      expect(levels).toHaveLength(CHECK_SIZE)
      for (const l of levels) expect(worldOf(l), LEVELS[l].id).toBe(i)
    })
  })

  it('can open up to the start of Advanced', () => {
    expect(PLACEMENT_MAX).toBe(WORLDS[2].from)
  })

  it('pass with 2 of 3, fail as soon as 2 miss', () => {
    expect(checkResult([])).toBeNull()
    expect(checkResult([P, P])).toBeNull()
    expect(checkResult([F])).toBeNull()
    expect(checkResult([F, F])).toBe('fail')
    expect(checkResult([P, F, F])).toBe('fail')
    expect(checkResult([P, F, P])).toBe('pass')
    expect(checkResult([P, P, P])).toBe('pass')
  })

  it('count a right answer up to twice the target time', () => {
    const level = LEVELS[CHECKS[0][0]]
    const limit = level.targetSeconds * 1000 * SLACK
    expect(passes(level, { correct: true, ms: limit })).toBe(true)
    expect(passes(level, { correct: true, ms: limit + 1 })).toBe(false)
    expect(passes(level, { correct: false, ms: 100 })).toBe(false)
  })
})

describe('placeFrom', () => {
  it('stays at level 1 when the first check fails', () => {
    expect(placeFrom([])).toBe(0)
    expect(placeFrom([[F, F]])).toBe(0)
  })

  it('opens the next world for each check passed in a row', () => {
    expect(
      placeFrom([
        [P, P, F],
        [F, F],
      ]),
    ).toBe(WORLDS[1].from)
    expect(
      placeFrom([
        [P, P, P],
        [P, F, P],
      ]),
    ).toBe(WORLDS[2].from)
  })

  it('needs the checks in a row', () => {
    expect(
      placeFrom([
        [F, F],
        [P, P, P],
      ]),
    ).toBe(0)
  })
})
