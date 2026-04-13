/**
 * BaseAiService Tests — ADR-0014 Step 1
 *
 * Contract tests for the credential, CSRF, auth header, and 401 retry behavior
 * that Colby must implement. Written BEFORE the fix — they define what the
 * implementation must satisfy.
 *
 * Pre-build expected state:
 *
 * PASS (guard existing behavior):
 *   T-0014-002, T-0014-003, T-0014-004, T-0014-006,
 *   T-0014-008, T-0014-009, T-0014-010, T-0014-011
 *
 * FAIL — missing credentials: 'include' (fix contract):
 *   T-0014-001, T-0014-001b, T-0014-023, T-0014-024, T-0014-025
 *
 * FAIL — 401 retry not yet implemented:
 *   T-0014-005, T-0014-005b, T-0014-007
 *
 * FAIL — pre-existing source bugs (_error referenced as error in catch blocks);
 *         Colby must fix these as part of Step 1:
 *   T-0014-023b (RoadmapService.ts:79 — `error` not defined)
 *   T-0014-024b (IdeaGenerationService.ts:68 — `error` not defined)
 *
 * NOTE: T-0014-005/005b/007 use InsightsService rather than RoadmapService because
 * InsightsService's outer catch uses `apiError` (correctly scoped), which gives a
 * clean surface to test retry logic without a pre-existing catch-block bug masking
 * the assertion.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SUPABASE_STORAGE_KEY } from '../../../../lib/config'

// NOTE: getCsrfToken is mocked at module level so individual tests can control
// the cookie value without touching document.cookie.
vi.mock('../../../../utils/cookieUtils', () => ({
  getCsrfToken: vi.fn(),
}))

vi.mock('../../../../utils/logger')

// NOTE: The cache mock passes through to the generator callback so that
// fetchWithErrorHandling is always exercised — caching is not under test here.
vi.mock('../../../aiCache', () => ({
  aiCache: {
    getOrSet: vi.fn((_key: string, callback: () => Promise<unknown>) => callback()),
    clear: vi.fn(),
  },
  AICache: {
    generateKey: vi.fn(
      (operation: string, params: unknown) =>
        `cache_key_${operation}_${JSON.stringify(params)}`
    ),
  },
}))

// NOTE: Override fetch globally before importing services so that our mock
// captures the reference the module binds at import time, matching the pattern
// used in the legacy aiIdeaService tests. MSW is bypassed intentionally —
// these tests assert on fetch call options, not on response routing.
const mockFetch = vi.fn()
Object.defineProperty(global, 'fetch', {
  value: mockFetch,
  writable: true,
  configurable: true,
})

// Import services AFTER mocks are installed
import { RoadmapService } from '../RoadmapService'
import { IdeaGenerationService } from '../IdeaGenerationService'
import { InsightsService } from '../InsightsService'
import { getCsrfToken } from '../../../../utils/cookieUtils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_BASE_URL = 'https://test-app.example'
const MOCK_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-access-token'
const MOCK_CSRF_TOKEN = 'csrf-abc-123'

/** Minimal IdeaCard fixture */
const makeIdea = (overrides: Partial<{ content: string; x: number; y: number }> = {}) => ({
  id: 'idea-1',
  content: overrides.content ?? 'Test Idea',
  details: 'Test details',
  x: overrides.x ?? 100,
  y: overrides.y ?? 100,
  priority: 'high' as const,
  created_by: 'user-1',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})

/** Seed localStorage with a Supabase session token */
function seedLocalStorageToken(token: string = MOCK_ACCESS_TOKEN) {
  localStorage.setItem(
    SUPABASE_STORAGE_KEY,
    JSON.stringify({ access_token: token })
  )
}

/** Return a successful fetch Response mock */
function successResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  }
}

/** Return a fetch Response mock for a given HTTP error status */
function errorResponse(status: number, body: unknown = {}) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve(body),
  }
}

/** Minimal valid InsightsReport returned by the API */
const VALID_INSIGHTS_RESPONSE = {
  insights: {
    executiveSummary: 'Strong opportunity.',
    keyInsights: [{ insight: 'Market gap', impact: 'High' }],
    priorityRecommendations: { immediate: ['Ship MVP'], shortTerm: [], longTerm: [] },
  },
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('BaseAiService — ADR-0014 Step 1 contract', () => {
  let roadmapService: RoadmapService
  let ideaService: IdeaGenerationService
  let insightsService: InsightsService
  const mockedGetCsrfToken = getCsrfToken as ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Re-apply mockFetch before each test so MSW (which patches fetch in
    // beforeAll via the global setup.ts) does not intercept our calls.
    Object.defineProperty(global, 'fetch', {
      value: mockFetch,
      writable: true,
      configurable: true,
    })
    vi.clearAllMocks()
    roadmapService = new RoadmapService({ baseUrl: TEST_BASE_URL })
    ideaService = new IdeaGenerationService({ baseUrl: TEST_BASE_URL })
    insightsService = new InsightsService({ baseUrl: TEST_BASE_URL })

    // Default: no CSRF token, no session token
    mockedGetCsrfToken.mockReturnValue(null)
  })

  afterEach(() => {
    mockFetch.mockReset()
    Object.defineProperty(global, 'fetch', {
      value: mockFetch,
      writable: true,
      configurable: true,
    })
  })

  // -------------------------------------------------------------------------
  // T-0014-001: credentials: 'include' is present in fetch options
  // Uses InsightsService: its outer catch re-throws without masking assertions.
  // -------------------------------------------------------------------------
  describe('T-0014-001: credentials: include in fetch options', () => {
    it('should include credentials: include in every fetch call', async () => {
      mockFetch.mockResolvedValueOnce(successResponse(VALID_INSIGHTS_RESPONSE))

      await insightsService.generateInsights([makeIdea()], 'Test Project')

      const [, fetchOptions] = mockFetch.mock.calls[0]
      expect(fetchOptions).toMatchObject({ credentials: 'include' })
    })
  })

  // -------------------------------------------------------------------------
  // T-0014-001b: credentials: 'include' when fetch is called inside getOrSetCache
  // -------------------------------------------------------------------------
  describe('T-0014-001b: credentials: include inside getOrSetCache callback', () => {
    it('should include credentials: include when fetch is invoked inside the cache callback', async () => {
      mockFetch.mockResolvedValueOnce(
        successResponse({ ideas: [{ title: 'Cached Idea', description: 'desc', impact: 'high', effort: 'low' }] })
      )

      // IdeaGenerationService wraps fetchWithErrorHandling inside getOrSetCache
      await ideaService.generateIdea('Cached Idea')

      const [, fetchOptions] = mockFetch.mock.calls[0]
      expect(fetchOptions).toMatchObject({ credentials: 'include' })
    })
  })

  // -------------------------------------------------------------------------
  // T-0014-002: Authorization header with Bearer token from localStorage
  // -------------------------------------------------------------------------
  describe('T-0014-002: Authorization Bearer token from localStorage', () => {
    it('should send Authorization header with Bearer token when session exists in localStorage', async () => {
      seedLocalStorageToken(MOCK_ACCESS_TOKEN)
      mockFetch.mockResolvedValueOnce(successResponse(VALID_INSIGHTS_RESPONSE))

      await insightsService.generateInsights([makeIdea()], 'Test Project')

      const [, fetchOptions] = mockFetch.mock.calls[0]
      expect(fetchOptions.headers).toMatchObject({
        'Authorization': `Bearer ${MOCK_ACCESS_TOKEN}`,
      })
    })
  })

  // -------------------------------------------------------------------------
  // T-0014-003: X-CSRF-Token header when csrf-token cookie exists
  // -------------------------------------------------------------------------
  describe('T-0014-003: X-CSRF-Token header when cookie exists', () => {
    it('should include X-CSRF-Token header when getCsrfToken returns a value', async () => {
      seedLocalStorageToken()
      mockedGetCsrfToken.mockReturnValue(MOCK_CSRF_TOKEN)
      mockFetch.mockResolvedValueOnce(successResponse(VALID_INSIGHTS_RESPONSE))

      await insightsService.generateInsights([makeIdea()], 'Test Project')

      const [, fetchOptions] = mockFetch.mock.calls[0]
      expect(fetchOptions.headers).toMatchObject({
        'X-CSRF-Token': MOCK_CSRF_TOKEN,
      })
    })
  })

  // -------------------------------------------------------------------------
  // T-0014-004: X-CSRF-Token header is omitted (not throws) when cookie missing
  // -------------------------------------------------------------------------
  describe('T-0014-004: X-CSRF-Token omitted when cookie missing', () => {
    it('should NOT include X-CSRF-Token header when getCsrfToken returns null', async () => {
      seedLocalStorageToken()
      mockedGetCsrfToken.mockReturnValue(null)
      mockFetch.mockResolvedValueOnce(successResponse(VALID_INSIGHTS_RESPONSE))

      // Should not throw
      await expect(
        insightsService.generateInsights([makeIdea()], 'Test Project')
      ).resolves.toBeDefined()

      const [, fetchOptions] = mockFetch.mock.calls[0]
      expect(fetchOptions.headers).not.toHaveProperty('X-CSRF-Token')
    })
  })

  // -------------------------------------------------------------------------
  // T-0014-005: retries once on 401 after successful token refresh
  //
  // Uses InsightsService (non-localhost baseUrl) because its outer catch
  // correctly re-throws via `apiError`, giving a clean signal for retry logic.
  // -------------------------------------------------------------------------
  describe('T-0014-005: retries once on 401 after successful token refresh', () => {
    it('should retry the original request once when the refresh endpoint succeeds', async () => {
      seedLocalStorageToken()
      // First call: AI endpoint returns 401
      mockFetch.mockResolvedValueOnce(errorResponse(401))
      // Second call: refresh endpoint succeeds
      mockFetch.mockResolvedValueOnce(successResponse({ access_token: 'new-token' }))
      // Third call: retry of original AI endpoint succeeds
      mockFetch.mockResolvedValueOnce(successResponse(VALID_INSIGHTS_RESPONSE))

      const result = await insightsService.generateInsights([makeIdea()], 'Test Project')

      expect(result).toBeDefined()
      // 3 total fetch calls: original + refresh + retry
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })
  })

  // -------------------------------------------------------------------------
  // T-0014-005b: retry request uses refreshed auth headers
  // -------------------------------------------------------------------------
  describe('T-0014-005b: retry uses refreshed auth headers', () => {
    it('should send the new access token on the retry request after a successful refresh', async () => {
      const expiredToken = 'expired-token'
      const refreshedToken = 'fresh-token-after-refresh'
      seedLocalStorageToken(expiredToken)

      // First call: 401 on the AI endpoint
      mockFetch.mockResolvedValueOnce(errorResponse(401))
      // Refresh endpoint: returns new token — service must persist it to localStorage
      mockFetch.mockResolvedValueOnce(successResponse({ access_token: refreshedToken }))
      // Retry of AI endpoint: 200
      mockFetch.mockResolvedValueOnce(successResponse(VALID_INSIGHTS_RESPONSE))

      await insightsService.generateInsights([makeIdea()], 'Test Project')

      // The third fetch call is the retry — its Authorization must use the new token
      const [, retryOptions] = mockFetch.mock.calls[2]
      expect(retryOptions.headers).toMatchObject({
        'Authorization': `Bearer ${refreshedToken}`,
      })
    })
  })

  // -------------------------------------------------------------------------
  // T-0014-006: throws after 401 when token refresh fails
  // -------------------------------------------------------------------------
  describe('T-0014-006: throws when token refresh fails', () => {
    it('should throw an error when the refresh endpoint returns a non-ok response', async () => {
      seedLocalStorageToken()
      // AI endpoint: 401
      mockFetch.mockResolvedValueOnce(errorResponse(401))
      // Refresh endpoint: failure (e.g. expired refresh token)
      mockFetch.mockResolvedValueOnce(errorResponse(400, { error: 'invalid_grant' }))

      await expect(
        insightsService.generateInsights([makeIdea()], 'Test Project')
      ).rejects.toThrow()
    })
  })

  // -------------------------------------------------------------------------
  // T-0014-007: throws after second consecutive 401 (no infinite retry)
  // -------------------------------------------------------------------------
  describe('T-0014-007: no infinite retry on second consecutive 401', () => {
    it('should throw after the second 401 without issuing a fourth fetch call', async () => {
      seedLocalStorageToken()
      // First call: 401
      mockFetch.mockResolvedValueOnce(errorResponse(401))
      // Refresh: success
      mockFetch.mockResolvedValueOnce(successResponse({ access_token: 'new-token' }))
      // Retry: 401 again
      mockFetch.mockResolvedValueOnce(errorResponse(401))

      await expect(
        insightsService.generateInsights([makeIdea()], 'Test Project')
      ).rejects.toThrow()

      // Exactly 3 calls: original + refresh + one retry (no further loop)
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })
  })

  // -------------------------------------------------------------------------
  // T-0014-008: 429 rate-limit propagated without retry
  // -------------------------------------------------------------------------
  describe('T-0014-008: 429 propagated without retry', () => {
    it('should throw a rate-limit error without retrying when the server returns 429', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(429, {}))

      // InsightsService (non-localhost) re-throws without fallback
      await expect(
        insightsService.generateInsights([makeIdea()], 'Test Project')
      ).rejects.toThrow(/rate limit/i)

      // Only the single 429 call — no retry
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  // -------------------------------------------------------------------------
  // T-0014-009: 500 server error propagated without retry
  // -------------------------------------------------------------------------
  describe('T-0014-009: 500 propagated without retry', () => {
    it('should throw a server error without retrying when the server returns 500', async () => {
      mockFetch.mockResolvedValueOnce(
        errorResponse(500, { error: { code: 'INTERNAL_SERVER_ERROR' } })
      )

      await expect(
        insightsService.generateInsights([makeIdea()], 'Test Project')
      ).rejects.toThrow(/500/i)

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  // -------------------------------------------------------------------------
  // T-0014-010: getAuthHeaders returns Bearer token when localStorage has session
  // NOTE: getAuthHeaders is protected; exercised by inspecting fetch call headers.
  // -------------------------------------------------------------------------
  describe('T-0014-010: getAuthHeaders returns Bearer token from localStorage', () => {
    it('should include Authorization: Bearer header when localStorage contains a session', async () => {
      seedLocalStorageToken(MOCK_ACCESS_TOKEN)
      mockFetch.mockResolvedValueOnce(
        successResponse({ ideas: [{ title: 'T', description: 'D', impact: 'high', effort: 'low' }] })
      )

      await ideaService.generateIdea('Auth test')

      const [, fetchOptions] = mockFetch.mock.calls[0]
      expect(fetchOptions.headers).toMatchObject({
        'Authorization': `Bearer ${MOCK_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      })
    })
  })

  // -------------------------------------------------------------------------
  // T-0014-011: getAuthHeaders returns basic headers when localStorage is empty
  // -------------------------------------------------------------------------
  describe('T-0014-011: getAuthHeaders returns basic headers when localStorage is empty', () => {
    it('should NOT include Authorization header when localStorage is empty', async () => {
      localStorage.clear()
      mockFetch.mockResolvedValueOnce(
        successResponse({ ideas: [{ title: 'T', description: 'D', impact: 'high', effort: 'low' }] })
      )

      await ideaService.generateIdea('No-auth test')

      const [, fetchOptions] = mockFetch.mock.calls[0]
      expect(fetchOptions.headers).not.toHaveProperty('Authorization')
      expect(fetchOptions.headers).toMatchObject({ 'Content-Type': 'application/json' })
    })
  })

  // -------------------------------------------------------------------------
  // T-0014-023: RoadmapService.generateRoadmap succeeds with mocked 200
  // -------------------------------------------------------------------------
  describe('T-0014-023: RoadmapService.generateRoadmap succeeds on 200', () => {
    it('should return a roadmap when the server responds with 200 and credentials are sent', async () => {
      seedLocalStorageToken()
      mockedGetCsrfToken.mockReturnValue(MOCK_CSRF_TOKEN)

      mockFetch.mockResolvedValueOnce(
        successResponse({
          roadmap: {
            roadmapAnalysis: { totalDuration: '3 months', phases: [] },
            executionStrategy: {
              methodology: 'Agile',
              sprintLength: '2 weeks',
              teamRecommendations: '',
              keyMilestones: [],
            },
          },
        })
      )

      const result = await roadmapService.generateRoadmap([makeIdea()], 'My Project')

      expect(result).toMatchObject({
        roadmapAnalysis: { totalDuration: '3 months' },
      })

      const [, fetchOptions] = mockFetch.mock.calls[0]
      expect(fetchOptions).toMatchObject({ credentials: 'include' })
    })
  })

  // -------------------------------------------------------------------------
  // T-0014-023b: RoadmapService.generateRoadmap falls back to mock on 500
  //
  // NOTE: This test will ALSO fail pre-fix due to a pre-existing source bug:
  // RoadmapService.ts:79 references `error` (undeclared) instead of `_error`.
  // Colby must fix this bug as part of Step 1. The test is intentionally left
  // asserting the correct post-fix behavior (mock roadmap returned on 500).
  // -------------------------------------------------------------------------
  describe('T-0014-023b: RoadmapService.generateRoadmap falls back to mock on 500', () => {
    it('should return mock roadmap data when the server returns 500', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(500, { error: { code: 'SERVER_ERROR' } }))

      const result = await roadmapService.generateRoadmap([makeIdea()], 'My Project')

      expect(result).toMatchObject({
        roadmapAnalysis: expect.objectContaining({ totalDuration: expect.any(String) }),
        executionStrategy: expect.objectContaining({ methodology: expect.any(String) }),
      })
    })
  })

  // -------------------------------------------------------------------------
  // T-0014-024: IdeaGenerationService.generateIdea succeeds with mocked 200
  // -------------------------------------------------------------------------
  describe('T-0014-024: IdeaGenerationService.generateIdea succeeds on 200', () => {
    it('should return an AIIdeaResponse when the server responds with 200 and credentials are sent', async () => {
      seedLocalStorageToken()
      mockedGetCsrfToken.mockReturnValue(MOCK_CSRF_TOKEN)

      mockFetch.mockResolvedValueOnce(
        successResponse({
          ideas: [{ title: 'Fast Login', description: 'OAuth flow', impact: 'high', effort: 'low' }],
        })
      )

      const result = await ideaService.generateIdea('Fast Login', { name: 'Auth App' })

      expect(result).toMatchObject({
        content: 'Fast Login',
        details: 'OAuth flow',
      })

      const [, fetchOptions] = mockFetch.mock.calls[0]
      expect(fetchOptions).toMatchObject({ credentials: 'include' })
    })
  })

  // -------------------------------------------------------------------------
  // T-0014-024b: IdeaGenerationService.generateIdea falls back to mock on 500
  //
  // NOTE: This test will ALSO fail pre-fix due to a pre-existing source bug:
  // IdeaGenerationService.ts:68 references `error` (undeclared) instead of
  // `_error`. Colby must fix this bug as part of Step 1. The test asserts the
  // correct post-fix behavior (mock idea returned on 500).
  // -------------------------------------------------------------------------
  describe('T-0014-024b: IdeaGenerationService.generateIdea falls back to mock on 500', () => {
    it('should return a mock idea when the server returns 500', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(500, { error: { code: 'SERVER_ERROR' } }))

      const result = await ideaService.generateIdea('Resilient Feature')

      expect(result).toBeDefined()
      expect(result.content).toBe('Resilient Feature')
    })
  })

  // -------------------------------------------------------------------------
  // T-0014-025: InsightsService.generateInsights succeeds with mocked 200
  // -------------------------------------------------------------------------
  describe('T-0014-025: InsightsService.generateInsights succeeds on 200', () => {
    it('should return insights when the server responds with 200 and credentials are sent', async () => {
      seedLocalStorageToken()
      mockedGetCsrfToken.mockReturnValue(MOCK_CSRF_TOKEN)

      mockFetch.mockResolvedValueOnce(successResponse(VALID_INSIGHTS_RESPONSE))

      const result = await insightsService.generateInsights(
        [makeIdea()],
        'My Project',
        'SaaS'
      )

      expect(result).toMatchObject({
        executiveSummary: 'Strong opportunity.',
      })

      const [, fetchOptions] = mockFetch.mock.calls[0]
      expect(fetchOptions).toMatchObject({ credentials: 'include' })
    })
  })
})
