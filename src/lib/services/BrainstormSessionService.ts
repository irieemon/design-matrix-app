/**
 * Brainstorm Session Service
 * Phase One Implementation
 *
 * High-level service for managing brainstorm session lifecycle
 * Wraps repository layer with business logic
 */

import { BrainstormSessionRepository } from '../repositories/brainstormSessionRepository'
import { SessionParticipantRepository } from '../repositories/sessionParticipantRepository'
import { SessionActivityRepository } from '../repositories/sessionActivityRepository'
import { getRateLimitService } from './RateLimitService'
import {
  generateAccessToken,
  generateJoinCode,
  isValidAccessToken,
  isValidJoinCode,
  sanitizeParticipantName,
  isSessionExpired
} from '../security/brainstormSecurity'
import type {
  BrainstormSession,
  CreateSessionInput,
  CreateSessionResponse,
  ValidateTokenInput,
  ValidateTokenResponse,
  JoinSessionInput,
  JoinSessionResponse,
  EndSessionInput,
  EndSessionResponse,
  ToggleSessionPauseInput,
  ToggleSessionPauseResponse,
  SubmitIdeaInput,
  SubmitIdeaResponse
} from '../../types/BrainstormSession'

export class BrainstormSessionService {
  /**
   * Create a new brainstorm session
   */
  static async createSession(
    input: CreateSessionInput & { facilitatorId: string }
  ): Promise<CreateSessionResponse> {
    try {
      // Generate cryptographically secure tokens
      const accessToken = generateAccessToken()
      const joinCode = generateJoinCode()

      // Create session via repository
      const result = await BrainstormSessionRepository.createSession({
        ...input,
        facilitatorId: input.facilitatorId,
        accessToken,
        joinCode
      })

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Failed to create session'
        }
      }

      const session = result.data

      // Log session creation activity
      await SessionActivityRepository.logSessionStateChange(session.id, 'session_started', {
        name: session.name,
        facilitator_id: session.facilitator_id,
        max_participants: session.max_participants
      })

      // Generate QR code data (full URL for mobile join)
      // NOTE: Using hash-based routing (#join/) to match App.tsx routing logic
      const baseUrl =
        typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_BASE_URL
      const qrCodeData = `${baseUrl}#join/${accessToken}`

      return {
        success: true,
        session: {
          ...session,
          qrCodeData
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Validate access token and return session details
   */
  static async validateAccessToken(
    input: ValidateTokenInput
  ): Promise<ValidateTokenResponse> {
    try {
      // Validate token format
      if (!isValidAccessToken(input.accessToken)) {
        return {
          valid: false,
          error: 'Invalid token format'
        }
      }

      // Get session by access token
      const result = await BrainstormSessionRepository.getSessionByAccessToken(
        input.accessToken
      )

      if (!result.success || !result.data) {
        return {
          valid: false,
          error: 'Session not found or expired'
        }
      }

      const session = result.data

      // Double-check expiration
      if (isSessionExpired(session.expires_at)) {
        return {
          valid: false,
          error: 'Session has expired'
        }
      }

      // Check if session is active
      const isActive = await BrainstormSessionRepository.isSessionActive(session.id)
      if (!isActive) {
        return {
          valid: false,
          error: 'Session is no longer active'
        }
      }

      return {
        valid: true,
        session
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Validate join code and return session details
   */
  static async validateJoinCode(joinCode: string): Promise<ValidateTokenResponse> {
    try {
      // Validate join code format
      if (!isValidJoinCode(joinCode)) {
        return {
          valid: false,
          error: 'Invalid join code format'
        }
      }

      // Get session by join code
      const result = await BrainstormSessionRepository.getSessionByJoinCode(joinCode)

      if (!result.success || !result.data) {
        return {
          valid: false,
          error: 'Session not found or expired'
        }
      }

      const session = result.data

      // Check expiration and active status
      if (isSessionExpired(session.expires_at)) {
        return {
          valid: false,
          error: 'Session has expired'
        }
      }

      const isActive = await BrainstormSessionRepository.isSessionActive(session.id)
      if (!isActive) {
        return {
          valid: false,
          error: 'Session is no longer active'
        }
      }

      return {
        valid: true,
        session
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Join a session as a participant
   */
  static async joinSession(input: JoinSessionInput): Promise<JoinSessionResponse> {
    try {
      // Phase Five: Rate limiting check for participant joins
      const rateLimitService = getRateLimitService()
      const rateLimitResult = rateLimitService.checkParticipantJoin(
        input.sessionId,
        input.deviceFingerprint || input.userId || 'anonymous'
      )

      if (!rateLimitResult.allowed) {
        return {
          success: false,
          error: rateLimitResult.reason || 'Session has reached maximum participants',
          retryAfter: rateLimitResult.retryAfter
        }
      }

      // Validate session exists and is active
      const sessionResult = await BrainstormSessionRepository.getSessionById(input.sessionId)
      if (!sessionResult.success || !sessionResult.data) {
        return {
          success: false,
          error: 'Session not found'
        }
      }

      const session = sessionResult.data

      // Check if session is active
      const isActive = await BrainstormSessionRepository.isSessionActive(session.id)
      if (!isActive) {
        return {
          success: false,
          error: 'Session is no longer active or has expired'
        }
      }

      // Check participant count (redundant with rate limiter, but kept for backward compatibility)
      const participantCount = await SessionParticipantRepository.getParticipantCount(session.id)
      if (participantCount >= session.max_participants) {
        return {
          success: false,
          error: 'Session has reached maximum participants'
        }
      }

      // Check for existing participant with same device fingerprint
      if (input.deviceFingerprint) {
        const existingResult = await SessionParticipantRepository.findParticipantByFingerprint(
          session.id,
          input.deviceFingerprint
        )

        if (existingResult.success && existingResult.data) {
          // Participant already joined from this device
          return {
            success: true,
            participant: existingResult.data
          }
        }
      }

      // Sanitize participant name
      const sanitizedName = input.participantName
        ? sanitizeParticipantName(input.participantName)
        : undefined

      // Create participant
      const participantResult = await SessionParticipantRepository.joinSession({
        ...input,
        participantName: sanitizedName
      })

      if (!participantResult.success || !participantResult.data) {
        return {
          success: false,
          error: participantResult.error || 'Failed to join session'
        }
      }

      const participant = participantResult.data

      // Log participant joined activity
      await SessionActivityRepository.logParticipantJoined(
        session.id,
        participant.id,
        participant.participant_name
      )

      return {
        success: true,
        participant
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * End a session
   */
  static async endSession(input: EndSessionInput): Promise<EndSessionResponse> {
    try {
      // End session via repository
      const result = await BrainstormSessionRepository.endSession(input.sessionId)

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Failed to end session'
        }
      }

      // Log session ended activity
      await SessionActivityRepository.logSessionStateChange(input.sessionId, 'session_ended')

      return {
        success: true
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Pause a session
   */
  static async pauseSession(sessionId: string): Promise<EndSessionResponse> {
    try {
      const result = await BrainstormSessionRepository.pauseSession(sessionId)

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to pause session'
        }
      }

      // Log pause activity
      await SessionActivityRepository.logSessionStateChange(sessionId, 'session_paused')

      return {
        success: true
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Resume a paused session
   */
  static async resumeSession(sessionId: string): Promise<EndSessionResponse> {
    try {
      const result = await BrainstormSessionRepository.resumeSession(sessionId)

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to resume session'
        }
      }

      // Log resume activity
      await SessionActivityRepository.logSessionStateChange(sessionId, 'session_resumed')

      return {
        success: true
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Toggle session pause/resume (Phase Four helper)
   */
  static async toggleSessionPause(
    input: ToggleSessionPauseInput
  ): Promise<ToggleSessionPauseResponse> {
    try {
      // Get current session state
      const sessionResult = await BrainstormSessionRepository.getSessionById(input.sessionId)

      if (!sessionResult.success || !sessionResult.data) {
        return {
          success: false,
          error: 'Session not found'
        }
      }

      const session = sessionResult.data

      // Toggle based on current status
      if (session.status === 'active') {
        // Pause the session
        await this.pauseSession(input.sessionId)
        const updatedSession = await this.getSession(input.sessionId)
        return {
          success: true,
          session: updatedSession || undefined
        }
      } else if (session.status === 'paused') {
        // Resume the session
        await this.resumeSession(input.sessionId)
        const updatedSession = await this.getSession(input.sessionId)
        return {
          success: true,
          session: updatedSession || undefined
        }
      } else {
        return {
          success: false,
          error: 'Session cannot be toggled in current state'
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Submit an idea to a brainstorm session (Phase Three: Mobile UI)
   */
  static async submitIdea(input: SubmitIdeaInput): Promise<SubmitIdeaResponse> {
    try {
      const response = await fetch('/api/brainstorm/submit-idea', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(input)
      })

      if (!response.ok) {
        const errorData = await response.json()
        return {
          success: false,
          error: errorData.error || 'Failed to submit idea',
          code: errorData.code
        }
      }

      const data = await response.json()
      return data
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'NETWORK_ERROR'
      }
    }
  }

  /**
   * Get session details by ID
   */
  static async getSession(sessionId: string): Promise<BrainstormSession | null> {
    try {
      const result = await BrainstormSessionRepository.getSessionById(sessionId)
      return result.success && result.data ? result.data : null
    } catch (error) {
      console.error('Error getting session:', error)
      return null
    }
  }

  /**
   * Get all sessions for a project
   */
  static async getProjectSessions(projectId: string): Promise<BrainstormSession[]> {
    try {
      const result = await BrainstormSessionRepository.getSessionsByProjectId(projectId)
      return result.success && result.data ? result.data : []
    } catch (error) {
      console.error('Error getting project sessions:', error)
      return []
    }
  }

  /**
   * Get all sessions for a facilitator
   */
  static async getFacilitatorSessions(facilitatorId: string): Promise<BrainstormSession[]> {
    try {
      const result = await BrainstormSessionRepository.getSessionsByFacilitatorId(facilitatorId)
      return result.success && result.data ? result.data : []
    } catch (error) {
      console.error('Error getting facilitator sessions:', error)
      return []
    }
  }

  /**
   * Cleanup expired sessions (should be run periodically via cron job)
   */
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      return await BrainstormSessionRepository.cleanupExpiredSessions()
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error)
      return 0
    }
  }
}
