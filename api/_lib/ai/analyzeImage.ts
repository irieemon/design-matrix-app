/**
 * Analyze Image handler -- migrated from api/ai.ts to use AI SDK.
 *
 * Replaces raw fetch() to OpenAI chat/completions with generateText()
 * using vision content parts via the AI Gateway. Preserves identical
 * response shape and analysis type routing.
 *
 * Per D-04, AI-04: selectModel with hasVision=true ensures vision-capable
 * model is always selected (never MiniMax).
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedRequest } from '../middleware/index.js';
import { selectModel } from './modelRouter.js';
import { getModel } from './providers.js';

// Structured output schema. The frontend (AIIdeaModal normalizeAnalysisResult)
// expects exactly these fields — using generateObject forces the model to
// return them directly instead of the markdown-heavy blob generateText was
// producing.
const imageAnalysisSchema = z.object({
  subject: z
    .string()
    .describe(
      'A concise 3-8 word title summarizing what the image is about. No markdown, no trailing colon.'
    ),
  description: z
    .string()
    .describe(
      'A 1-2 sentence summary of the image and its relevance. Plain prose, no markdown formatting, no bullet points.'
    ),
  textContent: z
    .string()
    .describe('Any text visible in the image, extracted verbatim. Empty string if none.'),
  insights: z
    .array(z.string())
    .max(5)
    .describe(
      '3-5 short actionable insights or observations relevant to the project. Each insight is one sentence, no markdown.'
    ),
  relevanceScore: z
    .number()
    .min(0)
    .max(100)
    .describe('How relevant this image is to the project context, 0-100.'),
});

/**
 * Handles the analyze-image action.
 *
 * Validates input, selects a vision-capable model, analyzes the image
 * using AI SDK vision content parts, and returns { analysis: {...} }.
 */
export async function handleAnalyzeImage(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    console.log('Image analysis request:', req.body);

    const { imageUrl, projectContext, analysisType = 'general' } = req.body;

    if (!imageUrl) {
      console.error('Missing required field: imageUrl');
      return res.status(400).json({ error: 'Image URL is required' });
    }

    const analysis = await analyzeImageWithVision(
      imageUrl,
      projectContext,
      analysisType,
    );

    return res.status(200).json({ analysis });

  } catch (error) {
    console.error('Image analysis error:', error);
    return res.status(500).json({ error: 'Failed to analyze image' });
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function analyzeImageWithVision(
  imageUrl: string,
  projectContext: any = {},
  analysisType: string = 'general',
) {
  console.log('Analyzing image with AI SDK vision:', { imageUrl: imageUrl.substring(0, 100) + '...', analysisType });

  // Create analysis prompt based on type and project context
  const basePrompt = getImageAnalysisPrompt(analysisType, projectContext);

  // AI SDK migration: selectModel ensures vision-capable model (never MiniMax per AI-04)
  const selection = selectModel({
    task: 'analyze-image',
    hasVision: true,
    hasAudio: false,
    userTier: 'free', // TODO: wire actual user tier from subscription
  });

  const model = getModel(selection.gatewayModelId);

  // Structured output: forces the model to return the exact fields the UI
  // normalizer expects, eliminating the need for ad-hoc text parsing.
  const { object } = await generateObject({
    model,
    schema: imageAnalysisSchema,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: basePrompt },
        { type: 'image', image: imageUrl },
      ],
    }],
    maxOutputTokens: selection.maxOutputTokens,
    temperature: selection.temperature,
  });

  console.log('AI SDK vision response received (structured)');

  return {
    type: analysisType,
    ...object,
    // Back-compat fields for any older consumers that read these
    extractedText: object.textContent,
    relevance:
      object.relevanceScore >= 70 ? 'high' : object.relevanceScore >= 40 ? 'medium' : 'low',
  };
}

function getImageAnalysisPrompt(analysisType: string, projectContext: any): string {
  const projectInfo = projectContext ? `

PROJECT CONTEXT:
- Project: ${projectContext.projectName || 'Unknown'}
- Type: ${projectContext.projectType || 'General'}
- Description: ${projectContext.description || 'No description available'}` : '';

  const baseInstructions = `You are an expert visual analyst helping populate a prioritization matrix for a project.${projectInfo}

Analyze the image and return a structured response. Keep the subject concise (3-8 words, no markdown), the description to 1-2 sentences of plain prose, and insights as 3-5 short actionable observations.

Focus on:`;

  switch (analysisType) {
    case 'ui_design':
      return `${baseInstructions}
1. UI/UX elements - buttons, forms, navigation, layout
2. Design patterns and user experience considerations
3. Accessibility and usability observations
4. How this relates to the project's design goals
5. Any text or data visible in the interface

Provide specific, actionable insights about the design and user experience.`;

    case 'data_visualization':
      return `${baseInstructions}
1. Charts, graphs, and data representations
2. Data insights and trends visible
3. Visualization effectiveness and clarity
4. How this data relates to the project goals
5. Any specific numbers, metrics, or KPIs shown

Extract all visible data points and provide analysis of what the data reveals.`;

    case 'process_diagram':
      return `${baseInstructions}
1. Process flows, workflows, and system diagrams
2. Steps, decision points, and connections
3. Bottlenecks or optimization opportunities
4. How this process relates to the project
5. Any text labels or process descriptions

Identify the process being illustrated and suggest improvements or insights.`;

    case 'document_screenshot':
      return `${baseInstructions}
1. Text content - extract all readable text
2. Document structure and organization
3. Key information and data points
4. How this document relates to the project
5. Any forms, tables, or structured data

Extract all text content and identify the document's purpose and relevance.`;

    case 'general':
    default:
      return `${baseInstructions}
1. Overall content and subject matter
2. Text extraction - read any visible text
3. Visual elements that relate to the project
4. Data, metrics, or information visible
5. Potential insights or opportunities

Provide a comprehensive analysis of what you see and how it might be relevant to the project.`;
  }
}

