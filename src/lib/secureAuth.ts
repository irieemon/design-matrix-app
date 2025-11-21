/**
 * Secure Authentication Service
 *
 * Client-side authentication using httpOnly cookies
 * Resolves PRIO-SEC-001 (CVSS 9.1) - XSS token theft vulnerability
 *
 * This service communicates with backend auth endpoints that manage
 * tokens in httpOnly cookies, eliminating localStorage exposure.
 */

import { logger } from '../utils/logger'

export interface AuthUser {
  id: string
  email: string
  user_metadata?: {
    full_name?: string
    avatar_url?: string
    [key: string]: unknown
  }
  profile?: {
    id: string
    email: string
    full_name?: string
    role?: string
    avatar_url?: string
  }
}

export interface AuthResponse {
  success: boolean
  user?: AuthUser
  error?: {
    message: string
    code: string
  }
  requiresEmailConfirmation?: boolean
  csrfToken?: string
  timestamp: string
}

/**
 * CSRF Token Management
 * Tokens are stored in both httpOnly cookies (server-side) and
 * a non-httpOnly cookie (client-side readable) for request headers
 */
function getCSRFToken(): string | null {
  // Read CSRF token from non-httpOnly cookie
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === 'csrf-token') {
      return decodeURIComponent(value)
    }
  }
  return null
}

function setCSRFToken(token: string): void {
  // Store CSRF token in memory for this session
  // (Also stored in cookie by server, but we cache it here)
  sessionStorage.setItem('csrf-token', token)
}

function clearCSRFToken(): void {
  sessionStorage.removeItem('csrf-token')
}

/**
 * API Request Helper with CSRF Protection
 */
async function authFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const csrfToken = getCSRFToken() || sessionStorage.getItem('csrf-token')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  // Add CSRF token to headers for state-changing requests
  if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method || 'GET')) {
    headers['X-CSRF-Token'] = csrfToken
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include', // CRITICAL: Include httpOnly cookies
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: { message: 'Request failed', code: 'NETWORK_ERROR' }
    }))
    throw new Error(error.error?.message || 'Request failed')
  }

  return response.json()
}

/**
 * Login with email and password
 */
export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    logger.debug('🔐 Secure login initiated for:', email)

    const response = await authFetch<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    if (response.success && response.csrfToken) {
      setCSRFToken(response.csrfToken)
      logger.debug('✅ Secure login successful, tokens stored in httpOnly cookies')
    }

    return response
  } catch (_error) {
    logger.error('❌ Secure login failed:', error)
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Login failed',
        code: 'LOGIN_ERROR'
      },
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * Signup with email and password
 */
export async function signup(
  email: string,
  password: string,
  full_name?: string
): Promise<AuthResponse> {
  try {
    logger.debug('📝 Secure signup initiated for:', email)

    const response = await authFetch<AuthResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name }),
    })

    if (response.success && response.csrfToken) {
      setCSRFToken(response.csrfToken)
      logger.debug('✅ Secure signup successful')
    }

    return response
  } catch (_error) {
    logger.error('❌ Secure signup failed:', error)
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Signup failed',
        code: 'SIGNUP_ERROR'
      },
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * Logout (clears httpOnly cookies)
 */
export async function logout(): Promise<AuthResponse> {
  try {
    logger.debug('🚪 Secure logout initiated')

    const response = await authFetch<AuthResponse>('/api/auth/logout', {
      method: 'POST',
    })

    clearCSRFToken()
    logger.debug('✅ Secure logout successful, cookies cleared')

    return response
  } catch (_error) {
    logger.error('❌ Secure logout failed:', error)
    clearCSRFToken()

    return {
      success: true, // Always succeed logout on client side
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * Get current session (from httpOnly cookie)
 */
export async function getSession(): Promise<AuthResponse> {
  try {
    logger.debug('🔍 Checking secure session')

    const response = await authFetch<AuthResponse>('/api/auth/session', {
      method: 'GET',
    })

    if (response.success) {
      logger.debug('✅ Secure session valid')
    } else {
      logger.debug('⚠️ No active secure session')
    }

    return response
  } catch (_error) {
    logger.debug('⚠️ Secure session check failed:', error)
    return {
      success: false,
      error: {
        message: 'No active session',
        code: 'NO_SESSION'
      },
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * Refresh access token using refresh token from httpOnly cookie
 */
export async function refreshSession(): Promise<AuthResponse> {
  try {
    logger.debug('🔄 Refreshing secure session')

    const response = await authFetch<AuthResponse>('/api/auth/refresh', {
      method: 'POST',
    })

    if (response.success && response.csrfToken) {
      setCSRFToken(response.csrfToken)
      logger.debug('✅ Secure session refreshed')
    }

    return response
  } catch (_error) {
    logger.error('❌ Secure session refresh failed:', error)
    return {
      success: false,
      error: {
        message: 'Session refresh failed',
        code: 'REFRESH_ERROR'
      },
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * Auto-refresh handler
 * Call this periodically (e.g., every 45 minutes) to keep session alive
 */
let refreshTimer: NodeJS.Timeout | null = null

export function startAutoRefresh(intervalMinutes: number = 45): void {
  // Clear existing timer
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }

  // Set up auto-refresh
  refreshTimer = setInterval(async () => {
    logger.debug('⏰ Auto-refresh triggered')
    await refreshSession()
  }, intervalMinutes * 60 * 1000)

  logger.debug(`🔄 Auto-refresh enabled (every ${intervalMinutes} minutes)`)
}

export function stopAutoRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
    logger.debug('⏸️ Auto-refresh disabled')
  }
}

/**
 * Security utilities
 */
export const secureAuth = {
  login,
  signup,
  logout,
  getSession,
  refreshSession,
  startAutoRefresh,
  stopAutoRefresh,
}
