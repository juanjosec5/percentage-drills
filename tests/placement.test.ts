import { LEVELS } from '@/engine/levels'
import { placeFrom, RUNGS } from '@/engine/placement'

const fast = { correct: true, ms: 1000 }
const wrong = { correct: false, ms: 1000 }
const slowFor = (rung: number) => ({
  correct: true,
  ms: LEVELS[RUNGS[rung]].targetSeconds * 1000 + 1,
})

describe('placeFrom', () => {
  it('starts at level 1 when the first answer misses', () => {
    expect(placeFrom([])).toBe(0)
    expect(placeFrom([wrong])).toBe(0)
    expect(placeFrom([slowFor(0)])).toBe(0)
  })

  it('opens the level above each rung passed in a row', () => {
    expect(placeFrom([fast])).toBe(RUNGS[0] + 1)
    expect(placeFrom([fast, fast, wrong])).toBe(RUNGS[1] + 1)
    expect(placeFrom(Array(RUNGS.length).fill(fast))).toBe(RUNGS.at(-1)! + 1)
  })

  it('ignores anything after the first miss', () => {
    expect(placeFrom([fast, wrong, fast, fast])).toBe(RUNGS[0] + 1)
  })
})
