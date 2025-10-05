# Frontend httpOnly Cookie Authentication Integration Architecture

**Status**: Design Specification
**Version**: 1.0.0
**Created**: 2025-10-01
**Authors**: System Architecture Team

## Executive Summary

This document provides a comprehensive architecture for integrating httpOnly cookie-based authentication into the React + TypeScript SPA. This replaces the current localStorage-based authentication with a secure, server-side session management approach that eliminates XSS token theft vulnerabilities.

**Key Design Principles**:
- Zero localStorage/sessionStorage for sensitive data
- Browser-managed cookie transmission (no manual token handling)
- CSRF protection for all mutations
- Automatic token refresh with retry logic
- Gradual migration path with backward compatibility
- Performance-optimized with intelligent caching

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Hook Specifications](#2-hook-specifications)
3. [API Client Design](#3-api-client-design)
4. [Context Updates](#4-context-updates)
5. [Migration Guide](#5-migration-guide)
6. [Code Examples](#6-code-examples)
7. [Testing Strategy](#7-testing-strategy)
8. [Performance Considerations](#8-performance-considerations)
9. [Edge Cases & Error Handling](#9-edge-cases--error-handling)
10. [User Experience](#10-user-experience)

---

## 1. Architecture Overview

### 1.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      React Application                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │  AuthProvider    │         │  AdminProvider   │          │
│  │  (useSecureAuth) │◄────────│  (useAdmin)      │          │
│  └────────┬─────────┘         └──────────────────┘          │
│           │                                                   │
│  ┌────────▼──────────────────────────────────────┐          │
│  │         Secure API Client                     │          │
│  │  ┌────────────┐  ┌────────────┐              │          │
│  │  │ CSRF Token │  │  Auto      │              │          │
│  │  │ Injection  │  │  Refresh   │              │          │
│  │  └────────────┘  └────────────┘              │          │
│  └───────────────────┬───────────────────────────┘          │
│                      │                                       │
│  ┌───────────────────▼───────────────────────────┐          │
│  │        Component State Hooks                  │          │
│  │  ┌────────────────┐  ┌────────────────┐      │          │
│  │  │ useServerState │  │ useCsrfToken   │      │          │
│  │  └────────────────┘  └────────────────┘      │          │
│  └───────────────────────────────────────────────┘          │
│                                                               │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        │ httpOnly Cookies
                        │ (access_token, refresh_token, csrf-token)
                        │
┌───────────────────────▼───────────────────────────────────────┐
│                     Backend API                                │
├────────────────────────────────────────────────────────────────┤
│  POST   /api/auth/session        ← Login                      │
│  DELETE /api/auth/session        ← Logout                     │
│  POST   /api/auth/refresh        ← Token Refresh              │
│  POST   /api/auth/admin/verify   ← Admin Verification         │
│  GET/POST /api/user/component-state ← Server-side State       │
└────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow: Authentication

```
┌─────────┐     1. POST /api/auth/session      ┌─────────┐
│ Login   │────────────────────────────────────►│ Backend │
│ Form    │     { email, password }             │   API   │
└─────────┘                                      └────┬────┘
                                                      │
                                                      │ 2. Set Cookies:
                                                      │   - access_token (httpOnly)
                                                      │   - refresh_token (httpOnly)
                                                      │   - csrf-token (readable)
                                                      │
┌─────────┐     3. { success: true, user }      ┌────▼────┐
│useSecure│◄────────────────────────────────────│ Response│
│  Auth   │                                      └─────────┘
└────┬────┘
     │
     │ 4. setState({ user, isAuthenticated: true })
     │
┌────▼────┐
│ App UI  │
│(logged) │
└─────────┘
```

### 1.3 Data Flow: CSRF Protection

```
┌──────────────┐     1. Read csrf-token cookie    ┌──────────────┐
│ Component    │──────────────────────────────────►│ useCsrfToken │
│ (mutation)   │                                    └──────┬───────┘
└──────┬───────┘                                           │
       │                                                   │
       │ 2. POST /api/endpoint                            │
       │    Header: X-CSRF-Token: <token>                 │
       │    Cookies: csrf-token, access_token ◄───────────┘
       │
┌──────▼───────┐
│ Backend API  │
│              │
│ 3. Validate: │
│   req.cookies['csrf-token'] === req.headers['x-csrf-token']
│              │
└──────────────┘
```

### 1.4 Data Flow: Automatic Token Refresh

```
┌──────────────┐     1. GET /api/endpoint         ┌──────────────┐
│ Component    │─────────────────────────────────►│ API Client   │
└──────────────┘                                   └──────┬───────┘
                                                          │
                                                          │ 2. Fetch with
                                                          │    access_token cookie
                                                          │
┌──────────────┐     3. 401 Unauthorized          ┌──────▼───────┐
│ Backend API  │─────────────────────────────────►│ API Client   │
└──────────────┘                                   └──────┬───────┘
                                                          │
                                                          │ 4. POST /api/auth/refresh
                                                          │    (refresh_token cookie)
                                                          │
┌──────────────┐     5. New access_token          ┌──────▼───────┐
│ Backend API  │─────────────────────────────────►│ API Client   │
└──────────────┘                                   └──────┬───────┘
                                                          │
                                                          │ 6. Retry original request
                                                          │    with new token
                                                          │
┌──────────────┐     7. 200 OK                    ┌──────▼───────┐
│ Backend API  │─────────────────────────────────►│ API Client   │
└──────────────┘                                   └──────────────┘
```

### 1.5 Integration Points with Existing Code

**Files to Create** (New):
- `src/hooks/useSecureAuth.ts` - New authentication hook
- `src/hooks/useCsrfToken.ts` - CSRF token management
- `src/hooks/useServerComponentState.ts` - Server-side state persistence
- `src/lib/apiClient.ts` - Secure API client wrapper
- `src/contexts/SecureAuthContext.tsx` - New auth context
- `src/utils/cookieUtils.ts` - Cookie reading utilities

**Files to Modify** (Migration):
- `src/hooks/useAuth.ts` - Deprecate gradually
- `src/contexts/AuthContext.tsx` - Update to use new hooks
- `src/contexts/AdminContext.tsx` - Integrate admin verification API
- `src/components/app/AuthenticationFlow.tsx` - Update login/logout flows
- `src/components/pages/UserSettings.tsx` - Update profile management

**Files Unaffected** (No Changes):
- All component logic (uses context, not direct hooks)
- All business logic (state management, idea handling)
- All UI components (receive auth state via context)

---

## 2. Hook Specifications

### 2.1 useSecureAuth Hook

**Purpose**: Manage authentication state using httpOnly cookies instead of localStorage.

**File**: `src/hooks/useSecureAuth.ts`

#### Interface

```typescript
interface UseSecureAuthOptions {
  autoRefresh?: boolean              // Enable automatic token refresh (default: true)
  refreshBeforeExpiry?: number       // Refresh N seconds before expiry (default: 300)
  onSessionExpired?: () => void      // Callback when session expires
  onRefreshError?: (error: Error) => void  // Callback on refresh failure
}

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  error: Error | null
  sessionExpiresAt: Date | null
}

interface UseSecureAuthReturn extends AuthState {
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
  clearError: () => void
}
```

#### Key Features

1. **Cookie-Based Authentication**: No manual token management
2. **Automatic Refresh**: Proactive token refresh before expiration
3. **Session Restoration**: Detect existing session on mount via `/api/auth/user`
4. **Error Recovery**: Retry logic with exponential backoff
5. **Memory-Only State**: No localStorage/sessionStorage usage

#### State Management

```typescript
const [authState, setAuthState] = useState<AuthState>({
  user: null,
  isLoading: true,  // Start as loading to detect existing session
  isAuthenticated: false,
  error: null,
  sessionExpiresAt: null,
})
```

#### Session Detection Flow

```typescript
// On mount, check for existing session
useEffect(() => {
  const checkSession = async () => {
    try {
      // Try to fetch current user (cookies sent automatically)
      const response = await apiClient.get<{ user: User }>('/api/auth/user')

      if (response.user) {
        setAuthState({
          user: response.user,
          isLoading: false,
          isAuthenticated: true,
          error: null,
          sessionExpiresAt: response.expiresAt ? new Date(response.expiresAt) : null,
        })
      } else {
        // No session found
        setAuthState(prev => ({ ...prev, isLoading: false }))
      }
    } catch (error) {
      // No valid session
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
        sessionExpiresAt: null,
      })
    }
  }

  checkSession()
}, [])
```

#### Login Implementation

```typescript
const login = async (email: string, password: string): Promise<void> => {
  try {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }))

    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Critical: Include cookies
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Login failed')
    }

    const data = await response.json()

    // Cookies are set by backend, just update state
    setAuthState({
      user: data.user,
      isLoading: false,
      isAuthenticated: true,
      error: null,
      sessionExpiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    })

    // Start automatic refresh if enabled
    if (options.autoRefresh && data.expiresAt) {
      scheduleTokenRefresh(new Date(data.expiresAt))
    }
  } catch (error) {
    setAuthState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: error instanceof Error ? error : new Error('Login failed'),
      sessionExpiresAt: null,
    })
    throw error
  }
}
```

#### Automatic Token Refresh

```typescript
const scheduleTokenRefresh = (expiresAt: Date) => {
  const now = Date.now()
  const expiryTime = expiresAt.getTime()
  const refreshBeforeMs = (options.refreshBeforeExpiry || 300) * 1000
  const refreshAt = expiryTime - refreshBeforeMs
  const timeUntilRefresh = refreshAt - now

  if (timeUntilRefresh > 0) {
    refreshTimeoutRef.current = setTimeout(() => {
      refreshSession().catch(error => {
        logger.error('Automatic token refresh failed:', error)
        options.onRefreshError?.(error)
      })
    }, timeUntilRefresh)

    logger.debug('Token refresh scheduled', {
      refreshIn: Math.round(timeUntilRefresh / 1000) + 's',
      expiresAt: expiresAt.toISOString(),
    })
  }
}

const refreshSession = async (): Promise<void> => {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include', // Send refresh_token cookie
    })

    if (!response.ok) {
      throw new Error('Token refresh failed')
    }

    const data = await response.json()

    // Update session expiry
    setAuthState(prev => ({
      ...prev,
      sessionExpiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    }))

    // Schedule next refresh
    if (options.autoRefresh && data.expiresAt) {
      scheduleTokenRefresh(new Date(data.expiresAt))
    }

    logger.debug('Token refreshed successfully')
  } catch (error) {
    logger.error('Token refresh failed:', error)

    // Session expired, trigger logout
    options.onSessionExpired?.()
    await logout()
    throw error
  }
}
```

---

### 2.2 useCsrfToken Hook

**Purpose**: Manage CSRF token extraction and validation.

**File**: `src/hooks/useCsrfToken.ts`

#### Interface

```typescript
interface UseCsrfTokenReturn {
  csrfToken: string | null
  isLoading: boolean
  error: Error | null
  refresh: () => void
}
```

#### Implementation

```typescript
import { useState, useEffect } from 'react'
import { logger } from '../utils/logger'
import { getCsrfTokenFromCookie } from '../utils/cookieUtils'

export const useCsrfToken = (): UseCsrfTokenReturn => {
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    const loadCsrfToken = () => {
      try {
        setIsLoading(true)
        setError(null)

        // Read from cookie (non-httpOnly, readable by JS)
        const token = getCsrfTokenFromCookie()

        if (!token) {
          logger.warn('CSRF token not found in cookies')
          setError(new Error('CSRF token not available'))
          setCsrfToken(null)
        } else {
          logger.debug('CSRF token loaded successfully')
          setCsrfToken(token)
        }
      } catch (err) {
        logger.error('Failed to load CSRF token:', err)
        setError(err instanceof Error ? err : new Error('Failed to load CSRF token'))
        setCsrfToken(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadCsrfToken()
  }, [refreshTrigger])

  const refresh = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  return {
    csrfToken,
    isLoading,
    error,
    refresh,
  }
}
```

---

### 2.3 useServerComponentState Hook

**Purpose**: Persist component state to server instead of localStorage.

**File**: `src/hooks/useServerComponentState.ts`

#### Interface

```typescript
interface UseServerComponentStateOptions {
  encrypted?: boolean        // Encrypt state data (default: false)
  expiresIn?: number        // Expiry in milliseconds (default: 30 days)
  syncInterval?: number     // Auto-sync interval in ms (default: 5000)
  debounceMs?: number       // Debounce save operations (default: 500)
}

interface UseServerComponentStateReturn<T> {
  state: T
  setState: (newState: T | ((prev: T) => T)) => void
  isLoading: boolean
  isSyncing: boolean
  error: Error | null
  lastSyncedAt: Date | null
  reset: () => void
  clearFromServer: () => Promise<void>
  forceSave: () => Promise<void>
}
```

#### Implementation

```typescript
import { useState, useEffect, useRef, useCallback } from 'react'
import { apiClient } from '../lib/apiClient'
import { logger } from '../utils/logger'

export const useServerComponentState = <T>(
  componentKey: string,
  defaultValue: T,
  options: UseServerComponentStateOptions = {}
): UseServerComponentStateReturn<T> => {
  const {
    encrypted = false,
    expiresIn = 30 * 24 * 60 * 60 * 1000, // 30 days
    syncInterval = 5000,
    debounceMs = 500,
  } = options

  const [state, setStateInternal] = useState<T>(defaultValue)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)

  const pendingSaveRef = useRef<NodeJS.Timeout | null>(null)
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedStateRef = useRef<T>(defaultValue)

  // Load state from server on mount
  useEffect(() => {
    const loadState = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await apiClient.get<{ state: T; updatedAt: string }>(
          `/api/user/component-state?componentKey=${encodeURIComponent(componentKey)}`
        )

        if (response.state !== undefined) {
          setStateInternal(response.state)
          lastSavedStateRef.current = response.state
          setLastSyncedAt(new Date(response.updatedAt))
          logger.debug('Component state loaded from server', { componentKey })
        } else {
          logger.debug('No server state found, using default', { componentKey })
        }
      } catch (err) {
        logger.warn('Failed to load state from server, using default', { componentKey, error: err })
        setError(err instanceof Error ? err : new Error('Failed to load state'))
      } finally {
        setIsLoading(false)
      }
    }

    loadState()
  }, [componentKey])

  // Save state to server (debounced)
  const saveToServer = useCallback(async (stateToSave: T) => {
    try {
      setIsSyncing(true)
      setError(null)

      // Validate size (100KB limit per backend)
      const stateJson = JSON.stringify(stateToSave)
      const sizeKB = new Blob([stateJson]).size / 1024

      if (sizeKB > 100) {
        throw new Error(`Component state too large: ${sizeKB.toFixed(2)}KB (max 100KB)`)
      }

      await apiClient.post('/api/user/component-state', {
        componentKey,
        state: stateToSave,
        encrypted,
        expiresIn,
      })

      lastSavedStateRef.current = stateToSave
      setLastSyncedAt(new Date())
      logger.debug('Component state saved to server', { componentKey, sizeKB: sizeKB.toFixed(2) })
    } catch (err) {
      logger.error('Failed to save state to server', { componentKey, error: err })
      setError(err instanceof Error ? err : new Error('Failed to save state'))
      throw err
    } finally {
      setIsSyncing(false)
    }
  }, [componentKey, encrypted, expiresIn])

  // Set state with automatic debounced save
  const setState = useCallback((newState: T | ((prev: T) => T)) => {
    setStateInternal(prevState => {
      const updatedState = typeof newState === 'function'
        ? (newState as (prev: T) => T)(prevState)
        : newState

      // Clear pending save
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current)
      }

      // Schedule debounced save
      pendingSaveRef.current = setTimeout(() => {
        saveToServer(updatedState).catch(() => {
          // Error already logged in saveToServer
        })
      }, debounceMs)

      return updatedState
    })
  }, [debounceMs, saveToServer])

  // Auto-sync at interval (for conflict detection)
  useEffect(() => {
    if (syncInterval > 0) {
      syncIntervalRef.current = setInterval(() => {
        if (!isSyncing) {
          saveToServer(state).catch(() => {
            // Error already logged
          })
        }
      }, syncInterval)

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current)
        }
      }
    }
  }, [syncInterval, state, isSyncing, saveToServer])

  // Force save immediately
  const forceSave = useCallback(async () => {
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current)
      pendingSaveRef.current = null
    }
    await saveToServer(state)
  }, [state, saveToServer])

  // Reset to default value
  const reset = useCallback(() => {
    setStateInternal(defaultValue)
    lastSavedStateRef.current = defaultValue

    // Save reset state
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current)
    }
    pendingSaveRef.current = setTimeout(() => {
      saveToServer(defaultValue).catch(() => {
        // Error already logged
      })
    }, debounceMs)
  }, [defaultValue, debounceMs, saveToServer])

  // Clear from server
  const clearFromServer = useCallback(async () => {
    try {
      setIsSyncing(true)
      await apiClient.delete(`/api/user/component-state?componentKey=${encodeURIComponent(componentKey)}`)
      setStateInternal(defaultValue)
      lastSavedStateRef.current = defaultValue
      setLastSyncedAt(null)
      logger.debug('Component state cleared from server', { componentKey })
    } catch (err) {
      logger.error('Failed to clear state from server', { componentKey, error: err })
      setError(err instanceof Error ? err : new Error('Failed to clear state'))
      throw err
    } finally {
      setIsSyncing(false)
    }
  }, [componentKey, defaultValue])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current)
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [])

  return {
    state,
    setState,
    isLoading,
    isSyncing,
    error,
    lastSyncedAt,
    reset,
    clearFromServer,
    forceSave,
  }
}
```

---

## 3. API Client Design

**File**: `src/lib/apiClient.ts`

### 3.1 Purpose

Centralized API client that:
1. Automatically includes CSRF tokens in mutation requests
2. Handles 401 responses with automatic token refresh
3. Retries failed requests after successful refresh
4. Provides TypeScript type safety
5. Manages error handling consistently

### 3.2 Implementation

```typescript
import { logger } from '../utils/logger'
import { getCsrfTokenFromCookie } from '../utils/cookieUtils'

/**
 * API Error class with structured error information
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Request configuration
 */
interface RequestConfig {
  headers?: Record<string, string>
  retryOn401?: boolean  // Retry after token refresh (default: true)
  skipCsrf?: boolean    // Skip CSRF header (for GET requests)
}

/**
 * Refresh token state
 */
let isRefreshing = false
let refreshPromise: Promise<void> | null = null

/**
 * Refresh access token
 */
async function refreshAccessToken(): Promise<void> {
  // Prevent concurrent refresh requests
  if (isRefreshing && refreshPromise) {
    return refreshPromise
  }

  isRefreshing = true
  refreshPromise = (async () => {
    try {
      logger.debug('Refreshing access token...')

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include', // Send refresh_token cookie
      })

      if (!response.ok) {
        throw new ApiError(
          'Token refresh failed',
          response.status,
          'TOKEN_REFRESH_FAILED'
        )
      }

      const data = await response.json()
      logger.debug('Access token refreshed successfully', {
        expiresAt: data.expiresAt,
      })
    } catch (error) {
      logger.error('Token refresh failed:', error)

      // Refresh failed, user needs to re-login
      // Trigger logout by dispatching custom event
      window.dispatchEvent(new CustomEvent('auth:session-expired'))

      throw error
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  })()

  return refreshPromise
}

/**
 * Make authenticated request
 */
async function request<T>(
  method: string,
  url: string,
  body?: any,
  config: RequestConfig = {}
): Promise<T> {
  const {
    headers = {},
    retryOn401 = true,
    skipCsrf = false,
  } = config

  // Build headers
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  }

  // Add CSRF token for mutations
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !skipCsrf) {
    const csrfToken = getCsrfTokenFromCookie()
    if (csrfToken) {
      requestHeaders['X-CSRF-Token'] = csrfToken
    } else {
      logger.warn('CSRF token not found, request may fail')
    }
  }

  // Make request
  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      credentials: 'include', // Include cookies
      body: body ? JSON.stringify(body) : undefined,
    })

    // Handle 401 Unauthorized (token expired)
    if (response.status === 401 && retryOn401) {
      logger.debug('Received 401, attempting token refresh...')

      try {
        // Refresh token
        await refreshAccessToken()

        // Retry original request (one time only)
        logger.debug('Retrying request after token refresh...')
        return await request<T>(method, url, body, {
          ...config,
          retryOn401: false, // Don't retry again
        })
      } catch (refreshError) {
        logger.error('Token refresh failed, cannot retry request')
        throw new ApiError(
          'Session expired, please login again',
          401,
          'SESSION_EXPIRED'
        )
      }
    }

    // Handle other error status codes
    if (!response.ok) {
      let errorData: any
      try {
        errorData = await response.json()
      } catch {
        errorData = { message: response.statusText }
      }

      throw new ApiError(
        errorData.error?.message || errorData.message || 'Request failed',
        response.status,
        errorData.error?.code || 'REQUEST_FAILED',
        errorData
      )
    }

    // Parse response
    const contentType = response.headers.get('Content-Type')
    if (contentType?.includes('application/json')) {
      return await response.json()
    } else {
      return (await response.text()) as any
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    // Network error or other unexpected error
    logger.error('Request failed:', error)
    throw new ApiError(
      error instanceof Error ? error.message : 'Network request failed',
      0,
      'NETWORK_ERROR'
    )
  }
}

/**
 * API Client
 */
export const apiClient = {
  /**
   * GET request
   */
  get: <T>(url: string, config?: RequestConfig): Promise<T> => {
    return request<T>('GET', url, undefined, { ...config, skipCsrf: true })
  },

  /**
   * POST request
   */
  post: <T>(url: string, data?: any, config?: RequestConfig): Promise<T> => {
    return request<T>('POST', url, data, config)
  },

  /**
   * PUT request
   */
  put: <T>(url: string, data?: any, config?: RequestConfig): Promise<T> => {
    return request<T>('PUT', url, data, config)
  },

  /**
   * PATCH request
   */
  patch: <T>(url: string, data?: any, config?: RequestConfig): Promise<T> => {
    return request<T>('PATCH', url, data, config)
  },

  /**
   * DELETE request
   */
  delete: <T>(url: string, config?: RequestConfig): Promise<T> => {
    return request<T>('DELETE', url, undefined, config)
  },
}

/**
 * Listen for session expired events
 */
if (typeof window !== 'undefined') {
  window.addEventListener('auth:session-expired', () => {
    logger.warn('Session expired, user needs to re-login')
    // Context will handle the actual logout
  })
}
```

### 3.3 Cookie Utilities

**File**: `src/utils/cookieUtils.ts`

```typescript
/**
 * Cookie utility functions
 */

/**
 * Get CSRF token from cookie
 */
export function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  const cookies = document.cookie.split(';')
  const csrfCookie = cookies.find(c => c.trim().startsWith('csrf-token='))

  if (!csrfCookie) {
    return null
  }

  const token = csrfCookie.split('=')[1]
  return decodeURIComponent(token)
}

/**
 * Get any cookie by name
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  const cookies = document.cookie.split(';')
  const cookie = cookies.find(c => c.trim().startsWith(`${name}=`))

  if (!cookie) {
    return null
  }

  const value = cookie.split('=')[1]
  return decodeURIComponent(value)
}

/**
 * Check if a cookie exists
 */
export function hasCookie(name: string): boolean {
  return getCookie(name) !== null
}

/**
 * Parse all cookies into an object
 */
export function parseCookies(): Record<string, string> {
  if (typeof document === 'undefined') {
    return {}
  }

  const cookies: Record<string, string> = {}

  document.cookie.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=')
    if (name && value) {
      cookies[name] = decodeURIComponent(value)
    }
  })

  return cookies
}
```

---

## 4. Context Updates

### 4.1 New SecureAuthContext

**File**: `src/contexts/SecureAuthContext.tsx`

```typescript
import React, { createContext, useContext, ReactNode, useEffect } from 'react'
import { User } from '../types'
import { useSecureAuth } from '../hooks/useSecureAuth'
import { logger } from '../utils/logger'

interface SecureAuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  error: Error | null
  sessionExpiresAt: Date | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
  clearError: () => void
}

const SecureAuthContext = createContext<SecureAuthContextType | undefined>(undefined)

interface SecureAuthProviderProps {
  children: ReactNode
}

export function SecureAuthProvider({ children }: SecureAuthProviderProps) {
  const auth = useSecureAuth({
    autoRefresh: true,
    refreshBeforeExpiry: 300, // 5 minutes
    onSessionExpired: () => {
      logger.warn('Session expired, user needs to re-login')
      // Could show a toast notification here
    },
    onRefreshError: (error) => {
      logger.error('Token refresh failed:', error)
      // Could show a toast notification here
    },
  })

  // Listen for custom session expired events
  useEffect(() => {
    const handleSessionExpired = () => {
      auth.logout().catch(() => {
        // Error already logged
      })
    }

    window.addEventListener('auth:session-expired', handleSessionExpired)

    return () => {
      window.removeEventListener('auth:session-expired', handleSessionExpired)
    }
  }, [auth])

  return (
    <SecureAuthContext.Provider value={auth}>
      {children}
    </SecureAuthContext.Provider>
  )
}

export function useSecureAuthContext() {
  const context = useContext(SecureAuthContext)
  if (context === undefined) {
    throw new Error('useSecureAuthContext must be used within a SecureAuthProvider')
  }
  return context
}
```

### 4.2 Updated AdminContext

**File**: `src/contexts/AdminContext.tsx` (modifications)

```typescript
// Add to existing AdminContext.tsx

// Update switchToAdminMode to use server verification
const switchToAdminMode = async (): Promise<void> => {
  if (!isAdmin) {
    logger.warn('AdminContext: Attempted to switch to admin mode without admin privileges')
    return
  }

  try {
    logger.debug('AdminContext: Switching to admin mode')

    // Use new API client for server-side verification
    const response = await apiClient.post<{
      isAdmin: boolean
      isSuperAdmin: boolean
      capabilities: string[]
    }>('/api/auth/admin/verify')

    if (!response.isAdmin) {
      logger.error('AdminContext: Server-side admin verification failed')
      throw new Error('Admin verification failed')
    }

    setIsAdminMode(true)
    logger.debug('AdminContext: Successfully switched to admin mode', {
      isSuperAdmin: response.isSuperAdmin,
      capabilities: response.capabilities,
    })
  } catch (error) {
    logger.error('AdminContext: Failed to switch to admin mode:', error)
    throw error
  }
}
```

---

## 5. Migration Guide

### 5.1 Three-Phase Migration Strategy

**Phase 1: Parallel Systems (Week 1)**
- Deploy new hooks and API client alongside existing code
- Feature flag controlled rollout
- Both auth systems coexist
- Limited user testing (5-10% traffic)

**Phase 2: Incremental Migration (Week 2-3)**
- Migrate authentication flow first
- Migrate admin verification second
- Migrate component state last
- Gradually increase traffic (25% → 50% → 75%)

**Phase 3: Cleanup (Week 4)**
- Remove old localStorage code
- Remove deprecated hooks
- Update all imports
- 100% traffic on new system
- Remove feature flags

### 5.2 Feature Flag Implementation

**File**: `src/lib/featureFlags.ts`

```typescript
/**
 * Feature flags for gradual rollout
 */

interface FeatureFlags {
  useSecureAuth: boolean
  useServerComponentState: boolean
}

// Feature flags (can be controlled via environment variables)
export const featureFlags: FeatureFlags = {
  useSecureAuth: process.env.VITE_FEATURE_SECURE_AUTH === 'true',
  useServerComponentState: process.env.VITE_FEATURE_SERVER_STATE === 'true',
}

// Helper to check if feature is enabled
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return featureFlags[feature]
}
```

### 5.3 Migration Steps

#### Step 1: Deploy New Code (No Breaking Changes)

1. Deploy new hooks (`useSecureAuth`, `useCsrfToken`, `useServerComponentState`)
2. Deploy API client (`apiClient.ts`)
3. Deploy cookie utilities (`cookieUtils.ts`)
4. Feature flags OFF by default

**Verification**:
- No existing functionality broken
- Build succeeds
- Tests pass

#### Step 2: Migrate Authentication Context

**Before**:
```typescript
// src/contexts/AuthContext.tsx
import { useAuth } from '../hooks/useAuth' // Old hook

export function AuthProvider({ children }) {
  const auth = useAuth()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}
```

**After**:
```typescript
// src/contexts/AuthContext.tsx
import { useAuth } from '../hooks/useAuth' // Old hook
import { useSecureAuth } from '../hooks/useSecureAuth' // New hook
import { isFeatureEnabled } from '../lib/featureFlags'

export function AuthProvider({ children }) {
  const oldAuth = useAuth()
  const newAuth = useSecureAuth()

  // Use feature flag to choose implementation
  const auth = isFeatureEnabled('useSecureAuth') ? newAuth : oldAuth

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}
```

**Verification**:
- Enable feature flag for 5% of users
- Monitor error rates
- Check session persistence
- Verify login/logout flows

#### Step 3: Migrate Admin Verification

Update `AdminContext.tsx` to use `/api/auth/admin/verify` endpoint:

```typescript
// Replace local verification with server-side
const response = await apiClient.post<{
  isAdmin: boolean
  isSuperAdmin: boolean
  capabilities: string[]
}>('/api/auth/admin/verify')

if (response.isAdmin) {
  setIsAdminMode(true)
}
```

#### Step 4: Migrate Component State

Components using `useComponentState` with `persistState: true`:

**Before**:
```typescript
const { state, setState } = useComponentState({
  persistState: true,
  initialConfig: { variant: 'primary' },
})
```

**After**:
```typescript
const { state, setState } = useServerComponentState(
  'MyComponent',
  { variant: 'primary' },
  { syncInterval: 5000 }
)
```

#### Step 5: Remove Old Code

Once 100% migrated and stable:

1. Remove `useAuth` hook (old version)
2. Remove localStorage code
3. Remove feature flags
4. Update documentation
5. Update tests

### 5.4 Rollback Procedure

If issues occur, rollback by:

1. **Immediate**: Disable feature flags via environment variables
2. **Quick**: Revert to previous deployment
3. **Safe**: Old code still present, just disabled

**Rollback Command**:
```bash
# Disable feature flags
export VITE_FEATURE_SECURE_AUTH=false
export VITE_FEATURE_SERVER_STATE=false

# Restart application
npm run build && npm run preview
```

---

## 6. Code Examples

### 6.1 Login Component

```typescript
import React, { useState } from 'react'
import { useSecureAuthContext } from '../contexts/SecureAuthContext'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login, isLoading, error } = useSecureAuthContext()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await login(email, password)
      // Success handled by context, user state updated automatically
    } catch (err) {
      // Error handled by context, error state updated automatically
      console.error('Login failed:', err)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Email"
        disabled={isLoading}
      />
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Password"
        disabled={isLoading}
      />

      {error && <div className="error">{error.message}</div>}

      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  )
}
```

### 6.2 Protected API Call

```typescript
import { apiClient } from '../lib/apiClient'

async function updateUserProfile(userId: string, profile: UserProfile) {
  try {
    // CSRF token automatically added
    // Cookies automatically sent
    // 401 automatically handled with refresh
    const response = await apiClient.put<{ user: User }>(
      `/api/users/${userId}`,
      profile
    )

    return response.user
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === 'SESSION_EXPIRED') {
        // User needs to re-login (handled by apiClient)
        console.log('Session expired, please login again')
      } else {
        console.error('Profile update failed:', error.message)
      }
    }
    throw error
  }
}
```

### 6.3 Component with Server State

```typescript
import React from 'react'
import { useServerComponentState } from '../hooks/useServerComponentState'

interface UserPreferences {
  theme: 'light' | 'dark'
  notifications: boolean
  language: string
}

export function UserPreferencesPanel() {
  const {
    state: preferences,
    setState: setPreferences,
    isLoading,
    isSyncing,
    error,
    lastSyncedAt,
  } = useServerComponentState<UserPreferences>(
    'user-preferences',
    {
      theme: 'light',
      notifications: true,
      language: 'en',
    },
    {
      syncInterval: 10000, // Sync every 10 seconds
      debounceMs: 1000,    // Debounce saves by 1 second
    }
  )

  if (isLoading) {
    return <div>Loading preferences...</div>
  }

  return (
    <div>
      <h2>User Preferences</h2>

      <label>
        Theme:
        <select
          value={preferences.theme}
          onChange={e =>
            setPreferences(prev => ({ ...prev, theme: e.target.value as 'light' | 'dark' }))
          }
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>

      <label>
        <input
          type="checkbox"
          checked={preferences.notifications}
          onChange={e =>
            setPreferences(prev => ({ ...prev, notifications: e.target.checked }))
          }
        />
        Enable Notifications
      </label>

      {isSyncing && <div className="status">Saving...</div>}
      {error && <div className="error">Failed to save: {error.message}</div>}
      {lastSyncedAt && (
        <div className="status">Last saved: {lastSyncedAt.toLocaleString()}</div>
      )}
    </div>
  )
}
```

### 6.4 Admin-Only Component

```typescript
import React, { useEffect, useState } from 'react'
import { useAdmin } from '../contexts/AdminContext'
import { apiClient } from '../lib/apiClient'

export function AdminDashboard() {
  const { isAdmin, isSuperAdmin, isAdminMode, switchToAdminMode, isVerifyingAdmin } = useAdmin()
  const [users, setUsers] = useState([])

  useEffect(() => {
    if (isAdminMode) {
      loadUsers()
    }
  }, [isAdminMode])

  const loadUsers = async () => {
    try {
      const response = await apiClient.get<{ users: User[] }>('/api/admin/users')
      setUsers(response.users)
    } catch (error) {
      console.error('Failed to load users:', error)
    }
  }

  if (!isAdmin) {
    return <div>Access denied. Admin privileges required.</div>
  }

  if (!isAdminMode) {
    return (
      <div>
        <button onClick={switchToAdminMode} disabled={isVerifyingAdmin}>
          {isVerifyingAdmin ? 'Verifying...' : 'Enable Admin Mode'}
        </button>
      </div>
    )
  }

  return (
    <div>
      <h1>Admin Dashboard</h1>
      {isSuperAdmin && <div className="badge">Super Admin</div>}

      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td>{user.email}</td>
              <td>{user.role}</td>
              <td>{new Date(user.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

**Test File**: `src/hooks/__tests__/useSecureAuth.test.tsx`

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { useSecureAuth } from '../useSecureAuth'

describe('useSecureAuth', () => {
  beforeEach(() => {
    // Mock fetch
    global.fetch = jest.fn()
  })

  it('should detect existing session on mount', async () => {
    // Mock existing session
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: { id: '123', email: 'test@example.com' },
        expiresAt: Date.now() + 3600000,
      }),
    })

    const { result } = renderHook(() => useSecureAuth())

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user?.email).toBe('test@example.com')
    })
  })

  it('should handle login successfully', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        user: { id: '123', email: 'test@example.com' },
        expiresAt: Date.now() + 3600000,
      }),
    })

    const { result } = renderHook(() => useSecureAuth())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await result.current.login('test@example.com', 'password')

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user?.email).toBe('test@example.com')
  })

  it('should handle login failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: { message: 'Invalid credentials' },
      }),
    })

    const { result } = renderHook(() => useSecureAuth())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await expect(result.current.login('test@example.com', 'wrong')).rejects.toThrow()

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.error).toBeTruthy()
  })

  it('should schedule automatic token refresh', async () => {
    jest.useFakeTimers()

    const expiresAt = Date.now() + 3600000 // 1 hour
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        user: { id: '123', email: 'test@example.com' },
        expiresAt,
      }),
    })

    const { result } = renderHook(() => useSecureAuth({ autoRefresh: true }))

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))

    // Fast-forward to 5 minutes before expiry
    jest.advanceTimersByTime(3600000 - 5 * 60000)

    // Mock refresh response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        expiresAt: Date.now() + 3600000,
      }),
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/refresh', expect.any(Object))
    })

    jest.useRealTimers()
  })
})
```

### 7.2 Integration Tests

**Test File**: `src/lib/__tests__/apiClient.test.ts`

```typescript
import { apiClient, ApiError } from '../apiClient'

describe('apiClient', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
    document.cookie = 'csrf-token=test-csrf-token'
  })

  it('should include CSRF token in POST requests', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => ({ success: true }),
    })

    await apiClient.post('/api/test', { data: 'test' })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-CSRF-Token': 'test-csrf-token',
        }),
      })
    )
  })

  it('should not include CSRF token in GET requests', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => ({ data: [] }),
    })

    await apiClient.get('/api/test')

    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1]
    expect(callArgs.headers['X-CSRF-Token']).toBeUndefined()
  })

  it('should automatically refresh on 401 and retry', async () => {
    // First call returns 401
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    })

    // Refresh call succeeds
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    })

    // Retry call succeeds
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => ({ data: 'success' }),
    })

    const result = await apiClient.get('/api/test')

    expect(result).toEqual({ data: 'success' })
    expect(global.fetch).toHaveBeenCalledTimes(3) // Original + refresh + retry
  })

  it('should throw ApiError on failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          message: 'Bad request',
          code: 'BAD_REQUEST',
        },
      }),
    })

    await expect(apiClient.get('/api/test')).rejects.toThrow(ApiError)
    await expect(apiClient.get('/api/test')).rejects.toThrow('Bad request')
  })
})
```

### 7.3 E2E Tests

**Test File**: `tests/e2e/auth-secure-flow.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Secure Authentication Flow', () => {
  test('should login with httpOnly cookies', async ({ page, context }) => {
    await page.goto('/')

    // Should show login form
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible()

    // Fill in credentials
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')

    // Submit form
    await page.click('[data-testid="login-button"]')

    // Wait for authentication
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()

    // Verify cookies were set
    const cookies = await context.cookies()
    const accessTokenCookie = cookies.find(c => c.name === 'access_token')
    const csrfTokenCookie = cookies.find(c => c.name === 'csrf-token')

    expect(accessTokenCookie).toBeDefined()
    expect(accessTokenCookie?.httpOnly).toBe(true)
    expect(accessTokenCookie?.secure).toBe(true)
    expect(accessTokenCookie?.sameSite).toBe('Strict')

    expect(csrfTokenCookie).toBeDefined()
    expect(csrfTokenCookie?.httpOnly).toBe(false) // Readable by JS
  })

  test('should maintain session after page reload', async ({ page }) => {
    // Login first
    await page.goto('/')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()

    // Reload page
    await page.reload()

    // Should still be logged in (session restored via cookies)
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
    await expect(page.locator('[data-testid="login-form"]')).not.toBeVisible()
  })

  test('should handle token refresh automatically', async ({ page, context }) => {
    // Login
    await page.goto('/')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()

    // Intercept API calls
    const requestLog: string[] = []
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        requestLog.push(request.url())
      }
    })

    // Simulate expired token by clearing access_token cookie
    await context.clearCookies({ name: 'access_token' })

    // Make a protected API call (should trigger 401 → refresh → retry)
    await page.click('[data-testid="load-data-button"]')

    // Wait for refresh to complete
    await page.waitForTimeout(1000)

    // Verify refresh was called
    expect(requestLog.some(url => url.includes('/api/auth/refresh'))).toBe(true)

    // Verify original request was retried and succeeded
    await expect(page.locator('[data-testid="data-loaded"]')).toBeVisible()
  })

  test('should logout and clear cookies', async ({ page, context }) => {
    // Login first
    await page.goto('/')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()

    // Logout
    await page.click('[data-testid="user-menu"]')
    await page.click('[data-testid="logout-button"]')

    // Should show login form
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible()

    // Verify cookies were cleared
    const cookies = await context.cookies()
    const accessTokenCookie = cookies.find(c => c.name === 'access_token')
    const refreshTokenCookie = cookies.find(c => c.name === 'refresh_token')
    const csrfTokenCookie = cookies.find(c => c.name === 'csrf-token')

    expect(accessTokenCookie).toBeUndefined()
    expect(refreshTokenCookie).toBeUndefined()
    expect(csrfTokenCookie).toBeUndefined()
  })

  test('should protect against CSRF attacks', async ({ page }) => {
    // Login first
    await page.goto('/')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'password123')
    await page.click('[data-testid="login-button"]')
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()

    // Attempt to make request without CSRF token
    const response = await page.evaluate(async () => {
      // Manually remove CSRF header
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          // Intentionally omit X-CSRF-Token header
        },
        credentials: 'include',
        body: JSON.stringify({ name: 'Hacked' }),
      })
      return res.status
    })

    // Should be rejected
    expect(response).toBe(403) // Forbidden (CSRF validation failed)
  })
})
```

---

## 8. Performance Considerations

### 8.1 Cookie Overhead

**Impact Analysis**:
- httpOnly cookies: ~200-500 bytes per request
- CSRF token cookie: ~50-100 bytes per request
- Total overhead: ~250-600 bytes per request

**Mitigation**:
- Cookies sent only to same origin (SameSite=Strict)
- Token refresh reduces cookie traffic (1 refresh per hour vs every request)
- Compression reduces actual transmitted size

**Benchmark**:
```
localStorage auth: 0 bytes per request overhead
httpOnly cookies: 400 bytes per request overhead
Trade-off: +0.4KB per request for significant security improvement
```

### 8.2 Request Latency

**Token Refresh Latency**:
- Automatic refresh: +100-300ms (1x per hour)
- On-demand refresh (401): +200-500ms (rare)

**Session Detection Latency**:
- Page load: +100-200ms to verify session
- Cached in memory after initial load

**Optimization Strategies**:
1. Proactive refresh (5 minutes before expiry)
2. Request deduplication (single refresh for concurrent 401s)
3. Optimistic UI updates
4. Parallel session check on mount

### 8.3 State Sync Performance

**useServerComponentState Metrics**:
- Debounced save: 500ms default (configurable)
- Auto-sync: 5 seconds default (configurable)
- State size limit: 100KB per component
- Network overhead: ~1-10KB per sync

**Optimization**:
```typescript
// Heavy state updates
const { state, setState, forceSave } = useServerComponentState(
  'my-component',
  defaultValue,
  {
    debounceMs: 2000,    // Save less frequently
    syncInterval: 30000, // Sync every 30 seconds
  }
)

// Critical state updates
const { state, setState, forceSave } = useServerComponentState(
  'critical-state',
  defaultValue,
  {
    debounceMs: 100,     // Save quickly
    syncInterval: 1000,  // Sync every second
  }
)
```

### 8.4 Caching Strategies

**Frontend Caching**:
- CSRF token cached in memory (read from cookie as needed)
- Session state cached in context (no re-fetch)
- Component state cached until server sync

**Backend Caching**:
- Token validation cached (1 minute)
- Admin verification cached (1 hour)
- Component state cached in database

---

## 9. Edge Cases & Error Handling

### 9.1 Concurrent Token Refresh

**Problem**: Multiple requests return 401 simultaneously

**Solution**: Single refresh promise shared across requests

```typescript
let isRefreshing = false
let refreshPromise: Promise<void> | null = null

async function refreshAccessToken(): Promise<void> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise // Wait for existing refresh
  }

  isRefreshing = true
  refreshPromise = (async () => {
    // ... refresh logic
  })()

  try {
    await refreshPromise
  } finally {
    isRefreshing = false
    refreshPromise = null
  }
}
```

### 9.2 Token Refresh Failure

**Scenarios**:
1. Refresh token expired
2. Network error during refresh
3. Server error during refresh

**Handling**:
```typescript
try {
  await refreshAccessToken()
  // Retry original request
} catch (error) {
  // Refresh failed, logout user
  window.dispatchEvent(new CustomEvent('auth:session-expired'))
  throw new ApiError('Session expired, please login again', 401, 'SESSION_EXPIRED')
}
```

### 9.3 CSRF Token Mismatch

**Scenarios**:
1. Cookie not set (backend issue)
2. Cookie expired
3. Token modified (malicious)

**Handling**:
```typescript
if (!csrfToken) {
  logger.warn('CSRF token not found, request may fail')
  // Still attempt request, let backend reject
}

// Backend rejects with 403
if (response.status === 403 && response.code === 'CSRF_VALIDATION_FAILED') {
  // Prompt user to refresh page
  showNotification('Session security check failed. Please refresh the page.')
}
```

### 9.4 Session Expiration During User Activity

**Scenario**: Token expires while user is actively using the app

**Handling**:
```typescript
// Automatic refresh 5 minutes before expiry
const scheduleTokenRefresh = (expiresAt: Date) => {
  const refreshBeforeMs = 5 * 60 * 1000 // 5 minutes
  const timeUntilRefresh = expiresAt.getTime() - Date.now() - refreshBeforeMs

  if (timeUntilRefresh > 0) {
    setTimeout(() => {
      refreshSession().catch(error => {
        // Show user-friendly notification
        showNotification('Your session will expire soon. Please save your work.')
      })
    }, timeUntilRefresh)
  }
}
```

### 9.5 Network Errors

**Scenario**: Request fails due to network issue

**Handling**:
```typescript
try {
  const response = await fetch(url, options)
} catch (error) {
  if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
    // Network error
    throw new ApiError('Network connection lost', 0, 'NETWORK_ERROR')
  }
  throw error
}

// In component
try {
  await apiClient.post('/api/endpoint', data)
} catch (error) {
  if (error instanceof ApiError && error.code === 'NETWORK_ERROR') {
    showNotification('Connection lost. Please check your internet connection.')
  }
}
```

### 9.6 State Sync Conflicts

**Scenario**: Local state modified while server sync is in progress

**Handling**:
```typescript
// Track last saved state
const lastSavedStateRef = useRef<T>(defaultValue)

// Only sync if state changed
if (JSON.stringify(state) !== JSON.stringify(lastSavedStateRef.current)) {
  await saveToServer(state)
  lastSavedStateRef.current = state
}

// Handle server conflicts (last-write-wins)
try {
  await saveToServer(state)
} catch (error) {
  if (error.code === 'CONFLICT') {
    // Server has newer state, reload
    const serverState = await loadFromServer()
    setState(serverState)
    showNotification('Your changes were overwritten by a newer version.')
  }
}
```

---

## 10. User Experience

### 10.1 Loading States

**Initial Page Load**:
```typescript
if (isLoading) {
  return (
    <div className="loading-screen">
      <Spinner />
      <p>Checking authentication...</p>
    </div>
  )
}
```

**Login Process**:
```typescript
<button type="submit" disabled={isLoading}>
  {isLoading ? (
    <>
      <Spinner size="small" />
      <span>Logging in...</span>
    </>
  ) : (
    'Login'
  )}
</button>
```

**Token Refresh** (Background):
```typescript
// Show subtle indicator in header
{isRefreshing && (
  <div className="header-status">
    <Icon name="sync" className="rotating" />
    <span>Refreshing session...</span>
  </div>
)}
```

### 10.2 Error Messages

**User-Friendly Errors**:
```typescript
const errorMessages: Record<string, string> = {
  LOGIN_FAILED: 'Invalid email or password. Please try again.',
  TOKEN_REFRESH_FAILED: 'Your session could not be refreshed. Please log in again.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  NETWORK_ERROR: 'Connection lost. Please check your internet connection.',
  CSRF_VALIDATION_FAILED: 'Security check failed. Please refresh the page.',
  REQUEST_FAILED: 'Something went wrong. Please try again.',
}

// In component
{error && (
  <div className="error-banner">
    <Icon name="alert-circle" />
    <span>{errorMessages[error.code] || error.message}</span>
    {error.code === 'SESSION_EXPIRED' && (
      <button onClick={clearError}>Dismiss</button>
    )}
  </div>
)}
```

### 10.3 Session Timeout Warnings

**Countdown Warning**:
```typescript
// Show warning 5 minutes before expiry
useEffect(() => {
  if (!sessionExpiresAt) return

  const warnBeforeMs = 5 * 60 * 1000 // 5 minutes
  const timeUntilWarning = sessionExpiresAt.getTime() - Date.now() - warnBeforeMs

  if (timeUntilWarning > 0) {
    const timeoutId = setTimeout(() => {
      showNotification(
        'Your session will expire in 5 minutes. Save your work.',
        { type: 'warning', duration: 60000 }
      )
    }, timeUntilWarning)

    return () => clearTimeout(timeoutId)
  }
}, [sessionExpiresAt])
```

### 10.4 Smooth Transitions

**Optimistic UI Updates**:
```typescript
const handleLogin = async (email: string, password: string) => {
  // Show loading state immediately
  setIsLoading(true)

  try {
    await login(email, password)
    // Success handled by context, UI updates automatically
  } catch (error) {
    // Error shown, loading cleared automatically
  }
}
```

**Skeleton Loading**:
```typescript
if (isLoading) {
  return (
    <div className="user-menu-skeleton">
      <div className="skeleton-avatar" />
      <div className="skeleton-text" />
    </div>
  )
}
```

### 10.5 Accessibility

**Keyboard Navigation**:
```typescript
<button
  onClick={handleLogin}
  disabled={isLoading}
  aria-label="Login to your account"
  aria-busy={isLoading}
>
  {isLoading ? 'Logging in...' : 'Login'}
</button>
```

**Screen Reader Announcements**:
```typescript
{error && (
  <div
    role="alert"
    aria-live="assertive"
    className="error-message"
  >
    {errorMessages[error.code] || error.message}
  </div>
)}
```

**Focus Management**:
```typescript
useEffect(() => {
  if (error) {
    // Focus error message for screen readers
    errorRef.current?.focus()
  }
}, [error])
```

---

## Appendix A: Security Checklist

- [ ] httpOnly cookies for access_token and refresh_token
- [ ] SameSite=Strict for all auth cookies
- [ ] Secure=true for all auth cookies (HTTPS only)
- [ ] CSRF token validation on all mutations
- [ ] Token expiration enforced (1 hour access, 7 days refresh)
- [ ] Automatic token refresh before expiry
- [ ] Rate limiting on auth endpoints
- [ ] Origin/Referer validation on sensitive endpoints
- [ ] No tokens in localStorage/sessionStorage
- [ ] No tokens in URL parameters
- [ ] No tokens in console logs (production)
- [ ] Content Security Policy headers
- [ ] XSS prevention (DOMPurify for user content)
- [ ] Input validation on all API endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] Session invalidation on logout
- [ ] Audit logging for admin actions

---

## Appendix B: Performance Benchmarks

**Target Metrics**:
- Initial session detection: < 200ms
- Login flow: < 1 second (excluding network)
- Token refresh: < 300ms (background)
- Component state save: < 100ms (debounced)
- Component state load: < 200ms (on mount)

**Monitoring**:
```typescript
// Add performance monitoring
const loginStart = performance.now()
await login(email, password)
const loginTime = performance.now() - loginStart
logger.info('Login completed', { duration: loginTime })

// Track metrics
window.performance.mark('auth-start')
// ... auth flow
window.performance.mark('auth-end')
window.performance.measure('auth-flow', 'auth-start', 'auth-end')
```

---

## Appendix C: Migration Checklist

### Week 1: Parallel Systems
- [ ] Deploy new hooks (useSecureAuth, useCsrfToken, useServerComponentState)
- [ ] Deploy API client (apiClient.ts)
- [ ] Deploy cookie utilities (cookieUtils.ts)
- [ ] Add feature flags (VITE_FEATURE_SECURE_AUTH, VITE_FEATURE_SERVER_STATE)
- [ ] Feature flags OFF by default
- [ ] Run regression tests
- [ ] Verify no existing functionality broken

### Week 2: Authentication Migration
- [ ] Enable secure auth for 5% of users
- [ ] Monitor error rates and session persistence
- [ ] Verify login/logout flows
- [ ] Enable for 25% of users
- [ ] Enable for 50% of users
- [ ] Enable for 75% of users

### Week 3: Admin & State Migration
- [ ] Update AdminContext to use /api/auth/admin/verify
- [ ] Migrate component state to useServerComponentState
- [ ] Enable for 100% of users
- [ ] Monitor for 48 hours

### Week 4: Cleanup
- [ ] Remove old useAuth hook
- [ ] Remove localStorage auth code
- [ ] Remove feature flags
- [ ] Update documentation
- [ ] Update tests
- [ ] Final verification

---

## Appendix D: API Endpoint Reference

### Authentication Endpoints

**POST /api/auth/session** - Login
- Request: `{ email: string, password: string }`
- Response: `{ success: boolean, user: User, expiresAt: number }`
- Sets cookies: `access_token`, `refresh_token`, `csrf-token`

**DELETE /api/auth/session** - Logout
- Request: None
- Response: `{ success: boolean }`
- Clears cookies: `access_token`, `refresh_token`, `csrf-token`

**POST /api/auth/refresh** - Refresh Token
- Request: None (uses refresh_token cookie)
- Response: `{ success: boolean, expiresAt: number }`
- Updates cookie: `access_token`

**POST /api/auth/admin/verify** - Verify Admin Status
- Request: None (uses access_token cookie)
- Response: `{ isAdmin: boolean, isSuperAdmin: boolean, capabilities: string[] }`
- Requires: Valid admin user session

### Component State Endpoints

**GET /api/user/component-state?componentKey=X** - Load State
- Request: Query param `componentKey`
- Response: `{ state: any, updatedAt: string }`
- Requires: Authentication

**POST /api/user/component-state** - Save State
- Request: `{ componentKey: string, state: any, encrypted?: boolean, expiresIn?: number }`
- Response: `{ success: boolean, updatedAt: string }`
- Requires: Authentication, CSRF token

**DELETE /api/user/component-state?componentKey=X** - Clear State
- Request: Query param `componentKey`
- Response: `{ success: boolean }`
- Requires: Authentication, CSRF token

---

## Document Change Log

**Version 1.0.0** (2025-10-01)
- Initial architecture specification
- Complete hook implementations
- API client design
- Migration guide
- Testing strategy
- Performance benchmarks

---

**End of Document**
