/**
 * Validate Access Token API Endpoint
 * Phase One Implementation
 *
 * POST /api/brainstorm/validate-token
 * Validates session access token and returns session details
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { BrainstormSessionService } from '../../src/lib/services/BrainstormSessionService'
import type { ValidateTokenInput, ValidateTokenResponse } from '../../src/types/BrainstormSession'

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
    // Extract and validate input
    const input: ValidateTokenInput = req.body

    if (!input.accessToken) {
      return res.status(400).json({
        valid: false,
        error: 'Missing required field: accessToken'
      })
    }

    // Validate token via service
    const result: ValidateTokenResponse = await BrainstormSessionService.validateAccessToken(
      input
    )

    if (!result.valid) {
      return res.status(200).json(result) // 200 OK but valid: false
    }

    return res.status(200).json(result)
  } catch (error) {
    console.error('Error validating access token:', error)
    return res.status(500).json({
      valid: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}
