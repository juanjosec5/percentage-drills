// A forgiving streak: one missed day a week doesn't reset it. A habit survives a single missed day
// (Lally et al. 2010), and a streak that drops to 0 over one sick day teaches people to give up.

/** Rest days must be at least this many days apart. */
export const REST_GAP = 7
/** Far enough back for any real streak; stops the walk on corrupt data. */
const MAX_DAYS = 3650

export function dayKey(d = new Date()): string {
  return d.toLocaleDateString('sv') // YYYY-MM-DD in local time
}

export interface Streak {
  /** Practised days in the current run (rest days don't count). */
  days: number
  /** Missed days the run was allowed to skip, newest first. */
  restDays: string[]
}

/**
 * Walks back from today (or from yesterday, while today isn't practised yet). A missed day is
 * forgiven when the day before it was practised and no other rest day is within REST_GAP days;
 * otherwise the run ends there. Two missed days in a row always end it.
 */
export function streakOf(practised: (key: string) => boolean, today = new Date()): Streak {
  const d = new Date(today)
  d.setHours(12)
  if (!practised(dayKey(d))) d.setDate(d.getDate() - 1)

  let days = 0
  const restDays: string[] = []
  let lastRest: Date | null = null
  for (let i = 0; i < MAX_DAYS; i++, d.setDate(d.getDate() - 1)) {
    if (practised(dayKey(d))) {
      days++
      continue
    }
    const before = new Date(d)
    before.setDate(before.getDate() - 1)
    const gapOk = !lastRest || Math.round((+lastRest - +d) / 86_400_000) >= REST_GAP
    if (!practised(dayKey(before)) || !gapOk) break
    restDays.push(dayKey(d))
    lastRest = new Date(d)
  }
  return { days, restDays: days ? restDays : [] }
}
