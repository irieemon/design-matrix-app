import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { DatabaseService } from '../lib/database'
import { User, AuthUser, Project } from '../types'
import { logger } from '../utils/logger'

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

export const useAuth = (options: UseAuthOptions = {}): UseAuthReturn => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const { onProjectsCheck, setCurrentProject, setIdeas } = options

  // Check if user has projects and redirect to appropriate page
  const checkUserProjectsAndRedirect = async (userId: string, isDemoUser = false) => {
    if (onProjectsCheck) {
      await onProjectsCheck(userId, isDemoUser)
      return
    }

    try {
      logger.debug('📋 Checking if user has existing projects...')
      
      // For demo users, skip database calls and preserve current page
      if (isDemoUser || userId?.startsWith('00000000-0000-0000-0000-00000000000')) {
        logger.debug('🎭 Demo user detected, skipping database check and preserving current page for URL sharing')
        return
      }
      
      // Add timeout to prevent hanging
      const projectCheckPromise = DatabaseService.getUserOwnedProjects(userId)
      const timeoutPromise = new Promise<Project[]>((resolve) => 
        setTimeout(() => {
          logger.debug('⏰ Project check timeout, defaulting to matrix page')
          resolve([])
        }, 3000)
      )
      
      const userProjects = await Promise.race([projectCheckPromise, timeoutPromise])
      
      logger.debug('📋 Found', userProjects.length, 'projects for user')
      
      if (userProjects.length > 0) {
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
      logger.error('❌ Error checking user projects:', error)
      // Don't override page even on error - preserve URL sharing
      logger.debug('📍 Not setting page to matrix on error to preserve URL sharing')
    }
  }

  // Handle authenticated user
  const handleAuthUser = async (authUser: any) => {
    try {
      logger.debug('🔐 handleAuthUser called with:', authUser.email, authUser.id)
      setAuthUser(authUser)
      
      // Determine user role based on email (for demo purposes)
      let userRole: 'user' | 'admin' | 'super_admin' = 'user'
      if (authUser.email === 'admin@prioritas.com') {
        userRole = 'super_admin'
      } else if (authUser.email === 'manager@company.com') {
        userRole = 'admin'
      }

      // Create fallback user immediately to prevent hanging
      const fallbackUser = {
        id: authUser.id,
        email: authUser.email,
        full_name: authUser.user_metadata?.full_name || authUser.email,
        avatar_url: authUser.user_metadata?.avatar_url || null,
        role: userRole,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      logger.debug('🔧 Created fallback user:', { 
        id: fallbackUser.id, 
        email: fallbackUser.email,
        idType: typeof fallbackUser.id 
      })
      
      // Skip database profile lookup for now and use auth user directly
      logger.debug('👤 Using authenticated user data directly')
      setCurrentUser(fallbackUser)
      
      // Check if user has existing projects and redirect accordingly
      const isDemoUser = authUser.isDemoUser || authUser.id?.startsWith('00000000-0000-0000-0000-00000000000')
      await checkUserProjectsAndRedirect(authUser.id, isDemoUser)
      
    } catch (error) {
      logger.error('💥 Error in handleAuthUser:', error)
      // Even if everything fails, set a basic user to prevent infinite loading
      let errorUserRole: 'user' | 'admin' | 'super_admin' = 'user'
      if (authUser?.email === 'admin@prioritas.com') {
        errorUserRole = 'super_admin'
      } else if (authUser?.email === 'manager@company.com') {
        errorUserRole = 'admin'
      }
      
      setCurrentUser({
        id: authUser?.id || 'unknown',
        email: authUser?.email || 'unknown@example.com',
        full_name: authUser?.email || 'Unknown User',
        role: errorUserRole,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      
      // Try to check for projects even in error case
      if (authUser?.id) {
        const isDemoUser = authUser.isDemoUser || authUser.id?.startsWith('00000000-0000-0000-0000-00000000000')
        await checkUserProjectsAndRedirect(authUser.id, isDemoUser)
      } else {
        logger.debug('📍 Not setting page to matrix - preserving current page for URL sharing')
      }
    } finally {
      logger.debug('🔓 Setting loading to false')
      setIsLoading(false)
    }
  }

  const handleAuthSuccess = async (authUser: any) => {
    logger.debug('🎉 Authentication successful:', authUser.email, 'ID:', authUser.id)
    // For demo users, directly call handleAuthUser since they won't go through Supabase
    if (authUser.isDemoUser || authUser.id?.startsWith('00000000-0000-0000-0000-00000000000')) {
      logger.debug('🎭 Processing demo user:', authUser)
      try {
        await handleAuthUser(authUser)
        logger.debug('✅ Demo user processed successfully')
      } catch (error) {
        logger.error('❌ Error processing demo user:', error)
      }
    }
    // For real Supabase users, the auth state listener will handle it
  }

  const handleLogout = async () => {
    try {
      logger.debug('🚪 Logging out...')
      await supabase.auth.signOut()
      // The auth state change listener will handle the rest
    } catch (error) {
      logger.error('Error logging out:', error)
      // Fallback: clear state manually
      setCurrentUser(null)
      setAuthUser(null)
      setCurrentProject?.(null)
      setIdeas?.([])
      localStorage.removeItem('prioritasUser')
      // Don't set page to matrix on logout - preserve URL sharing
      logger.debug('📍 Not setting page to matrix on logout to preserve URL sharing')
    }
  }

  // Initialize Supabase auth and handle session changes
  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        logger.debug('🚀 Initializing authentication...')
        
        // Add a small delay to let the auth state listener run first
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Get current session with timeout and graceful fallback
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((resolve) => 
          setTimeout(() => resolve({ data: { session: null }, error: null }), 3000)
        )
        
        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]) as any
        logger.debug('🔐 Session check result:', { session: session?.user?.email, error })
        
        if (error) {
          logger.error('❌ Error getting session:', error)
        }

        if (session?.user && mounted) {
          logger.debug('✅ User already signed in:', session.user.email)
          await handleAuthUser(session.user)
        } else {
          logger.debug('❌ No active session found')
          // Try legacy localStorage user for backwards compatibility
          const savedUser = localStorage.getItem('prioritasUser')
          if (savedUser && mounted) {
            logger.debug('🔄 Found legacy user, migrating:', savedUser)
            let legacyRole: 'user' | 'admin' | 'super_admin' = 'user'
            if (savedUser === 'admin@prioritas.com') {
              legacyRole = 'super_admin'
            } else if (savedUser === 'manager@company.com') {
              legacyRole = 'admin'
            }
            
            setCurrentUser({
              id: 'legacy-user',
              email: savedUser,
              full_name: savedUser,
              role: legacyRole,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            setIsLoading(false)
          } else {
            logger.debug('❌ No legacy user found - waiting for auth state')
            // Give auth state listener a chance to work before showing login
            setTimeout(() => {
              if (mounted) {
                logger.debug('🔓 Final check: showing login screen')
                setIsLoading(false)
              }
            }, 1000)
          }
        }
      } catch (error) {
        logger.error('💥 Error initializing auth:', error)
        if (mounted) setIsLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      logger.debug('🔐 Auth state changed:', event, session?.user?.email)
      
      if (event === 'SIGNED_IN' && session?.user) {
        await handleAuthUser(session.user)
        // Loading is now handled inside handleAuthUser after completion
      } else if (event === 'SIGNED_OUT') {
        setAuthUser(null)
        setCurrentUser(null)
        setCurrentProject?.(null)
        setIdeas?.([])
        localStorage.removeItem('prioritasUser') // Clean up legacy
        setIsLoading(false)
      } else if (event === 'INITIAL_SESSION' && !session) {
        // No initial session found, stop loading and show login
        logger.debug('🔓 No initial session, showing login screen')
        setIsLoading(false)
      }
    })

    // Clean up stale locks every 30 seconds
    const lockCleanupInterval = setInterval(() => {
      DatabaseService.cleanupStaleLocks()
    }, 30000)

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearInterval(lockCleanupInterval)
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