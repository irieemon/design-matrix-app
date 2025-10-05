/**
 * Consolidated AI API Routes
 *
 * Consolidates all AI routes into a single serverless function:
 * - POST /api/ai?action=generate-ideas
 * - POST /api/ai?action=generate-insights
 * - POST /api/ai?action=generate-roadmap
 * - POST /api/ai?action=analyze-file
 * - POST /api/ai?action=analyze-image
 * - POST /api/ai?action=transcribe-audio
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

// Import individual handlers from the original files
import generateIdeasHandler from './ai/generate-ideas'
import generateInsightsHandler from './ai/generate-insights'
import generateRoadmapHandler from './ai/generate-roadmap-v2'
import analyzeFileHandler from './ai/analyze-file'
import analyzeImageHandler from './ai/analyze-image'
import transcribeAudioHandler from './ai/transcribe-audio'

// ============================================================================
// MAIN ROUTER
// ============================================================================

export default async function aiRouter(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Extract action from query parameter
  const action = (req.query.action as string) || ''

  // Route based on action
  switch (action) {
    case 'generate-ideas':
      return generateIdeasHandler(req, res)

    case 'generate-insights':
      return generateInsightsHandler(req, res)

    case 'generate-roadmap':
    case 'generate-roadmap-v2':
      return generateRoadmapHandler(req, res)

    case 'analyze-file':
      return analyzeFileHandler(req, res)

    case 'analyze-image':
      return analyzeImageHandler(req, res)

    case 'transcribe-audio':
      return transcribeAudioHandler(req, res)

    default:
      return res.status(404).json({
        error: 'Invalid action',
        validActions: [
          'generate-ideas',
          'generate-insights',
          'generate-roadmap',
          'analyze-file',
          'analyze-image',
          'transcribe-audio'
        ]
      })
  }
}
