/**
 * OPS-02: waitForCsrfToken tests
 *
 * T-0802-001 through T-0802-007, T-0802-F01, T-0802-F02
 *
 * waitForCsrfToken polls document.cookie via getCsrfToken().
 * We control the cookie by writing to document.cookie (jsdom supports it).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { waitForCsrfToken } from '../cookieUtils'

// Clear the CSRF cookie between tests using jsdom cookie API
function clearCsrfCookie() {
  document.cookie = 'csrf-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
}

function setCsrfCookie(value: string) {
  document.cookie = `csrf-token=${encodeURIComponent(value)}; path=/`
}

describe('waitForCsrfToken', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearCsrfCookie()
  })

  afterEach(() => {
    clearCsrfCookie()
    vi.useRealTimers()
  })

  // T-0802-001: returns token immediately when cookie already exists
  it('should return token immediately when CSRF cookie already exists', async () => {
    setCsrfCookie('my-csrf-token')

    const promise = waitForCsrfToken(3000, 100)
    await vi.advanceTimersByTimeAsync(0)
    const token = await promise

    expect(token).toBe('my-csrf-token')
  })

  // T-0802-002: polls and returns token when cookie appears after delay
  it('should poll and return token when cookie appears after a delay', async () => {
    // No cookie at start
    const promise = waitForCsrfToken(3000, 100)

    // Advance past a couple of poll intervals, then set the cookie
    await vi.advanceTimersByTimeAsync(250)
    setCsrfCookie('late-token')
    await vi.advanceTimersByTimeAsync(150) // allow one more poll to fire

    const token = await promise
    expect(token).toBe('late-token')
  })

  // T-0802-003: returns null after timeout when cookie never appears
  it('should return null after timeout when cookie never appears', async () => {
    const promise = waitForCsrfToken(500, 100)
    await vi.advanceTimersByTimeAsync(600)

    const token = await promise
    expect(token).toBeNull()
  })

  // T-0802-004: respects custom timeoutMs and intervalMs
  it('should respect custom timeoutMs and intervalMs parameters', async () => {
    const promise = waitForCsrfToken(200, 50)

    // Advance to just after the timeout
    await vi.advanceTimersByTimeAsync(250)

    const token = await promise
    expect(token).toBeNull()
  })

  // T-0802-005: cleans up interval on resolution (no leaked timers)
  it('should clean up interval and timeout on resolution so no timers leak', async () => {
    setCsrfCookie('clean-token')

    const promise = waitForCsrfToken(3000, 100)
    await vi.advanceTimersByTimeAsync(0)
    await promise

    // Both the interval and timeout timer should be cleared.
    expect(vi.getTimerCount()).toBe(0)
  })

  // T-0802-006: resolves with the exact token value
  it('should resolve with the exact CSRF token value from the cookie', async () => {
    const EXPECTED = 'abc123-csrf-value'
    setCsrfCookie(EXPECTED)

    const promise = waitForCsrfToken(3000, 100)
    await vi.advanceTimersByTimeAsync(0)
    const token = await promise

    expect(token).toBe(EXPECTED)
  })

  // T-0802-007: never throws when timeout expires — just returns null
  it('should return null (not throw) when CSRF token times out', async () => {
    const promise = waitForCsrfToken(100, 50)
    await vi.advanceTimersByTimeAsync(200)

    await expect(promise).resolves.toBeNull()
  })

  // T-0802-F01: 0ms timeout returns null immediately (or at first poll)
  it('should return null quickly when timeoutMs is 0', async () => {
    // No cookie; timeout is 0 so it should resolve with null almost immediately
    const promise = waitForCsrfToken(0, 100)
    await vi.advanceTimersByTimeAsync(10)

    const token = await promise
    expect(token).toBeNull()
  })

  // T-0802-F02: always resolves, never rejects
  it('should always resolve and never throw even without a cookie', async () => {
    const promise = waitForCsrfToken(100, 50)
    await vi.advanceTimersByTimeAsync(200)

    // toResolve (not toReject) — resolves with null
    await expect(promise).resolves.toBe(null)
  })
})
