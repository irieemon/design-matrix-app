import { User } from '../types'
import { logger } from '../utils/logger'
import { CacheManager } from './CacheManager'
import { CACHE_DURATIONS, SUPABASE_STORAGE_KEY } from '../lib/config'

/**
 * ProfileService - Unified profile management with caching
 *
 * Handles all profile operations including fetching, updating, and caching.
 * Replaces duplicate profile logic in useAuth.ts and supabase.ts.
 *
 * Features:
 * - Unified caching with CacheManager
 * - Request deduplication for concurrent calls
 * - Automatic token refresh on 401/403
 * - Type-safe profile operations
 */
export class ProfileService {
  private cache: CacheManager<User>
  private pendingRequests = new Map<string, Promise<User>>()
  private abortController?: AbortController

  constructor(
    private supabaseClient: any,
    cacheTtl: number = CACHE_DURATIONS.USER_PROFILE * 3
  ) {
    this.cache = new CacheManager<User>(cacheTtl)
  }

  /**
   * Get user profile by ID with caching and request deduplication
   *
   * @param userId User ID
   * @param userEmail User email for cache key
   * @returns User profile
   * @throws Error if auth token unavailable or fetch fails
   */
  async getProfile(userId: string, userEmail: string): Promise<User> {
    const cacheKey = `${userId}:${userEmail}`

    const cached = this.cache.get(cacheKey)
    if (cached) {
      logger.debug('Using cached user profile:', { email: userEmail })
      return cached
    }

    const pending = this.pendingRequests.get(cacheKey)
    if (pending) {
      logger.debug('Waiting for pending user profile request:', userEmail)
      return pending
    }

    const profilePromise = this.fetchProfile(userId, userEmail, cacheKey)
    this.pendingRequests.set(cacheKey, profilePromise)

    try {
      const result = await profilePromise
      return result
    } finally {
      this.pendingRequests.delete(cacheKey)
    }
  }

  /**
   * Update user profile and clear cache
   *
   * @param userId User ID
   * @param updates Profile fields to update
   * @returns Updated profile
   * @throws Error if update fails
   */
  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    try {
      const { data, error } = await this.supabaseClient
        .from('user_profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()

      if (error) {
        logger.error('Error updating user profile:', error)
        throw new Error('Error updating user profile')
      }

      this.cache.clear()

      return data
    } catch (error) {
      logger.error('Exception updating user profile:', error)
      throw error
    }
  }

  /**
   * Clear all profile caches and abort pending requests
   */
  clearCache(): void {
    logger.debug('Clearing all profile caches')
    this.cache.clear()
    this.pendingRequests.clear()

    if (this.abortController) {
      this.abortController.abort()
      this.abortController = undefined
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.clearCache()
    this.cache.destroy()
  }

  /**
   * Fetch profile from API with token refresh on auth errors
   * @private
   */
  private async fetchProfile(
    _userId: string,
    _userEmail: string,
    cacheKey: string
  ): Promise<User> {
    try {
      this.abortController = new AbortController()

      // CRITICAL FIX: Read token from localStorage directly to avoid getSession() timeout
      // The standard supabase.auth.getSession() hangs on page refresh (same issue as useAuth.ts, ProjectContext.tsx, useIdeas.ts)
      // This is the SAME pattern used throughout the app (commits caab7bc, a4ec5e3)

      const stored = localStorage.getItem(SUPABASE_STORAGE_KEY)
      let token: string | null = null

      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          token = parsed.access_token
          logger.debug('🔑 ProfileService: Using access token from localStorage (bypassing getSession)')
        } catch (parseError) {
          logger.error('ProfileService: Error parsing localStorage session:', parseError)
        }
      }

      if (!token) {
        throw new Error('No auth token available')
      }

      const response = await fetch('/api/auth?action=user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        signal: this.abortController.signal
      })

      if (response.status === 401 || response.status === 403) {
        logger.warn('Token expired (401/403), attempting refresh...')

        this.cache.clear()

        try {
          const { data, error } = await this.supabaseClient.auth.refreshSession()

          if (error || !data.session) {
            logger.error('Token refresh failed, forcing re-login:', error)
            throw new Error('Session expired, please log in again')
          }

          logger.debug('Token refreshed successfully, retrying profile fetch')

          const retryResponse = await fetch('/api/auth?action=user', {
            headers: {
              'Authorization': `Bearer ${data.session.access_token}`,
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache'
            }
          })

          if (retryResponse.ok) {
            const { user } = await retryResponse.json()
            const userProfile = this.transformUser(user)
            this.cache.set(cacheKey, userProfile)
            return userProfile
          } else {
            throw new Error(`Profile fetch retry failed: ${retryResponse.status}`)
          }
        } catch (refreshError) {
          logger.error('Token refresh process failed:', refreshError)
          throw new Error('Authentication failed, please log in again')
        }
      }

      if (response.ok) {
        const { user } = await response.json()
        const userProfile = this.transformUser(user)
        this.cache.set(cacheKey, userProfile)
        return userProfile
      } else {
        throw new Error(`Profile fetch failed: ${response.status}`)
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.debug('User profile request aborted')
      } else {
        logger.error('Error fetching user profile, using fallback:', error)
      }
      throw error
    }
  }

  /**
   * Transform API user response to User type
   * @private
   */
  private transformUser(user: any): User {
    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name || user.email,
      avatar_url: user.avatar_url,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at
    }
  }
}
