import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

import { LEVELS } from '@/engine/levels'
import { GOAL } from '@/engine/mastery'
import { PLACEMENT_MAX } from '@/engine/placement'
import { CONFIRM, DAILY_COUNT, normalize, useProgress } from '@/stores/progress'
import { SAVE_VERSION } from '@/stores/save'

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
        version: SAVE_VERSION,
        unlocked: 0,
        history: {},
        days: {},
        settings: { showTimer: true, offeredPlacement: false },
        placedUpTo: 0,
      })
  })

  it('keeps an older save (before settings existed) and fills in settings', () => {
    const legacy = { unlocked: 3, history: { tens: [{ correct: true, ms: 900 }] }, days: {} }
    expect(normalize(legacy)).toEqual({
      ...legacy,
      // Old level 4 is level 3 since the two 10% levels merged (v4).
      unlocked: 2,
      version: SAVE_VERSION,
      settings: { showTimer: true, offeredPlacement: false },
      placedUpTo: 0,
    })
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

describe('storage persistence', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('asks once, on the first recorded answer, not on load', () => {
    const persist = vi.fn(() => Promise.resolve(true))
    vi.stubGlobal('navigator', { storage: { persist } })
    const progress = useProgress()
    expect(persist).not.toHaveBeenCalled()
    progress.record(0, fast(true), 'endless')
    progress.record(0, fast(false), 'endless')
    expect(persist).toHaveBeenCalledTimes(1)
  })

  it('records the answer where the API is missing or refuses', () => {
    vi.stubGlobal('navigator', {})
    useProgress().record(0, fast(true), 'endless')
    setActivePinia(createPinia())
    vi.stubGlobal('navigator', { storage: { persist: () => Promise.reject(new Error('no')) } })
    const progress = useProgress()
    progress.record(0, fast(true), 'endless')
    expect(progress.today.answered).toBe(1)
  })
})

describe('progress.restore', () => {
  it('replaces progress from a backup and keeps settings', () => {
    const progress = useProgress()
    progress.setShowTimer(false)
    progress.record(0, fast(true), 'daily')
    const backup = normalize({
      unlocked: 4,
      history: { tens: [{ correct: true, ms: 800 }] },
      days: {},
      settings: { showTimer: true },
      placedUpTo: 0,
    })
    progress.restore(backup)
    expect(progress.snapshot()).toEqual({
      ...backup,
      settings: { showTimer: false, offeredPlacement: false },
    })
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

describe('placement', () => {
  it('unlocks without writing any answers, and marks skipped levels as placed', () => {
    const progress = useProgress()
    expect(progress.canPlace).toBe(true)
    progress.place(4)
    expect(progress.unlocked).toBe(4)
    expect(progress.history).toEqual({})
    expect(progress.today.answered).toBe(0)
    expect(progress.isPlaced(3)).toBe(true)
    expect(progress.isPlaced(4)).toBe(false)
  })

  it('stays on offer after answering, until it could no longer open a higher level', () => {
    const progress = useProgress()
    progress.record(0, fast(true), 'endless')
    expect(progress.canPlace).toBe(true)
    progress.place(PLACEMENT_MAX - 1)
    expect(progress.canPlace).toBe(true)
    progress.place(PLACEMENT_MAX)
    expect(progress.canPlace).toBe(false)
  })

  it('turns a placed level into a mastered one after CONFIRM review answers there', () => {
    const progress = useProgress()
    progress.place(4)
    for (let i = 0; i < CONFIRM; i++) progress.record(1, fast(true), 'endless')
    expect(progress.isPlaced(1)).toBe(false)
    expect(progress.isPlaced(2)).toBe(true)
  })

  it('never moves the learner back down', () => {
    const progress = useProgress()
    progress.unlocked = 5
    progress.place(2)
    expect(progress.unlocked).toBe(5)
  })

  it('is cleared by reset', () => {
    const progress = useProgress()
    progress.place(3)
    progress.reset()
    expect(progress.placedUpTo).toBe(0)
    expect(progress.canPlace).toBe(true)
  })
})
