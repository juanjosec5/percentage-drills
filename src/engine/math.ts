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

const formatters = new Map<string, Intl.NumberFormat>()

/** U+202F, the narrow no-break space: groups digits in both locales and never wraps. */
export const GROUP = '\u202f'

/**
 * Display a number the way people say it: no trailing zeros (unless `digits` fixes them), the
 * locale's decimal mark (10.5, 10,5) and thousands grouped by a thin space (43 720). Not by a
 * comma or point: parseAnswer would read 1,000 as 1, and Spanish uses the comma for decimals.
 */
export function fmt(n: number, lang = 'en', digits?: number): string {
  const id = `${lang}:${digits}`
  let f = formatters.get(id)
  if (!f) {
    f = new Intl.NumberFormat(lang, {
      useGrouping: false,
      minimumFractionDigits: digits ?? 0,
      maximumFractionDigits: digits ?? 2,
    })
    formatters.set(id, f)
  }
  // Only the whole part can match: maximumFractionDigits is at most 2.
  return f.format(digits === undefined ? round2(n) : n).replace(/\B(?=(\d{3})+(?!\d))/g, GROUP)
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
