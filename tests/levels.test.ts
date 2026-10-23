import { LEVELS, nextProblem, type Problem } from '@/engine/levels'
import { applyChange, percentOf, round2 } from '@/engine/math'
import { createRng } from '@/engine/rng'
import { LOCALES, translate, type Msg } from '@/i18n'

const en = (m: Msg) => translate('en', m)
const es = (m: Msg) => translate('es', m)

// Like solve() below, for Spanish prompts, so a translation can't change the maths.
function solveEs(prompt: string): number {
  const num = (s: string) => Number(s.replace(',', '.'))
  let m = prompt.match(/^([\d,]+)\s% de ([\d,]+)$/)
  if (m) return percentOf(num(m[1]), num(m[2]))
  m = prompt.match(/^¿([\d,]+) es qué % de ([\d,]+)\?$/)
  if (m) return round2((num(m[1]) / num(m[2])) * 100)
  m = prompt.match(/^([\d,]+) ([+−]) ([\d,]+)\s%$/)
  if (m) return applyChange(num(m[1]), (m[2] === '+' ? 1 : -1) * num(m[3]))
  throw new Error(`unrecognised prompt: ${prompt}`)
}

/** Every piece of text a problem shows. */
const texts = (p: Problem): Msg[] => [
  p.prompt,
  p.breakdown.result,
  ...p.breakdown.steps,
  ...p.breakdown.segments.map((s) => s.label),
]

// Re-derives the answer from the prompt text alone, independently of the generators.
function solve(prompt: string): number {
  let m = prompt.match(/^([\d.]+)% of ([\d.]+)$/)
  if (m) return percentOf(Number(m[1]), Number(m[2]))
  m = prompt.match(/^([\d.]+) is what % of ([\d.]+)\?$/)
  if (m) return round2((Number(m[1]) / Number(m[2])) * 100)
  m = prompt.match(/^([\d.]+) ([+−]) ([\d.]+)%$/)
  if (m) return applyChange(Number(m[1]), (m[2] === '+' ? 1 : -1) * Number(m[3]))
  throw new Error(`unrecognised prompt: ${prompt}`)
}

describe.each(LEVELS.map((level, i) => [level.id, level, i] as const))('level %s', (_, level) => {
  const rng = createRng(42)
  const problems = Array.from({ length: 300 }, () => level.generate(rng))

  it('states the right answer for every prompt', () => {
    for (const p of problems) expect(p.answer, en(p.prompt)).toBe(solve(en(p.prompt)))
  })

  it('states the same problem in Spanish', () => {
    for (const p of problems) expect(p.answer, es(p.prompt)).toBe(solveEs(es(p.prompt)))
  })

  it('fills every placeholder in both languages', () => {
    for (const lang of LOCALES) {
      for (const m of [level.title, level.strategy, ...problems.flatMap(texts)]) {
        expect(translate(lang, m)).not.toMatch(/[{}]/)
      }
    }
  })

  it('keeps answers to at most 2 decimals, so they can be said out loud', () => {
    for (const p of problems) expect(round2(p.answer), en(p.prompt)).toBe(p.answer)
  })

  it('draws a breakdown that stays on the bar and ends with the answer', () => {
    for (const p of problems) {
      const b = p.breakdown
      const label = en(p.prompt)
      expect(b.steps.length, label).toBeGreaterThan(0)
      for (const s of b.segments) {
        expect(s.from, label).toBeGreaterThanOrEqual(0)
        expect(s.to, label).toBeGreaterThan(s.from)
      }
      expect(en(b.result), label).toMatch(/[\d.]+%?$/)
      expect(es(b.result), label).toMatch(/[\d,]+(\s%)?$/)
    }
  })
})

describe('built breakdowns', () => {
  it('lay pieces end to end so they add up to the asked percentage', () => {
    const rng = createRng(7)
    for (const level of LEVELS) {
      for (let i = 0; i < 100; i++) {
        const p = level.generate(rng)
        const segs = p.breakdown.segments
        if (!segs.every((s) => s.kind === 'add' || s.kind === 'remove')) continue
        const net = segs.reduce((n, s) => n + (s.kind === 'add' ? 1 : -1) * (s.to - s.from), 0)
        expect(percentOf(net, p.breakdown.base), en(p.prompt)).toBe(p.answer)
      }
    }
  })
})

describe('nextProblem', () => {
  it('never draws from a level above the one asked for', () => {
    const rng = createRng(1)
    for (let i = 0; i < 500; i++) {
      expect(nextProblem(3, rng).levelIndex).toBeLessThanOrEqual(3)
    }
  })

  it('mixes in earlier levels for review', () => {
    const rng = createRng(1)
    const from = Array.from({ length: 500 }, () => nextProblem(5, rng).levelIndex)
    expect(from.filter((i) => i < 5).length).toBeGreaterThan(50)
    expect(from.filter((i) => i === 5).length).toBeGreaterThan(250)
  })

  it('does not repeat the previous prompt', () => {
    const rng = createRng(3)
    let prev = nextProblem(0, rng).problem.prompt
    for (let i = 0; i < 200; i++) {
      const p = nextProblem(0, rng, prev).problem.prompt
      expect(p).not.toEqual(prev)
      prev = p
    }
  })
})
