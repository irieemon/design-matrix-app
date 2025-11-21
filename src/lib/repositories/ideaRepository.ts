import { supabase } from '../supabase'
import { IdeaCard } from '../../types'
import { logger } from '../../utils/logger'
import { ApiResponse, createSuccessResponse, createErrorResponse, handleSupabaseError } from './types'

export interface CreateIdeaInput {
  content: string
  details: string
  x: number
  y: number
  priority: 'low' | 'moderate' | 'high' | 'strategic' | 'innovation'
  created_by?: string
  project_id?: string
}

/**
 * Idea Repository
 *
 * Handles all database operations related to ideas including
 * CRUD operations, locking, and project-specific queries.
 */
export class IdeaRepository {
  /**
   * Get all ideas across all projects
   */
  static async getAllIdeas(): Promise<IdeaCard[]> {
    try {
      const { data, error } = await supabase
        .from('ideas')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching all ideas:', error)
        throw new Error(error.message)
      }

      return data || []
    } catch (_error) {
      logger.error('Failed to get all ideas:', error)
      throw error
    }
  }

  /**
   * Get ideas for a specific project
   */
  static async getProjectIdeas(projectId: string): Promise<IdeaCard[]> {
    try {
      const { data, error } = await supabase
        .from('ideas')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Error fetching project ideas:', error)
        throw new Error(error.message)
      }

      return data || []
    } catch (_error) {
      logger.error('Failed to get project ideas:', error)
      throw error
    }
  }

  /**
   * Get ideas by project with optional user filtering
   */
  static async getIdeasByProject(
    projectId?: string,
    userId?: string,
    includePublic: boolean = true
  ): Promise<IdeaCard[]> {
    try {
      let query = supabase.from('ideas').select('*')

      if (projectId) {
        query = query.eq('project_id', projectId)
      }

      if (userId && !includePublic) {
        query = query.eq('created_by', userId)
      }

      query = query.order('created_at', { ascending: false })

      const { data, error } = await query

      if (error) {
        logger.error('Error fetching ideas by project:', error)
        throw new Error(error.message)
      }

      return data || []
    } catch (_error) {
      logger.error('Failed to get ideas by project:', error)
      throw error
    }
  }

  /**
   * Create a new idea
   */
  static async createIdea(idea: CreateIdeaInput): Promise<ApiResponse<IdeaCard>> {
    try {
      logger.debug('Creating idea:', { content: idea.content, x: idea.x, y: idea.y })

      const ideaData = {
        content: idea.content,
        details: idea.details,
        x: idea.x,
        y: idea.y,
        priority: idea.priority,
        created_by: idea.created_by || null,
        project_id: idea.project_id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('ideas')
        .insert([ideaData])
        .select()
        .single()

      if (error) {
        logger.error('Error creating idea:', error)
        return handleSupabaseError<IdeaCard>(error, 'Create idea')
      }

      logger.debug('Idea created successfully:', data.id)
      return createSuccessResponse(data)
    } catch (_error) {
      logger.error('Failed to create idea:', error)
      return createErrorResponse<IdeaCard>(
        error instanceof Error ? error.message : 'Unknown error occurred',
        'EXCEPTION'
      )
    }
  }

  /**
   * Update an existing idea
   */
  static async updateIdea(
    id: string,
    updates: Partial<Omit<IdeaCard, 'id' | 'created_at'>>
  ): Promise<IdeaCard | null> {
    try {
      logger.debug('Updating idea:', id, updates)

      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('ideas')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        logger.error('Error updating idea:', error)
        throw new Error(error.message)
      }

      logger.debug('Idea updated successfully:', id)
      return data
    } catch (_error) {
      logger.error('Failed to update idea:', error)
      return null
    }
  }

  /**
   * Delete an idea
   */
  static async deleteIdea(id: string): Promise<boolean> {
    try {
      logger.debug('Deleting idea:', id)

      const { error } = await supabase
        .from('ideas')
        .delete()
        .eq('id', id)

      if (error) {
        logger.error('Error deleting idea:', error)
        return false
      }

      logger.debug('Idea deleted successfully:', id)
      return true
    } catch (_error) {
      logger.error('Failed to delete idea:', error)
      return false
    }
  }

  /**
   * Lock an idea for editing
   */
  static async lockIdeaForEditing(ideaId: string, userId: string): Promise<boolean> {
    try {
      logger.debug('Locking idea for editing:', { ideaId, userId })

      // First check if idea is already locked by someone else
      const { data: existingIdea, error: fetchError } = await supabase
        .from('ideas')
        .select('editing_by, editing_at')
        .eq('id', ideaId)
        .single()

      if (fetchError) {
        logger.error('Error fetching idea for lock check:', fetchError)
        return false
      }

      // Check if already locked by someone else (within last 5 minutes)
      if (existingIdea.editing_by && existingIdea.editing_by !== userId) {
        const editingAt = new Date(existingIdea.editing_at)
        const now = new Date()
        const timeDiff = now.getTime() - editingAt.getTime()
        const fiveMinutes = 5 * 60 * 1000

        if (timeDiff < fiveMinutes) {
          logger.debug('Idea is already locked by another user:', existingIdea.editing_by)
          return false
        }
      }

      // Lock the idea
      const { error: updateError } = await supabase
        .from('ideas')
        .update({
          editing_by: userId,
          editing_at: new Date().toISOString()
        })
        .eq('id', ideaId)

      if (updateError) {
        logger.error('Error locking idea:', updateError)
        return false
      }

      logger.debug('Idea locked successfully:', ideaId)
      return true
    } catch (_error) {
      logger.error('Failed to lock idea:', error)
      return false
    }
  }

  /**
   * Unlock an idea
   */
  static async unlockIdea(ideaId: string, userId: string): Promise<boolean> {
    try {
      logger.debug('Unlocking idea:', { ideaId, userId })

      const { error } = await supabase
        .from('ideas')
        .update({
          editing_by: null,
          editing_at: null
        })
        .eq('id', ideaId)
        .eq('editing_by', userId) // Only unlock if locked by this user

      if (error) {
        logger.error('Error unlocking idea:', error)
        return false
      }

      logger.debug('Idea unlocked successfully:', ideaId)
      return true
    } catch (_error) {
      logger.error('Failed to unlock idea:', error)
      return false
    }
  }

  /**
   * Clean up stale locks (ideas locked for more than 5 minutes)
   */
  static async cleanupStaleLocks(): Promise<void> {
    try {
      logger.debug('Cleaning up stale idea locks')

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

      const { error } = await supabase
        .from('ideas')
        .update({
          editing_by: null,
          editing_at: null
        })
        .lt('editing_at', fiveMinutesAgo)
        .not('editing_by', 'is', null)

      if (error) {
        logger.error('Error cleaning up stale locks:', error)
        return
      }

      logger.debug('Stale locks cleaned up successfully')
    } catch (_error) {
      logger.error('Failed to cleanup stale locks:', error)
    }
  }

  /**
   * Get ideas locked by a specific user
   */
  static async getLockedIdeasByUser(userId: string): Promise<IdeaCard[]> {
    try {
      const { data, error } = await supabase
        .from('ideas')
        .select('*')
        .eq('editing_by', userId)
        .order('editing_at', { ascending: false })

      if (error) {
        logger.error('Error fetching locked ideas:', error)
        throw new Error(error.message)
      }

      return data || []
    } catch (_error) {
      logger.error('Failed to get locked ideas:', error)
      return []
    }
  }

  /**
   * Subscribe to real-time idea changes for a project
   */
  static subscribeToIdeas(
    callback: (ideas: IdeaCard[] | null) => void,
    projectId?: string,
    userId?: string,
    options: { skipInitialLoad?: boolean } = {}
  ) {
    try {
      const sessionId = Math.random().toString(36).substring(2, 8)
      const channelName = userId
        ? `ideas_changes_${userId.replace(/-/g, '_')}_${sessionId}`
        : `ideas_changes_anonymous_${sessionId}`

      logger.debug('🔴 Setting up real-time subscription:', {
        channelName,
        projectId,
        userId,
        skipInitialLoad: options.skipInitialLoad
      })

      // Load initial data if not skipped
      if (!options.skipInitialLoad) {
        const loadInitialData = async () => {
          try {
            const ideas = projectId
              ? await IdeaRepository.getProjectIdeas(projectId)
              : await IdeaRepository.getAllIdeas()
            callback(ideas)
          } catch (_error) {
            logger.error('Error loading initial ideas:', error)
            callback(null)
          }
        }
        loadInitialData()
      }

      // Set up real-time subscription
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ideas',
            ...(projectId && { filter: `project_id=eq.${projectId}` })
          },
          (payload) => {
            logger.debug('🔴 Real-time change detected:', payload.eventType)
            logger.debug('🔒 SIMPLIFIED: Allowing all real-time changes to fix subscription binding')
            logger.debug('✅ Real-time callback executing - refreshing ideas')

            // Refresh ideas data
            const refreshData = async () => {
              try {
                const ideas = projectId
                  ? await IdeaRepository.getProjectIdeas(projectId)
                  : await IdeaRepository.getAllIdeas()
                callback(ideas)
              } catch (_error) {
                logger.error('Error refreshing ideas:', error)
                callback(null)
              }
            }
            refreshData()
          }
        )
        .subscribe()

      // Return unsubscribe function
      return () => {
        logger.debug('🔴 Unsubscribing from ideas channel:', channelName)
        supabase.removeChannel(channel)
      }
    } catch (_error) {
      logger.error('Failed to set up ideas subscription:', error)
      return () => {} // Return empty unsubscribe function
    }
  }
}