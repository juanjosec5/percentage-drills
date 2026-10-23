import { onBeforeUnmount, ref } from 'vue'

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

export function seconds(ms: number): string {
  return (ms / 1000).toFixed(1) + 's'
}
