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

const formatters = new Map<number | undefined, Intl.NumberFormat>()

/**
 * Display a number the way people say it: no trailing zeros (unless `digits` fixes them) and a
 * decimal point, the same in every language. No thousands separator: the owner found 60,850
 * confusing next to an answer typed as plain digits, so what's shown matches what's typed.
 */
export function fmt(n: number, digits?: number): string {
  let f = formatters.get(digits)
  if (!f) {
    f = new Intl.NumberFormat('en-US', {
      useGrouping: false,
      minimumFractionDigits: digits ?? 0,
      maximumFractionDigits: digits ?? 2,
    })
    formatters.set(digits, f)
  }
  return f.format(digits === undefined ? round2(n) : n)
}

/** Comma thousands, as a learner might still type them: 15,034 or 1,503.4. */
const THOUSANDS = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/

/**
 * Parses what the learner typed. Ignores spaces, a trailing % and a leading $. Commas in groups
 * of three are thousands (15,034); any other comma is a decimal mark (10,5), since a Spanish
 * phone's number pad has no point. Answers never need 3 decimals, so "1,503" is never ambiguous.
 * Returns null when it isn't a number.
 */
export function parseAnswer(input: string): number | null {
  let cleaned = input.trim().replace(/\s+/g, '').replace(/^\$/, '').replace(/%$/, '')
  cleaned = THOUSANDS.test(cleaned) ? cleaned.replaceAll(',', '') : cleaned.replace(',', '.')
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null
  return Number(cleaned)
}

export function isCorrect(input: string, answer: number): boolean {
  const n = parseAnswer(input)
  return n !== null && round2(n) === round2(answer)
}
