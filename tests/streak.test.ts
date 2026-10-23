import { dayKey, streakOf } from '@/engine/streak'

// Today is Friday 2026-10-23 in every case; offsets count back from it.
const TODAY = new Date(2026, 9, 23, 9)
const ago = (n: number) => {
  const d = new Date(TODAY)
  d.setDate(d.getDate() - n)
  return dayKey(d)
}
/** Builds a "practised" check from the offsets that were practised. */
const on = (...offsets: number[]) => {
  const set = new Set(offsets.map(ago))
  return (key: string) => set.has(key)
}

describe('streakOf', () => {
  it('counts consecutive practised days', () => {
    expect(streakOf(on(0, 1, 2, 3, 4), TODAY)).toEqual({ days: 5, restDays: [] })
  })

  it('forgives a single missed day', () => {
    // P M P P (today first)
    expect(streakOf(on(0, 2, 3), TODAY)).toEqual({ days: 3, restDays: [ago(1)] })
  })

  it('ends on two missed days in a row', () => {
    expect(streakOf(on(0, 3), TODAY).days).toBe(1)
  })

  it('allows rest days 7 days apart but not 6', () => {
    // Rest days at 1 and 8 ago: allowed.
    const sevenApart = on(0, 2, 3, 4, 5, 6, 7, 9, 10)
    expect(streakOf(sevenApart, TODAY)).toEqual({ days: 9, restDays: [ago(1), ago(8)] })
    // Rest days at 1 and 7 ago: the second one ends the run.
    const sixApart = on(0, 2, 3, 4, 5, 6, 8, 9)
    expect(streakOf(sixApart, TODAY)).toEqual({ days: 6, restDays: [ago(1)] })
  })

  it("doesn't drop the streak while today isn't practised yet", () => {
    expect(streakOf(on(1, 2, 3), TODAY).days).toBe(3)
  })

  it('keeps it, provisionally, when yesterday was missed and today not done yet', () => {
    expect(streakOf(on(2, 3), TODAY)).toEqual({ days: 2, restDays: [ago(1)] })
  })

  it('is zero with nothing practised', () => {
    expect(streakOf(on(), TODAY)).toEqual({ days: 0, restDays: [] })
  })
})
