/**
 * Validate Access Token API Endpoint
 * Serverless-compatible implementation (no src/ imports)
 *
 * POST /api/brainstorm/validate-token
 * Validates session access token and returns session details
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// ============================================
// Types (inline to avoid src/ imports)
// ============================================

interface ValidateTokenInput {
  accessToken: string
  joinCode?: string
}

interface ValidateTokenResponse {
  valid: boolean
  session?: {
    id: string
    name: string
    description?: string
    projectName?: string
    facilitatorName?: string
    maxParticipants: number
    currentParticipants: number
    expiresAt: string
    allowAnonymous: boolean
    status: string
  }
  error?: string
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
      valid: false,
      error: 'Method not allowed'
    })
  }

  try {
    const supabase = getSupabaseClient()

    // Extract and validate input
    const input: ValidateTokenInput = req.body

    if (!input.accessToken) {
      return res.status(400).json({
        valid: false,
        error: 'Missing required field: accessToken'
      })
    }

    // Find session by access token
    const { data: session, error: sessionError } = await supabase
      .from('brainstorm_sessions')
      .select(`
        id,
        name,
        description,
        status,
        max_participants,
        allow_anonymous,
        expires_at,
        access_token,
        join_code,
        project_id,
        facilitator_id
      `)
      .eq('access_token', input.accessToken)
      .single()

    if (sessionError || !session) {
      return res.status(200).json({
        valid: false,
        error: 'Invalid access token'
      } as ValidateTokenResponse)
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      return res.status(200).json({
        valid: false,
        error: 'Session has expired'
      } as ValidateTokenResponse)
    }

    // Check if session is active
    if (session.status !== 'active') {
      return res.status(200).json({
        valid: false,
        error: 'Session is not active'
      } as ValidateTokenResponse)
    }

    // Verify join code if provided
    if (input.joinCode && session.join_code !== input.joinCode) {
      return res.status(200).json({
        valid: false,
        error: 'Invalid join code'
      } as ValidateTokenResponse)
    }

    // Get current participant count
    const { count: participantCount } = await supabase
      .from('session_participants')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id)
      .eq('status', 'active')

    // Get project name if available
    let projectName: string | undefined
    if (session.project_id) {
      const { data: project } = await supabase
        .from('projects')
        .select('name')
        .eq('id', session.project_id)
        .single()
      projectName = project?.name
    }

    // Get facilitator name if available
    let facilitatorName: string | undefined
    if (session.facilitator_id) {
      const { data: facilitator } = await supabase
        .from('user_profiles')
        .select('name, email')
        .eq('id', session.facilitator_id)
        .single()
      facilitatorName = facilitator?.name || facilitator?.email
    }

    return res.status(200).json({
      valid: true,
      session: {
        id: session.id,
        name: session.name,
        description: session.description,
        projectName,
        facilitatorName,
        maxParticipants: session.max_participants,
        currentParticipants: participantCount || 0,
        expiresAt: session.expires_at,
        allowAnonymous: session.allow_anonymous,
        status: session.status
      }
    } as ValidateTokenResponse)
  } catch (error) {
    console.error('Error validating access token:', error)
    return res.status(500).json({
      valid: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}
