// The ladder grouped into three worlds, so the map and placement share one idea of
// "beginner", "intermediate" and "advanced".
import { LEVELS } from './levels'

export type WorldId = 'beginner' | 'intermediate' | 'advanced'

export interface World {
  id: WorldId
  /** First and last level index in the world, inclusive. */
  from: number
  to: number
}

export const WORLDS: World[] = [
  // 10%, 5%, 1%, 20%…90%: the building blocks.
  { id: 'beginner', from: 0, to: 3 },
  // Fractions, 15%, built percentages and the swap trick: combining the blocks.
  { id: 'intermediate', from: 4, to: 7 },
  // What %, increase/decrease and the mixed review.
  { id: 'advanced', from: 8, to: LEVELS.length - 1 },
]

/** The index into WORLDS of the world a level belongs to. */
export const worldOf = (levelIndex: number) =>
  WORLDS.findIndex((w) => levelIndex >= w.from && levelIndex <= w.to)
