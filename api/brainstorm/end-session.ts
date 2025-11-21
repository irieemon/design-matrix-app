/**
 * End Session API Endpoint
 * Phase One Implementation
 *
 * POST /api/brainstorm/end-session
 * Ends an active brainstorm session
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { BrainstormSessionService } from '../../src/lib/services/BrainstormSessionService'
import type { EndSessionInput, EndSessionResponse } from '../../src/types/BrainstormSession'

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
    const input: EndSessionInput = req.body

    if (!input.sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: sessionId'
      })
    }

    // End session via service
    const result: EndSessionResponse = await BrainstormSessionService.endSession(input)

    if (!result.success) {
      return res.status(400).json(result)
    }

    return res.status(200).json(result)
  } catch (error) {
    console.error('Error ending session:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}
