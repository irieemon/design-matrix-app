/**
 * Invitation Token Utilities
 *
 * Used by api/invitations/{create,lookup,accept}.ts.
 *
 * Tokens are random UUIDs (v4) that ride in the URL fragment of the
 * invitation link. Only the SHA-256 hash is persisted in
 * `project_invitations.token_hash`. The raw token never touches the
 * server logs (URL fragments are not sent over HTTP) and never lives
 * in the database.
 *
 * No third-party dependencies — uses Node's built-in `crypto`.
 */

import crypto from 'crypto'

/** Generate a fresh, opaque invitation token. */
export function generateToken(): string {
  return crypto.randomUUID()
}

/** Hash a raw invitation token for storage / lookup comparison. */
export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}
