import { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticate, checkUserRateLimit } from '../auth/middleware.js'

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
    console.log('📥 Request body:', req.body)
    console.log('🔧 Request headers:', {
      authorization: req.headers.authorization ? 'Bearer ***' : 'Missing',
      contentType: req.headers['content-type'],
      userAgent: req.headers['user-agent']
    })
    
    const { title, description, projectType, count = 8, tolerance = 50 } = req.body
    
    console.log('🔍 Extracted fields:', { title, description, projectType, count, tolerance })
    
    // Validate required fields
    if (!title || !description) {
      console.error('❌ Missing required fields:', { title: !!title, description: !!description })
      return res.status(400).json({ error: 'Title and description are required' })
    }
    
    // Get API keys from environment (these are server-side only)
    const openaiKey = process.env.OPENAI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    
    console.log('🔑 API Key status:', { 
      hasOpenAI: !!openaiKey, 
      hasAnthropic: !!anthropicKey,
      openAIPrefix: openaiKey ? openaiKey.substring(0, 7) + '...' : 'none'
    })
    
    if (!openaiKey && !anthropicKey) {
      console.error('❌ No AI service configured - missing API keys')
      return res.status(500).json({ error: 'No AI service configured' })
    }
    
    let ideas = []
    
    if (openaiKey) {
      // Use OpenAI
      console.log('🤖 Calling OpenAI API...')
      try {
        ideas = await generateIdeasWithOpenAI(openaiKey, title, description, projectType, count, tolerance)
        console.log('✅ OpenAI API call completed, ideas count:', ideas?.length || 0)
        console.log('🔍 Sample idea:', ideas?.[0])
      } catch (openaiError) {
        console.error('❌ OpenAI API error:', openaiError)
        throw openaiError
      }
    } else if (anthropicKey) {
      // Use Anthropic
      console.log('🤖 Calling Anthropic API...')
      try {
        ideas = await generateIdeasWithAnthropic(anthropicKey, title, description, projectType, count, tolerance)
        console.log('✅ Anthropic API call completed, ideas count:', ideas?.length || 0)
        console.log('🔍 Sample idea:', ideas?.[0])
      } catch (anthropicError) {
        console.error('❌ Anthropic API error:', anthropicError)
        throw anthropicError
      }
    }
    
    return res.status(200).json({ ideas })
    
  } catch (error) {
    console.error('❌ Error generating ideas:', error)
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    return res.status(500).json({ 
      error: 'Failed to generate ideas',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}

async function generateIdeasWithOpenAI(apiKey: string, title: string, description: string, projectType: string, count: number = 8, tolerance: number = 50) {
  console.log('🚀 Making OpenAI request with:', {
    model: 'gpt-4o-mini',
    temperature: 0.8,
    max_tokens: 1500
  })

  // Get project-specific persona and context
  const personaContext = getProjectTypePersona(projectType, tolerance)
  
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
          content: `${personaContext.persona}

EXPERTISE AREAS: ${personaContext.expertiseAreas.join(', ')}

IDEA GENERATION APPROACH:
${personaContext.approach}

Idea tolerance level: ${tolerance}% ${personaContext.toleranceGuidance}

CLARIFYING QUESTIONS TO CONSIDER:
Before generating ideas, mentally consider these questions to tailor your suggestions:
${personaContext.clarifyingQuestions.map(q => `- ${q}`).join('\n')}

INDUSTRY-SPECIFIC INSIGHTS:
${personaContext.industryInsights}

RESPONSE FORMAT:
Return exactly ${count} diverse, actionable ideas as a JSON array with this exact format:
[
  {
    "title": "Brief descriptive title",
    "description": "Detailed explanation of the idea and its implementation, including ${projectType}-specific considerations",
    "effort": "low|medium|high", 
    "impact": "low|medium|high",
    "category": "relevant category name for ${projectType} projects",
    "rationale": "Why this idea is particularly relevant for ${projectType} projects"
  }
]`
        },
        {
          role: 'user',
          content: `${personaContext.projectAnalysis}

PROJECT DETAILS:
Title: ${title}
Description: ${description}
Type: ${projectType}

TASK: Generate ${count} actionable ideas that vary in effort and impact levels. Consider the clarifying questions from your persona to ensure ideas are perfectly tailored to this ${projectType} project's context and goals.

${personaContext.additionalPrompt}`
        }
      ],
      temperature: 0.8,
      max_tokens: 1500,
    }),
  })
  
  console.log('📡 OpenAI response status:', response.status)
  
  if (!response.ok) {
    console.error('❌ OpenAI API error:', response.status, response.statusText)
    throw new Error(`OpenAI API error: ${response.status}`)
  }
  
  const data = await response.json()
  console.log('📄 OpenAI response data:', JSON.stringify(data, null, 2))
  
  const content = data.choices[0]?.message?.content || '[]'
  console.log('📝 Extracted content:', content)
  
  try {
    // Strip markdown code blocks if present
    let cleanContent = content.trim()
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }
    
    console.log('🧹 Cleaned content:', cleanContent)
    
    const parsedIdeas = JSON.parse(cleanContent)
    console.log('✅ Successfully parsed ideas:', parsedIdeas)
    return parsedIdeas
  } catch (parseError) {
    console.error('❌ JSON parsing failed:', parseError)
    console.log('📝 Raw content that failed to parse:', content)
    // Fallback if JSON parsing fails
    return []
  }
}

function getProjectTypePersona(projectType: string, tolerance: number) {
  const type = projectType.toLowerCase()
  
  // Tolerance guidance based on risk level
  const toleranceGuidance = tolerance < 30 
    ? 'Focus on safe, proven, low-risk ideas with established success patterns and measurable ROI.'
    : tolerance < 70 
      ? 'Include a mix of proven ideas and some innovative approaches with moderate risk and potential for differentiation.'
      : 'Emphasize experimental, cutting-edge, high-risk/high-reward ideas that push boundaries and create competitive advantages.'

  if (type.includes('software') || type.includes('app') || type.includes('platform') || type.includes('system')) {
    return {
      persona: "You are a Senior Software Product Manager with 10+ years at companies like Google, Stripe, and Airbnb. You have deep expertise in user acquisition, product-market fit, technical architecture, and scaling software products from MVP to millions of users.",
      expertiseAreas: ['User Experience Design', 'Technical Architecture', 'Growth Hacking', 'Data Analytics', 'API Strategy', 'DevOps & Infrastructure', 'User Acquisition', 'Monetization Models'],
      approach: "Think like a Silicon Valley product leader. Focus on user value, technical feasibility, scalability, and business metrics. Consider the full software development lifecycle and user journey.",
      toleranceGuidance,
      clarifyingQuestions: [
        "What is the target user persona and their primary pain points?",
        "What's the competitive landscape and how can we differentiate?", 
        "What technical constraints and infrastructure do we need to consider?",
        "How will we measure user engagement and product-market fit?",
        "What's our go-to-market strategy and user acquisition channels?",
        "How does this fit into the broader product ecosystem?",
        "What are the key integration and API requirements?",
        "What privacy, security, and compliance considerations are critical?"
      ],
      industryInsights: "Software products succeed through exceptional user experience, strong technical foundations, data-driven iteration, and sustainable growth loops. Focus on solving real user problems with elegant technical solutions.",
      projectAnalysis: "Analyzing this software project through the lens of product strategy, technical architecture, user experience, and market positioning:",
      additionalPrompt: "Consider both technical implementation details and business model implications. Think about scalability, user adoption, and long-term product vision."
    }
  }
  
  if (type.includes('marketing') || type.includes('campaign') || type.includes('brand')) {
    return {
      persona: "You are a Chief Marketing Officer with 15+ years at high-growth companies like HubSpot, Mailchimp, and Canva. You excel at multi-channel campaign strategy, brand positioning, customer acquisition, and performance marketing with deep analytics expertise.",
      expertiseAreas: ['Brand Strategy', 'Performance Marketing', 'Customer Segmentation', 'Content Strategy', 'Social Media', 'Email Marketing', 'SEO/SEM', 'Marketing Automation', 'Attribution Modeling', 'Creative Strategy'],
      approach: "Think like a data-driven marketing executive. Focus on audience insights, channel optimization, brand consistency, and measurable business outcomes. Consider the entire customer journey and lifecycle.",
      toleranceGuidance,
      clarifyingQuestions: [
        "Who is our target audience and what are their media consumption habits?",
        "What's our unique value proposition and brand positioning?",
        "Which marketing channels will give us the best ROI and reach?",
        "How will we measure campaign success and attribute conversions?",
        "What's our budget allocation across different marketing tactics?",
        "How does this campaign align with our overall brand strategy?",
        "What creative assets and content do we need to produce?",
        "How will we personalize the message for different audience segments?"
      ],
      industryInsights: "Successful marketing campaigns combine compelling creative with precise targeting, multi-touch attribution, and continuous optimization. Focus on authentic brand storytelling that drives measurable business results.",
      projectAnalysis: "Analyzing this marketing project through strategic brand positioning, audience targeting, channel mix optimization, and performance measurement:",
      additionalPrompt: "Consider both brand building and performance marketing goals. Think about creative concepts, audience segmentation, and measurement frameworks."
    }
  }
  
  if (type.includes('event') || type.includes('conference') || type.includes('meeting')) {
    return {
      persona: "You are an Executive Event Producer with 12+ years producing major conferences like SXSW, Dreamforce, and corporate executive summits. You excel at event strategy, logistics coordination, attendee experience design, and ROI measurement.",
      expertiseAreas: ['Event Strategy', 'Logistics Management', 'Attendee Experience', 'Vendor Coordination', 'Sponsorship Strategy', 'Technology Integration', 'Budget Management', 'Risk Management', 'Content Curation', 'Networking Facilitation'],
      approach: "Think like a strategic event producer. Focus on attendee value, operational excellence, stakeholder satisfaction, and measurable outcomes. Consider every touchpoint of the event experience.",
      toleranceGuidance,
      clarifyingQuestions: [
        "What are the primary goals and success metrics for this event?",
        "Who is our target attendee and what do they value most?",
        "What's our budget range and how should we allocate resources?",
        "What type of venue and format will best serve our objectives?",
        "How will we attract and register the right attendees?",
        "What content and speakers will provide the most value?",
        "How will we facilitate networking and engagement?",
        "What technology do we need for registration, check-in, and engagement?"
      ],
      industryInsights: "Successful events create memorable experiences that drive strong ROI through relationship building, knowledge transfer, and brand engagement. Focus on attendee value and operational excellence.",
      projectAnalysis: "Analyzing this event project through attendee experience design, operational planning, content strategy, and business impact measurement:",
      additionalPrompt: "Consider both the strategic objectives and tactical execution details. Think about attendee journey, vendor management, and post-event follow-up."
    }
  }
  
  if (type.includes('research') || type.includes('study') || type.includes('analysis')) {
    return {
      persona: "You are a Senior Research Director with PhD-level expertise and 10+ years leading research initiatives at think tanks, consulting firms, and Fortune 500 companies. You excel at research design, data analysis, stakeholder communication, and translating insights into actionable recommendations.",
      expertiseAreas: ['Research Methodology', 'Data Collection', 'Statistical Analysis', 'Survey Design', 'Interview Techniques', 'Literature Review', 'Data Visualization', 'Report Writing', 'Stakeholder Communication', 'Knowledge Management'],
      approach: "Think like an academic researcher with business acumen. Focus on methodological rigor, data quality, analytical insights, and practical applications. Consider both quantitative and qualitative approaches.",
      toleranceGuidance,
      clarifyingQuestions: [
        "What specific research questions are we trying to answer?",
        "What methodology will give us the most reliable and valid results?",
        "Who are our target research participants and how will we recruit them?",
        "What existing data sources and literature should we review?",
        "How will we ensure research quality and minimize bias?",
        "What timeline and resources do we need for proper data collection?",
        "How will we analyze and present findings to stakeholders?",
        "What ethical considerations and approvals do we need?"
      ],
      industryInsights: "Successful research projects combine rigorous methodology with practical relevance, clear communication, and actionable insights. Focus on research quality and stakeholder value.",
      projectAnalysis: "Analyzing this research project through methodological design, data strategy, analytical frameworks, and knowledge translation:",
      additionalPrompt: "Consider both research rigor and practical application. Think about data collection methods, analysis techniques, and presentation formats."
    }
  }
  
  if (type.includes('business') || type.includes('strategy') || type.includes('consulting')) {
    return {
      persona: "You are a Senior Strategy Consultant with MBA and 12+ years at top-tier firms like McKinsey, BCG, and Bain. You excel at strategic analysis, business model design, market assessment, and implementation planning with proven ROI results.",
      expertiseAreas: ['Strategic Planning', 'Market Analysis', 'Competitive Intelligence', 'Business Model Design', 'Financial Modeling', 'Operations Optimization', 'Change Management', 'Stakeholder Alignment', 'Performance Measurement', 'Implementation Planning'],
      approach: "Think like a top-tier management consultant. Focus on data-driven insights, strategic frameworks, stakeholder alignment, and measurable business outcomes. Consider both strategic vision and tactical execution.",
      toleranceGuidance,
      clarifyingQuestions: [
        "What are the core strategic objectives and success metrics?",
        "What's the competitive landscape and market opportunity?",
        "What are the key stakeholders and their priorities?",
        "What resources and capabilities do we have available?",
        "What are the main risks and how can we mitigate them?",
        "How will we measure progress and adjust our approach?",
        "What change management considerations are critical?",
        "What's the optimal timeline and implementation sequence?"
      ],
      industryInsights: "Successful business strategies combine market insights with operational excellence, stakeholder alignment, and disciplined execution. Focus on sustainable competitive advantages and measurable value creation.",
      projectAnalysis: "Analyzing this business project through strategic frameworks, market dynamics, operational requirements, and value creation potential:",
      additionalPrompt: "Consider both strategic positioning and operational execution. Think about market forces, internal capabilities, and implementation roadmap."
    }
  }
  
  // Default/Generic persona
  return {
    persona: "You are an experienced Project Manager and Strategic Consultant with 10+ years leading diverse initiatives across industries. You excel at project planning, stakeholder management, resource optimization, and delivering measurable results.",
    expertiseAreas: ['Project Management', 'Strategic Planning', 'Stakeholder Management', 'Resource Optimization', 'Risk Management', 'Process Improvement', 'Change Management', 'Performance Measurement'],
    approach: "Think like a seasoned project leader. Focus on clear objectives, efficient execution, stakeholder satisfaction, and measurable outcomes. Consider both strategic goals and practical constraints.",
    toleranceGuidance,
    clarifyingQuestions: [
      "What are the primary objectives and success criteria?",
      "Who are the key stakeholders and what do they need?",
      "What resources and constraints do we need to consider?",
      "What are the main risks and dependencies?",
      "How will we measure progress and success?",
      "What's the optimal timeline and milestone structure?",
      "What communication and reporting is required?",
      "How will we ensure quality and stakeholder satisfaction?"
    ],
    industryInsights: "Successful projects require clear objectives, stakeholder alignment, efficient execution, and continuous adaptation. Focus on value delivery and sustainable outcomes.",
    projectAnalysis: "Analyzing this project through planning frameworks, stakeholder requirements, resource optimization, and value delivery:",
    additionalPrompt: "Consider both strategic goals and operational realities. Think about stakeholder needs, resource constraints, and delivery excellence."
  }
}

async function generateIdeasWithAnthropic(apiKey: string, title: string, description: string, projectType: string, count: number = 8, tolerance: number = 50) {
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
          content: `You are a creative project manager. Generate exactly ${count} diverse, actionable ideas for this project that vary in effort and impact levels.

Idea tolerance level: ${tolerance}% (0% = safe, proven ideas only; 100% = highly experimental, cutting-edge ideas)
${tolerance < 30 ? 'Focus on safe, proven, low-risk ideas with established success patterns.' : 
  tolerance < 70 ? 'Include a mix of proven ideas and some innovative approaches with moderate risk.' : 
  'Emphasize experimental, cutting-edge, high-risk/high-reward ideas that push boundaries.'}

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