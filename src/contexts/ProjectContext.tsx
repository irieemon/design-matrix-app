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
import { useCurrentUser } from './UserContext'

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
      logger.debug('🎯 Project: handleProjectSelect called with null, clearing project')
      setCurrentProject(null)
    }
  }

  const handleProjectRestore = async (projectId: string) => {
    try {
      setIsRestoringProject(true)
      logger.debug('🔄 Project: Restoring project from URL:', projectId)

      // CRITICAL FIX: Coordinated timeout aligned with browser history (5s to finish before browser history 6s timeout)
      const restorationPromise = DatabaseService.getProjectById(projectId)
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Project restoration timeout after 5 seconds')), 5000)
      )

      const project = await Promise.race([restorationPromise, timeoutPromise])

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
      } else {
        logger.error('❌ Project: Error restoring project:', error)
        logger.error('Project restoration error', error as Error, {
          projectId,
          operation: 'restore'
        })
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