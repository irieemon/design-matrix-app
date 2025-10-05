/**
 * IdeaService - Focused service for idea management
 *
 * Handles all idea-related operations including CRUD, locking mechanism,
 * and real-time collaboration features. Extracted from DatabaseService
 * to follow single responsibility principle.
 */

import { BaseService } from './BaseService'
import { supabaseAdmin } from '../supabase'
import type {
  IdeaCard,
  CreateIdeaInput,
  ApiResponse,
  IdeaQueryOptions
} from '../../types'
import type {
  ServiceResult,
  LockInfo,
  ServiceOptions
} from '../../types/service'
import { logger } from '../../utils/logger'
import { sanitizeProjectId } from '../../utils/uuid'

export class IdeaService extends BaseService {
  private static readonly LOCK_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

  /**
   * Get ideas by project with filtering and sorting options
   */
  static async getIdeasByProject(
    projectId?: string,
    options?: IdeaQueryOptions
  ): Promise<ServiceResult<IdeaCard[]>> {
    const context = this.createContext('getIdeasByProject', options?.userId, projectId)

    return this.executeWithRetry(async () => {
      // TEMPORARY SECURITY WORKAROUND: Use service role to bypass RLS
      // Root cause: persistSession: false means Supabase client has no auth session after login
      // TODO: Implement httpOnly cookie-based authentication (see ROOT_CAUSE_IDEAS_NOT_LOADING.md)
      // SECURITY RISK: This bypasses RLS. Must validate user permissions in application layer.
      const supabase = supabaseAdmin

      let query = supabase
        .from('ideas')
        .select('*')
        .order('created_at', { ascending: false })

      // Use projectId parameter first, then fall back to options.projectId
      const effectiveProjectId = projectId || options?.projectId

      if (effectiveProjectId) {
        // Ensure project ID is in proper UUID format before querying
        const validProjectId = sanitizeProjectId(effectiveProjectId)
        if (validProjectId) {
          query = query.eq('project_id', validProjectId)
        } else {
          logger.warn(`Invalid project ID format in getIdeasByProject: ${effectiveProjectId}`)
          // Return empty array for invalid project ID
          return []
        }
      }

      if (options?.status) {
        query = query.eq('status', options.status)
      }

      if (options?.priority) {
        query = query.eq('priority', options.priority)
      }

      if (options?.limit) {
        query = query.limit(options.limit)
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      this.throttledLog(
        `ideas_fetched_${projectId || 'all'}`,
        `📋 Fetched ${data?.length || 0} ideas`,
        { projectId, count: data?.length }
      )

      return data || []
    }, context)
  }

  /**
   * Legacy method for backward compatibility
   */
  static async getAllIdeas(options?: ServiceOptions): Promise<IdeaCard[]> {
    const result = await this.getIdeasByProject(undefined, options)
    return result.success ? result.data : []
  }

  /**
   * Legacy method for backward compatibility
   */
  static async getProjectIdeas(projectId?: string, options?: ServiceOptions): Promise<IdeaCard[]> {
    const result = await this.getIdeasByProject(projectId, options)
    return result.success ? result.data : []
  }

  /**
   * Create a new idea with validation
   */
  static async createIdea(
    idea: CreateIdeaInput,
    options?: ServiceOptions
  ): Promise<ServiceResult<IdeaCard>> {
    const context = this.createContext('createIdea', options?.userId, idea.project_id)

    // Validate input
    const validation = this.validateInput(idea, {
      content: (value) => typeof value === 'string' && value.trim().length > 0,
      details: (value) => typeof value === 'string',
      project_id: (value) => typeof value === 'string' && value.length > 0 && sanitizeProjectId(value) !== null
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
      // TEMPORARY SECURITY WORKAROUND: Use service role (see ROOT_CAUSE_IDEAS_NOT_LOADING.md)
      const supabase = supabaseAdmin

      // Ensure project ID is properly formatted
      const validProjectId = sanitizeProjectId(idea.project_id!)
      if (!validProjectId) {
        throw new Error(`Invalid project ID format: ${idea.project_id}`)
      }

      // Generate ID and timestamps
      const ideaWithMetadata: IdeaCard = {
        ...idea,
        id: crypto.randomUUID().replace(/-/g, '').substring(0, 16),
        project_id: validProjectId,
        created_at: this.formatTimestamp(),
        updated_at: this.formatTimestamp(),
        editing_by: null,
        editing_at: null
      }

      logger.debug('🗃️ IdeaService: Creating idea:', ideaWithMetadata)

      const { data, error } = await supabase
        .from('ideas')
        .insert([ideaWithMetadata])
        .select()
        .single()

      if (error) {
        throw error
      }

      logger.debug('✅ IdeaService: Idea created successfully:', data)
      return data as IdeaCard
    }, context)
  }

  /**
   * Update an existing idea with conflict detection
   */
  static async updateIdea(
    id: string,
    updates: Partial<Omit<IdeaCard, 'id' | 'created_at'>>,
    options?: ServiceOptions
  ): Promise<ServiceResult<IdeaCard>> {
    const context = this.createContext('updateIdea', options?.userId, updates.project_id)

    // Validate input
    if (!id || typeof id !== 'string') {
      return this.createErrorResult({
        code: 'VALIDATION_ERROR',
        message: 'Invalid idea ID',
        operation: context.operation,
        retryable: false,
        details: { provided_id: id },
        timestamp: context.timestamp
      })
    }

    return this.executeWithRetry(async () => {
      // TEMPORARY SECURITY WORKAROUND: Use service role (see ROOT_CAUSE_IDEAS_NOT_LOADING.md)
      const supabase = supabaseAdmin

      // Check if user has permission to edit (if locked by someone else)
      if (options?.userId) {
        const lockCheck = await this.checkEditingLock(id, options.userId)
        if (!lockCheck.canEdit) {
          throw new Error(`Idea is locked by another user until ${lockCheck.lockedUntil}`)
        }
      }

      const updatesWithTimestamp = {
        ...updates,
        updated_at: this.formatTimestamp()
      }

      logger.debug('📝 IdeaService: Updating idea:', { id, updates: updatesWithTimestamp })

      const { data, error } = await supabase
        .from('ideas')
        .update(updatesWithTimestamp)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        throw error
      }

      logger.debug('✅ IdeaService: Idea updated successfully:', data)
      return data as IdeaCard
    }, context)
  }

  /**
   * Delete an idea with permission checking
   */
  static async deleteIdea(id: string, options?: ServiceOptions): Promise<ServiceResult<boolean>> {
    const context = this.createContext('deleteIdea', options?.userId)

    return this.executeWithRetry(async () => {
      // TEMPORARY SECURITY WORKAROUND: Use service role (see ROOT_CAUSE_IDEAS_NOT_LOADING.md)
      const supabase = supabaseAdmin

      // Check if user has permission to delete
      if (options?.userId) {
        const lockCheck = await this.checkEditingLock(id, options.userId)
        if (!lockCheck.canEdit && lockCheck.lockedBy !== options.userId) {
          throw new Error('Cannot delete idea locked by another user')
        }
      }

      logger.debug('🗑️ IdeaService: Deleting idea:', { id })

      const { error } = await supabase
        .from('ideas')
        .delete()
        .eq('id', id)

      if (error) {
        throw error
      }

      logger.debug('✅ IdeaService: Idea deleted successfully')
      return true
    }, context)
  }

  /**
   * Lock an idea for editing with debouncing
   */
  static async lockIdeaForEditing(
    ideaId: string,
    userId: string,
    _options?: ServiceOptions
  ): Promise<ServiceResult<boolean>> {
    const context = this.createContext('lockIdeaForEditing', userId)

    return this.executeWithRetry(async () => {
      // TEMPORARY SECURITY WORKAROUND: Use service role (see ROOT_CAUSE_IDEAS_NOT_LOADING.md)
      const supabase = supabaseAdmin
      // const debounceKey = `${ideaId}_${userId}_lock` // Currently unused

      // Check current lock status
      const { data: existingIdea, error: fetchError } = await supabase
        .from('ideas')
        .select('editing_by, editing_at')
        .eq('id', ideaId)
        .single()

      if (fetchError) {
        throw fetchError
      }

      // Check if locked by someone else (within timeout window)
      if (existingIdea.editing_by && existingIdea.editing_by !== userId) {
        const editingAt = new Date(existingIdea.editing_at || '')
        const now = new Date()
        const timeDiff = now.getTime() - editingAt.getTime()

        if (timeDiff < this.LOCK_TIMEOUT_MS) {
          throw new Error('Idea is currently locked by another user')
        }
      }

      // If already locked by same user, debounce timestamp updates
      if (existingIdea.editing_by === userId) {
        this.throttledLog(
          `lock_debounce_${ideaId}`,
          '🔒 User already has lock, skipping timestamp update',
          undefined,
          10000
        )
        return true
      }

      // Acquire lock
      const { error } = await supabase
        .from('ideas')
        .update({
          editing_by: userId,
          editing_at: this.formatTimestamp()
        })
        .eq('id', ideaId)

      if (error) {
        throw error
      }

      this.throttledLog(
        `lock_acquired_${ideaId}`,
        '🔒 Lock acquired successfully',
        { ideaId, userId }
      )

      return true
    }, context)
  }

  /**
   * Unlock an idea for editing
   */
  static async unlockIdea(
    ideaId: string,
    userId: string,
    _options?: ServiceOptions
  ): Promise<ServiceResult<boolean>> {
    const context = this.createContext('unlockIdea', userId)

    return this.executeWithRetry(async () => {
      // TEMPORARY SECURITY WORKAROUND: Use service role (see ROOT_CAUSE_IDEAS_NOT_LOADING.md)
      const supabase = supabaseAdmin

      // Only unlock if current user owns the lock
      const { error } = await supabase
        .from('ideas')
        .update({
          editing_by: null,
          editing_at: null
        })
        .eq('id', ideaId)
        .eq('editing_by', userId)

      if (error) {
        throw error
      }

      this.throttledLog(
        `lock_released_${ideaId}`,
        '🔓 Lock released successfully',
        { ideaId, userId }
      )

      return true
    }, context)
  }

  /**
   * Clean up stale locks (older than timeout)
   */
  static async cleanupStaleLocks(options?: ServiceOptions): Promise<ServiceResult<number>> {
    const context = this.createContext('cleanupStaleLocks', options?.userId)

    return this.executeWithRetry(async () => {
      // TEMPORARY SECURITY WORKAROUND: Use service role (see ROOT_CAUSE_IDEAS_NOT_LOADING.md)
      const supabase = supabaseAdmin
      const staleTime = new Date(Date.now() - this.LOCK_TIMEOUT_MS).toISOString()

      const { data, error } = await supabase
        .from('ideas')
        .update({
          editing_by: null,
          editing_at: null
        })
        .lt('editing_at', staleTime)
        .not('editing_by', 'is', null)
        .select('id')

      if (error) {
        throw error
      }

      const cleanedCount = data?.length || 0
      if (cleanedCount > 0) {
        logger.debug(`🧹 Cleaned up ${cleanedCount} stale locks`)
      }

      return cleanedCount
    }, context)
  }

  /**
   * Get current lock information for an idea
   */
  static async getLockInfo(ideaId: string, options?: ServiceOptions): Promise<ServiceResult<LockInfo | null>> {
    const context = this.createContext('getLockInfo', options?.userId)

    return this.executeWithRetry(async () => {
      // TEMPORARY SECURITY WORKAROUND: Use service role (see ROOT_CAUSE_IDEAS_NOT_LOADING.md)
      const supabase = supabaseAdmin

      const { data, error } = await supabase
        .from('ideas')
        .select('editing_by, editing_at')
        .eq('id', ideaId)
        .single()

      if (error) {
        throw error
      }

      if (!data.editing_by || !data.editing_at) {
        return null
      }

      const lockInfo: LockInfo = {
        id: ideaId,
        userId: data.editing_by,
        acquired_at: data.editing_at,
        expires_at: new Date(
          new Date(data.editing_at).getTime() + this.LOCK_TIMEOUT_MS
        ).toISOString(),
        operation: 'editing'
      }

      return lockInfo
    }, context)
  }

  /**
   * Helper: Check editing lock status
   */
  private static async checkEditingLock(
    ideaId: string,
    userId: string
  ): Promise<{ canEdit: boolean; lockedBy?: string; lockedUntil?: string }> {
    const lockResult = await this.getLockInfo(ideaId)

    if (!lockResult.success || !lockResult.data) {
      return { canEdit: true }
    }

    const lock = lockResult.data
    const expiresAt = new Date(lock.expires_at)
    const now = new Date()

    // Lock expired
    if (now > expiresAt) {
      return { canEdit: true }
    }

    // Locked by same user
    if (lock.userId === userId) {
      return { canEdit: true }
    }

    // Locked by different user
    return {
      canEdit: false,
      lockedBy: lock.userId,
      lockedUntil: lock.expires_at
    }
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