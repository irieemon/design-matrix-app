/**
 * ADR-0017 Wave A — useAuth logout lifecycle contracts (AC-LOGOUT-01..03)
 *
 * Test IDs covered in this file:
 *   T-0017-A23  AC-LOGOUT-01 — User-initiated handleLogout (useAuth.ts:296-368)
 *               completes observable logged-out state within 5000ms when
 *               supabase.auth.signOut resolves {error: null}. Contract:
 *               result.current.currentUser === null AND
 *               localStorage.getItem(SUPABASE_STORAGE_KEY) === null.
 *   T-0017-A24  AC-LOGOUT-02 — When supabase.auth.signOut() rejects with a
 *               401-shaped error, the handleLogout catch branch
 *               (useAuth.ts:349-367) clears local state: no throw propagates,
 *               currentUser === null, localStorage legacy keys cleared.
 *   T-0017-A25  AC-LOGOUT-03 — After a successful logout, a fresh useAuth mount
 *               (simulating page reload on empty storage) observes
 *               currentUser === null with no backend session-restore attempt.
 *
 * ── Scope note on file placement ──────────────────────────────────────────
 * Sibling-file harness. useAuth.test.ts has a pre-existing vi.mock hoisting
 * bug (documented in useAuth.terminal-logout.test.ts:37-42). This file uses
 * the Phase-2-proven lazy-arrow mock pattern shared with
 * useAuth.terminal-logout.test.ts and useAuth.session-lifecycle.test.ts.
 *
 * ── Expected state today (pre-Wave-A build) ───────────────────────────────
 * A23 expected GREEN — production at useAuth.ts:296-368 already clears
 *   localStorage and delegates currentUser reset to the SIGNED_OUT listener
 *   at useAuth.ts:592-599.
 * A24 expected GREEN — production catch branch at useAuth.ts:349-367 clears
 *   state manually when signOut rejects; no throw escapes the async function
 *   because the whole body is wrapped in try/catch.
 * A25 expected GREEN — freshly mounted useAuth with getSession resolving
 *   {session: null} settles with currentUser === null via the initAuth
 *   no-session branch at useAuth.ts:442-444.
 *
 * ── ADR drift note (A23/A24 naming) ───────────────────────────────────────
 * ADR-0017 A23/A24 row text calls the public method "signOut"; the exposed
 * method on useAuth's return surface (useAuth.ts:643) is `handleLogout`. This
 * test asserts against the production surface name. The ADR row is an
 * authoring-spec artifact to be reconciled in Wave A wrap-up.
 *   TODO(roz): Route ADR vs code drift to Cal — ADR-0017 A23/A24 should say
 *   `handleLogout` OR the hook should expose a `signOut` alias. Filed via
 *   Eva at Roz #2d authoring.
 *
 * ── Harness notes ─────────────────────────────────────────────────────────
 *   - Lazy-arrow vi.mock pattern; mocks declared before imports that bind.
 *   - Fake timers + flushMicrotasks + vi.advanceTimersByTimeAsync — no
 *     RTL waitFor (its setInterval polling does not drive under fake timers
 *     without manual advance, producing 10s hangs).
 *   - Non-demo UUID seeded in localStorage so demo-user short-circuits do
 *     not mask production paths.
 *   - global.fetch stubbed to a harmless 200/ok so the handleLogout branch
 *     at useAuth.ts:322-328 (server cache clear) does not touch MSW.
 *   - SIGNED_OUT event fired manually via captured onAuthStateChange callback
 *     after the `await supabase.auth.signOut()` resolves — production relies
 *     on the listener to setCurrentUser(null) in the happy path.
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

const NON_DEMO_USER_ID = '77777777-8888-9999-aaaa-bbbbbbbbbbbb'
const MOCK_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.logout-lifecycle-token'
const MOCK_EMAIL = 'logout-lifecycle@example.com'

function seedNonDemoSession(token: string = MOCK_ACCESS_TOKEN): void {
  localStorage.setItem(
    SUPABASE_STORAGE_KEY,
    JSON.stringify({
      access_token: token,
      user: {
        id: NON_DEMO_USER_ID,
        email: MOCK_EMAIL,
        user_metadata: { full_name: 'Logout Lifecycle User' },
      },
    })
  )
  // Legacy keys that handleLogout is contracted to clear.
  localStorage.setItem('prioritasUser', JSON.stringify({ id: NON_DEMO_USER_ID }))
  localStorage.setItem('prioritasUserJoinDate', '2025-01-01T00:00:00Z')
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

/**
 * Capture the onAuthStateChange callback so tests can drive SIGNED_OUT events
 * synchronously. Production's handleLogout delegates the currentUser reset to
 * this listener (useAuth.ts:348 "The auth state change listener will handle
 * the rest"), so we must be able to fire the event to observe the contract.
 */
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

/**
 * Stub global.fetch to a harmless 200/ok response. handleLogout fetches
 * `/api/auth?action=clear-cache` at useAuth.ts:322-328 before calling signOut;
 * under MSW's 'onUnhandledRequest: error' this would fail the test. We return
 * a minimal ok response so the logout flow proceeds to the signOut call.
 */
function stubFetchOk(): { restore: () => void } {
  const originalFetch = globalThis.fetch
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ cleared: ['server-cache'] }),
  }) as unknown as typeof fetch
  return {
    restore: () => {
      globalThis.fetch = originalFetch
    },
  }
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('ADR-0017 Wave A — useAuth logout lifecycle', () => {
  let fetchStub: ReturnType<typeof stubFetchOk>

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockReset()
    mockOnAuthStateChange.mockReset()
    mockSignOut.mockReset()
    mockRefreshSession.mockReset()
    mockShowError.mockReset()
    mockIsDemoUUID.mockReset()
    mockIsDemoUUID.mockImplementation(() => false)

    // Default subscription — tests that need to fire SIGNED_OUT override.
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    mockSignOut.mockResolvedValue({ error: null })

    localStorage.clear()
    clearCookies()
    fetchStub = stubFetchOk()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
    clearCookies()
    fetchStub.restore()
  })

  // ---------------------------------------------------------------------------
  // T-0017-A23 — AC-LOGOUT-01
  // ---------------------------------------------------------------------------
  describe('T-0017-A23: AC-LOGOUT-01 — user-initiated logout completes within 5000ms', () => {
    it('clears currentUser to null and removes SUPABASE_STORAGE_KEY from localStorage within 5000ms when handleLogout is called with signOut resolving {error: null}', async () => {
      // Arrange: non-demo session seeded, getSession returns that session so
      // initAuth populates currentUser before logout runs. signOut resolves
      // {error: null} (useAuth.ts:347 happy path). Capture the
      // onAuthStateChange callback so we can fire SIGNED_OUT — production
      // relies on that listener (useAuth.ts:348, :592-599) to clear
      // currentUser in the happy path.
      seedNonDemoSession()
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: MOCK_ACCESS_TOKEN,
            user: {
              id: NON_DEMO_USER_ID,
              email: MOCK_EMAIL,
              user_metadata: { full_name: 'Logout Lifecycle User' },
            },
          },
        },
        error: null,
      })
      const listener = stubOnAuthStateChangeCapturing()
      mockSignOut.mockResolvedValue({ error: null })

      const useAuth = await freshUseAuth()
      const { result } = renderHook(() => useAuth())

      // Drive init so currentUser gets populated.
      await act(async () => {
        await flushMicrotasks(10)
        await vi.advanceTimersByTimeAsync(0)
        await flushMicrotasks(10)
      })
      expect(result.current.currentUser).not.toBeNull()

      // Act: call handleLogout. Inside act() so React state updates flush.
      await act(async () => {
        await result.current.handleLogout()
        // Drive the /api/auth fetch + signOut resolutions.
        await flushMicrotasks(10)
        // Fire SIGNED_OUT — production's Supabase client would fire this in
        // response to signOut({error: null}); our mock does not, so we drive
        // it directly. This is the listener (useAuth.ts:592-599) that resets
        // currentUser.
        await listener.fire('SIGNED_OUT', null)
        // Advance well past any post-logout timers (5001ms > 5000ms AC).
        await vi.advanceTimersByTimeAsync(5001)
        await flushMicrotasks(10)
      })

      // Assert: within AC budget, user cleared and auth storage key removed.
      expect(result.current.currentUser).toBeNull()
      expect(localStorage.getItem(SUPABASE_STORAGE_KEY)).toBeNull()
      // Legacy keys cleared too (contracted by useAuth.ts:344-345).
      expect(localStorage.getItem('prioritasUser')).toBeNull()
      expect(localStorage.getItem('prioritasUserJoinDate')).toBeNull()
      // signOut was invoked (useAuth.ts:347).
      expect(mockSignOut).toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // T-0017-A24 — AC-LOGOUT-02
  // ---------------------------------------------------------------------------
  describe('T-0017-A24: AC-LOGOUT-02 — logout with server error falls back to local cleanup', () => {
    it('does not throw to the caller, clears currentUser to null, and removes legacy localStorage keys when supabase.auth.signOut rejects with a 401-shaped error', async () => {
      // Arrange: session seeded and populated; signOut rejects (simulating a
      // 401 or network error). The catch branch at useAuth.ts:349-367 must
      // manually clear state.
      seedNonDemoSession()
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: MOCK_ACCESS_TOKEN,
            user: {
              id: NON_DEMO_USER_ID,
              email: MOCK_EMAIL,
              user_metadata: { full_name: 'Logout Lifecycle User' },
            },
          },
        },
        error: null,
      })
      stubOnAuthStateChangeCapturing()
      mockSignOut.mockRejectedValue(new Error('401 Unauthorized'))

      const useAuth = await freshUseAuth()
      const { result } = renderHook(() => useAuth())

      await act(async () => {
        await flushMicrotasks(10)
        await vi.advanceTimersByTimeAsync(0)
        await flushMicrotasks(10)
      })
      expect(result.current.currentUser).not.toBeNull()

      // Act: call handleLogout and assert no throw propagates. The production
      // catch (useAuth.ts:349-367) wraps the entire signOut path, so the
      // returned promise must resolve (not reject) even when signOut throws.
      let threw: unknown = null
      await act(async () => {
        try {
          await result.current.handleLogout()
        } catch (err) {
          threw = err
        }
        await flushMicrotasks(10)
        await vi.advanceTimersByTimeAsync(5001)
        await flushMicrotasks(10)
      })

      // Assert: no throw, state cleared via the fallback branch.
      expect(threw).toBeNull()
      expect(result.current.currentUser).toBeNull()
      // Legacy keys cleared by the catch-branch cleanup (useAuth.ts:362-363).
      expect(localStorage.getItem('prioritasUser')).toBeNull()
      expect(localStorage.getItem('prioritasUserJoinDate')).toBeNull()
      // signOut was attempted and threw.
      expect(mockSignOut).toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // T-0017-A25 — AC-LOGOUT-03
  // ---------------------------------------------------------------------------
  describe('T-0017-A25: AC-LOGOUT-03 — logout persists across simulated reload', () => {
    it('after logout clears state, a fresh useAuth mount on empty storage observes currentUser === null with no session-restore attempt (getSession resolves null)', async () => {
      // ── Phase 1: logout from a seeded session ────────────────────────────
      seedNonDemoSession()
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: MOCK_ACCESS_TOKEN,
            user: {
              id: NON_DEMO_USER_ID,
              email: MOCK_EMAIL,
              user_metadata: { full_name: 'Logout Lifecycle User' },
            },
          },
        },
        error: null,
      })
      const listener = stubOnAuthStateChangeCapturing()
      mockSignOut.mockResolvedValue({ error: null })

      const useAuthPhase1 = await freshUseAuth()
      const phase1 = renderHook(() => useAuthPhase1())

      await act(async () => {
        await flushMicrotasks(10)
        await vi.advanceTimersByTimeAsync(0)
        await flushMicrotasks(10)
      })
      expect(phase1.result.current.currentUser).not.toBeNull()

      await act(async () => {
        await phase1.result.current.handleLogout()
        await flushMicrotasks(10)
        await listener.fire('SIGNED_OUT', null)
        await vi.advanceTimersByTimeAsync(5001)
        await flushMicrotasks(10)
      })

      // Phase 1 assertions — mirror of A23 to prove the precondition for
      // phase 2's "empty storage + no restore" claim.
      expect(phase1.result.current.currentUser).toBeNull()
      expect(localStorage.getItem(SUPABASE_STORAGE_KEY)).toBeNull()

      // Unmount phase 1 so its useEffect cleanup runs before we reset mocks.
      phase1.unmount()

      // ── Phase 2: simulate a page reload on empty storage ─────────────────
      // Reset mocks entirely — a fresh mount on a reload would see a clean
      // Supabase client. getSession must resolve with null session so the
      // no-session branch (useAuth.ts:442-444) takes effect. Critically, we
      // assert that the hook does NOT attempt refreshSession — a reload on
      // empty storage must not round-trip to the backend for restoration.
      mockGetSession.mockReset()
      mockRefreshSession.mockReset()
      mockSignOut.mockReset()
      mockOnAuthStateChange.mockReset()
      mockOnAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      })
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      })

      // Reload fresh module graph.
      const useAuthPhase2 = await freshUseAuth()
      const phase2 = renderHook(() => useAuthPhase2())

      await act(async () => {
        await flushMicrotasks(10)
        await vi.advanceTimersByTimeAsync(0)
        await flushMicrotasks(10)
      })

      // Assert: no user restored, no restore attempt.
      expect(phase2.result.current.currentUser).toBeNull()
      expect(phase2.result.current.isLoading).toBe(false)
      // No backend refreshSession round-trip on empty storage reload.
      expect(mockRefreshSession).not.toHaveBeenCalled()

      phase2.unmount()
    })
  })
})
