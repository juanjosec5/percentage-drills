// Short vibrations for wins, and only for wins: a counted answer, a finished level, a cleared
// world. Never for a slow, review or wrong answer: silence says "didn't count" without scolding.
//
// Android browsers have the Vibration API. iPhone Safari has none; from iOS 18 a native switch
// input plays the system's haptic tick when toggled, so a hidden one stands in there. That's
// undocumented (Apple may drop it, and it can't be checked), it gives one fixed tick, and only
// inside a tap, so on iPhone it's off until the learner turns the 📳 switch on.
//
// The on/off choice is a device preference, kept out of the progress save like the language.
import { ref } from 'vue'

const KEY = 'percent-drills:haptics'

/** Patterns in ms. No pulse over 60ms and no pattern over 300ms in all. */
export const BUZZ = {
  /** A right answer that filled a pip. */
  right: 15,
  /** A counted answer that also reached the day's goal: one combined signal, not two. */
  day: [15, 70, 25],
  /** The level-up burst on Home. */
  levelUp: [20, 60, 20, 60, 40],
  /** Plip landing on the next level. */
  land: 12,
  /** A world's check passed in "Find my level". */
  cleared: [15, 60, 15],
} as const

/** Buzzes closer together than this are dropped, not queued. */
const GAP_MS = 400
/** A buzz must follow the learner's own tap or key within this long: a reward, never a ping. */
const AFTER_INPUT_MS = 6000

const hasVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator
const iosSwitch =
  !hasVibrate &&
  typeof navigator !== 'undefined' &&
  /iPhone/.test(navigator.userAgent) &&
  'switch' in HTMLInputElement.prototype
export const canVibrate = hasVibrate || iosSwitch

function load(): boolean {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) return saved === 'on'
  } catch {
    // Storage blocked: fall back to the default.
  }
  // On by default where it's a real API; opt-in where it's the iPhone workaround.
  return !iosSwitch
}

const enabled = ref(load())

function setEnabled(on: boolean) {
  enabled.value = on
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    // Storage blocked: the choice just won't persist.
  }
}

let lastBuzz = -Infinity
let lastInput = -Infinity
if (canVibrate) {
  const mark = () => (lastInput = performance.now())
  addEventListener('pointerdown', mark, true)
  addEventListener('keydown', mark, true)
}

let iosLabel: HTMLLabelElement | undefined
/** Toggling a native switch plays the iPhone's haptic tick; it must happen inside a tap. */
function iosTick() {
  if (!iosLabel) {
    iosLabel = document.createElement('label')
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    input.tabIndex = -1
    iosLabel.append(input)
    iosLabel.setAttribute('aria-hidden', 'true')
    iosLabel.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none'
    document.body.append(iosLabel)
  }
  iosLabel.click()
}

function buzz(pattern: number | readonly number[]) {
  if (!canVibrate || !enabled.value) return
  const now = performance.now()
  if (now - lastBuzz < GAP_MS || now - lastInput > AFTER_INPUT_MS) return
  lastBuzz = now
  if (hasVibrate) navigator.vibrate(pattern as number | number[])
  else iosTick()
}

/** Longest pattern, in ms: after this nothing can still be playing. */
const LONGEST_MS = 300

/** Cuts a pattern short, e.g. when the learner skips the moment it belonged to. Only while one
 * may still be playing: otherwise there's nothing to stop. */
function stop() {
  if (hasVibrate && performance.now() - lastBuzz < LONGEST_MS) navigator.vibrate(0)
}

export function useHaptics() {
  return { enabled, setEnabled, buzz, stop }
}
