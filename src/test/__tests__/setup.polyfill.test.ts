/**
 * ADR-0017 Wave A — T-0017-A15
 *
 * Smoke test for the crypto.getRandomValues polyfill installed by
 * src/test/setup.ts. This test is the contract that T-0017-A14 delivers:
 * if the polyfill is missing, modules like api/_lib/middleware/cookies.ts
 * fail at import time and every downstream test suite cascades RED.
 *
 * ── Expected BEFORE Wave A (today) ─────────────────────────────────────────
 *   FAIL — globalThis.crypto.getRandomValues is undefined under jsdom.
 *
 * ── Expected AFTER Wave A ──────────────────────────────────────────────────
 *   PASS — the polyfill returns a populated Uint8Array.
 *
 * The test asserts behavior (filled byte array), not implementation. It
 * does NOT assert Math.random vs. webcrypto — any backing impl is fine as
 * long as the output looks like random bytes.
 */

import { describe, it, expect } from 'vitest'

describe('[T-0017-A15] src/test/setup.ts crypto.getRandomValues polyfill', () => {
  it('exposes getRandomValues on globalThis.crypto', () => {
    expect(typeof globalThis.crypto).toBe('object')
    expect(typeof globalThis.crypto.getRandomValues).toBe('function')
  })

  it('fills a 32-byte Uint8Array with at least one non-zero byte', () => {
    const buffer = new Uint8Array(32)
    const result = globalThis.crypto.getRandomValues(buffer)

    // Returned reference must be the same instance (Web Crypto contract).
    expect(result).toBe(buffer)
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBe(32)

    // Probabilistic non-zero check: 32 bytes with Math.random has
    // ~(255/256)^32 ≈ 88% chance of containing zero bytes but effectively
    // 0% chance of being ALL zero. A single non-zero byte is the contract.
    const hasNonZero = Array.from(result).some(byte => byte !== 0)
    expect(hasNonZero).toBe(true)
  })
})
