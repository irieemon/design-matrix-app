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

/**
 * Event payload delivered to subscribeToIdeas callbacks.
 * Mirrors the Supabase postgres_changes payload shape for the ideas table.
 */
export type RealtimeIdeaPayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Partial<IdeaCard> & { id: string }
  old: (Partial<IdeaCard> & { id: string }) | null
}

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
   * Subscribe to real-time idea changes.
   *
   * ADR-0009: callback now receives a RealtimeIdeaPayload (eventType + new + old)
   * instead of a full idea array. The consumer (useIdeas) merges the payload into
   * its own state with INSERT/UPDATE/DELETE logic.
   */
  static subscribeToIdeas(
    callback: (payload: RealtimeIdeaPayload) => void,
    projectId?: string,
    userId?: string,
    options?: { skipInitialLoad?: boolean }
  ): () => void {
    logger.debug('Setting up real-time subscription...', { projectId, userId, options })

    try {
      const channelName = this.generateChannelName(projectId, userId)
      logger.debug('🔄 Creating optimized channel:', channelName)

      let channel
      try {
        channel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'ideas'
              // NOTE: No server-side filter — binding mismatches were observed with
              // complex filters. Project scoping is enforced in the callback below.
            },
            (payload) => {
              const newData = payload.new as Record<string, any> | null
              const oldData = payload.old as Record<string, any> | null
              logger.debug('🔴 Real-time change detected:', payload.eventType, newData?.id)

              // Only forward events relevant to the subscribed project.
              const isRelevant = !projectId ||
                (newData && 'project_id' in newData && newData.project_id === projectId) ||
                (oldData && 'project_id' in oldData && oldData.project_id === projectId)

              if (!isRelevant) {
                logger.debug('⏩ Real-time change not relevant to current project, skipping')
                return
              }

              logger.debug('✅ Real-time change relevant — forwarding payload to consumer')
              callback({
                eventType: payload.eventType as RealtimeIdeaPayload['eventType'],
                new: (newData ?? {}) as RealtimeIdeaPayload['new'],
                old: oldData as RealtimeIdeaPayload['old'],
              })
            }
          )
          .subscribe((status, err) => {
            logger.debug('Subscription status:', status)

            if (err) {
              logger.error('❌ Subscription error:', err)
              if (err.message?.includes('binding mismatch') || err.message?.includes('bindings')) {
                logger.warn('🔄 Binding mismatch detected - using polling fallback')
                logger.warn('⚠️ Real-time updates disabled due to schema mismatch. App will still work with manual refresh.')
                return
              }
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
        return () => logger.debug('No-op unsubscribe (realtime disabled)')
      }

      return () => {
        logger.debug('Unsubscribing from real-time updates')
        try {
          supabase.removeChannel(channel)
        } catch (removeError) {
          logger.warn('Error removing channel (already removed?):', removeError)
        }
      }
    } catch (error) {
      logger.error('❌ Failed to set up real-time subscription:', error)
      logger.warn('⚠️ App will continue to work without realtime updates')
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
