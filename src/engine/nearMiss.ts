// Near misses: wrong answers with a recognisable cause, named in one line so the learner fixes the
// cause rather than just reading the right number. Only exact patterns fire; anything else gets
// the plain "Not quite", since a wrong guess at the cause teaches the wrong lesson.
import { msg, type Msg } from '@/i18n'

import type { Problem } from './levels'
import { parseAnswer, round2 } from './math'

const same = (a: number, b: number) => round2(a) === round2(b)

export function nearMiss(input: string, problem: Problem): Msg | null {
  const n = parseAnswer(input)
  if (n === null || same(n, problem.answer)) return null
  // Increase/decrease first: its slips are more specific than a misplaced decimal point.
  const { key, params } = problem.breakdown.result
  if (key === 'result.change') {
    const { base, op, delta } = params as { base: number; op: string; delta: number }
    if (same(n, delta)) return msg('near.delta')
    if (same(n, op === '+' ? base - delta : base + delta)) return msg('near.sign')
  }
  if (problem.answer !== 0 && [10, 100, 0.1, 0.01].some((k) => same(n, problem.answer * k)))
    return msg('near.decimal')
  return null
}
