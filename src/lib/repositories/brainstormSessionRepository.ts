/**
 * Brainstorm Session Repository
 * Phase One Implementation
 *
 * Handles CRUD operations for brainstorm sessions with RLS enforcement
 */

import { supabase } from '../supabase'
import type {
  BrainstormSession,
  CreateSessionInput,
  ApiResponse
} from '../../types/BrainstormSession'
import { createSuccessResponse, createErrorResponse, handleSupabaseError } from './types'

export class BrainstormSessionRepository {
  /**
   * Create a new brainstorm session
   */
  static async createSession(
    input: CreateSessionInput & {
      facilitatorId: string
      accessToken: string
      joinCode: string
    }
  ): Promise<ApiResponse<BrainstormSession>> {
    try {
      const durationMs = (input.durationMinutes || 60) * 60 * 1000
      const expiresAt = new Date(Date.now() + durationMs).toISOString()

      const { data, error } = await supabase
        .from('brainstorm_sessions')
        .insert([
          {
            project_id: input.projectId,
            facilitator_id: input.facilitatorId,
            name: input.name || 'Brainstorm Session',
            description: input.description,
            access_token: input.accessToken,
            join_code: input.joinCode,
            expires_at: expiresAt,
            max_participants: input.maxParticipants || 50,
            allow_anonymous: input.allowAnonymous ?? true,
            require_approval: input.requireApproval ?? false,
            enable_voting: input.enableVoting ?? false,
            time_limit_minutes: input.durationMinutes,
            status: 'active',
            started_at: new Date().toISOString()
          }
        ])
        .select()
        .single()

      if (error) return handleSupabaseError<BrainstormSession>(error, 'Create session')

      return createSuccessResponse(data)
    } catch (error) {
      return createErrorResponse<BrainstormSession>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * Get session by ID
   */
  static async getSessionById(sessionId: string): Promise<ApiResponse<BrainstormSession>> {
    try {
      const { data, error } = await supabase
        .from('brainstorm_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (error) return handleSupabaseError<BrainstormSession>(error, 'Get session by ID')

      return createSuccessResponse(data)
    } catch (error) {
      return createErrorResponse<BrainstormSession>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * Get session by access token (for validation)
   */
  static async getSessionByAccessToken(
    accessToken: string
  ): Promise<ApiResponse<BrainstormSession>> {
    try {
      const { data, error } = await supabase
        .from('brainstorm_sessions')
        .select('*')
        .eq('access_token', accessToken)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .single()

      if (error) return handleSupabaseError<BrainstormSession>(error, 'Validate access token')

      return createSuccessResponse(data)
    } catch (error) {
      return createErrorResponse<BrainstormSession>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * Get session by join code (for manual entry)
   */
  static async getSessionByJoinCode(
    joinCode: string
  ): Promise<ApiResponse<BrainstormSession>> {
    try {
      const { data, error } = await supabase
        .from('brainstorm_sessions')
        .select('*')
        .eq('join_code', joinCode)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .single()

      if (error) return handleSupabaseError<BrainstormSession>(error, 'Get session by join code')

      return createSuccessResponse(data)
    } catch (error) {
      return createErrorResponse<BrainstormSession>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * Get all sessions for a project
   */
  static async getSessionsByProjectId(
    projectId: string
  ): Promise<ApiResponse<BrainstormSession[]>> {
    try {
      const { data, error } = await supabase
        .from('brainstorm_sessions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (error)
        return handleSupabaseError<BrainstormSession[]>(error, 'Get sessions by project ID')

      return createSuccessResponse(data || [])
    } catch (error) {
      return createErrorResponse<BrainstormSession[]>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * Get all sessions for a facilitator
   */
  static async getSessionsByFacilitatorId(
    facilitatorId: string
  ): Promise<ApiResponse<BrainstormSession[]>> {
    try {
      const { data, error } = await supabase
        .from('brainstorm_sessions')
        .select('*')
        .eq('facilitator_id', facilitatorId)
        .order('created_at', { ascending: false })

      if (error)
        return handleSupabaseError<BrainstormSession[]>(error, 'Get sessions by facilitator ID')

      return createSuccessResponse(data || [])
    } catch (error) {
      return createErrorResponse<BrainstormSession[]>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * Update session status (pause, resume, complete)
   */
  static async updateSessionStatus(
    sessionId: string,
    status: 'active' | 'paused' | 'completed' | 'archived'
  ): Promise<ApiResponse<BrainstormSession>> {
    try {
      const updateData: Partial<BrainstormSession> = { status }

      if (status === 'completed' || status === 'archived') {
        updateData.ended_at = new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('brainstorm_sessions')
        .update(updateData)
        .eq('id', sessionId)
        .select()
        .single()

      if (error) return handleSupabaseError<BrainstormSession>(error, 'Update session status')

      return createSuccessResponse(data)
    } catch (error) {
      return createErrorResponse<BrainstormSession>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * End a session (mark as completed)
   */
  static async endSession(sessionId: string): Promise<ApiResponse<BrainstormSession>> {
    return this.updateSessionStatus(sessionId, 'completed')
  }

  /**
   * Pause a session
   */
  static async pauseSession(sessionId: string): Promise<ApiResponse<BrainstormSession>> {
    return this.updateSessionStatus(sessionId, 'paused')
  }

  /**
   * Resume a paused session
   */
  static async resumeSession(sessionId: string): Promise<ApiResponse<BrainstormSession>> {
    return this.updateSessionStatus(sessionId, 'active')
  }

  /**
   * Check if session is active and not expired
   */
  static async isSessionActive(sessionId: string): Promise<boolean> {
    try {
      const { data } = await supabase.rpc('is_session_active', {
        session_uuid: sessionId
      })

      return data === true
    } catch (error) {
      console.error('Error checking session active status:', error)
      return false
    }
  }

  /**
   * Get active participant count for a session
   */
  static async getActiveParticipantCount(sessionId: string): Promise<number> {
    try {
      const { data } = await supabase.rpc('get_active_participant_count', {
        session_uuid: sessionId
      })

      return data || 0
    } catch (error) {
      console.error('Error getting active participant count:', error)
      return 0
    }
  }

  /**
   * Cleanup expired sessions (should be run periodically)
   */
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      const { data } = await supabase.rpc('cleanup_expired_sessions')
      return data || 0
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error)
      return 0
    }
  }

  /**
   * Delete a session (hard delete)
   * Note: Use with caution, prefer archiving via updateSessionStatus
   */
  static async deleteSession(sessionId: string): Promise<ApiResponse<null>> {
    try {
      const { error } = await supabase
        .from('brainstorm_sessions')
        .delete()
        .eq('id', sessionId)

      if (error) return handleSupabaseError<null>(error, 'Delete session')

      return createSuccessResponse(null)
    } catch (error) {
      return createErrorResponse<null>(
        error instanceof Error ? error.message : 'Unknown error',
        'EXCEPTION'
      )
    }
  }

  /**
   * Subscribe to session changes (for real-time updates)
   */
  static subscribeToSession(sessionId: string, callback: (session: BrainstormSession) => void) {
    const channel = supabase
      .channel(`session:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'brainstorm_sessions',
          filter: `id=eq.${sessionId}`
        },
        (payload) => {
          callback(payload.new as BrainstormSession)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }
}
