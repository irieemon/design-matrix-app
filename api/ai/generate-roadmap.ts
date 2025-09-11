import { VercelRequest, VercelResponse } from '@vercel/node'

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Simple rate limiting: 5 requests per minute per IP (roadmap generation is more expensive)
const RATE_LIMIT = 5
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
    const { projectName, projectType, ideas } = req.body
    
    if (!projectName || !ideas || !Array.isArray(ideas)) {
      return res.status(400).json({ error: 'Project name and ideas array are required' })
    }
    
    const openaiKey = process.env.OPENAI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    
    if (!openaiKey && !anthropicKey) {
      return res.status(500).json({ error: 'No AI service configured' })
    }
    
    let roadmap = {}
    
    if (openaiKey) {
      roadmap = await generateRoadmapWithOpenAI(openaiKey, projectName, projectType, ideas)
    } else if (anthropicKey) {
      roadmap = await generateRoadmapWithAnthropic(anthropicKey, projectName, projectType, ideas)
    }
    
    return res.status(200).json({ roadmap })
    
  } catch (error) {
    console.error('Error generating roadmap:', error)
    return res.status(500).json({ error: 'Failed to generate roadmap' })
  }
}

async function generateRoadmapWithOpenAI(apiKey: string, projectName: string, projectType: string, ideas: any[]) {
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
          content: `You are a strategic project manager creating a comprehensive roadmap. Generate a strategic roadmap with 3-4 phases that logically progress from planning to execution to optimization.

Return a JSON object with this exact structure:
{
  "id": "unique-id",
  "name": "Roadmap Name", 
  "description": "Brief description",
  "phases": [
    {
      "id": "phase-1",
      "name": "Phase Name",
      "description": "Phase description",
      "duration": "2-3 weeks",
      "objectives": ["objective 1", "objective 2"],
      "epics": [
        {
          "id": "epic-1",
          "title": "Epic Title",
          "description": "Epic description", 
          "priority": "High|Medium|Low",
          "stories": ["User story 1", "User story 2"],
          "deliverables": ["Deliverable 1", "Deliverable 2"],
          "relatedIdeas": ["idea title 1", "idea title 2"]
        }
      ],
      "risks": ["Risk 1", "Risk 2"],
      "successCriteria": ["Criteria 1", "Criteria 2"]
    }
  ],
  "timeline": "3-4 months",
  "keyMilestones": ["Milestone 1", "Milestone 2"]
}`
        },
        {
          role: 'user',
          content: `Create a strategic roadmap for:
Project: ${projectName}
Type: ${projectType}
Ideas to incorporate: ${ideas.map(idea => `- ${idea.title}: ${idea.description}`).join('\n')}

Generate a comprehensive roadmap with logical phases and actionable epics.`
        }
      ],
      temperature: 0.7,
      max_tokens: 2500,
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

async function generateRoadmapWithAnthropic(apiKey: string, projectName: string, projectType: string, ideas: any[]) {
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
          content: `Create a strategic roadmap for this project. Return ONLY a JSON object with the exact structure below:

Project: ${projectName}
Type: ${projectType}
Ideas: ${ideas.map(idea => `- ${idea.title}: ${idea.description}`).join('\n')}

Required JSON structure:
{
  "id": "unique-id",
  "name": "Roadmap Name",
  "description": "Brief description", 
  "phases": [
    {
      "id": "phase-1",
      "name": "Phase Name",
      "description": "Phase description",
      "duration": "2-3 weeks", 
      "objectives": ["objective 1", "objective 2"],
      "epics": [
        {
          "id": "epic-1",
          "title": "Epic Title",
          "description": "Epic description",
          "priority": "High|Medium|Low",
          "stories": ["User story 1", "User story 2"],
          "deliverables": ["Deliverable 1", "Deliverable 2"], 
          "relatedIdeas": ["idea title 1", "idea title 2"]
        }
      ],
      "risks": ["Risk 1", "Risk 2"],
      "successCriteria": ["Criteria 1", "Criteria 2"]
    }
  ],
  "timeline": "3-4 months",
  "keyMilestones": ["Milestone 1", "Milestone 2"]
}`
        }
      ],
      temperature: 0.7,
    }),
  })
  
  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`)
  }
  
  const data = await response.json()
  const content = data.content[0]?.text || '{}'
  
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