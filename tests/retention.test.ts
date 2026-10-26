import { createPinia, setActivePinia } from 'pinia'

import { LEVELS } from '@/engine/levels'
import { GOAL } from '@/engine/mastery'
import { nearMiss } from '@/engine/nearMiss'
import { createRng } from '@/engine/rng'
import { afterAnswer, dueOn, isDue } from '@/engine/spaced'
import { dayKey } from '@/engine/streak'
import { useProgress } from '@/stores/progress'

const level = (id: string) => LEVELS.find((l) => l.id === id)!

describe('nearMiss', () => {
  const ten = level('ten-any').generate(createRng(3))

  it('names a misplaced decimal point', () => {
    for (const k of [10, 100, 0.1, 0.01])
      expect(nearMiss(String(ten.answer * k), ten)?.key).toBe('near.decimal')
  })

  it('stays quiet for a right answer, junk, or a plain wrong one', () => {
    expect(nearMiss(String(ten.answer), ten)).toBeNull()
    expect(nearMiss('abc', ten)).toBeNull()
    expect(nearMiss(String(ten.answer + 1), ten)).toBeNull()
  })

  it('names the change itself, and the wrong direction, on increase/decrease', () => {
    for (let seed = 1; seed < 30; seed++) {
      const p = level('change').generate(createRng(seed))
      const { base, op, delta } = p.breakdown.result.params as {
        base: number
        op: string
        delta: number
      }
      expect(nearMiss(String(delta), p)?.key).toBe('near.delta')
      const other = op === '+' ? base - delta : base + delta
      // +50%: the other way and the change itself are the same number; "the change" wins.
      if (other !== delta) expect(nearMiss(String(other), p)?.key).toBe('near.sign')
    }
  })
})

describe('spaced review', () => {
  const s = { stage: 0, last: '2026-10-20' }

  it('comes due after a growing gap', () => {
    expect(dueOn(s)).toBe('2026-10-21')
    expect(dueOn({ stage: 3, last: '2026-10-20' })).toBe('2026-11-10')
    expect(isDue(s, '2026-10-20')).toBe(false)
    expect(isDue(s, '2026-10-21')).toBe(true)
  })

  it('a counted answer once due moves it on; before then it changes nothing', () => {
    expect(afterAnswer(s, true, '2026-10-20')).toBe(s)
    expect(afterAnswer(s, true, '2026-10-22')).toEqual({ stage: 1, last: '2026-10-22' })
    expect(afterAnswer({ stage: 3, last: '2026-10-01' }, true, '2026-11-01').stage).toBe(3)
  })

  it('a miss brings it back tomorrow', () => {
    expect(afterAnswer({ stage: 3, last: '2026-10-01' }, false, '2026-10-05')).toEqual({
      stage: 0,
      last: '2026-10-05',
    })
  })
})

describe('progress: spaced review', () => {
  beforeEach(() => setActivePinia(createPinia()))
  const fast = { correct: true, ms: 1000 }

  it('starts a level on the schedule when it is mastered', () => {
    const progress = useProgress()
    for (let i = 0; i < GOAL; i++) progress.record(0, fast)
    expect(progress.spaced['ten-any']).toEqual({ stage: 0, last: dayKey() })
    expect(progress.isDueAt(0)).toBe(false)
  })

  it('puts every level behind the frontier on the schedule, and due ones weigh most in review', () => {
    const progress = useProgress()
    progress.unlocked = 3
    progress.spaced.five = { stage: 0, last: '2020-01-01' }
    return Promise.resolve().then(() => {
      expect(Object.keys(progress.spaced).sort()).toEqual(['five', 'one', 'ten-any'])
      expect(progress.dueLevels).toEqual([1])
      expect(progress.reviewWeights(3)).toEqual([1, 4, 1])
    })
  })

  it('a miss at a mastered level makes it due again tomorrow', () => {
    const progress = useProgress()
    progress.unlocked = 2
    progress.spaced.five = { stage: 2, last: dayKey() }
    progress.record(1, { correct: false, ms: 1000 })
    expect(progress.spaced.five).toEqual({ stage: 0, last: dayKey() })
  })
})
