import { createPinia, setActivePinia } from 'pinia'

import { WINDOW } from '@/engine/mastery'
import { useProgress } from '@/stores/progress'

const fast = (correct: boolean) => ({ correct, ms: 1000 })

beforeEach(() => setActivePinia(createPinia()))

describe('progress.record', () => {
  it('unlocks the next level once the window is mastered', () => {
    const progress = useProgress()
    for (let i = 0; i < WINDOW - 1; i++)
      expect(progress.record(0, fast(true), 'endless')).toBe(false)
    expect(progress.record(0, fast(true), 'endless')).toBe(true)
    expect(progress.unlocked).toBe(1)
  })

  it('never finishes a level on a wrong answer, even when the window would pass', () => {
    const progress = useProgress()
    for (let i = 0; i < WINDOW - 1; i++) progress.record(0, fast(true), 'endless')
    // 9 right + 1 wrong is 90%, enough to pass, but the wrong answer must not trigger it.
    expect(progress.record(0, fast(false), 'endless')).toBe(false)
    expect(progress.unlocked).toBe(0)
    expect(progress.record(0, fast(true), 'endless')).toBe(true)
  })

  it('does not unlock from a review answer at an earlier level', () => {
    const progress = useProgress()
    progress.unlocked = 2
    for (let i = 0; i < WINDOW; i++) expect(progress.record(0, fast(true), 'endless')).toBe(false)
    expect(progress.unlocked).toBe(2)
  })
})
