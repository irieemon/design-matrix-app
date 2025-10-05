/**
 * Base AI Service
 * Common functionality for all AI services including auth, fetch wrapper, and caching
 */

import { supabase } from '../../supabase'
import { logger } from '../../../utils/logger'
import { aiCache, AICache } from '../../aiCache'

export interface SecureAIServiceConfig {
  baseUrl?: string // For custom API endpoints (defaults to current domain)
}

/**
 * Base class for all AI services
 * Provides common functionality like authentication, HTTP requests, and caching
 */
export abstract class BaseAiService {
  protected baseUrl: string
  protected cache: AICache

  constructor(config: SecureAIServiceConfig = {}) {
    // Use current domain in production, localhost in development
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl
    } else if (typeof window !== 'undefined') {
      // In browser, always use current domain
      this.baseUrl = window.location.origin
    } else {
      // Server-side rendering fallback
      this.baseUrl = 'http://localhost:3000'
    }

    this.cache = aiCache

    logger.debug('🔒 Base AI Service initialized', {
      baseUrl: this.baseUrl,
      mode: 'server-side-proxy',
      security: 'API keys protected on server',
      origin: typeof window !== 'undefined' ? window.location.origin : 'server-side'
    })

    // Clear stale cache entries on initialization
    if (typeof window !== 'undefined') {
      logger.debug('🗑️ Clearing AI cache for fresh session')
      this.cache.clear()
    }
  }

  /**
   * Get authentication headers for API requests
   * @returns Headers with authentication token if available
   */
  protected async getAuthHeaders(): Promise<HeadersInit> {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.access_token) {
        return {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      }
    } catch (error) {
      logger.warn('Could not get auth token:', error)
    }

    // Return basic headers if no auth available
    return {
      'Content-Type': 'application/json'
    }
  }

  /**
   * Common fetch wrapper with error handling
   * @param endpoint - API endpoint to call
   * @param payload - Request payload
   * @returns Response data
   */
  protected async fetchWithErrorHandling<T>(endpoint: string, payload: any): Promise<T> {
    try {
      const headers = await this.getAuthHeaders()
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment before trying again.')
        }
        throw new Error(`Server error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      logger.error(`Error calling ${endpoint}:`, error)
      throw error
    }
  }

  /**
   * Get or set cached value
   * @param cacheKey - Cache key
   * @param generator - Function to generate value if not cached
   * @param ttl - Time to live in milliseconds
   * @returns Cached or generated value
   */
  protected async getOrSetCache<T>(
    cacheKey: string,
    generator: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    return this.cache.getOrSet(cacheKey, generator, ttl)
  }

  /**
   * Generate cache key from operation and parameters
   * @param operation - Operation name
   * @param params - Operation parameters
   * @returns Cache key
   */
  protected generateCacheKey(operation: string, params: any): string {
    return AICache.generateKey(operation, params)
  }

  /**
   * Check if running in localhost/development mode
   * @returns True if in development mode
   */
  protected isLocalhost(): boolean {
    return this.baseUrl.includes('localhost')
  }
}
