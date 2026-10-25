// The saved format, kept apart from the store so it can be checked without Vue: what a save looks
// like, how an older one is upgraded, and how anything read back (storage or an imported file)
// is validated before the app trusts it.
import { LEVELS } from '@/engine/levels'
import type { Answer } from '@/engine/mastery'

/** Still `v1`: renaming the key would strand every existing save. The format version is inside. */
export const KEY = 'percent-drills:v1'
export const SAVE_VERSION = 4
/**
 * Answers kept per level. Mastery counts on-time right answers in here, so the cap sits far above
 * GOAL: even a learner who misses most of them reaches GOAL long before old ones drop off.
 */
export const HISTORY_CAP = 200

export interface Day {
  answered: number
  correct: number
  totalMs: number
  bestMs: number | null
}

export interface Settings {
  /** Show the running clock while answering. Timing and mastery are the same either way. */
  showTimer: boolean
  /** The in-drill "too easy?" offer was shown; it appears once, ever. */
  offeredPlacement: boolean
}

export interface Saved {
  version: number
  unlocked: number
  history: Record<string, Answer[]>
  days: Record<string, Day>
  settings: Settings
  /** Levels below this index were skipped by the placement ladder rather than practised. */
  placedUpTo: number
}

const DEFAULT_SETTINGS: Settings = { showTimer: true, offeredPlacement: false }

type Raw = Record<string, unknown>

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0

/**
 * migrations[i] upgrades a save from version i + 1 to i + 2. A step only reshapes: normalize()
 * validates whatever comes out, so steps don't need their own checks.
 */
export const migrations: ((save: Raw) => Raw)[] = [
  // 1 → 2: v1 had no version field. The shape didn't change; v2 adds the field and validation.
  (save) => save,
  // 2 → 3: adds placedUpTo; normalize() fills in 0, since no earlier save was placed.
  (save) => save,
  // 3 → 4: "10% · round numbers" (index 0) merged into "10% · any number", which keeps its id
  // and history. Every level after it moves down one.
  (save) => {
    const down = (v: unknown) => (Number.isInteger(v) ? Math.max((v as number) - 1, 0) : v)
    const history = isObject(save.history) ? { ...save.history } : save.history
    if (isObject(history)) delete history['ten-round']
    return { ...save, unlocked: down(save.unlocked), placedUpTo: down(save.placedUpTo), history }
  },
]

/** Saves without a version predate versioning: v1. */
export function versionOf(raw: Raw): number {
  return Number.isInteger(raw.version) && (raw.version as number) >= 1 ? (raw.version as number) : 1
}

export function migrate(raw: Raw): Raw {
  let save = raw
  // A save from a newer build (version past ours) runs no steps: normalize keeps what it knows.
  for (let v = versionOf(raw); v < SAVE_VERSION; v++) save = migrations[v - 1](save)
  return save
}

function answersOf(v: unknown[]): Answer[] {
  return v
    .filter((a): a is Answer => isObject(a) && typeof a.correct === 'boolean' && isCount(a.ms))
    .map(({ correct, ms }) => ({ correct, ms }))
    .slice(-HISTORY_CAP)
}

/** A day with no valid answer count is dropped; its other totals fall back to zero. */
function dayOf(v: unknown): Day | null {
  if (!isObject(v) || !isCount(v.answered)) return null
  return {
    answered: v.answered,
    correct: isCount(v.correct) ? v.correct : 0,
    totalMs: isCount(v.totalMs) ? v.totalMs : 0,
    bestMs: isCount(v.bestMs) ? v.bestMs : null,
  }
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Accepts whatever was stored, upgrades it and rebuilds it from valid parts only: bad answers and
 * days are dropped, and missing fields come from defaults, so a partial, older or hand-edited
 * save can't leave the app with `unlocked: NaN` or an answer without a time.
 *
 * Days are never pruned: streakOf walks back through them, so dropping old ones would cap streaks.
 */
export function normalize(raw: unknown): Saved {
  const s = migrate(isObject(raw) ? raw : {})
  const unlocked = Number.isInteger(s.unlocked) ? (s.unlocked as number) : 0
  const settings = isObject(s.settings) ? s.settings : {}

  const history: Saved['history'] = {}
  if (isObject(s.history))
    for (const [id, list] of Object.entries(s.history))
      if (Array.isArray(list)) history[id] = answersOf(list)

  const days: Saved['days'] = {}
  if (isObject(s.days))
    for (const [key, value] of Object.entries(s.days)) {
      const day = DAY_KEY.test(key) ? dayOf(value) : null
      if (day) days[key] = day
    }

  const level = Math.min(Math.max(unlocked, 0), LEVELS.length - 1)
  const placed = Number.isInteger(s.placedUpTo) ? (s.placedUpTo as number) : 0
  return {
    version: SAVE_VERSION,
    unlocked: level,
    placedUpTo: Math.min(Math.max(placed, 0), level),
    history,
    days,
    settings: {
      showTimer:
        typeof settings.showTimer === 'boolean' ? settings.showTimer : DEFAULT_SETTINGS.showTimer,
      offeredPlacement:
        typeof settings.offeredPlacement === 'boolean'
          ? settings.offeredPlacement
          : DEFAULT_SETTINGS.offeredPlacement,
    },
  }
}

/**
 * Reads an exported file. Null unless it parses and has the three progress fields, so another
 * app's JSON is turned away instead of silently becoming an empty save.
 */
export function parseBackup(text: string): Saved | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (!isObject(raw) || !('unlocked' in raw && 'history' in raw && 'days' in raw)) return null
  return normalize(raw)
}

export const backupName = (day: string) => `percent-drills-${day}.json`
