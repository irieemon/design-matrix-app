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

import { generateText } from 'ai';
import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedRequest } from '../middleware/index.js';
import { selectModel } from './modelRouter.js';
import { getModel } from './providers.js';

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

  // AI SDK vision content parts format (replaces raw OpenAI fetch)
  const { text } = await generateText({
    model,
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

  console.log('AI SDK vision response received');

  try {
    // Try to parse as JSON if it's structured analysis
    if (text.trim().startsWith('{')) {
      return JSON.parse(text);
    } else {
      // Return text analysis
      return {
        type: analysisType,
        description: text,
        extractedText: text,
        insights: extractImageInsights(text, projectContext),
        relevance: assessImageProjectRelevance(text, projectContext),
      };
    }
  } catch (_parseError) {
    console.log('Returning raw analysis (not JSON):', text.substring(0, 200));
    return {
      type: analysisType,
      description: text,
      extractedText: '',
      insights: [],
      relevance: 'medium',
    };
  }
}

function getImageAnalysisPrompt(analysisType: string, projectContext: any): string {
  const projectInfo = projectContext ? `

PROJECT CONTEXT:
- Project: ${projectContext.projectName || 'Unknown'}
- Type: ${projectContext.projectType || 'General'}
- Description: ${projectContext.description || 'No description available'}` : '';

  const baseInstructions = `You are an expert visual analyst. Analyze this image in detail and provide insights relevant to the project context.${projectInfo}

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

function extractImageInsights(analysisContent: string, _projectContext: any): string[] {
  const insights: string[] = [];

  // Look for insight indicators in the analysis
  const insightKeywords = ['insight:', 'observation:', 'key finding:', 'important:', 'notable:'];
  const lines = analysisContent.split('\n');

  lines.forEach(line => {
    insightKeywords.forEach(keyword => {
      if (line.toLowerCase().includes(keyword)) {
        insights.push(line.trim());
      }
    });
  });

  // If no specific insights found, extract bullet points
  if (insights.length === 0) {
    const bulletPoints = lines.filter(line =>
      line.trim().startsWith('•') ||
      line.trim().startsWith('-') ||
      line.trim().match(/^\d+\./)
    );
    insights.push(...bulletPoints.slice(0, 3)); // Top 3 bullet points
  }

  return insights.filter(insight => insight.length > 10); // Filter out very short insights
}

function assessImageProjectRelevance(analysisContent: string, projectContext: any): 'high' | 'medium' | 'low' {
  if (!projectContext?.projectName && !projectContext?.projectType) {
    return 'medium';
  }

  const content = analysisContent.toLowerCase();
  const projectName = (projectContext.projectName || '').toLowerCase();
  const projectType = (projectContext.projectType || '').toLowerCase();

  // High relevance indicators
  if (content.includes(projectName) ||
      content.includes(projectType) ||
      content.includes('directly related') ||
      content.includes('highly relevant')) {
    return 'high';
  }

  // Low relevance indicators
  if (content.includes('not related') ||
      content.includes('unrelated') ||
      content.includes('no connection')) {
    return 'low';
  }

  return 'medium';
}
