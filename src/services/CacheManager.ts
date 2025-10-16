import { logger } from '../utils/logger'

/**
 * Generic cache manager with automatic cleanup
 *
 * Provides type-safe caching with automatic expiration and cleanup.
 * Replaces duplicate cache implementations across the application.
 *
 * @template T The type of data to cache
 *
 * @example
 * ```typescript
 * const userCache = new CacheManager<User>(10 * 60 * 1000) // 10 minute TTL
 * userCache.set('user-123', userData)
 * const user = userCache.get('user-123') // Returns User or null if expired
 * ```
 */
export class CacheManager<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private cleanupInterval?: NodeJS.Timeout

  /**
   * Create a new cache manager
   *
   * @param ttl Time-to-live in milliseconds for cached entries
   * @param options Optional configuration
   */
  constructor(
    private ttl: number,
    private options: CacheOptions = {}
  ) {
    if (options.autoCleanup !== false) {
      this.startCleanup()
    }
  }

  /**
   * Get cached value if not expired
   *
   * @param key Cache key
   * @returns Cached value or null if not found or expired
   */
  get(key: string): T | null {
    const cached = this.cache.get(key)
    if (!cached) return null

    if (Date.now() > cached.expires) {
      this.cache.delete(key)
      return null
    }

    return cached.value
  }

  /**
   * Set cache value with TTL
   *
   * @param key Cache key
   * @param value Value to cache
   */
  set(key: string, value: T): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      expires: Date.now() + this.ttl
    })
  }

  /**
   * Delete specific key
   *
   * @param key Cache key to delete
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Manual cleanup of expired entries
   *
   * @returns Number of entries cleaned
   */
  cleanup(): number {
    const now = Date.now()
    let cleaned = 0

    for (const [key, cached] of this.cache.entries()) {
      if (now > cached.expires) {
        this.cache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.debug(`🧹 Cleaned ${cleaned} expired cache entries`)
    }

    return cleaned
  }

  /**
   * Get cache size
   *
   * @returns Number of entries in cache
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Start automatic cleanup interval
   * @private
   */
  private startCleanup(): void {
    const interval = this.options.cleanupInterval || 30000
    this.cleanupInterval = setInterval(() => this.cleanup(), interval)
  }

  /**
   * Stop automatic cleanup and clear cache
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = undefined
    }
    this.clear()
  }
}

/**
 * Internal cache entry structure
 * @private
 */
interface CacheEntry<T> {
  value: T
  timestamp: number
  expires: number
}

/**
 * Cache manager configuration options
 */
interface CacheOptions {
  /** Enable automatic cleanup (default: true) */
  autoCleanup?: boolean
  /** Cleanup interval in milliseconds (default: 30000) */
  cleanupInterval?: number
}
