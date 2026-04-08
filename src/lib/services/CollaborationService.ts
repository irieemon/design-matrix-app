/**
 * CollaborationService - Focused service for project collaboration
 *
 * Handles all collaboration-related operations including collaborator management,
 * role assignments, permissions, and real-time collaboration features.
 * Extracted from DatabaseService to follow single responsibility principle.
 */

import { BaseService } from './BaseService'
import { EmailService } from '../emailService'
import type {
  ProjectCollaborator,
  ProjectRole,
  ApiResponse
} from '../../types'
import type {
  ServiceResult,
  ServiceOptions
} from '../../types/service'
import { logger } from '../../utils/logger'

export interface AddCollaboratorInput {
  projectId: string
  userEmail: string
  role?: ProjectRole
  invitedBy: string
  projectName?: string
  inviterName?: string
  inviterEmail?: string
}

export interface CollaboratorWithUser extends ProjectCollaborator {
  user: {
    id: string
    email: string
    created_at: string
    updated_at: string
    raw_user_meta_data: {
      full_name: string
    }
  }
  status?: 'active' | 'pending'
}

export class CollaborationService extends BaseService {

  /**
   * Add a new collaborator to a project
   */
  static async addProjectCollaborator(
    input: AddCollaboratorInput,
    _options?: ServiceOptions
  ): Promise<ServiceResult<boolean>> {
    const context = this.createContext('addProjectCollaborator', input.invitedBy, input.projectId)

    // Validate input
    const validation = this.validateInput(input, {
      projectId: (value) => typeof value === 'string' && value.length > 0,
      userEmail: (value) => typeof value === 'string' && value.includes('@'),
      invitedBy: (value) => typeof value === 'string' && value.length > 0,
      role: (value) => !value || ['owner', 'editor', 'commenter', 'viewer'].includes(value)
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
      const { projectId, userEmail, role = 'viewer', invitedBy, projectName, inviterName, inviterEmail } = input

      logger.debug('🔍 Looking up user by email:', userEmail)

      // Generate mock user ID for demo purposes
      // In production, this would be handled by proper user management
      const mockUserId = btoa(userEmail).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)
      logger.debug('🆔 Generated mock user ID:', mockUserId, 'for email:', userEmail)

      // SECURITY FIX: Removed PII storage per PRIO-SEC-002 (CVSS 7.8)
      // Previous code stored user emails in localStorage (GDPR violation)
      // Email mappings should be stored in database with proper RLS policies

      // Check for existing collaboration by querying database
      const existingMockIds = [mockUserId] // Only check current mock ID
      logger.debug('🔍 Checking for existing collaboration with ID:', mockUserId)

      if (existingMockIds.length > 0) {
        const { data: existingCollaborations } = await supabase
          .from('project_collaborators')
          .select('id, user_id')
          .eq('project_id', projectId)
          .in('user_id', existingMockIds)

        if (existingCollaborations && existingCollaborations.length > 0) {
          throw new Error('This email is already a collaborator on this project')
        }
      }

      logger.debug('✅ No existing collaboration found, proceeding with invitation')

      // Add collaborator with pending status
      const { error } = await supabase
        .from('project_collaborators')
        .insert([{
          project_id: projectId,
          user_id: mockUserId,
          role,
          invited_by: invitedBy,
          status: 'pending'
        }])

      if (error) {
        logger.error('❌ Error adding collaborator:', error)
        throw error
      }

      logger.debug('✅ Collaborator invitation created successfully')
      logger.debug('📋 Added collaborator with details:', { projectId, mockUserId, role, invitedBy })

      // Send email invitation
      logger.debug('📧 Sending email invitation to:', userEmail)

      try {
        const invitationUrl = EmailService.generateInvitationUrl(projectId)
        const emailSuccess = await EmailService.sendCollaborationInvitation({
          inviterName: inviterName || 'Project Owner',
          inviterEmail: inviterEmail || 'noreply@prioritas.app',
          inviteeEmail: userEmail,
          projectName: projectName || 'Untitled Project',
          role,
          invitationUrl
        })

        if (emailSuccess) {
          logger.debug('✅ Email invitation sent successfully!')
        } else {
          logger.debug('⚠️ Email sending failed, but invitation record was created')
        }
      } catch (emailError) {
        logger.error('❌ Error sending email invitation:', emailError)
        logger.debug('⚠️ Database record created but email failed')
      }

      return true
    }, context)
  }

  /**
   * Get all collaborators for a project with user data
   */
  static async getProjectCollaborators(
    projectId: string,
    options?: ServiceOptions
  ): Promise<ServiceResult<CollaboratorWithUser[]>> {
    const context = this.createContext('getProjectCollaborators', options?.userId, projectId)

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

      logger.debug('🔍 CollaborationService: Fetching collaborators for project:', projectId)

      const { data, error } = await supabase
        .from('project_collaborators')
        .select('*')
        .eq('project_id', projectId)
        .in('status', ['active', 'pending'])

      logger.debug('📊 CollaborationService: Raw collaborator query result:', { data, error })

      if (error) {
        throw error
      }

      if (!data || data.length === 0) {
        logger.debug('📋 CollaborationService: No collaborators found for project:', projectId)
        return []
      }

      // SECURITY FIX: Removed localStorage email mappings per PRIO-SEC-002 (CVSS 7.8)
      // Previous code read PII from localStorage (GDPR violation)
      // In production, emails should be fetched from database with proper RLS

      // For demo purposes: Generate display email from user_id
      // In production: Join with user_profiles table to get actual email
      const collaboratorsWithUserData: CollaboratorWithUser[] = (data || []).map((collaborator: any) => {
        // Demo: Decode base64-encoded email from user_id (reverse of btoa encoding)
        let actualEmail: string
        try {
          // Attempt to decode user_id back to email (for demo compatibility)
          actualEmail = atob(collaborator.user_id) || `user${collaborator.user_id.substring(0, 8)}@example.com`
        } catch {
          // If decode fails, use placeholder
          actualEmail = `user${collaborator.user_id.substring(0, 8)}@example.com`
        }
        const userName = actualEmail.split('@')[0]

        const result: CollaboratorWithUser = {
          ...collaborator,
          invited_at: collaborator.invited_at || new Date().toISOString(),
          user: {
            id: collaborator.user_id,
            email: actualEmail,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            raw_user_meta_data: {
              full_name: userName.charAt(0).toUpperCase() + userName.slice(1)
            }
          }
        }

        logger.debug('👤 CollaborationService: Processed collaborator:', result)
        return result
      })

      logger.debug('✅ CollaborationService: Returning collaborators with user data:', collaboratorsWithUserData)
      return collaboratorsWithUserData
    }, context)
  }

  /**
   * Remove a collaborator from a project
   */
  static async removeProjectCollaborator(
    projectId: string,
    userId: string,
    options?: ServiceOptions
  ): Promise<ServiceResult<boolean>> {
    const context = this.createContext('removeProjectCollaborator', options?.userId, projectId)

    // Validate input
    const validation = this.validateInput({ projectId, userId }, {
      projectId: (value) => typeof value === 'string' && value.length > 0,
      userId: (value) => typeof value === 'string' && value.length > 0
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

      // Check permissions if current user ID provided
      if (options?.userId) {
        const hasPermission = await this.checkPermissions(
          options.userId,
          projectId,
          'project',
          'write'
        )

        if (!hasPermission) {
          throw new Error('Insufficient permissions to remove collaborator')
        }
      }

      const { error } = await supabase
        .from('project_collaborators')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId)

      if (error) {
        throw error
      }

      logger.debug('✅ Collaborator removed successfully')
      return true
    }, context)
  }

  /**
   * Update a collaborator's role
   */
  static async updateCollaboratorRole(
    projectId: string,
    userId: string,
    newRole: ProjectRole,
    options?: ServiceOptions
  ): Promise<ServiceResult<boolean>> {
    const context = this.createContext('updateCollaboratorRole', options?.userId, projectId)

    // Validate input
    const validation = this.validateInput({ projectId, userId, newRole }, {
      projectId: (value) => typeof value === 'string' && value.length > 0,
      userId: (value) => typeof value === 'string' && value.length > 0,
      newRole: (value) => typeof value === 'string' && ['owner', 'editor', 'commenter', 'viewer'].includes(value)
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

      // Check permissions if current user ID provided
      if (options?.userId) {
        const hasPermission = await this.checkPermissions(
          options.userId,
          projectId,
          'project',
          'write'
        )

        if (!hasPermission) {
          throw new Error('Insufficient permissions to update collaborator role')
        }
      }

      const { error } = await supabase
        .from('project_collaborators')
        .update({
          role: newRole,
          updated_at: this.formatTimestamp()
        })
        .eq('project_id', projectId)
        .eq('user_id', userId)

      if (error) {
        throw error
      }

      logger.debug('✅ Collaborator role updated successfully')
      return true
    }, context)
  }

  /**
   * Get a user's role in a specific project
   */
  static async getUserProjectRole(
    projectId: string,
    userId: string,
    _options?: ServiceOptions
  ): Promise<ServiceResult<ProjectRole | null>> {
    const context = this.createContext('getUserProjectRole', userId, projectId)

    // Validate input
    const validation = this.validateInput({ projectId, userId }, {
      projectId: (value) => typeof value === 'string' && value.length > 0,
      userId: (value) => typeof value === 'string' && value.length > 0
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

      // Check if user owns the project
      const { data: project } = await supabase
        .from('projects')
        .select('owner_id')
        .eq('id', projectId)
        .single()

      if (project && project.owner_id === userId) {
        return 'owner' as ProjectRole
      }

      // Check collaborator role
      const { data: collaborator, error } = await supabase
        .from('project_collaborators')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()

      if (error || !collaborator) {
        return null
      }

      return collaborator.role as ProjectRole
    }, context)
  }

  /**
   * Check if a user can access a project
   */
  static async canUserAccessProject(
    projectId: string,
    userId: string,
    options?: ServiceOptions
  ): Promise<ServiceResult<boolean>> {
    const roleResult = await this.getUserProjectRole(projectId, userId, options)
    if (!roleResult.success) {
      return roleResult as ServiceResult<boolean>
    }

    return this.createSuccessResult(roleResult.data !== null)
  }

  /**
   * Subscribe to real-time collaborator changes for a project
   */
  static subscribeToProjectCollaborators(
    projectId: string,
    callback: (collaborators: CollaboratorWithUser[]) => void,
    options?: ServiceOptions
  ) {
    logger.debug('📡 Setting up real-time subscription for project collaborators...')

    const sessionId = Math.random().toString(36).substring(2, 8)
    const channelName = options?.userId
      ? `project_collaborators_${projectId}_${options.userId.replace(/-/g, '_')}_${sessionId}`
      : `project_collaborators_${projectId}_anonymous_${sessionId}`

    logger.debug('🔄 Creating unique channel:', channelName)

    const channel = this.getSupabaseClient()
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_collaborators',
          filter: `project_id=eq.${projectId}`
        },
        async (payload: any) => {
          logger.debug('📡 Real-time collaborator update:', payload.eventType)
          logger.debug('🔄 Payload data:', payload)

          // Fetch updated collaborators
          const result = await this.getProjectCollaborators(projectId, options)
          if (result.success) {
            callback(result.data)
          } else {
            logger.error('❌ Error refreshing collaborators:', result.error)
            callback([]) // Fallback to empty array
          }
        }
      )
      .subscribe((status: any) => {
        logger.debug('📡 Project collaborators subscription status:', status)
      })

    // Return unsubscribe function
    return () => {
      logger.debug('📡 Unsubscribing from project collaborators updates')
      this.getSupabaseClient().removeChannel(channel)
    }
  }

  /**
   * Convert service result to ApiResponse format
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