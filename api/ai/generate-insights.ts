import { VercelRequest, VercelResponse } from '@vercel/node'

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('🚀 AI Insights API called at:', new Date().toISOString())
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }
    
    const clientIP = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown'
    
    if (!checkRateLimit(clientIP)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' })
    }
    
    console.log('📥 Request body keys:', Object.keys(req.body))
    const { ideas, projectName, projectType, roadmapContext, documentContext, projectContext } = req.body
    
    console.log('🔍 Parsed request:', {
      ideasCount: ideas?.length || 0,
      projectName,
      projectType,
      hasRoadmapContext: !!roadmapContext,
      documentCount: documentContext?.length || 0,
      hasProjectContext: !!projectContext
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
      console.log('Using OpenAI for insights generation')
      insights = await generateInsightsWithOpenAI(openaiKey, ideas, projectName, projectType, roadmapContext, documentContext, projectContext)
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

async function generateInsightsWithOpenAI(apiKey: string, ideas: any[], projectName: string, projectType: string, roadmapContext: any = null, documentContext: any[] = [], projectContext: any = null) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      seed: Math.floor(Math.random() * 1000000),
      messages: [
        {
          role: 'system',
          content: `You are an experienced strategic consultant analyzing this specific project. Think like a seasoned advisor who asks the right questions and provides insights based on what you actually see.

Analyze the actual ideas provided - what do they tell you about this project's real focus, challenges, and opportunities? Look for patterns, gaps, and strategic priorities that emerge from the specific context.

Avoid generic business templates. Instead, provide thoughtful analysis that someone familiar with this exact project would find valuable and actionable.

Write conversationally and insightfully, like you're advising a founder or product team who knows their domain well.

IMPORTANT: Respond ONLY with valid JSON. Do not include any explanatory text before or after the JSON.

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
    "highRisk": ["What concerns you"],
    "opportunities": ["What excites you about this"]
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
        },
        {
          role: 'user',
          content: `I'm looking for strategic insights on this project. Take a look at what we're working on and give me your honest assessment - what do you see? What patterns emerge? What should we be thinking about?

Here's what we're building:

PROJECT: ${projectName} (${projectType})

IDEAS WE'RE CONSIDERING:
${ideas.map(idea => `• ${idea.title} - ${idea.description}`).join('\n')}

${roadmapContext ? `We already have some roadmap planning in place.` : ''}

${documentContext && documentContext.length > 0 ? `
ADDITIONAL CONTEXT:
${documentContext.map(doc => `• ${doc.name}: ${doc.content.substring(0, 200)}...`).join('\n')}
` : ''}

What insights jump out at you? What should we be prioritizing or watching out for?`
        }
      ],
      temperature: getRandomTemperature(),
      max_tokens: 4000,
    }),
  })
  
  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }
  
  const data = await response.json()
  const content = data.choices[0]?.message?.content
  
  if (!content) {
    throw new Error('OpenAI returned empty response')
  }
  
  console.log('OpenAI raw response:', content.substring(0, 200) + '...')
  
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

async function generateInsightsWithAnthropic(apiKey: string, ideas: any[], projectName: string, projectType: string, roadmapContext: any = null, documentContext: any[] = [], projectContext: any = null) {
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
    "highRisk": ["What concerns you"],
    "opportunities": ["What excites you about this"]
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

// Dynamic prompt variation helpers to reduce repetitive AI responses
function getRandomTemperature(): number {
  const temperatures = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
  return temperatures[Math.floor(Math.random() * temperatures.length)]
}