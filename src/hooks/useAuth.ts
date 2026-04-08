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

// Module-level guard so React StrictMode's double-mount doesn't double-fire
// the recovery exchange (and consume the single-use code twice).
let recoveryExchangeStarted = false

// In-memory access token from a successful PKCE recovery exchange.
// Deliberately NOT written to localStorage — if it were, the main app would
// treat the user as signed-in and redirect to /projects, skipping the
// set-new-password form.
let recoveryAccessToken: string | null = null

// Module-level guard so we only attempt the CSRF bootstrap once per page load.
let csrfBootstrapped = false

/**
 * Mint the csrf-token cookie by calling /api/auth?action=user with the
 * localStorage access token. This endpoint is the canonical bootstrap call —
 * handleGetUser on the backend mints csrf-token if it's missing.
 *
 * Why this exists: the degraded-auth fallback path in initAuth (taken when
 * getSession() times out) skips ProfileService to avoid cascading getSession
 * calls, so the usual ProfileService → /api/auth?action=user → csrf-token
 * chain never runs. Without this, CSRF-protected endpoints (transcribe-audio,
 * analyze-image, etc.) 403 for returning users.
 */
async function bootstrapCsrfCookie() {
  if (csrfBootstrapped) return
  if (typeof document === 'undefined') return
  if (document.cookie.split(';').some(c => c.trim().startsWith('csrf-token='))) {
    csrfBootstrapped = true
    return
  }
  try {
    const stored = localStorage.getItem(SUPABASE_STORAGE_KEY)
    if (!stored) return
    const parsed = JSON.parse(stored)
    const token = parsed?.access_token
    if (!token) return
    csrfBootstrapped = true
    const response = await fetch('/api/auth?action=user', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    })
    if (!response.ok) {
      logger.warn('CSRF bootstrap /api/auth?action=user returned non-OK', { status: response.status })
      csrfBootstrapped = false
    }
  } catch (e) {
    logger.warn('CSRF bootstrap failed', e)
    csrfBootstrapped = false
  }
}

/**
 * Apply a new password using the in-memory recovery access token.
 * Called from AuthScreen's reset-password submit handler.
 *
 * Bypasses supabase.auth.updateUser() (which deadlocks on the GoTrueClient
 * lock) by hitting PUT /auth/v1/user directly.
 */
export async function updateRecoveryPassword(newPassword: string): Promise<{ error?: string }> {
  if (!recoveryAccessToken) {
    return { error: 'No active recovery session. Request a new reset email.' }
  }
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    return { error: 'Supabase is not configured.' }
  }
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${recoveryAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: newPassword })
    })
    if (!response.ok) {
      const body = await response.text()
      logger.error('updateRecoveryPassword failed', { status: response.status, body })
      try {
        const parsed = JSON.parse(body)
        return { error: parsed.msg || parsed.error_description || `HTTP ${response.status}` }
      } catch {
        return { error: `HTTP ${response.status}` }
      }
    }
    // Success — clear the one-shot token so nothing downstream can reuse it
    recoveryAccessToken = null
    recoveryExchangeStarted = false
    return {}
  } catch (e: any) {
    logger.error('updateRecoveryPassword exception', e)
    return { error: e?.message || 'Network error' }
  }
}

/**
 * Manually exchange a Supabase PKCE recovery code for a session.
 *
 * Why this exists: supabase.auth.exchangeCodeForSession() (and detectSessionInUrl)
 * deadlock on the GoTrueClient navigator.locks lock in this codebase. Multiple
 * GoTrueClient instances contend on the same storageKey, and any auth-client
 * call requiring the lock hangs forever with no error and no network request.
 *
 * Workaround: hit the Supabase REST endpoint directly, write the resulting
 * session into localStorage in the format supabase-js expects, then flip the
 * password-recovery flag so AuthScreen renders the set-new-password form.
 */
async function handleRecoveryCodeExchange(
  setIsPasswordRecovery: (v: boolean) => void,
  setIsLoading: (v: boolean) => void
) {
  if (recoveryExchangeStarted) return
  try {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (!code) return

    recoveryExchangeStarted = true

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!supabaseUrl || !anonKey) {
      logger.error('Recovery exchange: missing Supabase env vars')
      return
    }

    const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)/)?.[1]
    const verifierKey = `sb-${projectRef}-auth-token-code-verifier`
    const storedVerifier = localStorage.getItem(verifierKey)
    if (!storedVerifier) {
      logger.error('Recovery code present but no code_verifier in localStorage', { verifierKey })
      return
    }

    // gotrue-js v2 stores the verifier JSON-stringified and suffixed with the
    // flow type, e.g. `"abc123.../PASSWORD_RECOVERY"` (outer quotes are the
    // JSON string delimiters). We must:
    //   1. JSON.parse to strip the wrapping quotes
    //   2. Split on '/' and keep the part before the suffix
    // Falls back to raw value if it isn't JSON (older format).
    let unwrapped: string
    try {
      const parsed = JSON.parse(storedVerifier)
      unwrapped = typeof parsed === 'string' ? parsed : storedVerifier
    } catch {
      unwrapped = storedVerifier
    }
    const codeVerifier = unwrapped.split('/')[0]

    // Strip code from URL up front so a refresh doesn't re-attempt the exchange
    window.history.replaceState({}, '', window.location.pathname + window.location.hash)

    const response = await fetch(
      `${supabaseUrl}/auth/v1/token?grant_type=pkce`,
      {
        method: 'POST',
        headers: {
          apikey: anonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ auth_code: code, code_verifier: codeVerifier })
      }
    )

    if (!response.ok) {
      const errorBody = await response.text()
      logger.error('Recovery PKCE exchange failed', {
        status: response.status,
        body: errorBody
      })
      return
    }

    const session = await response.json()

    // CRITICAL: do NOT write the session to localStorage. If we did, the rest
    // of the app would see a valid session on the next init pass and redirect
    // the user to /projects, blowing past the set-new-password form. Instead
    // keep the access token in memory and let updateRecoveryPassword() use it
    // for the PUT /auth/v1/user call. The token is one-shot and cleared as
    // soon as the password update completes.
    recoveryAccessToken = session.access_token

    // Verifier has been consumed
    localStorage.removeItem(verifierKey)

    // Drive the UI directly into recovery mode — we cannot rely on
    // supabase's PASSWORD_RECOVERY event because we bypassed the auth client.
    setIsPasswordRecovery(true)
    setIsLoading(false)
    logger.info('Password recovery flow ready — user can set new password', {
      email: session.user?.email
    })
  } catch (e) {
    logger.error('Recovery PKCE exchange exception', e)
  }
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

    // Build a user immediately from JWT data so the UI transitions without
    // waiting for the user_profiles network round-trip.
    const jwtUser: User = {
      id: ensureUUID(authUser.id),
      email: authUser.email,
      full_name: authUser.user_metadata?.full_name || authUser.email,
      role: 'user' as UserRole,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Demo users: synthesise profile client-side, no DB query needed.
    if (authUser.isDemoUser || isDemoUUID(authUser.id)) {
      if (authUser.email === 'admin@prioritas.com') jwtUser.role = 'super_admin'
      else if (authUser.email === 'manager@company.com') jwtUser.role = 'admin'
      setCurrentUser(jwtUser)
      setAuthUser(authUser)
      setIsLoading(false)
      return
    }

    // Transition the UI immediately using JWT data, then update in background
    // with the full profile (which may carry a non-default role or avatar_url).
    setCurrentUser(jwtUser)
    setAuthUser(authUser)
    setIsLoading(false)

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, avatar_url, role, created_at, updated_at')
        .eq('id', authUser.id)
        .single()

      if (profile) {
        logger.debug('👤 Profile fetched, updating user:', { id: profile.id, role: (profile as User).role })
        setCurrentUser(profile as User)
      }
    } catch (err) {
      logger.warn('⚠️ Could not fetch user_profiles (JWT user already set):', err)
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
        // detectSessionInUrl: true in supabase client config handles ?code= recovery
        // codes automatically before this point.
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

    // PKCE recovery code exchange via direct REST call.
    // supabase.auth.exchangeCodeForSession() deadlocks on the GoTrueClient
    // navigator.locks lock in this codebase (multiple GoTrueClient instances
    // contend on the same storageKey). We perform the exchange manually and
    // write the resulting session to localStorage in the format supabase-js
    // expects, then flip isPasswordRecovery so AuthScreen renders the
    // set-new-password form.
    handleRecoveryCodeExchange(setIsPasswordRecovery, setIsLoading)

    // Mint the csrf-token cookie if it's missing. The degraded auth fallback
    // skips ProfileService (to avoid getSession cascade), so returning users
    // never hit /api/auth?action=user and never get a CSRF cookie — which
    // disables any CSRF-protected UI (analyze-image, transcribe-audio, etc.).
    bootstrapCsrfCookie()

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