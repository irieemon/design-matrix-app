/**
 * Create Brainstorm Session API Endpoint
 * Phase One Implementation
 *
 * POST /api/brainstorm/create-session
 * Creates a new brainstorm session with QR code access
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { BrainstormSessionService } from '../../src/lib/services/BrainstormSessionService'
import type { CreateSessionInput, CreateSessionResponse } from '../../src/types/BrainstormSession'

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
    const input: CreateSessionInput & { facilitatorId: string } = req.body

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

    // Create session via service
    const result: CreateSessionResponse = await BrainstormSessionService.createSession(input)

    if (!result.success) {
      return res.status(400).json(result)
    }

    return res.status(201).json(result)
  } catch (error) {
    console.error('Error creating brainstorm session:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}
