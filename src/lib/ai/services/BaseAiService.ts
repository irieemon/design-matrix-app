/**
 * Base AI Service
 * Common functionality for all AI services including auth, fetch wrapper, and caching
 */

import { logger } from '../../../utils/logger'
import { aiCache, AICache } from '../../aiCache'
import { SUPABASE_STORAGE_KEY } from '../../../lib/config'
import { getCsrfToken } from '../../../utils/cookieUtils'

export interface SecureAIServiceConfig {
  baseUrl?: string // For custom API endpoints (defaults to current domain)
}

/**
 * Base class for all AI services
 * Provides common functionality like authentication, HTTP requests, and caching
 */
let refreshPromise: Promise<boolean> | null = null

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
    // CRITICAL FIX: Read token from localStorage directly to avoid getSession() timeout
    // The standard supabase.auth.getSession() hangs on page refresh
    // This is the SAME pattern used throughout the app (commits caab7bc, a4ec5e3, ProfileService fix)

    try {
      const stored = localStorage.getItem(SUPABASE_STORAGE_KEY)
      let token: string | null = null

      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          token = parsed.access_token
          logger.debug('🔑 BaseAiService: Using access token from localStorage (bypassing getSession)')
        } catch (_error) {
          logger.error('BaseAiService: Error parsing localStorage session:', _error)
        }
      }

      if (token) {
        const csrfToken = getCsrfToken()
        return {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        }
      }
    } catch (_error) {
      logger.warn('Could not get auth token:', _error)
    }

    // Return basic headers if no auth available
    return {
      'Content-Type': 'application/json'
    }
  }

  /**
   * Common fetch wrapper with error handling
   * Includes credentials for cookie-based auth (CSRF) and 401 token refresh with single retry.
   * A 120-second internal timeout races the fetch so silent hangs surface as errors.
   * @param endpoint - API endpoint to call
   * @param payload - Request payload
   * @param isRetry - Whether this is a retry after a 401 refresh (prevents infinite loops)
   * @param signal - Optional AbortSignal from the caller
   * @returns Response data
   */
  protected async fetchWithErrorHandling<T>(endpoint: string, payload: any, isRetry = false, signal?: AbortSignal): Promise<T> {
    const TIMEOUT_MS = 120_000

    // Build fetch options. Only attach signal to fetch when the caller provides
    // one — this preserves the T-0015-017 backward-compat contract (no signal
    // in fetch options when caller does not supply one).
    // The 120s hard timeout races the fetch promise separately so it fires even
    // when no caller signal exists, without injecting an AbortSignal into options.
    try {
      const headers = await this.getAuthHeaders()
      const fetchOptions: RequestInit = {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      }
      if (signal) {
        fetchOptions.signal = signal
      }

      // Race the fetch against a 120s timeout. If the timeout fires first,
      // throw a clear error rather than hanging indefinitely.
      let timeoutId: ReturnType<typeof setTimeout> | undefined
      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(Object.assign(new Error('Request timeout after 120s'), { name: 'AbortError' }))
        }, TIMEOUT_MS)
      })

      let response: Response
      try {
        response = await Promise.race([
          fetch(`${this.baseUrl}${endpoint}`, fetchOptions),
          timeoutPromise,
        ])
      } finally {
        clearTimeout(timeoutId)
      }

      if (!response.ok) {
        if (response.status === 401 && !isRetry) {
          const refreshed = await this.refreshAccessToken()
          if (refreshed) {
            return this.fetchWithErrorHandling<T>(endpoint, payload, true, signal)
          }
          throw new Error('Authentication expired. Please sign in again.')
        }
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment before trying again.')
        }
        const errorBody = await response.json().catch(() => ({}))
        const errorCode = errorBody?.error?.code || errorBody?.error?.message || ''
        throw new Error(`Server error: ${response.status} ${errorCode}`.trim())
      }

      return await response.json()
    } catch (_error) {
      if (_error instanceof Error && _error.name === 'AbortError') throw _error
      logger.error(`Error calling ${endpoint}:`, _error)
      throw _error
    }
  }

  /**
   * Attempt to refresh the access token via the auth endpoint.
   * Uses a module-level singleton promise so concurrent 401s coalesce into one refresh.
   * On success, persists the new token to localStorage for subsequent getAuthHeaders() calls.
   * @returns True if refresh succeeded, false otherwise
   */
  private refreshAccessToken(): Promise<boolean> {
    if (refreshPromise) {
      logger.debug('BaseAiService: Token refresh already in-flight, reusing promise')
      return refreshPromise
    }

    refreshPromise = (async () => {
      try {
        logger.debug('BaseAiService: Attempting token refresh...')
        const response = await fetch('/api/auth?action=refresh', {
          method: 'POST',
          credentials: 'include',
        })

        if (!response.ok) {
          logger.error('BaseAiService: Token refresh failed', { status: response.status })
          return false
        }

        const data = await response.json()
        if (data.access_token) {
          const stored = localStorage.getItem(SUPABASE_STORAGE_KEY)
          const session = stored ? JSON.parse(stored) : {}
          session.access_token = data.access_token
          localStorage.setItem(SUPABASE_STORAGE_KEY, JSON.stringify(session))
        }

        logger.debug('BaseAiService: Token refresh successful')
        return true
      } catch (_error) {
        logger.error('BaseAiService: Token refresh error:', _error)
        return false
      } finally {
        refreshPromise = null
      }
    })()

    return refreshPromise
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
