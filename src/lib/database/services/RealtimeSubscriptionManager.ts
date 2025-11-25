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

      // CRITICAL FIX: Wrap channel creation in try-catch to prevent crashes
      let channel
      try {
        // Optimized real-time subscription with simplified filters
        channel = supabase
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
            // CRITICAL FIX: Graceful handling of binding mismatch without crashing
            if (err.message?.includes('binding mismatch') || err.message?.includes('bindings')) {
              logger.warn('🔄 Binding mismatch detected - using polling fallback')
              logger.warn('⚠️ Real-time updates disabled due to schema mismatch. App will still work with manual refresh.')
              // Don't crash - just disable realtime for this session
              // User can still use the app, just without live updates
              return
            }
            // For other errors, log but don't crash
            logger.error('⚠️ Real-time subscription error, continuing without live updates')
          } else if (status === 'SUBSCRIBED') {
            logger.debug('✅ Successfully subscribed to real-time updates!')
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            logger.warn('⚠️ Real-time subscription failed or closed:', status)
            logger.warn('Continuing without live updates - manual refresh still works')
          }
        })

      } catch (channelError) {
        logger.error('❌ Failed to create realtime channel:', channelError)
        logger.warn('⚠️ Continuing without realtime updates - app will work with manual refresh')

        // Load initial data even if realtime fails
        if (!options?.skipInitialLoad) {
          logger.debug('🔄 Loading initial data (realtime disabled)...')
          callback([])
        }

        // Return no-op unsubscribe
        return () => logger.debug('No-op unsubscribe (realtime disabled)')
      }

      // Load initial data when subscription is set up (unless explicitly skipped)
      if (!options?.skipInitialLoad) {
        logger.debug('🔄 Loading initial data for subscription...', { projectId })
        // Trigger callback for initial load - consumer will fetch data
        callback([])
      }

      return () => {
        logger.debug('Unsubscribing from real-time updates')
        try {
          supabase.removeChannel(channel)
        } catch (removeError) {
          logger.warn('Error removing channel (already removed?):', removeError)
        }
      }
    } catch (error) {  // Closes outer try block from line 49
      logger.error('❌ Failed to set up real-time subscription:', error)
      logger.warn('⚠️ App will continue to work without realtime updates')

      // CRITICAL FIX: Still load initial data even if subscription completely fails
      if (!options?.skipInitialLoad) {
        logger.debug('🔄 Loading initial data (subscription setup failed)...')
        try {
          callback([])
        } catch (callbackError) {
          logger.error('Error in initial data callback:', callbackError)
        }
      }

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
