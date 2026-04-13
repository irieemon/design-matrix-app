/**
 * AI API Router
 *
 * Thin router dispatching all AI requests to extracted handlers.
 * All business logic lives in api/_lib/ai/ handlers.
 *
 * Routes:
 * - GET  /api/ai?action=quota-status&type=ai_ideas
 * - POST /api/ai?action=generate-ideas
 * - POST /api/ai?action=generate-insights
 * - POST /api/ai?action=generate-roadmap
 * - POST /api/ai?action=generate-roadmap-v2
 * - POST /api/ai?action=analyze-file
 * - POST /api/ai?action=analyze-image
 * - POST /api/ai?action=analyze-video
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
  handleAnalyzeVideo,
  handleTranscribeAudio,
} from './_lib/ai/index.js';
import { checkLimit } from './_lib/services/subscriptionService.js';

function getResetsAt(): string {
  const now = new Date();
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return nextMonth.toISOString();
}

async function handleQuotaStatus(req: AuthenticatedRequest, res: VercelResponse) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const limitType = (req.query.type as string) || 'ai_ideas';
  const validTypes = ['ai_ideas', 'ai_roadmap', 'ai_insights'] as const;
  if (!validTypes.includes(limitType as typeof validTypes[number])) {
    return res.status(400).json({ error: `Invalid type: ${limitType}` });
  }

  const result = await checkLimit(userId, limitType as typeof validTypes[number]);

  return res.status(200).json({
    canUse: result.canUse,
    current: result.current,
    limit: result.limit,
    percentageUsed: result.percentageUsed,
    isUnlimited: result.isUnlimited,
    resetsAt: getResetsAt(),
  });
}

async function aiRouter(req: AuthenticatedRequest, res: VercelResponse) {
  const action = (req.query.action as string) || '';

  if (action === 'quota-status') {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    return handleQuotaStatus(req, res);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    case 'analyze-video':
      return handleAnalyzeVideo(req, res);
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
          'analyze-video',
          'transcribe-audio',
          'quota-status',
        ],
      });
  }
}

export default compose(
  withUserRateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 20 }),
  withCSRF(),
  withAuth,
)(aiRouter);
