/**
 * Session Participant Repository
 * Phase One Implementation
 *
 * Handles participant join/leave operations with RLS enforcement
 */

import { supabase } from '../supabase'
import type { SessionParticipant, ApiResponse, JoinSessionInput } from '../../types/BrainstormSession'
import { createSuccessResponse, createErrorResponse, handleSupabaseError } from './types'

export class SessionParticipantRepository {
  /**
   * Join a session as a participant
   */
  static async joinSession(input: JoinSessionInput): Promise<ApiResponse<SessionParticipant>> {
    try {
      const { data, error } = await supabase
        .from('session_participants')
        .insert([
          {
            session_id: input.sessionId,
            user_id: input.userId || null,
            participant_name: input.participantName || this.generateAnonymousName(),
            device_fingerprint: input.deviceFingerprint,
            is_anonymous: !input.userId,
            is_approved: true, // Auto-approve unless session requires approval
            contribution_count: 0
          }
        ])
        .select()
        .single()

      if (error) return handleSupabaseError<SessionParticipant>(error, 'Join session')

      return createSuccessResponse(data)
    } catch (error) {
      return createErrorResponse<SessionParticipant>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * Get participant by ID
   */
  static async getParticipantById(
    participantId: string
  ): Promise<ApiResponse<SessionParticipant>> {
    try {
      const { data, error } = await supabase
        .from('session_participants')
        .select('*')
        .eq('id', participantId)
        .single()

      if (error) return handleSupabaseError<SessionParticipant>(error, 'Get participant by ID')

      return createSuccessResponse(data)
    } catch (error) {
      return createErrorResponse<SessionParticipant>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * Get all participants for a session
   */
  static async getParticipantsBySessionId(
    sessionId: string
  ): Promise<ApiResponse<SessionParticipant[]>> {
    try {
      const { data, error } = await supabase
        .from('session_participants')
        .select('*')
        .eq('session_id', sessionId)
        .order('joined_at', { ascending: true })

      if (error)
        return handleSupabaseError<SessionParticipant[]>(error, 'Get participants by session ID')

      return createSuccessResponse(data || [])
    } catch (error) {
      return createErrorResponse<SessionParticipant[]>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * Get active participants for a session (not disconnected)
   */
  static async getActiveParticipants(
    sessionId: string
  ): Promise<ApiResponse<SessionParticipant[]>> {
    try {
      const { data, error } = await supabase
        .from('session_participants')
        .select('*')
        .eq('session_id', sessionId)
        .is('disconnected_at', null)
        .order('last_active_at', { ascending: false })

      if (error)
        return handleSupabaseError<SessionParticipant[]>(error, 'Get active participants')

      return createSuccessResponse(data || [])
    } catch (error) {
      return createErrorResponse<SessionParticipant[]>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * Mark participant as disconnected
   */
  static async disconnectParticipant(
    participantId: string
  ): Promise<ApiResponse<SessionParticipant>> {
    try {
      const { data, error } = await supabase
        .from('session_participants')
        .update({
          disconnected_at: new Date().toISOString()
        })
        .eq('id', participantId)
        .select()
        .single()

      if (error) return handleSupabaseError<SessionParticipant>(error, 'Disconnect participant')

      return createSuccessResponse(data)
    } catch (error) {
      return createErrorResponse<SessionParticipant>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * Update participant's last active timestamp
   */
  static async updateLastActive(
    participantId: string
  ): Promise<ApiResponse<SessionParticipant>> {
    try {
      const { data, error } = await supabase
        .from('session_participants')
        .update({
          last_active_at: new Date().toISOString()
        })
        .eq('id', participantId)
        .select()
        .single()

      if (error) return handleSupabaseError<SessionParticipant>(error, 'Update last active')

      return createSuccessResponse(data)
    } catch (error) {
      return createErrorResponse<SessionParticipant>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * Increment participant's contribution count
   * Note: This is automatically handled by database trigger on idea insertion
   */
  static async incrementContributionCount(
    participantId: string
  ): Promise<ApiResponse<SessionParticipant>> {
    try {
      const { data, error } = await supabase.rpc('increment_participant_contributions', {
        participant_uuid: participantId
      })

      if (error)
        return handleSupabaseError<SessionParticipant>(error, 'Increment contribution count')

      return createSuccessResponse(data)
    } catch (error) {
      return createErrorResponse<SessionParticipant>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * Check if participant exists by device fingerprint
   */
  static async findParticipantByFingerprint(
    sessionId: string,
    deviceFingerprint: string
  ): Promise<ApiResponse<SessionParticipant | null>> {
    try {
      const { data, error } = await supabase
        .from('session_participants')
        .select('*')
        .eq('session_id', sessionId)
        .eq('device_fingerprint', deviceFingerprint)
        .is('disconnected_at', null)
        .maybeSingle()

      if (error)
        return handleSupabaseError<SessionParticipant | null>(
          error,
          'Find participant by fingerprint'
        )

      return createSuccessResponse(data)
    } catch (error) {
      return createErrorResponse<SessionParticipant | null>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * Subscribe to participant changes for a session
   */
  static subscribeToParticipants(
    sessionId: string,
    callbacks: {
      onJoined?: (participant: SessionParticipant) => void
      onLeft?: (participant: SessionParticipant) => void
      onUpdated?: (participant: SessionParticipant) => void
    }
  ) {
    const channel = supabase
      .channel(`participants:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'session_participants',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          callbacks.onJoined?.(payload.new as SessionParticipant)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'session_participants',
          filter: `session_id=eq.${sessionId}`
        },
        (payload) => {
          const participant = payload.new as SessionParticipant
          if (participant.disconnected_at) {
            callbacks.onLeft?.(participant)
          } else {
            callbacks.onUpdated?.(participant)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  /**
   * Generate anonymous participant name
   */
  private static generateAnonymousName(): string {
    return `Participant ${Math.floor(Math.random() * 9000) + 1000}`
  }

  /**
   * Get participant count for session
   */
  static async getParticipantCount(sessionId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('session_participants')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId)
        .is('disconnected_at', null)

      if (error) {
        console.error('Error getting participant count:', error)
        return 0
      }

      return count || 0
    } catch (error) {
      console.error('Error getting participant count:', error)
      return 0
    }
  }

  /**
   * Approve a participant (if session requires approval)
   */
  static async approveParticipant(
    participantId: string
  ): Promise<ApiResponse<SessionParticipant>> {
    try {
      const { data, error } = await supabase
        .from('session_participants')
        .update({ is_approved: true })
        .eq('id', participantId)
        .select()
        .single()

      if (error) return handleSupabaseError<SessionParticipant>(error, 'Approve participant')

      return createSuccessResponse(data)
    } catch (error) {
      return createErrorResponse<SessionParticipant>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * Reject a participant (if session requires approval)
   */
  static async rejectParticipant(
    participantId: string
  ): Promise<ApiResponse<SessionParticipant>> {
    try {
      const { data, error } = await supabase
        .from('session_participants')
        .update({
          is_approved: false,
          disconnected_at: new Date().toISOString()
        })
        .eq('id', participantId)
        .select()
        .single()

      if (error) return handleSupabaseError<SessionParticipant>(error, 'Reject participant')

      return createSuccessResponse(data)
    } catch (error) {
      return createErrorResponse<SessionParticipant>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }
}
