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
          content: `You are a strategic project manager creating a comprehensive roadmap for professional PDF documentation. Generate a detailed roadmap with 3-5 phases that logically progress from planning to execution to optimization.

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
          content: `Create a comprehensive strategic roadmap for professional PDF documentation:

Project: ${projectName}
Type: ${projectType}
Ideas to incorporate: ${ideas.map(idea => `- ${idea.title}: ${idea.description}`).join('\n')}

Requirements for comprehensive roadmap:
1. Generate 3-5 logical phases (Foundation, Development, Enhancement, Testing, Launch)
2. Each phase should have 2-4 epics with different priorities (high/medium/low)
3. Each epic should have 3-5 detailed user stories in "As a [user], I want [goal] so that [benefit]" format
4. Each epic should have 2-4 specific technical deliverables (APIs, databases, UI components, etc.)
5. Include 2-3 realistic risks per phase with specific mitigation strategies
6. Provide 2-3 measurable success criteria per phase (KPIs, metrics, benchmarks)
7. Create 4-6 key milestones with specific week timelines and detailed descriptions
8. Team recommendations should specify exact roles: Product Owner, Tech Lead, Frontend Dev, Backend Dev, QA, DevOps
9. Include complexity ratings (high/medium/low) for each epic
10. Relate epics back to original ideas by title
11. Ensure totalDuration covers all phases realistically
12. All content should be detailed enough for enterprise-level documentation

Generate a roadmap that will create a beautiful, comprehensive PDF report with professional depth.`
        }
      ],
      temperature: 0.7,
      max_tokens: 4000,
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
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `Create a comprehensive strategic roadmap for professional PDF documentation. Return ONLY a JSON object matching the RoadmapData interface structure.

Project: ${projectName}
Type: ${projectType}
Ideas to incorporate: ${ideas.map(idea => `- ${idea.title}: ${idea.description}`).join('\n')}

Required JSON structure (RoadmapData interface):
{
  "roadmapAnalysis": {
    "totalDuration": "12-16 weeks",
    "phases": [
      {
        "phase": "Foundation & Planning", 
        "duration": "3-4 weeks",
        "description": "Comprehensive phase description with goals and approach",
        "epics": [
          {
            "title": "Specific Epic Title",
            "description": "Detailed epic description with business value", 
            "userStories": ["As a [user], I want [goal] so that [benefit]"],
            "deliverables": ["Concrete deliverable 1", "Technical artifact 2"],
            "priority": "high|medium|low",
            "complexity": "high|medium|low",
            "relatedIdeas": ["related idea titles from input"]
          }
        ],
        "risks": ["Specific risk with mitigation"],
        "successCriteria": ["Measurable success criteria"]
      }
    ]
  },
  "executionStrategy": {
    "methodology": "Agile Development",
    "sprintLength": "2 weeks", 
    "teamRecommendations": "Detailed team structure and roles needed",
    "keyMilestones": [
      {
        "milestone": "Milestone Name",
        "timeline": "Week X",
        "description": "Milestone description with deliverables"
      }
    ]
  }
}

Generate 3-5 logical phases with comprehensive details for professional documentation.`
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