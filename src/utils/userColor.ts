/**
 * userColor — Phase 05.4b Wave 1, Unit 1.1
 *
 * Shared HSL color derivation for user avatars and live cursors.
 * Extracted from SessionPresenceStack.tsx so both session-scope (05.4a)
 * and project-scope (05.4b) components produce identical colors for the
 * same userId (D-33).
 *
 * Algorithm: hsl((djb2-ish(userId) % 360), 55%, 65%)
 * This is the exact algorithm previously inlined at SessionPresenceStack.tsx:50-74.
 */

/**
 * Deterministic unsigned 32-bit hash of a string (djb2-inspired multiply-and-add).
 * Identical to the previous inline implementation in SessionPresenceStack.tsx.
 */
export function hashString(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  }
  return hash
}

/**
 * Derives a deterministic HSL color from a userId.
 * Saturation and lightness are fixed (55%, 65%) for consistent legibility.
 */
export function userIdToHsl(userId: string): string {
  const hue = hashString(userId) % 360
  return `hsl(${hue}, 55%, 65%)`
}

/**
 * Derives up to two initials from a display name, uppercased.
 * 'Alice Bob Carter' → 'AB', 'Alice' → 'A', '' → ''.
 */
export function toInitials(displayName: string): string {
  return displayName
    .split(' ')
    .map((w) => w[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
