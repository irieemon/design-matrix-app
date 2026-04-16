/**
 * Tests for bootstrapCsrfCookie + fetchWithErrorHandling CSRF re-mint — ADR-0016 Phase 2 (Step 2)
 *
 * Test IDs covered in this file:
 *   T-0016-005  bootstrapCsrfCookie happy path (cookie present)          -> 'ok', no network
 *   T-0016-006  bootstrapCsrfCookie successful mint                      -> 'ok' after 200
 *   T-0016-007  bootstrapCsrfCookie 401 -> refresh -> 200                -> 'ok'
 *   T-0016-008  bootstrapCsrfCookie 401 -> refresh -> 401                -> 'terminal'
 *   T-0016-009  bootstrapCsrfCookie 500 on initial call                  -> 'retryable'
 *   T-0016-010  bootstrapCsrfCookie network error                        -> 'retryable'
 *   T-0016-011  fetchWithErrorHandling 403 CSRF_COOKIE_MISSING calls bootstrapCsrfCookie(force=true) once
 *   T-0016-012  fetchWithErrorHandling 403 CSRF_COOKIE_MISSING retries POST once
 *   T-0016-013  fetchWithErrorHandling 403 -> re-mint -> retry 200 returns retry response
 *   T-0016-014  fetchWithErrorHandling isCsrfRetry=true on 403 throws 'CSRF cookie could not be re-established'
 *   T-0016-063  csrfBootstrapped flag is NOT set until successful 200 (not pre-await)
 *   T-0016-065  bootstrapCsrfCookie(force=true) bypasses guard when csrfBootstrapped already true
 *
 * Expected state BEFORE Colby's Step 2:
 *   ALL 12 tests FAIL (either compile-error because of missing named export
 *   `bootstrapCsrfCookie` / missing `force` parameter / missing `'ok'|'terminal'|'retryable'`
 *   return value, or runtime-fail because current implementation has no 403 CSRF re-mint
 *   branch in fetchWithErrorHandling and no typed outcome in bootstrapCsrfCookie).
 *
 * Expected state AFTER Colby's Step 2: ALL 12 tests PASS.
 *
 * Authoring notes:
 *   - bootstrapCsrfCookie is currently module-internal in useAuth.ts. ADR-0016 Step 2
 *     mandates exporting it. These tests import by named export so the compile error
 *     surfaces until Colby lands Step 2.
 *   - We stub the main supabase client so supabase.auth.refreshSession() is controllable
 *     per test. We override global.fetch directly (not MSW) to match the existing
 *     BaseAiService.test.ts pattern and to fully control response ordering per test.
 *   - For CSRF retry tests we drive fetchWithErrorHandling through a concrete subclass
 *     (IdeaGenerationService) because the method is protected. This matches the
 *     ADR-0014 BaseAiService test pattern.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SUPABASE_STORAGE_KEY } from '../../lib/config'

// -----------------------------------------------------------------------------
// Mocks — must be declared BEFORE the imports that bind to them.
// -----------------------------------------------------------------------------

// Mock the supabase client so refreshSession() is controllable per test.
const mockRefreshSession = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
    },
  },
  // useAuth.ts imports getProfileService — provide a stub so ESM hoisting
  // doesn't throw on import. bootstrapCsrfCookie does not call it, so stub
  // returns a no-op shape.
  getProfileService: () => ({
    getProfile: vi.fn(),
    clearCache: vi.fn(),
  }),
}))

// Mock logger to silence the debug/warn noise during tests.
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock cookieUtils so getCsrfToken returns null by default (no CSRF header
// attached) — tests that need a token can override via mockReturnValue.
vi.mock('../../utils/cookieUtils', () => ({
  getCsrfToken: vi.fn(() => null),
}))

// Mock aiCache to pass-through so fetchWithErrorHandling is always exercised.
vi.mock('../../lib/aiCache', () => ({
  aiCache: {
    getOrSet: vi.fn((_key: string, callback: () => Promise<unknown>) => callback()),
    clear: vi.fn(),
  },
  AICache: {
    generateKey: vi.fn(
      (operation: string, params: unknown) => `cache_key_${operation}_${JSON.stringify(params)}`
    ),
  },
}))

// Override fetch globally BEFORE importing the modules under test so that the
// module-binding captures our mock reference (matches BaseAiService.test.ts).
const mockFetch = vi.fn()
Object.defineProperty(global, 'fetch', {
  value: mockFetch,
  writable: true,
  configurable: true,
})

// Import AFTER mocks are installed. These imports reference the Step-2 API
// surface (named export `bootstrapCsrfCookie` with `force` flag and typed
// outcome) — they will fail to compile until Colby lands Step 2.
import { bootstrapCsrfCookie } from '../useAuth'
import { IdeaGenerationService } from '../../lib/ai/services/IdeaGenerationService'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const TEST_BASE_URL = 'https://test-app.example'
const MOCK_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-access-token'
const MOCK_REFRESHED_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-refreshed-token'

function seedLocalStorageToken(token: string = MOCK_ACCESS_TOKEN): void {
  localStorage.setItem(SUPABASE_STORAGE_KEY, JSON.stringify({ access_token: token }))
}

function setCookieString(value: string): void {
  // document.cookie in jsdom is writable; assigning a "name=value" string
  // appends it (it does not replace the whole jar). To reset between tests,
  // expire all cookies explicitly in afterEach.
  Object.defineProperty(document, 'cookie', {
    value,
    writable: true,
    configurable: true,
  })
}

function clearCookies(): void {
  // Wipe the jar by redefining the getter to return ''.
  Object.defineProperty(document, 'cookie', {
    value: '',
    writable: true,
    configurable: true,
  })
}

function okResponse(body: unknown = {}) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  }
}

function errorResponse(status: number, body: unknown = {}) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve(body),
  }
}

function csrfMissingResponse() {
  return errorResponse(403, { error: { code: 'CSRF_COOKIE_MISSING' } })
}

/**
 * Reset the module-level `csrfBootstrapped` guard between tests.
 *
 * vitest `vi.resetModules()` re-imports the module, which re-initializes the
 * module-level `let csrfBootstrapped = false`. We re-import inside each test
 * that depends on the reset so every test starts from a clean guard.
 */
async function freshUseAuth(): Promise<typeof import('../useAuth')> {
  vi.resetModules()
  return import('../useAuth')
}

// -----------------------------------------------------------------------------
// bootstrapCsrfCookie — outcome contract (T-0016-005..010, T-0016-063, T-0016-065)
// -----------------------------------------------------------------------------

describe('bootstrapCsrfCookie — typed outcome contract (ADR-0016 Step 2)', () => {
  beforeEach(() => {
    // Re-apply fetch mock because MSW's setup may have reattached between tests.
    Object.defineProperty(global, 'fetch', {
      value: mockFetch,
      writable: true,
      configurable: true,
    })
    vi.clearAllMocks()
    mockFetch.mockReset()
    mockRefreshSession.mockReset()
    clearCookies()
    localStorage.clear()
  })

  afterEach(() => {
    clearCookies()
    localStorage.clear()
  })

  describe('T-0016-005: cookie already present returns "ok" with no network call', () => {
    it('returns "ok" and does not call fetch when csrf-token cookie is present', async () => {
      const { bootstrapCsrfCookie: fresh } = await freshUseAuth()
      setCookieString('csrf-token=existing-token-abc; Path=/')

      const outcome = await fresh()

      expect(outcome).toBe('ok')
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('T-0016-006: successful mint returns "ok" after 200', () => {
    it('returns "ok" when /api/auth?action=user responds 200', async () => {
      const { bootstrapCsrfCookie: fresh } = await freshUseAuth()
      seedLocalStorageToken()
      mockFetch.mockResolvedValueOnce(okResponse({ user: { id: 'user-1' } }))

      const outcome = await fresh()

      expect(outcome).toBe('ok')
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth?action=user',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${MOCK_ACCESS_TOKEN}`,
          }),
        })
      )
    })
  })

  describe('T-0016-007: 401 then refresh then 200 returns "ok"', () => {
    it('returns "ok" when initial call 401s, refresh succeeds, and retry 200s', async () => {
      const { bootstrapCsrfCookie: fresh } = await freshUseAuth()
      seedLocalStorageToken()
      mockFetch
        .mockResolvedValueOnce(errorResponse(401, { error: 'Unauthorized' }))
        .mockResolvedValueOnce(okResponse({ user: { id: 'user-1' } }))
      mockRefreshSession.mockResolvedValueOnce({
        data: { session: { access_token: MOCK_REFRESHED_TOKEN } },
        error: null,
      })

      const outcome = await fresh()

      expect(outcome).toBe('ok')
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockRefreshSession).toHaveBeenCalledTimes(1)
      // Second call uses refreshed token
      expect(mockFetch.mock.calls[1][1]).toEqual(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${MOCK_REFRESHED_TOKEN}`,
          }),
        })
      )
    })
  })

  describe('T-0016-008: 401 then refresh then 401 returns "terminal"', () => {
    it('returns "terminal" when both initial and post-refresh calls return 401', async () => {
      const { bootstrapCsrfCookie: fresh } = await freshUseAuth()
      seedLocalStorageToken()
      mockFetch
        .mockResolvedValueOnce(errorResponse(401, { error: 'Unauthorized' }))
        .mockResolvedValueOnce(errorResponse(401, { error: 'Unauthorized' }))
      mockRefreshSession.mockResolvedValueOnce({
        data: { session: { access_token: MOCK_REFRESHED_TOKEN } },
        error: null,
      })

      const outcome = await fresh()

      expect(outcome).toBe('terminal')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('T-0016-009: 500 on initial call returns "retryable"', () => {
    it('returns "retryable" when /api/auth?action=user responds 500 (no refresh attempted)', async () => {
      const { bootstrapCsrfCookie: fresh } = await freshUseAuth()
      seedLocalStorageToken()
      mockFetch.mockResolvedValueOnce(errorResponse(500, { error: 'Internal Server Error' }))

      const outcome = await fresh()

      expect(outcome).toBe('retryable')
    })
  })

  describe('T-0016-010: network error returns "retryable"', () => {
    it('returns "retryable" when fetch rejects with a network error', async () => {
      const { bootstrapCsrfCookie: fresh } = await freshUseAuth()
      seedLocalStorageToken()
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

      const outcome = await fresh()

      expect(outcome).toBe('retryable')
    })
  })

  describe('T-0016-063: csrfBootstrapped flag is set ONLY after successful 200', () => {
    it('does NOT set the module guard when the network call fails (retryable outcome)', async () => {
      const useAuthMod = await freshUseAuth()
      seedLocalStorageToken()

      // First call: 500 -> 'retryable'. Guard must NOT be set.
      mockFetch.mockResolvedValueOnce(errorResponse(500, { error: 'Internal Server Error' }))
      const firstOutcome = await useAuthMod.bootstrapCsrfCookie()
      expect(firstOutcome).toBe('retryable')

      // Second call with the same module instance: if the guard was incorrectly
      // set during the first (failed) call, this call would short-circuit and
      // return without firing another fetch. The correct behavior is that the
      // guard stays false after a failure, so a second call DOES fire fetch again.
      mockFetch.mockResolvedValueOnce(okResponse({ user: { id: 'user-1' } }))
      const secondOutcome = await useAuthMod.bootstrapCsrfCookie()

      expect(secondOutcome).toBe('ok')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('T-0016-065: force=true bypasses csrfBootstrapped guard', () => {
    it('fires a network call even when csrfBootstrapped is already true', async () => {
      const useAuthMod = await freshUseAuth()
      seedLocalStorageToken()

      // First call: 200 -> 'ok'. This SHOULD set the module guard to true.
      mockFetch.mockResolvedValueOnce(okResponse({ user: { id: 'user-1' } }))
      const firstOutcome = await useAuthMod.bootstrapCsrfCookie()
      expect(firstOutcome).toBe('ok')
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // A second call WITHOUT force must be short-circuited by the guard.
      const shortCircuited = await useAuthMod.bootstrapCsrfCookie()
      expect(shortCircuited).toBe('ok')
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // A call WITH force=true must bypass the guard and fire another fetch.
      mockFetch.mockResolvedValueOnce(okResponse({ user: { id: 'user-1' } }))
      const forced = await useAuthMod.bootstrapCsrfCookie(true)
      expect(forced).toBe('ok')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })
})

// -----------------------------------------------------------------------------
// fetchWithErrorHandling — 403 CSRF re-mint retry (T-0016-011..014)
// -----------------------------------------------------------------------------

describe('fetchWithErrorHandling — 403 CSRF_COOKIE_MISSING re-mint retry (ADR-0016 Step 2)', () => {
  let ideaService: IdeaGenerationService

  beforeEach(() => {
    Object.defineProperty(global, 'fetch', {
      value: mockFetch,
      writable: true,
      configurable: true,
    })
    vi.clearAllMocks()
    mockFetch.mockReset()
    mockRefreshSession.mockReset()
    clearCookies()
    localStorage.clear()
    seedLocalStorageToken()
    ideaService = new IdeaGenerationService({ baseUrl: TEST_BASE_URL })
  })

  afterEach(() => {
    clearCookies()
    localStorage.clear()
  })

  /**
   * Shared helper: drive fetchWithErrorHandling through IdeaGenerationService.generateIdea
   * (the simplest concrete consumer). Errors thrown by fetchWithErrorHandling either
   * propagate (post-ADR-0016-Step-4) or are swallowed by the service's current
   * catch-block mock fallback (pre-Step-4). For Phase-2 CSRF tests we assert on
   * mockFetch call shape, not on the service's return value, so both pre- and
   * post-Step-4 service behavior are compatible with these assertions.
   */
  async function invokeService(): Promise<void> {
    try {
      await ideaService.generateIdea('test-title', 'test description', 'test-project')
    } catch {
      // Absorb — we only care about fetch call pattern for these tests.
    }
  }

  describe('T-0016-011: 403 CSRF_COOKIE_MISSING triggers bootstrapCsrfCookie(force=true) exactly once', () => {
    it('calls bootstrapCsrfCookie with force=true after first 403', async () => {
      const { bootstrapCsrfCookie: freshBootstrap } = await freshUseAuth()
      // Spy on the exported bootstrapCsrfCookie. BaseAiService must import and
      // call the named export. We re-mock via vi.doMock so the spy survives
      // the module graph.
      const bootstrapSpy = vi.fn(async (_force?: boolean) => 'ok' as const)
      vi.doMock('../useAuth', async () => {
        const actual = await vi.importActual<typeof import('../useAuth')>('../useAuth')
        return {
          ...actual,
          bootstrapCsrfCookie: (force?: boolean) => bootstrapSpy(force),
        }
      })

      // Reset module cache so BaseAiService picks up the mocked bootstrapCsrfCookie.
      vi.resetModules()
      const { IdeaGenerationService: FreshService } = await import(
        '../../lib/ai/services/IdeaGenerationService'
      )
      const freshIdeaService = new FreshService({ baseUrl: TEST_BASE_URL })

      mockFetch
        .mockResolvedValueOnce(csrfMissingResponse())
        .mockResolvedValueOnce(okResponse({ ideas: [{ content: 'idea' }] }))

      try {
        await freshIdeaService.generateIdea('title', 'description', 'project')
      } catch {
        // absorb
      }

      // Acceptance: bootstrapCsrfCookie called exactly once with force=true.
      expect(bootstrapSpy).toHaveBeenCalledTimes(1)
      expect(bootstrapSpy).toHaveBeenCalledWith(true)

      // Avoid leaking the doMock into sibling tests.
      vi.doUnmock('../useAuth')
      // Keep freshBootstrap referenced so TS/ESLint does not complain.
      void freshBootstrap
    })
  })

  describe('T-0016-012: 403 CSRF_COOKIE_MISSING retries POST exactly once', () => {
    it('issues exactly one retry POST to the same endpoint after the re-mint', async () => {
      mockFetch
        .mockResolvedValueOnce(csrfMissingResponse())
        .mockResolvedValueOnce(okResponse({ ideas: [{ content: 'idea' }] }))

      await invokeService()

      // Acceptance: exactly 2 POSTs to the idea endpoint (initial + single retry).
      const aiPosts = mockFetch.mock.calls.filter(
        ([url, options]) =>
          typeof url === 'string' && url.includes('/api/ai') && options?.method === 'POST'
      )
      expect(aiPosts).toHaveLength(2)
      // Both POSTs target the same endpoint.
      expect(aiPosts[0][0]).toBe(aiPosts[1][0])
    })
  })

  describe('T-0016-013: 403 -> re-mint -> retry 200 returns the retry response body', () => {
    it('resolves with the retry-response payload after a successful re-mint', async () => {
      const expectedIdea = {
        content: 'retry-response-idea-content',
        details: 'details-from-retry',
        x: 120,
        y: 220,
        priority: 'high' as const,
      }
      mockFetch
        .mockResolvedValueOnce(csrfMissingResponse())
        .mockResolvedValueOnce(okResponse({ ideas: [expectedIdea] }))

      const result = await ideaService.generateIdea('title', 'description', 'project')

      // Acceptance: returned idea content matches the retry-response payload,
      // proving the retry response (not an error, not a mock-fallback) was used.
      expect(result).toEqual(
        expect.objectContaining({ content: expectedIdea.content })
      )
    })
  })

  describe('T-0016-014: isCsrfRetry=true on subsequent 403 throws without a third attempt', () => {
    it('throws "CSRF cookie could not be re-established" when retry also returns 403', async () => {
      mockFetch
        .mockResolvedValueOnce(csrfMissingResponse())
        .mockResolvedValueOnce(csrfMissingResponse())

      await expect(
        ideaService.generateIdea('title', 'description', 'project')
      ).rejects.toThrow('CSRF cookie could not be re-established')

      // Acceptance: exactly 2 POSTs (initial + one retry). No third attempt.
      const aiPosts = mockFetch.mock.calls.filter(
        ([url, options]) =>
          typeof url === 'string' && url.includes('/api/ai') && options?.method === 'POST'
      )
      expect(aiPosts).toHaveLength(2)
    })
  })
})
