/**
 * Secure API Client
 *
 * Fetch wrapper with:
 * - Automatic CSRF token injection
 * - Automatic token refresh on 401 responses
 * - Request retry logic
 * - Comprehensive error handling
 *
 * Cookies (httpOnly access/refresh tokens) are automatically sent by browser
 */

import { getCsrfToken } from '../utils/cookieUtils'
import { logger } from '../utils/logger'

/**
 * API Client configuration
 */
interface ApiClientConfig {
  baseUrl?: string
  csrfToken?: string | null
  onUnauthorized?: () => void
  onForbidden?: () => void
}

/**
 * Request options
 */
interface RequestOptions extends RequestInit {
  skipCsrf?: boolean
  skipRefresh?: boolean
  retryCount?: number
}

/**
 * API Error with additional context
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * In-flight refresh promise (singleton pattern)
 * Prevents multiple concurrent refresh attempts
 */
let refreshPromise: Promise<boolean> | null = null

/**
 * Refresh access token using refresh token cookie
 */
async function refreshToken(): Promise<boolean> {
  // If refresh already in progress, wait for it
  if (refreshPromise) {
    logger.debug('Token refresh already in progress, waiting...')
    return refreshPromise
  }

  // Start new refresh
  refreshPromise = (async () => {
    try {
      logger.debug('Attempting token refresh...')

      const response = await fetch('/api/auth?action=refresh', {
        method: 'POST',
        credentials: 'include', // Send cookies
      })

      if (!response.ok) {
        logger.error('Token refresh failed', { status: response.status })
        return false
      }

      logger.debug('Token refresh successful')
      return true
    } catch (_error) {
      logger.error('Token refresh error:', error)
      return false
    } finally {
      // Clear the promise so next refresh can start
      refreshPromise = null
    }
  })()

  return refreshPromise
}

/**
 * Secure API Client class
 */
class SecureApiClient {
  private config: ApiClientConfig = {}

  /**
   * Configure the API client
   */
  configure(config: ApiClientConfig): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get CSRF token (from config or cookie)
   */
  private getCsrfTokenValue(): string | null {
    return this.config.csrfToken ?? getCsrfToken()
  }

  /**
   * Build headers for request
   */
  private buildHeaders(options: RequestOptions = {}): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    }

    // Add CSRF token for mutations (unless explicitly skipped)
    if (!options.skipCsrf && options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method)) {
      const csrfToken = this.getCsrfTokenValue()
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken
      } else {
        logger.warn('No CSRF token available for mutation request')
      }
    }

    return headers
  }

  /**
   * Handle API response
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type')
    const isJson = contentType?.includes('application/json')

    // Parse response body
    let data: any
    try {
      data = isJson ? await response.json() : await response.text()
    } catch (_error) {
      logger.error('Failed to parse response:', error)
      throw new ApiError('Failed to parse response', response.status)
    }

    // Handle error responses
    if (!response.ok) {
      const message = data?.error?.message || data?.message || 'Request failed'
      const code = data?.error?.code || 'API_ERROR'
      const details = data?.error?.details

      throw new ApiError(message, response.status, code, details)
    }

    return data as T
  }

  /**
   * Make HTTP request
   */
  private async request<T>(
    url: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { skipRefresh, retryCount = 0, ...fetchOptions } = options

    const fullUrl = this.config.baseUrl ? `${this.config.baseUrl}${url}` : url

    // Build request
    const requestOptions: RequestInit = {
      ...fetchOptions,
      headers: this.buildHeaders(options),
      credentials: 'include', // Always send cookies
    }

    try {
      logger.debug('API request', { method: options.method || 'GET', url: fullUrl })

      const response = await fetch(fullUrl, requestOptions)

      // Handle 401 Unauthorized (token expired)
      if (response.status === 401 && !skipRefresh && retryCount < 3) {
        logger.debug('Received 401, attempting token refresh...')

        const refreshSucceeded = await refreshToken()

        if (refreshSucceeded) {
          // Retry the request with new tokens
          logger.debug('Retrying request with refreshed tokens')
          return this.request<T>(url, {
            ...options,
            retryCount: retryCount + 1,
          })
        } else {
          // Refresh failed, trigger logout
          logger.error('Token refresh failed, user needs to re-authenticate')
          this.config.onUnauthorized?.()
          throw new ApiError('Authentication expired', 401, 'TOKEN_EXPIRED')
        }
      }

      // Handle 403 Forbidden
      if (response.status === 403) {
        this.config.onForbidden?.()
      }

      return await this.handleResponse<T>(response)
    } catch (_error) {
      if (error instanceof ApiError) {
        throw error
      }

      // Network error or other fetch error
      logger.error('Network error:', error)
      throw new ApiError(
        error instanceof Error ? error.message : 'Network error',
        0,
        'NETWORK_ERROR'
      )
    }
  }

  /**
   * GET request
   */
  async get<T>(url: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'GET' })
  }

  /**
   * POST request
   */
  async post<T>(url: string, data?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  /**
   * PUT request
   */
  async put<T>(url: string, data?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  /**
   * PATCH request
   */
  async patch<T>(url: string, data?: unknown, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  /**
   * DELETE request
   */
  async delete<T>(url: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'DELETE' })
  }
}

/**
 * Singleton API client instance
 */
export const apiClient = new SecureApiClient()

/**
 * Export types
 */
export type { ApiClientConfig, RequestOptions }
