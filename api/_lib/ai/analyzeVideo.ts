/**
 * Analyze Video handler (Phase 07-03, D-15/D-16, research finding #1).
 *
 * The client extracts N frames from a user-provided video entirely in the
 * browser and POSTs them as image data URLs. This handler forwards every
 * frame to the model in a SINGLE `generateObject` call via multi-image
 * content parts — not N independent calls — per research finding #1.
 *
 * Response shape mirrors analyze-image: { analysis: { summary, suggestedIdeas } }.
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedRequest } from '../middleware/index.js';
import { selectModel } from './modelRouter.js';
import { getModel } from './providers.js';

export const VIDEO_ANALYSIS_MIN_FRAMES = 1;
export const VIDEO_ANALYSIS_MAX_FRAMES = 12;

/**
 * Shape the model is asked to return for each suggested idea. These fields
 * align with the user-facing columns of IdeaCard (src/types/index.ts) that
 * the AI can plausibly populate — id/timestamps are filled server-side
 * when the idea is persisted.
 */
const SuggestedIdeaSchema = z.object({
  content: z.string().min(1),
  details: z.string().default(''),
  x: z.number().default(260),
  y: z.number().default(260),
  priority: z
    .enum(['low', 'moderate', 'high', 'strategic', 'innovation'])
    .default('moderate'),
});

const VideoAnalysisSchema = z.object({
  summary: z.string().min(1),
  suggestedIdeas: z.array(SuggestedIdeaSchema),
});

export type VideoAnalysis = z.infer<typeof VideoAnalysisSchema>;

export async function handleAnalyzeVideo(
  req: AuthenticatedRequest,
  res: VercelResponse,
) {
  try {
    const { frames, projectContext } = req.body ?? {};

    if (!Array.isArray(frames) || frames.length < VIDEO_ANALYSIS_MIN_FRAMES) {
      return res.status(400).json({ error: 'Frames are required' });
    }
    if (frames.length > VIDEO_ANALYSIS_MAX_FRAMES) {
      return res.status(400).json({
        error: `Too many frames (max ${VIDEO_ANALYSIS_MAX_FRAMES})`,
      });
    }

    // Vision-capable model only — analyze-image routing path covers this.
    const selection = selectModel({
      task: 'analyze-image',
      hasVision: true,
      hasAudio: false,
      userTier: 'free',
    });
    const model = getModel(selection.gatewayModelId);

    const prompt = buildVideoPrompt(frames.length, projectContext);

    // CRITICAL (research #1): single generateObject call with N image
    // content parts — NOT N separate calls.
    const { object } = await generateObject({
      model,
      schema: VideoAnalysisSchema,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...frames.map((f: string) => ({
              type: 'image' as const,
              image: f,
            })),
          ],
        },
      ],
      maxOutputTokens: selection.maxOutputTokens,
      temperature: selection.temperature,
    });

    return res.status(200).json({ analysis: object });
  } catch (error) {
    console.error('Video analysis error:', error);
    return res.status(500).json({ error: 'Failed to analyze video' });
  }
}

function buildVideoPrompt(
  frameCount: number,
  projectContext: { projectName?: string; projectType?: string; description?: string } | undefined,
): string {
  const name = projectContext?.projectName ?? 'Unknown';
  const type = projectContext?.projectType ?? 'General';
  const description = projectContext?.description ?? '';

  return `You are analyzing a short video by looking at ${frameCount} uniformly-sampled frames.
The frames are presented in chronological order. Provide:

1. A concise holistic summary of what the video depicts across all frames.
2. A list of concrete, actionable idea suggestions inspired by the video that
   would be relevant to the user's project.

PROJECT: ${name}
TYPE: ${type}
${description ? `DESCRIPTION: ${description}` : ''}

Return a JSON object matching the provided schema: { summary, suggestedIdeas[] }.
Each suggestedIdeas entry must include at minimum: content (short title),
details (explanation), priority (low|moderate|high|strategic|innovation).`;
}
