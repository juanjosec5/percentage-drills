import { atRest, easeOutBack, spring, squashScale, step } from '@/composables/jelly'

describe('jelly springs', () => {
  it('overshoot their target, then settle on it', () => {
    const s = spring(380, 11)
    s.target = 1
    let peak = 0
    for (let i = 0; i < 120; i++) {
      step(s, 1 / 60)
      peak = Math.max(peak, s.x)
    }
    expect(peak).toBeGreaterThan(1)
    expect(atRest(s)).toBe(true)
    expect(s.x).toBeCloseTo(1, 3)
  })

  it('stay stable with a long frame', () => {
    const s = spring(520, 7)
    s.v = 300
    step(s, 0.05)
    expect(Number.isFinite(s.x)).toBe(true)
    expect(Math.abs(s.x)).toBeLessThan(50)
  })
})

describe('squashScale', () => {
  it('keeps the area: flatter means wider', () => {
    const { sx, sy } = squashScale(-0.3)
    expect(sy).toBeCloseTo(0.7)
    expect(sx * sy).toBeCloseTo(1)
  })

  it('never lets a puddle spread off the rail or vanish', () => {
    const { sx, sy } = squashScale(-0.95)
    expect(sy).toBeGreaterThanOrEqual(0.2)
    expect(sx).toBeLessThanOrEqual(2.1)
  })
})

describe('easeOutBack', () => {
  it('starts at 0, swings past 1, ends at 1', () => {
    expect(easeOutBack(0)).toBeCloseTo(0)
    expect(Math.max(...[0.6, 0.7, 0.8, 0.9].map(easeOutBack))).toBeGreaterThan(1)
    expect(easeOutBack(1)).toBeCloseTo(1)
  })
})
