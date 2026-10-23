import { LEVELS } from '@/engine/levels'
import {
  backupName,
  HISTORY_CAP,
  migrate,
  migrations,
  normalize,
  parseBackup,
  SAVE_VERSION,
  versionOf,
} from '@/stores/save'

const R = { correct: true, ms: 900 }
const DAY = { answered: 10, correct: 9, totalMs: 20_000, bestMs: 900, daily: 10 }
/** A save as v1 wrote it: no version field. */
const V1 = {
  unlocked: 3,
  history: { one: [R, { correct: false, ms: 4000 }], tens: [] },
  days: { '2026-10-22': DAY, '2026-10-23': { ...DAY, bestMs: null } },
  settings: { showTimer: false },
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

  it('migrates v1 → v2 without changing the data', () => {
    expect(migrations[0](structuredClone(V1))).toEqual(V1)
    expect(migrate(structuredClone(V1))).toEqual(V1)
  })

  it('loads a v1 save unchanged, stamped with the current version', () => {
    expect(normalize(structuredClone(V1))).toEqual({ ...V1, version: SAVE_VERSION, placedUpTo: 0 })
  })

  it('runs no steps on a current or newer save', () => {
    const current = { ...V1, version: SAVE_VERSION }
    expect(migrate(current)).toBe(current)
    const newer = { ...V1, version: SAVE_VERSION + 1 }
    expect(migrate(newer)).toBe(newer)
    expect(normalize(newer)).toEqual({ ...V1, version: SAVE_VERSION, placedUpTo: 0 })
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
      '2026-10-21': { answered: 12, correct: 0, totalMs: 0, bestMs: null, daily: 0 },
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
    expect(normalize({ unlocked: 2, history: [R], days: [DAY], settings: 'x' })).toEqual({
      version: SAVE_VERSION,
      unlocked: 2,
      history: {},
      days: {},
      settings: { showTimer: true },
      placedUpTo: 0,
    })
  })
})

describe('backups', () => {
  it('round-trips a save through a file', () => {
    const saved = normalize({ ...V1, unlocked: LEVELS.length - 1 })
    expect(parseBackup(JSON.stringify(saved))).toEqual(saved)
  })

  it('imports a v1-shaped file too', () => {
    expect(parseBackup(JSON.stringify(V1))).toEqual({ ...V1, version: SAVE_VERSION, placedUpTo: 0 })
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
    expect(normalize({ unlocked: 2 }).placedUpTo).toBe(0)
    expect(normalize({ unlocked: 2, placedUpTo: 5 }).placedUpTo).toBe(2)
    expect(normalize({ unlocked: 4, placedUpTo: 'x' }).placedUpTo).toBe(0)
  })
})
