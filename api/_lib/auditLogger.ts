/**
 * Audit Logger — Shared Writer for Authentication Events
 *
 * Writes auth-lifecycle events to the `admin_audit_log` table with strict
 * privacy guarantees (L001 retro lesson):
 *   - No raw email, no password, no access/refresh tokens, no CSRF, no reset token
 *   - Email → SHA-256 hash of lowercase/trimmed value
 *   - Session reference → first 8 chars of SHA-256 of access_token (never the token itself)
 *   - IP → last octet zeroed for IPv4 (best-effort for IPv6)
 *   - User-Agent → family only (e.g. "Chrome 120", not the full UA string)
 *
 * Fire-and-forget contract: this function NEVER throws. Failures are logged to
 * `console.error` so auth latency and correctness are unaffected.
 *
 * Schema alignment note:
 *   The existing `admin_audit_log` table (per ADR R10 / HTTPONLY auth architecture
 *   doc) has columns: user_id (UUID, NOT NULL), action, resource, is_admin,
 *   timestamp, ip_address, user_agent, metadata (JSONB). The ADR-0017 Wave E
 *   spec names fields `event_type`, `user_email_hash`, `session_ref`, `ip_masked`,
 *   `user_agent_family`, `created_at`, `context_json`. We map onto the existing
 *   schema as follows:
 *     event → action
 *     email (hashed) → metadata.user_email_hash
 *     sessionRef (hashed prefix) → metadata.session_ref
 *     ipAddress (masked) → ip_address
 *     userAgent (family-only) → user_agent
 *     context → merged into metadata
 *     user_id → nil UUID for pre-auth / failed events (table requires NOT NULL)
 *   A follow-up migration can rename/restructure if desired.
 */

import { createHash } from 'crypto'
import { supabaseAdmin } from './utils/supabaseAdmin.js'

export type AuditEvent =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT_SUCCESS'
  | 'SIGNUP_SUCCESS'
  | 'SIGNUP_FAILURE'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_CONFIRMED'
  | 'EMAIL_CONFIRMED'
  | 'RATE_LIMIT_BLOCKED'
  | 'TERMINAL_LOGOUT'

export interface AuditLogParams {
  event: AuditEvent
  email?: string
  sessionRef?: string
  ipAddress?: string
  userAgent?: string
  context?: Record<string, unknown>
}

// Nil UUID used when the audit row has no authenticated user_id available.
// The admin_audit_log.user_id column is NOT NULL per the HTTPONLY schema.
const NIL_UUID = '00000000-0000-0000-0000-000000000000'
const SESSION_REF_LENGTH = 8

// Keys that must NEVER appear in context_json. Defensive filter in case a
// caller accidentally passes raw PII-bearing keys.
const FORBIDDEN_CONTEXT_KEYS = new Set([
  'email',
  'password',
  'access_token',
  'refresh_token',
  'accessToken',
  'refreshToken',
  'csrf',
  'csrfToken',
  'csrf_token',
  'reset_token',
  'resetToken',
  'token',
  'authorization',
])

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Hash an email address for privacy-preserving audit references.
 * Normalizes to lowercase and trims whitespace before hashing.
 */
function hashEmail(email: string): string {
  return sha256Hex(email.trim().toLowerCase())
}

/**
 * Derive a short session reference from an access token.
 * Returns the first 8 hex chars of the token's SHA-256 digest.
 */
function hashSessionRef(accessToken: string): string {
  return sha256Hex(accessToken).slice(0, SESSION_REF_LENGTH)
}

/**
 * Mask an IP address to preserve network-level attribution without
 * identifying an individual device. IPv4: zero the last octet.
 * IPv6: zero the final 16-bit group (approximation — full /64 anonymization
 * would be better but requires parsing; this is defense-in-depth).
 * Handles x-forwarded-for lists by taking the first entry.
 */
function maskIp(ip: string): string {
  const firstEntry = ip.split(',')[0]?.trim() ?? ''
  if (!firstEntry) return 'unknown'

  // IPv4 detection
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(firstEntry)) {
    const octets = firstEntry.split('.')
    octets[3] = '0'
    return octets.join('.')
  }

  // IPv6: zero the trailing group
  if (firstEntry.includes(':')) {
    const groups = firstEntry.split(':')
    if (groups.length > 1) {
      groups[groups.length - 1] = '0'
      return groups.join(':')
    }
  }

  return 'unknown'
}

/**
 * Reduce a raw user-agent string to a family + major version summary.
 * Examples:
 *   "Mozilla/5.0 ... Chrome/120.0.0.0 Safari/537.36" → "Chrome 120"
 *   "Mozilla/5.0 ... Firefox/115.0" → "Firefox 115"
 *   "Mozilla/5.0 ... Safari/605.1.15" → "Safari"
 *   "curl/7.79.1" → "curl"
 * Falls back to "Unknown" on any unparseable input.
 */
function parseUserAgentFamily(ua: string): string {
  if (!ua) return 'Unknown'

  // Order matters: check Edge/Chrome variants before generic Chrome, etc.
  const families: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /Edg\/(\d+)/i, name: 'Edge' },
    { pattern: /OPR\/(\d+)/i, name: 'Opera' },
    { pattern: /Firefox\/(\d+)/i, name: 'Firefox' },
    { pattern: /Chrome\/(\d+)/i, name: 'Chrome' },
    { pattern: /Version\/(\d+).*Safari/i, name: 'Safari' },
    { pattern: /curl\/(\d+)/i, name: 'curl' },
    { pattern: /node-fetch\/(\d+)/i, name: 'node-fetch' },
    { pattern: /axios\/(\d+)/i, name: 'axios' },
  ]

  for (const { pattern, name } of families) {
    const match = ua.match(pattern)
    if (match) {
      return match[1] ? `${name} ${match[1]}` : name
    }
  }

  return 'Unknown'
}

/**
 * Strip forbidden keys from a caller-supplied context object. Does NOT
 * recurse into nested objects by design — callers should pre-flatten sensitive
 * data rather than relying on deep sanitization.
 */
function sanitizeContext(
  context: Record<string, unknown>
): Record<string, unknown> {
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(context)) {
    if (FORBIDDEN_CONTEXT_KEYS.has(key)) continue
    clean[key] = value
  }
  return clean
}

/**
 * Write an auth-lifecycle event to `admin_audit_log`. Fire-and-forget —
 * swallows all errors and logs via `console.error`.
 */
export async function logAuthEvent(params: AuditLogParams): Promise<void> {
  try {
    if (!supabaseAdmin) {
      console.error('[auditLogger] supabaseAdmin unavailable; skipping audit write', {
        event: params.event,
      })
      return
    }

    const metadata: Record<string, unknown> = {}

    if (params.email) {
      metadata.user_email_hash = hashEmail(params.email)
    }

    if (params.sessionRef) {
      metadata.session_ref = hashSessionRef(params.sessionRef)
    }

    if (params.context) {
      Object.assign(metadata, sanitizeContext(params.context))
    }

    const row = {
      user_id: NIL_UUID,
      action: params.event,
      resource: '/api/auth',
      is_admin: false,
      timestamp: new Date().toISOString(),
      ip_address: params.ipAddress ? maskIp(params.ipAddress) : null,
      user_agent: params.userAgent ? parseUserAgentFamily(params.userAgent) : null,
      metadata,
    }

    const { error } = await supabaseAdmin.from('admin_audit_log').insert(row)

    if (error) {
      console.error('[auditLogger] insert failed', {
        event: params.event,
        message: error.message,
        code: error.code,
      })
    }
  } catch (err) {
    // Never throw — audit failures must not cascade into auth failures.
    console.error('[auditLogger] unexpected error', {
      event: params.event,
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
