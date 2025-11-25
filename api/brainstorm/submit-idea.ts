/**
 * Submit Idea API Endpoint
 * Serverless-compatible implementation (no src/ imports)
 *
 * POST /api/brainstorm/submit-idea
 * Submits a new idea to a brainstorm session
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// ============================================
// Types (inline to avoid src/ imports)
// ============================================

interface SubmitIdeaInput {
  sessionId: string
  participantId: string
  content: string
  details?: string
  priority?: 'low' | 'moderate' | 'high' | 'critical'
}

interface ModerationResult {
  valid: boolean
  error?: string
  sanitizedContent?: string
}

// ============================================
// Inline Content Moderation
// ============================================

const MAX_CONTENT_LENGTH = 500
const MIN_CONTENT_LENGTH = 3
const MAX_DETAILS_LENGTH = 2000
const VALID_PRIORITIES = ['low', 'moderate', 'high', 'critical']

function validateIdeaContent(content: string): ModerationResult {
  if (!content || content.trim().length < MIN_CONTENT_LENGTH) {
    return { valid: false, error: `Content must be at least ${MIN_CONTENT_LENGTH} characters` }
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return { valid: false, error: `Content must be less than ${MAX_CONTENT_LENGTH} characters` }
  }
  // Basic sanitization
  const sanitized = content.trim().replace(/\s+/g, ' ')
  return { valid: true, sanitizedContent: sanitized }
}

function validateIdeaDetails(details: string): ModerationResult {
  if (details.length > MAX_DETAILS_LENGTH) {
    return { valid: false, error: `Details must be less than ${MAX_DETAILS_LENGTH} characters` }
  }
  return { valid: true }
}

function validatePriority(priority?: string): ModerationResult {
  if (!priority) return { valid: true }
  if (!VALID_PRIORITIES.includes(priority)) {
    return { valid: false, error: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}` }
  }
  return { valid: true }
}

// ============================================
// Inline Rate Limiting (simple in-memory)
// ============================================

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const MAX_IDEAS_PER_MINUTE = 6
const WINDOW_MS = 60000

function checkRateLimit(participantId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const record = rateLimitMap.get(participantId)

  // New record or window expired
  if (!record || now > record.resetTime) {
    rateLimitMap.set(participantId, { count: 1, resetTime: now + WINDOW_MS })
    return { allowed: true, remaining: MAX_IDEAS_PER_MINUTE - 1, resetIn: WINDOW_MS }
  }

  // Within window
  if (record.count >= MAX_IDEAS_PER_MINUTE) {
    return { allowed: false, remaining: 0, resetIn: record.resetTime - now }
  }

  record.count++
  return { allowed: true, remaining: MAX_IDEAS_PER_MINUTE - record.count, resetIn: record.resetTime - now }
}

// ============================================
// Create Supabase Client
// ============================================

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || ''
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase configuration')
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// ============================================
// Main Handler
// ============================================

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
    const supabase = getSupabaseClient()

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

    // Rate limiting check
    const rateLimitResult = checkRateLimit(input.participantId)
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please wait before submitting another idea.',
        code: 'RATE_LIMIT_EXCEEDED',
        remaining: rateLimitResult.remaining,
        resetIn: rateLimitResult.resetIn
      })
    }

    // Content moderation - validate content
    const contentValidation = validateIdeaContent(input.content)
    if (!contentValidation.valid) {
      return res.status(400).json({
        success: false,
        error: contentValidation.error,
        code: 'INVALID_CONTENT'
      })
    }

    // Content moderation - validate details (if provided)
    if (input.details) {
      const detailsValidation = validateIdeaDetails(input.details)
      if (!detailsValidation.valid) {
        return res.status(400).json({
          success: false,
          error: detailsValidation.error,
          code: 'INVALID_DETAILS'
        })
      }
    }

    // Validate priority (if provided)
    const priorityValidation = validatePriority(input.priority)
    if (!priorityValidation.valid) {
      return res.status(400).json({
        success: false,
        error: priorityValidation.error,
        code: 'INVALID_PRIORITY'
      })
    }

    // Validate session exists and is active
    const { data: session, error: sessionError } = await supabase
      .from('brainstorm_sessions')
      .select('id, project_id, status')
      .eq('id', input.sessionId)
      .single()

    if (sessionError || !session) {
      return res.status(400).json({
        success: false,
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      })
    }

    if (session.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Session is not active',
        code: 'SESSION_NOT_ACTIVE'
      })
    }

    // Validate participant exists and belongs to session
    // Note: session_participants table uses is_approved and disconnected_at, not status
    const { data: participant, error: participantError } = await supabase
      .from('session_participants')
      .select('id, session_id, participant_name, is_approved, disconnected_at, contribution_count')
      .eq('id', input.participantId)
      .single()

    if (participantError || !participant) {
      return res.status(400).json({
        success: false,
        error: 'Participant not found',
        code: 'PARTICIPANT_NOT_FOUND'
      })
    }

    if (participant.session_id !== input.sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Participant does not belong to this session',
        code: 'PARTICIPANT_SESSION_MISMATCH'
      })
    }

    // Check if participant is approved and not disconnected
    if (!participant.is_approved) {
      return res.status(403).json({
        success: false,
        error: 'Participant is not approved',
        code: 'PARTICIPANT_NOT_APPROVED'
      })
    }

    if (participant.disconnected_at) {
      return res.status(403).json({
        success: false,
        error: 'Participant has disconnected',
        code: 'PARTICIPANT_DISCONNECTED'
      })
    }

    // Create idea in database
    // Note: The ideas table doesn't have a default UUID generator, so we must provide one
    const ideaId = crypto.randomUUID()
    console.log('📝 Creating idea with:', {
      ideaId,
      project_id: session.project_id,
      session_id: input.sessionId,
      participant_id: input.participantId,
      content: contentValidation.sanitizedContent?.substring(0, 50)
    })
    const { data: idea, error: insertError } = await supabase
      .from('ideas')
      .insert([
        {
          id: ideaId,
          project_id: session.project_id,
          session_id: input.sessionId,
          participant_id: input.participantId,
          content: contentValidation.sanitizedContent,
          details: input.details || null,
          priority: input.priority || 'moderate',
          submitted_via: 'mobile',
          created_by: null, // Anonymous mobile submission
          // Set default position in bottom-right quadrant (low impact, low effort)
          x: 75,
          y: 75
        }
      ])
      .select()
      .single()

    if (insertError) {
      console.error('Error creating idea:', insertError)
      return res.status(500).json({
        success: false,
        error: `Failed to create idea: ${insertError.message}`,
        code: 'DATABASE_ERROR',
        details: insertError.details || insertError.hint || undefined
      })
    }

    // Update participant's contribution count and last active timestamp
    try {
      await supabase
        .from('session_participants')
        .update({
          contribution_count: (participant.contribution_count || 0) + 1,
          last_active_at: new Date().toISOString()
        })
        .eq('id', input.participantId)
    } catch (countError) {
      console.warn('Failed to update contribution count:', countError)
      // Don't fail the request - the idea was still created
    }

    // Log activity (best effort, don't fail if it errors)
    try {
      await supabase
        .from('session_activity')
        .insert([
          {
            session_id: input.sessionId,
            participant_id: input.participantId,
            activity_type: 'idea_created',
            metadata: {
              idea_id: idea.id,
              content: idea.content,
              participant_name: participant.participant_name
            }
          }
        ])
    } catch (activityError) {
      console.warn('Failed to log activity:', activityError)
      // Don't fail the request
    }

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
