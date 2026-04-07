/**
 * AI API Router
 *
 * Thin router dispatching all AI requests to extracted handlers.
 * All business logic lives in api/_lib/ai/ handlers.
 *
 * Routes:
 * - POST /api/ai?action=generate-ideas
 * - POST /api/ai?action=generate-insights
 * - POST /api/ai?action=generate-roadmap
 * - POST /api/ai?action=generate-roadmap-v2
 * - POST /api/ai?action=analyze-file
 * - POST /api/ai?action=analyze-image
 * - POST /api/ai?action=transcribe-audio
 */

import type { VercelResponse } from '@vercel/node';
import {
  withUserRateLimit,
  withCSRF,
  withAuth,
  compose,
  type AuthenticatedRequest,
} from './_lib/middleware/index.js';
import {
  handleGenerateIdeas,
  handleGenerateInsights,
  handleGenerateRoadmap,
  handleAnalyzeFile,
  handleAnalyzeImage,
  handleTranscribeAudio,
} from './_lib/ai/index.js';

async function aiRouter(req: AuthenticatedRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = (req.query.action as string) || '';

  switch (action) {
    case 'generate-ideas':
      return handleGenerateIdeas(req, res);
    case 'generate-insights':
      return handleGenerateInsights(req, res);
    case 'generate-roadmap':
    case 'generate-roadmap-v2':
      return handleGenerateRoadmap(req, res);
    case 'analyze-file':
      return handleAnalyzeFile(req, res);
    case 'analyze-image':
      return handleAnalyzeImage(req, res);
    case 'transcribe-audio':
      return handleTranscribeAudio(req, res);
    default:
      return res.status(404).json({
        error: 'Invalid action',
        validActions: [
          'generate-ideas',
          'generate-insights',
          'generate-roadmap',
          'analyze-file',
          'analyze-image',
          'transcribe-audio',
        ],
      });
  }
}

export default compose(
  withUserRateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 20 }),
  withCSRF(),
  withAuth,
)(aiRouter);
