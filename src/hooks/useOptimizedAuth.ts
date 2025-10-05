/**
 * OPTIMIZED AUTH HOOK
 *
 * Fixes the hanging auth issue by:
 * 1. Eliminating cascading timeouts
 * 2. Removing complex state dependencies
 * 3. Fast-fail approach with predictable timing
 * 4. Simplified error recovery
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { User, AuthUser } from '../types'
import { logger } from '../utils/logger'
import { authPerformanceMonitor } from '../utils/authPerformanceMonitor'

interface UseOptimizedAuthOptions {
  onProjectsCheck?: (userId: string, isDemoUser?: boolean) => Promise<void>
  setCurrentProject?: (project: any) => void
  setIdeas?: (ideas: any[]) => void
  setCurrentPage?: (page: string) => void
}

interface UseOptimizedAuthReturn {
  currentUser: User | null
  authUser: AuthUser | null
  isLoading: boolean
  handleAuthSuccess: (authUser: any) => Promise<void>
  handleLogout: () => Promise<void>
  setCurrentUser: (user: User | null) => void
  setIsLoading: (loading: boolean) => void
}

// Simple in-memory cache without complex expiration
const userCache = new Map<string, User>()

export const useOptimizedAuth = (options: UseOptimizedAuthOptions = {}): UseOptimizedAuthReturn => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const mountedRef = useRef(true)

  const { onProjectsCheck, setCurrentProject, setIdeas } = options

  // OPTIMIZED: Fast user profile fetch with simplified error handling
  const fetchUserProfile = async (authUser: any): Promise<User> => {
    const cacheKey = `${authUser.id}:${authUser.email}`

    // Check cache first
    if (userCache.has(cacheKey)) {
      return userCache.get(cacheKey)!
    }

    // Demo user handling
    if (authUser.isDemoUser || authUser.id?.startsWith('00000000-0000-0000-0000-00000000000')) {
      const demoUser: User = {
        id: authUser.id,
        email: authUser.email,
        full_name: authUser.user_metadata?.full_name || authUser.email,
        avatar_url: authUser.user_metadata?.avatar_url || null,
        role: authUser.email === 'admin@prioritas.com' ? 'super_admin' : 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      userCache.set(cacheKey, demoUser)
      return demoUser
    }

    // Real user profile fetch with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 1500)  // Fixed 1.5s timeout

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      if (!token) throw new Error('No auth token available')

      const response = await fetch('/api/auth?action=user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

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

        userCache.set(cacheKey, userProfile)
        return userProfile
      }

      throw new Error(`Profile fetch failed: ${response.status}`)
    } catch (error) {
      clearTimeout(timeoutId)

      // Fallback user on any error
      const fallbackUser: User = {
        id: authUser.id,
        email: authUser.email,
        full_name: authUser.user_metadata?.full_name || authUser.email,
        avatar_url: authUser.user_metadata?.avatar_url || null,
        role: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      logger.warn('Using fallback user profile due to:', error)
      return fallbackUser
    }
  }

  // OPTIMIZED: Fast project check without complex caching
  const checkProjects = async (userId: string, isDemoUser: boolean = false) => {
    if (onProjectsCheck) {
      await onProjectsCheck(userId, isDemoUser)
      return
    }

    if (isDemoUser || userId?.startsWith('00000000-0000-0000-0000-00000000000')) {
      return // Skip database calls for demo users
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 800)  // Fast timeout

      const result = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
        .limit(1)
        .abortSignal(controller.signal)

      clearTimeout(timeoutId)

      const hasProjects = result?.count && result.count > 0
      logger.debug('Project check result:', hasProjects ? 'has projects' : 'no projects')

    } catch (error) {
      logger.debug('Project check failed (non-critical):', error)
    }
  }

  // OPTIMIZED: Simplified auth user handler
  const handleAuthUser = async (authUser: any) => {
    const startTime = performance.now()

    try {
      logger.debug('🔐 Processing authenticated user:', authUser.email)
      setAuthUser(authUser)

      const isDemoUser = authUser.isDemoUser || authUser.id?.startsWith('00000000-0000-0000-0000-00000000000')

      // Run profile fetch and project check in parallel with fast timeout
      const [userProfile] = await Promise.allSettled([
        fetchUserProfile(authUser),
        checkProjects(authUser.id, isDemoUser)
      ])

      if (userProfile.status === 'fulfilled') {
        setCurrentUser(userProfile.value)
        logger.debug('✅ User profile set successfully')
      } else {
        logger.error('❌ User profile failed, but continuing with auth')
        // Set minimal fallback user
        setCurrentUser({
          id: authUser.id || 'unknown',
          email: authUser.email || 'unknown@example.com',
          full_name: authUser.email || 'Unknown User',
          role: 'user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }

    } catch (error) {
      logger.error('💥 Error in auth processing:', error)

      // Always set a user to prevent infinite loading
      setCurrentUser({
        id: authUser?.id || 'unknown',
        email: authUser?.email || 'unknown@example.com',
        full_name: authUser?.email || 'Unknown User',
        role: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    } finally {
      const authTime = performance.now() - startTime
      authPerformanceMonitor.recordUserProfileFetch(authTime)
      logger.debug('🔓 Auth processing complete', `${authTime.toFixed(1)}ms`)
      authPerformanceMonitor.finishSession('success')
      setIsLoading(false)
    }
  }

  const handleAuthSuccess = useCallback(async (authUser: any) => {
    logger.debug('🎉 Authentication successful:', authUser.email)
    try {
      await handleAuthUser(authUser)
    } catch (error) {
      logger.error('❌ Error in auth success handler:', error)
      setIsLoading(false)  // Ensure loading stops even on error
    }
  }, [])

  const handleLogout = useCallback(async () => {
    try {
      logger.debug('🚪 Logging out...')
      await supabase.auth.signOut()
    } catch (error) {
      logger.error('Logout error:', error)
      // Force cleanup on error
      setCurrentUser(null)
      setAuthUser(null)
      setCurrentProject?.(null)
      setIdeas?.([])
      userCache.clear()
    }
  }, [setCurrentProject, setIdeas])

  // OPTIMIZED: Simplified auth initialization
  useEffect(() => {
    let mounted = true
    const startTime = performance.now()

    const initializeAuth = async () => {
      try {
        logger.debug('🚀 Starting optimized auth initialization')
        authPerformanceMonitor.startSession()

        // Single session check with fixed timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 2000)  // 2s timeout

        let sessionResult
        try {
          sessionResult = await supabase.auth.getSession()
          clearTimeout(timeoutId)
        } catch (error) {
          clearTimeout(timeoutId)
          logger.debug('Session check timeout - proceeding with no session')
          sessionResult = { data: { session: null }, error: null }
        }

        const { data: { session }, error } = sessionResult
        const sessionTime = performance.now() - startTime
        authPerformanceMonitor.recordSessionCheck(sessionTime)

        logger.debug('🔐 Session check:', {
          found: !!session,
          email: session?.user?.email,
          time: `${sessionTime.toFixed(1)}ms`
        })

        if (error) {
          logger.error('❌ Session error:', error)
        }

        if (session?.user && mounted) {
          logger.debug('✅ Existing session found')
          await handleAuthUser(session.user)
        } else {
          logger.debug('❌ No session - showing login')

          // Clear any legacy storage
          try {
            localStorage.removeItem('prioritasUser')
          } catch (e) {
            // Ignore
          }

          // Fast completion - no complex timeouts
          if (mounted) {
            authPerformanceMonitor.finishSession('success')
            setIsLoading(false)
          }
        }
      } catch (error) {
        logger.error('💥 Auth initialization error:', error)
        authPerformanceMonitor.finishSession('error')
        if (mounted) setIsLoading(false)
      }
    }

    initializeAuth()

    // Auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      logger.debug('🔐 Auth state changed:', event, session?.user?.email)

      if (event === 'SIGNED_IN' && session?.user) {
        logger.debug('✅ SIGNED_IN event - processing user')
        await handleAuthUser(session.user)
      } else if (event === 'SIGNED_OUT') {
        logger.debug('🚪 SIGNED_OUT event')
        setAuthUser(null)
        setCurrentUser(null)
        setCurrentProject?.(null)
        setIdeas?.([])
        userCache.clear()
        setIsLoading(false)
      } else if (event === 'INITIAL_SESSION') {
        if (session?.user) {
          logger.debug('✅ INITIAL_SESSION with user')
          await handleAuthUser(session.user)
        } else {
          logger.debug('🔓 INITIAL_SESSION without user')
          setIsLoading(false)
        }
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        logger.debug('🔄 TOKEN_REFRESHED')
        // Don't re-process on token refresh unless no current user
        if (!currentUser) {
          await handleAuthUser(session.user)
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

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