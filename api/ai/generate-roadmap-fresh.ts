import { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticate, checkUserRateLimit } from '../auth/middleware.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  // Authenticate user (optional)
  const { user } = await authenticate(req)
  
  // Rate limiting
  const rateLimitKey = user?.id || (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown')
  const rateLimit = user ? 10 : 3 // Lower limit for roadmap generation
  
  if (!checkUserRateLimit(rateLimitKey, rateLimit)) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded. Please try again later.',
      suggestion: user ? 'Try again in a minute.' : 'Sign in for higher rate limits.'
    })
  }
  
  try {
    console.log('📥 Roadmap request body:', req.body)
    
    const { projectName, projectType, ideas } = req.body
    
    // Validate required fields
    if (!projectName || !ideas || !Array.isArray(ideas)) {
      console.error('❌ Missing required fields')
      return res.status(400).json({ error: 'Project name and ideas array are required' })
    }
    
    // Get API keys
    const openaiKey = process.env.OPENAI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    
    console.log('🔑 API Key status:', { 
      hasOpenAI: !!openaiKey, 
      hasAnthropic: !!anthropicKey
    })
    
    if (!openaiKey && !anthropicKey) {
      return res.status(500).json({ error: 'No AI service configured' })
    }
    
    // For now, return mock data to test basic functionality
    const mockRoadmap = {
      roadmapAnalysis: {
        totalDuration: "12-16 weeks",
        phases: [
          {
            phase: "Foundation & Planning",
            duration: "3-4 weeks",
            description: "Initial project setup and planning phase",
            epics: [
              {
                title: "Project Kickoff",
                description: "Set up project infrastructure and team",
                userStories: ["As a team member, I want clear project goals"],
                deliverables: ["Project charter", "Team setup"],
                priority: "high",
                complexity: "medium",
                relatedIdeas: ideas.slice(0, 2).map(i => i.title || i.content || 'Idea')
              }
            ],
            risks: ["Resource constraints"],
            successCriteria: ["Team aligned on goals"]
          }
        ]
      },
      executionStrategy: {
        methodology: "Agile Development",
        sprintLength: "2 weeks",
        teamRecommendations: "Cross-functional team with clear roles",
        keyMilestones: [
          {
            milestone: "Foundation Complete",
            timeline: "Week 4",
            description: "Project foundation established"
          }
        ]
      }
    }
    
    console.log('✅ Returning mock roadmap')
    return res.status(200).json({ roadmap: mockRoadmap })
    
  } catch (error) {
    console.error('❌ Error in roadmap generation:', error)
    return res.status(500).json({ 
      error: 'Failed to generate roadmap',
      details: error.message 
    })
  }
}