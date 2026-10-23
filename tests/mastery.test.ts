import { LEVELS } from '@/engine/levels'
import { mastery, median, summarize, WINDOW } from '@/engine/mastery'
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
    expect(translate('en', summarize(mastery(level, recent)))).toBe('89% right · median 3.2s')
    expect(translate('es', summarize(mastery(level, recent)))).toBe(
      '89 % de aciertos · mediana 3,2 s',
    )
  })

  it('reads 0% and 0.0s before any answers', () => {
    expect(translate('en', summarize(mastery(level, [])))).toBe('0% right · median 0.0s')
  })
})
