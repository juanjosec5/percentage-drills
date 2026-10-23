// Percentage arithmetic and answer grading.

/** Rounds to 2 decimals, which also clears float noise like 10.500000000000002. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function percentOf(pct: number, base: number): number {
  return round2((pct * base) / 100)
}

export function whatPercent(part: number, whole: number): number {
  return round2((part / whole) * 100)
}

/** `base` changed by `pct` percent; a negative pct is a decrease. */
export function applyChange(base: number, pct: number): number {
  return round2(base * (1 + pct / 100))
}

/** Display a number the way people say it: no trailing zeros. */
export function fmt(n: number): string {
  return String(round2(n))
}

/**
 * Parses what the learner typed. Accepts a decimal comma (10,5) as well as a point,
 * and ignores spaces, a trailing % and a leading $. Returns null when it isn't a number.
 */
export function parseAnswer(input: string): number | null {
  const cleaned = input
    .trim()
    .replace(/\s+/g, '')
    .replace(/^\$/, '')
    .replace(/%$/, '')
    .replace(',', '.')
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null
  return Number(cleaned)
}

export function isCorrect(input: string, answer: number): boolean {
  const n = parseAnswer(input)
  return n !== null && round2(n) === round2(answer)
}
