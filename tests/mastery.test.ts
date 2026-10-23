import { LEVELS } from '@/engine/levels'
import { answersToMastery, mastery, median, summarize, WINDOW, type Answer } from '@/engine/mastery'
import { createRng } from '@/engine/rng'
import { translate } from '@/i18n'

const level = LEVELS[0] // target 5s
const answers = (n: number, correct: boolean, ms: number) =>
  Array.from({ length: n }, () => ({ correct, ms }))

describe('mastery', () => {
  it('needs a full window of answers', () => {
    expect(mastery(level, answers(WINDOW - 1, true, 1000)).mastered).toBe(false)
    expect(mastery(level, answers(WINDOW, true, 1000)).mastered).toBe(true)
  })

  it('needs 90% accuracy', () => {
    expect(mastery(level, [...answers(8, true, 1000), ...answers(2, false, 1000)]).mastered).toBe(
      false,
    )
    expect(mastery(level, [...answers(9, true, 1000), ...answers(1, false, 1000)]).mastered).toBe(
      true,
    )
  })

  it('needs the median time under the target', () => {
    expect(mastery(level, answers(WINDOW, true, 6000)).mastered).toBe(false)
    // One very slow answer doesn't sink it.
    expect(mastery(level, [...answers(9, true, 2000), { correct: true, ms: 60000 }]).mastered).toBe(
      true,
    )
  })

  it('only looks at the most recent window', () => {
    const recent = [...answers(20, false, 9000), ...answers(WINDOW, true, 1000)]
    expect(mastery(level, recent).mastered).toBe(true)
  })

  it('computes medians', () => {
    expect(median([])).toBe(0)
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })
})

describe('summarize', () => {
  it('rounds accuracy to a whole percent and the median to a tenth of a second', () => {
    const recent = [...answers(8, true, 3240), ...answers(1, false, 3260)]
    expect(translate('en', summarize(mastery(level, recent)))).toBe('89% right · typical time 3.2s')
    expect(translate('es', summarize(mastery(level, recent)))).toBe(
      '89 % de aciertos · tiempo típico 3,2 s',
    )
  })

  it('reads 0% and 0.0s before any answers', () => {
    expect(translate('en', summarize(mastery(level, [])))).toBe('0% right · typical time 0.0s')
  })
})

describe('answersToMastery', () => {
  const level = LEVELS[0]
  const T = level.targetSeconds * 1000
  const right = (ms = T / 2) => ({ correct: true, ms })
  const wrong = { correct: false, ms: T / 2 }
  const times = (n: number, a: Answer) => Array<Answer>(n).fill(a)

  it('needs a full window from nothing', () => {
    expect(answersToMastery(level, [])).toBe(WINDOW)
  })

  it('needs one more after nine fast right answers', () => {
    expect(answersToMastery(level, times(9, right()))).toBe(1)
  })

  it('needs one more when the window passes but ended on a wrong answer', () => {
    expect(answersToMastery(level, [...times(9, right()), wrong])).toBe(1)
  })

  it('counts out old wrong answers as they slide out of the window', () => {
    expect(answersToMastery(level, [...times(3, wrong), ...times(7, right())])).toBe(2)
  })

  it('needs enough on-target answers to pull a slow median down', () => {
    // Ten right at twice the target: five at target still leave the median at 1.5x.
    expect(answersToMastery(level, times(10, right(2 * T)))).toBe(6)
  })

  it('always answers between 1 and WINDOW', () => {
    const rng = createRng(3)
    for (let i = 0; i < 200; i++) {
      const recent = Array.from({ length: Math.floor(rng() * 14) }, () => ({
        correct: rng() < 0.7,
        ms: rng() * 3 * T,
      }))
      const k = answersToMastery(level, recent)
      expect(k).toBeGreaterThanOrEqual(1)
      expect(k).toBeLessThanOrEqual(WINDOW)
    }
  })
})
