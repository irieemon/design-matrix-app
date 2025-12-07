import { useCallback } from 'react'
import { DatabaseService } from '../../lib/database'
import { supabase } from '../../lib/supabase'
import { logger } from '../../utils/logger'
import type { Project, IdeaCard, User, ProjectType } from '../../types'
import type { ProjectAnalysis } from './useAIStarterState'

export interface UseProjectCreationReturn {
  createProjectAndIdeas: (
    projectData: {
      name: string
      description: string
      projectType: ProjectType
      analysis: ProjectAnalysis
    },
    currentUser: User,
    onSuccess: (project: Project, ideas: IdeaCard[]) => void
  ) => Promise<void>
  createProject: (
    projectData: {
      name: string
      description: string
      projectType: ProjectType
      analysis: ProjectAnalysis
    },
    currentUser: User
  ) => Promise<Project>
  createIdeas: (
    ideas: ProjectAnalysis['generatedIdeas'],
    projectId: string,
    currentUser: User
  ) => Promise<IdeaCard[]>
}

export const useProjectCreation = (): UseProjectCreationReturn => {
  const createProject = useCallback(async (
    projectData: {
      name: string
      description: string
      projectType: ProjectType
      analysis: ProjectAnalysis
    },
    currentUser: User
  ): Promise<Project> => {
    logger.debug('🏗️ Creating project with type:', projectData.projectType)

    const project = await DatabaseService.createProject({
      name: projectData.name,
      description: projectData.description,
      project_type: projectData.projectType,
      status: 'active',
      priority_level: 'medium',
      visibility: 'private',
      owner_id: currentUser.id,
      ai_analysis: projectData.analysis.projectAnalysis
    })

    if (!project) {
      throw new Error('Failed to create project')
    }

    return project
  }, [])

  const createIdeas = useCallback(async (
    ideas: ProjectAnalysis['generatedIdeas'],
    projectId: string,
    currentUser: User
  ): Promise<IdeaCard[]> => {
    logger.debug('💡 Creating', ideas.length, 'ideas...')

    const createdIdeas: IdeaCard[] = []

    for (const ideaData of ideas) {
      try {
        const newIdea = await DatabaseService.createIdea({
          content: ideaData.content,
          details: ideaData.details,
          x: Math.round(ideaData.x),
          y: Math.round(ideaData.y),
          priority: ideaData.priority,
          created_by: currentUser.id,
          is_collapsed: true,
          project_id: projectId
        }, supabase)

        if (newIdea.success && newIdea.data) {
          createdIdeas.push(newIdea.data)
        } else {
          logger.error('Failed to create idea:', ideaData.content, newIdea.error)
        }
      } catch (error) {
        logger.error('Error creating idea:', ideaData.content, error)
      }
    }

    if (createdIdeas.length === 0 && ideas.length > 0) {
      throw new Error('Failed to create any ideas')
    }

    return createdIdeas
  }, [])

  const createProjectAndIdeas = useCallback(async (
    projectData: {
      name: string
      description: string
      projectType: ProjectType
      analysis: ProjectAnalysis
    },
    currentUser: User,
    onSuccess: (project: Project, ideas: IdeaCard[]) => void
  ): Promise<void> => {
    try {
      // Create the project first
      const project = await createProject(projectData, currentUser)

      // Create the ideas
      const createdIdeas = await createIdeas(
        projectData.analysis.generatedIdeas,
        project.id,
        currentUser
      )

      logger.debug('✅ AI Starter complete! Created project and', createdIdeas.length, 'ideas')

      // Call success callback
      onSuccess(project, createdIdeas)
    } catch (error) {
      logger.error('Error creating project and ideas:', error)
      throw error
    }
  }, [createProject, createIdeas])

  return {
    createProjectAndIdeas,
    createProject,
    createIdeas
  }
}