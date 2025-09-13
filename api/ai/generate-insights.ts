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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  const clientIP = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown'
  
  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' })
  }
  
  try {
    const { ideas, projectName, projectType } = req.body
    
    if (!ideas || !Array.isArray(ideas)) {
      return res.status(400).json({ error: 'Ideas array is required' })
    }
    
    const openaiKey = process.env.OPENAI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    
    if (!openaiKey && !anthropicKey) {
      return res.status(500).json({ error: 'No AI service configured' })
    }
    
    let insights = {}
    
    if (openaiKey) {
      insights = await generateInsightsWithOpenAI(openaiKey, ideas, projectName, projectType)
    } else if (anthropicKey) {
      insights = await generateInsightsWithAnthropic(anthropicKey, ideas, projectName, projectType)
    }
    
    return res.status(200).json({ insights })
    
  } catch (error) {
    console.error('Error generating insights:', error)
    return res.status(500).json({ error: 'Failed to generate insights' })
  }
}

async function generateInsightsWithOpenAI(apiKey: string, ideas: any[], projectName: string, projectType: string) {
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
          content: `You are a world-class strategic business advisor, combining the expertise of a top management consultant, venture capital partner, and board advisor. Analyze the given ideas from a market opportunity, competitive positioning, and investment perspective.

Provide insights that a Fortune 500 CEO or VC partner would find valuable - focus on market dynamics, revenue potential, competitive moats, customer acquisition strategies, and scalability.

Return a JSON object with this exact structure:
{
  "executiveSummary": "Strategic analysis with market size, competitive landscape, revenue potential, and key success factors. Include specific numbers and insights about market timing.",
  "keyInsights": [
    {
      "insight": "Strategic insight title",
      "impact": "Detailed explanation of business impact, market implications, and revenue potential"
    }
  ],
  "priorityRecommendations": {
    "immediate": ["Strategic action 1", "Strategic action 2"],
    "shortTerm": ["Medium-term strategic initiative 1", "Medium-term strategic initiative 2"],
    "longTerm": ["Long-term strategic vision 1", "Long-term strategic vision 2"]
  },
  "riskAssessment": {
    "highRisk": ["Market/business risk 1", "Market/business risk 2"],
    "opportunities": ["Strategic opportunity 1", "Strategic opportunity 2"]
  },
  "suggestedRoadmap": [
    {
      "phase": "Strategic Phase Name",
      "duration": "Time period",
      "focus": "Strategic focus and business objectives",
      "ideas": ["Related initiative 1", "Related initiative 2"]
    }
  ],
  "resourceAllocation": {
    "quickWins": "Strategic resource allocation for immediate ROI initiatives",
    "strategic": "Investment strategy for long-term competitive advantages"
  },
  "nextSteps": ["Board-level next step 1", "Board-level next step 2"]
}`
        },
        {
          role: 'user',
          content: `Perform a comprehensive strategic business analysis for this venture:

PROJECT: ${projectName}
INDUSTRY: ${projectType}

IDEA PORTFOLIO:
${ideas.map(idea => `- ${idea.title} (Priority: ${idea.quadrant}): ${idea.description}`).join('\n')}

ANALYSIS REQUIREMENTS:
1. Market Opportunity: Size, growth rate, timing, competitive landscape
2. Revenue Model: Monetization strategy, unit economics, scalability potential  
3. Competitive Positioning: Moats, differentiation, competitive response risks
4. Customer Strategy: Segmentation, acquisition channels, retention tactics
5. Investment Thesis: Funding needs, milestones, valuation drivers, exit strategy
6. Strategic Partnerships: Channel opportunities, platform integrations
7. Execution Risks: Market entry, team scaling, technology dependencies

Think like a board advisor providing strategic guidance for maximum market impact and investor returns.`
        }
      ],
      temperature: 0.6,
      max_tokens: 3500,
    }),
  })
  
  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }
  
  const data = await response.json()
  const content = data.choices[0]?.message?.content || '{}'
  
  try {
    return JSON.parse(content)
  } catch {
    return {}
  }
}

async function generateInsightsWithAnthropic(apiKey: string, ideas: any[], projectName: string, projectType: string) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 3500,
      messages: [
        {
          role: 'user',
          content: `You are a world-class strategic business advisor. Perform comprehensive strategic analysis for this venture from a market opportunity, competitive positioning, and investment perspective.

PROJECT: ${projectName} 
INDUSTRY: ${projectType}

IDEA PORTFOLIO:
${ideas.map(idea => `- ${idea.title} (Priority: ${idea.quadrant}): ${idea.description}`).join('\n')}

ANALYSIS REQUIREMENTS:
1. Market Opportunity: Size, growth rate, timing, competitive landscape
2. Revenue Model: Monetization strategy, unit economics, scalability potential  
3. Competitive Positioning: Moats, differentiation, competitive response risks
4. Customer Strategy: Segmentation, acquisition channels, retention tactics
5. Investment Thesis: Funding needs, milestones, valuation drivers, exit strategy
6. Strategic Partnerships: Channel opportunities, platform integrations
7. Execution Risks: Market entry, team scaling, technology dependencies

Return ONLY a JSON object with this exact structure:
{
  "executiveSummary": "Strategic analysis with market size, competitive landscape, revenue potential, and key success factors. Include specific numbers and insights about market timing.",
  "keyInsights": [
    {
      "insight": "Strategic insight title",
      "impact": "Detailed explanation of business impact, market implications, and revenue potential"
    }
  ],
  "priorityRecommendations": {
    "immediate": ["Strategic action 1", "Strategic action 2"],
    "shortTerm": ["Medium-term strategic initiative 1", "Medium-term strategic initiative 2"],
    "longTerm": ["Long-term strategic vision 1", "Long-term strategic vision 2"]
  },
  "riskAssessment": {
    "highRisk": ["Market/business risk 1", "Market/business risk 2"],
    "opportunities": ["Strategic opportunity 1", "Strategic opportunity 2"]
  },
  "suggestedRoadmap": [
    {
      "phase": "Strategic Phase Name",
      "duration": "Time period",
      "focus": "Strategic focus and business objectives",
      "ideas": ["Related initiative 1", "Related initiative 2"]
    }
  ],
  "resourceAllocation": {
    "quickWins": "Strategic resource allocation for immediate ROI initiatives",
    "strategic": "Investment strategy for long-term competitive advantages"
  },
  "nextSteps": ["Board-level next step 1", "Board-level next step 2"]
}`
        }
      ],
      temperature: 0.6,
    }),
  })
  
  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`)
  }
  
  const data = await response.json()
  const content = data.content[0]?.text || '{}'
  
  try {
    return JSON.parse(content)
  } catch {
    return {}
  }
}