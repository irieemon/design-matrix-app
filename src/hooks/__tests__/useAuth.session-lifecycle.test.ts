/**
 * ADR-0017 Wave A — useAuth session lifecycle contracts (AC-SESSION-01..04)
 *
 * Test IDs covered in this file:
 *   T-0017-A19  AC-SESSION-01 — Given localStorage has a valid Supabase session
 *               payload on mount, useAuth.ts:419 getSession resolves and
 *               currentUser !== null within 5000ms.
 *   T-0017-A20  AC-SESSION-02 — Given localStorage has NO session on mount,
 *               useAuth settles with currentUser === null and isLoading === false
 *               within 5000ms.
 *   T-0017-A21  AC-SESSION-03 — Given localStorage has an access_token that
 *               401s on first API touch (simulated via bootstrapCsrfCookie ->
 *               'terminal'), the IIFE at useAuth.ts:528-579 dispatches
 *               terminal-logout within 10000ms: either location.href redirects
 *               OR currentUser === null.
 *   T-0017-A22  AC-SESSION-04 — Boot-time wall-clock upper bound. When
 *               getSession() never resolves and onAuthStateChange never fires,
 *               useAuth surfaces isLoading === false with currentUser === null
 *               (NOT stuck-loading) within MAX_AUTH_INIT_TIME.
 *
 * ── Scope note on file placement ──────────────────────────────────────────
 * Sibling-file harness. useAuth.test.ts has a pre-existing vi.mock hoisting
 * bug (documented in useAuth.terminal-logout.test.ts:37-42). This file uses
 * the Phase-2-proven lazy-arrow mock pattern shared with
 * useAuth.terminal-logout.test.ts and useAuth.csrf-terminal.test.ts.
 *
 * ── Expected state today (pre-Wave-A) ─────────────────────────────────────
 * A19, A20, A21 expected GREEN — production already honors the contracts.
 *   A19: useAuth.ts:431-445 sets currentUser via handleAuthUser when
 *        getSession returns a session.user.
 *   A20: useAuth.ts:442-444 calls setIsLoading(false) when no session.
 *   A21: useAuth.ts:560-578 dispatches terminal-logout at
 *        TERMINAL_LOGOUT_DELAY_MS=1000 — well under the 10000ms AC budget.
 * A22 expected GREEN — the AUTH_GET_SESSION inner timeout (2000ms,
 *   config.ts:14) fires through withTimeout before the outer
 *   MAX_AUTH_INIT_TIME (5000ms). Either layer firing satisfies the AC
 *   ("isLoading === false within MAX_AUTH_INIT_TIME"). The test advances
 *   past both deadlines and asserts the observable.
 *
 * ── ADR drift note (A22) ──────────────────────────────────────────────────
 * ADR-0017 T-0017-A22 row text says "MAX_AUTH_INIT_TIME (15000ms)", but the
 * production constant at useAuth.ts:380 is 5000ms. This test asserts against
 * the PRODUCTION VALUE (5000ms) because tests must match executable
 * behavior. The ADR row is an authoring-spec artifact to be reconciled in
 * Wave A wrap-up.
 *   TODO(roz): Route ADR vs code drift to Cal — ADR-0017 A22 row should be
 *   updated to MAX_AUTH_INIT_TIME=5000ms OR the code constant bumped to
 *   15000ms. Filed via Eva at Roz #2c authoring.
 *
 * ── Harness notes ─────────────────────────────────────────────────────────
 *   - Lazy-arrow vi.mock pattern; mocks declared before imports that bind.
 *   - Fake timers + flushMicrotasks + vi.advanceTimersByTimeAsync — no
 *     RTL waitFor (its setInterval polling does not drive under fake timers
 *     without manual advance, producing 10s hangs per
 *     useAuth.terminal-logout.test.ts:31-34).
 *   - Non-demo UUID seeded in localStorage so demo-user short-circuit at
 *     useAuth.ts:536 does not mask production paths.
 *   - window.location.href stubbed via Object.defineProperty so A21's
 *     /login redirect can be observed without JSDOM tearing the env.
 *   - For A21, mocks `useAuth.bootstrap` (the source-of-truth module)
 *     rather than `useAuth` (the re-export surface), following the
 *     circular-import-boundary strategy explained in
 *     useAuth.terminal-logout.test.ts:44-54.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
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

const NON_DEMO_USER_ID = '44444444-5555-6666-7777-888888888888'
const MOCK_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.session-lifecycle-token'
const MOCK_EMAIL = 'lifecycle@example.com'

function seedNonDemoSession(token: string = MOCK_ACCESS_TOKEN): void {
  localStorage.setItem(
    SUPABASE_STORAGE_KEY,
    JSON.stringify({
      access_token: token,
      user: {
        id: NON_DEMO_USER_ID,
        email: MOCK_EMAIL,
        user_metadata: { full_name: 'Session Lifecycle User' },
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

async function flushMicrotasks(iterations: number = 8): Promise<void> {
  for (let i = 0; i < iterations; i++) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve()
  }
}

async function freshUseAuth(): Promise<typeof import('../useAuth')['useAuth']> {
  vi.resetModules()
  const mod = await import('../useAuth')
  return mod.useAuth
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

// Shared onAuthStateChange stub that never fires an event — subscription
// handle is returned synchronously so useAuth can register the cleanup, but
// the callback is retained for tests that want to drive transitions manually.
function stubOnAuthStateChangeCapturing(): {
  fire: (event: string, session: unknown) => Promise<void>
} {
  let captured: ((event: string, session: unknown) => void | Promise<void>) | null = null
  mockOnAuthStateChange.mockImplementation(
    (cb: (event: string, session: unknown) => void | Promise<void>) => {
      captured = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }
  )
  return {
    fire: async (event: string, session: unknown) => {
      if (captured) await captured(event, session)
    },
  }
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('ADR-0017 Wave A — useAuth session lifecycle', () => {
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

    // Default: no session, subscription handle returned synchronously.
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

  // ---------------------------------------------------------------------------
  // T-0017-A19 — AC-SESSION-01
  // ---------------------------------------------------------------------------
  describe('T-0017-A19: AC-SESSION-01 — session restoration on valid localStorage', () => {
    it('sets currentUser !== null and isLoading === false within 5000ms when getSession resolves with a session', async () => {
      // Arrange: non-demo session in localStorage AND getSession resolves with
      // a valid session — mirroring the "refresh with valid session" flow.
      seedNonDemoSession()
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: MOCK_ACCESS_TOKEN,
            user: {
              id: NON_DEMO_USER_ID,
              email: MOCK_EMAIL,
              user_metadata: { full_name: 'Session Lifecycle User' },
            },
          },
        },
        error: null,
      })
      // onAuthStateChange: register cleanly; no event needed — getSession
      // already delivered the session and useAuth.ts:431-441 calls
      // handleAuthUser directly.
      stubOnAuthStateChangeCapturing()

      const useAuth = await freshUseAuth()

      // Act: mount the hook, then drive the async chain.
      const { result } = renderHook(() => useAuth())

      // Drive getSession → handleAuthUser → profile fetch (mocked to null) →
      // setCurrentUser(jwtUser) → setIsLoading(false). Each step is a
      // microtask chain, so flushing is sufficient. If macrotasks are
      // scheduled (internal setTimeouts in handleAuthUser), advance them
      // below the 5000ms AC boundary.
      await act(async () => {
        await flushMicrotasks(10)
        await vi.advanceTimersByTimeAsync(0)
        await flushMicrotasks(10)
      })

      // Assert: within the AC budget (< 5000ms), currentUser populated and
      // isLoading cleared.
      expect(result.current.currentUser).not.toBeNull()
      expect(result.current.currentUser?.id).toBe(NON_DEMO_USER_ID)
      expect(result.current.currentUser?.email).toBe(MOCK_EMAIL)
      expect(result.current.isLoading).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // T-0017-A20 — AC-SESSION-02
  // ---------------------------------------------------------------------------
  describe('T-0017-A20: AC-SESSION-02 — no-session initialization settles cleanly', () => {
    it('settles with currentUser === null and isLoading === false within 5000ms when localStorage is empty and getSession returns null', async () => {
      // Arrange: localStorage empty (no SUPABASE_STORAGE_KEY) + getSession
      // returns null session + INITIAL_SESSION event with null session fires.
      localStorage.clear()
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      })
      const listener = stubOnAuthStateChangeCapturing()

      const useAuth = await freshUseAuth()
      const { result } = renderHook(() => useAuth())

      // Drive the no-session branch: useAuth.ts:442-444 setIsLoading(false)
      // in initAuth's try/else when session is null.
      await act(async () => {
        await flushMicrotasks(10)
        await vi.advanceTimersByTimeAsync(0)
        // Fire INITIAL_SESSION with null session. Supabase's INITIAL_SESSION
        // event is not branched explicitly in useAuth.ts (no matching
        // if-clause), which is the safe default — the initAuth path has
        // already cleared isLoading. The fire() call here verifies the
        // subscription contract holds even with a null-session event.
        await listener.fire('INITIAL_SESSION', null)
        await flushMicrotasks(10)
      })

      // Assert: no user, not loading, within AC budget.
      expect(result.current.currentUser).toBeNull()
      expect(result.current.isLoading).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // T-0017-A21 — AC-SESSION-03
  // ---------------------------------------------------------------------------
  describe('T-0017-A21: AC-SESSION-03 — terminal logout on dead refresh token (401)', () => {
    it('dispatches the terminal-logout IIFE within 10000ms when bootstrapCsrfCookie resolves "terminal", producing location.href = "/login" OR currentUser === null', async () => {
      // Arrange: simulate the "access_token that 401s" observable by forcing
      // bootstrapCsrfCookie() to resolve 'terminal' (the outcome returned by
      // useAuth.bootstrap.ts:33 when the server rejects the token). Seed a
      // non-demo session so the demo-user short-circuit at useAuth.ts:536
      // does not mask the IIFE dispatch.
      const useAuth = await freshUseAuthWithBootstrapOutcome('terminal')
      seedNonDemoSession()

      // getSession resolves with a session so initAuth takes the
      // authenticated branch — this is the "valid local session, server-side
      // 401" shape. handleAuthUser will populate currentUser briefly; the
      // terminal-logout IIFE then schedules the redirect + localStorage wipe
      // at TERMINAL_LOGOUT_DELAY_MS=1000.
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: MOCK_ACCESS_TOKEN,
            user: {
              id: NON_DEMO_USER_ID,
              email: MOCK_EMAIL,
              user_metadata: { full_name: 'Session Lifecycle User' },
            },
          },
        },
        error: null,
      })
      stubOnAuthStateChangeCapturing()

      expect(locationStub.get()).toBe('http://localhost:3003/')

      const { result } = renderHook(() => useAuth())

      // Drive the async chain: bootstrap resolves → showError fires →
      // setTimeout(1000) schedules the navigate + wipe. Advance well past
      // the AC window (10001ms > 10000ms budget).
      await act(async () => {
        await flushMicrotasks(10)
        await vi.advanceTimersByTimeAsync(10001)
        await flushMicrotasks(10)
      })

      // Assert: at least one observable fired. AC-SESSION-03 allows either
      // the redirect (location.href === '/login') or the state reset
      // (currentUser === null after the IIFE completes + localStorage wipe).
      const redirectFired = locationStub.get() === '/login'
      const userCleared = result.current.currentUser === null
      expect(redirectFired || userCleared).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // T-0017-A22 — AC-SESSION-04
  // ---------------------------------------------------------------------------
  describe('T-0017-A22: AC-SESSION-04 — boot-time wall-clock upper bound', () => {
    it('settles isLoading === false and currentUser === null within MAX_AUTH_INIT_TIME when getSession never resolves and onAuthStateChange never fires', async () => {
      // Arrange: getSession returns a promise that never resolves; the
      // onAuthStateChange subscription never fires. Both stuck — this is the
      // scenario MAX_AUTH_INIT_TIME (5000ms at useAuth.ts:380) guards
      // against. localStorage empty so the emergency-fallback branch at
      // useAuth.ts:386-404 exits without synthesising a user.
      //
      // Note on layered defense: useAuth wraps getSession with withTimeout
      // at TIMEOUTS.AUTH_GET_SESSION (2000ms, config.ts:14). That inner
      // timeout will reject first, taking the catch branch at
      // useAuth.ts:447-506; with empty localStorage that branch calls
      // setIsLoading(false) at :487. EITHER layer firing satisfies AC — the
      // observable is "not stuck loading". This test advances past both
      // deadlines (5001ms > MAX_AUTH_INIT_TIME) and asserts the end state.
      localStorage.clear()
      // getSession hangs forever — this is what simulates the network
      // deadlock. We use a promise that never resolves; withTimeout will
      // reject via its own setTimeout after AUTH_GET_SESSION (2000ms).
      mockGetSession.mockImplementation(
        () => new Promise(() => { /* never resolves */ })
      )
      stubOnAuthStateChangeCapturing()

      const useAuth = await freshUseAuth()

      // Capture unhandled rejections so we can assert none leaked (AC
      // subclause: "no unhandled promise rejection").
      const unhandled: unknown[] = []
      const onUnhandled = (e: PromiseRejectionEvent | Error) => {
        unhandled.push(e)
      }
      if (typeof window !== 'undefined') {
        window.addEventListener(
          'unhandledrejection',
          onUnhandled as EventListener
        )
      }

      const { result } = renderHook(() => useAuth())

      // Act: advance past MAX_AUTH_INIT_TIME (5000ms). We advance 5001ms to
      // cross the boundary. This drives both withTimeout's inner 2000ms
      // rejection AND the outer authInitTimeout at 5000ms.
      await act(async () => {
        await flushMicrotasks(10)
        await vi.advanceTimersByTimeAsync(5001)
        await flushMicrotasks(10)
      })

      // Assert: settled safe-default.
      expect(result.current.isLoading).toBe(false)
      expect(result.current.currentUser).toBeNull()
      expect(unhandled).toHaveLength(0)

      if (typeof window !== 'undefined') {
        window.removeEventListener(
          'unhandledrejection',
          onUnhandled as EventListener
        )
      }
    })
  })
})
