/**
 * Tests for the terminal-logout dispatch in useAuth useEffect — ADR-0016 Phase 3 (Step 3)
 *
 * Test IDs covered in this file:
 *   T-0016-018  terminal outcome triggers showError('Your session expired, please sign in again')
 *   T-0016-019  terminal outcome waits 1000ms before navigating
 *   T-0016-020  terminal outcome clears localStorage keys SUPABASE_STORAGE_KEY and 'prioritasUser'
 *   T-0016-021  terminal outcome clears sb-*-auth-token-code-verifier keys
 *   T-0016-022  terminal outcome sets window.location.href = '/login'
 *   T-0016-023  retryable outcome does NOT fire toast/logout
 *   T-0016-024  ok outcome does NOT fire toast/logout
 *   T-0016-025  demo user flow does NOT invoke terminal-logout path
 *   T-0016-064  useEffect awaits bootstrapCsrfCookie return value (caller, not internal side effect)
 *
 * Expected state BEFORE Colby's Step 3:
 *   ALL 9 tests FAIL via clean assertion failure (within <2s each). The current
 *   useAuth.ts:574 calls `bootstrapCsrfCookie()` fire-and-forget without awaiting
 *   the outcome, and the hook does NOT import useToast, does NOT dispatch
 *   showError, does NOT schedule setTimeout+clear localStorage+navigate.
 *
 * Expected state AFTER Colby's Step 3: ALL 9 tests PASS.
 *
 * Timing discipline:
 *   - vi.useFakeTimers() installed in beforeEach.
 *   - flushMicrotasks() yields the event-loop queue without advancing real wall
 *     time — sufficient to let the useEffect's promise chain settle. When the
 *     1000ms setTimeout guard is crossed, we drive it deterministically via
 *     vi.advanceTimersByTimeAsync(1000).
 *   - vi.advanceTimersByTimeAsync(0) is used after flushMicrotasks() when the
 *     assertion is on showError (not navigation) — it drives any remaining
 *     macrotask work from the dynamic import / module evaluation chain without
 *     crossing the 1000ms threshold.
 *   - No waitFor calls. waitFor's internal polling uses setInterval which does
 *     not advance under fake timers unless driven, producing 10s hangs.
 *
 * Authoring notes:
 *   - Sibling test file to useAuth.test.ts (which has a pre-existing vi.mock
 *     hoisting bug — see QA evidence). Isolates terminal-logout contract from
 *     that bug's blast radius.
 *   - Mocks use the Phase-2-proven lazy-arrow pattern.
 *   - window.location.href is controlled via Object.defineProperty on
 *     window.location (JSDOM permits this when 'configurable: true').
 *
 * Mock-target note (FLAG-3 resolution):
 *   Tests mock `useAuth.bootstrap` (the source-of-truth module) rather than
 *   `useAuth` (the re-export surface). Colby empirically verified that three
 *   strategies targeting `useAuth` all failed because vitest's mock cache keys
 *   by specifier string: `vi.doMock('../useAuth')` in the test and the IIFE's
 *   `import('./useAuth')` are different specifier strings and vitest does not
 *   unify them when the caller is useAuth.ts itself (circular-import boundary).
 *   Mocking the source module (`useAuth.bootstrap`) avoids the circular-import
 *   boundary entirely — useAuth.ts imports useAuth.bootstrap via a non-circular
 *   path, so vitest's resolver normalises both specifiers to the same cache slot.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { SUPABASE_STORAGE_KEY } from '../../lib/config'

// -----------------------------------------------------------------------------
// Mocks — declared BEFORE the imports that bind to them. Lazy-arrow pattern
// (see Phase 2 bootstrapCsrfCookie.test.ts:47-60) — no top-level variable
// references inside factory bodies at evaluation time.
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

// Mock useToast so we can assert showError is invoked from useAuth's useEffect.
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

// Mock isDemoUUID so T-0016-025 can flip the demo branch without touching the
// real UUID table.
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

const MOCK_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.terminal-logout-token'

function seedLocalStorageToken(token: string = MOCK_ACCESS_TOKEN): void {
  localStorage.setItem(
    SUPABASE_STORAGE_KEY,
    JSON.stringify({
      access_token: token,
      user: {
        id: '11111111-2222-3333-4444-555555555555',
        email: 'user@example.com',
        user_metadata: { full_name: 'Test User' },
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

/**
 * Yield the microtask queue N times. Under fake timers this is how we let
 * Promise chains (including the useEffect's async IIFE) settle without
 * advancing wall-clock time or engaging waitFor's setInterval polling.
 *
 * Six iterations is enough headroom for the deepest observed chain:
 *   bootstrapCsrfCookie await -> outcome branch -> showError dispatch ->
 *   setTimeout schedule (which is then driven explicitly by
 *   advanceTimersByTimeAsync).
 */
async function flushMicrotasks(iterations: number = 6): Promise<void> {
  for (let i = 0; i < iterations; i++) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve()
  }
}

/**
 * Re-import useAuth with a fresh module graph so:
 *   1. vi.doMock injections take effect
 *   2. the module-level `csrfBootstrapped` flag is reset between tests
 *
 * Mocks `useAuth.bootstrap` (the source-of-truth module for bootstrapCsrfCookie)
 * rather than the `useAuth` re-export surface. This avoids the specifier-string
 * keying issue: useAuth.ts imports useAuth.bootstrap via a non-circular path, so
 * vitest resolves both the test's `'../useAuth.bootstrap'` and useAuth.ts's
 * `'./useAuth.bootstrap'` to the same absolute path cache slot.
 *
 * Returns the fresh useAuth hook function.
 */
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

/**
 * Install a writable stub for window.location.href so we can assert
 * post-timeout navigation without JSDOM blowing up on real navigation.
 */
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
// Shared beforeEach/afterEach
// -----------------------------------------------------------------------------

describe('useAuth useEffect — terminal-logout dispatch (ADR-0016 Step 3)', () => {
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

    // Default: no session (unauthenticated happy path — keeps hook init from
    // cascading into unexpected DB calls). Tests that need a session override.
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

  // ---------------------------------------------------------------------------
  // Terminal-outcome dispatch (T-0016-018..022, T-0016-064)
  // ---------------------------------------------------------------------------

  describe('T-0016-018: terminal outcome triggers showError with the expected message', () => {
    it('calls showError("Your session expired, please sign in again") when bootstrapCsrfCookie returns "terminal"', async () => {
      const useAuth = await freshUseAuthWithBootstrapOutcome('terminal')
      seedLocalStorageToken()

      renderHook(() => useAuth())

      // Flush microtasks so the useEffect's await chain reaches the bootstrap
      // resolution, then advance 0ms to drain any remaining macrotask work
      // from the dynamic module evaluation chain. showError fires before the
      // 1000ms setTimeout, so no real timer advancement is needed.
      await flushMicrotasks()
      await vi.advanceTimersByTimeAsync(0)

      expect(mockShowError).toHaveBeenCalledWith('Your session expired, please sign in again')
    })
  })

  describe('T-0016-019: terminal outcome waits 1000ms before navigating', () => {
    it('does NOT navigate synchronously; navigates only after the 1000ms setTimeout fires', async () => {
      const useAuth = await freshUseAuthWithBootstrapOutcome('terminal')
      seedLocalStorageToken()

      renderHook(() => useAuth())

      await flushMicrotasks()

      // Before the 1000ms timer elapses, we must NOT have navigated yet.
      expect(locationStub.get()).toBe('http://localhost:3003/')

      // Advance just under 1000ms — still no navigation.
      await vi.advanceTimersByTimeAsync(999)
      expect(locationStub.get()).toBe('http://localhost:3003/')

      // Cross the 1000ms threshold — now navigation must have happened.
      await vi.advanceTimersByTimeAsync(1)
      expect(locationStub.get()).toBe('/login')
    })
  })

  describe('T-0016-020: terminal outcome clears SUPABASE_STORAGE_KEY and prioritasUser localStorage keys', () => {
    it('removes SUPABASE_STORAGE_KEY and "prioritasUser" from localStorage after the 1000ms timer fires', async () => {
      const useAuth = await freshUseAuthWithBootstrapOutcome('terminal')
      seedLocalStorageToken()
      localStorage.setItem('prioritasUser', JSON.stringify({ id: 'legacy-user' }))

      // Sanity: both keys are seeded.
      expect(localStorage.getItem(SUPABASE_STORAGE_KEY)).not.toBeNull()
      expect(localStorage.getItem('prioritasUser')).not.toBeNull()

      renderHook(() => useAuth())

      await flushMicrotasks()
      await vi.advanceTimersByTimeAsync(1000)

      expect(localStorage.getItem(SUPABASE_STORAGE_KEY)).toBeNull()
      expect(localStorage.getItem('prioritasUser')).toBeNull()
    })
  })

  describe('T-0016-021: terminal outcome clears sb-*-auth-token-code-verifier keys', () => {
    it('removes all localStorage keys matching sb-*-auth-token-code-verifier after the 1000ms timer fires', async () => {
      const useAuth = await freshUseAuthWithBootstrapOutcome('terminal')
      seedLocalStorageToken()

      // Seed two verifier keys with different project refs to prove a wildcard match.
      localStorage.setItem('sb-projectone-auth-token-code-verifier', '"verifier-one/PASSWORD_RECOVERY"')
      localStorage.setItem('sb-projecttwo-auth-token-code-verifier', '"verifier-two/PASSWORD_RECOVERY"')
      // An unrelated sb-* key that must NOT be cleared.
      localStorage.setItem('sb-projectone-unrelated', 'should-remain')

      renderHook(() => useAuth())

      await flushMicrotasks()
      await vi.advanceTimersByTimeAsync(1000)

      expect(localStorage.getItem('sb-projectone-auth-token-code-verifier')).toBeNull()
      expect(localStorage.getItem('sb-projecttwo-auth-token-code-verifier')).toBeNull()
      // Non-verifier sb-* key must survive the targeted wipe.
      expect(localStorage.getItem('sb-projectone-unrelated')).toBe('should-remain')
    })
  })

  describe('T-0016-022: terminal outcome sets window.location.href = "/login"', () => {
    it('navigates to /login after the 1000ms setTimeout fires', async () => {
      const useAuth = await freshUseAuthWithBootstrapOutcome('terminal')
      seedLocalStorageToken()

      renderHook(() => useAuth())

      await flushMicrotasks()
      await vi.advanceTimersByTimeAsync(1000)

      expect(locationStub.get()).toBe('/login')
    })
  })

  // ---------------------------------------------------------------------------
  // Non-terminal outcomes must NOT dispatch (T-0016-023, T-0016-024)
  // ---------------------------------------------------------------------------

  describe('T-0016-023: retryable outcome does NOT fire toast or logout', () => {
    it('does NOT call showError, does NOT clear localStorage, does NOT navigate when outcome is "retryable"', async () => {
      const useAuth = await freshUseAuthWithBootstrapOutcome('retryable')
      seedLocalStorageToken()
      localStorage.setItem('prioritasUser', JSON.stringify({ id: 'legacy-user' }))

      renderHook(() => useAuth())

      // Give the useEffect its full async settle, including the 1000ms window
      // that a terminal dispatch would have used. We must remain inert.
      await flushMicrotasks()
      await vi.advanceTimersByTimeAsync(2000)

      expect(mockShowError).not.toHaveBeenCalled()
      expect(localStorage.getItem(SUPABASE_STORAGE_KEY)).not.toBeNull()
      expect(localStorage.getItem('prioritasUser')).not.toBeNull()
      expect(locationStub.get()).toBe('http://localhost:3003/')
    })
  })

  describe('T-0016-024: ok outcome does NOT fire toast or logout', () => {
    it('does NOT call showError, does NOT clear localStorage, does NOT navigate when outcome is "ok"', async () => {
      const useAuth = await freshUseAuthWithBootstrapOutcome('ok')
      seedLocalStorageToken()
      localStorage.setItem('prioritasUser', JSON.stringify({ id: 'legacy-user' }))

      renderHook(() => useAuth())

      await flushMicrotasks()
      await vi.advanceTimersByTimeAsync(2000)

      expect(mockShowError).not.toHaveBeenCalled()
      expect(localStorage.getItem(SUPABASE_STORAGE_KEY)).not.toBeNull()
      expect(localStorage.getItem('prioritasUser')).not.toBeNull()
      expect(locationStub.get()).toBe('http://localhost:3003/')
    })
  })

  // ---------------------------------------------------------------------------
  // Demo-user guard (T-0016-025)
  // ---------------------------------------------------------------------------

  describe('T-0016-025: demo user flow does NOT invoke terminal-logout path', () => {
    it('does NOT dispatch showError/navigate even if bootstrapCsrfCookie were to return "terminal", because demo users must never trigger the terminal-logout branch', async () => {
      // Even if the bootstrap mock were to simulate 'terminal', demo users must
      // be skipped per ADR-0016 line 387-389. Either the hook must not call
      // bootstrapCsrfCookie at all for demo users, or the terminal branch must
      // be gated behind an isDemoUUID check. Either way the observable effect
      // is: no showError, no navigate, no localStorage wipe.
      mockIsDemoUUID.mockImplementation(() => true)

      const useAuth = await freshUseAuthWithBootstrapOutcome('terminal')

      // Seed a demo session so the hook's init path reflects a demo user.
      localStorage.setItem(
        SUPABASE_STORAGE_KEY,
        JSON.stringify({
          access_token: 'demo-access-token',
          user: {
            id: '00000000-0000-0000-0000-000000000001',
            email: 'demo@prioritas.com',
            user_metadata: { full_name: 'Demo User' },
          },
        })
      )
      localStorage.setItem('prioritasUser', JSON.stringify({ id: 'demo-user' }))

      renderHook(() => useAuth())

      await flushMicrotasks()
      await vi.advanceTimersByTimeAsync(2000)

      expect(mockShowError).not.toHaveBeenCalled()
      expect(localStorage.getItem(SUPABASE_STORAGE_KEY)).not.toBeNull()
      expect(localStorage.getItem('prioritasUser')).not.toBeNull()
      expect(locationStub.get()).toBe('http://localhost:3003/')
    })
  })

  // ---------------------------------------------------------------------------
  // Caller-awaits contract (T-0016-064)
  // ---------------------------------------------------------------------------

  describe('T-0016-064: useEffect awaits bootstrapCsrfCookie return value and dispatches terminal-logout from the caller (not as an internal side effect)', () => {
    it('awaits the outcome — if bootstrapCsrfCookie is slow, the terminal dispatch is deferred until it resolves', async () => {
      // Build a controllable deferred promise. If the useEffect awaits the
      // return value, no dispatch fires until we resolve the deferred.
      let resolveOutcome: ((v: 'terminal') => void) | undefined
      const outcomePromise = new Promise<'terminal'>((resolve) => {
        resolveOutcome = resolve
      })

      vi.doMock('../useAuth.bootstrap', () => ({
        bootstrapCsrfCookie: vi.fn(async (_force?: boolean) => outcomePromise),
      }))
      vi.resetModules()
      const { useAuth } = await import('../useAuth')

      seedLocalStorageToken()
      renderHook(() => useAuth())

      // Let the useEffect start and yield microtasks. The terminal dispatch
      // MUST NOT fire yet — bootstrapCsrfCookie's outcome is still pending.
      // If the hook didn't await, showError would already be called.
      await flushMicrotasks()
      expect(mockShowError).not.toHaveBeenCalled()

      // Resolve the deferred with 'terminal' — now the caller logic runs.
      resolveOutcome!('terminal')

      // Flush microtasks so the resolved promise's .then chain fires, allowing
      // the caller's terminal branch to dispatch showError synchronously.
      await flushMicrotasks()

      expect(mockShowError).toHaveBeenCalledWith('Your session expired, please sign in again')
    })
  })
})
