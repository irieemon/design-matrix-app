// SECURITY WARNING: This file contains test bypass code that MUST NOT be used in production
// PRIO-SEC-003 (CVSS 9.8): Complete authentication bypass vulnerability

// PRODUCTION GUARD: Fail immediately if this code is loaded in production
if (import.meta.env.PROD || import.meta.env.MODE === 'production') {
  throw new Error(
    '🚨 SECURITY VIOLATION: Test authentication bypass detected in production build! ' +
    'This file (useAuthTestBypass.ts) must be excluded from production builds. ' +
    'Check your build configuration and vite.config.ts.'
  )
}

import { useState, useEffect, useCallback } from 'react'
import { User, AuthUser, Project, UserRole } from '../types'
import { useLogger } from '../lib/logging'
import { ensureUUID } from '../utils/uuid'

interface UseAuthReturn {
  currentUser: User | null
  authUser: AuthUser | null
  isLoading: boolean
  handleAuthSuccess: () => Promise<void>
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

// TEST BYPASS VERSION - Always return authenticated test user WITH project
export const useAuth = (options: UseAuthOptions = {}): UseAuthReturn => {
  const logger = useLogger('useAuthTestBypass')
  const [currentUser, setCurrentUserState] = useState<User | null>(null)
  const [isLoading, setIsLoadingState] = useState(true)

  const { setCurrentProject, setIdeas } = options

  // Create a test user and set up complete demo environment immediately
  useEffect(() => {
    const initializeTestUserAndDemo = () => {
      logger.info('Starting comprehensive demo setup')

      const testUserId = ensureUUID('test-user-matrix-bypass-12345')

      const testAuthUser = {
        id: testUserId,
        email: 'test@matrix.bypass',
        user_metadata: {
          full_name: 'Test Matrix User'
        },
        isDemoUser: true
      }

      const testUser: User = {
        id: testUserId,
        email: testAuthUser.email,
        full_name: 'Test Matrix User',
        avatar_url: undefined,
        role: 'user' as UserRole,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const testProject: Project = {
        id: 'demo-test-project-matrix',
        name: 'Test Matrix Project',
        description: 'Demo project for testing matrix functionality',
        owner_id: testUserId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as Project

      const testIdeas = [
        {
          id: 'demo-idea-1',
          title: 'Quick Win',
          description: 'High impact, low effort task',
          impact: 4,
          effort: 1,
          project_id: testProject.id,
          owner_id: testUserId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'demo-idea-2',
          title: 'Major Project',
          description: 'High impact, high effort initiative',
          impact: 4,
          effort: 4,
          project_id: testProject.id,
          owner_id: testUserId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'demo-idea-3',
          title: 'Fill Task',
          description: 'Low impact, low effort task',
          impact: 1,
          effort: 1,
          project_id: testProject.id,
          owner_id: testUserId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]

      logger.info('Setting authenticated user', { userId: testUser.id });
      logger.info('Setting test project', { projectId: testProject.id });
      logger.info('Setting test ideas', { count: testIdeas.length });

      // Set user state
      setCurrentUserState(testUser);

      // Store comprehensive test data globally (memory only)
      (window as any).__TEST_BYPASS_DATA__ = {
        project: testProject,
        ideas: testIdeas,
        user: testUser,
        initialized: Date.now()
      }

      // SECURITY FIX: Removed localStorage storage per PRIO-SEC-003
      // Test data should only be in memory, never persisted to localStorage
      // This prevents test data from leaking across sessions

      logger.debug('TEST BYPASS DATA SET', {
        hasProject: !!testProject,
        hasIdeas: !!testIdeas,
        hasUser: !!testUser
      })

      // Try context callbacks if available
      if (setCurrentProject) {
        logger.debug('Setting project via callback')
        setCurrentProject(testProject)
      } else {
        logger.debug('No setCurrentProject callback available')
      }

      if (setIdeas) {
        logger.debug('Setting ideas via callback')
        setIdeas(testIdeas)
      } else {
        logger.debug('No setIdeas callback available')
      }

      setIsLoadingState(false)

      logger.info('Complete demo environment initialized')
    }

    // Run immediately for faster setup
    const timer = setTimeout(initializeTestUserAndDemo, 100)
    return () => clearTimeout(timer)
  }, [setCurrentProject, setIdeas])

  const handleAuthSuccess = useCallback(async () => {
    logger.debug('handleAuthSuccess called (no-op in test bypass mode)')
  }, [])

  const handleLogout = useCallback(async () => {
    logger.debug('handleLogout called (no-op in test bypass mode)')
  }, [])

  return {
    currentUser,
    authUser: null,
    isLoading,
    handleAuthSuccess,
    handleLogout,
    setCurrentUser: setCurrentUserState,
    setIsLoading: setIsLoadingState
  }
}