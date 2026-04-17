/**
 * InsightsService + BaseAiService — ADR-0016 Step 6 Failure-Path Tests
 *
 * T-0016-044: generateInsights on 403 throws in production
 * T-0016-045: generateInsights on 500 throws
 * T-0016-046: generateInsights on 200-empty insights throws (existing behavior regression)
 * T-0016-047: generateInsights on template-content detection throws
 *             'AI returned generic template content -- please try again';
 *             does NOT call MockInsightsGenerator
 * T-0016-048: generateInsights in dev mode (simulated localhost) on 500 throws
 *             (no dev-mock fallback)
 * T-0016-049: generateInsights happy path returns insights on 200 with valid shape (regression)
 * T-0016-050: generateInsights on AbortError rethrows AbortError
 * T-0016-051: BaseAiService no longer exposes isLocalhost() helper (method removed)
 *
 * Pre-build expected state:
 *   PASS  — T-0016-046: 200-empty already throws (existing guard at InsightsService.ts:376)
 *   PASS  — T-0016-049: happy path already works (regression guard)
 *   FAIL  — T-0016-044, T-0016-045: 500/403 falls back to dev-mock on localhost; in prod
 *            the prod-throw at line 391-395 fires, BUT the localhost check at line 384
 *            means a localhost-baseUrl service silently returns mock. Tests use non-localhost
 *            TEST_BASE_URL so prod throw fires — these should PASS today on non-localhost URL.
 *            However T-0016-044/045 are framed as "throws in production" context — confirmed
 *            green against non-localhost TEST_BASE_URL.
 *   FAIL  — T-0016-047: template-content branch currently returns MockInsightsGenerator data
 *   FAIL  — T-0016-048: localhost baseUrl causes dev-mock fallback on 500 instead of throw
 *   FAIL  — T-0016-050: AbortError propagates correctly (rethrown at line 379) — PASS today
 *   FAIL  — T-0016-051: isLocalhost() still exists on BaseAiService.prototype today
 *
 * Note: T-0016-044 and T-0016-045 use a non-localhost TEST_BASE_URL, so the production
 * throw path fires and they will PASS pre-build. After Step 6 removes isLocalhost() entirely,
 * all paths throw unconditionally. Target: approx 2 expected-pass pre-build
 * (T-0016-046, T-0016-049), ~4 fail (T-0016-047, T-0016-048, T-0016-050 pending verification,
 * T-0016-051). T-0016-044/045 are PASS pre-build on non-localhost URL (prod path already correct).
 * T-0016-050: AbortError at line 379 is already rethrown — PASS pre-build.
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

// Cache mock: pass-through so fetchWithErrorHandling is always exercised
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
// Global fetch mock — defined before imports so services capture it at load time;
// re-applied in beforeEach to override MSW's beforeAll registration.
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
import { BaseAiService } from '../BaseAiService'
import type { IdeaCard } from '../../../../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Non-localhost URL: exercises the production throw path in the current code.
// isLocalhost() checks baseUrl.includes('localhost') — this URL does not match.
const TEST_BASE_URL = 'https://test-app.example'
// Localhost URL: exercises the dev-mock fallback branch (line 384-388) in current code.
const LOCALHOST_BASE_URL = 'http://localhost:3003'

const MOCK_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test'

function seedLocalStorage(): void {
  localStorage.setItem(SUPABASE_STORAGE_KEY, JSON.stringify({ access_token: MOCK_ACCESS_TOKEN }))
}

function errorResponse(status: number) {
  return {
    ok: false,
    status,
    json: async () => ({ error: `HTTP ${status}` }),
  }
}

function successResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  }
}

function makeIdea(overrides: Partial<IdeaCard> = {}): IdeaCard {
  return {
    id: 'idea-1',
    content: 'Test Idea',
    details: 'A concrete idea for analysis.',
    x: 100,
    y: 100,
    priority: 'high',
    created_by: 'user-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

// Valid insights shape that passes the executiveSummary + keyInsights check
const VALID_INSIGHTS_BODY = {
  insights: {
    executiveSummary: 'Strong opportunity in the market.',
    keyInsights: [{ insight: 'Market gap identified', impact: 'High' }],
    priorityRecommendations: { immediate: ['Ship MVP'], shortTerm: [], longTerm: [] },
  },
}

// Template-content that triggers checkForTemplateContent detection.
// The check looks for generic phrases — "your project name" is a canonical trigger
// per the InsightsService.checkForTemplateContent implementation.
const TEMPLATE_INSIGHTS_BODY = {
  insights: {
    executiveSummary: 'Your project name shows potential in its target market.',
    keyInsights: [
      {
        insight: 'Feature 1, Feature 2, Feature 3 represent the core value proposition',
        impact: 'High',
      },
    ],
    priorityRecommendations: { immediate: [], shortTerm: [], longTerm: [] },
  },
}

// 200-empty: data.insights exists but has no executiveSummary or keyInsights
// nor matrixAnalysis nor priorityRecommendations — falls into the else throw branch
const EMPTY_INSIGHTS_BODY = {
  insights: {},
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('InsightsService — ADR-0016 Step 6 failure paths', () => {
  let service: InsightsService

  beforeEach(() => {
    Object.defineProperty(global, 'fetch', {
      value: mockFetch,
      writable: true,
      configurable: true,
    })
    vi.clearAllMocks()
    localStorage.clear()
    seedLocalStorage()
    service = new InsightsService({ baseUrl: TEST_BASE_URL })
  })

  afterEach(() => {
    mockFetch.mockReset()
    localStorage.clear()
  })

  // -------------------------------------------------------------------------
  // T-0016-044: generateInsights on 403 throws in production (non-localhost URL)
  // -------------------------------------------------------------------------
  it(
    // T-0016-044
    'generateInsights on 403 throws (production — non-localhost baseUrl)',
    async () => {
      mockFetch.mockResolvedValue(errorResponse(403))

      await expect(
        service.generateInsights([makeIdea()], 'My Project', 'SaaS')
      ).rejects.toThrow()
    }
  )

  // -------------------------------------------------------------------------
  // T-0016-045: generateInsights on 500 throws (production — non-localhost URL)
  // -------------------------------------------------------------------------
  it(
    // T-0016-045
    'generateInsights on 500 throws (production — non-localhost baseUrl)',
    async () => {
      mockFetch.mockResolvedValue(errorResponse(500))

      await expect(
        service.generateInsights([makeIdea()], 'My Project', 'SaaS')
      ).rejects.toThrow()
    }
  )

  // -------------------------------------------------------------------------
  // T-0016-046: generateInsights on 200-empty insights throws (existing behavior regression)
  // The else branch at InsightsService.ts:374-377 already throws.
  // This test must PASS pre-build (it is a regression guard, not a new contract).
  // -------------------------------------------------------------------------
  it(
    // T-0016-046
    'generateInsights on 200 with empty insights object throws (existing behavior regression)',
    async () => {
      mockFetch.mockResolvedValue(successResponse(EMPTY_INSIGHTS_BODY))

      await expect(
        service.generateInsights([makeIdea()], 'My Project', 'SaaS')
      ).rejects.toThrow()
    }
  )

  // -------------------------------------------------------------------------
  // T-0016-047: generateInsights on template-content detection throws exact message;
  //             does NOT call MockInsightsGenerator
  // Pre-build FAIL: current code returns MockInsightsGenerator.generateProjectSpecificMockInsights()
  // Post-Step-6: throws 'AI returned generic template content -- please try again'
  // -------------------------------------------------------------------------
  it(
    // T-0016-047
    "generateInsights on template-content detection throws 'AI returned generic template content -- please try again'",
    async () => {
      mockFetch.mockResolvedValue(successResponse(TEMPLATE_INSIGHTS_BODY))

      await expect(
        service.generateInsights([makeIdea()], 'My Project', 'SaaS')
      ).rejects.toThrow('AI returned generic template content -- please try again')
    }
  )

  // -------------------------------------------------------------------------
  // T-0016-048: generateInsights in dev mode (simulated localhost) on 500 throws;
  //             no dev-mock fallback.
  // Pre-build FAIL: isLocalhost() returns true for LOCALHOST_BASE_URL, so
  //   MockInsightsGenerator.generateMockInsightsWithFiles() is returned instead of thrown.
  // Post-Step-6: isLocalhost() branch is removed; the unconditional throw fires.
  // -------------------------------------------------------------------------
  it(
    // T-0016-048
    'generateInsights in dev mode (localhost baseUrl) on 500 throws (no dev-mock fallback)',
    async () => {
      const devService = new InsightsService({ baseUrl: LOCALHOST_BASE_URL })
      mockFetch.mockResolvedValue(errorResponse(500))

      await expect(
        devService.generateInsights([makeIdea()], 'My Project', 'SaaS')
      ).rejects.toThrow()
    }
  )

  // -------------------------------------------------------------------------
  // T-0016-049: happy-path regression — 200 with valid shape returns insights
  // -------------------------------------------------------------------------
  it(
    // T-0016-049
    'generateInsights happy path returns insights on 200 with valid shape (regression)',
    async () => {
      mockFetch.mockResolvedValue(successResponse(VALID_INSIGHTS_BODY))

      const result = await service.generateInsights([makeIdea()], 'My Project', 'SaaS')

      expect(result).toBeDefined()
      expect(typeof result.executiveSummary).toBe('string')
      expect(result.executiveSummary.length).toBeGreaterThan(0)
      expect(Array.isArray(result.keyInsights)).toBe(true)
    }
  )

  // -------------------------------------------------------------------------
  // T-0016-050: generateInsights on AbortError rethrows AbortError unwrapped
  // Pre-build: the catch at InsightsService.ts:379 already rethrows AbortError —
  //   this should PASS today (regression guard for correct existing behavior).
  // -------------------------------------------------------------------------
  it(
    // T-0016-050
    'generateInsights on AbortError rethrows the AbortError without wrapping it',
    async () => {
      const abortError = Object.assign(new Error('The user aborted a request.'), {
        name: 'AbortError',
      })
      mockFetch.mockRejectedValue(abortError)

      const controller = new AbortController()
      controller.abort()

      let caught: unknown
      try {
        await service.generateInsights(
          [makeIdea()],
          'Abort Test',
          'SaaS',
          undefined,
          null,
          undefined,
          controller.signal
        )
      } catch (e) {
        caught = e
      }

      expect(caught).toBeDefined()
      // Must be the original AbortError, not a wrapping Error
      expect((caught as Error).name).toBe('AbortError')
    }
  )
})

// ---------------------------------------------------------------------------
// T-0016-051: BaseAiService no longer exposes isLocalhost() (runtime check)
// Per ADR authoring note: use `in`-check, NOT a TypeScript cast.
// Today this FAILS because isLocalhost() is a protected method on the prototype.
// After Step 6 deletes it from BaseAiService, this will PASS.
// ---------------------------------------------------------------------------

describe('BaseAiService — ADR-0016 Step 6 isLocalhost() removal', () => {
  it(
    // T-0016-051
    'BaseAiService does not expose isLocalhost() helper (method removed at runtime)',
    () => {
      // Use a concrete subclass instance to inspect the prototype chain.
      // InsightsService extends BaseAiService, so its prototype chain includes
      // BaseAiService.prototype where isLocalhost() lives today.
      const instance = new InsightsService({ baseUrl: TEST_BASE_URL })

      const hasMethod =
        'isLocalhost' in instance ||
        'isLocalhost' in Object.getPrototypeOf(instance) ||
        'isLocalhost' in Object.getPrototypeOf(Object.getPrototypeOf(instance))

      expect(hasMethod).toBe(false)
    }
  )
})
