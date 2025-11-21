/**
 * Submit Idea API Endpoint
 * Phase One Implementation
 *
 * POST /api/brainstorm/submit-idea
 * Submits a new idea to a brainstorm session with rate limiting
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../src/lib/supabase'
import { BrainstormSessionRepository } from '../../src/lib/repositories/brainstormSessionRepository'
import { SessionParticipantRepository } from '../../src/lib/repositories/sessionParticipantRepository'
import { SessionActivityRepository } from '../../src/lib/repositories/sessionActivityRepository'
import { ContentModerationService } from '../../src/lib/services/ContentModerationService'
import { getRateLimitService } from '../../src/lib/services/RateLimitService'
import { SessionSecurityService } from '../../src/lib/services/SessionSecurityService'
import type { SubmitIdeaInput, SubmitIdeaResponse } from '../../src/types/BrainstormSession'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    })
  }

  try {
    // Extract and validate input
    const input: SubmitIdeaInput = req.body

    if (!input.sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: sessionId',
        code: 'MISSING_SESSION_ID'
      })
    }

    if (!input.participantId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: participantId',
        code: 'MISSING_PARTICIPANT_ID'
      })
    }

    if (!input.content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: content',
        code: 'MISSING_CONTENT'
      })
    }

    // Phase Five: Rate limiting check (6 submissions per minute)
    const rateLimitService = getRateLimitService()
    const rateLimitResult = rateLimitService.checkIdeaSubmission(input.participantId)

    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        success: false,
        error: rateLimitResult.reason || 'Rate limit exceeded. Please wait before submitting another idea.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: rateLimitResult.retryAfter,
        remaining: rateLimitResult.remaining,
        resetIn: rateLimitResult.resetIn
      })
    }

    // Phase Five: Comprehensive session security validation
    const securityValidation = await SessionSecurityService.validateIdeaSubmission(
      input.sessionId,
      input.participantId
    )

    if (!securityValidation.valid) {
      const statusCode = securityValidation.code === 'SESSION_PAUSED' ? 403 : 400
      return res.status(statusCode).json({
        success: false,
        error: securityValidation.error,
        code: securityValidation.code
      })
    }

    // Get participant for activity logging (already validated above)
    const participantResult = await SessionParticipantRepository.getParticipantById(
      input.participantId
    )
    const participant = participantResult.data!

    // Content moderation - validate content
    const contentValidation = ContentModerationService.validateIdeaContent(input.content)
    if (!contentValidation.valid) {
      return res.status(400).json({
        success: false,
        error: contentValidation.error,
        code: 'INVALID_CONTENT'
      })
    }

    // Content moderation - validate details (if provided)
    if (input.details) {
      const detailsValidation = ContentModerationService.validateIdeaDetails(input.details)
      if (!detailsValidation.valid) {
        return res.status(400).json({
          success: false,
          error: detailsValidation.error,
          code: 'INVALID_DETAILS'
        })
      }
    }

    // Validate priority (if provided)
    const priorityValidation = ContentModerationService.validatePriority(input.priority)
    if (!priorityValidation.valid) {
      return res.status(400).json({
        success: false,
        error: priorityValidation.error,
        code: 'INVALID_PRIORITY'
      })
    }

    // Get session to extract project_id
    const sessionResult = await BrainstormSessionRepository.getSessionById(input.sessionId)
    if (!sessionResult.success || !sessionResult.data) {
      return res.status(400).json({
        success: false,
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      })
    }

    const session = sessionResult.data

    // Create idea in database
    const { data: idea, error } = await supabase
      .from('ideas')
      .insert([
        {
          project_id: session.project_id,
          session_id: input.sessionId,
          participant_id: input.participantId,
          content: contentValidation.sanitizedContent,
          details: input.details || null,
          priority: input.priority || 'moderate',
          submitted_via: 'mobile',
          // Set default position in bottom-right quadrant (low impact, low effort)
          x_position: 75,
          y_position: 75
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('Error creating idea:', error)
      return res.status(500).json({
        success: false,
        error: 'Failed to create idea',
        code: 'DATABASE_ERROR'
      })
    }

    // Log activity (idea creation)
    await SessionActivityRepository.logIdeaCreated(
      input.sessionId,
      input.participantId,
      idea.id,
      {
        content: idea.content,
        details: idea.details,
        priority: idea.priority,
        participant_name: participant.participant_name
      }
    )

    return res.status(201).json({
      success: true,
      idea: {
        id: idea.id,
        content: idea.content,
        created_at: idea.created_at
      }
    })
  } catch (error) {
    console.error('Error submitting idea:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    })
  }
}
