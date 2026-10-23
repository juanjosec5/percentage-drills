// The level ladder. Like a Kumon workbook, each level drills one small step and builds on the
// ones before it: find 10%, 5% and 1% instantly, then combine them for everything else.
// Text comes out as messages with raw numbers (see src/i18n), so it renders in any language.
import { msg, type Msg } from '@/i18n'

import { applyChange, percentOf } from './math'
import { int, multiple, pick, type Rng } from './rng'

/** A stretch of the bar, in percent of the base: [from, to]. */
export interface Segment {
  from: number
  to: number
  kind: 'base' | 'add' | 'remove' | 'part'
  label: Msg
}

/** What the breakdown view draws after each answer. */
export interface Breakdown {
  /** The whole the bar stands for (100%). */
  base: number
  segments: Segment[]
  /** Step-by-step lines, e.g. "10% of 70 = 7 · ÷ 10". */
  steps: Msg[]
  /** The last line: how the pieces combine into the answer. */
  result: Msg
}

export interface Problem {
  prompt: Msg
  answer: number
  breakdown: Breakdown
}

export interface Level {
  id: string
  title: Msg
  /** The tip shown on a level's first problem. Mixed has none: it only reuses earlier tricks. */
  strategy?: Msg
  /** Target seconds per problem to count as fast enough for mastery. */
  targetSeconds: number
  generate: (rng: Rng) => Problem
}

type Piece = { pct: number; sign: 1 | -1; how: Msg }

/** pct% of base, built from pieces laid end to end on the bar (removals cut back from the end). */
function built(
  pct: number,
  base: number,
  pieces: Piece[],
  prompt = msg('prompt.of', { pct, base }),
): Problem {
  const values = pieces.map((p) => percentOf(p.pct, base))
  const segments: Segment[] = []
  let cursor = 0
  pieces.forEach((p, i) => {
    const from = p.sign > 0 ? cursor : cursor - p.pct
    const to = p.sign > 0 ? cursor + p.pct : cursor
    segments.push({
      from,
      to,
      kind: p.sign > 0 ? 'add' : 'remove',
      label: msg('segment.piece', { sign: p.sign > 0 ? '' : '−', pct: p.pct, value: values[i] }),
    })
    cursor += p.sign * p.pct
  })
  const answer = percentOf(pct, base)
  // "7 + 3.5": signs and numbers only, so the sum itself needs no translation.
  const sum = values.flatMap((v, i) => (i ? [pieces[i].sign > 0 ? ' + ' : ' − ', v] : [v]))
  return {
    prompt,
    answer,
    breakdown: {
      base,
      segments,
      steps: pieces.map((p, i) =>
        msg('step.pieceOf', { pct: p.pct, base, value: values[i], how: p.how }),
      ),
      result:
        pieces.length > 1
          ? msg('result.sum', { pct, sum, answer })
          : msg('result.single', { pct, answer }),
    },
  }
}

const TEN: Piece = { pct: 10, sign: 1, how: msg('how.ten') }
const FIVE: Piece = { pct: 5, sign: 1, how: msg('how.five') }
const ONE: Piece = { pct: 1, sign: 1, how: msg('how.one') }

// Each multi-step percentage, written as the pieces you build it from.
const BUILDS: Record<number, Piece[]> = {
  12: [TEN, ONE, ONE],
  15: [TEN, FIVE],
  19: [
    { pct: 20, sign: 1, how: msg('how.doubled') },
    { ...ONE, sign: -1 },
  ],
  35: [{ pct: 30, sign: 1, how: msg('how.triple') }, FIVE],
  45: [
    { pct: 50, sign: 1, how: msg('how.half') },
    { ...FIVE, sign: -1 },
  ],
  90: [
    { pct: 100, sign: 1, how: msg('how.whole') },
    { ...TEN, sign: -1 },
  ],
}

const FRACTIONS: Record<number, Msg> = {
  50: msg('how.half'),
  25: msg('how.quarter'),
  75: msg('how.threeQuarters'),
  20: msg('how.fifth'),
}

type LevelId =
  | 'ten-any'
  | 'five'
  | 'one'
  | 'tens'
  | 'fractions'
  | 'fifteen'
  | 'build'
  | 'swap'
  | 'what-percent'
  | 'change'
  | 'mixed'

/** A level's title and strategy live in the dictionaries under its id. */
const text = (id: Exclude<LevelId, 'mixed'>) => ({
  id,
  title: msg(`level.${id}.title`),
  strategy: msg(`level.${id}.strategy`),
})

const LADDER: Level[] = [
  {
    // Big numbers, so moving the decimal point is the whole skill. Half are round (whole
    // answers), half aren't (one decimal). The id predates the merge with "round numbers".
    ...text('ten-any'),
    targetSeconds: 7,
    generate: (rng) =>
      built(10, rng() < 0.5 ? multiple(rng, 10, 1000, 99_990) : int(rng, 1001, 99_999), [TEN]),
  },
  {
    ...text('five'),
    targetSeconds: 8,
    generate: (rng) => {
      const b = multiple(rng, 10, 20, 900)
      return built(5, b, [{ pct: 5, sign: 1, how: msg('how.fiveOf', { ten: b / 10 }) }])
    },
  },
  {
    ...text('one'),
    targetSeconds: 6,
    generate: (rng) => built(1, int(rng, 50, 999), [ONE]),
  },
  {
    ...text('tens'),
    targetSeconds: 9,
    generate: (rng) => {
      // One step, not k identical 10% pieces: k equal slices made a noisy, clipped bar.
      const k = int(rng, 2, 9)
      const b = multiple(rng, 10, 20, 500)
      const how = msg('how.timesTen', { ten: percentOf(10, b), k })
      return built(k * 10, b, [{ pct: k * 10, sign: 1, how }])
    },
  },
  {
    ...text('fractions'),
    targetSeconds: 9,
    generate: (rng) => {
      const pct = pick(rng, [50, 25, 75, 20])
      return built(pct, multiple(rng, 20, 20, 400), [{ pct, sign: 1, how: FRACTIONS[pct] }])
    },
  },
  {
    ...text('fifteen'),
    targetSeconds: 10,
    generate: (rng) => built(15, multiple(rng, 10, 20, 500), BUILDS[15]),
  },
  {
    ...text('build'),
    targetSeconds: 14,
    generate: (rng) => {
      const pct = pick(rng, [12, 19, 35, 45, 90])
      return built(pct, multiple(rng, 10, 20, 500), BUILDS[pct])
    },
  },
  {
    ...text('swap'),
    targetSeconds: 10,
    generate: (rng) => {
      const b = pick(rng, [25, 50])
      const pct = b === 25 ? multiple(rng, 4, 4, 96) : multiple(rng, 2, 2, 98)
      const p = built(
        b,
        pct,
        [{ pct: b, sign: 1, how: FRACTIONS[b] }],
        msg('prompt.of', { pct, base: b }),
      )
      p.breakdown.steps.unshift(msg('step.swap', { a: pct, b }))
      return p
    },
  },
  {
    ...text('what-percent'),
    targetSeconds: 12,
    generate: (rng) => {
      const pct = pick(rng, [5, 10, 20, 25, 40, 50, 60, 75, 80])
      const whole = multiple(rng, 20, 20, 400)
      const part = percentOf(pct, whole)
      return {
        prompt: msg('prompt.whatPercent', { part, whole }),
        answer: pct,
        breakdown: {
          base: whole,
          segments: [
            { from: 0, to: pct, kind: 'part', label: msg('segment.value', { value: part }) },
          ],
          steps: [msg('step.fraction', { part, whole }), msg('step.simplify', { pct })],
          result: msg('result.whatPercent', { part, pct, whole }),
        },
      }
    },
  },
  {
    ...text('change'),
    targetSeconds: 14,
    generate: (rng) => {
      const pct = pick(rng, [5, 10, 15, 20, 25, 50])
      const up = rng() < 0.5
      const b = multiple(rng, 20, 20, 400)
      const delta = percentOf(pct, b)
      const answer = applyChange(b, up ? pct : -pct)
      const op = up ? '+' : '−'
      return {
        prompt: msg('prompt.change', { base: b, op, pct }),
        answer,
        breakdown: {
          base: b,
          segments: [
            { from: 0, to: 100, kind: 'base', label: msg('segment.base', { base: b }) },
            {
              from: up ? 100 : 100 - pct,
              to: up ? 100 + pct : 100,
              kind: up ? 'add' : 'remove',
              label: msg('segment.piece', { sign: op, pct, value: delta }),
            },
          ],
          steps: [msg('step.of', { pct, base: b, value: delta })],
          result: msg('result.change', { base: b, op, delta, answer }),
        },
      }
    },
  },
]

// The last level reviews everything before it.
export const LEVELS: Level[] = [
  ...LADDER,
  {
    id: 'mixed',
    title: msg('level.mixed.title'),
    targetSeconds: 12,
    generate: (rng) => pick(rng, LADDER).generate(rng),
  },
]

/** Share of problems drawn from earlier levels so old skills stay sharp. */
export const REVIEW_SHARE = 0.3

/**
 * The next problem at a level, plus the index of the level it came from (an earlier one
 * when it's a review problem). Avoids repeating the previous prompt.
 */
export function nextProblem(
  levelIndex: number,
  rng: Rng,
  previous?: Msg,
): { problem: Problem; levelIndex: number } {
  const last = JSON.stringify(previous)
  for (let tries = 0; ; tries++) {
    const review = levelIndex > 0 && rng() < REVIEW_SHARE
    const from = review ? int(rng, 0, levelIndex - 1) : levelIndex
    const problem = LEVELS[from].generate(rng)
    if (JSON.stringify(problem.prompt) !== last || tries > 10) return { problem, levelIndex: from }
  }
}
