// Seeded PRNG (mulberry32) so a worksheet can be reproduced in tests.
export type Rng = () => number

export function createRng(seed = Date.now()): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Integer in [min, max], inclusive. */
export function int(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

export function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]
}

/** A multiple of `step` in [min, max]. */
export function multiple(rng: Rng, step: number, min: number, max: number): number {
  return step * int(rng, Math.ceil(min / step), Math.floor(max / step))
}

/** An index into `weights`, drawn in proportion to them. */
export function weighted(rng: Rng, weights: readonly number[]): number {
  let r = rng() * weights.reduce((sum, w) => sum + w, 0)
  for (const [i, w] of weights.entries()) if ((r -= w) < 0) return i
  return weights.length - 1
}
