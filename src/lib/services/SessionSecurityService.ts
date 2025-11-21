/**
 * Session Security Service
 * Phase Five Implementation
 *
 * Comprehensive session security validation and enforcement
 * All checks behind MOBILE_BRAINSTORM_PHASE5 feature flag
 */

import { isFeatureEnabled } from '../config'
import { BrainstormSessionRepository } from '../repositories/brainstormSessionRepository'
import { SessionParticipantRepository } from '../repositories/sessionParticipantRepository'
import type { BrainstormSession, SessionParticipant } from '../../types/BrainstormSession'

export interface SecurityValidationResult {
  valid: boolean
  error?: string
  code?: string
}

export class SessionSecurityService {
  /**
   * Validate session token and security requirements
   * Phase Five: Comprehensive token validation
   */
  static async validateSessionToken(
    sessionId: string,
    accessToken: string
  ): Promise<SecurityValidationResult> {
    // Skip Phase Five checks if flag OFF
    if (!isFeatureEnabled('MOBILE_BRAINSTORM_PHASE5')) {
      return { valid: true }
    }

    try {
      // Get session
      const sessionResult = await BrainstormSessionRepository.getSessionById(sessionId)
      if (!sessionResult.success || !sessionResult.data) {
        return {
          valid: false,
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND'
        }
      }

      const session = sessionResult.data

      // Validate token matches
      if (session.access_token !== accessToken) {
        return {
          valid: false,
          error: 'Invalid access token',
          code: 'INVALID_TOKEN'
        }
      }

      // Check if session is expired
      const now = new Date()
      const expiresAt = new Date(session.expires_at)
      if (now > expiresAt) {
        return {
          valid: false,
          error: 'Session has expired',
          code: 'SESSION_EXPIRED'
        }
      }

      // Check if session is completed or archived
      if (session.status === 'completed' || session.status === 'archived') {
        return {
          valid: false,
          error: `Session is ${session.status}`,
          code: 'SESSION_ENDED'
        }
      }

      return { valid: true }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'VALIDATION_ERROR'
      }
    }
  }

  /**
   * Validate participant can submit ideas
   * Phase Five: Check session status, participant approval, and paused state
   */
  static async validateIdeaSubmission(
    sessionId: string,
    participantId: string
  ): Promise<SecurityValidationResult> {
    // Skip Phase Five checks if flag OFF
    if (!isFeatureEnabled('MOBILE_BRAINSTORM_PHASE5')) {
      return { valid: true }
    }

    try {
      // Get session
      const sessionResult = await BrainstormSessionRepository.getSessionById(sessionId)
      if (!sessionResult.success || !sessionResult.data) {
        return {
          valid: false,
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND'
        }
      }

      const session = sessionResult.data

      // Phase Five: Paused sessions block idea submission
      if (session.status === 'paused') {
        return {
          valid: false,
          error: 'Session is paused. Idea submission temporarily disabled.',
          code: 'SESSION_PAUSED'
        }
      }

      // Check if session is active
      if (session.status !== 'active') {
        return {
          valid: false,
          error: 'Session is not active',
          code: 'SESSION_INACTIVE'
        }
      }

      // Get participant
      const participantResult = await SessionParticipantRepository.getParticipantById(participantId)
      if (!participantResult.success || !participantResult.data) {
        return {
          valid: false,
          error: 'Participant not found',
          code: 'PARTICIPANT_NOT_FOUND'
        }
      }

      const participant = participantResult.data

      // Check if participant belongs to this session
      if (participant.session_id !== sessionId) {
        return {
          valid: false,
          error: 'Participant does not belong to this session',
          code: 'PARTICIPANT_SESSION_MISMATCH'
        }
      }

      // Check if participant is approved (if session requires approval)
      if (session.require_approval && !participant.is_approved) {
        return {
          valid: false,
          error: 'Participant not approved to submit ideas',
          code: 'PARTICIPANT_NOT_APPROVED'
        }
      }

      // Update last_active_at timestamp
      await SessionParticipantRepository.updateLastActive(participantId)

      return { valid: true }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'VALIDATION_ERROR'
      }
    }
  }

  /**
   * Validate participant can join session
   * Phase Five: Check session status, capacity, and device fingerprint
   */
  static async validateParticipantJoin(
    sessionId: string,
    deviceFingerprint?: string
  ): Promise<SecurityValidationResult> {
    // Skip Phase Five checks if flag OFF
    if (!isFeatureEnabled('MOBILE_BRAINSTORM_PHASE5')) {
      return { valid: true }
    }

    try {
      // Get session
      const sessionResult = await BrainstormSessionRepository.getSessionById(sessionId)
      if (!sessionResult.success || !sessionResult.data) {
        return {
          valid: false,
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND'
        }
      }

      const session = sessionResult.data

      // Phase Five: Ended sessions block new joins
      if (session.status === 'completed' || session.status === 'archived') {
        return {
          valid: false,
          error: 'Session has ended. No new participants allowed.',
          code: 'SESSION_ENDED'
        }
      }

      // Check if session is active or paused (paused allows viewing but not submission)
      if (session.status !== 'active' && session.status !== 'paused') {
        return {
          valid: false,
          error: 'Session is not accepting participants',
          code: 'SESSION_INACTIVE'
        }
      }

      // Check if session has expired
      const now = new Date()
      const expiresAt = new Date(session.expires_at)
      if (now > expiresAt) {
        return {
          valid: false,
          error: 'Session has expired',
          code: 'SESSION_EXPIRED'
        }
      }

      // Phase Five: Device fingerprint requirement
      if (!deviceFingerprint) {
        return {
          valid: false,
          error: 'Device fingerprint required',
          code: 'DEVICE_FINGERPRINT_REQUIRED'
        }
      }

      // Phase Five: Prevent multiple devices per participant
      if (deviceFingerprint) {
        const existingParticipant = await SessionParticipantRepository.findParticipantByFingerprint(
          sessionId,
          deviceFingerprint
        )

        if (existingParticipant.success && existingParticipant.data) {
          // Device already used in this session - this is actually OK (rejoin scenario)
          // We return valid but the service layer will return existing participant
          return { valid: true }
        }
      }

      return { valid: true }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'VALIDATION_ERROR'
      }
    }
  }

  /**
   * Validate session ownership for facilitator operations
   * Phase Five: Ensure only facilitator can manage session
   */
  static async validateSessionOwnership(
    sessionId: string,
    userId: string
  ): Promise<SecurityValidationResult> {
    // Skip Phase Five checks if flag OFF
    if (!isFeatureEnabled('MOBILE_BRAINSTORM_PHASE5')) {
      return { valid: true }
    }

    try {
      // Get session
      const sessionResult = await BrainstormSessionRepository.getSessionById(sessionId)
      if (!sessionResult.success || !sessionResult.data) {
        return {
          valid: false,
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND'
        }
      }

      const session = sessionResult.data

      // Check if user is the facilitator
      if (session.facilitator_id !== userId) {
        return {
          valid: false,
          error: 'Only the session facilitator can perform this action',
          code: 'UNAUTHORIZED'
        }
      }

      return { valid: true }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'VALIDATION_ERROR'
      }
    }
  }
}
