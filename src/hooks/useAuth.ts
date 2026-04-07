import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, getProfileService } from '../lib/supabase'
import { DatabaseService } from '../lib/database'
import { User, UserRole, AuthUser, Project, IdeaCard } from '../types'
import { logger } from '../utils/logger'
import { authPerformanceMonitor } from '../utils/authPerformanceMonitor'
import { ensureUUID, isDemoUUID } from '../utils/uuid'
import { SUPABASE_STORAGE_KEY, TIMEOUTS, CACHE_DURATIONS } from '../lib/config'
import { withTimeout } from '../utils/promiseUtils'
import { CacheManager } from '../services/CacheManager'

/**
 * Extended AuthUser type that includes optional demo user flag
 * Used internally by useAuth for handling demo users
 */
type AuthUserWithDemo = AuthUser & { isDemoUser?: boolean }

interface UseAuthReturn {
  currentUser: User | null
  authUser: AuthUser | null
  isLoading: boolean
  isPasswordRecovery: boolean
  handleAuthSuccess: (authUser: AuthUserWithDemo) => Promise<void>
  handleLogout: () => Promise<void>
  setCurrentUser: (user: User | null) => void
  setIsLoading: (loading: boolean) => void
  clearPasswordRecovery: () => void
  authenticatedClient: null  // Always null now - main supabase client used for all operations
}

interface UseAuthOptions {
  onProjectsCheck?: (userId: string, isDemoUser?: boolean) => Promise<void>
  setCurrentProject?: (project: Project | null) => void
  setIdeas?: (ideas: IdeaCard[]) => void
  setCurrentPage?: (page: string) => void
}

// PERFORMANCE OPTIMIZED: Lazy-initialized singleton to prevent multiple GoTrueClient instances
// ProfileService singleton is now in supabase.ts and imported via getProfileService()
let sessionCacheInstance: CacheManager<unknown> | null = null

function getSessionCache(): CacheManager<unknown> {
  if (!sessionCacheInstance) {
    sessionCacheInstance = new CacheManager<unknown>(CACHE_DURATIONS.SESSION)
  }
  return sessionCacheInstance
}

export const useAuth = (options: UseAuthOptions = {}): UseAuthReturn => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // CRITICAL FIX: Store latest handleAuthSuccess ref so listener always calls current version
  const handleAuthSuccessRef = useRef<((authUser: AuthUserWithDemo) => Promise<void>) | null>(null)

  const { setCurrentProject, setIdeas } = options

  // Standard auth user handler: query DB profile, set React state.
  // Called by the onAuthStateChange listener (SIGNED_IN) and getSession() on mount.
  const handleAuthUser = useCallback(async (authUser: AuthUserWithDemo) => {
    logger.debug('🔐 handleAuthUser:', authUser.email)
    try {
      // Demo users get a client-side synthesised profile
      if (authUser.isDemoUser || isDemoUUID(authUser.id)) {
        let role: UserRole = 'user'
        if (authUser.email === 'admin@prioritas.com') role = 'super_admin'
        else if (authUser.email === 'manager@company.com') role = 'admin'

        setCurrentUser({
          id: ensureUUID(authUser.id),
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name || authUser.email,
          role,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        setAuthUser(authUser)
        return
      }

      // After signInWithPassword() the Supabase client is authenticated; after
      // getSession() on mount the session is already restored. Either way this
      // query runs with the correct JWT and is subject to RLS.
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, avatar_url, role, created_at, updated_at')
        .eq('id', authUser.id)
        .single()

      const user: User = (profile as User | null) ?? {
        id: ensureUUID(authUser.id),
        email: authUser.email,
        full_name: authUser.user_metadata?.full_name || authUser.email,
        role: 'user' as UserRole,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      logger.debug('👤 User resolved:', { id: user.id, role: user.role })
      setCurrentUser(user)
      setAuthUser(authUser)
    } catch (err) {
      logger.error('💥 handleAuthUser error, using JWT fallback:', err)
      setCurrentUser({
        id: ensureUUID(authUser?.id || null),
        email: authUser?.email || '',
        full_name: authUser?.user_metadata?.full_name || authUser?.email || '',
        role: 'user' as UserRole,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      setAuthUser(authUser)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // handleAuthSuccess is kept for interface compatibility (UserContext, AuthMigration).
  // With the standard Supabase login flow, auth state is managed by onAuthStateChange;
  // this function is only invoked for non-standard flows (demo users, legacy callbacks).
  const handleAuthSuccess = useCallback(async (authUser: AuthUserWithDemo) => {
    await handleAuthUser(authUser)
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
          } catch (error) {
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
            await handleAuthUser(session.user as unknown as AuthUserWithDemo)
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
          await handleAuthSuccessRef.current(session.user as unknown as AuthUserWithDemo)
        }
      } else if (event === 'SIGNED_OUT') {
        logger.debug('🚪 SIGNED_OUT event')
        setAuthUser(null)
        setCurrentUser(null)
        setCurrentProject?.(null)
        setIdeas?.([])
        localStorage.removeItem('prioritasUser')
        setIsLoading(false)
      } else if (event === 'PASSWORD_RECOVERY') {
        logger.debug('🔑 PASSWORD_RECOVERY event — showing reset form')
        setIsPasswordRecovery(true)
        setIsLoading(false)
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        logger.debug('🔄 TOKEN_REFRESHED event')
        // Session is already updated in client, just ensure React state is current
        if (!currentUser && handleAuthSuccessRef.current) {
          await handleAuthSuccessRef.current(session.user as unknown as AuthUserWithDemo)
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
    isPasswordRecovery,
    handleAuthSuccess,
    handleLogout,
    setCurrentUser,
    setIsLoading,
    clearPasswordRecovery: () => setIsPasswordRecovery(false),
    authenticatedClient: null  // No longer creating second client - main supabase client handles everything
  }
}