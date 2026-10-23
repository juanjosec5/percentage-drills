// The level ladder. Like a Kumon workbook, each level drills one small step and builds on the
// ones before it: find 10%, 5% and 1% instantly, then combine them for everything else.
import { applyChange, fmt, percentOf } from './math'
import { int, multiple, pick, type Rng } from './rng'

/** A stretch of the bar, in percent of the base: [from, to]. */
export interface Segment {
  from: number
  to: number
  kind: 'base' | 'add' | 'remove' | 'part'
  label: string
}

/** What the breakdown view draws after each answer. */
export interface Breakdown {
  /** The whole the bar stands for (100%). */
  base: number
  /** How far the bar extends, in percent (above 100 for increases). */
  scale: number
  segments: Segment[]
  /** Step-by-step lines, e.g. "10% of 70 = 7 · move the decimal". */
  steps: string[]
  /** The last line: how the pieces combine into the answer. */
  result: string
}

export interface Problem {
  prompt: string
  answer: number
  breakdown: Breakdown
}

export interface Level {
  id: string
  title: string
  /** One-line strategy shown on the level card. */
  strategy: string
  /** Target seconds per problem to count as fast enough for mastery. */
  targetSeconds: number
  generate: (rng: Rng) => Problem
}

type Piece = { pct: number; sign: 1 | -1; how: string }

/** pct% of base, built from pieces laid end to end on the bar (removals cut back from the end). */
function built(pct: number, base: number, pieces: Piece[], prompt = `${pct}% of ${base}`): Problem {
  const segments: Segment[] = []
  let cursor = 0
  for (const p of pieces) {
    const from = p.sign > 0 ? cursor : cursor - p.pct
    const to = p.sign > 0 ? cursor + p.pct : cursor
    segments.push({ from, to, kind: p.sign > 0 ? 'add' : 'remove', label: `${p.pct}%` })
    cursor += p.sign * p.pct
  }
  const answer = percentOf(pct, base)
  const values = pieces.map((p) => fmt(percentOf(p.pct, base)))
  const sum =
    pieces.length > 1
      ? `${values.map((v, i) => (i ? (pieces[i].sign > 0 ? ' + ' : ' − ') + v : v)).join('')} = `
      : ''
  return {
    prompt,
    answer,
    breakdown: {
      base,
      scale: 100,
      segments,
      steps: pieces.map((p, i) => `${p.pct}% of ${base} = ${values[i]} · ${p.how}`),
      result: `${pct}% = ${sum}${fmt(answer)}`,
    },
  }
}

const TEN: Piece = { pct: 10, sign: 1, how: 'move the decimal one place left' }
const FIVE: Piece = { pct: 5, sign: 1, how: 'half of 10%' }
const ONE: Piece = { pct: 1, sign: 1, how: 'move the decimal two places left' }

// Each multi-step percentage, written as the pieces you build it from.
const BUILDS: Record<number, Piece[]> = {
  12: [TEN, ONE, ONE],
  15: [TEN, FIVE],
  19: [
    { pct: 20, sign: 1, how: '10% doubled' },
    { ...ONE, sign: -1 },
  ],
  35: [{ pct: 30, sign: 1, how: '10% times 3' }, FIVE],
  45: [
    { pct: 50, sign: 1, how: 'half' },
    { ...FIVE, sign: -1 },
  ],
  90: [
    { pct: 100, sign: 1, how: 'the whole thing' },
    { ...TEN, sign: -1 },
  ],
}

const FRACTIONS: Record<number, string> = {
  50: 'half',
  25: 'half, then half again',
  75: 'the whole minus a quarter',
  20: 'divide by 5',
}

const LADDER: Level[] = [
  {
    id: 'ten-round',
    title: '10% of round numbers',
    strategy: 'Move the decimal one place left: 10% of 70 is 7.',
    targetSeconds: 5,
    generate: (rng) => built(10, multiple(rng, 10, 20, 990), [TEN]),
  },
  {
    id: 'ten-any',
    title: '10% of any number',
    strategy: 'Same move, now with decimals: 10% of 83 is 8.3.',
    targetSeconds: 6,
    generate: (rng) => built(10, int(rng, 11, 999), [TEN]),
  },
  {
    id: 'five',
    title: '5%',
    strategy: '5% is half of 10%: 10% of 70 is 7, so 5% is 3.5.',
    targetSeconds: 8,
    generate: (rng) => {
      const b = multiple(rng, 10, 20, 900)
      return built(5, b, [{ pct: 5, sign: 1, how: `half of 10% (${fmt(b / 10)})` }])
    },
  },
  {
    id: 'one',
    title: '1%',
    strategy: 'Move the decimal two places left: 1% of 450 is 4.5.',
    targetSeconds: 6,
    generate: (rng) => built(1, int(rng, 50, 999), [ONE]),
  },
  {
    id: 'tens',
    title: '20%, 30% … 90%',
    strategy: 'Find 10%, then multiply: 30% of 70 is 3 × 7 = 21.',
    targetSeconds: 9,
    generate: (rng) => {
      const k = int(rng, 2, 9)
      return built(k * 10, multiple(rng, 10, 20, 500), Array(k).fill(TEN))
    },
  },
  {
    id: 'fractions',
    title: '50%, 25%, 75%, 20%',
    strategy: 'Think in fractions: 50% is ½, 25% is ¼, 75% is ¾, 20% is ⅕.',
    targetSeconds: 9,
    generate: (rng) => {
      const pct = pick(rng, [50, 25, 75, 20])
      return built(pct, multiple(rng, 20, 20, 400), [{ pct, sign: 1, how: FRACTIONS[pct] }])
    },
  },
  {
    id: 'fifteen',
    title: '15%',
    strategy: '10% + 5%: for 70 that is 7 + 3.5 = 10.5.',
    targetSeconds: 10,
    generate: (rng) => built(15, multiple(rng, 10, 20, 500), BUILDS[15]),
  },
  {
    id: 'build',
    title: 'Build it: 12%, 19%, 35%, 45%, 90%',
    strategy: 'Add or subtract the easy pieces: 19% is 20% − 1%.',
    targetSeconds: 14,
    generate: (rng) => {
      const pct = pick(rng, [12, 19, 35, 45, 90])
      return built(pct, multiple(rng, 10, 20, 500), BUILDS[pct])
    },
  },
  {
    id: 'swap',
    title: 'The swap trick',
    strategy: 'x% of y equals y% of x: 16% of 25 is 25% of 16 = 4.',
    targetSeconds: 10,
    generate: (rng) => {
      const b = pick(rng, [25, 50])
      const pct = b === 25 ? multiple(rng, 4, 4, 96) : multiple(rng, 2, 2, 98)
      const p = built(b, pct, [{ pct: b, sign: 1, how: FRACTIONS[b] }], `${pct}% of ${b}`)
      p.breakdown.steps.unshift(`Swap it: ${pct}% of ${b} is the same as ${b}% of ${pct}`)
      return p
    },
  },
  {
    id: 'what-percent',
    title: 'What percent is it?',
    strategy: 'Make a fraction and simplify: 14 of 70 is 1/5, which is 20%.',
    targetSeconds: 12,
    generate: (rng) => {
      const pct = pick(rng, [5, 10, 20, 25, 40, 50, 60, 75, 80])
      const whole = multiple(rng, 20, 20, 400)
      const part = percentOf(pct, whole)
      return {
        prompt: `${fmt(part)} is what % of ${whole}?`,
        answer: pct,
        breakdown: {
          base: whole,
          scale: 100,
          segments: [{ from: 0, to: pct, kind: 'part', label: fmt(part) }],
          steps: [`Write it as a fraction: ${fmt(part)} / ${whole}`, `Simplify: ${pct} / 100`],
          result: `${fmt(part)} is ${pct}% of ${whole}`,
        },
      }
    },
  },
  {
    id: 'change',
    title: 'Increase and decrease',
    strategy: 'Find the percentage, then add or subtract it: 80 − 15% is 80 − 12 = 68.',
    targetSeconds: 14,
    generate: (rng) => {
      const pct = pick(rng, [5, 10, 15, 20, 25, 50])
      const up = rng() < 0.5
      const b = multiple(rng, 20, 20, 400)
      const delta = fmt(percentOf(pct, b))
      const answer = applyChange(b, up ? pct : -pct)
      return {
        prompt: `${b} ${up ? '+' : '−'} ${pct}%`,
        answer,
        breakdown: {
          base: b,
          scale: up ? 100 + pct : 100,
          segments: [
            { from: 0, to: 100, kind: 'base', label: String(b) },
            up
              ? { from: 100, to: 100 + pct, kind: 'add', label: `+${delta}` }
              : { from: 100 - pct, to: 100, kind: 'remove', label: `−${delta}` },
          ],
          steps: [`${pct}% of ${b} = ${delta}`],
          result: `${b} ${up ? '+' : '−'} ${delta} = ${fmt(answer)}`,
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
    title: 'Mixed review',
    strategy: 'Every strategy so far, shuffled. Pick the fastest route for each one.',
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
  previous?: string,
): { problem: Problem; levelIndex: number } {
  for (let tries = 0; ; tries++) {
    const review = levelIndex > 0 && rng() < REVIEW_SHARE
    const from = review ? int(rng, 0, levelIndex - 1) : levelIndex
    const problem = LEVELS[from].generate(rng)
    if (problem.prompt !== previous || tries > 10) return { problem, levelIndex: from }
  }
}
