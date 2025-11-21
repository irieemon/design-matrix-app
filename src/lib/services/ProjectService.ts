/**
 * ProjectService - Focused service for project management
 *
 * Handles all project-related operations including CRUD, user permissions,
 * and real-time collaboration features. Extracted from DatabaseService
 * to follow single responsibility principle.
 */

import { BaseService } from './BaseService'
import type {
  Project,
  CreateProjectInput,
  ApiResponse,
  ProjectQueryOptions
} from '../../types'
import type {
  ServiceResult,
  ServiceOptions
} from '../../types/service'
import { logger } from '../../utils/logger'

export class ProjectService extends BaseService {

  /**
   * Get all projects with filtering and sorting options
   */
  static async getAllProjects(
    options?: ProjectQueryOptions
  ): Promise<ServiceResult<Project[]>> {
    const context = this.createContext('getAllProjects', options?.userId)

    return this.executeWithRetry(async () => {
      const supabase = this.getSupabaseClient()

      let query = supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false })

      if (options?.status) {
        query = query.eq('status', options.status)
      }

      if (options?.type) {
        query = query.eq('project_type', options.type)
      }

      if (options?.ownerId) {
        query = query.eq('owner_id', options.ownerId)
      }

      if (options?.teamId) {
        query = query.eq('team_id', options.teamId)
      }

      if (options?.visibility) {
        query = query.eq('visibility', options.visibility)
      }

      if (options?.limit) {
        query = query.limit(options.limit)
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      this.throttledLog(
        'projects_fetched_all',
        `📋 Fetched ${data?.length || 0} projects`,
        { count: data?.length }
      )

      return data || []
    }, context)
  }

  /**
   * Get projects owned by a specific user
   */
  static async getUserOwnedProjects(
    userId: string,
    _options?: ServiceOptions
  ): Promise<ServiceResult<Project[]>> {
    const context = this.createContext('getUserOwnedProjects', userId)

    // Validate input
    if (!userId || typeof userId !== 'string') {
      return this.createErrorResult({
        code: 'VALIDATION_ERROR',
        message: 'Invalid user ID',
        operation: context.operation,
        retryable: false,
        details: { provided_userId: userId },
        timestamp: context.timestamp
      })
    }

    return this.executeWithRetry(async () => {
      const supabase = this.getSupabaseClient()

      logger.debug('📋 Getting projects owned by user:', userId)

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('owner_id', userId)
        .order('updated_at', { ascending: false })

      if (error) {
        throw error
      }

      logger.debug('✅ Found', data?.length || 0, 'projects for user')
      return data || []
    }, context)
  }

  /**
   * Get current active project
   */
  static async getCurrentProject(
    options?: ServiceOptions
  ): Promise<ServiceResult<Project | null>> {
    const context = this.createContext('getCurrentProject', options?.userId)

    return this.executeWithRetry(async () => {
      const supabase = this.getSupabaseClient()

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)

      if (error) {
        throw error
      }

      // Return the first active project if it exists, null otherwise
      return data && data.length > 0 ? data[0] : null
    }, context)
  }

  /**
   * Get project by ID
   */
  static async getProjectById(
    projectId: string,
    options?: ServiceOptions
  ): Promise<ServiceResult<Project | null>> {
    const context = this.createContext('getProjectById', options?.userId, projectId)

    // Validate input
    if (!projectId || typeof projectId !== 'string') {
      return this.createErrorResult({
        code: 'VALIDATION_ERROR',
        message: 'Invalid project ID',
        operation: context.operation,
        retryable: false,
        details: { provided_projectId: projectId },
        timestamp: context.timestamp
      })
    }

    return this.executeWithRetry(async () => {
      const supabase = this.getSupabaseClient()

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (error) {
        // Handle not found as null rather than error
        if (error.code === 'PGRST116') {
          return null
        }
        throw error
      }

      return data
    }, context)
  }

  /**
   * Get all projects accessible to a user (owned + collaborated)
   */
  static async getUserProjects(
    userId: string,
    _options?: ServiceOptions
  ): Promise<ServiceResult<Project[]>> {
    const context = this.createContext('getUserProjects', userId)

    // Validate input
    if (!userId || typeof userId !== 'string') {
      return this.createErrorResult({
        code: 'VALIDATION_ERROR',
        message: 'Invalid user ID',
        operation: context.operation,
        retryable: false,
        details: { provided_userId: userId },
        timestamp: context.timestamp
      })
    }

    return this.executeWithRetry(async () => {
      const supabase = this.getSupabaseClient()

      // Get projects where user is owner
      const { data: ownedProjects, error: ownedError } = await supabase
        .from('projects')
        .select('*')
        .eq('owner_id', userId)
        .order('updated_at', { ascending: false })

      // Get projects where user is collaborator
      const { data: collaborations, error: collabError } = await supabase
        .from('project_collaborators')
        .select(`
          project:projects(*)
        `)
        .eq('user_id', userId)
        .eq('status', 'active')

      const collaboratedProjects = collaborations?.map((c: any) => c.project).filter(Boolean) || []

      if (ownedError || collabError) {
        logger.error('Error fetching user projects:', { ownedError, collabError })
        throw ownedError || collabError
      }

      // Combine and deduplicate projects
      const allProjects = [...(ownedProjects || []), ...collaboratedProjects]
      const uniqueProjects = allProjects.filter((project, index, arr) =>
        arr.findIndex(p => p.id === project.id) === index
      )

      return uniqueProjects
    }, context)
  }

  /**
   * Create a new project with validation
   */
  static async createProject(
    project: CreateProjectInput,
    options?: ServiceOptions
  ): Promise<ServiceResult<Project>> {
    const context = this.createContext('createProject', options?.userId)

    // Validate input
    const validation = this.validateInput(project, {
      name: (value) => typeof value === 'string' && value.trim().length > 0,
      project_type: (value) => typeof value === 'string' && value.length > 0,
      status: (value) => typeof value === 'string' && ['active', 'completed', 'paused', 'archived'].includes(value),
      visibility: (value) => typeof value === 'string' && ['private', 'team', 'public'].includes(value),
      priority_level: (value) => typeof value === 'string' && ['low', 'medium', 'high', 'critical'].includes(value),
      owner_id: (value) => typeof value === 'string' && value.length > 0
    })

    if (!validation.valid) {
      return this.createErrorResult({
        code: 'VALIDATION_ERROR',
        message: validation.errors.join(', '),
        operation: context.operation,
        retryable: false,
        details: { errors: validation.errors },
        timestamp: context.timestamp
      })
    }

    return this.executeWithRetry(async () => {
      const supabase = this.getSupabaseClient()

      // Generate ID and timestamps
      const projectWithMetadata: Project = {
        ...project,
        id: crypto.randomUUID(),
        created_at: this.formatTimestamp(),
        updated_at: this.formatTimestamp()
      }

      logger.debug('🗃️ ProjectService: Creating project:', projectWithMetadata)

      const { data, error } = await supabase
        .from('projects')
        .insert([projectWithMetadata])
        .select()
        .single()

      if (error) {
        throw error
      }

      logger.debug('✅ ProjectService: Project created successfully:', data)
      return data as Project
    }, context)
  }

  /**
   * Update an existing project with validation
   */
  static async updateProject(
    projectId: string,
    updates: Partial<Omit<Project, 'id' | 'created_at'>>,
    options?: ServiceOptions
  ): Promise<ServiceResult<Project>> {
    const context = this.createContext('updateProject', options?.userId, projectId)

    // Validate input
    if (!projectId || typeof projectId !== 'string') {
      return this.createErrorResult({
        code: 'VALIDATION_ERROR',
        message: 'Invalid project ID',
        operation: context.operation,
        retryable: false,
        details: { provided_projectId: projectId },
        timestamp: context.timestamp
      })
    }

    return this.executeWithRetry(async () => {
      const supabase = this.getSupabaseClient()

      // Check permissions if user ID provided
      if (options?.userId) {
        const hasPermission = await this.checkPermissions(
          options.userId,
          projectId,
          'project',
          'write'
        )

        if (!hasPermission) {
          throw new Error('Insufficient permissions to update project')
        }
      }

      const updatesWithTimestamp = {
        ...updates,
        updated_at: this.formatTimestamp()
      }

      logger.debug('📝 ProjectService: Updating project:', { projectId, updates: updatesWithTimestamp })

      const { data, error } = await supabase
        .from('projects')
        .update(updatesWithTimestamp)
        .eq('id', projectId)
        .select()
        .single()

      if (error) {
        throw error
      }

      logger.debug('✅ ProjectService: Project updated successfully:', data)
      return data as Project
    }, context)
  }

  /**
   * Delete a project with permission checking
   */
  static async deleteProject(
    projectId: string,
    options?: ServiceOptions
  ): Promise<ServiceResult<boolean>> {
    const context = this.createContext('deleteProject', options?.userId, projectId)

    // Validate input
    if (!projectId || typeof projectId !== 'string') {
      return this.createErrorResult({
        code: 'VALIDATION_ERROR',
        message: 'Invalid project ID',
        operation: context.operation,
        retryable: false,
        details: { provided_projectId: projectId },
        timestamp: context.timestamp
      })
    }

    return this.executeWithRetry(async () => {
      const supabase = this.getSupabaseClient()

      // Check permissions if user ID provided
      if (options?.userId) {
        const hasPermission = await this.checkPermissions(
          options.userId,
          projectId,
          'project',
          'delete'
        )

        if (!hasPermission) {
          throw new Error('Insufficient permissions to delete project')
        }
      }

      logger.debug('🗑️ ProjectService: Deleting project:', { projectId })

      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)

      if (error) {
        throw error
      }

      logger.debug('✅ ProjectService: Project deleted successfully')
      return true
    }, context)
  }

  /**
   * Subscribe to real-time project changes
   */
  static subscribeToProjects(
    callback: (projects: Project[]) => void,
    options?: ServiceOptions
  ) {
    logger.debug('📡 Setting up real-time subscription for projects...')

    const sessionId = Math.random().toString(36).substring(2, 8)
    const channelName = options?.userId
      ? `projects_changes_${options.userId.replace(/-/g, '_')}_${sessionId}`
      : `projects_changes_anonymous_${sessionId}`

    logger.debug('🔄 Creating unique channel:', channelName)

    const channel = this.getSupabaseClient()
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects'
        },
        async (payload: any) => {
          logger.debug('📡 Real-time project update:', payload.eventType)
          logger.debug('🔄 Payload data:', payload)

          // Fetch all projects and update
          const result = await this.getAllProjects()
          if (result.success) {
            callback(result.data)
          } else {
            logger.error('❌ Error refreshing projects:', result.error)
            callback([]) // Fallback to empty array
          }
        }
      )
      .subscribe((status: any) => {
        logger.debug('📡 Projects subscription status:', status)
      })

    // Return unsubscribe function
    return () => {
      logger.debug('📡 Unsubscribing from project updates')
      this.getSupabaseClient().removeChannel(channel)
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  static async legacyGetAllProjects(): Promise<Project[]> {
    const result = await this.getAllProjects()
    return result.success ? result.data : []
  }

  /**
   * Legacy method for backward compatibility
   */
  static async legacyGetUserOwnedProjects(userId: string): Promise<Project[]> {
    const result = await this.getUserOwnedProjects(userId)
    return result.success ? result.data : []
  }

  /**
   * Legacy method for backward compatibility
   */
  static async legacyGetCurrentProject(): Promise<Project | null> {
    const result = await this.getCurrentProject()
    return result.success ? result.data : null
  }

  /**
   * Legacy method for backward compatibility
   */
  static async legacyGetProjectById(projectId: string): Promise<Project | null> {
    const result = await this.getProjectById(projectId)
    return result.success ? result.data : null
  }

  /**
   * Legacy method for backward compatibility
   */
  static async legacyGetUserProjects(userId: string): Promise<Project[]> {
    const result = await this.getUserProjects(userId)
    return result.success ? result.data : []
  }

  /**
   * Legacy method for backward compatibility
   */
  static async legacyCreateProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project | null> {
    const result = await this.createProject(project)
    return result.success ? result.data : null
  }

  /**
   * Legacy method for backward compatibility
   */
  static async legacyUpdateProject(
    projectId: string,
    updates: Partial<Omit<Project, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<Project | null> {
    const result = await this.updateProject(projectId, updates)
    return result.success ? result.data : null
  }

  /**
   * Legacy method for backward compatibility
   */
  static async legacyDeleteProject(projectId: string): Promise<boolean> {
    const result = await this.deleteProject(projectId)
    return result.success ? result.data : false
  }

  /**
   * Convert service result to legacy ApiResponse format for backward compatibility
   */
  static serviceResultToApiResponse<T>(result: ServiceResult<T>): ApiResponse<T> {
    if (result.success) {
      return {
        success: true,
        data: result.data,
        timestamp: new Date().toISOString(),
        meta: Array.isArray(result.data) ? { total: result.data.length } : undefined
      }
    } else {
      return {
        success: false,
        error: {
          type: 'server',
          message: result.error.message,
          code: result.error.code
        },
        timestamp: result.error.timestamp
      }
    }
  }
}