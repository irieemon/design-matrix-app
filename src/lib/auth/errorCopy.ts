/**
 * ADR-0017 Wave B — Canonical auth error copy map.
 *
 * All user-facing auth errors MUST resolve through `mapErrorToCopy` so that
 * the DOM only ever renders approved strings. Raw SDK messages, fetch bodies,
 * and stack traces never reach the error surface.
 *
 * No-enumeration rule: "invalid credentials" and "user not found" collapse to
 * the same canonical copy so the server cannot be probed for account existence.
 */

export const ERROR_COPY = {
  TIMEOUT: 'Request timed out. Please try again.',
  INVALID_CREDENTIALS: 'Email or password is incorrect.',
  GENERIC_5XX: 'Something went wrong. Please try again.',
  RATE_LIMITED: 'Too many attempts — please try again in a moment.',
  NETWORK_ERROR: 'Network error. Check your connection.',
  UNKNOWN: 'An unexpected error occurred.',
} as const

export type ErrorCopyKey = keyof typeof ERROR_COPY

interface ErrorLike {
  message?: string
  code?: string
  status?: number
  error?: { code?: string; message?: string }
}

export function mapErrorToCopy(err: unknown): string {
  if (!err) return ERROR_COPY.UNKNOWN

  const errorLike = err as ErrorLike
  const message = (err instanceof Error ? err.message : errorLike?.message) || ''
  const code = errorLike?.code ?? errorLike?.error?.code
  const status = errorLike?.status

  if (code === 'RATE_LIMIT_EXCEEDED' || status === 429) return ERROR_COPY.RATE_LIMITED
  if (/timed\s*out|timeout/i.test(message)) return ERROR_COPY.TIMEOUT
  if (/invalid login credentials|invalid.*credentials/i.test(message)) return ERROR_COPY.INVALID_CREDENTIALS
  // No enumeration: "user not found" shapes collapse to the credentials copy.
  if (/user not found|no user/i.test(message)) return ERROR_COPY.INVALID_CREDENTIALS
  if (typeof status === 'number' && status >= 500) return ERROR_COPY.GENERIC_5XX
  return ERROR_COPY.UNKNOWN
}
