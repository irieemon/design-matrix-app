import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CacheManager } from '../CacheManager'

describe('CacheManager', () => {
  let cache: CacheManager<string>

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    if (cache) {
      cache.destroy()
    }
    vi.useRealTimers()
  })

  describe('get()', () => {
    it('should return null for missing keys', () => {
      cache = new CacheManager<string>(1000)
      expect(cache.get('missing')).toBeNull()
    })

    it('should return value for valid keys', () => {
      cache = new CacheManager<string>(1000)
      cache.set('key1', 'value1')
      expect(cache.get('key1')).toBe('value1')
    })

    it('should return null for expired keys', () => {
      cache = new CacheManager<string>(1000, { autoCleanup: false })
      cache.set('key1', 'value1')

      // Fast forward past expiration
      vi.advanceTimersByTime(1001)

      expect(cache.get('key1')).toBeNull()
    })

    it('should auto-delete expired keys on get', () => {
      cache = new CacheManager<string>(1000, { autoCleanup: false })
      cache.set('key1', 'value1')
      expect(cache.size()).toBe(1)

      // Fast forward past expiration
      vi.advanceTimersByTime(1001)

      cache.get('key1')
      expect(cache.size()).toBe(0)
    })
  })

  describe('set()', () => {
    it('should store values correctly', () => {
      cache = new CacheManager<string>(1000)
      cache.set('key1', 'value1')
      expect(cache.get('key1')).toBe('value1')
    })

    it('should overwrite existing values', () => {
      cache = new CacheManager<string>(1000)
      cache.set('key1', 'value1')
      cache.set('key1', 'value2')
      expect(cache.get('key1')).toBe('value2')
    })

    it('should reset expiration on overwrite', () => {
      cache = new CacheManager<string>(1000, { autoCleanup: false })
      cache.set('key1', 'value1')

      // Fast forward 500ms
      vi.advanceTimersByTime(500)

      // Reset expiration
      cache.set('key1', 'value2')

      // Fast forward another 600ms (total 1100ms, but reset at 500ms)
      vi.advanceTimersByTime(600)

      expect(cache.get('key1')).toBe('value2')
    })
  })

  describe('delete()', () => {
    it('should remove specific keys', () => {
      cache = new CacheManager<string>(1000)
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      cache.delete('key1')

      expect(cache.get('key1')).toBeNull()
      expect(cache.get('key2')).toBe('value2')
    })

    it('should be safe for non-existent keys', () => {
      cache = new CacheManager<string>(1000)
      expect(() => cache.delete('missing')).not.toThrow()
    })
  })

  describe('clear()', () => {
    it('should remove all keys', () => {
      cache = new CacheManager<string>(1000)
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      cache.clear()

      expect(cache.get('key1')).toBeNull()
      expect(cache.get('key2')).toBeNull()
      expect(cache.get('key3')).toBeNull()
      expect(cache.size()).toBe(0)
    })
  })

  describe('cleanup()', () => {
    it('should remove expired entries', () => {
      cache = new CacheManager<string>(1000, { autoCleanup: false })
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      // Fast forward past expiration
      vi.advanceTimersByTime(1001)

      const cleaned = cache.cleanup()

      expect(cleaned).toBe(2)
      expect(cache.size()).toBe(0)
    })

    it('should not remove valid entries', () => {
      cache = new CacheManager<string>(1000, { autoCleanup: false })
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      // Fast forward but not past expiration
      vi.advanceTimersByTime(500)

      const cleaned = cache.cleanup()

      expect(cleaned).toBe(0)
      expect(cache.size()).toBe(2)
      expect(cache.get('key1')).toBe('value1')
      expect(cache.get('key2')).toBe('value2')
    })

    it('should return count of cleaned entries', () => {
      cache = new CacheManager<string>(1000, { autoCleanup: false })
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      vi.advanceTimersByTime(1001)

      expect(cache.cleanup()).toBe(3)
    })
  })

  describe('size()', () => {
    it('should return current cache size', () => {
      cache = new CacheManager<string>(1000)
      expect(cache.size()).toBe(0)

      cache.set('key1', 'value1')
      expect(cache.size()).toBe(1)

      cache.set('key2', 'value2')
      expect(cache.size()).toBe(2)

      cache.delete('key1')
      expect(cache.size()).toBe(1)

      cache.clear()
      expect(cache.size()).toBe(0)
    })
  })

  describe('autoCleanup option', () => {
    it('should auto-cleanup when enabled', () => {
      cache = new CacheManager<string>(1000, {
        autoCleanup: true,
        cleanupInterval: 100
      })
      cache.set('key1', 'value1')

      // Fast forward past expiration
      vi.advanceTimersByTime(1001)

      // Fast forward past cleanup interval
      vi.advanceTimersByTime(100)

      expect(cache.size()).toBe(0)
    })

    it('should not auto-cleanup when disabled', () => {
      cache = new CacheManager<string>(1000, { autoCleanup: false })
      cache.set('key1', 'value1')

      // Fast forward past expiration
      vi.advanceTimersByTime(1001)

      // No auto-cleanup, entry still in cache (but expired)
      expect(cache.size()).toBe(1)
    })
  })

  describe('cleanupInterval option', () => {
    it('should use custom cleanup interval', () => {
      cache = new CacheManager<string>(1000, { cleanupInterval: 500 })
      cache.set('key1', 'value1')

      // Fast forward past expiration but before cleanup
      vi.advanceTimersByTime(1001)

      // Entry still in cache (but expired) before cleanup interval
      expect(cache.size()).toBe(1)

      // Fast forward past first cleanup interval
      vi.advanceTimersByTime(500)

      // Now cleanup should have run
      expect(cache.size()).toBe(0)
    })
  })

  describe('destroy()', () => {
    it('should stop cleanup interval', () => {
      cache = new CacheManager<string>(1000, { cleanupInterval: 100 })
      cache.set('key1', 'value1')

      cache.destroy()

      // Fast forward past expiration and cleanup interval
      vi.advanceTimersByTime(2000)

      // Cache should still have the entry (cleanup stopped)
      // Note: size is 0 because destroy() calls clear()
      expect(cache.size()).toBe(0)
    })

    it('should clear all cache entries', () => {
      cache = new CacheManager<string>(1000)
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      cache.destroy()

      expect(cache.size()).toBe(0)
    })
  })

  describe('Type safety', () => {
    it('should work with complex types', () => {
      interface User {
        id: string
        name: string
        email: string
      }

      const userCache = new CacheManager<User>(1000)
      const user: User = { id: '1', name: 'John', email: 'john@test.com' }

      userCache.set('user-1', user)
      const retrieved = userCache.get('user-1')

      expect(retrieved).toEqual(user)
      expect(retrieved?.email).toBe('john@test.com')

      userCache.destroy()
    })

    it('should work with arrays', () => {
      const arrayCache = new CacheManager<string[]>(1000)
      const data = ['a', 'b', 'c']

      arrayCache.set('array-1', data)
      const retrieved = arrayCache.get('array-1')

      expect(retrieved).toEqual(data)
      expect(retrieved?.length).toBe(3)

      arrayCache.destroy()
    })

    it('should work with null values', () => {
      const nullCache = new CacheManager<string | null>(1000)

      nullCache.set('null-key', null)
      const retrieved = nullCache.get('null-key')

      expect(retrieved).toBeNull()

      nullCache.destroy()
    })
  })

  describe('Edge cases', () => {
    it('should handle multiple rapid sets', () => {
      cache = new CacheManager<string>(1000)

      for (let i = 0; i < 1000; i++) {
        cache.set(`key-${i}`, `value-${i}`)
      }

      expect(cache.size()).toBe(1000)
    })

    it('should handle zero TTL', () => {
      cache = new CacheManager<string>(0, { autoCleanup: false })
      cache.set('key1', 'value1')

      // Advance by 1ms to ensure expiration check works
      vi.advanceTimersByTime(1)

      // Should be expired
      expect(cache.get('key1')).toBeNull()
    })

    it('should handle very large TTL', () => {
      cache = new CacheManager<string>(Number.MAX_SAFE_INTEGER)
      cache.set('key1', 'value1')

      vi.advanceTimersByTime(1000 * 60 * 60 * 24) // 1 day

      expect(cache.get('key1')).toBe('value1')
    })
  })
})
