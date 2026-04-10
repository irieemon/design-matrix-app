/**
 * Cookie Utilities
 *
 * Frontend utilities for reading cookies (primarily CSRF token)
 * Note: Access and refresh tokens are httpOnly and cannot be accessed by JavaScript
 */

import { logger } from '../lib/logging'

/**
 * Cookie names (must match backend)
 */
export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'sb-access-token',      // httpOnly, not accessible
  REFRESH_TOKEN: 'sb-refresh-token',    // httpOnly, not accessible
  CSRF_TOKEN: 'csrf-token',             // Readable by JavaScript
} as const

/**
 * Parse document.cookie string into object
 */
export function parseCookies(cookieString: string = document.cookie): Record<string, string> {
  const cookies: Record<string, string> = {}

  if (!cookieString) {
    return cookies
  }

  cookieString.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=')
    const value = rest.join('=').trim()

    if (name && value) {
      try {
        cookies[name.trim()] = decodeURIComponent(value)
      } catch (error) {
        // Invalid cookie value, skip
        logger.warn('Failed to parse cookie', { name, error })
      }
    }
  })

  return cookies
}

/**
 * Get a specific cookie value
 */
export function getCookie(name: string): string | null {
  const cookies = parseCookies()
  return cookies[name] || null
}

/**
 * Get CSRF token from cookie
 * This is the primary use case for client-side cookie reading
 */
export function getCsrfToken(): string | null {
  return getCookie(COOKIE_NAMES.CSRF_TOKEN)
}

/**
 * Check if a cookie exists
 */
export function hasCookie(name: string): boolean {
  return getCookie(name) !== null
}

/**
 * Check if user has authentication cookies
 * Note: We can only check if CSRF token exists (access/refresh are httpOnly)
 * This is a heuristic - actual auth state must be verified with backend
 */
export function hasAuthCookies(): boolean {
  return hasCookie(COOKIE_NAMES.CSRF_TOKEN)
}

/**
 * Listen for cookie changes (polling-based)
 * Returns cleanup function
 *
 * Note: There's no native cookie change event, so we poll
 */
export function watchCookie(
  name: string,
  callback: (value: string | null) => void,
  intervalMs: number = 1000
): () => void {
  let previousValue = getCookie(name)

  const intervalId = setInterval(() => {
    const currentValue = getCookie(name)
    if (currentValue !== previousValue) {
      previousValue = currentValue
      callback(currentValue)
    }
  }, intervalMs)

  // Return cleanup function
  return () => clearInterval(intervalId)
}

/**
 * Watch for CSRF token changes
 */
export function watchCsrfToken(
  callback: (token: string | null) => void,
  intervalMs?: number
): () => void {
  return watchCookie(COOKIE_NAMES.CSRF_TOKEN, callback, intervalMs)
}

/**
 * Wait for the CSRF token cookie to appear, up to timeoutMs.
 *
 * Polls getCsrfToken() every intervalMs milliseconds. Resolves with the token
 * string as soon as it is found, or with null if the timeout expires first.
 * Never rejects — callers can proceed without the token and the request will
 * fail with 403 (same as the current synchronous behavior).
 *
 * Use this instead of the synchronous getCsrfToken() in fire-and-forget paths
 * that run immediately after page load, before auth hydration completes.
 */
export function waitForCsrfToken(
  timeoutMs: number = 3000,
  intervalMs: number = 100
): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    // Check immediately before starting the interval
    const immediate = getCsrfToken()
    if (immediate !== null) {
      resolve(immediate)
      return
    }

    // 0ms timeout: resolve null right away if cookie isn't already present
    if (timeoutMs <= 0) {
      resolve(null)
      return
    }

    let intervalId: ReturnType<typeof setInterval>
    let timeoutId: ReturnType<typeof setTimeout>

    function cleanup() {
      clearInterval(intervalId)
      clearTimeout(timeoutId)
    }

    intervalId = setInterval(() => {
      const token = getCsrfToken()
      if (token !== null) {
        cleanup()
        resolve(token)
      }
    }, intervalMs)

    timeoutId = setTimeout(() => {
      cleanup()
      logger.warn('waitForCsrfToken: timed out waiting for CSRF cookie', { timeoutMs })
      resolve(null)
    }, timeoutMs)
  })
}
