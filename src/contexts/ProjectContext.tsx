/**
 * ProjectContext - Manages project state and operations
 *
 * Extracted from App.tsx to separate project management concerns.
 * Handles current project state, project selection, and restoration from URL.
 */

import { createContext, useContext, useState, ReactNode, useEffect } from 'react'
import { Project } from '../types'
import { DatabaseService } from '../lib/database'
import { logger } from '../utils/logger'
import { useCurrentUser, useAuthenticatedClient } from './UserContext'
import { useToast } from './ToastContext'
import { supabase } from '../lib/supabase'

interface ProjectContextType {
  currentProject: Project | null
  setCurrentProject: (project: Project | null) => void
  handleProjectSelect: (project: Project | null) => void
  handleProjectRestore: (projectId: string) => Promise<void>
  isRestoringProject: boolean
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

interface ProjectProviderProps {
  children: ReactNode
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [isRestoringProject, setIsRestoringProject] = useState(false)
  const currentUser = useCurrentUser()
  const authenticatedClient = useAuthenticatedClient()
  const { showError } = useToast()

  // Clear project when user changes (logout/login)
  useEffect(() => {
    if (!currentUser) {
      logger.debug('🔄 User logged out, clearing current project')
      setCurrentProject(null)
    }
  }, [currentUser])

  const handleProjectSelect = (project: Project | null) => {
    if (project) {
      logger.debug('🎯 Project: handleProjectSelect called with:', project.name, project.id)
      setCurrentProject(project)
    } else {
      logger.debug('🔍 Project: handleProjectSelect called with null, clearing project')
      setCurrentProject(null)
    }
  }

  const handleProjectRestore = async (projectId: string) => {
    try {
      setIsRestoringProject(true)
      logger.debug('🔄 Project: Restoring project from URL:', projectId)

      const queryStart = Date.now()
      let project: Project | null = null

      // CRITICAL FIX: If authenticated client exists, use direct REST API call to avoid GoTrueClient conflict
      if (authenticatedClient) {
        logger.debug('Using direct REST API with localStorage token')

        // Get token from localStorage
        const storageKey = 'sb-vfovtgtjailvrphsgafv-auth-token'
        const stored = localStorage.getItem(storageKey)

        if (stored) {
          const parsed = JSON.parse(stored)
          const accessToken = parsed.access_token

          // Get config from environment
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
          const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

          const fetchPromise = fetch(
            `${supabaseUrl}/rest/v1/projects?id=eq.${projectId}&select=*`,
            {
              headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              }
            }
          ).then(async (response) => {
            const queryTime = Date.now() - queryStart
            logger.debug('REST API responded:', { queryTime, status: response.status })

            if (response.ok) {
              const data = await response.json()
              return data[0] || null  // PostgREST returns array
            } else {
              const errorText = await response.text()
              logger.error('REST API error:', response.status, errorText)
              return null
            }
          })

          const timeoutPromise = new Promise<null>((_, reject) =>
            setTimeout(() => {
              const queryTime = Date.now() - queryStart
              logger.error('REST API timeout after', queryTime, 'ms')
              reject(new Error('Project restoration timeout after 5 seconds'))
            }, 5000)
          )

          project = await Promise.race([fetchPromise, timeoutPromise])
        }
      } else {
        logger.debug('Using standard Supabase client')

        const restorationPromise = supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single()
          .then((result: any) => {
            const queryTime = Date.now() - queryStart
            logger.debug('Query completed:', { queryTime })
            return result.data
          })

        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => {
            const queryTime = Date.now() - queryStart
            logger.error('Query timeout after', queryTime, 'ms')
            reject(new Error('Project restoration timeout after 5 seconds'))
          }, 5000)
        )

        project = await Promise.race([restorationPromise, timeoutPromise])
      }

      if (project) {
        logger.debug('✅ Project: Project restored successfully:', project.name)
        logger.info('Setting current project', {
          projectId: project.id,
          projectName: project.name,
          ownerId: project.owner_id
        })
        setCurrentProject(project)
      } else {
        logger.warn('⚠️ Project: Project not found or no access:', projectId)
        logger.warn('Project restoration failed', {
          projectId,
          reason: 'not_found_or_no_access'
        })
        // PHASE 1 FIX: Show user-friendly error notification
        showError('Unable to load project. You may not have access or the project may not exist.')
        // Don't clear current project if restoration fails - user might not have access
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Project restoration timeout')) {
        logger.error('🚨 Project: Restoration timeout for project:', projectId)
        logger.error('Project restoration timed out', error, {
          projectId,
          timeout: 5000,
          reason: 'timeout'
        })
        // PHASE 1 FIX: Show timeout error to user
        showError('Project loading timed out. Please try refreshing the page or navigate to the Projects page.')
      } else {
        logger.error('❌ Project: Error restoring project:', error)
        logger.error('Project restoration error', error as Error, {
          projectId,
          operation: 'restore'
        })
        // PHASE 1 FIX: Show generic error to user
        showError('Unable to load project. Please try again from the Projects page.')
      }
    } finally {
      setIsRestoringProject(false)
    }
  }

  const value = {
    currentProject,
    setCurrentProject,
    handleProjectSelect,
    handleProjectRestore,
    isRestoringProject
  }

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const context = useContext(ProjectContext)
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider')
  }
  return context
}