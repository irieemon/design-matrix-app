/**
 * InsightsService + AiServiceFacade — ADR-0014 Step 2 Contract Tests
 *
 * T-0014-012: AiServiceFacade.generateInsights() passes preferredModel through
 *             to InsightsService.generateInsights().
 * T-0014-013: InsightsService.generateInsights() includes modelSelection.model
 *             equal to preferredModel in the request payload when preferredModel
 *             is provided.
 * T-0014-014: InsightsService.generateInsights() includes the router-default
 *             model in the request payload when preferredModel is undefined.
 *
 * Pre-build expected state:
 *   FAIL — T-0014-012: facade does not accept preferredModel parameter yet
 *   FAIL — T-0014-013: InsightsService does not accept or thread preferredModel yet
 *   FAIL — T-0014-014: InsightsService does not include modelSelection in payload yet
 *
 * After Colby's Step 2 implementation all three must PASS.
 *
 * Implementation notes:
 * - No projectId is passed so that the dynamic DatabaseService / FileService
 *   imports inside InsightsService are never triggered. This matches the
 *   pattern in BaseAiService.test.ts (T-0014-025).
 * - The global fetch mock is re-applied in beforeEach to override MSW's
 *   beforeAll hook (same pattern as BaseAiService.test.ts).
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

// Cache mock: pass through directly to the generator callback so that
// fetchWithErrorHandling is always exercised.
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

// ---------------------------------------------------------------------------
// Global fetch mock — defined before imports so services capture it at load
// time; re-applied in beforeEach to override MSW's beforeAll registration.
// ---------------------------------------------------------------------------

const mockFetch = vi.fn()
Object.defineProperty(global, 'fetch', {
  value: mockFetch,
  writable: true,
  configurable: true,
})

// ---------------------------------------------------------------------------
// Imports AFTER mocks
// ---------------------------------------------------------------------------

import { InsightsService } from '../InsightsService'
import { AiServiceFacade } from '../../AiServiceFacade'
import type { OpenAIModel } from '../../openaiModelRouter'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_BASE_URL = 'https://test-app.example'
const MOCK_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test'

const sampleIdeas = [
  {
    id: 'idea1',
    content: 'Feature A',
    details: 'Details for feature A',
    x: 100,
    y: 100,
    priority: 'high' as const,
    created_by: 'user1',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
]

const VALID_INSIGHTS_RESPONSE = {
  insights: {
    executiveSummary: 'Strong opportunity.',
    keyInsights: [{ insight: 'Market gap', impact: 'High' }],
    priorityRecommendations: { immediate: ['Ship MVP'], shortTerm: [], longTerm: [] },
  },
}

function makeFetchSuccess(): void {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => VALID_INSIGHTS_RESPONSE,
  })
}

function seedLocalStorage(): void {
  localStorage.setItem(SUPABASE_STORAGE_KEY, JSON.stringify({ access_token: MOCK_ACCESS_TOKEN }))
}

// ---------------------------------------------------------------------------
// T-0014-013 & T-0014-014 — InsightsService.generateInsights() payload
// ---------------------------------------------------------------------------

describe('InsightsService.generateInsights() — request payload', () => {
  let service: InsightsService

  beforeEach(() => {
    // Re-apply fetch mock each test to override any MSW resets from setup.ts.
    Object.defineProperty(global, 'fetch', {
      value: mockFetch,
      writable: true,
      configurable: true,
    })
    vi.clearAllMocks()
    localStorage.clear()
    seedLocalStorage()
    service = new InsightsService({ baseUrl: TEST_BASE_URL })
    makeFetchSuccess()
  })

  afterEach(() => {
    mockFetch.mockReset()
    localStorage.clear()
  })

  it(
    // T-0014-013
    'includes modelSelection.model equal to preferredModel in request payload when preferredModel is provided',
    async () => {
      const preferredModel: OpenAIModel = 'gpt-5-mini'

      // No projectId — avoids dynamic DatabaseService / FileService imports
      await service.generateInsights(
        sampleIdeas,
        'My Project',
        'SaaS',
        undefined, // projectId
        null,      // currentProject
        preferredModel
      )

      expect(mockFetch).toHaveBeenCalledOnce()

      const [, options] = mockFetch.mock.calls[0]
      const body = JSON.parse(options.body)

      expect(body).toHaveProperty('modelSelection')
      expect(body.modelSelection.model).toBe(preferredModel)
    }
  )

  it(
    // T-0014-014
    'includes default model in request payload when preferredModel is undefined',
    async () => {
      // No preferredModel — the router picks the default.
      await service.generateInsights(
        sampleIdeas,
        'My Project',
        'SaaS',
        undefined, // projectId
        null,      // currentProject
        undefined  // preferredModel
      )

      expect(mockFetch).toHaveBeenCalledOnce()

      const [, options] = mockFetch.mock.calls[0]
      const body = JSON.parse(options.body)

      // The router must still supply a modelSelection object with a non-empty
      // model string. We do not hard-code the exact default so this remains
      // valid if the router's defaults change.
      expect(body).toHaveProperty('modelSelection')
      expect(typeof body.modelSelection.model).toBe('string')
      expect(body.modelSelection.model.length).toBeGreaterThan(0)
    }
  )
})

// ---------------------------------------------------------------------------
// T-0014-012 — AiServiceFacade.generateInsights() passes preferredModel
// ---------------------------------------------------------------------------

describe('AiServiceFacade.generateInsights() — preferredModel passthrough', () => {
  beforeEach(() => {
    Object.defineProperty(global, 'fetch', {
      value: mockFetch,
      writable: true,
      configurable: true,
    })
    vi.clearAllMocks()
    localStorage.clear()
    seedLocalStorage()
  })

  afterEach(() => {
    mockFetch.mockReset()
    localStorage.clear()
  })

  it(
    // T-0014-012
    'passes preferredModel to InsightsService.generateInsights()',
    async () => {
      const preferredModel: OpenAIModel = 'gpt-5'

      // Spy on InsightsService.prototype to capture the delegation call
      // without involving fetch or the real implementation.
      const generateInsightsSpy = vi
        .spyOn(InsightsService.prototype, 'generateInsights')
        .mockResolvedValue(VALID_INSIGHTS_RESPONSE.insights as any)

      const facade = new AiServiceFacade({ baseUrl: TEST_BASE_URL })

      await facade.generateInsights(
        sampleIdeas,
        'My Project',
        'SaaS',
        undefined, // projectId
        null,      // currentProject
        preferredModel
      )

      expect(generateInsightsSpy).toHaveBeenCalledOnce()

      // preferredModel must be the 6th argument (index 5)
      const callArgs = generateInsightsSpy.mock.calls[0]
      expect(callArgs[5]).toBe(preferredModel)

      generateInsightsSpy.mockRestore()
    }
  )
})
