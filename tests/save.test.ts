import { LEVELS } from '@/engine/levels'
import {
  backupName,
  HISTORY_CAP,
  migrate,
  migrations,
  normalize,
  parseBackup,
  SAVE_VERSION,
  serialize,
  versionOf,
} from '@/stores/save'

const R = { correct: true, ms: 900 }
const DAY = { answered: 10, correct: 9, totalMs: 20_000, bestMs: 900 }
/** A save as v1 wrote it: no version field. */
const V1 = {
  unlocked: 3,
  history: { one: [R, { correct: false, ms: 4000 }], tens: [] },
  days: { '2026-10-22': DAY, '2026-10-23': { ...DAY, bestMs: null } },
  settings: { showTimer: false },
}
/** V1 as this version stores it: levels by id. Old level 4 is "1%" since the 10% levels merged. */
const STORED = {
  version: SAVE_VERSION,
  current: 'one',
  placedUpTo: 'ten-any',
  challenges: {},
  history: V1.history,
  days: V1.days,
  settings: { showTimer: false, offeredPlacement: false },
}
/** What the app works with for either of them. */
const LOADED = {
  version: SAVE_VERSION,
  unlocked: 2,
  placedUpTo: 0,
  challenges: {},
  history: V1.history,
  days: V1.days,
  settings: STORED.settings,
}

describe('versions', () => {
  it('has one migration per version step', () => {
    expect(migrations).toHaveLength(SAVE_VERSION - 1)
  })

  it('reads a save without a version as v1', () => {
    expect(versionOf({})).toBe(1)
    expect(versionOf({ version: 'x' })).toBe(1)
    expect(versionOf({ version: 0 })).toBe(1)
    expect(versionOf({ version: 2 })).toBe(2)
  })

  it('migrates v1 → v3 without changing the data', () => {
    expect(migrations[0](structuredClone(V1))).toEqual(V1)
    expect(migrations[1](structuredClone(V1))).toEqual(V1)
  })

  it('migrates v3 → v4: the two 10% levels merged, so later levels move down one', () => {
    const v4 = migrations[2]
    expect(v4({ unlocked: 0, placedUpTo: 0 })).toMatchObject({ unlocked: 0, placedUpTo: 0 })
    // On "10% · any number": same level, now index 0, with its history kept.
    expect(v4({ unlocked: 1, history: { 'ten-any': [R] } })).toMatchObject({
      unlocked: 0,
      history: { 'ten-any': [R] },
    })
    expect(v4({ unlocked: 5, placedUpTo: 4 })).toMatchObject({ unlocked: 4, placedUpTo: 3 })
    expect(v4({ history: { 'ten-round': [R], one: [R] } }).history).toEqual({ one: [R] })
    // Junk passes through for normalize() to repair.
    expect(v4({ unlocked: 'x', history: 'y' })).toMatchObject({ unlocked: 'x', history: 'y' })
  })

  it('migrates v4 → v5: levels by id, and challenges passed for every border already crossed', () => {
    const v5 = migrations[3]
    expect(v5({ unlocked: 2, placedUpTo: 1 })).toEqual({
      current: 'one',
      placedUpTo: 'five',
      challenges: {},
    })
    // Past Beginner's last level (3) but not Intermediate's (7).
    expect(v5({ unlocked: 4 })).toMatchObject({
      current: 'fractions',
      challenges: { beginner: 10 },
    })
    expect(v5({ unlocked: 10 })).toMatchObject({
      current: 'mixed',
      challenges: { beginner: 10, intermediate: 10 },
    })
    // On a world's last level the challenge is still ahead.
    expect(v5({ unlocked: 7 }).challenges).toEqual({ beginner: 10 })
    expect(v5({ unlocked: 99 }).current).toBe('mixed')
    expect(v5({ unlocked: 'x' })).toMatchObject({ current: undefined, challenges: {} })
  })

  it('loads a v1 save, stamped with the current version and its level moved down one', () => {
    expect(normalize(structuredClone(V1))).toEqual(LOADED)
  })

  it('runs no steps on a current or newer save', () => {
    expect(migrate(STORED)).toBe(STORED)
    const newer = { ...STORED, version: SAVE_VERSION + 1 }
    expect(migrate(newer)).toBe(newer)
    expect(normalize(newer)).toEqual(LOADED)
  })

  it('stores levels by id, and reads them back', () => {
    expect(serialize(LOADED)).toEqual(STORED)
    expect(normalize(serialize(LOADED))).toEqual(LOADED)
  })

  it('starts over from an id this build has no level for', () => {
    expect(normalize({ ...STORED, current: 'gone' }).unlocked).toBe(0)
  })
})

describe('normalize: corrupt entries', () => {
  it('drops answers that are not {correct: boolean, ms: number}', () => {
    const history = {
      one: [
        R,
        null,
        'x',
        [],
        { correct: 'yes', ms: 900 },
        { correct: true },
        { correct: true, ms: -1 },
        { correct: true, ms: Infinity },
        { correct: false, ms: '900' },
        { correct: false, ms: 1200, extra: 1 },
      ],
      tens: 'not a list',
    }
    expect(normalize({ history }).history).toEqual({
      one: [R, { correct: false, ms: 1200 }],
    })
  })

  it('caps each level at HISTORY_CAP answers, keeping the newest', () => {
    const many = Array.from({ length: HISTORY_CAP + 5 }, (_, i) => ({ correct: true, ms: i }))
    const kept = normalize({ history: { one: many } }).history.one
    expect(kept).toHaveLength(HISTORY_CAP)
    expect(kept[0].ms).toBe(5)
  })

  it('drops days with a bad key or no answer count, and repairs their other totals', () => {
    const days = {
      '2026-10-20': DAY,
      '2026-10-21': { answered: 12, correct: 'x', totalMs: null, bestMs: -3 },
      '2026-10-22': { answered: -1 },
      '2026-10-23': 'x',
      yesterday: DAY,
    }
    expect(normalize({ days }).days).toEqual({
      '2026-10-20': DAY,
      '2026-10-21': { answered: 12, correct: 0, totalMs: 0, bestMs: null },
    })
  })

  it('keeps every old day, so long streaks survive', () => {
    const days = Object.fromEntries(
      Array.from({ length: 1000 }, (_, i) => [
        new Date(2020, 0, 1 + i).toLocaleDateString('sv'),
        DAY,
      ]),
    )
    expect(Object.keys(normalize({ days }).days)).toHaveLength(1000)
  })

  it('treats non-object history, days and settings as empty', () => {
    expect(
      normalize({
        version: SAVE_VERSION,
        current: 'one',
        history: [R],
        days: [DAY],
        settings: 'x',
      }),
    ).toEqual({
      version: SAVE_VERSION,
      unlocked: 2,
      history: {},
      days: {},
      settings: { showTimer: true, offeredPlacement: false },
      placedUpTo: 0,
      challenges: {},
    })
  })

  it('keeps only real challenge scores, capped at a full run', () => {
    const challenges = { beginner: 12, intermediate: 'x', advanced: 4, nowhere: 3 }
    expect(normalize({ ...STORED, challenges }).challenges).toEqual({ beginner: 10 })
    expect(normalize({ ...STORED, challenges: { beginner: 6.5 } }).challenges).toEqual({
      beginner: 6,
    })
  })
})

describe('backups', () => {
  it('round-trips a save through a file', () => {
    const saved = normalize({ ...V1, unlocked: LEVELS.length })
    expect(parseBackup(JSON.stringify(serialize(saved)))).toEqual(saved)
  })

  it('imports a v1-shaped file too', () => {
    expect(parseBackup(JSON.stringify(V1))).toEqual(LOADED)
  })

  it('cleans a hand-edited file instead of trusting it', () => {
    const file = { ...V1, history: { one: [R, { correct: 1, ms: 5 }] } }
    expect(parseBackup(JSON.stringify(file))?.history).toEqual({ one: [R] })
  })

  it('rejects anything that is not a Percent Drills save', () => {
    for (const text of ['', 'not json', 'null', '42', '[]', '{}', '{"name":"other app"}'])
      expect(parseBackup(text), text).toBeNull()
  })

  it('names the file by day', () => {
    expect(backupName('2026-10-23')).toBe('percent-drills-2026-10-23.json')
  })
})

describe('placedUpTo', () => {
  it('defaults to 0 and never exceeds the unlocked level', () => {
    const v = SAVE_VERSION
    expect(normalize({ version: v, current: 'one' }).placedUpTo).toBe(0)
    expect(normalize({ version: v, current: 'one', placedUpTo: 'fifteen' }).placedUpTo).toBe(2)
    expect(normalize({ version: v, current: 'fractions', placedUpTo: 'x' }).placedUpTo).toBe(0)
  })
})
