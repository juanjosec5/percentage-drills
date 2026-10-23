import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

import { LEVELS } from '@/engine/levels'
import { GOAL } from '@/engine/mastery'
import { DAILY_COUNT, normalize, useProgress } from '@/stores/progress'

const fast = (correct: boolean) => ({ correct, ms: 1000 })

beforeEach(() => setActivePinia(createPinia()))

describe('progress.record', () => {
  it('unlocks the next level on the GOAL-th right, on-time answer', () => {
    const progress = useProgress()
    for (let i = 0; i < GOAL - 1; i++) expect(progress.record(0, fast(true), 'endless')).toBe(false)
    expect(progress.record(0, fast(true), 'endless')).toBe(true)
    expect(progress.unlocked).toBe(1)
  })

  it('lets wrong answers neither count nor set the learner back', () => {
    const progress = useProgress()
    for (let i = 0; i < GOAL - 1; i++) progress.record(0, fast(true), 'endless')
    expect(progress.record(0, fast(false), 'endless')).toBe(false)
    expect(progress.record(0, fast(false), 'endless')).toBe(false)
    expect(progress.unlocked).toBe(0)
    expect(progress.record(0, fast(true), 'endless')).toBe(true)
  })

  it('does not unlock from a review answer at an earlier level', () => {
    const progress = useProgress()
    progress.unlocked = 2
    for (let i = 0; i < GOAL; i++) expect(progress.record(0, fast(true), 'endless')).toBe(false)
    expect(progress.unlocked).toBe(2)
  })
})

describe('progress.allMastered', () => {
  it('turns on once the last level is mastered, which has nothing to unlock', () => {
    const progress = useProgress()
    const last = LEVELS.length - 1
    progress.unlocked = last
    expect(progress.allMastered).toBe(false)
    for (let i = 0; i < GOAL; i++) expect(progress.record(last, fast(true), 'endless')).toBe(false)
    expect(progress.unlocked).toBe(last)
    expect(progress.allMastered).toBe(true)
  })
})

describe('normalize', () => {
  it('gives defaults for nothing or junk', () => {
    for (const raw of [null, undefined, {}, 'x', 42, []])
      expect(normalize(raw)).toEqual({
        unlocked: 0,
        history: {},
        days: {},
        settings: { showTimer: true },
      })
  })

  it('keeps an older save (before settings existed) and fills in settings', () => {
    const legacy = { unlocked: 3, history: { tens: [{ correct: true, ms: 900 }] }, days: {} }
    expect(normalize(legacy)).toEqual({ ...legacy, settings: { showTimer: true } })
  })

  it('repairs fields a partial save broke', () => {
    expect(normalize({ unlocked: 'x' }).unlocked).toBe(0)
    expect(normalize({ unlocked: 2.5 }).unlocked).toBe(0)
    expect(normalize({ unlocked: 99 }).unlocked).toBe(LEVELS.length - 1)
    expect(normalize({ settings: { showTimer: 'no' } }).settings.showTimer).toBe(true)
  })
})

describe('settings', () => {
  // Vitest runs in node, which has no localStorage: give the store an in-memory one.
  beforeEach(() => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('saves the timer choice', async () => {
    useProgress().setShowTimer(false)
    await nextTick()
    setActivePinia(createPinia())
    expect(useProgress().settings.showTimer).toBe(false)
  })

  it('keeps settings when progress is reset', () => {
    const progress = useProgress()
    progress.setShowTimer(false)
    progress.unlocked = 4
    progress.reset()
    expect(progress.unlocked).toBe(0)
    expect(progress.settings.showTimer).toBe(false)
  })
})

describe('progress.streak', () => {
  it('counts a day of endless practice, not only the daily set', () => {
    const progress = useProgress()
    for (let i = 0; i < DAILY_COUNT; i++) progress.record(0, fast(true), 'endless')
    expect(progress.today.daily).toBe(0)
    expect(progress.streak).toBe(1)
  })
})
