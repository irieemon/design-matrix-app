import { supabase } from '../supabase'
import { Project } from '../../types'
import { logger } from '../../utils/logger'

/**
 * Project Repository
 *
 * Handles all database operations related to projects including
 * CRUD operations, user associations, and project queries.
 */
export class ProjectRepository {
  /**
   * Get all projects
   */
  static async getAllProjects(): Promise<Project[]> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching all projects:', error)
        throw new Error(error.message)
      }

      return data || []
    } catch (error) {
      logger.error('Failed to get all projects:', error)
      throw error
    }
  }

  /**
   * Get projects owned by a specific user
   */
  static async getUserOwnedProjects(userId: string): Promise<Project[]> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching user projects:', error)
        throw new Error(error.message)
      }

      return data || []
    } catch (error) {
      logger.error('Failed to get user projects:', error)
      throw error
    }
  }

  /**
   * Get all projects accessible to a user (owned + collaborator)
   */
  static async getUserProjects(userId: string): Promise<Project[]> {
    try {
      // This would typically involve a join with project_collaborators table
      // For now, returning owned projects
      return await ProjectRepository.getUserOwnedProjects(userId)
    } catch (error) {
      logger.error('Failed to get user accessible projects:', error)
      throw error
    }
  }

  /**
   * Get current project from localStorage or user preference
   */
  static async getCurrentProject(): Promise<Project | null> {
    try {
      // In a real implementation, this might check user preferences or session data
      const storedProjectId = localStorage.getItem('currentProjectId')
      if (storedProjectId) {
        return await ProjectRepository.getProjectById(storedProjectId)
      }
      return null
    } catch (error) {
      logger.error('Failed to get current project:', error)
      return null
    }
  }

  /**
   * Get a specific project by ID
   */
  static async getProjectById(projectId: string): Promise<Project | null> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null
        }
        logger.error('Error fetching project:', error)
        throw new Error(error.message)
      }

      return data
    } catch (error) {
      logger.error('Failed to get project by ID:', error)
      return null
    }
  }

  /**
   * Create a new project
   */
  static async createProject(
    project: Omit<Project, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Project | null> {
    try {
      logger.debug('Creating project:', project.name)

      const projectData = {
        ...project,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('projects')
        .insert([projectData])
        .select()
        .single()

      if (error) {
        logger.error('Error creating project:', error)
        throw new Error(error.message)
      }

      logger.debug('Project created successfully:', data.id)
      return data
    } catch (error) {
      logger.error('Failed to create project:', error)
      return null
    }
  }

  /**
   * Update an existing project
   */
  static async updateProject(
    projectId: string,
    updates: Partial<Omit<Project, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<Project | null> {
    try {
      logger.debug('Updating project:', projectId, updates)

      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', projectId)
        .select()
        .single()

      if (error) {
        logger.error('Error updating project:', error)
        throw new Error(error.message)
      }

      logger.debug('Project updated successfully:', projectId)
      return data
    } catch (error) {
      logger.error('Failed to update project:', error)
      return null
    }
  }

  /**
   * Delete a project
   */
  static async deleteProject(projectId: string): Promise<boolean> {
    try {
      logger.debug('Deleting project:', projectId)

      // In a real implementation, this might also need to handle cascading deletes
      // for related ideas, collaborators, etc.
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)

      if (error) {
        logger.error('Error deleting project:', error)
        return false
      }

      logger.debug('Project deleted successfully:', projectId)
      return true
    } catch (error) {
      logger.error('Failed to delete project:', error)
      return false
    }
  }

  /**
   * Set current project in localStorage
   */
  static setCurrentProject(projectId: string): void {
    try {
      localStorage.setItem('currentProjectId', projectId)
      logger.debug('Current project set:', projectId)
    } catch (error) {
      logger.error('Failed to set current project:', error)
    }
  }

  /**
   * Clear current project from localStorage
   */
  static clearCurrentProject(): void {
    try {
      localStorage.removeItem('currentProjectId')
      logger.debug('Current project cleared')
    } catch (error) {
      logger.error('Failed to clear current project:', error)
    }
  }

  /**
   * Get project statistics
   */
  static async getProjectStats(projectId: string): Promise<{
    ideaCount: number
    collaboratorCount: number
    lastActivity: string | null
  }> {
    try {
      // Get idea count
      const { count: ideaCount, error: ideaError } = await supabase
        .from('ideas')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)

      if (ideaError) {
        logger.error('Error getting idea count:', ideaError)
      }

      // Get collaborator count (placeholder - would need actual collaborators table)
      const collaboratorCount = 1 // Owner

      // Get last activity (most recent idea update)
      const { data: lastActivity, error: activityError } = await supabase
        .from('ideas')
        .select('updated_at')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (activityError && activityError.code !== 'PGRST116') {
        logger.error('Error getting last activity:', activityError)
      }

      return {
        ideaCount: ideaCount || 0,
        collaboratorCount,
        lastActivity: lastActivity?.updated_at || null
      }
    } catch (error) {
      logger.error('Failed to get project stats:', error)
      return {
        ideaCount: 0,
        collaboratorCount: 0,
        lastActivity: null
      }
    }
  }

  /**
   * Subscribe to project changes
   */
  static subscribeToProjects(
    callback: (projects: Project[] | null) => void,
    userId?: string
  ) {
    try {
      const sessionId = Math.random().toString(36).substring(2, 8)
      const channelName = userId
        ? `projects_changes_${userId.replace(/-/g, '_')}_${sessionId}`
        : `projects_changes_anonymous_${sessionId}`

      logger.debug('🔴 Setting up projects real-time subscription:', {
        channelName,
        userId
      })

      // Load initial data
      const loadInitialData = async () => {
        try {
          const projects = userId
            ? await ProjectRepository.getUserOwnedProjects(userId)
            : await ProjectRepository.getAllProjects()
          callback(projects)
        } catch (error) {
          logger.error('Error loading initial projects:', error)
          callback(null)
        }
      }
      loadInitialData()

      // Set up real-time subscription
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'projects',
            ...(userId && { filter: `created_by=eq.${userId}` })
          },
          async (payload) => {
            logger.debug('🔴 Project real-time change detected:', payload.eventType)

            // Refresh projects data
            try {
              const projects = userId
                ? await ProjectRepository.getUserOwnedProjects(userId)
                : await ProjectRepository.getAllProjects()
              callback(projects)
            } catch (error) {
              logger.error('Error refreshing projects:', error)
              callback(null)
            }
          }
        )
        .subscribe()

      // Return unsubscribe function
      return () => {
        logger.debug('🔴 Unsubscribing from projects channel:', channelName)
        supabase.removeChannel(channel)
      }
    } catch (error) {
      logger.error('Failed to set up projects subscription:', error)
      return () => {} // Return empty unsubscribe function
    }
  }

  /**
   * Get project insight by ID
   */
  static async getProjectInsight(insightId: string): Promise<any | null> {
    try {
      logger.debug('Getting project insight:', insightId)

      const { data, error } = await supabase
        .from('project_insights')
        .select('*')
        .eq('id', insightId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null
        }
        logger.error('Error fetching project insight:', error)
        throw new Error(error.message)
      }

      return data
    } catch (error) {
      logger.error('Failed to get project insight:', error)
      return null
    }
  }

  /**
   * Save project insights
   */
  static async saveProjectInsights(
    projectId: string,
    insights: any,
    userId: string,
    ideaCount: number
  ): Promise<string | null> {
    try {
      logger.debug('Saving project insights for project:', projectId)

      const insightData = {
        project_id: projectId,
        insights_data: insights,
        created_by: userId,
        idea_count: ideaCount,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('project_insights')
        .insert([insightData])
        .select()
        .single()

      if (error) {
        logger.error('Error saving project insights:', error)
        throw new Error(error.message)
      }

      logger.debug('Project insights saved successfully:', data.id)
      return data.id
    } catch (error) {
      logger.error('Failed to save project insights:', error)
      return null
    }
  }
}