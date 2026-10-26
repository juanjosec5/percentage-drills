// The saved format, kept apart from the store so it can be checked without Vue: what a save looks
// like, how an older one is upgraded, and how anything read back (storage or an imported file)
// is validated before the app trusts it.
import { CHALLENGE_SIZE, hasChallenge } from '@/engine/challenge'
import { LEVELS } from '@/engine/levels'
import type { Answer } from '@/engine/mastery'
import { INTERVALS, type Spacing } from '@/engine/spaced'
import { WORLDS, type WorldId } from '@/engine/worlds'

/** Still `v1`: renaming the key would strand every existing save. The format version is inside. */
export const KEY = 'percent-drills:v1'
export const SAVE_VERSION = 5
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

/** Each world challenge's best score, 0..CHALLENGE_SIZE; a full score passed it. */
export type Challenges = Partial<Record<WorldId, number>>

/** Progress as the app uses it: levels by their place in LEVELS. */
export interface Saved {
  version: number
  unlocked: number
  history: Record<string, Answer[]>
  days: Record<string, Day>
  settings: Settings
  /** Levels below this index were skipped by the placement ladder rather than practised. */
  placedUpTo: number
  challenges: Challenges
  /** Spaced review of each mastered level, by level id. */
  spaced: Record<string, Spacing>
}

/**
 * Progress as it's stored and exported: levels by id, not position, so adding or reordering
 * levels never needs another migration of the frontier.
 */
export interface Stored extends Omit<Saved, 'unlocked' | 'placedUpTo'> {
  /** The current level. */
  current: string
  /** The first level placement didn't skip. */
  placedUpTo: string
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
  // 4 → 5: levels by id instead of index, and world challenges. Anyone already past a world's
  // border is past its challenge too: nobody gets locked back. Uses v4's own ladder and borders,
  // frozen here, so later changes to LEVELS can't change what this step does.
  (save) => {
    const ids = V4_IDS
    const idAt = (v: unknown) =>
      Number.isInteger(v) ? ids[Math.min(Math.max(v as number, 0), ids.length - 1)] : undefined
    const challenges: Challenges = {}
    if (Number.isInteger(save.unlocked))
      for (const [world, last] of Object.entries(V4_LAST))
        if ((save.unlocked as number) > last) challenges[world as WorldId] = CHALLENGE_SIZE
    const { unlocked, ...rest } = save
    return { ...rest, current: idAt(unlocked), placedUpTo: idAt(save.placedUpTo), challenges }
  },
]

/** The v4 ladder, in order, and the last level of each world that now ends in a challenge. */
const V4_IDS = [
  'ten-any',
  'five',
  'one',
  'tens',
  'fractions',
  'fifteen',
  'build',
  'swap',
  'what-percent',
  'change',
  'mixed',
]
const V4_LAST: Record<string, number> = { beginner: 3, intermediate: 7 }

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

  // An unknown id (hand-edited, or a level this build doesn't have) starts from the beginning.
  const indexOf = (id: unknown) =>
    Math.max(
      LEVELS.findIndex((l) => l.id === id),
      0,
    )
  const level = indexOf(s.current)

  const challenges: Challenges = {}
  if (isObject(s.challenges))
    for (const [w, world] of WORLDS.entries()) {
      const best = s.challenges[world.id]
      if (hasChallenge(w) && isCount(best))
        challenges[world.id] = Math.min(Math.floor(best), CHALLENGE_SIZE)
    }

  // Added without a version bump: a save without it just starts its schedule from today.
  const spaced: Saved['spaced'] = {}
  if (isObject(s.spaced))
    for (const [id, v] of Object.entries(s.spaced))
      if (
        isObject(v) &&
        Number.isInteger(v.stage) &&
        (v.stage as number) >= 0 &&
        (v.stage as number) < INTERVALS.length &&
        typeof v.last === 'string' &&
        DAY_KEY.test(v.last)
      )
        spaced[id] = { stage: v.stage as number, last: v.last }

  return {
    version: SAVE_VERSION,
    unlocked: level,
    placedUpTo: Math.min(indexOf(s.placedUpTo), level),
    challenges,
    spaced,
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

/** The stored form of progress: see Stored. */
export function serialize({ unlocked, placedUpTo, ...rest }: Saved): Stored {
  return { ...rest, current: LEVELS[unlocked].id, placedUpTo: LEVELS[placedUpTo].id }
}

/**
 * Reads an exported file. Null unless it parses and has the progress fields (any version's), so another
 * app's JSON is turned away instead of silently becoming an empty save.
 */
export function parseBackup(text: string): Saved | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  const hasLevel = isObject(raw) && ('current' in raw || 'unlocked' in raw)
  if (!isObject(raw) || !hasLevel || !('history' in raw && 'days' in raw)) return null
  return normalize(raw)
}

export const backupName = (day: string) => `percent-drills-${day}.json`
