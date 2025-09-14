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
          content: `You are an expert technical project manager with deep experience in full-stack software development. Your task is to create a comprehensive roadmap that MUST include all technical layers.

CRITICAL REQUIREMENTS - YOU MUST FOLLOW THESE:
1. Generate epics for ALL 4 team layers (do not skip any):
   - PLATFORM/INFRASTRUCTURE: Backend APIs, databases, authentication, security, DevOps, system architecture, data models, cloud infrastructure
   - WEB TEAM: Frontend applications, web interfaces, user dashboards, responsive design, web-based features
   - MOBILE TEAM: Mobile applications, native features, app store deployment (if project needs mobile)
   - MARKETING TEAM: User acquisition strategies, analytics implementation, growth campaigns, SEO, social media

2. PLATFORM LAYER IS MANDATORY: Every roadmap MUST contain at least 3-4 platform/infrastructure epics regardless of project type
3. REQUIRED PLATFORM EPICS (include variations of these):
   - Backend API architecture and development
   - Database design, modeling, and implementation  
   - Authentication, authorization, and security systems
   - DevOps, CI/CD, deployment pipeline, and infrastructure
   - System monitoring, logging, and performance optimization
4. Use technical keywords in epic titles that will trigger platform team assignment
5. Each epic must be technically specific and actionable

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
          content: `Generate a technical roadmap for this project. YOU MUST create epics for all 4 layers.

Project: ${projectName}
Type: ${projectType}
Ideas to incorporate: ${ideas.map(idea => `- ${idea.title}: ${idea.description}`).join('\n')}

MANDATORY EPIC DISTRIBUTION (create these specific types):
PLATFORM/INFRASTRUCTURE (must have 3-4 epics):
- "Core API Development" or "Backend Services Architecture"  
- "Database Design and Implementation"
- "Authentication and Security System"
- "DevOps and Deployment Pipeline"

WEB TEAM (must have 2-3 epics):
- "Frontend Application Development" 
- "User Interface and Dashboard"
- "Web-based Features Implementation"

MOBILE TEAM (if applicable, 1-2 epics):
- "Mobile Application Development"
- "Native Mobile Features"

MARKETING TEAM (must have 2-3 epics):
- "Analytics and Tracking Implementation"
- "User Acquisition Strategy"
- "SEO and Growth Optimization"

IMPORTANT: Use these exact epic title patterns and ensure each epic has technical deliverables.

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
          content: `Create a comprehensive strategic roadmap. Return ONLY a JSON object matching the RoadmapData interface structure.

IMPORTANT: Create epics that span ALL team layers including:
- Platform/Infrastructure team: Backend services, databases, security, DevOps, APIs, system architecture
- Web team: Frontend web applications, web interfaces, browser-based features
- Mobile team: Mobile apps, mobile-specific features (if applicable to project)
- Marketing team: User acquisition, analytics, campaigns, growth initiatives

Ensure at least 2-3 epics are specifically for platform/infrastructure work in EVERY project type.

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