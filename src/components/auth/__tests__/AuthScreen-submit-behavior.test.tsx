/**
 * ADR-0017 Wave A — Submit behavior assertions (T-0017-A11..A13)
 *
 * Component-level RTL tests that pin AuthScreen's submit contract to the
 * post-Wave-A shape: loading state derived from React state (not imperative
 * refs), exactly-once network dispatch per valid click, and no network
 * dispatch while already loading.
 *
 * ── T-IDs covered ─────────────────────────────────────────────────────────
 *   T-0017-A11  Submit button's state prop is derived from React `loading`
 *               only (no imperative submitButtonRef.current.setState is
 *               called anywhere in handleSubmit — complements A09)
 *   T-0017-A12  Clicking submit with a valid form while loading=false
 *               dispatches exactly one signInWithPassword call
 *   T-0017-A13  When loading=true, clicking submit does NOT dispatch
 *               signInWithPassword
 *
 * ── Mocking boundary ──────────────────────────────────────────────────────
 *   Mocks `../../../lib/supabase` (SDK boundary) rather than global fetch.
 *   AuthScreen invokes `supabase.auth.signInWithPassword({ email, password })`
 *   on the login path; the SDK is the narrowest boundary that exercises the
 *   handleSubmit → SDK wire. Matches existing AuthScreen.test.tsx pattern.
 *
 *   Also mocks `../../ui/Button` so the `useImperativeHandle` exposed by the
 *   real Button (which is what AuthScreen's `submitButtonRef.current` points
 *   at) is replaced with a test-captured handle. A11's spy wires into that
 *   handle's `.setState`. The DOM node returned by getByTestId is NOT the
 *   imperative ref target — the prior A11 spy attached to the DOM <button>
 *   never fired and gave false-green. See task notes for details.
 *
 * ── Expected BEFORE Wave A (today) ────────────────────────────────────────
 *   FAIL — three distinct failure modes today:
 *     A11: handleSubmit today calls submitButtonRef.current?.setState('loading')
 *          at line 168, setState('error') at line 260, and setState('idle') via
 *          a 500ms setTimeout at line 275-279. A11 asserts those imperative
 *          paths are gone (spy on captured imperative handle).
 *     A12: handleSubmit today branches on `useNewAuth && secureAuth` (line 209)
 *          — in test wrappers that provide no SecureAuthProvider, the fallback
 *          SDK path runs once. A12 is expected to PASS structurally today
 *          through the fallback branch, but we pin it here so Wave A's
 *          consolidation does not regress exactly-once semantics.
 *     A13: handleSubmit today has a `loading` early-return at line 162 that
 *          already prevents double-dispatch; Wave A must preserve this.
 *
 *   A11 is the primary RED assertion in this file. A12/A13 act as regression
 *   locks during consolidation. All three will be GREEN after Wave A.
 *
 * ── Expected AFTER Wave A ─────────────────────────────────────────────────
 *   PASS — all three tests go green with the consolidated handleSubmit.
 *
 * ── Harness notes ─────────────────────────────────────────────────────────
 *   - Uses top-level vi.mock() (matches existing AuthScreen.test.tsx).
 *     Module-graph injection via vi.doMock() is NOT required here because
 *     we are not swapping per-test — a single mock shape serves all cases.
 *   - UserProvider wrapper is needed because AuthScreen calls useUser() at
 *     module top-level, which throws if no provider exists in the tree.
 *   - No fake timers in this file: none of A11-A13 depend on timer
 *     advancement. (A10's setTimeout is source-grep asserted in the sibling
 *     structural file.)
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock supabase SDK — must be hoisted above the AuthScreen import below.
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
  },
}))

// Mock PrioritasLogo to avoid SVG / asset imports in JSDOM.
vi.mock('../../PrioritasLogo', () => ({
  default: () => <div data-testid="prioritas-logo">Logo</div>,
}))

// Silence logger noise and keep test output clean.
vi.mock('../../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}))

// useAuth's updateRecoveryPassword is only hit on reset-password mode —
// not exercised here — but the import graph still needs to resolve.
vi.mock('../../../hooks/useAuth', () => ({
  updateRecoveryPassword: vi.fn(),
}))

// Mock the Button module so we can capture every imperative handle that
// React's useImperativeHandle resolves into the parent's ref. AuthScreen
// reads `submitButtonRef.current?.setState(...)` — that `.current` is the
// imperative object below, NOT the DOM node. A11 inspects every captured
// handle and asserts no `.setState` call was made.
//
// The barrel at `../../ui/index.ts` re-exports `./Button`; mocking the
// underlying module propagates through the barrel's import graph.
vi.mock('../../ui/Button', async () => {
  const ReactMod = await import('react')
  type Handle = {
    getState: ReturnType<typeof vi.fn>
    setState: ReturnType<typeof vi.fn>
    setLoading: ReturnType<typeof vi.fn>
    setSuccess: ReturnType<typeof vi.fn>
    setError: ReturnType<typeof vi.fn>
    reset: ReturnType<typeof vi.fn>
    executeAction: ReturnType<typeof vi.fn>
  }
  const handles: Handle[] = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Button = ReactMod.forwardRef<Handle, any>((props, ref) => {
    const handle: Handle = ReactMod.useMemo(
      () => ({
        getState: vi.fn(() => 'idle'),
        setState: vi.fn(),
        setLoading: vi.fn(),
        setSuccess: vi.fn(),
        setError: vi.fn(),
        reset: vi.fn(),
        executeAction: vi.fn(async (action?: () => Promise<void>) => {
          if (typeof action === 'function') {
            await action()
          }
        }),
      }),
      []
    )

    // Register the handle on mount so tests can inspect it.
    ReactMod.useEffect(() => {
      handles.push(handle)
      return () => {
        const idx = handles.indexOf(handle)
        if (idx >= 0) handles.splice(idx, 1)
      }
    }, [handle])

    ReactMod.useImperativeHandle(ref, () => handle, [handle])

    return ReactMod.createElement(
      'button',
      {
        'data-testid': props['data-testid'],
        onClick: props.onClick,
        type: props.type ?? 'button',
        disabled: props.disabled,
      },
      props.children
    )
  })
  Button.displayName = 'MockButton'

  return {
    __esModule: true,
    default: Button,
    __buttonHandles: handles,
  }
})

import AuthScreen from '../AuthScreen'
import { supabase } from '../../../lib/supabase'
import { UserProvider } from '../../../contexts/UserContext'
import type { User, AuthUser } from '../../../types'
// Pull the captured handle registry out of the mocked Button module.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as MockedButtonModule from '../../ui/Button'

type CapturedHandle = {
  setState: ReturnType<typeof vi.fn>
  [k: string]: ReturnType<typeof vi.fn>
}

function getButtonHandles(): CapturedHandle[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (MockedButtonModule as any).__buttonHandles as CapturedHandle[]
}

// Minimal UserContext value. AuthScreen reads `isPasswordRecovery` and
// `clearPasswordRecovery`; the rest of the context shape is required by
// type but not consumed on the login path.
function makeUserContextValue(overrides: Partial<{
  currentUser: User | null
  authUser: AuthUser | null
  isLoading: boolean
  isPasswordRecovery: boolean
}> = {}) {
  return {
    currentUser: null,
    authUser: null,
    isLoading: false,
    isPasswordRecovery: false,
    handleAuthSuccess: vi.fn(),
    handleLogout: vi.fn(),
    setCurrentUser: vi.fn(),
    setIsLoading: vi.fn(),
    clearPasswordRecovery: vi.fn(),
    authenticatedClient: null,
    ...overrides,
  }
}

function renderAuthScreen({
  onAuthSuccess = vi.fn(),
  userContext = makeUserContextValue(),
}: {
  onAuthSuccess?: ReturnType<typeof vi.fn>
  userContext?: ReturnType<typeof makeUserContextValue>
} = {}) {
  return {
    onAuthSuccess,
    ...render(
      <UserProvider value={userContext}>
        <AuthScreen onAuthSuccess={onAuthSuccess} />
      </UserProvider>
    ),
  }
}

describe('ADR-0017 Wave A — AuthScreen submit behavior', () => {
  let signInMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    signInMock = supabase.auth.signInWithPassword as unknown as ReturnType<typeof vi.fn>
    // Default: resolve with a user so handleSubmit's happy path runs to
    // completion without surfacing an error.
    signInMock.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('[T-0017-A11] submit button state is derived from React loading only — no imperative submitButtonRef.current.setState calls', async () => {
    // Strategy: the Button module is mocked above so every instance registers
    // its imperative handle (the object React.useImperativeHandle resolves
    // into the parent's ref) into __buttonHandles. Parent code calling
    // `submitButtonRef.current?.setState(...)` calls .setState on exactly
    // that captured handle. Before Wave A, handleSubmit invokes this at
    // line 168 (loading), 260 (error), and 275-279 (idle via setTimeout).
    // After Wave A, none of those calls should occur.
    renderAuthScreen()

    // Sanity: at least one Button was rendered and its handle captured.
    expect(getButtonHandles().length).toBeGreaterThan(0)

    // Snapshot aggregate setState-call count BEFORE submit, so this test is
    // robust against any incidental .setState usage by unrelated components
    // during render. We only care about calls provoked by handleSubmit.
    const callsBefore = getButtonHandles().reduce(
      (sum, h) => sum + h.setState.mock.calls.length,
      0
    )

    // Fill form with valid credentials and submit.
    fireEvent.change(screen.getByPlaceholderText(/enter your email/i), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText(/enter your password/i), {
      target: { value: 'ValidPass123!' },
    })
    fireEvent.click(screen.getByTestId('auth-submit-button'))

    // Wait for the SDK dispatch to fire so handleSubmit's synchronous
    // setState('loading') path has definitely executed.
    await waitFor(() => {
      expect(signInMock).toHaveBeenCalled()
    })

    // Let the happy-path finally block run (it calls setState('idle') via
    // a 500ms setTimeout today — use real timers + waitFor rather than
    // fake timers to keep this file timer-discipline-free per header note).
    // The finally block's outer synchronous work (outside the setTimeout)
    // plus the catch-path setState('error') on failure all happen in the
    // same microtask chain as the await signInMock; by the time signInMock
    // has been called and microtasks flushed, at least the loading call
    // MUST have fired on the broken path.
    await waitFor(() => {
      const callsAfter = getButtonHandles().reduce(
        (sum, h) => sum + h.setState.mock.calls.length,
        0
      )
      // Post-Wave-A contract: zero imperative setState calls provoked by
      // handleSubmit. Today, line 168's setState('loading') fires inside
      // the click handler — this waitFor gives the test both a pass path
      // (no new calls) and a fail path (any new call flips this red).
      expect(callsAfter - callsBefore).toBe(0)
    }, { timeout: 1000 })
  })

  it('[T-0017-A12] clicking submit with valid credentials while loading=false dispatches exactly one signInWithPassword call', async () => {
    const { onAuthSuccess } = renderAuthScreen()

    fireEvent.change(screen.getByPlaceholderText(/enter your email/i), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText(/enter your password/i), {
      target: { value: 'ValidPass123!' },
    })

    fireEvent.click(screen.getByTestId('auth-submit-button'))

    // Wait for the single dispatch to settle.
    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledTimes(1)
    })

    // L006: do not merely assert call count — also verify arguments so the
    // test pins the wire (not just any invocation).
    expect(signInMock).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'ValidPass123!',
    })

    // Sanity: onAuthSuccess fires from the happy-path branch.
    await waitFor(() => {
      expect(onAuthSuccess).toHaveBeenCalledTimes(1)
    })
  })

  it('[T-0017-A13] clicking submit while a previous submit is still in-flight does not dispatch a second signInWithPassword call', async () => {
    // Strategy: make signInWithPassword hang on the first call so that
    // internal `loading` state stays true. Then click a second time and
    // assert the mock received exactly ONE invocation, not two.
    let resolveSignIn: (value: unknown) => void = () => {}
    const pending = new Promise((resolve) => {
      resolveSignIn = resolve
    })
    signInMock.mockReturnValueOnce(pending)

    renderAuthScreen()

    fireEvent.change(screen.getByPlaceholderText(/enter your email/i), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText(/enter your password/i), {
      target: { value: 'ValidPass123!' },
    })

    const submitButton = screen.getByTestId('auth-submit-button')

    // First click — kicks off the hanging sign-in.
    fireEvent.click(submitButton)

    // Confirm the first dispatch fired so we know `loading` has flipped
    // true before the second click lands.
    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledTimes(1)
    })

    // Second click while loading=true. Post-Wave-A (and today via the
    // existing `if (loading) return` guard), this must be a no-op on the
    // SDK wire.
    fireEvent.click(submitButton)

    // Flush microtasks without resolving the hanging promise.
    await Promise.resolve()
    await Promise.resolve()

    // Still exactly one dispatch — the second click was suppressed.
    expect(signInMock).toHaveBeenCalledTimes(1)

    // Cleanup: resolve the hanging promise so the component can settle.
    resolveSignIn({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    })
  })
})
