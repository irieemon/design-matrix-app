import { supabase } from '../supabase'
import { Project } from '../../types'
import { logger } from '../../utils/logger'
import { sanitizeUserId, sanitizeProjectId } from '../../utils/uuid'

// ✅ SECURITY FIX: supabaseAdmin removed from frontend
// All operations use authenticated client with RLS enforcement

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
      logger.debug('getUserOwnedProjects called', { userId })

      // Validate UUID format
      const validUserId = sanitizeUserId(userId)
      logger.debug('Sanitized userId', { validUserId })

      if (!validUserId) {
        logger.debug('Invalid userId, returning empty array')
        logger.warn(`Invalid user ID format for getUserOwnedProjects: ${userId}`)
        return []
      }

      // ✅ SECURITY FIX: Use authenticated client with RLS enforcement
      logger.debug('Fetching projects with authenticated client')

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('owner_id', validUserId)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching user projects:', error)
        throw new Error(error.message)
      }

      logger.debug(`Successfully fetched ${data?.length || 0} projects for user`)
      return data || []
    } catch (error) {
      logger.error('Exception in getUserOwnedProjects', error)
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
      // Ensure project ID is in proper UUID format
      const validProjectId = sanitizeProjectId(projectId)
      if (!validProjectId) {
        logger.warn(`Invalid project ID format: ${projectId}`)
        return null
      }

      // ✅ Use authenticated client with RLS enforcement
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', validProjectId)
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

      // Ensure proper UUID for new project
      const projectId = crypto.randomUUID()
      const projectData = {
        ...project,
        id: projectId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // ✅ Use authenticated client with RLS enforcement
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

      // ✅ Use authenticated client with RLS enforcement
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
      // ✅ Use authenticated client with RLS enforcement
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
      // ✅ Use authenticated client with RLS enforcement
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
          logger.debug('loadInitialData executing', { userId })
          const projects = userId
            ? await ProjectRepository.getUserOwnedProjects(userId)
            : await ProjectRepository.getAllProjects()
          logger.debug('Projects fetched', { count: projects?.length })
          logger.debug('Calling callback with projects')
          callback(projects)
          logger.debug('Callback executed successfully')
        } catch (error) {
          logger.error('Error in loadInitialData', error)
          logger.error('Error loading initial projects:', error)
          callback(null)
        }
      }
      logger.debug('About to call loadInitialData')
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
            ...(userId && { filter: `owner_id=eq.${userId}` })
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

      // ✅ Use authenticated client with RLS enforcement
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
      logger.debug('Saving project insights for project:', projectId, 'with', ideaCount, 'ideas')

      // ✅ Use authenticated client with RLS enforcement
      // Get the next version number
      const { data: existingInsights } = await supabase
        .from('project_insights')
        .select('version')
        .eq('project_id', projectId)
        .order('version', { ascending: false })
        .limit(1)

      const nextVersion = (existingInsights?.[0]?.version || 0) + 1
      const insightsName = `Insights v${nextVersion} - ${new Date().toLocaleDateString()}`

      const insightData = {
        project_id: projectId,
        version: nextVersion,
        name: insightsName,
        insights_data: insights,
        created_by: userId,
        ideas_analyzed: ideaCount
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

  /**
   * ⚠️ DEPRECATED: Admin methods should be backend-only
   * Admin operations MUST use backend API endpoints for security
   */

  /**
   * @deprecated Use backend API: GET /api/admin/projects
   */
  static async adminGetAllProjects(): Promise<Project[]> {
    logger.error('❌ adminGetAllProjects called from frontend - DEPRECATED')
    logger.error('🔒 Admin operations must use backend API: GET /api/admin/projects')
    throw new Error('Admin operations must be performed via backend API endpoints')
  }

  /**
   * @deprecated Use backend API: GET /api/admin/projects/:id
   */
  static async adminGetProjectById(projectId: string): Promise<Project | null> {
    logger.error('❌ adminGetProjectById called from frontend - DEPRECATED')
    logger.error('🔒 Admin operations must use backend API: GET /api/admin/projects/' + projectId)
    throw new Error('Admin operations must be performed via backend API endpoints')
  }

  /**
   * @deprecated Use backend API: GET /api/admin/projects/:id/stats
   */
  static async adminGetProjectStats(projectId: string): Promise<{
    ideaCount: number
    collaboratorCount: number
    lastActivity: string | null
  }> {
    logger.error('❌ adminGetProjectStats called from frontend - DEPRECATED')
    logger.error('🔒 Admin operations must use backend API: GET /api/admin/projects/' + projectId + '/stats')
    throw new Error('Admin operations must be performed via backend API endpoints')
  }
}