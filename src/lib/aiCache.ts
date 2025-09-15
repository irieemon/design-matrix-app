import { logger } from '../utils/logger'

interface CacheEntry<T> {
  data: T
  expiry: number
  size: number
}

interface CacheMetrics {
  hits: number
  misses: number
  evictions: number
  totalRequests: number
}

/**
 * High-performance in-memory cache for AI service responses
 * Features:
 * - TTL (Time To Live) expiration
 * - LRU (Least Recently Used) eviction
 * - Size-based limits to prevent memory bloat
 * - Request deduplication for concurrent requests
 * - Cache metrics for monitoring
 */
export class AICache {
  private cache = new Map<string, CacheEntry<any>>()
  private accessOrder = new Map<string, number>()
  private pendingRequests = new Map<string, Promise<any>>()
  private metrics: CacheMetrics = { hits: 0, misses: 0, evictions: 0, totalRequests: 0 }
  
  private readonly maxEntries: number
  private readonly maxMemoryMB: number
  private readonly defaultTTL: number
  private accessCounter = 0

  constructor(
    maxEntries: number = 1000,
    maxMemoryMB: number = 50,
    defaultTTL: number = 5 * 60 * 1000 // 5 minutes default
  ) {
    this.maxEntries = maxEntries
    this.maxMemoryMB = maxMemoryMB
    this.defaultTTL = defaultTTL
    
    // Cleanup expired entries every 2 minutes
    setInterval(() => this.cleanup(), 2 * 60 * 1000)
    
    logger.debug('🗄️ AI Cache initialized', {
      maxEntries: this.maxEntries,
      maxMemoryMB: this.maxMemoryMB,
      defaultTTL: this.defaultTTL + 'ms'
    })
  }

  /**
   * Get cached data or execute function with request deduplication
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    this.metrics.totalRequests++
    
    // Check for existing cache entry
    const cached = this.get<T>(key)
    if (cached !== null) {
      this.metrics.hits++
      logger.debug('🎯 Cache HIT', { key: this.truncateKey(key), ttl })
      return cached
    }

    // Check for pending request (deduplication)
    const pending = this.pendingRequests.get(key)
    if (pending) {
      logger.debug('🔄 Request deduplication', { key: this.truncateKey(key) })
      return pending as Promise<T>
    }

    // Execute function and cache result
    this.metrics.misses++
    logger.debug('❌ Cache MISS', { key: this.truncateKey(key) })
    
    const promise = fetchFn()
    this.pendingRequests.set(key, promise)

    try {
      const result = await promise
      this.set(key, result, ttl)
      return result
    } catch (error) {
      // Don't cache errors
      throw error
    } finally {
      this.pendingRequests.delete(key)
    }
  }

  /**
   * Get data from cache
   */
  private get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // Check expiry
    if (entry.expiry < Date.now()) {
      this.cache.delete(key)
      this.accessOrder.delete(key)
      return null
    }

    // Update access order for LRU
    this.accessOrder.set(key, ++this.accessCounter)
    return entry.data
  }

  /**
   * Set data in cache with TTL
   */
  private set<T>(key: string, data: T, ttl: number): void {
    const size = this.estimateSize(data)
    const expiry = Date.now() + ttl

    // Check if we need to evict entries
    this.ensureCapacity(size)

    this.cache.set(key, { data, expiry, size })
    this.accessOrder.set(key, ++this.accessCounter)
    
    logger.debug('💾 Cache SET', { 
      key: this.truncateKey(key), 
      size: this.formatSize(size),
      ttl: ttl + 'ms',
      entries: this.cache.size
    })
  }

  /**
   * Ensure cache doesn't exceed capacity limits
   */
  private ensureCapacity(newEntrySize: number): void {
    // Check memory limit
    const currentMemory = this.getCurrentMemoryUsage()
    const maxMemoryBytes = this.maxMemoryMB * 1024 * 1024
    
    // Evict LRU entries if necessary
    while (
      (this.cache.size >= this.maxEntries) ||
      (currentMemory + newEntrySize > maxMemoryBytes)
    ) {
      const lruKey = this.getLRUKey()
      if (!lruKey) break
      
      const entry = this.cache.get(lruKey)
      this.cache.delete(lruKey)
      this.accessOrder.delete(lruKey)
      this.metrics.evictions++
      
      logger.debug('🗑️ Cache eviction (LRU)', { 
        key: this.truncateKey(lruKey),
        size: entry ? this.formatSize(entry.size) : 'unknown'
      })
    }
  }

  /**
   * Get least recently used key
   */
  private getLRUKey(): string | null {
    let lruKey = null
    let lruAccess = Infinity

    for (const [key, access] of this.accessOrder) {
      if (access < lruAccess) {
        lruAccess = access
        lruKey = key
      }
    }

    return lruKey
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, entry] of this.cache) {
      if (entry.expiry < now) {
        this.cache.delete(key)
        this.accessOrder.delete(key)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      logger.debug('🧹 Cache cleanup', { 
        cleanedEntries: cleanedCount,
        remainingEntries: this.cache.size
      })
    }
  }

  /**
   * Estimate memory usage of data
   */
  private estimateSize(data: any): number {
    const str = JSON.stringify(data)
    return str.length * 2 // Rough estimate (2 bytes per character for UTF-16)
  }

  /**
   * Get current memory usage in bytes
   */
  private getCurrentMemoryUsage(): number {
    let total = 0
    for (const entry of this.cache.values()) {
      total += entry.size
    }
    return total
  }

  /**
   * Generate cache key from parameters
   */
  static generateKey(method: string, params: any): string {
    // Create deterministic key from method and parameters
    const paramStr = JSON.stringify(params, Object.keys(params).sort())
    const hash = this.simpleHash(paramStr)
    return `${method}:${hash}`
  }

  /**
   * Simple hash function for cache keys
   */
  private static simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * Get cache statistics
   */
  getMetrics(): CacheMetrics & { 
    size: number
    memoryUsage: string
    hitRate: string
  } {
    const hitRate = this.metrics.totalRequests > 0 
      ? ((this.metrics.hits / this.metrics.totalRequests) * 100).toFixed(1) + '%'
      : '0%'
      
    return {
      ...this.metrics,
      size: this.cache.size,
      memoryUsage: this.formatSize(this.getCurrentMemoryUsage()),
      hitRate
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
    this.accessOrder.clear()
    this.pendingRequests.clear()
    this.metrics = { hits: 0, misses: 0, evictions: 0, totalRequests: 0 }
    logger.debug('🗑️ Cache cleared')
  }

  /**
   * Utilities
   */
  private truncateKey(key: string): string {
    return key.length > 50 ? key.substring(0, 47) + '...' : key
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + 'B'
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + 'KB'
    return Math.round(bytes / (1024 * 1024)) + 'MB'
  }
}

// Global cache instance
export const aiCache = new AICache()