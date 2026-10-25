// Short vibrations for wins, on phones that support them (Android browsers; iPhone Safari has no
// Vibration API, so there the toggle is hidden and nothing buzzes). A device preference, kept
// apart from the progress save like the language: a backup moved to another phone shouldn't
// carry it.
import { ref } from 'vue'

const KEY = 'percent-drills:haptics'

/** Patterns in ms: a tap for a right answer, a quick triple for a finished level. Never for a
 * wrong one: a buzz there would punish, not reward. */
export const BUZZ = {
  right: 15,
  levelUp: [20, 60, 20, 60, 40],
} as const

export const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator

function load(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
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

function buzz(pattern: number | readonly number[]) {
  if (canVibrate && enabled.value) navigator.vibrate(pattern as number | number[])
}

export function useHaptics() {
  return { enabled, setEnabled, buzz }
}
