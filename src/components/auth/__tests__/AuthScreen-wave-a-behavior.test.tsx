/**
 * ADR-0017 Wave A — AuthScreen auth-success behavioral regression locks
 *
 * Test IDs covered in this file:
 *   T-0017-A16  Given profile fetch throws in `handleAuthUser` during
 *               AuthScreen's auth-success flow, state still transitions to
 *               jwtUser (regression lock for AC-LOGIN-09 no role flash)
 *
 * ── Scope note on file placement ──────────────────────────────────────────
 * The ADR-0017 row for A16 maps to AuthScreen's auth-success flow, and Eva's
 * Roz #2b mapping pins this file as the home. However, A16's observable is
 * the JWT-fallback branch at useAuth.ts:276-279 — a useAuth internal reached
 * via the `onAuthStateChange(SIGNED_IN)` listener that AuthScreen's
 * signInWithPassword success triggers in production. The cleanest way to
 * assert the JWT-fallback contract is to mount useAuth directly and drive
 * the SIGNED_IN event via the captured `onAuthStateChange` handler mock.
 * AuthScreen is upstream of this wire — rendering it here would not increase
 * assertion fidelity on the fallback branch. We keep the file name per the
 * mapping and encode the upstream AuthScreen login → downstream useAuth
 * SIGNED_IN chain as the behavioral fixture.
 *
 * ── Expected state today (pre-Wave-A) ─────────────────────────────────────
 * GREEN. useAuth.ts:262-279 already wraps user_profiles.select().single() in
 * a try/catch whose catch branch invokes `setCurrentUser(jwtUser)` with
 * `role: 'user'` from the JWT builder at line 238-245. A16 is a regression
 * lock — the test codifies today's correct behavior so a future refactor of
 * handleAuthUser cannot silently drop the JWT fallback without turning this
 * test RED.
 *
 * ── Expected state after Wave A ───────────────────────────────────────────
 * GREEN (unchanged). Wave A reshapes AuthScreen's submit wiring but does
 * not touch useAuth.handleAuthUser's profile-fetch branch. Any change that
 * removes the JWT fallback is a regression and this test will catch it.
 *
 * ── Harness notes ─────────────────────────────────────────────────────────
 *   - Mocks `../../../lib/supabase` at the SDK boundary. `supabase.from()`
 *     returns a chain whose `.single()` rejects so the try/catch in
 *     handleAuthUser takes the catch branch.
 *   - Captures the `onAuthStateChange` callback and invokes it manually
 *     with a SIGNED_IN event. This is the production path —
 *     AuthScreen.handleSubmit → supabase.auth.signInWithPassword →
 *     supabase emits SIGNED_IN → useAuth's listener calls handleAuthUser.
 *   - Uses renderHook(useAuth) rather than render(<AuthScreen/>) because
 *     the observable (currentUser.role) is hook state, not DOM. See scope
 *     note above.
 *   - Non-demo UUID required so the demo-user short-circuit at
 *     useAuth.ts:248-255 does not mask the profile-fetch path.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'

// -----------------------------------------------------------------------------
// Mocks — hoisted above imports. Lazy-arrow pattern matches
// useAuth.terminal-logout.test.ts so test-level vars are captured by reference.
// -----------------------------------------------------------------------------

const mockGetSession = vi.fn()
const mockOnAuthStateChange = vi.fn()
const mockSignOut = vi.fn()
const mockRefreshSession = vi.fn()
// Capture of the SIGNED_IN handler registered by useAuth — invoked manually
// in the test to simulate supabase emitting the auth event.
let capturedAuthStateChangeHandler:
  | ((event: string, session: unknown) => Promise<void> | void)
  | null = null

// Profile fetch chain. `.single()` rejects so the try/catch in handleAuthUser
// takes the JWT-fallback branch.
const mockProfileSingle = vi.fn()
const mockProfileEq = vi.fn(() => ({ single: mockProfileSingle }))
const mockProfileSelect = vi.fn(() => ({ eq: mockProfileEq }))
const mockFrom = vi.fn(() => ({ select: mockProfileSelect }))

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (
        handler: (event: string, session: unknown) => Promise<void> | void
      ) => {
        capturedAuthStateChangeHandler = handler
        return mockOnAuthStateChange(handler)
      },
      signOut: (...args: unknown[]) => mockSignOut(...args),
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
  getProfileService: () => ({
    getProfile: vi.fn(),
    clearCache: vi.fn(),
  }),
}))

vi.mock('../../../lib/database', () => ({
  DatabaseService: {
    cleanupStaleLocks: vi.fn(),
  },
}))

vi.mock('../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../../../utils/authPerformanceMonitor', () => ({
  authPerformanceMonitor: {
    startSession: vi.fn(),
    finishSession: vi.fn(),
  },
}))

// ToastContext is consumed by useAuth — provide a noop shape.
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
    showToast: vi.fn(),
    dismissToast: vi.fn(),
  }),
}))

// bootstrapCsrfCookie must resolve 'ok' so the terminal-logout IIFE does NOT
// fire during this test — A16's scope is the SIGNED_IN → handleAuthUser path,
// not CSRF-terminal. Mocking at the source module avoids the circular-import
// keying issue documented in useAuth.terminal-logout.test.ts.
vi.mock('../../../hooks/useAuth.bootstrap', () => ({
  bootstrapCsrfCookie: vi.fn(async () => 'ok'),
}))

// -----------------------------------------------------------------------------
// Imports under test (post-mock)
// -----------------------------------------------------------------------------

import { useAuth } from '../../../hooks/useAuth'
import { SUPABASE_STORAGE_KEY } from '../../../lib/config'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Non-demo UUID so isDemoUUID returns false in handleAuthUser. */
const NON_DEMO_USER_ID = '11111111-2222-3333-4444-555555555555'

const FAKE_AUTH_USER = {
  id: NON_DEMO_USER_ID,
  email: 'newuser@example.com',
  user_metadata: { full_name: 'New User' },
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
}

/**
 * Invokes the captured onAuthStateChange handler with a SIGNED_IN event.
 * This is the production code path — supabase.auth.signInWithPassword
 * success emits SIGNED_IN, and useAuth's subscription invokes
 * handleAuthSuccessRef.current (→ handleAuthSuccess → handleAuthUser).
 */
async function emitSignedIn(authUser: typeof FAKE_AUTH_USER): Promise<void> {
  if (!capturedAuthStateChangeHandler) {
    throw new Error('onAuthStateChange handler was not registered by useAuth')
  }
  await capturedAuthStateChangeHandler('SIGNED_IN', { user: authUser })
}

function clearCookies(): void {
  Object.defineProperty(document, 'cookie', {
    value: '',
    writable: true,
    configurable: true,
  })
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('ADR-0017 Wave A — AuthScreen auth-success behavioral regression locks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockReset()
    mockOnAuthStateChange.mockReset()
    mockSignOut.mockReset()
    mockRefreshSession.mockReset()
    mockFrom.mockClear()
    mockProfileSelect.mockClear()
    mockProfileEq.mockClear()
    mockProfileSingle.mockReset()
    capturedAuthStateChangeHandler = null

    // Default unauthenticated session so useAuth's mount path does not
    // cascade into an unexpected profile fetch before the test drives
    // SIGNED_IN manually.
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
  })

  afterEach(() => {
    localStorage.clear()
    clearCookies()
  })

  describe('T-0017-A16: profile fetch throws during handleAuthUser — state still transitions to jwtUser with role="user" (AC-LOGIN-09 no role flash)', () => {
    it('sets currentUser.role to "user" from the JWT fallback when supabase.from("user_profiles").single() rejects', async () => {
      // Arrange: profile fetch throws during the handleAuthUser try block.
      mockProfileSingle.mockRejectedValue(new Error('Network error: profile fetch failed'))

      const { result } = renderHook(() => useAuth())

      // Wait for useAuth's mount cycle to register the onAuthStateChange
      // handler. The mock captures the handler synchronously on the first
      // onAuthStateChange call, so a microtask flush is sufficient.
      await waitFor(() => {
        expect(capturedAuthStateChangeHandler).not.toBeNull()
      })

      // Act: emit SIGNED_IN as supabase would after signInWithPassword
      // success from AuthScreen.handleSubmit.
      await emitSignedIn(FAKE_AUTH_USER)

      // Assert: JWT fallback fired. currentUser is non-null, carries the
      // JWT-derived email and id, and role is 'user' (the jwtUser default
      // at useAuth.ts:242). No role flash, no stuck loading.
      await waitFor(() => {
        expect(result.current.currentUser).not.toBeNull()
      })

      const user = result.current.currentUser
      if (!user) throw new Error('currentUser was null after SIGNED_IN fallback')

      expect(user.role).toBe('user')
      expect(user.email).toBe(FAKE_AUTH_USER.email)
      expect(user.id).toBe(NON_DEMO_USER_ID)

      // Sanity: loading flag cleared after the catch branch at useAuth.ts:280.
      // Without this, the UI would be stuck on the loading spinner — the
      // "stuck loading" half of the A16 regression contract.
      expect(result.current.isLoading).toBe(false)

      // Sanity: the profile fetch was actually attempted (so we know we
      // exercised the try/catch and not some other branch).
      expect(mockProfileSingle).toHaveBeenCalledTimes(1)
    })
  })
})

// Silence unused-import linter complaints about React and SUPABASE_STORAGE_KEY —
// React is needed so vi's JSX transform compiles this .tsx file; the storage key
// is imported for symmetry with sibling tests and is available for future
// regression locks in this file.
void React
void SUPABASE_STORAGE_KEY
