/**
 * BaseAiService AbortSignal threading — ADR-0015 Step 2 contract tests
 *
 * Tests T-0015-016, T-0015-017, T-0015-018, T-0015-019, T-0015-020
 * from the ADR test spec.
 *
 * These tests define the AbortSignal contract Colby must implement:
 * - fetchWithErrorHandling() accepts optional signal and passes it to fetch()
 * - AiServiceFacade methods accept optional signal and thread it through
 *
 * Pre-build expected state:
 *   ALL FAIL — fetchWithErrorHandling does not accept signal yet,
 *   AiServiceFacade methods do not accept signal yet.
 *
 * After Colby's Step 2 implementation all must PASS.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SUPABASE_STORAGE_KEY } from '../../../../lib/config'

// ---------------------------------------------------------------------------
// Module mocks — hoisted before imports by Vitest
// ---------------------------------------------------------------------------

vi.mock('../../../../utils/cookieUtils', () => ({
  getCsrfToken: vi.fn(() => null),
}))

vi.mock('../../../../utils/logger')

// Cache mock: pass-through so fetchWithErrorHandling is always exercised.
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

// Override fetch globally before importing services so our mock captures the
// reference the module binds at import time — same pattern as BaseAiService.test.ts.
const mockFetch = vi.fn()
Object.defineProperty(global, 'fetch', {
  value: mockFetch,
  writable: true,
  configurable: true,
})

// ---------------------------------------------------------------------------
// Import services AFTER mocks are installed
// ---------------------------------------------------------------------------

import { InsightsService } from '../InsightsService'
import { RoadmapService } from '../RoadmapService'
import { IdeaGenerationService } from '../IdeaGenerationService'
import { AiServiceFacade } from '../../AiServiceFacade'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_BASE_URL = 'https://test-app.example'
const MOCK_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-signal-token'

function seedLocalStorageToken(token = MOCK_ACCESS_TOKEN) {
  localStorage.setItem(
    SUPABASE_STORAGE_KEY,
    JSON.stringify({ access_token: token })
  )
}

function successResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  }
}

const VALID_INSIGHTS_RESPONSE = {
  insights: {
    executiveSummary: 'Signal test passed.',
    keyInsights: [],
    priorityRecommendations: { immediate: [], shortTerm: [], longTerm: [] },
  },
}

const VALID_ROADMAP_RESPONSE = {
  roadmap: {
    roadmapAnalysis: { totalDuration: '3 months', phases: [] },
    executionStrategy: {
      methodology: 'Agile',
      sprintLength: '2 weeks',
      teamRecommendations: '',
      keyMilestones: [],
    },
  },
}

const VALID_IDEA_RESPONSE = {
  ideas: [{ title: 'Signal Test Idea', description: 'Passes signal.', impact: 'high', effort: 'low' }],
}

const makeIdea = () => ({
  id: 'idea-signal-1',
  content: 'Signal Test',
  details: 'Tests AbortSignal threading.',
  x: 100,
  y: 100,
  priority: 'high' as const,
  created_by: 'user-1',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BaseAiService AbortSignal threading — ADR-0015 Step 2 contract', () => {
  let insightsService: InsightsService
  let roadmapService: RoadmapService
  let ideaService: IdeaGenerationService
  let facade: AiServiceFacade

  beforeEach(() => {
    // Re-apply mockFetch to override any MSW beforeAll hook (same pattern as BaseAiService.test.ts)
    Object.defineProperty(global, 'fetch', {
      value: mockFetch,
      writable: true,
      configurable: true,
    })
    vi.clearAllMocks()
    insightsService = new InsightsService({ baseUrl: TEST_BASE_URL })
    roadmapService = new RoadmapService({ baseUrl: TEST_BASE_URL })
    ideaService = new IdeaGenerationService({ baseUrl: TEST_BASE_URL })
    facade = new AiServiceFacade({ baseUrl: TEST_BASE_URL })
  })

  afterEach(() => {
    mockFetch.mockReset()
    localStorage.clear()
    Object.defineProperty(global, 'fetch', {
      value: mockFetch,
      writable: true,
      configurable: true,
    })
  })

  // -------------------------------------------------------------------------
  // T-0015-016: fetchWithErrorHandling passes signal to fetch() when provided
  // -------------------------------------------------------------------------
  describe('T-0015-016: fetchWithErrorHandling passes signal to fetch() when provided', () => {
    it('should include the AbortSignal in fetch() options when a signal is provided', async () => {
      seedLocalStorageToken()
      mockFetch.mockResolvedValueOnce(successResponse(VALID_INSIGHTS_RESPONSE))

      const controller = new AbortController()
      await insightsService.generateInsights([makeIdea()], 'Test Project', undefined, undefined, undefined, undefined, controller.signal)

      const [, fetchOptions] = mockFetch.mock.calls[0]
      expect(fetchOptions).toHaveProperty('signal')
      expect(fetchOptions.signal).toBe(controller.signal)
    })
  })

  // -------------------------------------------------------------------------
  // T-0015-017: fetchWithErrorHandling does NOT include signal when not provided
  // -------------------------------------------------------------------------
  describe('T-0015-017: fetchWithErrorHandling does not include signal when not provided (backward compat)', () => {
    it('should not include signal in fetch() options when no signal is provided', async () => {
      seedLocalStorageToken()
      mockFetch.mockResolvedValueOnce(successResponse(VALID_INSIGHTS_RESPONSE))

      // Call without signal — backward-compatible call signature
      await insightsService.generateInsights([makeIdea()], 'Test Project')

      const [, fetchOptions] = mockFetch.mock.calls[0]
      // signal must be absent or undefined — must not be an AbortSignal
      const signal = fetchOptions?.signal
      const hasAbortSignal = signal instanceof AbortSignal
      expect(hasAbortSignal).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // T-0015-018: AiServiceFacade.generateRoadmap() accepts and passes signal
  // -------------------------------------------------------------------------
  describe('T-0015-018: AiServiceFacade.generateRoadmap() accepts and threads signal', () => {
    it('should pass the provided AbortSignal through to the underlying fetch call', async () => {
      seedLocalStorageToken()
      mockFetch.mockResolvedValueOnce(successResponse(VALID_ROADMAP_RESPONSE))

      const controller = new AbortController()
      await facade.generateRoadmap([makeIdea()], 'My Project', undefined, controller.signal)

      const [, fetchOptions] = mockFetch.mock.calls[0]
      expect(fetchOptions).toHaveProperty('signal')
      expect(fetchOptions.signal).toBe(controller.signal)
    })

    it('should not throw when called without a signal (backward compat)', async () => {
      seedLocalStorageToken()
      mockFetch.mockResolvedValueOnce(successResponse(VALID_ROADMAP_RESPONSE))

      await expect(
        facade.generateRoadmap([makeIdea()], 'My Project')
      ).resolves.toBeDefined()
    })
  })

  // -------------------------------------------------------------------------
  // T-0015-019: AiServiceFacade.generateInsights() accepts and passes signal
  // -------------------------------------------------------------------------
  describe('T-0015-019: AiServiceFacade.generateInsights() accepts and threads signal', () => {
    it('should pass the provided AbortSignal through to the underlying fetch call', async () => {
      seedLocalStorageToken()
      mockFetch.mockResolvedValueOnce(successResponse(VALID_INSIGHTS_RESPONSE))

      const controller = new AbortController()
      await facade.generateInsights([makeIdea()], 'My Project', undefined, undefined, undefined, undefined, controller.signal)

      const [, fetchOptions] = mockFetch.mock.calls[0]
      expect(fetchOptions).toHaveProperty('signal')
      expect(fetchOptions.signal).toBe(controller.signal)
    })

    it('should not throw when called without a signal (backward compat)', async () => {
      seedLocalStorageToken()
      mockFetch.mockResolvedValueOnce(successResponse(VALID_INSIGHTS_RESPONSE))

      await expect(
        facade.generateInsights([makeIdea()], 'My Project')
      ).resolves.toBeDefined()
    })
  })

  // -------------------------------------------------------------------------
  // T-0015-020: AiServiceFacade.generateIdea() accepts and passes signal
  // -------------------------------------------------------------------------
  describe('T-0015-020: AiServiceFacade.generateIdea() accepts and threads signal', () => {
    it('should pass the provided AbortSignal through to the underlying fetch call', async () => {
      seedLocalStorageToken()
      mockFetch.mockResolvedValueOnce(successResponse(VALID_IDEA_RESPONSE))

      const controller = new AbortController()
      await facade.generateIdea('Signal Test Idea', undefined, controller.signal)

      const [, fetchOptions] = mockFetch.mock.calls[0]
      expect(fetchOptions).toHaveProperty('signal')
      expect(fetchOptions.signal).toBe(controller.signal)
    })

    it('should not throw when called without a signal (backward compat)', async () => {
      seedLocalStorageToken()
      mockFetch.mockResolvedValueOnce(successResponse(VALID_IDEA_RESPONSE))

      await expect(
        facade.generateIdea('No Signal Test')
      ).resolves.toBeDefined()
    })
  })

  // -------------------------------------------------------------------------
  // Abort integration: pre-aborted signal causes immediate rejection
  //
  // Uses a pre-aborted controller so the mock can check signal.aborted
  // synchronously and reject without async delay. Pre-build (when signal is
  // not threaded to fetch): options.signal is undefined, the mock returns a
  // success response, and the .rejects assertion fails cleanly -- no timeout.
  // -------------------------------------------------------------------------
  describe('signal abort integration: aborting the signal causes the fetch to reject', () => {
    it('should reject when a pre-aborted signal is passed to the service', async () => {
      seedLocalStorageToken()

      const controller = new AbortController()
      controller.abort()  // pre-abort so the check is synchronous

      const abortError = Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' })

      // When the signal is already aborted, reject immediately.
      // When signal is missing (pre-build), fall through to success so the
      // test fails at .rejects rather than timing out.
      mockFetch.mockImplementationOnce((_url: string, options: RequestInit) => {
        if (options.signal?.aborted) {
          return Promise.reject(abortError)
        }
        return Promise.resolve(successResponse(VALID_INSIGHTS_RESPONSE))
      })

      await expect(
        insightsService.generateInsights(
          [makeIdea()],
          'Abort Test',
          undefined,
          undefined,
          undefined,
          undefined,
          controller.signal
        )
      ).rejects.toThrow()
    })
  })

  // -------------------------------------------------------------------------
  // T-0015-017 variant: BaseAiService 401 retry path preserves signal
  // -------------------------------------------------------------------------
  describe('401 retry path: signal is threaded to the retry fetch call', () => {
    it('should pass the same AbortSignal to the retry fetch after a 401', async () => {
      seedLocalStorageToken()
      const controller = new AbortController()

      const errorResponse = (status: number) => ({
        ok: false,
        status,
        json: () => Promise.resolve({}),
      })

      // First call: 401
      mockFetch.mockResolvedValueOnce(errorResponse(401))
      // Refresh: success
      mockFetch.mockResolvedValueOnce(successResponse({ access_token: 'refreshed-token' }))
      // Retry: 200
      mockFetch.mockResolvedValueOnce(successResponse(VALID_INSIGHTS_RESPONSE))

      await insightsService.generateInsights(
        [makeIdea()],
        'Retry Signal Test',
        undefined,
        undefined,
        undefined,
        undefined,
        controller.signal
      )

      // Third call is the retry — must also carry the signal
      expect(mockFetch).toHaveBeenCalledTimes(3)
      const [, retryOptions] = mockFetch.mock.calls[2]
      expect(retryOptions).toHaveProperty('signal')
      expect(retryOptions.signal).toBe(controller.signal)
    })
  })
})
