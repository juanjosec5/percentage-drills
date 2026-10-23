import { LEVELS, nextProblem } from '@/engine/levels'
import { applyChange, percentOf, round2 } from '@/engine/math'
import { createRng } from '@/engine/rng'

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
    for (const p of problems) expect(p.answer, p.prompt).toBe(solve(p.prompt))
  })

  it('keeps answers to at most 2 decimals, so they can be said out loud', () => {
    for (const p of problems) expect(round2(p.answer), p.prompt).toBe(p.answer)
  })

  it('draws a breakdown that stays on the bar and ends with the answer', () => {
    for (const p of problems) {
      const b = p.breakdown
      expect(b.steps.length, p.prompt).toBeGreaterThan(0)
      for (const s of b.segments) {
        expect(s.from, p.prompt).toBeGreaterThanOrEqual(0)
        expect(s.to, p.prompt).toBeGreaterThan(s.from)
      }
      expect(b.result, p.prompt).toMatch(/[\d.]+%?$/)
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
        expect(percentOf(net, p.breakdown.base), p.prompt).toBe(p.answer)
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
      expect(p).not.toBe(prev)
      prev = p
    }
  })
})
