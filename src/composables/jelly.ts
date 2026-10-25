// Damped springs for Plip's jelly: a value pulled toward its target, overshooting and settling
// the way a soft body does. Stepped per frame from PlipAlive; kept free of Vue so it can be tested.

export interface Spring {
  x: number
  v: number
  target: number
  /** Stiffness: how hard it pulls toward the target. */
  k: number
  /** Damping: how quickly the wobble dies away. */
  c: number
}

export const spring = (k: number, c: number): Spring => ({ x: 0, v: 0, target: 0, k, c })

/** Sub-step size in seconds: small enough to stay stable at the stiffest spring used. */
const H = 0.004

/** Advances a spring by `dt` seconds (semi-implicit Euler, sub-stepped). */
export function step(s: Spring, dt: number) {
  const n = Math.max(1, Math.ceil(dt / H))
  const h = dt / n
  for (let i = 0; i < n; i++) {
    s.v += (-s.k * (s.x - s.target) - s.c * s.v) * h
    s.x += s.v * h
  }
}

export const atRest = (s: Spring) => Math.abs(s.x - s.target) < 1e-3 && Math.abs(s.v) < 1e-2

/**
 * A squash of `squash` (0 = at rest, negative = flatter, positive = taller) as x/y scales that keep
 * the body's area: flatter means wider. Clamped so a puddle doesn't spread off the rail.
 */
export function squashScale(squash: number): { sx: number; sy: number } {
  const sy = Math.max(0.2, 1 + squash)
  return { sx: Math.min(2.1, Math.max(0.7, 1 / sy)), sy }
}

/** 0→1 with a small overshoot past 1 before settling: a spin that swings a little too far. */
export function easeOutBack(p: number): number {
  const c = 1.6
  const q = p - 1
  return 1 + (c + 1) * q ** 3 + c * q ** 2
}
