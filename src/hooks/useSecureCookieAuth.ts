/**
 * useSecureCookieAuth Hook
 *
 * Secure authentication using httpOnly cookies
 * Resolves PRIO-SEC-001 (CVSS 9.1) - XSS token theft
 *
 * This hook replaces useAuth and provides the same interface
 * but uses httpOnly cookies instead of localStorage tokens.
 */

import { useState, useEffect, useCallback } from 'react'
import { secureAuth, type AuthUser } from '../lib/secureAuth'
import { logger } from '../utils/logger'

export interface UseSecureCookieAuthResult {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
  login: (email: string, password: string) => Promise<boolean>
  signup: (email: string, password: string, full_name?: string) => Promise<boolean>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

export function useSecureCookieAuth(): UseSecureCookieAuthResult {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * Initialize session from httpOnly cookie
   */
  const initializeSession = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      logger.debug('🔐 Initializing secure session from httpOnly cookie')

      const response = await secureAuth.getSession()

      if (response.success && response.user) {
        setUser(response.user)
        logger.debug('✅ Secure session restored successfully')

        // Start auto-refresh for active sessions
        secureAuth.startAutoRefresh(45) // Refresh every 45 minutes
      } else {
        setUser(null)
        logger.debug('⚠️ No active secure session found')
      }
    } catch (_err) {
      logger.error('❌ Session initialization error:', err)
      setUser(null)
      setError('Failed to initialize session')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Login with email and password
   */
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true)
      setError(null)

      logger.debug('🔐 Secure login attempt:', email)

      const response = await secureAuth.login(email, password)

      if (response.success && response.user) {
        setUser(response.user)
        logger.info('✅ Secure login successful')

        // Start auto-refresh
        secureAuth.startAutoRefresh(45)

        return true
      } else {
        setError(response.error?.message || 'Login failed')
        logger.warn('⚠️ Secure login failed:', response.error?.message)
        return false
      }
    } catch (_err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(message)
      logger.error('❌ Secure login error:', err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Signup with email and password
   */
  const signup = useCallback(async (
    email: string,
    password: string,
    full_name?: string
  ): Promise<boolean> => {
    try {
      setIsLoading(true)
      setError(null)

      logger.debug('📝 Secure signup attempt:', email)

      const response = await secureAuth.signup(email, password, full_name)

      if (response.success) {
        if (response.requiresEmailConfirmation) {
          logger.info('📧 Email confirmation required')
          setError('Please check your email to confirm your account')
          return false
        }

        if (response.user) {
          setUser(response.user)
          logger.info('✅ Secure signup successful')

          // Start auto-refresh
          secureAuth.startAutoRefresh(45)

          return true
        }
      }

      setError(response.error?.message || 'Signup failed')
      logger.warn('⚠️ Secure signup failed:', response.error?.message)
      return false
    } catch (_err) {
      const message = err instanceof Error ? err.message : 'Signup failed'
      setError(message)
      logger.error('❌ Secure signup error:', err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Logout (clears httpOnly cookies)
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true)
      setError(null)

      logger.debug('🚪 Secure logout initiated')

      // Stop auto-refresh
      secureAuth.stopAutoRefresh()

      await secureAuth.logout()

      setUser(null)
      logger.info('✅ Secure logout successful')
    } catch (_err) {
      logger.error('❌ Secure logout error:', err)
      // Still clear user on client side
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Manually refresh session
   */
  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      logger.debug('🔄 Manual session refresh')

      const response = await secureAuth.refreshSession()

      if (response.success && response.user) {
        setUser(response.user)
        logger.debug('✅ Session refreshed successfully')
      } else {
        logger.warn('⚠️ Session refresh failed, logging out')
        setUser(null)
        secureAuth.stopAutoRefresh()
      }
    } catch (_err) {
      logger.error('❌ Session refresh error:', err)
      setUser(null)
      secureAuth.stopAutoRefresh()
    }
  }, [])

  /**
   * Initialize session on mount
   */
  useEffect(() => {
    initializeSession()

    // Cleanup auto-refresh on unmount
    return () => {
      secureAuth.stopAutoRefresh()
    }
  }, [initializeSession])

  /**
   * Listen for visibility changes to refresh stale sessions
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        // Page became visible, refresh session if needed
        logger.debug('👀 Page visible, checking session freshness')
        refreshSession()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user, refreshSession])

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    login,
    signup,
    logout,
    refreshSession,
  }
}
