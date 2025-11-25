import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, getProfileService } from '../lib/supabase'
import { DatabaseService } from '../lib/database'
import { User, AuthUser, Project } from '../types'
import { logger } from '../utils/logger'
import { authPerformanceMonitor } from '../utils/authPerformanceMonitor'
import { ensureUUID, isDemoUUID } from '../utils/uuid'
import { SUPABASE_STORAGE_KEY, TIMEOUTS, CACHE_DURATIONS } from '../lib/config'
import { withTimeout } from '../utils/promiseUtils'
import { CacheManager } from '../services/CacheManager'

interface UseAuthReturn {
  currentUser: User | null
  authUser: AuthUser | null
  isLoading: boolean
  handleAuthSuccess: (authUser: any) => Promise<void>
  handleLogout: () => Promise<void>
  setCurrentUser: (user: User | null) => void
  setIsLoading: (loading: boolean) => void
  authenticatedClient: any | null  // Always null now - main supabase client used for all operations
}

interface UseAuthOptions {
  onProjectsCheck?: (userId: string, isDemoUser?: boolean) => Promise<void>
  setCurrentProject?: (project: Project | null) => void
  setIdeas?: (ideas: any[]) => void
  setCurrentPage?: (page: string) => void
}

// PERFORMANCE OPTIMIZED: Lazy-initialized singleton to prevent multiple GoTrueClient instances
// ProfileService singleton is now in supabase.ts and imported via getProfileService()
let sessionCacheInstance: CacheManager<any> | null = null

function getSessionCache(): CacheManager<any> {
  if (!sessionCacheInstance) {
    sessionCacheInstance = new CacheManager<any>(CACHE_DURATIONS.SESSION)
  }
  return sessionCacheInstance
}

export const useAuth = (options: UseAuthOptions = {}): UseAuthReturn => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const abortControllerRef = useRef<AbortController | null>(null)

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
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.PROJECT_CHECK)

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
      } catch (_error) {
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
        expires: Date.now() + CACHE_DURATIONS.PROJECT_EXISTENCE
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
    } catch (_error) {
      const checkTime = performance.now() - checkStart
      logger.error('❌ Error checking user projects:', error, `(${checkTime.toFixed(1)}ms)`)
      // Don't override page even on error - preserve URL sharing
      logger.debug('📍 Not setting page to matrix on error to preserve URL sharing')
    }
  }

  // Optimized user profile fetching using ProfileService
  const getCachedUserProfile = async (userId: string, userEmail: string): Promise<User> => {
    return getProfileService().getProfile(userId, userEmail)
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
        const profileTimeout = setTimeout(() => {
          logger.debug(`⏰ Profile fetch timeout after ${TIMEOUTS.PROFILE_FETCH}ms (refresh: ${isRefreshScenario})`)
          profileController.abort()
        }, TIMEOUTS.PROFILE_FETCH)

        const projectTimeout = setTimeout(() => {
          logger.debug(`⏰ Project check timeout after ${TIMEOUTS.PROJECT_CHECK}ms (refresh: ${isRefreshScenario})`)
          projectController.abort()
        }, TIMEOUTS.PROJECT_CHECK)

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
      
    } catch (_error) {
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
    getProfileService().clearCache()
    getSessionCache().clear()

    // CRITICAL FIX: Clear server-side caches via API call
    // Using localStorage token read to avoid getSession() timeout
    try {
      const stored = localStorage.getItem(SUPABASE_STORAGE_KEY)
      let token: string | null = null

      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          token = parsed.access_token
        } catch (_error) {
          logger.error('Error parsing localStorage for cache clearing:', error)
        }
      }

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
    } catch (_error) {
      logger.warn('⚠️ Error clearing server-side caches (continuing anyway):', error)
    }

    // CRITICAL FIX: Clear legacy localStorage entries
    try {
      localStorage.removeItem('prioritasUser')
      localStorage.removeItem('prioritasUserJoinDate')
      logger.debug('🧹 Cleared legacy localStorage entries')
    } catch (_error) {
      logger.debug('Could not clear legacy localStorage:', error)
    }

    // Process ALL users immediately to prevent UI race conditions
    try {
      await handleAuthUser(authUser)
      logger.debug('✅ User processed successfully through onAuthSuccess callback')
    } catch (_error) {
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
      getProfileService().clearCache()
      getSessionCache().clear()

      // CRITICAL FIX: Clear server-side caches via API call (before signing out)
      // Using localStorage token read to avoid getSession() timeout
      try {
        const stored = localStorage.getItem(SUPABASE_STORAGE_KEY)
        let token: string | null = null

        if (stored) {
          try {
            const parsed = JSON.parse(stored)
            token = parsed.access_token
          } catch (_error) {
            logger.error('Error parsing localStorage for logout cache clearing:', error)
          }
        }

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
      } catch (_error) {
        logger.warn('⚠️ Error clearing server-side caches on logout (continuing anyway):', error)
      }

      // Clear legacy localStorage entries
      localStorage.removeItem('prioritasUser')
      localStorage.removeItem('prioritasUserJoinDate')

      await supabase.auth.signOut()
      // The auth state change listener will handle the rest
    } catch (_error) {
      logger.error('Error logging out:', error)
      // Fallback: clear state manually
      setCurrentUser(null)
      setAuthUser(null)
      setCurrentProject?.(null)
      setIdeas?.([])

      // CRITICAL FIX: Clear all caches even in fallback scenario
      getProfileService().clearCache()
      getSessionCache().clear()

      // Clear legacy localStorage entries
      localStorage.removeItem('prioritasUser')
      localStorage.removeItem('prioritasUserJoinDate')

      // Don't set page to matrix on logout - preserve URL sharing
      logger.debug('📍 Not setting page to matrix on logout to preserve URL sharing')
    }
  }, [setCurrentProject, setIdeas])

  // Initialize Supabase auth - ROBUST PATTERN with guaranteed completion
  useEffect(() => {
    logger.debug('🔄 useAuth useEffect STARTING - robust auth pattern with guaranteed completion')
    let mounted = true
    authPerformanceMonitor.startSession()

    // ROBUST PATTERN: Guaranteed completion with multiple fallback layers
    const initAuth = async () => {
      // CRITICAL FIX: Absolute maximum time for entire auth initialization
      // This guarantees the loading screen will NEVER hang indefinitely
      const MAX_AUTH_INIT_TIME = 5000 // 5 seconds absolute maximum

      const authInitTimeout = setTimeout(() => {
        if (mounted) {
          logger.warn('⚠️ AUTH INIT TIMEOUT: Forcing completion after 5 seconds')
          // Try localStorage fallback one final time
          try {
            const stored = localStorage.getItem(SUPABASE_STORAGE_KEY)
            if (stored) {
              const parsed = JSON.parse(stored)
              if (parsed.user) {
                const emergencyUser: User = {
                  id: ensureUUID(parsed.user.id),
                  email: parsed.user.email,
                  full_name: parsed.user.user_metadata?.full_name || parsed.user.email,
                  avatar_url: parsed.user.user_metadata?.avatar_url || null,
                  role: parsed.user.user_metadata?.role || 'user',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }
                setCurrentUser(emergencyUser)
                setAuthUser(parsed.user)
                logger.debug('✅ Emergency timeout fallback: user restored from localStorage')
              }
            }
          } catch (e) {
            logger.debug('Emergency timeout: no valid localStorage session')
          }
          setIsLoading(false)
          authPerformanceMonitor.finishSession('timeout')
        }
      }, MAX_AUTH_INIT_TIME)

      try {
        // STEP 1: Get current session with timeout
        // CRITICAL FIX: Add timeout to getSession() as it hangs on refresh
        const { data: { session }, error } = await withTimeout(
          supabase.auth.getSession(),
          TIMEOUTS.AUTH_GET_SESSION,
          'getSession() timeout'
        )
        logger.debug('🔐 Session check:', { hasSession: !!session, hasError: !!error })

        if (error) {
          logger.error('Session error detected:', error)
          // Don't await signOut - it can also hang
          supabase.auth.signOut().catch(() => {})
        }

        if (session?.user) {
          // CRITICAL FIX: Skip the verification call that can hang
          // The session we got is already valid - no need to call getSession() again
          logger.debug('🔐 Session found, skipping redundant verification')
        }

        if (mounted) {
          clearTimeout(authInitTimeout) // Clear emergency timeout - we completed normally
          if (session?.user) {
            logger.debug('Processing authenticated user:', session.user.email)
            await handleAuthUser(session.user)
          } else {
            setIsLoading(false)
          }
          authPerformanceMonitor.finishSession('success')
        }
      } catch (initError) {
        // CRITICAL FIX: If getSession() timed out, read localStorage directly as fallback
        const error = initError as Error
        if (error?.message?.includes('getSession() timeout')) {
          logger.debug('getSession() timed out, reading session from localStorage directly')

          try {
            const stored = localStorage.getItem(SUPABASE_STORAGE_KEY)

            if (stored) {
              const parsed = JSON.parse(stored)
              logger.debug('Found session in localStorage:', { email: parsed.user?.email })

              if (parsed.user && mounted) {
                // EMERGENCY FIX v3: Don't call handleAuthUser - it calls getSession() again = infinite loop!
                // Create basic user from localStorage WITHOUT calling ProfileService
                // Accept degraded experience (basic user, no full profile) over infinite loading
                logger.debug('⚠️ getSession() timed out - creating fallback user from localStorage')

                const fallbackUser: User = {
                  id: ensureUUID(parsed.user.id),
                  email: parsed.user.email,
                  full_name: parsed.user.user_metadata?.full_name || parsed.user.email,
                  avatar_url: parsed.user.user_metadata?.avatar_url || null,
                  role: parsed.user.user_metadata?.role || 'user',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }

                clearTimeout(authInitTimeout) // Clear emergency timeout
                setCurrentUser(fallbackUser)
                setAuthUser(parsed.user)
                setIsLoading(false)
                logger.debug('✅ Fallback auth completed (degraded mode - basic user only)')
                return
              }
            }

            if (mounted) {
              clearTimeout(authInitTimeout) // Clear emergency timeout
              setIsLoading(false)
            }
            return
          } catch (storageError) {
            logger.error('Error reading localStorage:', storageError)
            if (mounted) {
              clearTimeout(authInitTimeout) // Clear emergency timeout
              setIsLoading(false)
            }
            return
          }
        }

        logger.error('💥 Error initializing auth:', error)
        if (mounted) {
          clearTimeout(authInitTimeout) // Clear emergency timeout
          setIsLoading(false)
          authPerformanceMonitor.finishSession('error')
        }
      }
    }

    initAuth()

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
    setIsLoading,
    authenticatedClient: null  // No longer creating second client - main supabase client handles everything
  }
}