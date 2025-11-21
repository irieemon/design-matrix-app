/**
 * Session Activity Repository
 * Phase One Implementation
 *
 * Handles audit logging for brainstorm session activities with snapshot support
 */

import { supabase } from '../supabase'
import type { SessionActivityLog, ApiResponse } from '../../types/BrainstormSession'
import { createSuccessResponse, createErrorResponse, handleSupabaseError } from './types'

export class SessionActivityRepository {
  /**
   * Log an activity in a session
   */
  static async logActivity(input: {
    sessionId: string
    participantId?: string
    activityType:
      | 'idea_created'
      | 'idea_updated'
      | 'idea_deleted'
      | 'idea_moved'
      | 'participant_joined'
      | 'participant_left'
      | 'session_paused'
      | 'session_resumed'
      | 'session_started'
      | 'session_ended'
    ideaId?: string
    snapshotData?: Record<string, unknown>
    ipAddress?: string
    userAgent?: string
  }): Promise<ApiResponse<SessionActivityLog>> {
    try {
      const { data, error } = await supabase
        .from('session_activity_log')
        .insert([
          {
            session_id: input.sessionId,
            participant_id: input.participantId || null,
            activity_type: input.activityType,
            idea_id: input.ideaId || null,
            snapshot_data: input.snapshotData || null,
            ip_address: input.ipAddress || null,
            user_agent: input.userAgent || null
          }
        ])
        .select()
        .single()

      if (error) return handleSupabaseError<SessionActivityLog>(error, 'Log activity')

      return createSuccessResponse(data)
    } catch (error) {
      return createErrorResponse<SessionActivityLog>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * Get all activities for a session
   */
  static async getSessionActivities(
    sessionId: string,
    limit?: number
  ): Promise<ApiResponse<SessionActivityLog[]>> {
    try {
      let query = supabase
        .from('session_activity_log')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })

      if (limit) {
        query = query.limit(limit)
      }

      const { data, error } = await query

      if (error)
        return handleSupabaseError<SessionActivityLog[]>(error, 'Get session activities')

      return createSuccessResponse(data || [])
    } catch (error) {
      return createErrorResponse<SessionActivityLog[]>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * Get activities for a specific participant
   */
  static async getParticipantActivities(
    participantId: string,
    limit?: number
  ): Promise<ApiResponse<SessionActivityLog[]>> {
    try {
      let query = supabase
        .from('session_activity_log')
        .select('*')
        .eq('participant_id', participantId)
        .order('created_at', { ascending: false })

      if (limit) {
        query = query.limit(limit)
      }

      const { data, error } = await query

      if (error)
        return handleSupabaseError<SessionActivityLog[]>(error, 'Get participant activities')

      return createSuccessResponse(data || [])
    } catch (error) {
      return createErrorResponse<SessionActivityLog[]>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * Get activities for a specific idea
   */
  static async getIdeaActivities(
    ideaId: string
  ): Promise<ApiResponse<SessionActivityLog[]>> {
    try {
      const { data, error } = await supabase
        .from('session_activity_log')
        .select('*')
        .eq('idea_id', ideaId)
        .order('created_at', { ascending: false })

      if (error) return handleSupabaseError<SessionActivityLog[]>(error, 'Get idea activities')

      return createSuccessResponse(data || [])
    } catch (error) {
      return createErrorResponse<SessionActivityLog[]>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * Get activities by type
   */
  static async getActivitiesByType(
    sessionId: string,
    activityType: SessionActivityLog['activity_type'],
    limit?: number
  ): Promise<ApiResponse<SessionActivityLog[]>> {
    try {
      let query = supabase
        .from('session_activity_log')
        .select('*')
        .eq('session_id', sessionId)
        .eq('activity_type', activityType)
        .order('created_at', { ascending: false })

      if (limit) {
        query = query.limit(limit)
      }

      const { data, error } = await query

      if (error)
        return handleSupabaseError<SessionActivityLog[]>(error, 'Get activities by type')

      return createSuccessResponse(data || [])
    } catch (error) {
      return createErrorResponse<SessionActivityLog[]>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * Get activity by ID (useful for retrieving snapshots)
   */
  static async getActivityById(
    activityId: string
  ): Promise<ApiResponse<SessionActivityLog>> {
    try {
      const { data, error } = await supabase
        .from('session_activity_log')
        .select('*')
        .eq('id', activityId)
        .single()

      if (error) return handleSupabaseError<SessionActivityLog>(error, 'Get activity by ID')

      return createSuccessResponse(data)
    } catch (error) {
      return createErrorResponse<SessionActivityLog>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * Get activity count for a session
   */
  static async getActivityCount(sessionId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('session_activity_log')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId)

      if (error) {
        console.error('Error getting activity count:', error)
        return 0
      }

      return count || 0
    } catch (error) {
      console.error('Error getting activity count:', error)
      return 0
    }
  }

  /**
   * Get recent activities across all sessions (for facilitator dashboard)
   */
  static async getRecentActivities(limit = 50): Promise<ApiResponse<SessionActivityLog[]>> {
    try {
      const { data, error } = await supabase
        .from('session_activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) return handleSupabaseError<SessionActivityLog[]>(error, 'Get recent activities')

      return createSuccessResponse(data || [])
    } catch (error) {
      return createErrorResponse<SessionActivityLog[]>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * Get activity timeline for a session (for replay/undo features)
   */
  static async getActivityTimeline(
    sessionId: string,
    startTime?: string,
    endTime?: string
  ): Promise<ApiResponse<SessionActivityLog[]>> {
    try {
      let query = supabase
        .from('session_activity_log')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })

      if (startTime) {
        query = query.gte('created_at', startTime)
      }

      if (endTime) {
        query = query.lte('created_at', endTime)
      }

      const { data, error } = await query

      if (error) return handleSupabaseError<SessionActivityLog[]>(error, 'Get activity timeline')

      return createSuccessResponse(data || [])
    } catch (error) {
      return createErrorResponse<SessionActivityLog[]>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * Subscribe to new activities in a session (for real-time activity feed)
   */
  static subscribeToSessionActivities(
    sessionId: string,
    callback: (activity: SessionActivityLog) => void
  ) {
    const channel = supabase
      .channel(`activity:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'session_activity_log',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          callback(payload.new as SessionActivityLog)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  /**
   * Helper: Log participant join event
   */
  static async logParticipantJoined(
    sessionId: string,
    participantId: string,
    participantName: string
  ): Promise<ApiResponse<SessionActivityLog>> {
    return this.logActivity({
      sessionId,
      participantId,
      activityType: 'participant_joined',
      snapshotData: {
        participant_name: participantName,
        timestamp: new Date().toISOString()
      }
    })
  }

  /**
   * Helper: Log participant leave event
   */
  static async logParticipantLeft(
    sessionId: string,
    participantId: string,
    participantName: string
  ): Promise<ApiResponse<SessionActivityLog>> {
    return this.logActivity({
      sessionId,
      participantId,
      activityType: 'participant_left',
      snapshotData: {
        participant_name: participantName,
        timestamp: new Date().toISOString()
      }
    })
  }

  /**
   * Helper: Log idea creation event
   */
  static async logIdeaCreated(
    sessionId: string,
    participantId: string,
    ideaId: string,
    ideaSnapshot: Record<string, unknown>
  ): Promise<ApiResponse<SessionActivityLog>> {
    return this.logActivity({
      sessionId,
      participantId,
      activityType: 'idea_created',
      ideaId,
      snapshotData: ideaSnapshot
    })
  }

  /**
   * Helper: Log idea update event
   */
  static async logIdeaUpdated(
    sessionId: string,
    participantId: string,
    ideaId: string,
    ideaSnapshot: Record<string, unknown>
  ): Promise<ApiResponse<SessionActivityLog>> {
    return this.logActivity({
      sessionId,
      participantId,
      activityType: 'idea_updated',
      ideaId,
      snapshotData: ideaSnapshot
    })
  }

  /**
   * Helper: Log idea deletion event
   */
  static async logIdeaDeleted(
    sessionId: string,
    participantId: string,
    ideaId: string,
    ideaSnapshot: Record<string, unknown>
  ): Promise<ApiResponse<SessionActivityLog>> {
    return this.logActivity({
      sessionId,
      participantId,
      activityType: 'idea_deleted',
      ideaId,
      snapshotData: ideaSnapshot
    })
  }

  /**
   * Helper: Log session state change
   */
  static async logSessionStateChange(
    sessionId: string,
    activityType: 'session_started' | 'session_paused' | 'session_resumed' | 'session_ended',
    metadata?: Record<string, unknown>
  ): Promise<ApiResponse<SessionActivityLog>> {
    return this.logActivity({
      sessionId,
      activityType,
      snapshotData: {
        timestamp: new Date().toISOString(),
        ...metadata
      }
    })
  }
}
