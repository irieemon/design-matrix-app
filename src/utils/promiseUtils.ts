/**
 * Promise utilities for timeout and fallback handling
 *
 * Provides reusable functions for wrapping promises with timeouts and fallback values.
 * Eliminates duplication of Promise.race timeout patterns across the codebase.
 */

/**
 * Wraps a promise with a timeout
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Custom error message (optional)
 * @returns Promise that rejects if timeout is reached
 *
 * @example
 * const result = await withTimeout(
 *   fetch('/api/data'),
 *   5000,
 *   'API request timed out'
 * )
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() =>
      reject(new Error(errorMessage || `Timeout after ${timeoutMs}ms`)),
      timeoutMs
    )
  )
  return Promise.race([promise, timeout])
}

/**
 * Wraps a promise with a fallback value on error
 *
 * @param promise - The promise to wrap
 * @param fallback - Fallback value or function
 * @returns Promise that resolves to fallback on error
 *
 * @example
 * const result = await withFallback(
 *   fetchUserData(),
 *   { id: 'unknown', name: 'Guest' }
 * )
 */
export async function withFallback<T>(
  promise: Promise<T>,
  fallback: T | (() => T)
): Promise<T> {
  try {
    return await promise
  } catch (_error) {
    return typeof fallback === 'function' ? (fallback as () => T)() : fallback
  }
}
