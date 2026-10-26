import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

import { CHALLENGE_SIZE } from '@/engine/challenge'
import { LEVELS } from '@/engine/levels'
import { GOAL } from '@/engine/mastery'
import { PLACEMENT_MAX } from '@/engine/placement'
import { CONFIRM, DAY_GOAL, normalize, useProgress } from '@/stores/progress'
import { WORLDS } from '@/engine/worlds'
import { SAVE_VERSION } from '@/stores/save'

const fast = (correct: boolean) => ({ correct, ms: 1000 })

beforeEach(() => setActivePinia(createPinia()))

describe('progress.record', () => {
  it('unlocks the next level on the GOAL-th right, on-time answer', () => {
    const progress = useProgress()
    for (let i = 0; i < GOAL - 1; i++) expect(progress.record(0, fast(true))).toBe(false)
    expect(progress.record(0, fast(true))).toBe(true)
    expect(progress.unlocked).toBe(1)
  })

  it('lets wrong answers neither count nor set the learner back', () => {
    const progress = useProgress()
    for (let i = 0; i < GOAL - 1; i++) progress.record(0, fast(true))
    expect(progress.record(0, fast(false))).toBe(false)
    expect(progress.record(0, fast(false))).toBe(false)
    expect(progress.unlocked).toBe(0)
    expect(progress.record(0, fast(true))).toBe(true)
  })

  it('does not unlock from a review answer at an earlier level', () => {
    const progress = useProgress()
    progress.unlocked = 2
    for (let i = 0; i < GOAL; i++) expect(progress.record(0, fast(true))).toBe(false)
    expect(progress.unlocked).toBe(2)
  })
})

describe('progress.allMastered', () => {
  it('turns on once the last level is mastered, which has nothing to unlock', () => {
    const progress = useProgress()
    const last = LEVELS.length - 1
    progress.unlocked = last
    expect(progress.allMastered).toBe(false)
    for (let i = 0; i < GOAL; i++) expect(progress.record(last, fast(true))).toBe(false)
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
        challenges: {},
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
      challenges: {},
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
    progress.record(0, fast(true))
    progress.record(0, fast(false))
    expect(persist).toHaveBeenCalledTimes(1)
  })

  it('records the answer where the API is missing or refuses', () => {
    vi.stubGlobal('navigator', {})
    useProgress().record(0, fast(true))
    setActivePinia(createPinia())
    vi.stubGlobal('navigator', { storage: { persist: () => Promise.reject(new Error('no')) } })
    const progress = useProgress()
    progress.record(0, fast(true))
    expect(progress.today.answered).toBe(1)
  })
})

describe('progress.restore', () => {
  it('replaces progress from a backup and keeps settings', () => {
    const progress = useProgress()
    progress.setShowTimer(false)
    progress.record(0, fast(true))
    const backup = normalize({
      unlocked: 4,
      history: { tens: [{ correct: true, ms: 800 }] },
      days: {},
      settings: { showTimer: true },
      placedUpTo: 0,
    })
    progress.restore(backup)
    expect(normalize(progress.snapshot())).toEqual({
      ...backup,
      settings: { showTimer: false, offeredPlacement: false },
    })
  })
})

describe('progress.streak', () => {
  it('any DAY_GOAL answers make the day, and the count for today stops at the goal', () => {
    const progress = useProgress()
    for (let i = 0; i < DAY_GOAL + 3; i++) progress.record(0, fast(i % 2 === 0))
    expect(progress.streak).toBe(1)
    expect(progress.todayAnswered).toBe(DAY_GOAL)
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
    progress.record(0, fast(true))
    expect(progress.canPlace).toBe(true)
    progress.place(PLACEMENT_MAX - 1)
    expect(progress.canPlace).toBe(true)
    progress.place(PLACEMENT_MAX)
    expect(progress.canPlace).toBe(false)
  })

  it('turns a placed level into a mastered one after CONFIRM review answers there', () => {
    const progress = useProgress()
    progress.place(4)
    for (let i = 0; i < CONFIRM; i++) progress.record(1, fast(true))
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

describe('world challenges', () => {
  const finishLevel = (progress: ReturnType<typeof useProgress>, i: number) => {
    let finished = false
    for (let k = 0; k < GOAL; k++) finished = progress.record(i, fast(true))
    return finished
  }
  const beginnerLast = WORLDS[0].to

  it("a world's last level opens its challenge, not the next level", () => {
    const progress = useProgress()
    progress.unlocked = beginnerLast
    expect(progress.step).toBe(beginnerLast)
    expect(finishLevel(progress, beginnerLast)).toBe(true)
    expect(progress.unlocked).toBe(beginnerLast)
    expect(progress.gate).toBe(0)
    expect(progress.step).toBe(beginnerLast + 0.5)
    // More practice there doesn't finish it again.
    expect(progress.record(beginnerLast, fast(true))).toBe(false)
  })

  it('a full run opens the next world; a short one keeps its best and the gate', () => {
    const progress = useProgress()
    progress.unlocked = beginnerLast
    finishLevel(progress, beginnerLast)
    progress.finishChallenge(0, 7)
    progress.finishChallenge(0, 4)
    expect(progress.challenges.beginner).toBe(7)
    expect(progress.gate).toBe(0)
    progress.finishChallenge(0, CHALLENGE_SIZE)
    expect(progress.gate).toBeNull()
    expect(progress.unlocked).toBe(WORLDS[1].from)
  })

  it('replaying a passed challenge moves nothing', () => {
    const progress = useProgress()
    progress.unlocked = 6
    progress.challenges.beginner = CHALLENGE_SIZE
    progress.finishChallenge(0, 3)
    expect(progress.unlocked).toBe(6)
    expect(progress.challenges.beginner).toBe(CHALLENGE_SIZE)
  })

  it('placement past a world counts as passing its challenge', () => {
    const progress = useProgress()
    progress.place(WORLDS[1].from)
    expect(progress.passed(0)).toBe(true)
    expect(progress.passed(1)).toBe(false)
  })

  it('the last world has no challenge: Mixed is its finale', () => {
    const progress = useProgress()
    const last = LEVELS.length - 1
    progress.unlocked = last
    finishLevel(progress, last)
    expect(progress.gate).toBeNull()
    expect(progress.allMastered).toBe(true)
  })

  it('aims reviews at levels with recent misses', () => {
    const progress = useProgress()
    progress.history.five = [fast(false), fast(false)]
    expect(progress.reviewWeights(3)).toEqual([1, 3, 1])
  })
})
