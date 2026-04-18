/**
 * Shared constants for the api/_lib layer.
 *
 * ADR-0017 — Authoritative source for validation constants used across
 * serverless auth handlers and error serialization.
 */

/** Minimum password length accepted by signup and password-reset endpoints. */
export const PASSWORD_MIN_LENGTH = 8
