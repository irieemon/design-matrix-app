/**
 * RoadmapService — ADR-0016 Step 5 Failure-Path Tests
 *
 * T-0016-037: generateRoadmap on 403 throws
 * T-0016-038: generateRoadmap on 500 throws
 * T-0016-039: generateRoadmap on network error throws
 * T-0016-040: generateRoadmap on 200-empty data.roadmap throws 'AI returned no roadmap -- please try again'
 * T-0016-041: generateRoadmap on AbortError rethrows AbortError
 * T-0016-042: generateRoadmap happy path returns roadmap on 200 with populated data.roadmap (regression)
 * T-0016-043: RoadmapService no longer exposes generateMockRoadmap (method removed)
 *
 * Pre-build expected state:
 *   FAIL — T-0016-037..041: service currently falls back to generateMockRoadmap(), not throw
 *   PASS — T-0016-042: happy path already works (regression guard)
 *   FAIL — T-0016-043: generateMockRoadmap still exists as a private method today
 *
 * After Colby's Step 5 implementation all 7 must PASS.
 *
 * Note on T-0016-043: uses runtime `in`-check (`'generateMockRoadmap' in
 * roadmapService`) per ADR authoring note at line 598-601. No @ts-expect-error.
 * Private methods ARE visible via `in` on the prototype chain in JS runtime
 * even though TypeScript hides them. After Step 5 deletes the method, the check
 * will return false.
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

import { RoadmapService } from '../RoadmapService'
import type { IdeaCard } from '../../../../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_BASE_URL = 'https://test-app.example'
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
    details: 'A test idea for roadmap generation.',
    x: 100,
    y: 100,
    priority: 'high',
    created_by: 'user-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

const VALID_ROADMAP_BODY = {
  roadmap: {
    roadmapAnalysis: {
      totalDuration: '3 months',
      phases: [
        {
          phase: 'Phase 1',
          description: 'Initial work',
          duration: '1 month',
          epics: [],
          risks: [],
          successCriteria: [],
        },
      ],
    },
    executionStrategy: {
      methodology: 'Agile',
      sprintLength: '2 weeks',
      teamRecommendations: 'Cross-functional team',
      keyMilestones: [],
    },
  },
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('RoadmapService — ADR-0016 Step 5 failure paths', () => {
  let service: RoadmapService

  beforeEach(() => {
    Object.defineProperty(global, 'fetch', {
      value: mockFetch,
      writable: true,
      configurable: true,
    })
    vi.clearAllMocks()
    localStorage.clear()
    seedLocalStorage()
    service = new RoadmapService({ baseUrl: TEST_BASE_URL })
  })

  afterEach(() => {
    mockFetch.mockReset()
    localStorage.clear()
  })

  // -------------------------------------------------------------------------
  // T-0016-037: generateRoadmap on 403 throws
  // -------------------------------------------------------------------------
  it(
    // T-0016-037
    'generateRoadmap on 403 throws',
    async () => {
      mockFetch.mockResolvedValue(errorResponse(403))

      await expect(
        service.generateRoadmap([makeIdea()], 'My Project')
      ).rejects.toThrow()
    }
  )

  // -------------------------------------------------------------------------
  // T-0016-038: generateRoadmap on 500 throws
  // -------------------------------------------------------------------------
  it(
    // T-0016-038
    'generateRoadmap on 500 throws',
    async () => {
      mockFetch.mockResolvedValue(errorResponse(500))

      await expect(
        service.generateRoadmap([makeIdea()], 'My Project')
      ).rejects.toThrow()
    }
  )

  // -------------------------------------------------------------------------
  // T-0016-039: generateRoadmap on network error throws
  // -------------------------------------------------------------------------
  it(
    // T-0016-039
    'generateRoadmap on network error throws',
    async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(
        service.generateRoadmap([makeIdea()], 'My Project')
      ).rejects.toThrow()
    }
  )

  // -------------------------------------------------------------------------
  // T-0016-040: generateRoadmap on 200-empty data.roadmap throws exact message
  // -------------------------------------------------------------------------
  it(
    // T-0016-040
    "generateRoadmap on 200 with null/absent data.roadmap throws 'AI returned no roadmap -- please try again'",
    async () => {
      // data.roadmap is absent — currently falls back to generateMockRoadmap()
      mockFetch.mockResolvedValue(successResponse({ roadmap: null }))

      await expect(
        service.generateRoadmap([makeIdea()], 'My Project')
      ).rejects.toThrow('AI returned no roadmap -- please try again')
    }
  )

  // -------------------------------------------------------------------------
  // T-0016-041: generateRoadmap on AbortError rethrows AbortError unwrapped
  // -------------------------------------------------------------------------
  it(
    // T-0016-041
    'generateRoadmap on AbortError rethrows the AbortError without wrapping it',
    async () => {
      const abortError = Object.assign(new Error('The user aborted a request.'), {
        name: 'AbortError',
      })
      mockFetch.mockRejectedValue(abortError)

      const controller = new AbortController()
      controller.abort()

      let caught: unknown
      try {
        await service.generateRoadmap([makeIdea()], 'My Project', undefined, controller.signal)
      } catch (e) {
        caught = e
      }

      expect(caught).toBeDefined()
      // Must be the original AbortError, not a wrapping Error
      expect((caught as Error).name).toBe('AbortError')
    }
  )

  // -------------------------------------------------------------------------
  // T-0016-042: happy-path regression — 200 with populated roadmap returns it
  // -------------------------------------------------------------------------
  it(
    // T-0016-042
    'generateRoadmap happy path returns roadmap on 200 with populated data.roadmap (regression)',
    async () => {
      mockFetch.mockResolvedValue(successResponse(VALID_ROADMAP_BODY))

      const result = await service.generateRoadmap([makeIdea()], 'My Project')

      expect(result).toBeDefined()
      expect(result).toHaveProperty('roadmapAnalysis')
      expect(result).toHaveProperty('executionStrategy')
    }
  )

  // -------------------------------------------------------------------------
  // T-0016-043: RoadmapService no longer exposes generateMockRoadmap (runtime check)
  // Per ADR authoring note: use `in`-check, NOT a TypeScript cast.
  // Today this FAILS because generateMockRoadmap is a private method on the
  // prototype — private in TS but present at runtime. After Step 5 deletes it,
  // this will PASS.
  // -------------------------------------------------------------------------
  it(
    // T-0016-043
    'RoadmapService does not expose generateMockRoadmap (method removed at runtime)',
    () => {
      // Check both own properties and prototype chain
      const hasMethod =
        'generateMockRoadmap' in service ||
        'generateMockRoadmap' in Object.getPrototypeOf(service)

      expect(hasMethod).toBe(false)
    }
  )
})
