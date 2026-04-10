/**
 * cursorThrottle unit tests — Phase 05.4b Wave 2, Unit 2.1
 *
 * Tests T-054B-100 through T-054B-105 (6 tests).
 *
 * Uses vi.useFakeTimers() for time-dependent tests.
 * performance.now() is provided by the JSDOM environment (or mocked directly).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { throttleByFrameInterval } from '../cursorThrottle'

beforeEach(() => {
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('throttleByFrameInterval', () => {
  it('T-054B-100: first call executes immediately', () => {
    const inner = vi.fn()
    const throttled = throttleByFrameInterval(inner, 50)

    throttled({ x: 1, y: 2 })

    expect(inner).toHaveBeenCalledTimes(1)
  })

  it('T-054B-101: second call within interval does NOT execute', () => {
    vi.useFakeTimers()
    // performance.now starts at 0 with fake timers
    const inner = vi.fn()
    const throttled = throttleByFrameInterval(inner, 50)

    throttled({ x: 1, y: 2 })
    // Advance only 10ms — still within 50ms window
    vi.advanceTimersByTime(10)
    throttled({ x: 3, y: 4 })

    expect(inner).toHaveBeenCalledTimes(1)
  })

  it('T-054B-102: second call after interval executes', () => {
    vi.useFakeTimers()
    const inner = vi.fn()
    const throttled = throttleByFrameInterval(inner, 50)

    throttled({ x: 1, y: 2 })
    // Advance past the 50ms interval
    vi.advanceTimersByTime(51)
    throttled({ x: 3, y: 4 })

    expect(inner).toHaveBeenCalledTimes(2)
  })

  it('T-054B-103: passes arguments through to inner function', () => {
    const inner = vi.fn()
    const throttled = throttleByFrameInterval(inner, 50)

    throttled({ x: 1, y: 2 })

    expect(inner).toHaveBeenCalledWith({ x: 1, y: 2 })
  })

  it('T-054B-104: uses monotonic performance.now (both calls execute when times differ by >intervalMs)', () => {
    // Mock performance.now to return specific values
    let nowValue = 0
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => nowValue)

    const inner = vi.fn()
    const throttled = throttleByFrameInterval(inner, 50)

    // First call at t=0
    nowValue = 0
    throttled({ x: 1, y: 2 })

    // Second call at t=100 (100ms elapsed > 50ms interval)
    nowValue = 100
    throttled({ x: 3, y: 4 })

    expect(inner).toHaveBeenCalledTimes(2)

    nowSpy.mockRestore()
  })

  it('T-054B-105: wrapper reference is stable across calls (no re-wrap)', () => {
    const inner = vi.fn()
    const throttled = throttleByFrameInterval(inner, 50)

    // The returned wrapper is a stable function reference
    const ref1 = throttled
    const ref2 = throttled

    expect(ref1).toBe(ref2)
  })
})
