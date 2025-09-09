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
          content: `You are a strategic analyst providing insights on idea prioritization. Analyze the given ideas and provide actionable insights.

Return a JSON object with this exact structure:
{
  "matrixAnalysis": {
    "quickWins": ["Quick win idea 1", "Quick win idea 2"],
    "majorProjects": ["Major project 1", "Major project 2"], 
    "fillIns": ["Fill in idea 1", "Fill in idea 2"],
    "thanklessItems": ["Item 1", "Item 2"]
  },
  "priorityRecommendations": [
    "Recommendation 1 with specific action",
    "Recommendation 2 with specific action", 
    "Recommendation 3 with specific action"
  ],
  "riskAssessments": [
    "Risk assessment 1",
    "Risk assessment 2",
    "Risk assessment 3"
  ],
  "resourceOptimization": [
    "Resource optimization 1",
    "Resource optimization 2"
  ],
  "nextSteps": [
    "Next step 1",
    "Next step 2", 
    "Next step 3"
  ]
}`
        },
        {
          role: 'user',
          content: `Analyze these ideas for strategic insights:
Project: ${projectName}
Type: ${projectType}

Ideas:
${ideas.map(idea => `- ${idea.title} (${idea.quadrant}): ${idea.description}`).join('\n')}

Provide comprehensive strategic analysis and actionable recommendations.`
        }
      ],
      temperature: 0.6,
      max_tokens: 2000,
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
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Analyze these ideas and provide strategic insights. Return ONLY a JSON object with this exact structure:

Project: ${projectName} 
Type: ${projectType}

Ideas:
${ideas.map(idea => `- ${idea.title} (${idea.quadrant}): ${idea.description}`).join('\n')}

Required JSON structure:
{
  "matrixAnalysis": {
    "quickWins": ["Quick win idea 1", "Quick win idea 2"],
    "majorProjects": ["Major project 1", "Major project 2"],
    "fillIns": ["Fill in idea 1", "Fill in idea 2"], 
    "thanklessItems": ["Item 1", "Item 2"]
  },
  "priorityRecommendations": [
    "Recommendation 1 with specific action",
    "Recommendation 2 with specific action",
    "Recommendation 3 with specific action"
  ],
  "riskAssessments": [
    "Risk assessment 1",
    "Risk assessment 2", 
    "Risk assessment 3"
  ],
  "resourceOptimization": [
    "Resource optimization 1",
    "Resource optimization 2"
  ],
  "nextSteps": [
    "Next step 1",
    "Next step 2",
    "Next step 3"
  ]
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