/**
 * useAIQuota hook — ADR-0015 Step 4 contract tests
 *
 * Tests T-0015-053 through T-0015-057 from the ADR test spec, plus
 * supplemental coverage for event listener cleanup and initial state.
 *
 * Pre-build expected state:
 *   ALL FAIL — useAIQuota does not exist yet.
 *
 * After Colby's Step 4 implementation all must PASS.
 *
 * Interface under test (ADR-0015 §Data Contract §useAIQuota hook):
 *   { quota: QuotaData | null, isLoading: boolean, error: Error | null, refresh: () => void }
 *
 * where QuotaData:
 *   { canUse: boolean, current: number, limit: number, percentageUsed: number,
 *     isUnlimited: boolean, resetsAt: string }
 *
 * Fetch target: GET /api/ai?action=quota-status&type=ai_ideas
 * Cache TTL: 60 seconds
 * Refresh trigger: CustomEvent('ai-quota-changed') on window
 * Tier gate: returns null quota when subscription tier is 'team' or 'enterprise'
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Module-level mocks — hoisted before imports by Vitest
// ---------------------------------------------------------------------------

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// useAIQuota reads subscription tier to gate visibility for paid tiers.
// Default: free tier (quota visible).
const mockUseSubscription = vi.fn()
vi.mock('../useSubscription', () => ({
  useSubscription: () => mockUseSubscription(),
}))

// ---------------------------------------------------------------------------
// Import hook after mocks are installed
// ---------------------------------------------------------------------------

import { useAIQuota } from '../useAIQuota'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FREE_TIER_SUBSCRIPTION = {
  subscription: { id: 'sub-1', tier: 'free', status: 'active' },
  limits: null,
  isLoading: false,
  error: null,
  refresh: vi.fn(),
}

const TEAM_TIER_SUBSCRIPTION = {
  subscription: { id: 'sub-2', tier: 'team', status: 'active' },
  limits: null,
  isLoading: false,
  error: null,
  refresh: vi.fn(),
}

const ENTERPRISE_TIER_SUBSCRIPTION = {
  subscription: { id: 'sub-3', tier: 'enterprise', status: 'active' },
  limits: null,
  isLoading: false,
  error: null,
  refresh: vi.fn(),
}

const QUOTA_RESPONSE = {
  canUse: true,
  current: 3,
  limit: 5,
  percentageUsed: 60,
  isUnlimited: false,
  resetsAt: '2026-05-01T00:00:00.000Z',
}

const UNLIMITED_QUOTA_RESPONSE = {
  canUse: true,
  current: 0,
  limit: 0,
  percentageUsed: 0,
  isUnlimited: true,
  resetsAt: '2026-05-01T00:00:00.000Z',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetchSuccess(body: object): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response)
}

function makeFetchFailure(status = 500, message = 'Internal Server Error'): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ error: message }),
  } as Response)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAIQuota — ADR-0015 Step 4 contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Default: free tier user
    mockUseSubscription.mockReturnValue(FREE_TIER_SUBSCRIPTION)
  })

  afterEach(() => {
    vi.runAllTimers()
    vi.useRealTimers()
  })

  // -------------------------------------------------------------------------
  // T-0015-053: returns correct initial shape and fetches on mount
  // -------------------------------------------------------------------------
  describe('T-0015-053: fetches quota on mount and returns { quota, isLoading, error, refresh }', () => {
    it('should start in loading state and return quota data after fetch resolves', async () => {
      vi.stubGlobal('fetch', makeFetchSuccess(QUOTA_RESPONSE))

      const { result } = renderHook(() => useAIQuota())

      // Initial state: loading
      expect(result.current.isLoading).toBe(true)
      expect(result.current.quota).toBeNull()

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.quota).toEqual(QUOTA_RESPONSE)
      expect(result.current.error).toBeNull()
      expect(typeof result.current.refresh).toBe('function')
    })

    it('should call the correct endpoint on mount', async () => {
      const fetchMock = makeFetchSuccess(QUOTA_RESPONSE)
      vi.stubGlobal('fetch', fetchMock)

      renderHook(() => useAIQuota())

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1)
      })

      const [url] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [string]
      expect(url).toContain('action=quota-status')
      expect(url).toContain('type=ai_ideas')
    })
  })

  // -------------------------------------------------------------------------
  // T-0015-054: caches result for 60 seconds — second mount within 60s skips fetch
  // -------------------------------------------------------------------------
  describe('T-0015-054: caches result for 60 seconds', () => {
    it('should not re-fetch when the hook is remounted within the 60s cache window', async () => {
      const fetchMock = makeFetchSuccess(QUOTA_RESPONSE)
      vi.stubGlobal('fetch', fetchMock)

      // First mount — populates cache
      const { result: first, unmount: unmountFirst } = renderHook(() => useAIQuota())
      await waitFor(() => {
        expect(first.current.isLoading).toBe(false)
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)

      unmountFirst()

      // Advance time but stay within 60s window
      act(() => {
        vi.advanceTimersByTime(30_000)
      })

      // Second mount — should use cached data, not fetch again
      const { result: second } = renderHook(() => useAIQuota())

      // Should resolve immediately from cache (not enter loading state)
      await waitFor(() => {
        expect(second.current.isLoading).toBe(false)
      })

      expect(second.current.quota).toEqual(QUOTA_RESPONSE)
      // Still only one fetch call total
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('should re-fetch when the 60s cache window has expired', async () => {
      const fetchMock = makeFetchSuccess(QUOTA_RESPONSE)
      vi.stubGlobal('fetch', fetchMock)

      // First mount
      const { result: first, unmount: unmountFirst } = renderHook(() => useAIQuota())
      await waitFor(() => {
        expect(first.current.isLoading).toBe(false)
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)

      unmountFirst()

      // Advance past the 60s TTL
      act(() => {
        vi.advanceTimersByTime(61_000)
      })

      // Second mount — cache is stale, must re-fetch
      const { result: second } = renderHook(() => useAIQuota())
      await waitFor(() => {
        expect(second.current.isLoading).toBe(false)
      })

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(second.current.quota).toEqual(QUOTA_RESPONSE)
    })
  })

  // -------------------------------------------------------------------------
  // T-0015-055: re-fetches when ai-quota-changed CustomEvent is dispatched
  // -------------------------------------------------------------------------
  describe('T-0015-055: re-fetches on ai-quota-changed CustomEvent', () => {
    it('should refresh quota data when ai-quota-changed is dispatched on window', async () => {
      const UPDATED_QUOTA = { ...QUOTA_RESPONSE, current: 4, percentageUsed: 80 }

      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(QUOTA_RESPONSE),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(UPDATED_QUOTA),
        } as Response)

      vi.stubGlobal('fetch', fetchMock)

      const { result } = renderHook(() => useAIQuota())

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
      expect(result.current.quota?.current).toBe(3)

      // Dispatch the custom event (simulating generation completion)
      act(() => {
        window.dispatchEvent(new CustomEvent('ai-quota-changed'))
      })

      // Hook should re-fetch and return updated data
      await waitFor(() => {
        expect(result.current.quota?.current).toBe(4)
      })

      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })

  // -------------------------------------------------------------------------
  // T-0015-056: returns null quota for team/enterprise tier (badge hidden)
  // -------------------------------------------------------------------------
  describe('T-0015-056: returns null quota for team/enterprise tier', () => {
    it('should return null quota for team tier without fetching', async () => {
      mockUseSubscription.mockReturnValue(TEAM_TIER_SUBSCRIPTION)
      const fetchMock = makeFetchSuccess(UNLIMITED_QUOTA_RESPONSE)
      vi.stubGlobal('fetch', fetchMock)

      const { result } = renderHook(() => useAIQuota())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.quota).toBeNull()
      // Should not fetch for paid tiers — quota badge is hidden
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('should return null quota for enterprise tier without fetching', async () => {
      mockUseSubscription.mockReturnValue(ENTERPRISE_TIER_SUBSCRIPTION)
      const fetchMock = makeFetchSuccess(UNLIMITED_QUOTA_RESPONSE)
      vi.stubGlobal('fetch', fetchMock)

      const { result } = renderHook(() => useAIQuota())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.quota).toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // T-0015-057: returns error state on fetch failure
  // -------------------------------------------------------------------------
  describe('T-0015-057: returns error state on fetch failure', () => {
    it('should set error and keep quota null when the fetch fails', async () => {
      vi.stubGlobal('fetch', makeFetchFailure(500))

      const { result } = renderHook(() => useAIQuota())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.quota).toBeNull()
      expect(result.current.error).not.toBeNull()
    })

    it('should set error when fetch rejects (network failure)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

      const { result } = renderHook(() => useAIQuota())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.quota).toBeNull()
      expect(result.current.error).not.toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // Event listener cleanup on unmount
  // -------------------------------------------------------------------------
  describe('event listener cleanup', () => {
    it('should remove the ai-quota-changed listener when the component unmounts', async () => {
      vi.stubGlobal('fetch', makeFetchSuccess(QUOTA_RESPONSE))

      const addEventSpy = vi.spyOn(window, 'addEventListener')
      const removeEventSpy = vi.spyOn(window, 'removeEventListener')

      const { unmount } = renderHook(() => useAIQuota())

      await waitFor(() => {
        expect(addEventSpy).toHaveBeenCalledWith(
          'ai-quota-changed',
          expect.any(Function)
        )
      })

      unmount()

      expect(removeEventSpy).toHaveBeenCalledWith(
        'ai-quota-changed',
        expect.any(Function)
      )

      addEventSpy.mockRestore()
      removeEventSpy.mockRestore()
    })
  })
})
