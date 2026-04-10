/**
 * cursorThrottle — Phase 05.4b Wave 2, Unit 2.1
 *
 * Frame-interval throttle using performance.now() for monotonic timing.
 * Returns a stable wrapper that only forwards calls to `fn` when at least
 * `intervalMs` milliseconds have elapsed since the last forwarded call.
 *
 * 20fps cap → intervalMs = 50.
 */

/**
 * Returns a throttled version of `fn` that executes at most once per
 * `intervalMs` milliseconds, using performance.now() for timing.
 */
export function throttleByFrameInterval<T>(
  fn: (arg: T) => void,
  intervalMs: number
): (arg: T) => void {
  let lastCalledAt = -Infinity

  return (arg: T): void => {
    const now = performance.now()
    if (now - lastCalledAt >= intervalMs) {
      lastCalledAt = now
      fn(arg)
    }
  }
}
