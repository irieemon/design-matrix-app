// High-Performance Database Query Optimizer
// Implements aggressive caching, query batching, and performance monitoring

import { SupabaseClient } from '@supabase/supabase-js'
import { withPooledConnection } from './connectionPool'
import { isValidUUID, sanitizeUserId, ensureUUID } from '../../src/utils/uuid'

interface QueryCacheEntry {
  data: any
  timestamp: number
  expires: number
  queryKey: string
}

interface QueryMetrics {
  queryCount: number
  totalTime: number
  avgTime: number
  cacheHitRate: number
}

class QueryOptimizer {
  private cache = new Map<string, QueryCacheEntry>()
  private metrics = new Map<string, QueryMetrics>()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Clean cache every 30 seconds
    this.cleanupInterval = setInterval(() => this.cleanupExpiredCache(), 30000)
  }

  // Generate cache key for queries
  private generateCacheKey(
    table: string,
    operation: string,
    params: any
  ): string {
    const paramsString = JSON.stringify(params, Object.keys(params).sort())
    return `${table}:${operation}:${Buffer.from(paramsString).toString('base64').slice(0, 32)}`
  }

  // Get from cache if available and not expired
  private getCachedResult(cacheKey: string): any | null {
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() < cached.expires) {
      return cached.data
    }
    if (cached) {
      this.cache.delete(cacheKey) // Remove expired
    }
    return null
  }

  // Cache query result
  private cacheResult(
    cacheKey: string,
    data: any,
    ttlMs: number = 60000
  ): void {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      expires: Date.now() + ttlMs,
      queryKey: cacheKey
    })
  }

  // Record query metrics
  private recordMetrics(operation: string, timeMs: number, cacheHit: boolean): void {
    const existing = this.metrics.get(operation) || {
      queryCount: 0,
      totalTime: 0,
      avgTime: 0,
      cacheHitRate: 0
    }

    existing.queryCount++
    if (!cacheHit) {
      existing.totalTime += timeMs
    }
    existing.avgTime = existing.totalTime / existing.queryCount

    // Update cache hit rate
    const totalQueries = existing.queryCount
    const cacheHits = Math.round(existing.cacheHitRate * (totalQueries - 1)) + (cacheHit ? 1 : 0)
    existing.cacheHitRate = cacheHits / totalQueries

    this.metrics.set(operation, existing)
  }

  // Optimized user profile query with aggressive caching
  async getUserProfile(
    userId: string,
    userEmail: string,
    useCache: boolean = true,
    cacheTtlMs: number = 120000 // 2 minutes default cache
  ): Promise<any> {
    const operation = 'getUserProfile'
    const queryStart = performance.now()

    // Validate and sanitize user ID first
    const validUserId = sanitizeUserId(userId)
    if (!validUserId) {
      console.warn(`Invalid user ID format, using fallback: ${userId}`)
      return this.createFallbackProfile(ensureUUID(userId), userEmail)
    }

    const cacheKey = this.generateCacheKey('user_profiles', operation, { userId: validUserId, userEmail })

    // Check cache first
    if (useCache) {
      const cached = this.getCachedResult(cacheKey)
      if (cached) {
        this.recordMetrics(operation, 0, true)
        return cached
      }
    }

    try {
      const result = await withPooledConnection(async (client: SupabaseClient) => {
        // Ultra-optimized query with minimal fields and UUID validation
        // Implement manual timeout using Promise.race
        const queryPromise = client
          .from('user_profiles')
          .select('id, email, role, full_name, avatar_url, created_at, updated_at')
          .eq('id', validUserId)
          .single()

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout')), 200)
        )

        const result = await Promise.race([queryPromise, timeoutPromise]) as any
        const { data, error } = result

        if (error) {
          console.warn(`Profile query error for ${validUserId}:`, error.message)
          // Return fallback profile to prevent cascading failures
          return this.createFallbackProfile(validUserId, userEmail)
        }

        return data
      })

      const queryTime = performance.now() - queryStart
      this.recordMetrics(operation, queryTime, false)

      // Cache successful result
      if (useCache && result) {
        this.cacheResult(cacheKey, result, cacheTtlMs)
      }

      return result
    } catch (error) {
      const queryTime = performance.now() - queryStart
      this.recordMetrics(operation, queryTime, false)

      console.warn(`Profile fetch timeout/error for ${validUserId}:`, error.message)
      return this.createFallbackProfile(validUserId, userEmail)
    }
  }

  // Create fallback profile to prevent auth failures
  private createFallbackProfile(userId: string, userEmail: string) {
    const role = this.determineUserRole(userEmail)
    return {
      id: userId,
      email: userEmail,
      role,
      full_name: userEmail.split('@')[0],
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }

  // Simple role determination for fallback profiles
  private determineUserRole(email: string): string {
    const adminEmails = new Set([
      'admin@prioritas.com',
      'manager@company.com'
    ])

    const superAdminEmails = new Set([
      'admin@prioritas.com'
    ])

    if (superAdminEmails.has(email.toLowerCase())) {
      return 'super_admin'
    }
    if (adminEmails.has(email.toLowerCase())) {
      return 'admin'
    }
    return 'user'
  }

  // Batch query operations for better performance
  async batchUserProfiles(userIds: string[]): Promise<Map<string, any>> {
    const operation = 'batchUserProfiles'
    const results = new Map<string, any>()

    if (userIds.length === 0) return results

    const queryStart = performance.now()

    try {
      const profileData = await withPooledConnection(async (client: SupabaseClient) => {
        // Implement manual timeout for batch operations
        const queryPromise = client
          .from('user_profiles')
          .select('id, email, role, full_name, avatar_url, created_at, updated_at')
          .in('id', userIds)

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Batch query timeout')), 500)
        )

        const result = await Promise.race([queryPromise, timeoutPromise]) as any
        const { data, error } = result

        return error ? [] : data || []
      })

      // Map results and create cache entries
      profileData.forEach(profile => {
        results.set(profile.id, profile)
        // Cache individual profiles for future single queries
        const cacheKey = this.generateCacheKey('user_profiles', 'getUserProfile', {
          userId: profile.id,
          userEmail: profile.email
        })
        this.cacheResult(cacheKey, profile, 120000) // 2 minute cache
      })

      const queryTime = performance.now() - queryStart
      this.recordMetrics(operation, queryTime, false)

      console.log(`Batch profile query: ${profileData.length}/${userIds.length} profiles in ${queryTime.toFixed(1)}ms`)

    } catch (error) {
      const queryTime = performance.now() - queryStart
      this.recordMetrics(operation, queryTime, false)
      console.warn('Batch profile query failed:', error)
    }

    return results
  }

  // Clean up expired cache entries
  private cleanupExpiredCache(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now >= entry.expires) {
        this.cache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      console.log(`Cleaned ${cleaned} expired cache entries. Cache size: ${this.cache.size}`)
    }
  }

  // Get performance metrics
  getMetrics(): Record<string, QueryMetrics> {
    return Object.fromEntries(this.metrics)
  }

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.cache.size,
      memoryUsage: this.estimateCacheMemoryUsage(),
      hitRate: this.calculateOverallCacheHitRate()
    }
  }

  private estimateCacheMemoryUsage(): string {
    const avgEntrySize = 1024 // Rough estimate in bytes
    const totalBytes = this.cache.size * avgEntrySize
    return totalBytes > 1024 * 1024
      ? `${(totalBytes / 1024 / 1024).toFixed(1)}MB`
      : `${(totalBytes / 1024).toFixed(1)}KB`
  }

  private calculateOverallCacheHitRate(): number {
    const metrics = Array.from(this.metrics.values())
    if (metrics.length === 0) return 0

    const totalQueries = metrics.reduce((sum, m) => sum + m.queryCount, 0)
    const weightedHitRate = metrics.reduce((sum, m) => sum + (m.cacheHitRate * m.queryCount), 0)

    return totalQueries > 0 ? weightedHitRate / totalQueries : 0
  }

  // Clear all cache entries (for cache invalidation)
  clearAllCache(): number {
    const size = this.cache.size
    this.cache.clear()
    console.log(`🧹 Query optimizer: Cleared all ${size} cache entries`)
    return size
  }

  // Clear specific user cache entries
  clearUserCache(userId: string, userEmail: string): number {
    let cleared = 0
    const userCacheKey = this.generateCacheKey('user_profiles', 'getUserProfile', { userId, userEmail })

    if (this.cache.has(userCacheKey)) {
      this.cache.delete(userCacheKey)
      cleared++
    }

    // Also clear any batch cache entries that might contain this user
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (key.includes('batchUserProfiles') && entry.data && typeof entry.data === 'object') {
        // Check if this user is in the batch data
        if (Array.isArray(entry.data)) {
          const hasUser = entry.data.some(profile =>
            profile?.id === userId || profile?.email === userEmail
          )
          if (hasUser) {
            this.cache.delete(key)
            cleared++
          }
        }
      }
    }

    if (cleared > 0) {
      console.log(`🧹 Query optimizer: Cleared ${cleared} user-specific cache entries for ${userEmail}`)
    }

    return cleared
  }

  // Destroy and cleanup
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.cache.clear()
    this.metrics.clear()
  }
}

// Singleton query optimizer
let optimizer: QueryOptimizer | null = null

export function getQueryOptimizer(): QueryOptimizer {
  if (!optimizer) {
    optimizer = new QueryOptimizer()
    console.log('🚀 Query optimizer initialized')
  }
  return optimizer
}

// Export convenient helper function
export async function optimizedGetUserProfile(
  userId: string,
  userEmail: string
): Promise<any> {
  return getQueryOptimizer().getUserProfile(userId, userEmail)
}