import { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticate, checkUserRateLimit } from '../auth/middleware'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  // Authenticate user (optional)
  const { user } = await authenticate(req)
  
  // Rate limiting for image analysis (more expensive operation)
  const rateLimitKey = user?.id || (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown')
  const rateLimit = user ? 10 : 3 // Lower limit for image analysis
  
  if (!checkUserRateLimit(rateLimitKey, rateLimit)) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded. Please try again later.',
      suggestion: user ? 'Try again in a minute.' : 'Sign in for higher rate limits.'
    })
  }
  
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
  const basePrompt = getAnalysisPrompt(analysisType, projectContext)
  
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
        extractedText: extractPotentialText(content),
        insights: extractInsights(content, projectContext),
        relevance: assessProjectRelevance(content, projectContext)
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

function getAnalysisPrompt(analysisType: string, projectContext: any): string {
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

function extractPotentialText(analysisContent: string): string {
  // Simple regex to find quoted text or text that appears to be extracted
  const textMatches = analysisContent.match(/"([^"]+)"/g) || []
  return textMatches.map(match => match.replace(/"/g, '')).join(' ')
}

function extractInsights(analysisContent: string, _projectContext: any): string[] {
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

function assessProjectRelevance(analysisContent: string, projectContext: any): 'high' | 'medium' | 'low' {
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