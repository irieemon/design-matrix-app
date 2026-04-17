/**
 * IdeaGenerationService — ADR-0016 Step 4 Failure-Path Tests
 *
 * T-0016-026: generateIdea on 403 throws; does NOT return fallback object
 * T-0016-027: generateIdea on 500 throws; does NOT return fallback object
 * T-0016-028: generateIdea on network error throws
 * T-0016-029: generateIdea on parse error throws
 * T-0016-030: generateIdea on 200-empty data.ideas throws 'AI returned no idea -- please try again'
 * T-0016-031: generateIdea on AbortError rethrows AbortError (does NOT wrap)
 * T-0016-032: generateMultipleIdeas on 403 throws; no MockDataGenerator call
 * T-0016-033: generateMultipleIdeas on 500 throws
 * T-0016-034: generateMultipleIdeas on timeout throws
 * T-0016-035: generateMultipleIdeas on 200-empty data.ideas throws 'AI returned no ideas -- please try again'
 * T-0016-036: generateIdea happy path still returns mapped idea on 200 with populated data.ideas (regression)
 *
 * Pre-build expected state:
 *   FAIL — T-0016-026..035: services currently return mock data, not throw
 *   PASS — T-0016-036: happy path already works (regression guard)
 *
 * After Colby's Step 4 implementation all 11 must PASS.
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

import { IdeaGenerationService } from '../IdeaGenerationService'

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

const VALID_IDEA_BODY = {
  ideas: [
    {
      title: 'Smart Notification System',
      description: 'Reduces notification fatigue with AI filtering.',
      impact: 'high',
      effort: 'medium',
    },
  ],
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('IdeaGenerationService — ADR-0016 Step 4 failure paths', () => {
  let service: IdeaGenerationService

  beforeEach(() => {
    Object.defineProperty(global, 'fetch', {
      value: mockFetch,
      writable: true,
      configurable: true,
    })
    vi.clearAllMocks()
    localStorage.clear()
    seedLocalStorage()
    service = new IdeaGenerationService({ baseUrl: TEST_BASE_URL })
  })

  afterEach(() => {
    mockFetch.mockReset()
    localStorage.clear()
  })

  // -------------------------------------------------------------------------
  // T-0016-026: generateIdea on 403 throws; does NOT return fallback object
  // -------------------------------------------------------------------------
  it(
    // T-0016-026
    'generateIdea on 403 throws and does NOT return fallback object',
    async () => {
      mockFetch.mockResolvedValue(errorResponse(403))

      await expect(
        service.generateIdea('My Feature', { name: 'Test Project' })
      ).rejects.toThrow()
    }
  )

  // -------------------------------------------------------------------------
  // T-0016-027: generateIdea on 500 throws; does NOT return fallback object
  // -------------------------------------------------------------------------
  it(
    // T-0016-027
    'generateIdea on 500 throws and does NOT return fallback object',
    async () => {
      mockFetch.mockResolvedValue(errorResponse(500))

      await expect(
        service.generateIdea('My Feature')
      ).rejects.toThrow()
    }
  )

  // -------------------------------------------------------------------------
  // T-0016-028: generateIdea on network error throws
  // -------------------------------------------------------------------------
  it(
    // T-0016-028
    'generateIdea on network error throws',
    async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(
        service.generateIdea('My Feature')
      ).rejects.toThrow()
    }
  )

  // -------------------------------------------------------------------------
  // T-0016-029: generateIdea on parse error throws
  // -------------------------------------------------------------------------
  it(
    // T-0016-029
    'generateIdea on parse error throws',
    async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => { throw new SyntaxError('Unexpected token') },
      })

      await expect(
        service.generateIdea('My Feature')
      ).rejects.toThrow()
    }
  )

  // -------------------------------------------------------------------------
  // T-0016-030: generateIdea on 200-empty data.ideas throws exact message
  // -------------------------------------------------------------------------
  it(
    // T-0016-030
    "generateIdea on 200 with empty data.ideas throws 'AI returned no idea -- please try again'",
    async () => {
      mockFetch.mockResolvedValue(successResponse({ ideas: [] }))

      await expect(
        service.generateIdea('My Feature')
      ).rejects.toThrow('AI returned no idea -- please try again')
    }
  )

  // -------------------------------------------------------------------------
  // T-0016-031: generateIdea on AbortError rethrows AbortError unwrapped
  // -------------------------------------------------------------------------
  it(
    // T-0016-031
    'generateIdea on AbortError rethrows the AbortError without wrapping it',
    async () => {
      const abortError = Object.assign(new Error('The user aborted a request.'), {
        name: 'AbortError',
      })
      mockFetch.mockRejectedValue(abortError)

      const controller = new AbortController()
      controller.abort()

      let caught: unknown
      try {
        await service.generateIdea('My Feature', undefined, controller.signal)
      } catch (e) {
        caught = e
      }

      expect(caught).toBeDefined()
      // Must be the original AbortError, not a wrapping Error
      expect((caught as Error).name).toBe('AbortError')
    }
  )

  // -------------------------------------------------------------------------
  // T-0016-032: generateMultipleIdeas on 403 throws; no MockDataGenerator call
  // -------------------------------------------------------------------------
  it(
    // T-0016-032
    'generateMultipleIdeas on 403 throws and does not call MockDataGenerator',
    async () => {
      mockFetch.mockResolvedValue(errorResponse(403))

      await expect(
        service.generateMultipleIdeas('My Project', 'Description', 'SaaS')
      ).rejects.toThrow()
    }
  )

  // -------------------------------------------------------------------------
  // T-0016-033: generateMultipleIdeas on 500 throws
  // -------------------------------------------------------------------------
  it(
    // T-0016-033
    'generateMultipleIdeas on 500 throws',
    async () => {
      mockFetch.mockResolvedValue(errorResponse(500))

      await expect(
        service.generateMultipleIdeas('My Project', 'Description', 'SaaS')
      ).rejects.toThrow()
    }
  )

  // -------------------------------------------------------------------------
  // T-0016-034: generateMultipleIdeas on timeout throws
  // -------------------------------------------------------------------------
  it(
    // T-0016-034
    'generateMultipleIdeas on timeout (network rejection) throws',
    async () => {
      mockFetch.mockRejectedValue(new Error('Request timeout'))

      await expect(
        service.generateMultipleIdeas('My Project', 'Description', 'SaaS')
      ).rejects.toThrow()
    }
  )

  // -------------------------------------------------------------------------
  // T-0016-035: generateMultipleIdeas on 200-empty data.ideas throws exact message
  // -------------------------------------------------------------------------
  it(
    // T-0016-035
    "generateMultipleIdeas on 200 with empty data.ideas throws 'AI returned no ideas -- please try again'",
    async () => {
      mockFetch.mockResolvedValue(successResponse({ ideas: [] }))

      await expect(
        service.generateMultipleIdeas('My Project', 'Description', 'SaaS')
      ).rejects.toThrow('AI returned no ideas -- please try again')
    }
  )

  // -------------------------------------------------------------------------
  // T-0016-036: happy-path regression — 200 with populated ideas returns mapped result
  // -------------------------------------------------------------------------
  it(
    // T-0016-036
    'generateIdea happy path returns mapped idea on 200 with populated data.ideas (regression)',
    async () => {
      mockFetch.mockResolvedValue(successResponse(VALID_IDEA_BODY))

      const result = await service.generateIdea('Smart Notification System', {
        name: 'Test Project',
        type: 'SaaS',
      })

      expect(result).toBeDefined()
      expect(typeof result.content).toBe('string')
      expect(result.content.length).toBeGreaterThan(0)
      expect(typeof result.priority).toBe('string')
    }
  )
})
