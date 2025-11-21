/**
 * useSecureAuth Hook
 *
 * Cookie-based authentication hook (replaces localStorage-based useAuth)
 * Uses httpOnly cookies for token storage to prevent XSS attacks
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { User } from '../types'
import { apiClient, ApiError } from '../lib/apiClient'
import { hasAuthCookies } from '../utils/cookieUtils'
import { useLogger } from '../lib/logging'

export interface UseSecureAuthReturn {
  /** Current authenticated user */
  user: User | null

  /** Whether user is authenticated */
  isAuthenticated: boolean

  /** Whether auth state is loading */
  isLoading: boolean

  /** Authentication error */
  error: Error | null

  /** Login with email and password */
  login: (email: string, password: string) => Promise<void>

  /** Logout */
  logout: () => Promise<void>

  /** Manually refresh session */
  refreshSession: () => Promise<void>

  /** Clear error */
  clearError: () => void
}

/**
 * Hook for cookie-based authentication
 *
 * @example
 * const { user, isAuthenticated, login, logout } = useSecureAuth()
 *
 * if (!isAuthenticated) {
 *   return <LoginForm onSubmit={(email, pw) => login(email, pw)} />
 * }
 *
 * return <div>Welcome {user.email}</div>
 */
export function useSecureAuth(): UseSecureAuthReturn {
  const logger = useLogger('useSecureAuth')

  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const isInitialMount = useRef(true)
  const loginInProgress = useRef(false)

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  /**
   * Verify session and restore user
   * Called on mount and after login/refresh
   */
  const verifySession = useCallback(async () => {
    // Check if auth cookies exist (heuristic)
    if (!hasAuthCookies()) {
      logger.debug('No auth cookies found, skipping session verification')
      setUser(null)
      setIsLoading(false)
      return
    }

    try {
      logger.debug('Verifying session with backend...')
      setIsLoading(true)

      // Call auth/user endpoint (cookies sent automatically)
      const response = await apiClient.get<{ user: User }>('/api/auth?action=user')

      setUser(response.user)
      logger.debug('Session verified', { userId: response.user.id })
    } catch (_err) {
      logger.warn('Session verification failed', {
        error: err instanceof Error ? err.message : 'Unknown error'
      })
      setUser(null)

      // Only set error if it's not just missing session
      if (err instanceof ApiError && err.status !== 401) {
        setError(err)
      }
    } finally {
      setIsLoading(false)
    }
  }, [logger])

  /**
   * Login with email and password
   */
  const login = useCallback(async (email: string, password: string) => {
    // Prevent concurrent login attempts
    if (loginInProgress.current) {
      logger.warn('Login already in progress')
      return
    }

    try {
      loginInProgress.current = true
      setIsLoading(true)
      setError(null)

      logger.debug('Attempting login...', { email })

      const response = await apiClient.post<{ user: User }>('/api/auth?action=session', {
        email,
        password,
      })

      setUser(response.user)
      logger.debug('Login successful', { userId: response.user.id })
    } catch (_err) {
      logger.error('Login failed:', err)
      setError(err instanceof Error ? err : new Error('Login failed'))
      throw err
    } finally {
      setIsLoading(false)
      loginInProgress.current = false
    }
  }, [logger])

  /**
   * Logout
   */
  const logout = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      logger.debug('Logging out...')

      // Call logout endpoint (clears cookies)
      await apiClient.delete('/api/auth?action=session')

      setUser(null)
      logger.debug('Logout successful')
    } catch (_err) {
      logger.error('Logout error:', err)
      // Even if logout fails, clear local state
      setUser(null)
      setError(err instanceof Error ? err : new Error('Logout failed'))
    } finally {
      setIsLoading(false)
    }
  }, [logger])

  /**
   * Manually refresh session
   */
  const refreshSession = useCallback(async () => {
    try {
      setError(null)
      logger.debug('Manually refreshing session...')

      const response = await apiClient.post<{ user: User }>('/api/auth?action=refresh')

      setUser(response.user)
      logger.debug('Session refresh successful', { userId: response.user.id })
    } catch (_err) {
      logger.error('Session refresh failed:', err)
      setUser(null)
      setError(err instanceof Error ? err : new Error('Refresh failed'))
      throw err
    }
  }, [logger])

  /**
   * Verify session on mount
   * TEMPORARY: Disabled until /api/auth/user endpoint is fixed
   * Login already sets user correctly
   */
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      // TEMPORARY BYPASS: Skip session verification
      // verifySession()
      setIsLoading(false) // Ensure loading state is cleared
    }
  }, [verifySession])

  /**
   * Configure API client callbacks
   */
  useEffect(() => {
    apiClient.configure({
      onUnauthorized: () => {
        logger.warn('Unauthorized, clearing user state')
        setUser(null)
      },
      onForbidden: () => {
        logger.warn('Forbidden access attempt')
      },
    })
  }, [logger])

  return {
    user,
    isAuthenticated: user !== null,
    isLoading,
    error,
    login,
    logout,
    refreshSession,
    clearError,
  }
}
