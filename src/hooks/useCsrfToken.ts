/**
 * useCsrfToken Hook
 *
 * Manages CSRF token from cookie for use in API requests
 * The CSRF token is stored in a readable cookie (not httpOnly)
 * and must be sent in X-CSRF-Token header for all mutations
 */

import { useState, useEffect, useCallback } from 'react'
import { getCsrfToken, watchCsrfToken } from '../utils/cookieUtils'
import { useLogger } from '../lib/logging'

export interface UseCsrfTokenReturn {
  /** Current CSRF token (null if not available) */
  csrfToken: string | null

  /** Whether CSRF token is available */
  hasToken: boolean

  /** Manually refresh CSRF token from cookie */
  refreshToken: () => void

  /** Get CSRF headers object for fetch requests */
  getCsrfHeaders: () => Record<string, string>
}

/**
 * Hook to manage CSRF token from cookie
 *
 * @example
 * const { csrfToken, getCsrfHeaders } = useCsrfToken()
 *
 * fetch('/api/endpoint', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     ...getCsrfHeaders(),
 *   },
 *   body: JSON.stringify(data)
 * })
 */
export function useCsrfToken(): UseCsrfTokenReturn {
  const logger = useLogger('useCsrfToken')
  const [csrfToken, setCsrfToken] = useState<string | null>(null)

  /**
   * Read CSRF token from cookie
   */
  const refreshToken = useCallback(() => {
    const token = getCsrfToken()
    setCsrfToken(token)

    if (token) {
      logger.debug('CSRF token loaded from cookie')
    } else {
      logger.warn('No CSRF token found in cookie')
    }
  }, [logger])

  /**
   * Load token on mount and watch for changes
   */
  useEffect(() => {
    // Initial load
    refreshToken()

    // Watch for changes (e.g., after token refresh)
    const unwatch = watchCsrfToken((newToken) => {
      logger.debug('CSRF token changed', { hasToken: !!newToken })
      setCsrfToken(newToken)
    })

    // Cleanup
    return unwatch
  }, [refreshToken, logger])

  /**
   * Get CSRF headers for fetch requests
   */
  const getCsrfHeaders = useCallback((): Record<string, string> => {
    if (!csrfToken) {
      logger.warn('getCsrfHeaders called without CSRF token')
      return {}
    }

    return {
      'X-CSRF-Token': csrfToken,
    }
  }, [csrfToken, logger])

  return {
    csrfToken,
    hasToken: csrfToken !== null,
    refreshToken,
    getCsrfHeaders,
  }
}
