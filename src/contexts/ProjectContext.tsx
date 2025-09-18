/**
 * ProjectContext - Manages project state and operations
 *
 * Extracted from App.tsx to separate project management concerns.
 * Handles current project state, project selection, and restoration from URL.
 */

import { createContext, useContext, useState, ReactNode } from 'react'
import { Project } from '../types'
import { DatabaseService } from '../lib/database'
import { logger } from '../utils/logger'

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
      const project = await DatabaseService.getProjectById(projectId)
      if (project) {
        logger.debug('✅ Project: Project restored successfully:', project.name)
        console.log('🎯 Project: Setting currentProject to:', project)
        setCurrentProject(project)
      } else {
        logger.warn('⚠️ Project: Project not found or no access:', projectId)
        console.log('❌ Project: Project restoration failed for:', projectId)
        // Don't clear current project if restoration fails - user might not have access
      }
    } catch (error) {
      logger.error('❌ Project: Error restoring project:', error)
      console.log('💥 Project: Project restoration error:', error)
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