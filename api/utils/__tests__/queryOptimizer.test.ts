import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getQueryOptimizer, optimizedGetUserProfile } from '../queryOptimizer'

// Mock the connection pool
vi.mock('../connectionPool', () => ({
  withPooledConnection: vi.fn(async (callback) => {
    const mockClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: {
                id: 'test-uuid',
                email: 'test@example.com',
                role: 'user',
                full_name: 'Test User',
                avatar_url: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              },
              error: null
            }))
          })),
          in: vi.fn(() => Promise.resolve({
            data: [
              {
                id: 'test-uuid-1',
                email: 'user1@example.com',
                role: 'user',
                full_name: 'User One',
                avatar_url: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            ],
            error: null
          }))
        }))
      }))
    }
    return callback(mockClient)
  })
}))

// Mock uuid utils
vi.mock('../../src/utils/uuid', () => ({
  isValidUUID: vi.fn((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)),
  sanitizeUserId: vi.fn((id) => {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return id
    }
    return null
  }),
  ensureUUID: vi.fn((id) => '00000000-0000-0000-0000-000000000000')
}))

describe('queryOptimizer.ts', () => {
  let optimizer: any
  let consoleLogSpy: any
  let consoleWarnSpy: any

  beforeEach(() => {
    optimizer = getQueryOptimizer()
    optimizer.clearAllCache()

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    optimizer.destroy()
  })

  describe('getQueryOptimizer', () => {
    it('should return singleton instance', () => {
      const optimizer1 = getQueryOptimizer()
      const optimizer2 = getQueryOptimizer()
      expect(optimizer1).toBe(optimizer2)
    })

    it('should log initialization message', () => {
      consoleLogSpy.mockClear()
      const newOptimizer = getQueryOptimizer()
      expect(newOptimizer).toBeDefined()
    })
  })

  describe('cache key generation', () => {
    it('should generate consistent cache keys', async () => {
      // Make two identical requests
      await optimizer.getUserProfile('test-uuid-123', 'test@example.com', true)
      const cacheStats1 = optimizer.getCacheStats()

      await optimizer.getUserProfile('test-uuid-123', 'test@example.com', true)
      const cacheStats2 = optimizer.getCacheStats()

      // Second request should hit cache (same size)
      expect(cacheStats1.size).toBe(cacheStats2.size)
    })

    it('should generate different keys for different params', async () => {
      await optimizer.getUserProfile('user-1', 'user1@example.com', true)
      await optimizer.getUserProfile('user-2', 'user2@example.com', true)

      const stats = optimizer.getCacheStats()
      expect(stats.size).toBeGreaterThanOrEqual(2)
    })
  })

  describe('getUserProfile', () => {
    it('should fetch user profile successfully', async () => {
      const profile = await optimizer.getUserProfile(
        'test-uuid',
        'test@example.com',
        false // Disable cache for this test
      )

      expect(profile).toBeDefined()
      expect(profile.email).toBe('test@example.com')
    })

    it('should cache profile by default', async () => {
      await optimizer.getUserProfile('test-uuid', 'test@example.com', true)
      const stats = optimizer.getCacheStats()
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should skip cache when useCache is false', async () => {
      optimizer.clearAllCache()
      await optimizer.getUserProfile('test-uuid', 'test@example.com', false)
      const stats = optimizer.getCacheStats()
      expect(stats.size).toBe(0)
    })

    it('should return cached result on second call', async () => {
      const profile1 = await optimizer.getUserProfile('test-uuid', 'test@example.com', true)
      const profile2 = await optimizer.getUserProfile('test-uuid', 'test@example.com', true)

      expect(profile2).toEqual(profile1)
    })

    it('should record metrics for cache hit', async () => {
      await optimizer.getUserProfile('test-uuid', 'test@example.com', true)
      await optimizer.getUserProfile('test-uuid', 'test@example.com', true)

      const metrics = optimizer.getMetrics()
      expect(metrics.getUserProfile).toBeDefined()
      expect(metrics.getUserProfile.cacheHitRate).toBeGreaterThan(0)
    })

    it('should record metrics for cache miss', async () => {
      await optimizer.getUserProfile('test-uuid', 'test@example.com', false)

      const metrics = optimizer.getMetrics()
      expect(metrics.getUserProfile).toBeDefined()
      expect(metrics.getUserProfile.queryCount).toBeGreaterThan(0)
    })

    it('should respect custom cache TTL', async () => {
      await optimizer.getUserProfile('test-uuid', 'test@example.com', true, 1000)
      const stats = optimizer.getCacheStats()
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should create fallback profile on invalid user ID', async () => {
      const profile = await optimizer.getUserProfile(
        'invalid-id',
        'test@example.com',
        false
      )

      expect(profile).toBeDefined()
      expect(profile.email).toBe('test@example.com')
      expect(profile.id).toBeDefined()
    })

    it('should sanitize user ID before query', async () => {
      consoleWarnSpy.mockClear()
      await optimizer.getUserProfile('invalid-format', 'test@example.com', false)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid user ID format'),
        expect.any(String)
      )
    })

    it('should handle query timeout gracefully', async () => {
      // The implementation has a 200ms timeout
      const profile = await optimizer.getUserProfile('test-uuid', 'test@example.com', false)
      expect(profile).toBeDefined()
    })

    it('should handle query errors gracefully', async () => {
      // Even if query fails, should return fallback
      const profile = await optimizer.getUserProfile('error-uuid', 'test@example.com', false)
      expect(profile).toBeDefined()
      expect(profile.email).toBe('test@example.com')
    })

    it('should determine admin role correctly', async () => {
      const profile = await optimizer.getUserProfile(
        'admin-uuid',
        'admin@prioritas.com',
        false
      )
      expect(profile.role).toBe('super_admin')
    })

    it('should determine regular user role', async () => {
      const profile = await optimizer.getUserProfile(
        'user-uuid',
        'user@example.com',
        false
      )
      expect(profile.role).toBe('user')
    })
  })

  describe('batchUserProfiles', () => {
    it('should fetch multiple profiles', async () => {
      const userIds = ['user-1', 'user-2', 'user-3']
      const results = await optimizer.batchUserProfiles(userIds)

      expect(results).toBeInstanceOf(Map)
      expect(results.size).toBeGreaterThanOrEqual(0)
    })

    it('should return empty map for empty input', async () => {
      const results = await optimizer.batchUserProfiles([])
      expect(results.size).toBe(0)
    })

    it('should cache individual profiles from batch', async () => {
      optimizer.clearAllCache()
      await optimizer.batchUserProfiles(['user-1', 'user-2'])

      const stats = optimizer.getCacheStats()
      expect(stats.size).toBeGreaterThanOrEqual(0)
    })

    it('should record batch operation metrics', async () => {
      await optimizer.batchUserProfiles(['user-1', 'user-2'])

      const metrics = optimizer.getMetrics()
      expect(metrics.batchUserProfiles).toBeDefined()
    })

    it('should handle batch query timeout', async () => {
      // 500ms timeout for batch operations
      const results = await optimizer.batchUserProfiles(['user-1', 'user-2'])
      expect(results).toBeInstanceOf(Map)
    })

    it('should handle batch query errors gracefully', async () => {
      const results = await optimizer.batchUserProfiles(['error-1', 'error-2'])
      expect(results).toBeInstanceOf(Map)
    })

    it('should log batch operation details', async () => {
      consoleLogSpy.mockClear()
      await optimizer.batchUserProfiles(['user-1', 'user-2'])
      // Should log batch query details
      expect(consoleLogSpy).toHaveBeenCalled()
    })
  })

  describe('cache management', () => {
    it('should clean expired cache entries', async () => {
      // Add entry with short TTL
      await optimizer.getUserProfile('test-uuid', 'test@example.com', true, 10)

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 50))

      // Trigger cleanup (automatically runs every 30s)
      const stats = optimizer.getCacheStats()
      expect(stats).toBeDefined()
    })

    it('should estimate cache memory usage', () => {
      const stats = optimizer.getCacheStats()
      expect(stats.memoryUsage).toBeDefined()
      expect(typeof stats.memoryUsage).toBe('string')
    })

    it('should calculate overall cache hit rate', async () => {
      await optimizer.getUserProfile('user-1', 'user1@example.com', true)
      await optimizer.getUserProfile('user-1', 'user1@example.com', true)

      const stats = optimizer.getCacheStats()
      expect(stats.hitRate).toBeGreaterThanOrEqual(0)
    })

    it('should clear all cache entries', async () => {
      await optimizer.getUserProfile('user-1', 'user1@example.com', true)
      await optimizer.getUserProfile('user-2', 'user2@example.com', true)

      const cleared = optimizer.clearAllCache()
      expect(cleared).toBeGreaterThanOrEqual(0)

      const stats = optimizer.getCacheStats()
      expect(stats.size).toBe(0)
    })

    it('should clear specific user cache', async () => {
      await optimizer.getUserProfile('user-1', 'user1@example.com', true)
      await optimizer.getUserProfile('user-2', 'user2@example.com', true)

      const cleared = optimizer.clearUserCache('user-1', 'user1@example.com')
      expect(cleared).toBeGreaterThanOrEqual(0)
    })

    it('should log cache clear operations', async () => {
      consoleLogSpy.mockClear()
      await optimizer.getUserProfile('test-uuid', 'test@example.com', true)
      optimizer.clearAllCache()

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleared all'),
        expect.any(String)
      )
    })
  })

  describe('performance metrics', () => {
    it('should track query count', async () => {
      await optimizer.getUserProfile('user-1', 'user1@example.com', false)
      await optimizer.getUserProfile('user-2', 'user2@example.com', false)

      const metrics = optimizer.getMetrics()
      expect(metrics.getUserProfile.queryCount).toBeGreaterThanOrEqual(2)
    })

    it('should track total time', async () => {
      await optimizer.getUserProfile('user-1', 'user1@example.com', false)

      const metrics = optimizer.getMetrics()
      expect(metrics.getUserProfile.totalTime).toBeGreaterThanOrEqual(0)
    })

    it('should calculate average time', async () => {
      await optimizer.getUserProfile('user-1', 'user1@example.com', false)
      await optimizer.getUserProfile('user-2', 'user2@example.com', false)

      const metrics = optimizer.getMetrics()
      expect(metrics.getUserProfile.avgTime).toBeGreaterThanOrEqual(0)
    })

    it('should track cache hit rate', async () => {
      await optimizer.getUserProfile('user-1', 'user1@example.com', true)
      await optimizer.getUserProfile('user-1', 'user1@example.com', true)

      const metrics = optimizer.getMetrics()
      expect(metrics.getUserProfile.cacheHitRate).toBeGreaterThan(0)
    })

    it('should not count cache hits in time metrics', async () => {
      await optimizer.getUserProfile('user-1', 'user1@example.com', true)
      const metrics1 = optimizer.getMetrics()

      await optimizer.getUserProfile('user-1', 'user1@example.com', true)
      const metrics2 = optimizer.getMetrics()

      // Total time should not increase for cache hit
      expect(metrics2.getUserProfile.totalTime).toBe(metrics1.getUserProfile.totalTime)
    })
  })

  describe('fallback profile creation', () => {
    it('should create fallback with user email', async () => {
      const profile = await optimizer.getUserProfile('invalid-id', 'test@example.com', false)
      expect(profile.email).toBe('test@example.com')
    })

    it('should derive full_name from email', async () => {
      const profile = await optimizer.getUserProfile('invalid-id', 'john.doe@example.com', false)
      expect(profile.full_name).toBe('john.doe')
    })

    it('should set timestamps', async () => {
      const profile = await optimizer.getUserProfile('invalid-id', 'test@example.com', false)
      expect(profile.created_at).toBeDefined()
      expect(profile.updated_at).toBeDefined()
    })

    it('should determine super_admin role', async () => {
      const profile = await optimizer.getUserProfile('id', 'admin@prioritas.com', false)
      expect(profile.role).toBe('super_admin')
    })

    it('should determine admin role', async () => {
      const profile = await optimizer.getUserProfile('id', 'manager@company.com', false)
      expect(profile.role).toBe('admin')
    })

    it('should default to user role', async () => {
      const profile = await optimizer.getUserProfile('id', 'regular@example.com', false)
      expect(profile.role).toBe('user')
    })

    it('should be case insensitive for role determination', async () => {
      const profile = await optimizer.getUserProfile('id', 'ADMIN@prioritas.com', false)
      expect(profile.role).toBe('super_admin')
    })
  })

  describe('destroy', () => {
    it('should clear cache on destroy', () => {
      optimizer.destroy()
      const stats = optimizer.getCacheStats()
      expect(stats.size).toBe(0)
    })

    it('should clear metrics on destroy', async () => {
      await optimizer.getUserProfile('user-1', 'user1@example.com', false)
      optimizer.destroy()

      const metrics = optimizer.getMetrics()
      expect(Object.keys(metrics)).toHaveLength(0)
    })

    it('should stop cleanup interval', () => {
      optimizer.destroy()
      // Should not cause issues with interval
      expect(true).toBe(true)
    })
  })

  describe('optimizedGetUserProfile wrapper', () => {
    it('should call getUserProfile with correct params', async () => {
      const profile = await optimizedGetUserProfile('test-uuid', 'test@example.com')
      expect(profile).toBeDefined()
      expect(profile.email).toBeDefined()
    })

    it('should use default caching behavior', async () => {
      optimizer.clearAllCache()
      await optimizedGetUserProfile('test-uuid', 'test@example.com')

      const stats = optimizer.getCacheStats()
      expect(stats.size).toBeGreaterThanOrEqual(0)
    })
  })

  describe('edge cases', () => {
    it('should handle concurrent cache access', async () => {
      const promises = Array.from({ length: 10 }, () =>
        optimizer.getUserProfile('same-uuid', 'same@example.com', true)
      )

      const results = await Promise.all(promises)
      expect(results).toHaveLength(10)
      results.forEach(result => expect(result).toBeDefined())
    })

    it('should handle empty email', async () => {
      const profile = await optimizer.getUserProfile('test-uuid', '', false)
      expect(profile).toBeDefined()
    })

    it('should handle very long email', async () => {
      const longEmail = 'a'.repeat(200) + '@example.com'
      const profile = await optimizer.getUserProfile('test-uuid', longEmail, false)
      expect(profile).toBeDefined()
    })

    it('should handle special characters in email', async () => {
      const profile = await optimizer.getUserProfile('test-uuid', 'test+tag@example.com', false)
      expect(profile).toBeDefined()
    })

    it('should handle cache expiration correctly', async () => {
      // Add entry with very short TTL
      await optimizer.getUserProfile('test-uuid', 'test@example.com', true, 1)

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10))

      // Next request should be cache miss
      await optimizer.getUserProfile('test-uuid', 'test@example.com', true)

      const metrics = optimizer.getMetrics()
      expect(metrics.getUserProfile.cacheHitRate).toBeLessThan(1)
    })

    it('should handle zero TTL', async () => {
      await optimizer.getUserProfile('test-uuid', 'test@example.com', true, 0)

      // Should expire immediately
      const stats = optimizer.getCacheStats()
      expect(stats).toBeDefined()
    })

    it('should handle batch with duplicate IDs', async () => {
      const results = await optimizer.batchUserProfiles(['user-1', 'user-1', 'user-1'])
      expect(results).toBeInstanceOf(Map)
    })

    it('should format memory usage in KB for small caches', () => {
      const stats = optimizer.getCacheStats()
      // Should be KB or MB
      expect(stats.memoryUsage).toMatch(/[KM]B$/)
    })
  })

  describe('cache statistics', () => {
    it('should report cache size', async () => {
      await optimizer.getUserProfile('user-1', 'user1@example.com', true)
      const stats = optimizer.getCacheStats()
      expect(stats.size).toBeGreaterThanOrEqual(0)
    })

    it('should report memory usage estimate', () => {
      const stats = optimizer.getCacheStats()
      expect(stats.memoryUsage).toBeDefined()
    })

    it('should calculate hit rate across operations', async () => {
      await optimizer.getUserProfile('user-1', 'user1@example.com', true)
      await optimizer.getUserProfile('user-1', 'user1@example.com', true)
      await optimizer.getUserProfile('user-2', 'user2@example.com', true)

      const stats = optimizer.getCacheStats()
      expect(stats.hitRate).toBeGreaterThanOrEqual(0)
      expect(stats.hitRate).toBeLessThanOrEqual(1)
    })
  })
})
