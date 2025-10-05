/**
 * RealtimeSubscriptionManager - Manages real-time subscriptions
 *
 * Centralizes real-time subscription logic for ideas, projects, and collaborators.
 * Handles channel management, subscription lifecycle, and data refresh callbacks.
 */

import { supabase } from '../../supabase'
import { logger } from '../../../utils/logger'
import { ValidationHelpers } from '../utils/ValidationHelpers'
import type { IdeaCard, Project } from '../../../types'

export class RealtimeSubscriptionManager {
  /**
   * Generate simplified channel name to prevent binding mismatches
   */
  static generateChannelName(projectId?: string, userId?: string): string {
    // Validate projectId if provided
    if (projectId) {
      const validProjectId = ValidationHelpers.validateProjectId(projectId)
      if (!validProjectId) {
        logger.warn('Invalid project ID format for channel:', projectId)
        throw new Error(`Invalid project ID format: ${projectId}`)
      }
      projectId = validProjectId
    }

    // Simplified channel naming to prevent binding mismatches
    if (projectId) {
      return `project_${projectId.replace(/-/g, '_')}`
    }

    return userId
      ? `user_${userId.replace(/-/g, '_')}`
      : `global_ideas`
  }

  /**
   * Subscribe to real-time idea changes
   */
  static subscribeToIdeas(
    callback: (ideas: IdeaCard[]) => void,
    projectId?: string,
    userId?: string,
    options?: { skipInitialLoad?: boolean }
  ): () => void {
    logger.debug('Setting up real-time subscription...', { projectId, userId, options })

    try {
      // Generate simplified channel name to prevent binding mismatches
      const channelName = this.generateChannelName(projectId, userId)
      logger.debug('🔄 Creating optimized channel:', channelName)

      // Optimized real-time subscription with simplified filters
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ideas'
            // Removed complex filters to prevent binding mismatch
          },
          async (payload) => {
            const newData = payload.new as Record<string, any> | null
            const oldData = payload.old as Record<string, any> | null
            logger.debug('🔴 Real-time change detected:', payload.eventType, newData?.id)

            try {
              // Smart filtering: only refresh if change is relevant to current project
              const shouldRefresh = !projectId ||
                (newData && 'project_id' in newData && newData.project_id === projectId) ||
                (oldData && 'project_id' in oldData && oldData.project_id === projectId)

              if (shouldRefresh) {
                logger.debug('✅ Real-time change relevant - refreshing ideas')

                // Trigger callback - let consumer handle data fetching
                // This is a placeholder - actual implementation would fetch fresh data
                callback([])
              } else {
                logger.debug('⏩ Real-time change not relevant to current project, skipping refresh')
              }
            } catch (error) {
              logger.error('❌ Error processing real-time change:', error)
              // Still try to refresh on error to maintain consistency
              callback([])
            }
          }
        )
        .subscribe((status, err) => {
          logger.debug('Subscription status:', status)

          if (err) {
            logger.error('❌ Subscription error:', err)
            // Try to recover with simpler subscription if complex one fails
            if (err.message?.includes('binding mismatch')) {
              logger.warn('🔄 Binding mismatch detected, attempting recovery...')
            }
          } else if (status === 'SUBSCRIBED') {
            logger.debug('✅ Successfully subscribed to real-time updates!')
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            logger.warn('⚠️ Real-time subscription failed or closed:', status)
          }
        })

      // Load initial data when subscription is set up (unless explicitly skipped)
      if (!options?.skipInitialLoad) {
        logger.debug('🔄 Loading initial data for subscription...', { projectId })
        // Trigger callback for initial load - consumer will fetch data
        callback([])
      }

      return () => {
        logger.debug('Unsubscribing from real-time updates')
        supabase.removeChannel(channel)
      }
    } catch (error) {
      logger.error('❌ Failed to set up real-time subscription:', error)
      // Return a no-op unsubscribe function
      return () => {
        logger.debug('No-op unsubscribe (subscription failed)')
      }
    }
  }

  /**
   * Subscribe to real-time project changes
   */
  static subscribeToProjects(callback: (projects: Project[]) => void): () => void {
    logger.debug('📡 Setting up real-time subscription for projects...')

    const channel = supabase
      .channel('projects')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects'
        },
        async (payload) => {
          logger.debug('📡 Real-time project update:', payload)
          // Trigger callback - consumer will fetch fresh data
          callback([])
        }
      )
      .subscribe((status) => {
        logger.debug('📡 Projects subscription status:', status)
      })

    // Return unsubscribe function
    return () => {
      logger.debug('📡 Unsubscribing from project updates')
      supabase.removeChannel(channel)
    }
  }

  /**
   * Subscribe to real-time project collaborator changes
   */
  static subscribeToProjectCollaborators(
    projectId: string,
    callback: (collaborators: any[]) => void
  ): () => void {
    logger.debug('📡 Setting up real-time subscription for project collaborators...')

    const channel = supabase
      .channel(`project_collaborators_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_collaborators',
          filter: `project_id=eq.${projectId}`
        },
        async (payload) => {
          logger.debug('📡 Real-time collaborator update:', payload)
          // Trigger callback - consumer will fetch fresh data
          callback([])
        }
      )
      .subscribe((status) => {
        logger.debug('📡 Project collaborators subscription status:', status)
      })

    // Return unsubscribe function
    return () => {
      logger.debug('📡 Unsubscribing from project collaborators updates')
      supabase.removeChannel(channel)
    }
  }
}
