/**
 * End Session API Endpoint
 * Serverless-compatible implementation (no src/ imports)
 *
 * POST /api/brainstorm/end-session
 * Ends an active brainstorm session
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// ============================================
// Types (inline to avoid src/ imports)
// ============================================

interface EndSessionInput {
  sessionId: string
  facilitatorId?: string
}

interface EndSessionResponse {
  success: boolean
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
      success: false,
      error: 'Method not allowed'
    })
  }

  try {
    const supabase = getSupabaseClient()

    // Extract and validate input
    const input: EndSessionInput = req.body

    if (!input.sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: sessionId'
      })
    }

    // Check if session exists
    const { data: session, error: sessionError } = await supabase
      .from('brainstorm_sessions')
      .select('id, status, facilitator_id')
      .eq('id', input.sessionId)
      .single()

    if (sessionError || !session) {
      return res.status(400).json({
        success: false,
        error: 'Session not found'
      })
    }

    // Optionally verify facilitator ownership
    if (input.facilitatorId && session.facilitator_id !== input.facilitatorId) {
      return res.status(403).json({
        success: false,
        error: 'Only the facilitator can end this session'
      })
    }

    // Check if already ended
    if (session.status === 'ended') {
      return res.status(200).json({
        success: true
      } as EndSessionResponse)
    }

    // End the session
    const { error: updateError } = await supabase
      .from('brainstorm_sessions')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString()
      })
      .eq('id', input.sessionId)

    if (updateError) {
      console.error('Error ending session:', updateError)
      return res.status(500).json({
        success: false,
        error: 'Failed to end session'
      })
    }

    // Disconnect all active participants (set disconnected_at timestamp)
    await supabase
      .from('session_participants')
      .update({ disconnected_at: new Date().toISOString() })
      .eq('session_id', input.sessionId)
      .is('disconnected_at', null)

    return res.status(200).json({
      success: true
    } as EndSessionResponse)
  } catch (error) {
    console.error('Error ending session:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}
