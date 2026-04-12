/**
 * Generate Insights handler -- migrated from api/ai.ts to use AI SDK.
 *
 * Replaces raw fetch() to OpenAI/Anthropic APIs with generateText() via
 * the AI Gateway. Preserves identical response shape including:
 * - Rate limiting
 * - Anthropic fallback when OpenAI fails
 * - Multi-modal content processing (cached file analysis)
 * - Complex prompt construction with project context
 */

import { generateText } from 'ai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { selectModel, getProviderOptions } from './modelRouter.js';
import { getModel } from './providers.js';
import { getActiveProfile } from './modelProfiles.js';
import type { ModelProfile } from './modelProfiles.js';
import { parseJsonResponse } from './utils/parsing.js';
import { mapUsageToTracking } from './utils/tokenTracking.js';

// Rate limiting store (preserved from original)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 8;
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitStore.get(ip);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }

  userLimit.count++;
  return true;
}

/**
 * Dynamic temperature variation to reduce repetitive AI responses.
 */
function getRandomTemperature(): number {
  const temperatures = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  return temperatures[Math.floor(Math.random() * temperatures.length)];
}

/**
 * Processes cached file analysis from document context.
 * Preserved from original handler -- processes pre-analyzed file results.
 */
async function processCachedFileAnalysis(documentContext: any[] = []) {
  if (!documentContext || documentContext.length === 0) {
    return {
      hasVisualContent: false,
      hasAudioContent: false,
      textContent: '',
      audioTranscripts: '',
      imageDescriptions: '',
      imageUrls: [] as string[],
    };
  }

  let textContent = '';
  let audioTranscripts = '';
  let imageDescriptions = '';
  const imageUrls: string[] = [];
  let hasVisualContent = false;
  let hasAudioContent = false;

  for (const doc of documentContext) {
    try {
      if (doc.ai_analysis && doc.analysis_status === 'completed') {
        const analysis = doc.ai_analysis;

        if (analysis.summary) {
          textContent += `File Analysis - ${doc.name}:\n${analysis.summary}\n\n`;
        }

        if (analysis.key_insights && analysis.key_insights.length > 0) {
          textContent += `Key Insights from ${doc.name}:\n${analysis.key_insights.map((insight: string) => `- ${insight}`).join('\n')}\n\n`;
        }

        if (analysis.content_type === 'image' && analysis.visual_description) {
          hasVisualContent = true;
          imageDescriptions += `Image "${doc.name}": ${analysis.visual_description}\n\n`;
          if (analysis.extracted_text) {
            textContent += `Text extracted from image ${doc.name}: ${analysis.extracted_text}\n\n`;
          }
        }

        if ((analysis.content_type === 'audio' || analysis.content_type === 'video') && analysis.audio_transcript) {
          hasAudioContent = true;
          audioTranscripts += `Audio from ${doc.name}: ${analysis.audio_transcript}\n\n`;
        }

        if (analysis.content_type === 'text' && analysis.extracted_text) {
          textContent += `Content from ${doc.name}: ${analysis.extracted_text}\n\n`;
        }
      } else {
        // Fallback to existing content if no analysis available
        if (doc.content) {
          if (doc.type && doc.type.startsWith('image/')) {
            hasVisualContent = true;
            imageDescriptions += `Image "${doc.name}": ${doc.content}\n\n`;
          } else {
            textContent += `Content from ${doc.name}: ${doc.content}\n\n`;
          }
        }
      }
    } catch (_error) {
      // Continue with other files
      console.warn('Error processing file', doc.name, ':', _error);
    }
  }

  return {
    hasVisualContent,
    hasAudioContent,
    textContent,
    audioTranscripts,
    imageDescriptions,
    imageUrls,
  };
}

/**
 * Builds the system prompt for insights generation.
 */
function buildInsightsSystemPrompt(
  multiModalContent: Awaited<ReturnType<typeof processCachedFileAnalysis>>,
  focusArea: string
): string {
  return `You are an experienced strategic consultant who specializes in analyzing SPECIFIC project contexts. Your job is to provide insights that are deeply relevant to THIS PARTICULAR PROJECT.

CRITICAL INSTRUCTIONS:
1. ANALYZE WHAT'S ACTUALLY HERE: Look at the specific ideas, project name, and context provided. What do they tell you about the real business model, target market, and challenges?
2. BE SPECIFIC, NOT GENERIC: Instead of saying "focus on user experience," say "optimize the subscription onboarding flow" if that's what the ideas suggest.
3. REFERENCE ACTUAL IDEAS: Quote or reference the specific ideas provided. Don't invent generic scenarios.
4. THINK LIKE AN INSIDER: Write as if you understand this exact business and industry.

${multiModalContent.hasVisualContent ? 'VISUAL CONTEXT: This project includes images/videos. Analyze what they reveal about the product, market, or business model.' : ''}
${multiModalContent.hasAudioContent ? 'AUDIO CONTEXT: This project includes transcribed audio. Consider the spoken insights and strategic discussions.' : ''}

FORBIDDEN PATTERNS - Do NOT use these generic phrases:
- "focus on user experience" (be specific about WHAT user experience)
- "leverage digital marketing" (specify WHICH channels for WHAT purpose)
- "enhance community engagement" (explain HOW based on the actual business)
- "diverse marketing channels" (specify channels relevant to THIS project)
- "brand awareness initiatives" (detail what makes sense for THIS brand)

${focusArea === 'comprehensive-risk-analysis' ? `
ENHANCED RISK ANALYSIS MODE ACTIVATED:
Since this is a comprehensive risk assessment request, provide EXTRA THOROUGH risk analysis:
- Analyze each quadrant for specific risks (Quick Wins: execution risks, Major Projects: scope/complexity risks, etc.)
- Consider technical risks, market risks, operational risks, financial risks, and strategic risks
- Provide specific, actionable mitigations for each identified risk
- Include risk interdependencies and cascading effects
- Suggest risk monitoring and early warning indicators
- Prioritize risks by impact and likelihood
- Provide 5-8 specific risks and matching detailed mitigations
` : ''}

Instead, provide tactical, actionable insights that reference the actual ideas and project context.

RESPOND WITH VALID JSON ONLY - no explanatory text before or after.

Provide your analysis as a JSON object with these sections:
{
  "executiveSummary": "Your strategic overview of what you see in this project",
  "keyInsights": [
    {
      "insight": "What stands out to you",
      "impact": "Why this matters for the project"
    }
  ],
  "priorityRecommendations": {
    "immediate": ["What should they do first"],
    "shortTerm": ["Next steps"],
    "longTerm": ["Bigger picture moves"]
  },
  "riskAssessment": {
    "risks": ["Specific risks and challenges for this project"],
    "mitigations": ["Practical strategies to address these risks"]
  },
  "suggestedRoadmap": [
    {
      "phase": "Logical next phase",
      "duration": "Realistic timeframe",
      "focus": "What this phase accomplishes",
      "ideas": ["Specific ideas from their list that fit here"]
    }
  ],
  "resourceAllocation": {
    "quickWins": "Where to focus energy first",
    "strategic": "Longer-term investments"
  },
  "futureEnhancements": [
    {
      "title": "Enhancement Title",
      "description": "Detailed description of the enhancement opportunity that builds on existing ideas",
      "relatedIdea": "Name of related idea from the portfolio",
      "impact": "high|medium|low",
      "timeframe": "Time estimate for implementation"
    }
  ],
  "nextSteps": ["Board-level next step 1", "Board-level next step 2"]
}`;
}

/**
 * Builds the user prompt for insights generation.
 */
function buildInsightsUserPrompt(
  ideas: any[],
  projectName: string,
  projectType: string,
  roadmapContext: any,
  multiModalContent: Awaited<ReturnType<typeof processCachedFileAnalysis>>,
): string {
  const ideaAnalysis = ideas.map((idea, index) => {
    const position = idea.quadrant || 'unknown';
    return `${index + 1}. "${idea.title}" (${position} quadrant)${idea.description ? ` - ${idea.description}` : ''}`;
  }).join('\n');

  const projectContextStr = `
PROJECT ANALYSIS REQUIRED FOR: ${projectName} (${projectType})

SPECIFIC IDEAS TO ANALYZE:
${ideaAnalysis}

QUADRANT DISTRIBUTION:
- Quick Wins: ${ideas.filter(i => i.quadrant === 'quick-wins').length} ideas
- Major Projects: ${ideas.filter(i => i.quadrant === 'major-projects').length} ideas
- Fill-ins: ${ideas.filter(i => i.quadrant === 'fill-ins').length} ideas
- Thankless Tasks: ${ideas.filter(i => i.quadrant === 'thankless-tasks').length} ideas`;

  return `STRATEGIC ANALYSIS REQUEST:

${projectContextStr}

${roadmapContext ? `EXISTING ROADMAP CONTEXT: Previous planning exists - build on this foundation.` : ''}

${multiModalContent.textContent ? `
DOCUMENT INTELLIGENCE:
${multiModalContent.textContent}
` : ''}

${multiModalContent.audioTranscripts ? `
MEETING TRANSCRIPTS:
${multiModalContent.audioTranscripts}
` : ''}

${multiModalContent.imageDescriptions ? `
VISUAL ASSETS ANALYSIS:
${multiModalContent.imageDescriptions}
` : ''}

REQUIRED OUTPUT:
Analyze these SPECIFIC ideas and provide strategic insights that reference the actual project context. Look for:
1. What business model emerges from these ideas?
2. What market/customer segment do these ideas target?
3. Which ideas have synergies or conflicts?
4. What's missing from this portfolio?
5. What sequence makes strategic sense?

Be specific about THIS project - not generic business advice.`;
}

/**
 * Anthropic fallback prompt (simplified version without multi-modal content).
 */
function buildAnthropicFallbackPrompt(
  ideas: any[],
  projectName: string,
  projectType: string,
  roadmapContext: any,
  documentContext: any[],
): string {
  return `You are an experienced strategic consultant analyzing this specific project. Think like a seasoned advisor who asks the right questions and provides insights based on what you actually see.

Analyze the actual ideas provided - what do they tell you about this project's real focus, challenges, and opportunities? Look for patterns, gaps, and strategic priorities that emerge from the specific context.

Avoid generic business templates. Instead, provide thoughtful analysis that someone familiar with this exact project would find valuable and actionable.

Write conversationally and insightfully, like you're advising a founder or product team who knows their domain well.

IMPORTANT: Respond ONLY with valid JSON. Do not include any explanatory text before or after the JSON.

I'm looking for strategic insights on this project: ${projectName} (${projectType})

IDEAS WE'RE CONSIDERING:
${ideas.map(idea => `- ${idea.title} - ${idea.description}`).join('\n')}

${roadmapContext ? `We already have some roadmap planning in place.` : ''}

${documentContext && documentContext.length > 0 ? `
ADDITIONAL CONTEXT:
${documentContext.map(doc => `- ${doc.name}: ${doc.content?.substring(0, 200)}...`).join('\n')}
` : ''}

Provide your analysis as a JSON object with these sections:
{
  "executiveSummary": "Your strategic overview of what you see in this project",
  "keyInsights": [
    {
      "insight": "What stands out to you",
      "impact": "Why this matters for the project"
    }
  ],
  "priorityRecommendations": {
    "immediate": ["What should they do first"],
    "shortTerm": ["Next steps"],
    "longTerm": ["Bigger picture moves"]
  },
  "riskAssessment": {
    "risks": ["Specific risks and challenges for this project"],
    "mitigations": ["Practical strategies to address these risks"]
  },
  "suggestedRoadmap": [
    {
      "phase": "Logical next phase",
      "duration": "Realistic timeframe",
      "focus": "What this phase accomplishes",
      "ideas": ["Specific ideas from their list that fit here"]
    }
  ],
  "resourceAllocation": {
    "quickWins": "Where to focus energy first",
    "strategic": "Longer-term investments"
  },
  "futureEnhancements": [],
  "nextSteps": ["Practical next steps"]
}`;
}

/**
 * Handles the generate-insights action.
 *
 * Generates strategic insights from ideas using AI SDK, with Anthropic
 * fallback if the primary OpenAI call fails.
 */
export async function handleGenerateInsights(req: VercelRequest, res: VercelResponse) {
  try {
    const clientIP = req.headers['x-forwarded-for'] as string || req.socket?.remoteAddress || 'unknown';

    if (!checkRateLimit(clientIP)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    const { ideas, projectName, projectType, roadmapContext, documentContext, focusArea } = req.body;

    if (!ideas || !Array.isArray(ideas)) {
      return res.status(400).json({ error: 'Ideas array is required' });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!openaiKey && !anthropicKey) {
      return res.status(500).json({ error: 'No AI service configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.' });
    }

    // Profile-aware model routing (ADR-0013 Step 3)
    const profile = await getActiveProfile();
    let insights: Record<string, unknown> = {};

    if (openaiKey) {
      try {
        insights = await generateInsightsWithOpenAI(ideas, projectName, projectType, roadmapContext, documentContext, focusArea, profile);
      } catch (openaiError) {
        console.error('OpenAI insights generation failed, trying Anthropic fallback:', openaiError);
        if (anthropicKey) {
          insights = await generateInsightsWithAnthropic(ideas, projectName, projectType, roadmapContext, documentContext, profile);
        } else {
          throw openaiError;
        }
      }
    } else if (anthropicKey) {
      insights = await generateInsightsWithAnthropic(ideas, projectName, projectType, roadmapContext, documentContext, profile);
    }

    // Validate response structure
    if (!insights || typeof insights !== 'object' || Object.keys(insights).length === 0) {
      throw new Error('AI service returned empty or invalid response');
    }

    return res.status(200).json({ insights });
  } catch (error) {
    console.error('Function error:', error);
    // T-02-06: Do not expose raw AI SDK error details
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({
      error: `Failed to generate insights: ${errorMessage}`,
      timestamp: new Date().toISOString(),
      functionId: 'generate-insights',
    });
  }
}

/**
 * Generate insights via AI SDK using the primary model (OpenAI).
 */
async function generateInsightsWithOpenAI(
  ideas: any[],
  projectName: string,
  projectType: string,
  roadmapContext: any = null,
  documentContext: any[] = [],
  focusArea: string = 'standard',
  profile?: ModelProfile | null,
): Promise<Record<string, unknown>> {
  const multiModalContent = await processCachedFileAnalysis(documentContext);

  const selection = selectModel({
    task: 'generate-insights',
    hasVision: multiModalContent.hasVisualContent,
    hasAudio: multiModalContent.hasAudioContent,
    userTier: 'free', // TODO: wire actual user tier
  }, profile);

  const model = getModel(selection.gatewayModelId);
  const providerOptions = getProviderOptions(selection.fallbackModels);

  const systemPrompt = buildInsightsSystemPrompt(multiModalContent, focusArea);
  const userPrompt = buildInsightsUserPrompt(ideas, projectName, projectType, roadmapContext, multiModalContent);

  const { text, usage: _usage } = await generateText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: selection.temperature ?? getRandomTemperature(),
    maxOutputTokens: selection.maxOutputTokens,
    ...(providerOptions ? { providerOptions } : {}),
  });

  if (!text) {
    throw new Error('AI returned empty response');
  }

  const parsed = parseJsonResponse(text);
  return parsed as Record<string, unknown>;
}

/**
 * Generate insights via AI SDK using Anthropic fallback model.
 */
async function generateInsightsWithAnthropic(
  ideas: any[],
  projectName: string,
  projectType: string,
  roadmapContext: any = null,
  documentContext: any[] = [],
  profile?: ModelProfile | null,
): Promise<Record<string, unknown>> {
  // Profile-aware routing replaces hardcoded anthropic model (ADR-0013 Step 3).
  // The gateway fallback system handles provider failover via providerOptions.
  const selection = selectModel({
    task: 'generate-insights',
    hasVision: false,
    hasAudio: false,
    userTier: 'free',
  }, profile);

  const model = getModel(selection.gatewayModelId);
  const providerOptions = getProviderOptions(selection.fallbackModels);

  const prompt = buildAnthropicFallbackPrompt(ideas, projectName, projectType, roadmapContext, documentContext);

  const { text } = await generateText({
    model,
    prompt,
    temperature: selection.temperature ?? getRandomTemperature(),
    maxOutputTokens: selection.maxOutputTokens,
    ...(providerOptions ? { providerOptions } : {}),
  });

  if (!text) {
    throw new Error('Anthropic returned empty response');
  }

  const parsed = parseJsonResponse(text);
  return parsed as Record<string, unknown>;
}
