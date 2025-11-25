/**
 * Create Brainstorm Session API Endpoint
 * Serverless-compatible implementation (no src/ imports)
 *
 * POST /api/brainstorm/create-session
 * Creates a new brainstorm session with QR code access
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// ============================================
// Types (inline to avoid src/ imports)
// ============================================

interface CreateSessionInput {
  projectId: string
  facilitatorId: string
  name?: string
  description?: string
  durationMinutes?: number
  maxParticipants?: number
  allowAnonymous?: boolean
  requireApproval?: boolean
  enableVoting?: boolean
}

interface CreateSessionResponse {
  success: boolean
  session?: {
    id: string
    name: string
    accessToken: string
    joinCode: string
    expiresAt: string
    qrCodeUrl: string
    joinUrl: string
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
// Utility Functions
// ============================================

function generateAccessToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

function generateJoinCode(): string {
  // Generate a 6-character alphanumeric code (uppercase letters and numbers)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Avoid confusing chars like I, O, 0, 1
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
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
    const input: CreateSessionInput = req.body

    if (!input.projectId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: projectId'
      })
    }

    if (!input.facilitatorId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: facilitatorId'
      })
    }

    // Validate optional fields
    if (input.durationMinutes && (input.durationMinutes < 1 || input.durationMinutes > 480)) {
      return res.status(400).json({
        success: false,
        error: 'Duration must be between 1 and 480 minutes'
      })
    }

    if (input.maxParticipants && (input.maxParticipants < 1 || input.maxParticipants > 200)) {
      return res.status(400).json({
        success: false,
        error: 'Max participants must be between 1 and 200'
      })
    }

    // Generate tokens
    const accessToken = generateAccessToken()
    const joinCode = generateJoinCode()

    // Calculate expiry
    const durationMs = (input.durationMinutes || 60) * 60 * 1000
    const expiresAt = new Date(Date.now() + durationMs).toISOString()

    // Create session in database
    const { data: session, error: insertError } = await supabase
      .from('brainstorm_sessions')
      .insert([
        {
          project_id: input.projectId,
          facilitator_id: input.facilitatorId,
          name: input.name || 'Brainstorm Session',
          description: input.description,
          access_token: accessToken,
          join_code: joinCode,
          expires_at: expiresAt,
          max_participants: input.maxParticipants || 50,
          allow_anonymous: input.allowAnonymous ?? true,
          require_approval: input.requireApproval ?? false,
          enable_voting: input.enableVoting ?? false,
          time_limit_minutes: input.durationMinutes || 60,
          status: 'active',
          started_at: new Date().toISOString()
        }
      ])
      .select()
      .single()

    if (insertError) {
      console.error('Error creating session:', insertError)
      return res.status(500).json({
        success: false,
        error: 'Failed to create session'
      })
    }

    // Construct URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.prioritas.ai'
    const joinUrl = `${baseUrl}/join/${accessToken}`
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(joinUrl)}`

    return res.status(201).json({
      success: true,
      session: {
        id: session.id,
        name: session.name,
        accessToken,
        joinCode,
        expiresAt,
        qrCodeUrl,
        joinUrl
      }
    } as CreateSessionResponse)
  } catch (error) {
    console.error('Error creating brainstorm session:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}
