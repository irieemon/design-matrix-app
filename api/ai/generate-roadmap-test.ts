import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('Test roadmap function called')
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    console.log('Request body:', JSON.stringify(req.body, null, 2))
    
    const { projectName, projectType, ideas } = req.body
    
    if (!projectName || !ideas || !Array.isArray(ideas)) {
      return res.status(400).json({ error: 'Project name and ideas array are required' })
    }
    
    console.log(`Processing project: ${projectName}, type: ${projectType}`)
    
    // Return simple mock data without any AI calls
    const mockRoadmap = {
      roadmapAnalysis: {
        totalDuration: "12-16 weeks",
        phases: [
          {
            phase: "Foundation & Planning",
            duration: "3-4 weeks", 
            description: "Test phase for diagnostic purposes",
            epics: [
              {
                title: "Test Epic",
                description: "Diagnostic test epic",
                userStories: ["As a user, I want to test the system"],
                deliverables: ["Test deliverable"],
                priority: "high",
                complexity: "low",
                relatedIdeas: ideas.slice(0, 1).map(i => i.title)
              }
            ],
            risks: ["Test risk"],
            successCriteria: ["Test criteria"]
          }
        ]
      },
      executionStrategy: {
        methodology: "Test methodology",
        sprintLength: "2 weeks",
        teamRecommendations: "Test team structure",
        keyMilestones: [
          {
            milestone: "Test Milestone",
            timeline: "Week 4",
            description: "Test milestone description"
          }
        ]
      }
    }
    
    console.log('Returning mock roadmap successfully')
    return res.status(200).json({ roadmap: mockRoadmap })
    
  } catch (error) {
    console.error('Error in test function:', error)
    return res.status(500).json({ error: 'Test function failed', details: error instanceof Error ? error.message : 'Unknown error' })
  }
}