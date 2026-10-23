import { LEVELS } from '@/engine/levels'
import { answersToMastery, GOAL, mastery, type Answer } from '@/engine/mastery'

const level = LEVELS[0] // target 5s
const T = level.targetSeconds * 1000
const right = (ms = T / 2): Answer => ({ correct: true, ms })
const wrong: Answer = { correct: false, ms: T / 2 }
const times = (n: number, a: Answer) => Array<Answer>(n).fill(a)

describe('mastery (countdown)', () => {
  it('finishes a level at GOAL right, on-time answers', () => {
    expect(mastery(level, times(GOAL - 1, right())).mastered).toBe(false)
    expect(mastery(level, times(GOAL, right())).mastered).toBe(true)
  })

  it("doesn't count wrong or slow answers, and they never take one back", () => {
    const answers = [...times(5, right()), wrong, right(T + 1), wrong, ...times(4, right())]
    expect(mastery(level, answers)).toEqual({ mastered: false, answered: 12, counted: 9 })
    expect(mastery(level, [...answers, right()]).mastered).toBe(true)
  })

  it('counts an answer at exactly the target time', () => {
    expect(mastery(level, [right(T)]).counted).toBe(1)
  })
})

describe('answersToMastery', () => {
  it('counts down from GOAL and never reaches 0', () => {
    expect(answersToMastery(level, [])).toBe(GOAL)
    expect(answersToMastery(level, times(3, right()))).toBe(GOAL - 3)
    expect(answersToMastery(level, [...times(3, right()), wrong, wrong])).toBe(GOAL - 3)
    expect(answersToMastery(level, times(GOAL + 5, right()))).toBe(1)
  })
})
