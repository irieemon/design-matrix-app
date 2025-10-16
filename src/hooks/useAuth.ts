import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { DatabaseService } from '../lib/database'
import { User, AuthUser, Project } from '../types'
import { logger } from '../utils/logger'
import { authPerformanceMonitor } from '../utils/authPerformanceMonitor'
import { ensureUUID, isDemoUUID } from '../utils/uuid'

interface UseAuthReturn {
  currentUser: User | null
  authUser: AuthUser | null
  isLoading: boolean
  handleAuthSuccess: (authUser: any) => Promise<void>
  handleLogout: () => Promise<void>
  setCurrentUser: (user: User | null) => void
  setIsLoading: (loading: boolean) => void
}

interface UseAuthOptions {
  onProjectsCheck?: (userId: string, isDemoUser?: boolean) => Promise<void>
  setCurrentProject?: (project: Project | null) => void
  setIdeas?: (ideas: any[]) => void
  setCurrentPage?: (page: string) => void
}

// PERFORMANCE OPTIMIZED: Aggressive caching for auth data
const userProfileCache = new Map<string, { user: User; timestamp: number; expires: number }>()
const CACHE_DURATION = 10 * 60 * 1000 // Extended to 10 minutes for better performance
const pendingRequests = new Map<string, Promise<User>>()
// Session cache for faster repeat authentications
const sessionCache = new Map<string, { session: any; timestamp: number; expires: number }>()
const SESSION_CACHE_DURATION = 2 * 60 * 1000 // 2 minutes session caching

// PERFORMANCE OPTIMIZED: Clean up all auth caches periodically
setInterval(() => {
  const now = Date.now()
  let cleaned = 0

  // Clean user profile cache
  for (const [key, cached] of userProfileCache.entries()) {
    if (now > cached.expires) {
      userProfileCache.delete(key)
      cleaned++
    }
  }

  // Clean session cache
  for (const [key, cached] of sessionCache.entries()) {
    if (now > cached.expires) {
      sessionCache.delete(key)
      cleaned++
    }
  }

  if (cleaned > 0) {
    logger.debug(`🧹 Cleaned ${cleaned} expired auth cache entries`)
  }
}, 30000) // Clean up every 30 seconds for better memory management

export const useAuth = (options: UseAuthOptions = {}): UseAuthReturn => {
  // DIAGNOSTIC: Log that useAuth hook is being called
  console.log('🔍 useAuth: Hook called at', new Date().toISOString())

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  console.log('🔍 useAuth: Initial state -', { currentUser, authUser, isLoading })

  // CRITICAL FIX: Store latest handleAuthSuccess ref so listener always calls current version
  const handleAuthSuccessRef = useRef<((authUser: any) => Promise<void>) | null>(null)

  const { onProjectsCheck, setCurrentProject, setIdeas } = options

  // OPTIMIZED: Simple refresh detection without blocking auth
  const isRefreshScenario = (() => {
    // Synchronous detection at initialization
    const urlParams = new URLSearchParams(window.location.search)
    return urlParams.has('project') && !!urlParams.get('project')
  })

  // PERFORMANCE OPTIMIZED: Extended project cache for reduced DB calls
  const projectExistenceCache = useRef(new Map<string, { exists: boolean; timestamp: number; expires: number }>())
  const PROJECT_CACHE_DURATION = 5 * 60 * 1000 // Extended to 5 minutes

  // Optimized project check with aggressive caching and minimal data fetching
  const checkUserProjectsAndRedirect = async (userId: string, isDemoUser = false) => {
    const checkStart = performance.now()

    if (onProjectsCheck) {
      await onProjectsCheck(userId, isDemoUser)
      return
    }

    try {
      logger.debug('📋 Checking if user has existing projects...')

      // For demo users, skip database calls and preserve current page
      if (isDemoUser || isDemoUUID(userId)) {
        logger.debug('🎭 Demo user detected, skipping database check and preserving current page for URL sharing')
        return
      }

      // Check cache first
      const cached = projectExistenceCache.current.get(userId)
      if (cached && Date.now() < cached.expires) {
        const checkTime = performance.now() - checkStart
        authPerformanceMonitor.recordProjectCheck(checkTime)
        logger.debug('🎯 Using cached project existence:', { exists: cached.exists, age: Date.now() - cached.timestamp })
        return
      }

      // Optimized query: just check count, use abort signal for faster timeout
      const controller = new AbortController()
      // PERFORMANCE OPTIMIZED: Generous timeout to allow project check completion
      const timeoutMs = 10000  // Increased to 10s for reliable completion
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      const projectExistsPromise = supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
        .limit(1)
        .abortSignal(controller.signal)

      let result
      try {
        result = await projectExistsPromise
        clearTimeout(timeoutId)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          logger.debug('⏰ Project check timeout, assuming no projects')
          result = { count: 0 }
        } else {
          throw error
        }
      }
      const checkTime = performance.now() - checkStart
      authPerformanceMonitor.recordProjectCheck(checkTime)

      const hasProjects = !!(result?.count && result.count > 0)
      logger.debug('📋 User has', hasProjects ? 'existing' : 'no', 'projects', `(${checkTime.toFixed(1)}ms)`)

      // Cache the result
      projectExistenceCache.current.set(userId, {
        exists: hasProjects,
        timestamp: Date.now(),
        expires: Date.now() + PROJECT_CACHE_DURATION
      })

      if (hasProjects) {
        logger.debug('🎯 User has existing projects, but not redirecting during URL sharing')
        // Don't auto-redirect to projects page - this interferes with URL sharing
        // The user should stay on whatever page they're trying to access
        logger.debug('📍 Skipping auto-redirect to preserve URL sharing functionality')
      } else {
        logger.debug('📝 No existing projects found, but not overriding current page for URL sharing')
        // Don't set page to matrix - this interferes with URL sharing
        // The user should stay on whatever page they're trying to access
      }
    } catch (error) {
      const checkTime = performance.now() - checkStart
      logger.error('❌ Error checking user projects:', error, `(${checkTime.toFixed(1)}ms)`)
      // Don't override page even on error - preserve URL sharing
      logger.debug('📍 Not setting page to matrix on error to preserve URL sharing')
    }
  }

  // Optimized user profile fetching with aggressive caching and request deduplication
  const getCachedUserProfile = async (userId: string, userEmail: string): Promise<User> => {
    const cacheKey = `${userId}:${userEmail}`
    const now = Date.now()

    // Check cache first with longer duration for better performance
    const cached = userProfileCache.get(cacheKey)
    if (cached && now < cached.expires) {
      logger.debug('🎯 Using cached user profile:', { email: userEmail, age: now - cached.timestamp })
      return cached.user
    }

    // Check for pending request to avoid duplicates
    const pending = pendingRequests.get(cacheKey)
    if (pending) {
      logger.debug('⏳ Waiting for pending user profile request:', userEmail)
      return pending
    }

    // Create new request with aggressive timeout
    const profilePromise = (async (): Promise<User> => {
      try {
        const controller = new AbortController()
        abortControllerRef.current = controller

        // PERFORMANCE OPTIMIZED: Generous timeout to allow profile fetch completion
        const profileTimeoutMs = 10000  // Increased to 10s for reliable completion
        const timeoutId = setTimeout(() => controller.abort(), profileTimeoutMs)

        // Get token with caching to avoid repeated session calls
        let token = (await supabase.auth.getSession()).data.session?.access_token
        if (!token) {
          // Try to get session one more time before failing
          await new Promise(resolve => setTimeout(resolve, 50))
          token = (await supabase.auth.getSession()).data.session?.access_token
          if (!token) {
            throw new Error('No auth token available')
          }
        }

        const response = await fetch('/api/auth?action=user', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        // FIX #2: Handle 401/403 with token refresh
        if (response.status === 401 || response.status === 403) {
          logger.warn('⚠️ Token expired (401/403), attempting refresh...')

          // FIX #5: Don't clear session cache - just update it after successful refresh
          // Only clear the user profile cache since we're fetching fresh data
          userProfileCache.clear()

          try {
            // Force token refresh
            const { data, error } = await supabase.auth.refreshSession()

            if (error || !data.session) {
              logger.error('❌ Token refresh failed, forcing re-login:', error)
              // Only clear session cache on failure
              sessionCache.clear()
              throw new Error('Session expired, please log in again')
            }

            logger.debug('✅ Token refreshed successfully, retrying profile fetch')

            // FIX #5: Update session cache with fresh session
            const sessionCacheKey = 'current_session'
            sessionCache.set(sessionCacheKey, {
              session: data.session,
              timestamp: Date.now(),
              expires: Date.now() + SESSION_CACHE_DURATION
            })

            // Retry with fresh token
            const retryResponse = await fetch('/api/auth?action=user', {
              headers: {
                'Authorization': `Bearer ${data.session.access_token}`,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
              }
            })

            if (retryResponse.ok) {
              const { user } = await retryResponse.json()
              const userProfile: User = {
                id: user.id,
                email: user.email,
                full_name: user.full_name || user.email,
                avatar_url: user.avatar_url,
                role: user.role,
                created_at: user.created_at,
                updated_at: user.updated_at
              }

              // Cache the fresh profile
              userProfileCache.set(cacheKey, {
                user: userProfile,
                timestamp: now,
                expires: now + (CACHE_DURATION * 3)
              })

              return userProfile
            } else {
              throw new Error(`Profile fetch retry failed: ${retryResponse.status}`)
            }
          } catch (refreshError) {
            logger.error('❌ Token refresh process failed:', refreshError)
            // Clear all caches on complete failure
            sessionCache.clear()
            throw new Error('Authentication failed, please log in again')
          }
        }

        if (response.ok) {
          const { user } = await response.json()
          const userProfile: User = {
            id: user.id,
            email: user.email,
            full_name: user.full_name || user.email,
            avatar_url: user.avatar_url,
            role: user.role,
            created_at: user.created_at,
            updated_at: user.updated_at
          }

          // PERFORMANCE OPTIMIZED: Extended cache duration
          userProfileCache.set(cacheKey, {
            user: userProfile,
            timestamp: now,
            expires: now + (CACHE_DURATION * 3) // Triple cache duration for maximum performance
          })

          return userProfile
        } else {
          throw new Error(`Profile fetch failed: ${response.status}`)
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          logger.debug('🚫 User profile request aborted')
        } else {
          logger.error('❌ Error fetching user profile:', error)
        }
        throw error
      }
    })()

    // Store pending request
    pendingRequests.set(cacheKey, profilePromise)

    try {
      const result = await profilePromise
      return result
    } finally {
      // Clean up pending request
      pendingRequests.delete(cacheKey)
    }
  }

  // EMERGENCY FIX: Remove circular state dependency that caused 0% success rate
  // Direct state management without batching to restore auth functionality

  // Handle authenticated user with batched state updates to prevent flickering
  const handleAuthUser = useCallback(async (authUser: any) => {
    const authStart = performance.now()
    try {
      logger.debug('🔐 handleAuthUser called with:', authUser.email, authUser.id)

      // For demo users, use client-side fallback
      if (authUser.isDemoUser || isDemoUUID(authUser.id)) {
        // Demo user fallback with basic role assignment
        let userRole: 'user' | 'admin' | 'super_admin' = 'user'
        if (authUser.email === 'admin@prioritas.com') {
          userRole = 'super_admin'
        } else if (authUser.email === 'manager@company.com') {
          userRole = 'admin'
        }

        const fallbackUser = {
          id: ensureUUID(authUser.id),
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name || authUser.email,
          avatar_url: authUser.user_metadata?.avatar_url || null,
          role: userRole,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        logger.debug('🎭 Created demo user:', {
          id: fallbackUser.id,
          email: fallbackUser.email,
          role: fallbackUser.role
        })

        // EMERGENCY FIX: Direct state updates to restore auth functionality
        logger.debug('🔓 Setting demo user state - currentUser, authUser, isLoading=false')
        setCurrentUser(fallbackUser)
        setAuthUser(authUser)
        setIsLoading(false)
        logger.debug('✅ Demo user state set complete')
      } else {
        // For real users, get profile with caching and run project check in parallel
        const isDemoUser = authUser.isDemoUser || isDemoUUID(authUser.id)

          // Run profile fetch and project check in parallel with coordinated timeouts
        const profileController = new AbortController()
        const projectController = new AbortController()

        // PERFORMANCE OPTIMIZED: Generous timeouts to allow completion
        const profileTimeoutMs = 10000   // Increased to 10s to allow profile fetch completion
        const projectTimeoutMs = 10000    // Increased to 10s to allow project check completion

        const profileTimeout = setTimeout(() => {
          logger.debug(`⏰ Profile fetch timeout after ${profileTimeoutMs}ms (refresh: ${isRefreshScenario})`)
          profileController.abort()
        }, profileTimeoutMs)

        const projectTimeout = setTimeout(() => {
          logger.debug(`⏰ Project check timeout after ${projectTimeoutMs}ms (refresh: ${isRefreshScenario})`)
          projectController.abort()
        }, projectTimeoutMs)

        const [userProfileResult, projectCheckResult] = await Promise.allSettled([
          getCachedUserProfile(authUser.id, authUser.email).finally(() => clearTimeout(profileTimeout)),
          checkUserProjectsAndRedirect(authUser.id, isDemoUser).finally(() => clearTimeout(projectTimeout))
        ])

        // Log project check performance
        if (projectCheckResult.status === 'rejected') {
          logger.debug('📋 Project check failed/timeout:', projectCheckResult.reason)
        }

        if (userProfileResult.status === 'fulfilled') {
          const userProfile = userProfileResult.value
          logger.debug('👤 Got user profile:', {
            id: userProfile.id,
            email: userProfile.email,
            role: userProfile.role
          })
          // EMERGENCY FIX: Direct state updates
          setCurrentUser(userProfile)
          setAuthUser(authUser)
          setIsLoading(false)
        } else {
          logger.error('❌ Error fetching user profile, using fallback:', userProfileResult.reason)
          // Fallback to basic user
          const fallbackUser = {
            id: ensureUUID(authUser.id),
            email: authUser.email,
            full_name: authUser.user_metadata?.full_name || authUser.email,
            avatar_url: authUser.user_metadata?.avatar_url || null,
            role: 'user' as const,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
          // EMERGENCY FIX: Direct state updates for fallback
          setCurrentUser(fallbackUser)
          setAuthUser(authUser)
          setIsLoading(false)
        }
      }
      
    } catch (error) {
      logger.error('💥 Error in handleAuthUser:', error)
      // EMERGENCY FIX: Direct state updates even for error fallback
      const errorFallbackUser = {
        id: ensureUUID(authUser?.id || null),
        email: authUser?.email || 'unknown@example.com',
        full_name: authUser?.email || 'Unknown User',
        role: 'user' as const, // Always default to 'user' for security
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      setCurrentUser(errorFallbackUser)
      setAuthUser(authUser)
      setIsLoading(false)
      
      // Try to check for projects even in error case
      if (authUser?.id) {
        const isDemoUser = authUser.isDemoUser || isDemoUUID(authUser.id)
        await checkUserProjectsAndRedirect(authUser.id, isDemoUser)
      } else {
        logger.debug('📍 Not setting page to matrix - preserving current page for URL sharing')
      }
    } finally {
      const authTime = performance.now() - authStart
      authPerformanceMonitor.recordUserProfileFetch(authTime)
      logger.debug('🔓 Auth processing complete', `auth time: ${authTime.toFixed(1)}ms`)
      authPerformanceMonitor.finishSession('success')
      // Loading state is now handled in the batched updates above
    }
  }, [isRefreshScenario, checkUserProjectsAndRedirect, getCachedUserProfile])

  const handleAuthSuccess = useCallback(async (authUser: any) => {
    logger.debug('🎉 Authentication successful:', authUser.email, 'ID:', authUser.id)

    // CRITICAL FIX: Clear all caches (frontend + server) on authentication success to prevent stale data
    logger.debug('🧹 Clearing all user caches to prevent stale user data')

    // Clear frontend caches
    userProfileCache.clear()
    pendingRequests.clear()
    sessionCache.clear()

    // CRITICAL FIX: Clear server-side caches via API call
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (token) {
        logger.debug('🧹 Clearing server-side caches...')
        const response = await fetch('/api/auth?action=clear-cache', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const result = await response.json()
          logger.debug('✅ Server-side caches cleared:', result.cleared)
        } else {
          logger.warn('⚠️ Failed to clear server-side caches (continuing anyway):', response.status)
        }
      } else {
        logger.warn('⚠️ No auth token available for server cache clearing')
      }
    } catch (error) {
      logger.warn('⚠️ Error clearing server-side caches (continuing anyway):', error)
    }

    // CRITICAL FIX: Clear legacy localStorage entries
    try {
      localStorage.removeItem('prioritasUser')
      localStorage.removeItem('prioritasUserJoinDate')
      logger.debug('🧹 Cleared legacy localStorage entries')
    } catch (error) {
      logger.debug('Could not clear legacy localStorage:', error)
    }

    // Process ALL users immediately to prevent UI race conditions
    try {
      await handleAuthUser(authUser)
      logger.debug('✅ User processed successfully through onAuthSuccess callback')
    } catch (error) {
      logger.error('❌ Error processing user in onAuthSuccess callback:', error)
    }
  }, [handleAuthUser])

  // CRITICAL FIX: Update ref whenever handleAuthSuccess changes
  // This ensures the listener always calls the latest version
  useEffect(() => {
    handleAuthSuccessRef.current = handleAuthSuccess
  }, [handleAuthSuccess])

  const handleLogout = useCallback(async () => {
    try {
      logger.debug('🚪 Logging out...')

      // CRITICAL FIX: Clear all caches (frontend + server) on logout to prevent user data leaks
      logger.debug('🧹 Clearing all user caches on logout')
      userProfileCache.clear()
      pendingRequests.clear()
      sessionCache.clear()

      // CRITICAL FIX: Clear server-side caches via API call (before signing out)
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token
        if (token) {
          logger.debug('🧹 Clearing server-side caches on logout...')
          const response = await fetch('/api/auth?action=clear-cache', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })

          if (response.ok) {
            const result = await response.json()
            logger.debug('✅ Server-side caches cleared on logout:', result.cleared)
          } else {
            logger.warn('⚠️ Failed to clear server-side caches on logout (continuing anyway):', response.status)
          }
        } else {
          logger.debug('⚠️ No auth token available for server cache clearing on logout')
        }
      } catch (error) {
        logger.warn('⚠️ Error clearing server-side caches on logout (continuing anyway):', error)
      }

      // Clear legacy localStorage entries
      localStorage.removeItem('prioritasUser')
      localStorage.removeItem('prioritasUserJoinDate')

      await supabase.auth.signOut()
      // The auth state change listener will handle the rest
    } catch (error) {
      logger.error('Error logging out:', error)
      // Fallback: clear state manually
      setCurrentUser(null)
      setAuthUser(null)
      setCurrentProject?.(null)
      setIdeas?.([])

      // CRITICAL FIX: Clear all caches even in fallback scenario
      userProfileCache.clear()
      pendingRequests.clear()
      sessionCache.clear()

      // Clear legacy localStorage entries
      localStorage.removeItem('prioritasUser')
      localStorage.removeItem('prioritasUserJoinDate')

      // Don't set page to matrix on logout - preserve URL sharing
      logger.debug('📍 Not setting page to matrix on logout to preserve URL sharing')
    }
  }, [setCurrentProject, setIdeas])

  // DIAGNOSTIC: Log before useEffect
  console.log('🔍 useAuth: About to register useEffect (this should appear on every render)')

  // Initialize Supabase auth - STANDARD PATTERN
  useEffect(() => {
    console.log('🔍 useAuth useEffect: CALLBACK EXECUTING - this should appear ONCE on mount')

    try {
      logger.debug('🔄 useAuth useEffect STARTING - standard Supabase auth pattern')
    } catch (logError) {
      console.error('🚨 LOGGER.DEBUG FAILED:', logError)
    }

    let mounted = true

    try {
      authPerformanceMonitor.startSession()
    } catch (perfError) {
      console.error('🚨 AUTH PERFORMANCE MONITOR FAILED:', perfError)
    }

    console.log('🔍 useAuth useEffect: Continuing after logger/perf monitor - about to define initAuth')

    // STANDARD PATTERN: Simple initialization
    const initAuth = async () => {
      console.log('🔍 initAuth: FUNCTION EXECUTING')
      try {
        // STEP 1: Get current session (reads from localStorage, no network request)
        console.log('🔍 initAuth: About to call getSession()')

        // CRITICAL FIX: Add timeout to getSession() as it hangs on refresh
        const getSessionWithTimeout = Promise.race([
          supabase.auth.getSession(),
          new Promise<{ data: { session: null }, error: any }>((_, reject) =>
            setTimeout(() => reject(new Error('getSession() timeout after 2 seconds')), 2000)
          )
        ])

        const { data: { session }, error } = await getSessionWithTimeout
        console.log('🔍 initAuth: getSession() completed', { hasSession: !!session, hasError: !!error, userEmail: session?.user?.email })

        if (error) {
          console.error('🔍 initAuth: Session error detected:', error)
          await supabase.auth.signOut()
        }

        if (session?.user) {
          console.log('🔍 initAuth: Session exists, starting propagation delay...')
          // CRITICAL: Wait for session to propagate to client's internal auth state
          // This ensures RLS (Row Level Security) can access auth.uid() for database queries
          await new Promise(resolve => setTimeout(resolve, 150))
          console.log('🔍 initAuth: Propagation delay complete')

          // Verify propagation
          const verifySession = await supabase.auth.getSession()
          console.log('🔍 initAuth: Session propagation verified:', {
            hasSession: !!verifySession.data.session,
            userId: verifySession.data.session?.user?.id
          })
        } else {
          console.log('🔍 initAuth: No session found')
        }

        console.log('🔍 initAuth: Checking mounted flag:', mounted)
        if (mounted) {
          if (session?.user) {
            console.log('🔍 initAuth: About to call handleAuthUser()', session.user.email)
            await handleAuthUser(session.user)
            console.log('🔍 initAuth: handleAuthUser() completed')
          } else {
            console.log('🔍 initAuth: No session, setting isLoading to false')
            setIsLoading(false)
          }
          authPerformanceMonitor.finishSession('success')
          console.log('🔍 initAuth: Finished successfully')
        } else {
          console.log('🔍 initAuth: Component unmounted, skipping auth processing')
        }
      } catch (error) {
        console.error('🔍 initAuth: ERROR caught:', error)

        // CRITICAL FIX: If getSession() timed out, read localStorage directly as fallback
        if (error instanceof Error && error.message.includes('getSession() timeout')) {
          console.log('🔍 initAuth: getSession() timed out, reading session from localStorage directly')

          try {
            const storageKey = 'sb-vfovtgtjailvrphsgafv-auth-token'
            const stored = localStorage.getItem(storageKey)

            if (stored) {
              const parsed = JSON.parse(stored)
              console.log('🔍 initAuth: Found session in localStorage:', {
                hasUser: !!parsed.user,
                email: parsed.user?.email,
                expiresAt: parsed.expires_at
              })

              if (parsed.user && mounted) {
                console.log('🔍 initAuth: Processing user from localStorage fallback')

                // CRITICAL FIX: Load session into Supabase client using setSession()
                // This is needed so database queries can access auth.uid() for RLS
                console.log('🔍 initAuth: Loading session into Supabase client with setSession()')

                try {
                  // Add timeout to setSession() as well, in case it also hangs
                  const setSessionWithTimeout = Promise.race([
                    supabase.auth.setSession({
                      access_token: parsed.access_token,
                      refresh_token: parsed.refresh_token
                    }),
                    new Promise<{ data: any, error: any }>((_, reject) =>
                      setTimeout(() => reject(new Error('setSession() timeout after 2 seconds')), 2000)
                    )
                  ])

                  const { data, error: sessionError } = await setSessionWithTimeout

                  if (sessionError) {
                    console.error('🔍 initAuth: setSession() error:', sessionError)
                    // Fall through to create user anyway
                  } else {
                    console.log('🔍 initAuth: Session loaded into client successfully')

                    // CRITICAL: Wait for session to propagate to client's internal auth state
                    console.log('🔍 initAuth: Waiting for session propagation...')
                    await new Promise(resolve => setTimeout(resolve, 150))
                    console.log('🔍 initAuth: Session propagation complete')
                  }
                } catch (setSessionError) {
                  console.error('🔍 initAuth: setSession() threw error (continuing anyway):', setSessionError)
                  // Fall through to create user anyway - better to have React state than nothing
                }

                // CRITICAL FIX: Don't call handleAuthUser which will try to fetch profile (calls getSession again!)
                // Instead, create a basic user from localStorage and set state directly
                console.log('🔍 initAuth: Creating user from localStorage (skipping profile fetch to avoid getSession hang)')

                const fallbackUser = {
                  id: ensureUUID(parsed.user.id),
                  email: parsed.user.email,
                  full_name: parsed.user.user_metadata?.full_name || parsed.user.email,
                  avatar_url: parsed.user.user_metadata?.avatar_url || null,
                  role: 'user' as const,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }

                console.log('🔍 initAuth: Setting user state directly from localStorage')
                setCurrentUser(fallbackUser)
                setAuthUser(parsed.user)
                setIsLoading(false)
                console.log('🔍 initAuth: Fallback auth completed')
                return
              }
            }

            console.log('🔍 initAuth: No valid session in localStorage, showing login')
            if (mounted) {
              setIsLoading(false)
            }
            return
          } catch (storageError) {
            console.error('🔍 initAuth: Error reading localStorage:', storageError)
            if (mounted) {
              setIsLoading(false)
            }
            return
          }
        }

        logger.error('💥 Error initializing auth:', error)
        if (mounted) {
          setIsLoading(false)
          authPerformanceMonitor.finishSession('error')
        }
      }
    }

    console.log('🔍 useAuth useEffect: About to call initAuth()')
    initAuth()
    console.log('🔍 useAuth useEffect: initAuth() called (async, will continue in background)')

    // STEP 2: Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      logger.debug('🔐 Auth state changed:', event, session?.user?.email)

      if (event === 'SIGNED_IN' && session?.user) {
        logger.debug('✅ SIGNED_IN event, processing user...')
        if (handleAuthSuccessRef.current) {
          await handleAuthSuccessRef.current(session.user)
        }
      } else if (event === 'SIGNED_OUT') {
        logger.debug('🚪 SIGNED_OUT event')
        setAuthUser(null)
        setCurrentUser(null)
        setCurrentProject?.(null)
        setIdeas?.([])
        localStorage.removeItem('prioritasUser')
        setIsLoading(false)
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        logger.debug('🔄 TOKEN_REFRESHED event')
        // Session is already updated in client, just ensure React state is current
        if (!currentUser && handleAuthSuccessRef.current) {
          await handleAuthSuccessRef.current(session.user)
        }
      }
    })

    // Clean up stale locks every 30 seconds
    const lockCleanupInterval = setInterval(() => {
      DatabaseService.cleanupStaleLocks()
    }, 30000)

    // STEP 3: Cleanup
    return () => {
      mounted = false
      subscription.unsubscribe()
      clearInterval(lockCleanupInterval)

      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, []) // Empty deps array - run once on mount

  return {
    currentUser,
    authUser,
    isLoading,
    handleAuthSuccess,
    handleLogout,
    setCurrentUser,
    setIsLoading
  }
}