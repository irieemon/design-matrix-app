/**
 * Generate Ideas handler -- migrated from api/ai.ts to use AI SDK.
 *
 * Replaces raw fetch() to OpenAI/Anthropic APIs with generateText() via
 * the AI Gateway. Preserves identical response shape, validation, and
 * subscription limit enforcement.
 */

import { generateText } from 'ai';
import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedRequest } from '../middleware/index.js';
import { InputValidator, commonRules } from '../utils/validation.js';
import { checkLimit, trackAIUsage } from '../services/subscriptionService.js';
import { trackTokenUsage } from '../utils/supabaseAdmin.js';
import { selectModel } from './modelRouter.js';
import { getModel } from './providers.js';
import { parseJsonResponse } from './utils/parsing.js';
import { mapUsageToTracking } from './utils/tokenTracking.js';
import { getProjectTypePersona } from './utils/prompts.js';

/**
 * Handles the generate-ideas action.
 *
 * Validates input, checks subscription limits, generates ideas via AI SDK,
 * tracks usage, and returns { ideas: [...] }.
 */
export async function handleGenerateIdeas(req: AuthenticatedRequest, res: VercelResponse) {
  // Validate and sanitize input
  const validation = InputValidator.validate(req.body, [
    commonRules.title,
    commonRules.description,
    { ...commonRules.projectType, required: false },
    { ...commonRules.count, required: false },
    { ...commonRules.tolerance, required: false },
  ]);

  if (!validation.isValid) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validation.errors,
    });
  }

  const { title, description, projectType = 'other', count = 8, tolerance = 50 } = validation.sanitizedData;

  try {
    // T-02-07: checkLimit MUST be first operation after auth to prevent cost amplification
    const userId = req.user!.id;
    const limitCheck = await checkLimit(userId, 'ai_ideas');

    if (!limitCheck.canUse) {
      return res.status(403).json({
        error: 'AI_LIMIT_REACHED',
        message: `You've reached your monthly limit of ${limitCheck.limit} AI-generated ideas. Upgrade to Team or Enterprise for unlimited AI generation.`,
        current: limitCheck.current,
        limit: limitCheck.limit,
        percentageUsed: limitCheck.percentageUsed,
      });
    }

    // Select model via router
    const selection = selectModel({
      task: 'generate-ideas',
      hasVision: false,
      hasAudio: false,
      userTier: 'free', // TODO: wire actual user tier from subscription
    });

    const model = getModel(selection.gatewayModelId);

    // Build persona-driven prompts
    const personaContext = getProjectTypePersona(projectType, tolerance);

    const systemPrompt = `${personaContext.persona}

EXPERTISE AREAS: ${personaContext.expertiseAreas.join(', ')}

IDEA GENERATION APPROACH:
${personaContext.approach}

Idea tolerance level: ${tolerance}% ${personaContext.toleranceGuidance}

CLARIFYING QUESTIONS TO CONSIDER:
Before generating ideas, mentally consider these questions to tailor your suggestions:
${personaContext.clarifyingQuestions.map(q => `- ${q}`).join('\n')}

INDUSTRY-SPECIFIC INSIGHTS:
${personaContext.industryInsights}

RESPONSE FORMAT:
Return exactly ${count} diverse, actionable ideas as a JSON array with this exact format:
[
  {
    "title": "Brief descriptive title",
    "description": "Detailed explanation of the idea and its implementation, including ${projectType}-specific considerations",
    "effort": "low|medium|high",
    "impact": "low|medium|high",
    "category": "relevant category name for ${projectType} projects",
    "rationale": "Why this idea is particularly relevant for ${projectType} projects"
  }
]`;

    const userPrompt = `${personaContext.projectAnalysis}

PROJECT DETAILS:
Title: ${title}
Description: ${description}
Type: ${projectType}

TASK: Generate ${count} actionable ideas that vary in effort and impact levels. Consider the clarifying questions from your persona to ensure ideas are perfectly tailored to this ${projectType} project's context and goals.

${personaContext.additionalPrompt}`;

    const startTime = Date.now();

    // Generate via AI SDK (replaces raw fetch to OpenAI/Anthropic)
    const { text, usage } = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: selection.temperature,
      maxOutputTokens: selection.maxOutputTokens,
    });

    const responseTimeMs = Date.now() - startTime;

    // Parse JSON response (replaces inline markdown stripping)
    let ideas: unknown[];
    try {
      const parsed = parseJsonResponse(text);
      ideas = Array.isArray(parsed) ? parsed : [];
    } catch (_parseError) {
      console.error('Failed to parse AI response as JSON, returning empty ideas');
      ideas = [];
    }

    // Track token usage
    const mappedUsage = mapUsageToTracking(usage);
    await trackTokenUsage({
      userId,
      projectId: req.body.projectId || null,
      endpoint: 'generate-ideas',
      model: selection.modelId,
      usage: mappedUsage,
      responseTimeMs,
      success: true,
    });

    // Track AI usage for subscription limits
    try {
      await trackAIUsage(userId, 'ai_ideas');
    } catch (_trackingError) {
      console.error('Failed to track AI usage (non-critical):', _trackingError);
      // Don't fail the request if tracking fails
    }

    return res.status(200).json({ ideas });
  } catch (error) {
    console.error('Error generating ideas:', error);
    // T-02-06: Do not expose raw AI SDK error details in production
    return res.status(500).json({
      error: 'Failed to generate ideas',
      debug: process.env.NODE_ENV === 'development'
        ? (error instanceof Error ? error.message : String(error))
        : undefined,
    });
  }
}
