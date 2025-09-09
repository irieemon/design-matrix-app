import { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticate, checkUserRateLimit } from '../auth/middleware'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  // Authenticate user (optional - can work without auth for basic functionality)
  const { user } = await authenticate(req)
  
  // Use authenticated user for rate limiting if available, otherwise fall back to IP
  const rateLimitKey = user?.id || (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown')
  const rateLimit = user ? 20 : 5 // Authenticated users get higher limits
  
  // Check rate limit
  if (!checkUserRateLimit(rateLimitKey, rateLimit)) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded. Please try again later.',
      suggestion: user ? 'Try again in a minute.' : 'Sign in for higher rate limits.'
    })
  }
  
  try {
    const { title, description, projectType } = req.body
    
    // Validate required fields
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' })
    }
    
    // Get API keys from environment (these are server-side only)
    const openaiKey = process.env.OPENAI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    
    if (!openaiKey && !anthropicKey) {
      return res.status(500).json({ error: 'No AI service configured' })
    }
    
    let ideas = []
    
    if (openaiKey) {
      // Use OpenAI
      ideas = await generateIdeasWithOpenAI(openaiKey, title, description, projectType)
    } else if (anthropicKey) {
      // Use Anthropic
      ideas = await generateIdeasWithAnthropic(anthropicKey, title, description, projectType)
    }
    
    return res.status(200).json({ ideas })
    
  } catch (error) {
    console.error('Error generating ideas:', error)
    return res.status(500).json({ error: 'Failed to generate ideas' })
  }
}

async function generateIdeasWithOpenAI(apiKey: string, title: string, description: string, projectType: string) {
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
          content: `You are a creative project manager helping generate ideas for priority matrix placement. Generate exactly 8 diverse, actionable ideas that vary in effort (easy to hard) and impact (low to high). Each idea should be realistic and specific to the project context.

Return a JSON array with this exact format:
[
  {
    "title": "Brief descriptive title",
    "description": "Detailed explanation of the idea and its implementation",
    "effort": "low|medium|high", 
    "impact": "low|medium|high",
    "category": "relevant category name"
  }
]`
        },
        {
          role: 'user',
          content: `Project: ${title}\nDescription: ${description}\nType: ${projectType}\n\nGenerate 8 actionable ideas with varying effort and impact levels.`
        }
      ],
      temperature: 0.8,
      max_tokens: 1500,
    }),
  })
  
  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }
  
  const data = await response.json()
  const content = data.choices[0]?.message?.content || '[]'
  
  try {
    return JSON.parse(content)
  } catch {
    // Fallback if JSON parsing fails
    return []
  }
}

async function generateIdeasWithAnthropic(apiKey: string, title: string, description: string, projectType: string) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `You are a creative project manager. Generate exactly 8 diverse, actionable ideas for this project that vary in effort and impact levels.

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