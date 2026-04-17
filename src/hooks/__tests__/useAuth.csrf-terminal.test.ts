/**
 * ADR-0017 Wave A — Terminal logout on CSRF cookie missing
 *
 * Test IDs covered in this file:
 *   T-0017-A26  AC-CSRF-03 — Given bootstrapCsrfCookie() returns outcome
 *               'terminal' (CSRF_COOKIE_MISSING from useAuth.bootstrap.ts:33),
 *               the IIFE at useAuth.ts:553-558 dispatches terminal-logout
 *               within 2000ms observable window: location.href redirect
 *               triggered (OR currentUser === null).
 *
 * ── Scope note on file placement ──────────────────────────────────────────
 * The ADR-0017 row maps A26 to `api/_lib/middleware/__tests__/cookies.test.ts`,
 * but that file is the middleware CSRF-cookie harness (T-0016-001 /
 * T-0016-002 pattern) — it verifies the server's response cookie shape,
 * not the client's useAuth IIFE dispatch. A26's observable is the client's
 * terminal-logout wire (useAuth.ts:560-578), so a sibling-file useAuth
 * harness is the correct home. Eva's Roz #2b warn block explicitly
 * authorizes this drift if justified; this header is the justification.
 *
 * This file is intentionally a thin regression lock on the 2000ms observable
 * window contract that A26 codifies — distinct from
 * useAuth.terminal-logout.test.ts which exhaustively pins each sub-observable
 * (showError text, 1000ms pre-navigate gate, localStorage keys,
 * sb-*-auth-token-code-verifier wildcard, demo-user skip, caller-awaits).
 * A26 asserts the acceptance-criteria-level contract: within 2000ms of a
 * 'terminal' outcome, the observable effect has fired.
 *
 * ── Expected state today (pre-Wave-A) ─────────────────────────────────────
 * GREEN. useAuth.ts:528-579 already implements the terminal-logout IIFE with
 * TERMINAL_LOGOUT_DELAY_MS=1000 (well within the 2000ms observable window).
 * A26 is a regression lock — it pins the 2000ms AC contract so any future
 * refactor that stretches the dispatch (e.g. exponential backoff, double
 * await boundaries, missing IIFE) flips this test RED.
 *
 * ── Expected state after Wave A ───────────────────────────────────────────
 * GREEN (unchanged). Wave A does not touch the terminal-logout path.
 *
 * ── Harness notes ─────────────────────────────────────────────────────────
 *   - Mocks `useAuth.bootstrap` (not `useAuth`) to resolve 'terminal'. This
 *     avoids the circular-import specifier-keying issue documented in
 *     useAuth.terminal-logout.test.ts:45-54.
 *   - Uses fake timers + flushMicrotasks + vi.advanceTimersByTimeAsync(2000).
 *     The assertion is "within 2000ms" — we advance exactly 2000ms and
 *     verify the observable fired at or before that boundary.
 *   - Non-demo UUID seeded in localStorage so the demo-user short-circuit
 *     at useAuth.ts:536 does not mask the dispatch.
 *   - window.location.href stubbed so the /login redirect can be observed
 *     without JSDOM navigating and tearing down the test environment.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { SUPABASE_STORAGE_KEY } from '../../lib/config'

// -----------------------------------------------------------------------------
// Mocks — lazy-arrow pattern hoisted above useAuth import.
// -----------------------------------------------------------------------------

const mockGetSession = vi.fn()
const mockOnAuthStateChange = vi.fn()
const mockSignOut = vi.fn()
const mockRefreshSession = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  },
  getProfileService: () => ({
    getProfile: vi.fn(),
    clearCache: vi.fn(),
  }),
}))

vi.mock('../../lib/database', () => ({
  DatabaseService: {
    cleanupStaleLocks: vi.fn(),
  },
}))

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../../utils/authPerformanceMonitor', () => ({
  authPerformanceMonitor: {
    startSession: vi.fn(),
    finishSession: vi.fn(),
  },
}))

const mockShowError = vi.fn()
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showError: (...args: unknown[]) => mockShowError(...args),
    showSuccess: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
    showToast: vi.fn(),
    dismissToast: vi.fn(),
  }),
}))

const mockIsDemoUUID = vi.fn((_id: string) => false)
vi.mock('../../utils/uuid', async () => {
  const actual = await vi.importActual<typeof import('../../utils/uuid')>('../../utils/uuid')
  return {
    ...actual,
    isDemoUUID: (id: string) => mockIsDemoUUID(id),
  }
})

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const MOCK_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.a26-terminal-token'
const NON_DEMO_USER_ID = '22222222-3333-4444-5555-666666666666'

function seedNonDemoSession(token: string = MOCK_ACCESS_TOKEN): void {
  localStorage.setItem(
    SUPABASE_STORAGE_KEY,
    JSON.stringify({
      access_token: token,
      user: {
        id: NON_DEMO_USER_ID,
        email: 'nondemo@example.com',
        user_metadata: { full_name: 'Non-Demo User' },
      },
    })
  )
}

function clearCookies(): void {
  Object.defineProperty(document, 'cookie', {
    value: '',
    writable: true,
    configurable: true,
  })
}

async function flushMicrotasks(iterations: number = 6): Promise<void> {
  for (let i = 0; i < iterations; i++) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve()
  }
}

async function freshUseAuthWithBootstrapOutcome(
  outcome: 'ok' | 'retryable' | 'terminal'
): Promise<typeof import('../useAuth')['useAuth']> {
  vi.doMock('../useAuth.bootstrap', () => ({
    bootstrapCsrfCookie: vi.fn(async (_force?: boolean) => outcome),
  }))
  vi.resetModules()
  const mod = await import('../useAuth')
  return mod.useAuth
}

function stubLocationHref(): { get: () => string; restore: () => void } {
  const original = window.location
  let href = 'http://localhost:3003/'
  Object.defineProperty(window, 'location', {
    value: {
      ...original,
      get href() {
        return href
      },
      set href(v: string) {
        href = v
      },
      assign: vi.fn((url: string) => {
        href = url
      }),
      replace: vi.fn((url: string) => {
        href = url
      }),
    },
    writable: true,
    configurable: true,
  })
  return {
    get: () => href,
    restore: () => {
      Object.defineProperty(window, 'location', {
        value: original,
        writable: true,
        configurable: true,
      })
    },
  }
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('ADR-0017 Wave A — AC-CSRF-03: terminal logout within 2000ms on CSRF cookie missing', () => {
  let locationStub: ReturnType<typeof stubLocationHref>

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockReset()
    mockOnAuthStateChange.mockReset()
    mockSignOut.mockReset()
    mockRefreshSession.mockReset()
    mockShowError.mockReset()
    mockIsDemoUUID.mockReset()
    mockIsDemoUUID.mockImplementation(() => false)

    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    })
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    mockSignOut.mockResolvedValue({ error: null })

    localStorage.clear()
    clearCookies()
    locationStub = stubLocationHref()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.doUnmock('../useAuth.bootstrap')
    localStorage.clear()
    clearCookies()
    locationStub.restore()
  })

  describe('T-0017-A26: terminal outcome triggers observable logout within the 2000ms AC window', () => {
    it('redirects window.location.href to "/login" within 2000ms when bootstrapCsrfCookie resolves "terminal"', async () => {
      // Arrange: mock bootstrap to resolve the CSRF_COOKIE_MISSING → 'terminal'
      // outcome (useAuth.bootstrap.ts:33). Seed a non-demo session so the
      // demo-user short-circuit at useAuth.ts:536 does not mask the dispatch.
      const useAuth = await freshUseAuthWithBootstrapOutcome('terminal')
      seedNonDemoSession()

      // Sanity: before render, no redirect.
      expect(locationStub.get()).toBe('http://localhost:3003/')

      // Act: mount useAuth — the IIFE at useAuth.ts:528-579 fires on mount.
      renderHook(() => useAuth())

      // Drive the async chain: bootstrap resolves, showError fires
      // synchronously, setTimeout(TERMINAL_LOGOUT_DELAY_MS=1000) schedules
      // the navigate + localStorage wipe.
      await flushMicrotasks()

      // Advance to the AC observable boundary: exactly 2000ms. The
      // production delay is 1000ms (TERMINAL_LOGOUT_DELAY_MS), so the
      // redirect MUST have fired by this point. If Wave A (or any later
      // refactor) stretches the delay past 2000ms, this assertion will
      // flip RED — which is the regression-lock contract for A26.
      await vi.advanceTimersByTimeAsync(2000)

      // Assert: the observable effect — location.href redirect to /login —
      // fired within the 2000ms window. AC-CSRF-03 is satisfied.
      expect(locationStub.get()).toBe('/login')
    })
  })
})
