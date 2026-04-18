/**
 * ADR-0017 Wave B — AuthScreen login-error behavioral assertions
 *
 * ── T-IDs covered ─────────────────────────────────────────────────────────
 *   B04  AC-LOGIN-04  Single-flight: two submit clicks within 10ms fire
 *                     exactly ONE signInWithPassword call
 *   B05  AC-LOGIN-01/02  Login timeout: after 15s with no SDK response,
 *                       render TIMEOUT copy and clear loading
 *   B06  AC-LOGIN-03  Dead-click 200ms: within 200ms of submit with a
 *                    valid form, observable state must be one of
 *                    {button loading, network in-flight, validation visible}
 *   B07  AC-LOGIN-06  Wrong-password copy: SDK rejection with
 *                    "Invalid login credentials" renders canonical
 *                    INVALID_CREDENTIALS copy (not the raw SDK message)
 *   B08  AC-LOGIN-07  No enumeration: 401-invalid-credentials and
 *                    401-user-not-found render IDENTICAL copy
 *   B14  AC-ERR-02 / AC-PRIV-02  Generic 5xx: fetch 500 with a stack in the
 *                                body renders GENERIC_5XX copy and DOES NOT
 *                                render any stack string
 *   B16  AC-ERR-03  Rate-limit copy: fetch 429 with error.code
 *                   'RATE_LIMIT_EXCEEDED' renders canonical RATE_LIMITED
 *                   copy (via mapErrorToCopy)
 *
 * ── Expected state TODAY (pre-Wave-B) ─────────────────────────────────────
 * All 7 tests RED BY DESIGN. Wave B has not yet built the surfaces these
 * tests assert:
 *   - `src/lib/auth/errorCopy.ts` + `mapErrorToCopy` do not exist
 *   - no login-submit timeout wrapper (TIMEOUTS.LOGIN_SUBMIT absent)
 *   - no 5xx/429 fetch-error mapping in AuthScreen
 *   - today AuthScreen renders the raw SDK `error.message` string verbatim
 *
 * B04 may GREEN today via the existing `if (loading) return` guard at
 * AuthScreen.tsx:136, but is written to the Wave B single-flight contract
 * (two clicks ≤10ms apart, exactly one dispatch) so Wave B's explicit
 * single-flight lock supersedes the implicit state-guard path without
 * regressing exactly-once semantics.
 *
 * ── Expected state AFTER Wave B ───────────────────────────────────────────
 * All 7 tests GREEN once Colby ships:
 *   - errorCopy.ts with canonical copy map
 *   - mapErrorToCopy(err) helper
 *   - login-submit timeout wrapper + TIMEOUTS.LOGIN_SUBMIT constant
 *   - AuthScreen reads error-copy through the map, never rendering raw
 *     SDK messages or fetch response bodies
 *
 * ── Copy-assertion strategy ───────────────────────────────────────────────
 * The exact Wave B copy strings are Colby's deliverable. Tests assert via
 * substring match on the CANONICAL keywords so final copy-text tweaks do
 * not break assertions unnecessarily:
 *   TIMEOUT:              /timed out/i
 *   INVALID_CREDENTIALS:  /incorrect|invalid/i  (AND NOT the raw "Invalid login credentials" SDK message)
 *   GENERIC_5XX:          /something went wrong|try again/i
 *   RATE_LIMITED:         /too many|try again in/i
 * The raw-message/stack negative assertions are the stricter guard — they
 * fail today because AuthScreen renders `err.message` verbatim.
 *
 * ── Mocking boundary ──────────────────────────────────────────────────────
 *   - `../../../lib/supabase` (SDK boundary) for B04/B05/B06/B07/B08
 *   - global `fetch` mocked via `vi.stubGlobal` for B14/B16, which target
 *     the Wave B backend error-serializer contract reaching the client
 *   - `../../ui/Button` mocked (forwardRef + captured handles) to let B06
 *     observe loading state without coupling to DOM attribute plumbing;
 *     also aligns with the existing AuthScreen-submit-behavior.test.tsx
 *     pattern so Button imperative-ref setState is well-understood.
 *
 * ── Harness notes ─────────────────────────────────────────────────────────
 *   - Fake timers only where required (B05 advances 15001ms, B06 advances
 *     200ms). Other tests use real timers to avoid ordering hazards with
 *     waitFor. See vi.useFakeTimers() / vi.useRealTimers() pairs.
 *   - B14/B16 stub global fetch AND assume Wave B routes its "not-supabase"
 *     failures through a non-SDK path. Today AuthScreen does not fetch
 *     directly — these tests will RED on the raw-message path first
 *     (Wave B introduces the fetch wire + serializer contract).
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// -----------------------------------------------------------------------------
// Mocks — hoisted above AuthScreen import below.
// -----------------------------------------------------------------------------

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
  },
}))

vi.mock('../../PrioritasLogo', () => ({
  default: () => <div data-testid="prioritas-logo">Logo</div>,
}))

vi.mock('../../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('../../../hooks/useAuth', () => ({
  updateRecoveryPassword: vi.fn(),
}))

// Mock Button so we can observe imperative-ref setState AND the `state` prop
// the component is rendered with. B06 uses the `state` prop capture to
// assert a loading transition within 200ms without coupling to DOM.
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
  // Track the most recent `state` prop the parent rendered the submit
  // button with. This is the React-state derived observable, not the
  // imperative setState channel.
  const statePropHistory: Array<string | undefined> = []

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

    ReactMod.useEffect(() => {
      handles.push(handle)
      return () => {
        const idx = handles.indexOf(handle)
        if (idx >= 0) handles.splice(idx, 1)
      }
    }, [handle])

    // Record the state prop on every render, tagged by testid so the
    // submit button's history is filterable.
    ReactMod.useEffect(() => {
      if (props['data-testid'] === 'auth-submit-button') {
        statePropHistory.push(props.state)
      }
    })

    ReactMod.useImperativeHandle(ref, () => handle, [handle])

    return ReactMod.createElement(
      'button',
      {
        'data-testid': props['data-testid'],
        'data-state': props.state,
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
    __submitStateHistory: statePropHistory,
  }
})

import AuthScreen from '../AuthScreen'
import { supabase } from '../../../lib/supabase'
import { UserProvider } from '../../../contexts/UserContext'
import type { User, AuthUser } from '../../../types'

// -----------------------------------------------------------------------------
// Test helpers
// -----------------------------------------------------------------------------

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

function renderAuthScreen() {
  const onAuthSuccess = vi.fn()
  return {
    onAuthSuccess,
    ...render(
      <UserProvider value={makeUserContextValue()}>
        <AuthScreen onAuthSuccess={onAuthSuccess} />
      </UserProvider>
    ),
  }
}

function fillValidLoginForm() {
  fireEvent.change(screen.getByPlaceholderText(/enter your email/i), {
    target: { value: 'test@example.com' },
  })
  fireEvent.change(screen.getByPlaceholderText(/enter your password/i), {
    target: { value: 'ValidPass123!' },
  })
}

function getErrorText(): string {
  // AuthScreen renders errors inside [data-testid="auth-error-message"].
  // Return the trimmed text content, or '' if no error is present.
  const node = screen.queryByTestId('auth-error-message')
  return node?.textContent?.trim() ?? ''
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('ADR-0017 Wave B — AuthScreen login error behavior', () => {
  let signInMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    signInMock = supabase.auth.signInWithPassword as unknown as ReturnType<typeof vi.fn>
    // Default: happy-path resolution so a test that doesn't override still
    // has a well-formed return.
    signInMock.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // ───────────────────────────────────────────────────────────────────────
  // B04 — AC-LOGIN-04 single-flight
  // ───────────────────────────────────────────────────────────────────────

  it('[B04] two submit clicks within 10ms fire exactly one signInWithPassword call', async () => {
    // Arrange: make the SDK call hang so the loading flag stays true across
    // both clicks. Single-flight must gate the second click on the
    // in-flight lock, not on the first call having resolved.
    signInMock.mockReturnValueOnce(new Promise(() => { /* never resolves */ }))

    renderAuthScreen()
    fillValidLoginForm()

    const button = screen.getByTestId('auth-submit-button')

    // Fire two clicks back-to-back. React batches sync event handlers, so
    // the two fires land in the same task — well within the 10ms window.
    fireEvent.click(button)
    fireEvent.click(button)

    // Flush microtasks; do NOT advance real time past the implicit
    // single-flight window.
    await Promise.resolve()
    await Promise.resolve()

    expect(signInMock).toHaveBeenCalledTimes(1)
    expect(signInMock).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'ValidPass123!',
    })
  })

  // ───────────────────────────────────────────────────────────────────────
  // B05 — AC-LOGIN-01/02 login timeout (15s)
  // ───────────────────────────────────────────────────────────────────────

  it('[B05] when signInWithPassword never resolves, after 15s the error shows TIMEOUT copy and loading is cleared', async () => {
    // SDK never resolves. Wave B must wrap the call in a 15s timeout that
    // surfaces the TIMEOUT copy and resets loading.
    signInMock.mockReturnValueOnce(new Promise(() => { /* never */ }))

    vi.useFakeTimers()
    try {
      renderAuthScreen()
      fillValidLoginForm()
      fireEvent.click(screen.getByTestId('auth-submit-button'))

      // Advance past the 15s timeout boundary.
      await act(async () => {
        vi.advanceTimersByTime(15001)
      })

      // TIMEOUT copy is present (canonical keyword).
      await waitFor(() => {
        expect(getErrorText()).toMatch(/timed out/i)
      })

      // Submit button's `state` prop is no longer 'loading'.
      const submitButton = screen.getByTestId('auth-submit-button')
      expect(submitButton.getAttribute('data-state')).not.toBe('loading')
    } finally {
      vi.useRealTimers()
    }
  })

  // ───────────────────────────────────────────────────────────────────────
  // B06 — AC-LOGIN-03 dead-click 200ms observable
  // ───────────────────────────────────────────────────────────────────────

  it('[B06] within 200ms of a valid submit, observable state shows progress (loading OR network in-flight OR validation)', async () => {
    // Resolve the SDK after 100ms so network completes within the window,
    // which is one of the three acceptable "observable progress" states.
    let resolveSignIn: (value: unknown) => void = () => {}
    const pending = new Promise((resolve) => {
      resolveSignIn = resolve
    })
    signInMock.mockReturnValueOnce(pending)

    vi.useFakeTimers()
    try {
      renderAuthScreen()
      fillValidLoginForm()
      fireEvent.click(screen.getByTestId('auth-submit-button'))

      // Advance 200ms — the dead-click boundary.
      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      const submitButton = screen.getByTestId('auth-submit-button')
      const buttonLoading = submitButton.getAttribute('data-state') === 'loading'
      const networkInFlight = signInMock.mock.calls.length >= 1
      const validationVisible = /please fix|required|invalid/i.test(getErrorText())

      // Contract: at least ONE of these must be observable at the 200ms mark.
      expect(buttonLoading || networkInFlight || validationVisible).toBe(true)

      // Cleanup hanging promise.
      resolveSignIn({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      })
    } finally {
      vi.useRealTimers()
    }
  })

  // ───────────────────────────────────────────────────────────────────────
  // B07 — AC-LOGIN-06 wrong-password canonical copy
  // ───────────────────────────────────────────────────────────────────────

  it('[B07] SDK rejection with "Invalid login credentials" renders canonical INVALID_CREDENTIALS copy, not the raw SDK message', async () => {
    signInMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    })

    renderAuthScreen()
    fillValidLoginForm()
    fireEvent.click(screen.getByTestId('auth-submit-button'))

    await waitFor(() => {
      expect(getErrorText().length).toBeGreaterThan(0)
    })

    const errorText = getErrorText()

    // Positive: canonical INVALID_CREDENTIALS copy uses one of these
    // keywords per the Wave B copy map.
    expect(errorText).toMatch(/incorrect|invalid/i)

    // Negative: the raw SDK string must NOT be rendered verbatim. Today
    // AuthScreen.tsx:221 does exactly this (`setError(err.message)`), so
    // this assertion is the primary RED today.
    expect(errorText).not.toMatch(/Invalid login credentials/)
  })

  // ───────────────────────────────────────────────────────────────────────
  // B08 — AC-LOGIN-07 no enumeration
  // ───────────────────────────────────────────────────────────────────────

  it('[B08] 401 "Invalid login credentials" and 401 "User not found" render IDENTICAL error copy (no account enumeration)', async () => {
    // Case A — invalid credentials.
    signInMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid login credentials', status: 401 },
    })

    const { unmount } = renderAuthScreen()
    fillValidLoginForm()
    fireEvent.click(screen.getByTestId('auth-submit-button'))

    await waitFor(() => {
      expect(getErrorText().length).toBeGreaterThan(0)
    })
    const copyA = getErrorText()
    unmount()

    // Case B — user not found. Must render IDENTICAL copy.
    signInMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'User not found', status: 401 },
    })

    renderAuthScreen()
    fillValidLoginForm()
    fireEvent.click(screen.getByTestId('auth-submit-button'))

    await waitFor(() => {
      expect(getErrorText().length).toBeGreaterThan(0)
    })
    const copyB = getErrorText()

    // The two copies must be identical — any difference leaks which case
    // the server hit (enumeration vulnerability).
    expect(copyB).toBe(copyA)
  })

  // ───────────────────────────────────────────────────────────────────────
  // B14 — AC-ERR-02 / AC-PRIV-02 generic 5xx, no stack leak
  // ───────────────────────────────────────────────────────────────────────

  it('[B14] fetch 500 with a stack in body renders GENERIC_5XX copy and does NOT render the stack', async () => {
    // Wave B routes some login-adjacent failures through fetch (e.g.,
    // the backend error serializer contract). We assert the client never
    // surfaces a stack trace to the DOM, regardless of body shape.
    const stackString = 'at file.ts:42\n    at handler (api/login.ts:99)'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: {
          message: 'Internal boom',
          stack: stackString,
        },
      }),
      text: async () => JSON.stringify({
        error: { message: 'Internal boom', stack: stackString },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    // Also reject the SDK so the error-mapping path exercises at minimum
    // the canonical 5xx copy surface. Wave B's mapErrorToCopy maps SDK
    // 5xx-shaped errors and fetch-5xx to the same GENERIC_5XX key.
    signInMock.mockRejectedValueOnce({
      status: 500,
      message: 'Internal boom',
      stack: stackString,
    })

    const { container } = renderAuthScreen()
    fillValidLoginForm()
    fireEvent.click(screen.getByTestId('auth-submit-button'))

    await waitFor(() => {
      expect(getErrorText().length).toBeGreaterThan(0)
    })

    // Positive: GENERIC_5XX canonical copy present.
    expect(getErrorText()).toMatch(/something went wrong|try again/i)

    // Negative: no stack frame anywhere in the rendered DOM.
    const domText = container.textContent ?? ''
    expect(domText).not.toContain('at file.ts:42')
    expect(domText).not.toMatch(/\bstack\b/i)
  })

  // ───────────────────────────────────────────────────────────────────────
  // B16 — AC-ERR-03 rate-limit canonical copy
  // ───────────────────────────────────────────────────────────────────────

  it('[B16] fetch 429 with error.code RATE_LIMIT_EXCEEDED renders canonical RATE_LIMITED copy via mapErrorToCopy', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'rate limit exceeded on login endpoint',
        },
      }),
      text: async () => JSON.stringify({
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'rate limit exceeded on login endpoint' },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    // Mirror the 429 on the SDK path so whichever wire Wave B routes
    // through reaches the same error-copy map.
    signInMock.mockRejectedValueOnce({
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'rate limit exceeded on login endpoint',
    })

    renderAuthScreen()
    fillValidLoginForm()
    fireEvent.click(screen.getByTestId('auth-submit-button'))

    await waitFor(() => {
      expect(getErrorText().length).toBeGreaterThan(0)
    })

    // Canonical RATE_LIMITED copy keyword. Today AuthScreen renders the
    // raw SDK `err.message` string — this assertion RED by design until
    // Wave B ships errorCopy.ts + mapErrorToCopy.
    expect(getErrorText()).toMatch(/too many|try again in/i)
  })
})
