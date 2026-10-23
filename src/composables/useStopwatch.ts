import { onBeforeUnmount, ref } from 'vue'

import { msg, type Msg } from '@/i18n'

/** A stopwatch that ticks every animation frame while running. */
export function useStopwatch() {
  const ms = ref(0)
  let startedAt = 0
  let frame = 0

  function tick() {
    ms.value = performance.now() - startedAt
    frame = requestAnimationFrame(tick)
  }

  function start() {
    cancelAnimationFrame(frame)
    startedAt = performance.now()
    ms.value = 0
    frame = requestAnimationFrame(tick)
  }

  /** Stops the clock and returns the elapsed time. */
  function stop(): number {
    cancelAnimationFrame(frame)
    ms.value = performance.now() - startedAt
    return ms.value
  }

  onBeforeUnmount(() => cancelAnimationFrame(frame))

  return { ms, start, stop }
}

/** "1.2s" / "1,2 s", once translated. */
export function seconds(ms: number): Msg {
  return msg('seconds', { s: ms / 1000 })
}
