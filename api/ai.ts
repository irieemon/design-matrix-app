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
import { createClient } from '@supabase/supabase-js'
import { InputValidator, commonRules } from '../src/lib/api/utils/validation'

// ============================================================================
// GENERATE IDEAS HANDLER
// ============================================================================

async function handleGenerateIdeas(req: VercelRequest, res: VercelResponse) {
  // Validate and sanitize input
  const validation = InputValidator.validate(req.body, [
    commonRules.title,
    commonRules.description,
    { ...commonRules.projectType, required: false },
    { ...commonRules.count, required: false },
    { ...commonRules.tolerance, required: false }
  ])

  if (!validation.isValid) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validation.errors
    })
  }

  // Use sanitized data
  const { title, description, projectType = 'other', count = 8, tolerance = 50 } = validation.sanitizedData

  try {
    console.log('📥 Request body:', req.body)
    console.log('🔧 Request headers:', {
      authorization: req.headers.authorization ? 'Bearer ***' : 'Missing',
      contentType: req.headers['content-type'],
      userAgent: req.headers['user-agent']
    })

    console.log('🔍 Validated fields:', { title, description, projectType, count, tolerance })

    // Get API keys from environment (these are server-side only)
    const openaiKey = process.env.OPENAI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY

    console.log('🔑 API Key status:', {
      hasOpenAI: !!openaiKey,
      hasAnthropic: !!anthropicKey,
      openAIPrefix: openaiKey ? openaiKey.substring(0, 7) + '...' : 'none'
    })

    if (!openaiKey && !anthropicKey) {
      console.error('❌ No AI service configured - missing API keys')
      return res.status(500).json({ error: 'No AI service configured' })
    }

    let ideas = []

    if (openaiKey) {
      // Use OpenAI
      console.log('🤖 Calling OpenAI API...')
      try {
        ideas = await generateIdeasWithOpenAI(openaiKey, title, description, projectType, count, tolerance)
        console.log('✅ OpenAI API call completed, ideas count:', ideas?.length || 0)
        console.log('🔍 Sample idea:', ideas?.[0])
      } catch (openaiError) {
        console.error('❌ OpenAI API error:', openaiError)
        throw openaiError
      }
    } else if (anthropicKey) {
      // Use Anthropic
      console.log('🤖 Calling Anthropic API...')
      try {
        ideas = await generateIdeasWithAnthropic(anthropicKey, title, description, projectType, count, tolerance)
        console.log('✅ Anthropic API call completed, ideas count:', ideas?.length || 0)
        console.log('🔍 Sample idea:', ideas?.[0])
      } catch (anthropicError) {
        console.error('❌ Anthropic API error:', anthropicError)
        throw anthropicError
      }
    }

    return res.status(200).json({ ideas })

  } catch (error) {
    console.error('❌ Error generating ideas:', error)
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown'
    })
    return res.status(500).json({
      error: 'Failed to generate ideas',
      debug: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
    })
  }
}

async function generateIdeasWithOpenAI(apiKey: string, title: string, description: string, projectType: string, count: number = 8, tolerance: number = 50) {
  console.log('🚀 Making OpenAI request with:', {
    model: 'gpt-4o',
    temperature: 0.8,
    max_tokens: 2500
  })

  // Get project-specific persona and context
  const personaContext = getProjectTypePersona(projectType, tolerance)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `${personaContext.persona}

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
]`
        },
        {
          role: 'user',
          content: `${personaContext.projectAnalysis}

PROJECT DETAILS:
Title: ${title}
Description: ${description}
Type: ${projectType}

TASK: Generate ${count} actionable ideas that vary in effort and impact levels. Consider the clarifying questions from your persona to ensure ideas are perfectly tailored to this ${projectType} project's context and goals.

${personaContext.additionalPrompt}`
        }
      ],
      temperature: 0.8,
      max_tokens: 2500,
    }),
  })

  console.log('📡 OpenAI response status:', response.status)

  if (!response.ok) {
    console.error('❌ OpenAI API error:', response.status, response.statusText)
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  console.log('📄 OpenAI response data:', JSON.stringify(data, null, 2))

  const content = data.choices[0]?.message?.content || '[]'
  console.log('📝 Extracted content:', content)

  try {
    // Strip markdown code blocks if present
    let cleanContent = content.trim()
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }

    console.log('🧹 Cleaned content:', cleanContent)

    const parsedIdeas = JSON.parse(cleanContent)
    console.log('✅ Successfully parsed ideas:', parsedIdeas)
    return parsedIdeas
  } catch (parseError) {
    console.error('❌ JSON parsing failed:', parseError)
    console.log('📝 Raw content that failed to parse:', content)
    // Fallback if JSON parsing fails
    return []
  }
}

function getProjectTypePersona(projectType: string, tolerance: number) {
  const type = projectType.toLowerCase()

  // Tolerance guidance based on risk level
  const toleranceGuidance = tolerance < 30
    ? 'Focus on safe, proven, low-risk ideas with established success patterns and measurable ROI.'
    : tolerance < 70
      ? 'Include a mix of proven ideas and some innovative approaches with moderate risk and potential for differentiation.'
      : 'Emphasize experimental, cutting-edge, high-risk/high-reward ideas that push boundaries and create competitive advantages.'

  if (type.includes('software') || type.includes('app') || type.includes('platform') || type.includes('system')) {
    return {
      persona: "You are a Senior Software Product Manager with 10+ years at companies like Google, Stripe, and Airbnb. You have deep expertise in user acquisition, product-market fit, technical architecture, and scaling software products from MVP to millions of users.",
      expertiseAreas: ['User Experience Design', 'Technical Architecture', 'Growth Hacking', 'Data Analytics', 'API Strategy', 'DevOps & Infrastructure', 'User Acquisition', 'Monetization Models'],
      approach: "Think like a Silicon Valley product leader. Focus on user value, technical feasibility, scalability, and business metrics. Consider the full software development lifecycle and user journey.",
      toleranceGuidance,
      clarifyingQuestions: [
        "What is the target user persona and their primary pain points?",
        "What's the competitive landscape and how can we differentiate?",
        "What technical constraints and infrastructure do we need to consider?",
        "How will we measure user engagement and product-market fit?",
        "What's our go-to-market strategy and user acquisition channels?",
        "How does this fit into the broader product ecosystem?",
        "What are the key integration and API requirements?",
        "What privacy, security, and compliance considerations are critical?"
      ],
      industryInsights: "Software products succeed through exceptional user experience, strong technical foundations, data-driven iteration, and sustainable growth loops. Focus on solving real user problems with elegant technical solutions.",
      projectAnalysis: "Analyzing this software project through the lens of product strategy, technical architecture, user experience, and market positioning:",
      additionalPrompt: "Consider both technical implementation details and business model implications. Think about scalability, user adoption, and long-term product vision."
    }
  }

  if (type.includes('marketing') || type.includes('campaign') || type.includes('brand')) {
    return {
      persona: "You are a Chief Marketing Officer with 15+ years at high-growth companies like HubSpot, Mailchimp, and Canva. You excel at multi-channel campaign strategy, brand positioning, customer acquisition, and performance marketing with deep analytics expertise.",
      expertiseAreas: ['Brand Strategy', 'Performance Marketing', 'Customer Segmentation', 'Content Strategy', 'Social Media', 'Email Marketing', 'SEO/SEM', 'Marketing Automation', 'Attribution Modeling', 'Creative Strategy'],
      approach: "Think like a data-driven marketing executive. Focus on audience insights, channel optimization, brand consistency, and measurable business outcomes. Consider the entire customer journey and lifecycle.",
      toleranceGuidance,
      clarifyingQuestions: [
        "Who is our target audience and what are their media consumption habits?",
        "What's our unique value proposition and brand positioning?",
        "Which marketing channels will give us the best ROI and reach?",
        "How will we measure campaign success and attribute conversions?",
        "What's our budget allocation across different marketing tactics?",
        "How does this campaign align with our overall brand strategy?",
        "What creative assets and content do we need to produce?",
        "How will we personalize the message for different audience segments?"
      ],
      industryInsights: "Successful marketing campaigns combine compelling creative with precise targeting, multi-touch attribution, and continuous optimization. Focus on authentic brand storytelling that drives measurable business results.",
      projectAnalysis: "Analyzing this marketing project through strategic brand positioning, audience targeting, channel mix optimization, and performance measurement:",
      additionalPrompt: "Consider both brand building and performance marketing goals. Think about creative concepts, audience segmentation, and measurement frameworks."
    }
  }

  // Default/Generic persona
  return {
    persona: "You are an experienced Project Manager and Strategic Consultant with 10+ years leading diverse initiatives across industries. You excel at project planning, stakeholder management, resource optimization, and delivering measurable results.",
    expertiseAreas: ['Project Management', 'Strategic Planning', 'Stakeholder Management', 'Resource Optimization', 'Risk Management', 'Process Improvement', 'Change Management', 'Performance Measurement'],
    approach: "Think like a seasoned project leader. Focus on clear objectives, efficient execution, stakeholder satisfaction, and measurable outcomes. Consider both strategic goals and practical constraints.",
    toleranceGuidance,
    clarifyingQuestions: [
      "What are the primary objectives and success criteria?",
      "Who are the key stakeholders and what do they need?",
      "What resources and constraints do we need to consider?",
      "What are the main risks and dependencies?",
      "How will we measure progress and success?",
      "What's the optimal timeline and milestone structure?",
      "What communication and reporting is required?",
      "How will we ensure quality and stakeholder satisfaction?"
    ],
    industryInsights: "Successful projects require clear objectives, stakeholder alignment, efficient execution, and continuous adaptation. Focus on value delivery and sustainable outcomes.",
    projectAnalysis: "Analyzing this project through planning frameworks, stakeholder requirements, resource optimization, and value delivery:",
    additionalPrompt: "Consider both strategic goals and operational realities. Think about stakeholder needs, resource constraints, and delivery excellence."
  }
}

async function generateIdeasWithAnthropic(apiKey: string, title: string, description: string, projectType: string, count: number = 8, tolerance: number = 50) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2500,
      messages: [
        {
          role: 'user',
          content: `You are a creative project manager. Generate exactly ${count} diverse, actionable ideas for this project that vary in effort and impact levels.

Idea tolerance level: ${tolerance}% (0% = safe, proven ideas only; 100% = highly experimental, cutting-edge ideas)
${tolerance < 30 ? 'Focus on safe, proven, low-risk ideas with established success patterns.' :
  tolerance < 70 ? 'Include a mix of proven ideas and some innovative approaches with moderate risk.' :
  'Emphasize experimental, cutting-edge, high-risk/high-reward ideas that push boundaries.'}

Project: ${title}
Description: ${description}
Type: ${projectType}

Return ONLY a JSON array with this exact format:
[
  {
    "title": "Brief descriptive title",
    "description": "Detailed explanation of the idea and its implementation",
    "effort": "low|medium|high",
    "impact": "low|medium|high",
    "category": "relevant category name"
  }
]`
        }
      ],
      temperature: 0.8,
    }),
  })

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.content[0]?.text || '[]'

  try {
    return JSON.parse(content)
  } catch {
    // Fallback if JSON parsing fails
    return []
  }
}

// ============================================================================
// GENERATE INSIGHTS HANDLER (Inline from api/ai/generate-insights.ts)
// ============================================================================

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Simple rate limiting: 8 requests per minute per IP
const RATE_LIMIT = 8
const RATE_WINDOW = 60 * 1000 // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const userLimit = rateLimitStore.get(ip)

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_WINDOW })
    return true
  }

  if (userLimit.count >= RATE_LIMIT) {
    return false
  }

  userLimit.count++
  return true
}

async function handleGenerateInsights(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('🚀 AI Insights API called at:', new Date().toISOString())

    const clientIP = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown'

    if (!checkRateLimit(clientIP)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' })
    }

    console.log('📥 Request body keys:', Object.keys(req.body))
    const { ideas, projectName, projectType, roadmapContext, documentContext, projectContext, modelSelection, taskContext, focusArea } = req.body

    console.log('🔍 Parsed request:', {
      ideasCount: ideas?.length || 0,
      projectName,
      projectType,
      hasRoadmapContext: !!roadmapContext,
      documentCount: documentContext?.length || 0,
      hasProjectContext: !!projectContext,
      hasModelSelection: !!modelSelection,
      selectedModel: modelSelection?.model || 'default',
      complexity: taskContext?.complexity || 'unknown',
      focusArea: focusArea || 'standard'
    })

    if (!ideas || !Array.isArray(ideas)) {
      console.error('❌ Ideas validation failed:', { ideas: typeof ideas, isArray: Array.isArray(ideas) })
      return res.status(400).json({ error: 'Ideas array is required' })
    }

    const openaiKey = process.env.OPENAI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY

    console.log('🔑 API Keys check:', {
      hasOpenAI: !!openaiKey,
      hasAnthropic: !!anthropicKey,
      openaiLength: openaiKey?.length || 0
    })

    if (!openaiKey && !anthropicKey) {
      return res.status(500).json({ error: 'No AI service configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.' })
    }

    let insights = {}

    if (openaiKey) {
      console.log('🤖 Using OpenAI for insights generation')
      console.log('📊 Model Selection:', {
        model: modelSelection?.model || 'gpt-4o (default)',
        temperature: modelSelection?.temperature || 'dynamic',
        reasoning: modelSelection?.reasoning || 'No routing provided'
      })
      insights = await generateInsightsWithOpenAI(openaiKey, ideas, projectName, projectType, roadmapContext, documentContext, projectContext, modelSelection, focusArea)
    } else if (anthropicKey) {
      console.log('Using Anthropic for insights generation')
      insights = await generateInsightsWithAnthropic(anthropicKey, ideas, projectName, projectType, roadmapContext, documentContext, projectContext)
    }

    console.log('Generated insights:', Object.keys(insights))

    // Validate that we got proper insights structure
    if (!insights || typeof insights !== 'object' || Object.keys(insights).length === 0) {
      throw new Error('AI service returned empty or invalid response')
    }

    return res.status(200).json({ insights })

  } catch (error) {
    console.error('❌ FUNCTION ERROR:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      type: typeof error,
      timestamp: new Date().toISOString()
    })

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return res.status(500).json({
      error: `Failed to generate insights: ${errorMessage}`,
      timestamp: new Date().toISOString(),
      functionId: 'generate-insights'
    })
  }
}

// Dynamic prompt variation helpers to reduce repetitive AI responses
function getRandomTemperature(model?: string): number {
  // GPT-5 models only support default temperature (1)
  if (model && (model.startsWith('gpt-5') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4'))) {
    return 1
  }

  // For older models, use varied temperatures
  const temperatures = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
  return temperatures[Math.floor(Math.random() * temperatures.length)]
}

async function generateInsightsWithOpenAI(apiKey: string, ideas: any[], projectName: string, projectType: string, roadmapContext: any = null, documentContext: any[] = [], _projectContext: any = null, modelSelection: any = null, focusArea: string = 'standard') {

  console.log('🚀 OPENAI FUNCTION: Starting generateInsightsWithOpenAI')
  console.log('🎯 OPENAI: API Key available:', !!apiKey, 'Length:', apiKey?.length || 0)
  console.log('📋 OPENAI: Ideas count:', ideas?.length || 0)
  console.log('📁 OPENAI: Document context files:', documentContext?.length || 0)

  if (documentContext && documentContext.length > 0) {
    console.log('📄 OPENAI: Document files details:')
    documentContext.forEach((doc, index) => {
      console.log(`  ${index + 1}. ${doc.name} (${doc.mimeType || doc.type || 'unknown'}) - ${doc.content?.length || 0} chars`)
      if (doc.content) {
        console.log(`     Content preview: "${doc.content.substring(0, 100)}..."`)
      }
    })
  }

  // Use cached AI analysis from pre-analyzed files
  console.log('🔄 OPENAI: Using cached AI analysis from files...')
  const multiModalContent = await processCachedFileAnalysis(documentContext)
  console.log('✅ OPENAI: Cached analysis processing complete:', {
    hasVisualContent: multiModalContent.hasVisualContent,
    hasAudioContent: multiModalContent.hasAudioContent,
    textContentLength: multiModalContent.textContent?.length || 0,
    audioTranscriptsLength: multiModalContent.audioTranscripts?.length || 0,
    imageDescriptionsLength: multiModalContent.imageDescriptions?.length || 0,
    imageUrlsCount: multiModalContent.imageUrls?.length || 0
  })

  // Prepare messages array with potential image content
  const messages = [
    {
      role: 'system',
      content: `You are an experienced strategic consultant who specializes in analyzing SPECIFIC project contexts. Your job is to provide insights that are deeply relevant to THIS PARTICULAR PROJECT.

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
}`
    }
  ]

  // Build the user message with multi-modal content
  let userContent = []

  // Start with text content
  // Build a detailed context analysis
  const ideaAnalysis = ideas.map((idea, index) => {
    const position = idea.quadrant || 'unknown'
    return `${index + 1}. "${idea.title}" (${position} quadrant)${idea.description ? ` - ${idea.description}` : ''}`
  }).join('\n')

  const projectContext = `
PROJECT ANALYSIS REQUIRED FOR: ${projectName} (${projectType})

SPECIFIC IDEAS TO ANALYZE:
${ideaAnalysis}

QUADRANT DISTRIBUTION:
- Quick Wins: ${ideas.filter(i => i.quadrant === 'quick-wins').length} ideas
- Major Projects: ${ideas.filter(i => i.quadrant === 'major-projects').length} ideas
- Fill-ins: ${ideas.filter(i => i.quadrant === 'fill-ins').length} ideas
- Thankless Tasks: ${ideas.filter(i => i.quadrant === 'thankless-tasks').length} ideas`

  userContent.push({
    type: 'text',
    text: `STRATEGIC ANALYSIS REQUEST:

${projectContext}

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

Be specific about THIS project - not generic business advice.`
  })

  // Add image content for GPT-4V analysis
  if (multiModalContent.imageUrls && multiModalContent.imageUrls.length > 0) {
    multiModalContent.imageUrls.forEach(imageUrl => {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: imageUrl,
          detail: 'high'
        }
      })
    })
  }

  messages.push({
    role: 'user',
    content: userContent as any // Mixed content array for GPT-4V (text + images)
  })

  // Map frontend model names to actual OpenAI API models
  function mapModelToOpenAI(modelName: string): string {
    const modelMapping: Record<string, string> = {
      // GPT-5 Series -> Use real GPT-5 models (now available!)
      'gpt-5': 'gpt-5',
      'gpt-5-mini': 'gpt-5-mini',
      'gpt-5-nano': 'gpt-5-nano',
      'gpt-5-chat-latest': 'gpt-5-chat-latest',

      // Research models -> Map to reasoning models
      'o3-deep-research': 'o1-preview',
      'o4-mini-deep-research': 'o1-mini',

      // Specialized models -> Use real GPT-5 or closest equivalent
      'gpt-realtime': 'gpt-realtime',

      // O-Series models - pass through unchanged
      'o1-preview': 'o1-preview',
      'o1-mini': 'o1-mini'
    }

    return modelMapping[modelName] || 'gpt-5'
  }

  // Use smart model selection or fallback to defaults
  const requestedModel = modelSelection?.model || 'gpt-5'
  const selectedModel = mapModelToOpenAI(requestedModel)
  const selectedTemperature = modelSelection?.temperature || getRandomTemperature(selectedModel)
  const selectedMaxTokens = modelSelection?.maxTokens || 4000

  console.log('🔄 OPENAI: Model mapping:', {
    requested: requestedModel,
    mapped: selectedModel,
    reasoning: requestedModel !== selectedModel ? 'Mapped to available OpenAI model' : 'Using original model'
  })

  console.log('📤 OPENAI: Preparing API request...')
  console.log('🎯 OPENAI: Smart Model Selection:', {
    model: selectedModel,
    temperature: selectedTemperature,
    maxTokens: selectedMaxTokens,
    reasoning: modelSelection?.reasoning || 'Default selection'
  })
  console.log('📋 OPENAI: Message count:', messages.length)
  console.log('📁 OPENAI: User content items:', userContent.length)
  userContent.forEach((item, index) => {
    console.log(`  ${index + 1}. Type: ${item.type}, ${item.type === 'text' ? `Text length: ${item.text?.length}` : 'Image URL provided'}`)
  })

  console.log('🌐 OPENAI: Making API call to OpenAI...')

  // GPT-5 models have stricter parameter requirements
  const isGPT5Model = selectedModel.startsWith('gpt-5') || selectedModel.startsWith('o1') || selectedModel.startsWith('o3') || selectedModel.startsWith('o4')

  // Handle token parameters: GPT-5 uses max_completion_tokens, older models use max_tokens
  const tokenParams = isGPT5Model
    ? { max_completion_tokens: selectedMaxTokens }
    : { max_tokens: selectedMaxTokens }

  // Handle temperature parameters: GPT-5 only supports default temperature (1)
  const temperatureParams = isGPT5Model
    ? {} // Omit temperature to use default (1) for GPT-5
    : { temperature: selectedTemperature }

  console.log('🔧 OPENAI: Parameter adjustments for model:', selectedModel)
  console.log('🔧 OPENAI: Token parameter:', isGPT5Model ? 'max_completion_tokens' : 'max_tokens')
  console.log('🔧 OPENAI: Temperature handling:', isGPT5Model ? 'default (1)' : `custom (${selectedTemperature})`)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: selectedModel,
      seed: Math.floor(Math.random() * 1000000),
      messages: messages,
      ...temperatureParams,
      ...tokenParams,
    }),
  })

  console.log('📡 OPENAI: API Response status:', response.status, response.statusText)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ OPENAI: API Error details:', errorText)
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
  }

  console.log('✅ OPENAI: API call successful!')
  const data = await response.json()
  console.log('📊 OPENAI: Response data structure:', {
    choices: data.choices?.length || 0,
    usage: data.usage,
    model: data.model
  })

  const content = data.choices[0]?.message?.content

  if (!content) {
    console.error('❌ OPENAI: Empty content in response:', data)
    throw new Error('OpenAI returned empty response')
  }

  console.log('📝 OPENAI: Raw response length:', content.length)
  console.log('📝 OPENAI: Raw response preview:', content.substring(0, 300) + '...')

  // Check if response mentions specific file content
  const mentionsImages = content.toLowerCase().includes('image') || content.toLowerCase().includes('visual') || content.toLowerCase().includes('dog') || content.toLowerCase().includes('spaniel')
  const mentionsHygiene = content.toLowerCase().includes('hygiene') || content.toLowerCase().includes('soap') || content.toLowerCase().includes('clean')
  console.log('🔍 OPENAI: Content analysis flags:', {
    mentionsImages,
    mentionsHygiene,
    hasSpecificContent: mentionsImages || mentionsHygiene
  })

  try {
    // Remove markdown code blocks if present (```json ... ```)
    let cleanContent = content.trim()
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }

    console.log('Attempting to parse cleaned content:', cleanContent.substring(0, 300) + '...')
    const parsed = JSON.parse(cleanContent)
    console.log('OpenAI parsed response keys:', Object.keys(parsed))
    return parsed
  } catch (parseError) {
    console.error('Failed to parse OpenAI response:', parseError)
    console.error('Content that failed to parse:', content.substring(0, 500))
    throw new Error(`OpenAI returned invalid JSON: ${parseError}`)
  }
}

async function generateInsightsWithAnthropic(apiKey: string, ideas: any[], projectName: string, projectType: string, roadmapContext: any = null, documentContext: any[] = [], _projectContext: any = null) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      seed: Math.floor(Math.random() * 1000000),
      messages: [
        {
          role: 'user',
          content: `You are an experienced strategic consultant analyzing this specific project. Think like a seasoned advisor who asks the right questions and provides insights based on what you actually see.

Analyze the actual ideas provided - what do they tell you about this project's real focus, challenges, and opportunities? Look for patterns, gaps, and strategic priorities that emerge from the specific context.

Avoid generic business templates. Instead, provide thoughtful analysis that someone familiar with this exact project would find valuable and actionable.

Write conversationally and insightfully, like you're advising a founder or product team who knows their domain well.

IMPORTANT: Respond ONLY with valid JSON. Do not include any explanatory text before or after the JSON.

I'm looking for strategic insights on this project: ${projectName} (${projectType})

IDEAS WE'RE CONSIDERING:
${ideas.map(idea => `• ${idea.title} - ${idea.description}`).join('\n')}

${roadmapContext ? `We already have some roadmap planning in place.` : ''}

${documentContext && documentContext.length > 0 ? `
ADDITIONAL CONTEXT:
${documentContext.map(doc => `• ${doc.name}: ${doc.content.substring(0, 200)}...`).join('\n')}
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
}`
        }
      ],
      temperature: getRandomTemperature(),
    }),
  })

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.content[0]?.text

  if (!content) {
    throw new Error('Anthropic returned empty response')
  }

  console.log('Anthropic raw response:', content.substring(0, 200) + '...')

  try {
    // Remove markdown code blocks if present (```json ... ```)
    let cleanContent = content.trim()
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }

    console.log('Attempting to parse cleaned Anthropic content:', cleanContent.substring(0, 300) + '...')
    const parsed = JSON.parse(cleanContent)
    console.log('Anthropic parsed response keys:', Object.keys(parsed))
    return parsed
  } catch (parseError) {
    console.error('Failed to parse Anthropic response:', parseError)
    console.error('Content that failed to parse:', content.substring(0, 500))
    throw new Error(`Anthropic returned invalid JSON: ${parseError}`)
  }
}

// Cached file analysis processor - uses pre-analyzed file results
async function processCachedFileAnalysis(documentContext: any[] = []) {
  console.log('📋 CACHED: Starting cached file analysis processing')
  console.log('📁 CACHED: Input files count:', documentContext?.length || 0)

  if (!documentContext || documentContext.length === 0) {
    console.log('⚠️ CACHED: No documents provided, returning empty result')
    return {
      hasVisualContent: false,
      hasAudioContent: false,
      textContent: '',
      audioTranscripts: '',
      imageDescriptions: '',
      imageUrls: []
    }
  }

  let textContent = ''
  let audioTranscripts = ''
  let imageDescriptions = ''
  let imageUrls: string[] = []
  let hasVisualContent = false
  let hasAudioContent = false

  for (const doc of documentContext) {
    try {
      console.log(`🔍 CACHED: Processing file ${doc.name}`)

      // Check if file has cached AI analysis
      if (doc.ai_analysis && doc.analysis_status === 'completed') {
        console.log('✅ CACHED: Using pre-analyzed results for', doc.name)
        const analysis = doc.ai_analysis

        // Add summary and insights to text content
        if (analysis.summary) {
          textContent += `File Analysis - ${doc.name}:\n${analysis.summary}\n\n`
        }

        if (analysis.key_insights && analysis.key_insights.length > 0) {
          textContent += `Key Insights from ${doc.name}:\n${analysis.key_insights.map((insight: string) => `- ${insight}`).join('\n')}\n\n`
        }

        // Add extracted content based on type
        if (analysis.content_type === 'image' && analysis.visual_description) {
          hasVisualContent = true
          imageDescriptions += `Image "${doc.name}": ${analysis.visual_description}\n\n`

          // If we have extracted text from the image, add it
          if (analysis.extracted_text) {
            textContent += `Text extracted from image ${doc.name}: ${analysis.extracted_text}\n\n`
          }
        }

        if ((analysis.content_type === 'audio' || analysis.content_type === 'video') && analysis.audio_transcript) {
          hasAudioContent = true
          audioTranscripts += `Audio from ${doc.name}: ${analysis.audio_transcript}\n\n`
        }

        if (analysis.content_type === 'text' && analysis.extracted_text) {
          textContent += `Content from ${doc.name}: ${analysis.extracted_text}\n\n`
        }

        console.log(`✅ CACHED: Processed analysis for ${doc.name} (${analysis.content_type})`)
      } else {
        // Fallback to existing content if no analysis available
        console.log('⚠️ CACHED: No analysis available for', doc.name, 'using fallback content')

        if (doc.content) {
          if (doc.type && doc.type.startsWith('image/')) {
            hasVisualContent = true
            imageDescriptions += `Image "${doc.name}": ${doc.content}\n\n`
          } else {
            textContent += `Content from ${doc.name}: ${doc.content}\n\n`
          }
        }
      }

    } catch (error) {
      console.warn('⚠️ CACHED: Error processing file', doc.name, ':', error)
      // Continue with other files
    }
  }

  const result = {
    hasVisualContent,
    hasAudioContent,
    textContent,
    audioTranscripts,
    imageDescriptions,
    imageUrls
  }

  console.log('📊 CACHED: Processing complete:', {
    hasVisualContent: result.hasVisualContent,
    hasAudioContent: result.hasAudioContent,
    textLength: result.textContent.length,
    audioLength: result.audioTranscripts.length,
    imageDescLength: result.imageDescriptions.length,
    imageUrls: result.imageUrls.length
  })

  return result
}

// ============================================================================
// GENERATE ROADMAP HANDLER
// ============================================================================

async function handleGenerateRoadmap(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('📥 Roadmap request:', req.body)

    const { projectName, projectType, ideas } = req.body

    if (!projectName || !ideas || !Array.isArray(ideas)) {
      console.error('❌ Missing required fields')
      return res.status(400).json({ error: 'Project name and ideas array are required' })
    }

    const openaiKey = process.env.OPENAI_API_KEY
    console.log('🔑 OpenAI key available:', !!openaiKey)

    if (!openaiKey) {
      return res.status(500).json({ error: 'No AI service configured' })
    }

    let roadmap = {}

    if (openaiKey) {
      roadmap = await generateRoadmapWithOpenAI(openaiKey, projectName, projectType, ideas)
    }

    return res.status(200).json({ roadmap })

  } catch (error) {
    console.error('❌ Roadmap error:', error)
    return res.status(500).json({ error: 'Failed to generate roadmap' })
  }
}

async function generateRoadmapWithOpenAI(apiKey: string, projectName: string, projectType: string, ideas: any[]) {

  // Define flexible approach context based on project type
  const getProjectTypeContext = (projectType: string) => {
    const type = projectType.toLowerCase()

    if (type.includes('operations') || type.includes('improvement') || type.includes('optimization') || type.includes('process')) {
      return {
        approach: 'strategic_themes',
        focusAreas: [
          'Current State Assessment: Understanding existing processes, identifying pain points, and establishing baseline metrics',
          'Strategic Planning: Defining improvement objectives, prioritizing initiatives, and creating implementation roadmap',
          'Implementation: Executing process changes, training teams, and managing organizational transition',
          'Measurement & Optimization: Tracking improvements, gathering feedback, and continuous refinement'
        ],
        coreThemes: [
          'Process assessment and mapping',
          'Stakeholder alignment and change management',
          'Implementation planning and execution',
          'Performance measurement and continuous improvement'
        ]
      }
    } else if (type.includes('software') || type.includes('app') || type.includes('platform') || type.includes('system')) {
      return {
        approach: 'technical_implementation',
        focusAreas: [
          'PLATFORM/INFRASTRUCTURE: Backend APIs, databases, authentication, security, DevOps, system architecture',
          'FRONTEND/WEB: Frontend applications, web interfaces, user dashboards, responsive design',
          'MOBILE: Mobile applications, native features, app store deployment (if applicable)',
          'QA/TESTING: Testing frameworks, quality assurance, performance testing, automated testing'
        ],
        coreThemes: [
          'Backend API architecture and development',
          'Database design and implementation',
          'Authentication and security systems',
          'DevOps and deployment pipeline'
        ]
      }
    } else if (type.includes('marketing') || type.includes('campaign') || type.includes('brand')) {
      return {
        approach: 'marketing_strategy',
        focusAreas: [
          'CREATIVE: Content creation, design assets, brand materials, visual identity',
          'DIGITAL MARKETING: Social media, online advertising, email campaigns, SEO/SEM',
          'ANALYTICS: Performance tracking, data analysis, reporting, ROI measurement',
          'OPERATIONS: Campaign management, vendor coordination, budget management'
        ],
        coreThemes: [
          'Creative asset development and brand guidelines',
          'Digital marketing strategy and channel setup',
          'Analytics and measurement framework',
          'Campaign operations and workflow management'
        ]
      }
    } else {
      // Generic strategic approach
      return {
        approach: 'strategic_themes',
        focusAreas: [
          'PLANNING: Strategic planning, resource allocation, timeline management, risk assessment',
          'EXECUTION: Implementation, deliverable creation, quality control, milestone tracking',
          'COORDINATION: Stakeholder management, communication, change management, team alignment',
          'EVALUATION: Performance measurement, outcome assessment, feedback collection, reporting'
        ],
        coreThemes: [
          'Strategic planning and framework establishment',
          'Implementation strategy and execution plan',
          'Stakeholder coordination and communication systems',
          'Evaluation and measurement framework'
        ]
      }
    }
  }

  const projectContext = getProjectTypeContext(projectType)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `${getRoadmapPersona(projectType)}

CRITICAL REQUIREMENTS - ADAPT YOUR APPROACH:
1. Project Approach: ${projectContext.approach}
2. Generate themes/epics aligned with these focus areas: ${projectContext.focusAreas.join(' | ')}
3. Core themes to incorporate (adapt to project context): ${projectContext.coreThemes.join(', ')}
4. Use terminology and language appropriate for ${projectType} projects
5. Balance strategic planning with practical implementation steps
6. For operations/improvement projects: Focus on assessments, process design, change management, and measurement rather than technical implementation
7. For technical projects: Include appropriate technical detail and development workflows

CLARIFYING QUESTIONS TO CONSIDER:
${getRoadmapClarifyingQuestions(projectType).map(q => `- ${q}`).join('\n')}

INDUSTRY-SPECIFIC SUCCESS PATTERNS:
${getRoadmapIndustryInsights(projectType)}

Return a JSON object with this EXACT structure matching the RoadmapData interface:
{
  "roadmapAnalysis": {
    "totalDuration": "12-16 weeks",
    "phases": [
      {
        "phase": "Foundation & Planning",
        "duration": "3-4 weeks",
        "description": "Detailed phase description explaining goals, approach, and expected outcomes",
        "epics": [
          {
            "title": "Epic Title (specific and actionable)",
            "description": "Comprehensive epic description with technical details and business value",
            "userStories": ["As a [user type], I want [functionality] so that [benefit]", "Another user story"],
            "deliverables": ["Specific deliverable 1", "Specific deliverable 2", "Technical artifact"],
            "priority": "high|medium|low",
            "complexity": "high|medium|low",
            "relatedIdeas": ["idea title 1", "idea title 2"]
          }
        ],
        "risks": ["Specific risk with mitigation strategy", "Another risk"],
        "successCriteria": ["Measurable success criteria 1", "Measurable success criteria 2"]
      }
    ]
  },
  "executionStrategy": {
    "methodology": "Agile Development with 2-week sprints",
    "sprintLength": "2 weeks",
    "teamRecommendations": "Detailed team structure recommendation including roles, skills, and responsibilities needed for successful execution",
    "keyMilestones": [
      {
        "milestone": "Phase 1 Completion",
        "timeline": "Week 4",
        "description": "Detailed milestone description with deliverables and acceptance criteria"
      }
    ]
  }
}`
        },
        {
          role: 'user',
          content: `Generate a comprehensive roadmap for this ${projectType} project. Adapt your approach based on the project type and context.

Project: ${projectName}
Type: ${projectType}
Ideas to incorporate: ${ideas.map(idea => `- ${idea.title}: ${idea.description}`).join('\n')}

PROJECT FOCUS AREAS (align epics with these themes):
${projectContext.focusAreas.map(area => `- ${area}`).join('\n')}

CORE THEMES to incorporate (adapt to project context):
${projectContext.coreThemes.map(theme => `- ${theme}`).join('\n')}

APPROACH GUIDANCE:
- For Operations/Improvement projects: Focus on strategic initiatives, process improvements, stakeholder engagement, and measurable outcomes rather than technical implementation details
- For Technical projects: Include appropriate technical depth and development workflows
- For Other projects: Balance strategic planning with practical execution steps

ROADMAP REQUIREMENTS:
1. Generate 3-5 logical phases appropriate for the project type (e.g., Assessment → Planning → Implementation → Optimization)
2. Each phase should have 2-4 themes/epics with different priorities (high/medium/low)
3. Each epic should have 3-5 outcomes or objectives (use "As a [stakeholder], I want [outcome] so that [benefit]" format when appropriate, but adapt language to project type)
4. Each epic should have 2-4 key deliverables appropriate for the project type (processes, assessments, systems, etc.)
5. Include 2-3 realistic risks per phase with specific mitigation strategies
6. Provide 2-3 measurable success criteria per phase (KPIs, metrics, benchmarks)
7. Create 4-6 key milestones with specific timelines and detailed descriptions
8. Team recommendations should specify roles appropriate for the project type
9. Include complexity ratings (high/medium/low) for each epic
10. Relate epics back to original ideas by title when relevant
11. Ensure totalDuration covers all phases realistically
12. Content should be professional and actionable for the specific project domain

Generate a roadmap that creates a comprehensive, domain-appropriate plan.`
        }
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content || '{}'

  try {
    // Strip markdown code blocks if present
    let cleanContent = content.trim()
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }

    return JSON.parse(cleanContent)
  } catch {
    return {}
  }
}

function getRoadmapPersona(projectType: string): string {
  const type = projectType.toLowerCase()

  if (type.includes('operations') || type.includes('improvement') || type.includes('optimization') || type.includes('process')) {
    return `You are a Senior Operations Strategy Consultant with 15+ years at leading consulting firms like McKinsey, Deloitte, and Accenture. You specialize in operational excellence, process improvement, and organizational transformation with proven success across multiple industries.

EXPERTISE AREAS: Process Optimization, Change Management, Stakeholder Alignment, Performance Measurement, Operational Strategy, Lean/Six Sigma, Digital Transformation, Organizational Design

APPROACH: Think strategically about operations improvement. Focus on current state assessment, stakeholder buy-in, sustainable change, and measurable business impact. Avoid overly technical solutions - emphasize people, process, and performance. Consider change management, training needs, and cultural factors.`
  }

  if (type.includes('software') || type.includes('app') || type.includes('platform') || type.includes('system')) {
    return `You are a Senior Software Engineering Manager with 12+ years at companies like Microsoft, Atlassian, and Spotify. You have deep expertise in technical roadmap planning, agile development, architecture decisions, and scaling engineering teams from MVP to enterprise-scale products.

EXPERTISE AREAS: Technical Architecture, Agile/Scrum Methodology, DevOps & Infrastructure, API Strategy, User Experience, Data Analytics, Security & Compliance, Team Management

APPROACH: Think like a Silicon Valley engineering leader. Focus on technical feasibility, scalability, user value, and sustainable development practices. Consider the full software development lifecycle, technical debt, and platform evolution.`
  }

  if (type.includes('marketing') || type.includes('campaign') || type.includes('brand')) {
    return `You are a VP of Marketing with 15+ years at high-growth companies like Shopify, Zoom, and Slack. You excel at campaign strategy, brand building, growth marketing, and performance optimization with proven track records of driving customer acquisition and revenue growth.

EXPERTISE AREAS: Campaign Strategy, Brand Management, Performance Marketing, Content Strategy, Customer Segmentation, Marketing Automation, Analytics & Attribution, Creative Development

APPROACH: Think like a data-driven marketing executive. Focus on audience insights, channel optimization, brand consistency, and measurable business outcomes. Consider the entire customer journey, lifecycle marketing, and long-term brand value.`
  }

  if (type.includes('business') || type.includes('strategy') || type.includes('consulting')) {
    return `You are a Partner at a top-tier strategy consulting firm with MBA and 15+ years at firms like McKinsey, BCG, and Bain. You excel at strategic planning, business transformation, market analysis, and implementation roadmaps with proven results for Fortune 500 clients.

EXPERTISE AREAS: Strategic Planning, Market Analysis, Business Model Design, Operations Optimization, Change Management, Financial Modeling, Stakeholder Alignment, Implementation Planning

APPROACH: Think like a senior strategy consultant. Focus on data-driven insights, strategic frameworks, stakeholder alignment, and measurable business outcomes. Consider both strategic vision and tactical execution.`
  }

  return `You are a Senior Program Manager with 10+ years leading complex, cross-functional initiatives across various industries. You excel at program planning, stakeholder management, resource optimization, and delivering results in dynamic environments.

EXPERTISE AREAS: Program Management, Strategic Planning, Stakeholder Management, Resource Optimization, Risk Management, Process Improvement, Change Management, Performance Measurement

APPROACH: Think like an experienced program leader. Focus on clear objectives, efficient execution, stakeholder satisfaction, and measurable outcomes. Consider both strategic goals and operational constraints.`
}

function getRoadmapClarifyingQuestions(projectType: string): string[] {
  const type = projectType.toLowerCase()

  if (type.includes('operations') || type.includes('improvement') || type.includes('optimization') || type.includes('process')) {
    return [
      "What are the specific operational pain points and inefficiencies?",
      "Who are the key stakeholders and what are their priorities?",
      "What current processes need to be assessed and potentially redesigned?",
      "How will we measure success and track improvements?",
      "What resistance to change should we anticipate and how will we address it?",
      "What resources and budget are available for implementation?",
      "What training and change management support will teams need?",
      "How will we ensure sustainability of improvements over time?"
    ]
  }

  if (type.includes('software') || type.includes('app') || type.includes('platform') || type.includes('system')) {
    return [
      "What's the target user base and their technical proficiency?",
      "What are the key technical constraints and infrastructure requirements?",
      "How will we handle scalability and performance as we grow?",
      "What integrations and API requirements are critical?",
      "What security, privacy, and compliance standards must we meet?",
      "How will we approach testing, deployment, and monitoring?",
      "What's our technical debt management strategy?",
      "How will we measure user engagement and product success?"
    ]
  }

  if (type.includes('marketing') || type.includes('campaign') || type.includes('brand')) {
    return [
      "Who is our target audience and what are their preferences?",
      "What's our unique value proposition and brand positioning?",
      "Which marketing channels will give us the best ROI?",
      "How will we measure campaign success and attribution?",
      "What's our budget and resource allocation strategy?",
      "How does this align with our overall brand strategy?",
      "What creative assets and content do we need to develop?",
      "How will we personalize messaging for different segments?"
    ]
  }

  if (type.includes('event') || type.includes('conference') || type.includes('meeting')) {
    return [
      "What are the primary goals and success metrics for this event?",
      "Who is our target attendee and what do they value most?",
      "What's our budget range and optimal resource allocation?",
      "What venue type and format will best serve our objectives?",
      "How will we attract and register the right audience?",
      "What content and speakers will provide maximum value?",
      "How will we facilitate networking and engagement?",
      "What technology do we need for seamless execution?"
    ]
  }

  if (type.includes('research') || type.includes('study') || type.includes('analysis')) {
    return [
      "What specific research questions are we trying to answer?",
      "What methodology will give us the most reliable results?",
      "Who are our target participants and how will we recruit them?",
      "What existing data sources and literature should we review?",
      "How will we ensure research quality and minimize bias?",
      "What timeline and resources do we need for proper execution?",
      "How will we analyze and present findings to stakeholders?",
      "What ethical considerations and approvals are required?"
    ]
  }

  if (type.includes('business') || type.includes('strategy') || type.includes('consulting')) {
    return [
      "What are the core strategic objectives and success metrics?",
      "What's the competitive landscape and market opportunity?",
      "What are the key stakeholders and their priorities?",
      "What resources and capabilities do we have available?",
      "What are the main risks and mitigation strategies?",
      "How will we measure progress and adapt our approach?",
      "What change management considerations are critical?",
      "What's the optimal implementation timeline and sequence?"
    ]
  }

  return [
    "What are the primary objectives and success criteria?",
    "Who are the key stakeholders and what do they need?",
    "What resources and constraints should we consider?",
    "What are the main risks and dependencies?",
    "How will we measure progress and success?",
    "What's the optimal timeline and milestone structure?",
    "What communication and coordination is required?",
    "How will we ensure quality and stakeholder satisfaction?"
  ]
}

function getRoadmapIndustryInsights(projectType: string): string {
  const type = projectType.toLowerCase()

  if (type.includes('operations') || type.includes('improvement') || type.includes('optimization') || type.includes('process')) {
    return `Operations improvement roadmaps succeed through stakeholder engagement, data-driven assessment, and sustainable change management. Focus on current state analysis, process redesign, pilot implementations, and phased rollouts. Prioritize quick wins, change management, training programs, and measurement systems. Avoid over-engineering solutions - emphasize practical improvements with clear business value.`
  }

  if (type.includes('software') || type.includes('app') || type.includes('platform') || type.includes('system')) {
    return `Software roadmaps succeed through user-centric development, technical excellence, and iterative delivery. Focus on MVP validation, scalable architecture, continuous deployment, and data-driven product decisions. Prioritize platform stability, security, and user experience while maintaining development velocity.`
  }

  if (type.includes('marketing') || type.includes('campaign') || type.includes('brand')) {
    return `Marketing roadmaps succeed through integrated campaign strategy, audience-first thinking, and performance optimization. Focus on brand consistency, multi-channel coordination, measurement frameworks, and agile campaign management. Prioritize customer journey optimization and sustainable growth.`
  }

  if (type.includes('event') || type.includes('conference') || type.includes('meeting')) {
    return `Event roadmaps succeed through experience design, operational excellence, and stakeholder alignment. Focus on attendee value, logistics coordination, technology integration, and measurable outcomes. Prioritize risk management, vendor relationships, and post-event optimization.`
  }

  if (type.includes('research') || type.includes('study') || type.includes('analysis')) {
    return `Research roadmaps succeed through methodological rigor, stakeholder engagement, and knowledge translation. Focus on research quality, data integrity, timeline management, and practical application. Prioritize ethical considerations, collaboration, and effective communication of findings.`
  }

  if (type.includes('business') || type.includes('strategy') || type.includes('consulting')) {
    return `Business roadmaps succeed through strategic clarity, stakeholder alignment, and disciplined execution. Focus on market insights, competitive positioning, operational excellence, and measurable value creation. Prioritize change management, capability building, and sustainable competitive advantages.`
  }

  return `Project roadmaps succeed through clear objectives, stakeholder alignment, efficient execution, and continuous adaptation. Focus on value delivery, risk management, resource optimization, and sustainable outcomes. Prioritize communication, quality, and stakeholder satisfaction.`
}

// ============================================================================
// ANALYZE FILE HANDLER
// ============================================================================

async function handleAnalyzeFile(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('🔍 File analysis request:', req.body)

    const { fileId, projectId } = req.body

    if (!fileId || !projectId) {
      console.error('❌ Missing required fields: fileId or projectId')
      return res.status(400).json({ error: 'File ID and Project ID are required' })
    }

    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY

    // Use service role key if available (bypasses RLS), otherwise use anon key
    const supabaseKey = supabaseServiceKey || supabaseAnonKey

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase configuration missing' })
    }

    console.log('🔑 Using Supabase key type:', supabaseServiceKey ? 'service_role (admin)' : 'anon (user)')

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })

    // Get the file record with retry logic (handle race conditions)
    let fileRecord = null
    let fileError = null

    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error } = await supabase
        .from('project_files')
        .select('*')
        .eq('id', fileId)
        .eq('project_id', projectId)
        .single()

      if (!error && data) {
        fileRecord = data
        break
      }

      fileError = error

      if (attempt < 3) {
        console.log(`⏳ File not found on attempt ${attempt}, retrying in ${attempt * 500}ms...`)
        await new Promise(resolve => setTimeout(resolve, attempt * 500))
      }
    }

    if (fileError || !fileRecord) {
      console.error('❌ File not found after 3 attempts:', fileError)
      return res.status(404).json({ error: 'File not found' })
    }

    console.log('📁 Analyzing file:', fileRecord.name, 'Type:', fileRecord.mime_type)

    // Check if already analyzed
    if (fileRecord.analysis_status === 'completed' && fileRecord.ai_analysis) {
      console.log('✅ File already analyzed, returning cached results')
      return res.status(200).json({
        analysis: fileRecord.ai_analysis,
        cached: true
      })
    }

    // Update status to analyzing
    await supabase
      .from('project_files')
      .update({ analysis_status: 'analyzing' })
      .eq('id', fileId)

    const openaiKey = process.env.OPENAI_API_KEY
    console.log('🔑 OpenAI key available:', !!openaiKey)

    if (!openaiKey) {
      await supabase
        .from('project_files')
        .update({ analysis_status: 'skipped' })
        .eq('id', fileId)
      return res.status(500).json({ error: 'No AI service configured' })
    }

    try {
      // Analyze the file based on its type
      const analysis = await analyzeFileContent(
        openaiKey,
        supabase,
        fileRecord,
        projectId
      )

      // Save analysis results
      console.log('💾 Updating database with analysis results for file:', fileId)
      const { data: updateData, error: updateError } = await supabase
        .from('project_files')
        .update({
          ai_analysis: analysis,
          analysis_status: 'completed'
        })
        .eq('id', fileId)
        .select()

      if (updateError) {
        console.error('❌ Failed to save analysis:', updateError)
        await supabase
          .from('project_files')
          .update({ analysis_status: 'failed' })
          .eq('id', fileId)
        return res.status(500).json({ error: 'Failed to save analysis results' })
      }

      console.log('✅ File analysis completed and saved. Updated record:', updateData)
      console.log('🔔 Database update should trigger real-time subscription now')
      return res.status(200).json({ analysis, cached: false })

    } catch (analysisError) {
      console.error('❌ Analysis failed:', analysisError)
      await supabase
        .from('project_files')
        .update({ analysis_status: 'failed' })
        .eq('id', fileId)
      return res.status(500).json({ error: 'Analysis failed' })
    }

  } catch (error) {
    console.error('❌ File analysis error:', error)

    // Update status to failed
    try {
      const { fileId } = req.body
      if (fileId) {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY

        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey)
          await supabase
            .from('project_files')
            .update({ analysis_status: 'failed' })
            .eq('id', fileId)
        }
      }
    } catch (updateError) {
      console.error('❌ Failed to update error status:', updateError)
    }

    return res.status(500).json({ error: 'Failed to analyze file' })
  }
}

async function analyzeFileContent(
  apiKey: string,
  supabase: any,
  fileRecord: any,
  _projectId: string
) {
  const mimeType = fileRecord.mime_type
  const fileName = fileRecord.name

  console.log('🎯 Analyzing file type:', mimeType, 'for file:', fileName)

  let analysis = {
    summary: '',
    key_insights: [] as string[],
    extracted_text: '',
    visual_description: '',
    audio_transcript: '',
    relevance_score: 0.5,
    content_type: 'text' as 'text' | 'image' | 'audio' | 'video' | 'mixed',
    analysis_model: 'gpt-4o',
    analysis_version: '1.0',
    analyzed_at: new Date().toISOString()
  }

  // Determine content type and analysis approach
  if (mimeType.startsWith('image/')) {
    analysis.content_type = 'image'
    analysis = await analyzeImageFile(apiKey, supabase, fileRecord, analysis)
  } else if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
    analysis.content_type = mimeType.startsWith('audio/') ? 'audio' : 'video'
    analysis = await analyzeAudioVideoFile(apiKey, supabase, fileRecord, analysis)
  } else if (mimeType === 'application/pdf' || mimeType.includes('text') || mimeType.includes('document')) {
    analysis.content_type = 'text'
    analysis = await analyzeTextFile(apiKey, fileRecord, analysis)
  } else {
    // Unknown file type - try to extract any available content
    analysis.summary = `File of type ${mimeType} uploaded but no specific analysis available.`
    analysis.key_insights = ['File format not directly analyzable', 'May contain valuable project information']
    analysis.relevance_score = 0.3
  }

  return analysis
}

async function analyzeImageFile(apiKey: string, supabase: any, fileRecord: any, analysis: any) {
  try {
    console.log('🖼️ Analyzing image:', fileRecord.name)

    // Get signed URL for the image
    const { data: urlData, error: urlError } = await supabase.storage
      .from('project-files')
      .createSignedUrl(fileRecord.storage_path, 3600)

    if (urlError || !urlData?.signedUrl) {
      console.error('❌ Failed to get signed URL for image:', urlError)
      analysis.summary = 'Image uploaded but could not be accessed for analysis'
      analysis.key_insights = ['Image file uploaded', 'Analysis unavailable due to storage access issue']
      analysis.relevance_score = 0.3
      return analysis
    }

    // Call GPT-4V for image analysis
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this image and provide:
1. A brief summary of what you see
2. Key insights or notable elements
3. A detailed visual description
4. Any text that appears in the image
5. Relevance to business/project context (score 0-1)

Return as JSON with fields: summary, key_insights (array), visual_description, extracted_text, relevance_score`
              },
              {
                type: 'image_url',
                image_url: {
                  url: urlData.signedUrl,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        temperature: 0.3,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      const content = data.choices[0]?.message?.content || '{}'

      try {
        const parsed = JSON.parse(content)
        analysis.summary = parsed.summary || 'Image analyzed'
        analysis.key_insights = parsed.key_insights || ['Visual content analyzed']
        analysis.visual_description = parsed.visual_description || 'Image content described'
        analysis.extracted_text = parsed.extracted_text || ''
        analysis.relevance_score = parsed.relevance_score || 0.5
      } catch (parseError) {
        console.log('📝 Using raw response for image analysis')
        analysis.summary = content.substring(0, 200)
        analysis.visual_description = content
        analysis.key_insights = ['Image content analyzed', 'Visual elements identified']
      }
    } else {
      console.error('❌ OpenAI API error for image:', response.status)
      analysis.summary = 'Image uploaded but analysis failed'
      analysis.key_insights = ['Image file uploaded', 'Analysis failed due to API error']
    }

  } catch (error) {
    console.error('❌ Image analysis error:', error)
    analysis.summary = 'Image uploaded but analysis encountered an error'
    analysis.key_insights = ['Image file uploaded', 'Analysis error occurred']
  }

  return analysis
}

async function analyzeAudioVideoFile(apiKey: string, supabase: any, fileRecord: any, analysis: any) {
  try {
    console.log('🎵 Analyzing audio/video:', fileRecord.name)

    // Get signed URL for the file
    const { data: urlData, error: urlError } = await supabase.storage
      .from('project-files')
      .createSignedUrl(fileRecord.storage_path, 3600)

    if (urlError || !urlData?.signedUrl) {
      console.error('❌ Failed to get signed URL for audio/video:', urlError)
      analysis.summary = 'Audio/video uploaded but could not be accessed for analysis'
      analysis.key_insights = ['Media file uploaded', 'Analysis unavailable due to storage access issue']
      return analysis
    }

    // Download file for Whisper API
    const audioResponse = await fetch(urlData.signedUrl)
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`)
    }

    const audioBuffer = await audioResponse.arrayBuffer()

    // Create FormData for Whisper API
    const formData = new FormData()
    const audioBlob = new Blob([audioBuffer], { type: fileRecord.mime_type })
    formData.append('file', audioBlob, fileRecord.name)
    formData.append('model', 'whisper-1')
    formData.append('response_format', 'verbose_json')

    // Call Whisper API
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    })

    if (whisperResponse.ok) {
      const transcriptionData = await whisperResponse.json()
      const transcript = transcriptionData.text || ''

      analysis.audio_transcript = transcript
      analysis.extracted_text = transcript

      if (transcript.length > 50) {
        // Analyze the transcript with GPT-4
        const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 500,
            messages: [
              {
                role: 'user',
                content: `Analyze this audio transcript and provide:
1. A brief summary of the content
2. Key insights or important points mentioned
3. Relevance to business/project context (score 0-1)

Transcript: "${transcript}"

Return as JSON with fields: summary, key_insights (array), relevance_score`
              }
            ],
            temperature: 0.3,
          }),
        })

        if (analysisResponse.ok) {
          const analysisData = await analysisResponse.json()
          const content = analysisData.choices[0]?.message?.content || '{}'

          try {
            const parsed = JSON.parse(content)
            analysis.summary = parsed.summary || 'Audio content transcribed and analyzed'
            analysis.key_insights = parsed.key_insights || ['Audio content transcribed']
            analysis.relevance_score = parsed.relevance_score || 0.5
          } catch (parseError) {
            analysis.summary = `Audio transcribed: ${transcript.substring(0, 100)}...`
            analysis.key_insights = ['Audio content transcribed', 'Spoken content captured']
          }
        } else {
          analysis.summary = `Audio transcribed: ${transcript.substring(0, 100)}...`
          analysis.key_insights = ['Audio content transcribed', 'Manual review recommended']
        }
      } else {
        analysis.summary = 'Audio file transcribed but content is very brief'
        analysis.key_insights = ['Short audio content', 'Limited transcription available']
      }
    } else {
      console.error('❌ Whisper API error:', whisperResponse.status)
      analysis.summary = 'Audio/video uploaded but transcription failed'
      analysis.key_insights = ['Media file uploaded', 'Transcription failed due to API error']
    }

  } catch (error) {
    console.error('❌ Audio/video analysis error:', error)
    analysis.summary = 'Audio/video uploaded but analysis encountered an error'
    analysis.key_insights = ['Media file uploaded', 'Analysis error occurred']
  }

  return analysis
}

async function analyzeTextFile(apiKey: string, fileRecord: any, analysis: any) {
  try {
    console.log('📄 Analyzing text file:', fileRecord.name)

    // Use existing content_preview if available
    let textContent = fileRecord.content_preview || ''

    if (textContent.length < 50) {
      analysis.summary = 'Text file uploaded but content is too brief for analysis'
      analysis.key_insights = ['Text file uploaded', 'Content too short for meaningful analysis']
      return analysis
    }

    // Analyze text content with GPT-4
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 800,
        messages: [
          {
            role: 'user',
            content: `Analyze this document content and provide:
1. A brief summary of the main topics and content
2. Key insights, findings, or important points
3. Relevance to business/project context (score 0-1)

Document content: "${textContent.substring(0, 3000)}"

Return as JSON with fields: summary, key_insights (array), relevance_score`
          }
        ],
        temperature: 0.3,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      const content = data.choices[0]?.message?.content || '{}'

      try {
        const parsed = JSON.parse(content)
        analysis.summary = parsed.summary || 'Document analyzed'
        analysis.key_insights = parsed.key_insights || ['Document content analyzed']
        analysis.relevance_score = parsed.relevance_score || 0.5
        analysis.extracted_text = textContent.substring(0, 1000) // Store excerpt
      } catch (parseError) {
        analysis.summary = content.substring(0, 200)
        analysis.key_insights = ['Document content analyzed', 'Text content extracted']
        analysis.extracted_text = textContent.substring(0, 1000)
      }
    } else {
      console.error('❌ OpenAI API error for text:', response.status)
      analysis.summary = 'Text document uploaded but analysis failed'
      analysis.key_insights = ['Text file uploaded', 'Analysis failed due to API error']
    }

  } catch (error) {
    console.error('❌ Text analysis error:', error)
    analysis.summary = 'Text document uploaded but analysis encountered an error'
    analysis.key_insights = ['Text file uploaded', 'Analysis error occurred']
  }

  return analysis
}

// ============================================================================
// ANALYZE IMAGE HANDLER
// ============================================================================

async function handleAnalyzeImage(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('🖼️ Image analysis request:', req.body)

    const { imageUrl, projectContext, analysisType = 'general' } = req.body

    if (!imageUrl) {
      console.error('❌ Missing required field: imageUrl')
      return res.status(400).json({ error: 'Image URL is required' })
    }

    const openaiKey = process.env.OPENAI_API_KEY
    console.log('🔑 OpenAI key available:', !!openaiKey)

    if (!openaiKey) {
      return res.status(500).json({ error: 'No AI service configured' })
    }

    const analysis = await analyzeImageWithGPT4V(
      openaiKey,
      imageUrl,
      projectContext,
      analysisType
    )

    return res.status(200).json({ analysis })

  } catch (error) {
    console.error('❌ Image analysis error:', error)
    return res.status(500).json({ error: 'Failed to analyze image' })
  }
}

async function analyzeImageWithGPT4V(
  apiKey: string,
  imageUrl: string,
  projectContext: any = {},
  analysisType: string = 'general'
) {
  console.log('🚀 Analyzing image with GPT-4V:', { imageUrl: imageUrl.substring(0, 100) + '...', analysisType })

  // Create analysis prompt based on type and project context
  const basePrompt = getImageAnalysisPrompt(analysisType, projectContext)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o', // GPT-4V model
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: basePrompt
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'high' // High detail for better analysis
              }
            }
          ]
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent analysis
    }),
  })

  if (!response.ok) {
    console.error('❌ OpenAI API error:', response.status, response.statusText)
    throw new Error(`OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  console.log('📄 GPT-4V response received')

  const content = data.choices[0]?.message?.content || 'Unable to analyze image'

  try {
    // Try to parse as JSON if it's structured analysis
    if (content.trim().startsWith('{')) {
      return JSON.parse(content)
    } else {
      // Return text analysis
      return {
        type: analysisType,
        description: content,
        extractedText: content,
        insights: extractImageInsights(content, projectContext),
        relevance: assessImageProjectRelevance(content, projectContext)
      }
    }
  } catch (parseError) {
    console.log('📝 Returning raw analysis (not JSON):', content.substring(0, 200))
    return {
      type: analysisType,
      description: content,
      extractedText: '',
      insights: [],
      relevance: 'medium'
    }
  }
}

function getImageAnalysisPrompt(analysisType: string, projectContext: any): string {
  const projectInfo = projectContext ? `

PROJECT CONTEXT:
- Project: ${projectContext.projectName || 'Unknown'}
- Type: ${projectContext.projectType || 'General'}
- Description: ${projectContext.description || 'No description available'}` : ''

  const baseInstructions = `You are an expert visual analyst. Analyze this image in detail and provide insights relevant to the project context.${projectInfo}

Focus on:`

  switch (analysisType) {
    case 'ui_design':
      return `${baseInstructions}
1. UI/UX elements - buttons, forms, navigation, layout
2. Design patterns and user experience considerations
3. Accessibility and usability observations
4. How this relates to the project's design goals
5. Any text or data visible in the interface

Provide specific, actionable insights about the design and user experience.`

    case 'data_visualization':
      return `${baseInstructions}
1. Charts, graphs, and data representations
2. Data insights and trends visible
3. Visualization effectiveness and clarity
4. How this data relates to the project goals
5. Any specific numbers, metrics, or KPIs shown

Extract all visible data points and provide analysis of what the data reveals.`

    case 'process_diagram':
      return `${baseInstructions}
1. Process flows, workflows, and system diagrams
2. Steps, decision points, and connections
3. Bottlenecks or optimization opportunities
4. How this process relates to the project
5. Any text labels or process descriptions

Identify the process being illustrated and suggest improvements or insights.`

    case 'document_screenshot':
      return `${baseInstructions}
1. Text content - extract all readable text
2. Document structure and organization
3. Key information and data points
4. How this document relates to the project
5. Any forms, tables, or structured data

Extract all text content and identify the document's purpose and relevance.`

    case 'general':
    default:
      return `${baseInstructions}
1. Overall content and subject matter
2. Text extraction - read any visible text
3. Visual elements that relate to the project
4. Data, metrics, or information visible
5. Potential insights or opportunities

Provide a comprehensive analysis of what you see and how it might be relevant to the project.`
  }
}

function extractImageInsights(analysisContent: string, _projectContext: any): string[] {
  const insights = []

  // Look for insight indicators in the analysis
  const insightKeywords = ['insight:', 'observation:', 'key finding:', 'important:', 'notable:']
  const lines = analysisContent.split('\n')

  lines.forEach(line => {
    insightKeywords.forEach(keyword => {
      if (line.toLowerCase().includes(keyword)) {
        insights.push(line.trim())
      }
    })
  })

  // If no specific insights found, extract bullet points
  if (insights.length === 0) {
    const bulletPoints = lines.filter(line =>
      line.trim().startsWith('•') ||
      line.trim().startsWith('-') ||
      line.trim().match(/^\d+\./)
    )
    insights.push(...bulletPoints.slice(0, 3)) // Top 3 bullet points
  }

  return insights.filter(insight => insight.length > 10) // Filter out very short insights
}

function assessImageProjectRelevance(analysisContent: string, projectContext: any): 'high' | 'medium' | 'low' {
  if (!projectContext?.projectName && !projectContext?.projectType) {
    return 'medium'
  }

  const content = analysisContent.toLowerCase()
  const projectName = (projectContext.projectName || '').toLowerCase()
  const projectType = (projectContext.projectType || '').toLowerCase()

  // High relevance indicators
  if (content.includes(projectName) ||
      content.includes(projectType) ||
      content.includes('directly related') ||
      content.includes('highly relevant')) {
    return 'high'
  }

  // Low relevance indicators
  if (content.includes('not related') ||
      content.includes('unrelated') ||
      content.includes('no connection')) {
    return 'low'
  }

  return 'medium'
}

// ============================================================================
// TRANSCRIBE AUDIO HANDLER
// ============================================================================

interface WhisperSegment {
  avg_logprob?: number;
  start: number;
  end: number;
}

async function handleTranscribeAudio(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('🎵 Audio transcription request:', req.body)

    const { audioUrl, projectContext, language = 'en' } = req.body

    if (!audioUrl) {
      console.error('❌ Missing required field: audioUrl')
      return res.status(400).json({ error: 'Audio URL is required' })
    }

    const openaiKey = process.env.OPENAI_API_KEY
    console.log('🔑 OpenAI key available:', !!openaiKey)

    if (!openaiKey) {
      return res.status(500).json({ error: 'No AI service configured' })
    }

    const transcription = await transcribeAudioWithWhisper(
      openaiKey,
      audioUrl,
      projectContext,
      language
    )

    return res.status(200).json({ transcription })

  } catch (error) {
    console.error('❌ Audio transcription error:', error)
    return res.status(500).json({ error: 'Failed to transcribe audio' })
  }
}

async function transcribeAudioWithWhisper(
  apiKey: string,
  audioUrl: string,
  projectContext: any = {},
  language: string = 'en'
) {
  console.log('🚀 Transcribing audio with Whisper API:', { audioUrl: audioUrl.substring(0, 100) + '...', language })

  try {
    // First, fetch the audio file
    console.log('📥 Downloading audio file...')
    const audioResponse = await fetch(audioUrl)

    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio file: ${audioResponse.status}`)
    }

    const audioBuffer = await audioResponse.arrayBuffer()
    console.log('📁 Audio file downloaded:', audioBuffer.byteLength, 'bytes')

    // Create FormData for Whisper API
    const formData = new FormData()

    // Convert ArrayBuffer to Blob
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })
    formData.append('file', audioBlob, 'audio.mp3')
    formData.append('model', 'whisper-1')
    formData.append('language', language)
    formData.append('response_format', 'verbose_json') // Get detailed response with timestamps

    // Add optional prompt for better context
    if (projectContext?.projectName || projectContext?.projectType) {
      const prompt = `This is audio from a ${projectContext.projectType || 'business'} project called "${projectContext.projectName || 'project'}".`
      formData.append('prompt', prompt)
    }

    // Call Whisper API
    console.log('🎯 Calling Whisper API...')
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('❌ Whisper API error:', response.status, errorData)
      throw new Error(`Whisper API error: ${response.status}`)
    }

    const data = await response.json()
    console.log('📄 Whisper transcription completed:', data.text?.length || 0, 'characters')

    // Process the transcription result
    const result = {
      text: data.text || '',
      language: data.language || language,
      duration: data.duration || 0,
      segments: data.segments || [],
      confidence: calculateAverageConfidence(data.segments || []),
      summary: await generateTranscriptionSummary(apiKey, data.text, projectContext),
      speakers: detectSpeakers(data.segments || []),
      keyPoints: extractKeyPoints(data.text, projectContext),
      projectRelevance: assessTranscriptionProjectRelevance(data.text, projectContext)
    }

    console.log('✅ Transcription analysis complete:', {
      textLength: result.text.length,
      confidence: result.confidence,
      speakers: result.speakers.length,
      keyPoints: result.keyPoints.length
    })

    return result

  } catch (error) {
    console.error('❌ Whisper transcription failed:', error)
    throw error
  }
}

function calculateAverageConfidence(segments: WhisperSegment[]): number {
  if (!segments || segments.length === 0) return 0

  const totalConfidence = segments.reduce((sum, segment) => {
    return sum + (segment.avg_logprob || 0)
  }, 0)

  // Convert log probability to confidence percentage (approximate)
  const avgLogProb = totalConfidence / segments.length
  return Math.max(0, Math.min(100, (avgLogProb + 1) * 100))
}

function detectSpeakers(segments: WhisperSegment[]): string[] {
  // Simple speaker detection based on pause patterns and voice characteristics
  // This is a placeholder - real speaker diarization would require additional processing

  const speakers = ['Speaker 1'] // Default single speaker

  // Look for long pauses that might indicate speaker changes
  let speakerCount = 1
  for (let i = 1; i < segments.length; i++) {
    const prevEnd = segments[i - 1].end
    const currentStart = segments[i].start
    const pause = currentStart - prevEnd

    // If pause > 2 seconds, might be a speaker change
    if (pause > 2.0 && speakerCount < 4) { // Max 4 speakers
      speakerCount++
      speakers.push(`Speaker ${speakerCount}`)
    }
  }

  return speakers
}

function extractKeyPoints(text: string, projectContext: any): string[] {
  if (!text || text.length < 50) return []

  const keyPoints: string[] = []
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20)

  // Look for important keywords related to project context
  const importantKeywords = [
    'important', 'key', 'critical', 'essential', 'priority', 'focus',
    'goal', 'objective', 'target', 'deadline', 'budget', 'cost',
    'decision', 'action', 'next steps', 'follow up', 'review',
    'problem', 'issue', 'challenge', 'solution', 'opportunity'
  ]

  // Add project-specific keywords if available
  if (projectContext?.projectName) {
    importantKeywords.push(projectContext.projectName.toLowerCase())
  }
  if (projectContext?.projectType) {
    importantKeywords.push(projectContext.projectType.toLowerCase())
  }

  sentences.forEach(sentence => {
    const lowerSentence = sentence.toLowerCase()
    const keywordMatches = importantKeywords.filter(keyword =>
      lowerSentence.includes(keyword)
    ).length

    // If sentence contains multiple keywords or is at beginning/end, consider it important
    if (keywordMatches >= 2 ||
        sentences.indexOf(sentence) < 3 ||
        sentences.indexOf(sentence) >= sentences.length - 3) {
      keyPoints.push(sentence.trim())
    }
  })

  return keyPoints.slice(0, 5) // Top 5 key points
}

async function generateTranscriptionSummary(
  apiKey: string,
  transcriptionText: string,
  projectContext: any
): Promise<string> {
  if (!transcriptionText || transcriptionText.length < 100) {
    return 'Audio content too short for meaningful summary.'
  }

  try {
    const projectInfo = projectContext ? `

This transcription is from a ${projectContext.projectType || 'business'} project called "${projectContext.projectName || 'project'}".` : ''

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Use faster model for summarization
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `Please provide a concise summary (2-3 sentences) of this audio transcription:${projectInfo}

TRANSCRIPTION:
${transcriptionText}

Focus on the main topics, decisions, and action items discussed.`
          }
        ],
        temperature: 0.3,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      return data.choices[0]?.message?.content || 'Unable to generate summary.'
    } else {
      console.warn('Failed to generate summary:', response.status)
      return 'Summary generation unavailable.'
    }
  } catch (error) {
    console.warn('Summary generation error:', error)
    return 'Summary generation failed.'
  }
}

function assessTranscriptionProjectRelevance(text: string, projectContext: any): 'high' | 'medium' | 'low' {
  if (!projectContext?.projectName && !projectContext?.projectType) {
    return 'medium'
  }

  const content = text.toLowerCase()
  const projectName = (projectContext.projectName || '').toLowerCase()
  const projectType = (projectContext.projectType || '').toLowerCase()

  let relevanceScore = 0

  // Check for direct mentions
  if (content.includes(projectName)) relevanceScore += 3
  if (content.includes(projectType)) relevanceScore += 2

  // Check for project-related keywords
  const projectKeywords = [
    'project', 'initiative', 'plan', 'strategy', 'goal', 'objective',
    'requirement', 'feature', 'development', 'implementation', 'launch'
  ]

  projectKeywords.forEach(keyword => {
    if (content.includes(keyword)) relevanceScore += 1
  })

  if (relevanceScore >= 5) return 'high'
  if (relevanceScore >= 2) return 'medium'
  return 'low'
}

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
      return handleGenerateIdeas(req, res)

    case 'generate-insights':
      return handleGenerateInsights(req, res)

    case 'generate-roadmap':
    case 'generate-roadmap-v2':
      return handleGenerateRoadmap(req, res)

    case 'analyze-file':
      return handleAnalyzeFile(req, res)

    case 'analyze-image':
      return handleAnalyzeImage(req, res)

    case 'transcribe-audio':
      return handleTranscribeAudio(req, res)

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
