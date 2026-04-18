/**
 * ADR-0017 Wave B — Backend error serializer.
 *
 * Produces a stable, PII-safe error envelope for 5xx responses. The envelope
 * deliberately omits `stack`, `details`, and any SQL/path fields so that
 * operational internals never leak to the client.
 */

export interface SerializedError {
  error: { message: string; code?: string }
  timestamp: string
  request_id: string
}

interface ErrorLike {
  message?: string
  code?: string
}

export function serializeError(err: unknown, requestId: string): SerializedError {
  const errorLike = err as ErrorLike | null | undefined
  const message =
    (err instanceof Error ? err.message : errorLike?.message ?? String(err)) ||
    'Internal server error'
  const code = errorLike?.code

  return {
    error: { message, ...(code ? { code } : {}) },
    timestamp: new Date().toISOString(),
    request_id: requestId,
  }
}
