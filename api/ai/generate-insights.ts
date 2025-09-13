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
    const { ideas, projectName, projectType, roadmapContext, documentContext } = req.body
    
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
      insights = await generateInsightsWithOpenAI(openaiKey, ideas, projectName, projectType, roadmapContext, documentContext)
    } else if (anthropicKey) {
      insights = await generateInsightsWithAnthropic(anthropicKey, ideas, projectName, projectType, roadmapContext, documentContext)
    }
    
    return res.status(200).json({ insights })
    
  } catch (error) {
    console.error('Error generating insights:', error)
    return res.status(500).json({ error: 'Failed to generate insights' })
  }
}

async function generateInsightsWithOpenAI(apiKey: string, ideas: any[], projectName: string, projectType: string, roadmapContext: any = null, documentContext: any[] = []) {
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
  "futureEnhancements": [
    {
      "title": "Enhancement Title",
      "description": "Detailed description of the enhancement opportunity that builds on existing ideas",
      "relatedIdea": "Name of related idea from the portfolio",
      "impact": "high|medium|low",
      "timeframe": "Time estimate for implementation"
    }
  ],
  "nextSteps": ["Board-level next step 1", "Board-level next step 2"]
}`
        },
        {
          role: 'user',
          content: `Perform a comprehensive strategic business analysis for this venture. This should be DEEPLY PERSONALIZED and UNIQUE to this specific project - no generic responses.

===== PROJECT CONTEXT =====
PROJECT: ${projectName}
INDUSTRY/TYPE: ${projectType}

IDEA PORTFOLIO:
${ideas.map(idea => `- ${idea.title} (Priority: ${idea.quadrant}): ${idea.description}`).join('\n')}

${roadmapContext ? `
===== EXISTING ROADMAP CONTEXT =====
The project already has a roadmap with the following structure:
${JSON.stringify(roadmapContext, null, 2)}

Use this roadmap information to provide insights that COMPLEMENT and ENHANCE the existing plan, identifying gaps, optimization opportunities, and strategic pivots.
` : ''}

${documentContext && documentContext.length > 0 ? `
===== PROJECT DOCUMENTS CONTEXT =====
The following documents have been uploaded to this project:
${documentContext.map(doc => `
Document: ${doc.name} (${doc.type})
Content Preview: ${doc.content.substring(0, 1000)}${doc.content.length > 1000 ? '...' : ''}
`).join('\n')}

Use these documents to understand the project's deeper context, requirements, constraints, and vision. Reference specific content from these documents in your analysis.
` : ''}

===== ANALYSIS REQUIREMENTS =====
Based on the PROJECT TYPE "${projectType}", tailor your analysis specifically for this domain:

${getProjectTypeSpecificRequirements(projectType)}

UNIVERSAL REQUIREMENTS:
1. Market Opportunity Analysis (sized specifically for this project's scope and type)
2. Execution Strategy (tailored to ${projectType} best practices)
3. Risk Assessment (specific to ${projectType} challenges and this project's unique aspects)
4. Resource Optimization (based on actual project roadmap and constraints)
5. Competitive Intelligence (relevant to this specific market/industry)
6. Success Metrics & KPIs (appropriate for ${projectType} projects)
7. Timeline & Milestone Optimization (considering existing roadmap if available)

CRITICAL INSTRUCTIONS:
- Reference specific ideas by name throughout your analysis
- If roadmap exists, suggest specific improvements, gaps, or optimizations
- If documents are provided, reference specific content and insights from them
- Make recommendations that are ACTIONABLE and SPECIFIC to this exact project
- Avoid generic business advice - everything should be tailored to this project
- Think like a ${projectType} expert who deeply understands this specific venture

Think like a board advisor providing strategic guidance for maximum impact and success in the ${projectType} domain.`
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

async function generateInsightsWithAnthropic(apiKey: string, ideas: any[], projectName: string, projectType: string, roadmapContext: any = null, documentContext: any[] = []) {
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
          content: `You are a world-class strategic business advisor. Perform comprehensive strategic analysis for this venture. This should be DEEPLY PERSONALIZED and UNIQUE to this specific project - no generic responses.

===== PROJECT CONTEXT =====
PROJECT: ${projectName}
INDUSTRY/TYPE: ${projectType}

IDEA PORTFOLIO:
${ideas.map(idea => `- ${idea.title} (Priority: ${idea.quadrant}): ${idea.description}`).join('\n')}

${roadmapContext ? `
===== EXISTING ROADMAP CONTEXT =====
The project already has a roadmap with the following structure:
${JSON.stringify(roadmapContext, null, 2)}

Use this roadmap information to provide insights that COMPLEMENT and ENHANCE the existing plan, identifying gaps, optimization opportunities, and strategic pivots.
` : ''}

${documentContext && documentContext.length > 0 ? `
===== PROJECT DOCUMENTS CONTEXT =====
The following documents have been uploaded to this project:
${documentContext.map(doc => `
Document: ${doc.name} (${doc.type})
Content Preview: ${doc.content.substring(0, 1000)}${doc.content.length > 1000 ? '...' : ''}
`).join('\n')}

Use these documents to understand the project's deeper context, requirements, constraints, and vision. Reference specific content from these documents in your analysis.
` : ''}

===== ANALYSIS REQUIREMENTS =====
Based on the PROJECT TYPE "${projectType}", tailor your analysis specifically for this domain:

${getProjectTypeSpecificRequirements(projectType)}

UNIVERSAL REQUIREMENTS:
1. Market Opportunity Analysis (sized specifically for this project's scope and type)
2. Execution Strategy (tailored to ${projectType} best practices)
3. Risk Assessment (specific to ${projectType} challenges and this project's unique aspects)
4. Resource Optimization (based on actual project roadmap and constraints)
5. Competitive Intelligence (relevant to this specific market/industry)
6. Success Metrics & KPIs (appropriate for ${projectType} projects)
7. Timeline & Milestone Optimization (considering existing roadmap if available)

CRITICAL INSTRUCTIONS:
- Reference specific ideas by name throughout your analysis - mention each idea by its exact title
- Provide specific insights for each individual idea, not just broad categories
- If roadmap exists, suggest specific improvements, gaps, or optimizations
- If documents are provided, reference specific content and insights from them
- Create futureEnhancements that build upon or extend existing ideas with new capabilities
- Make recommendations that are ACTIONABLE and SPECIFIC to this exact project
- Avoid generic business advice - everything should be tailored to this project
- Think like a ${projectType} expert who deeply understands this specific venture
- Each insight should feel personally crafted for this specific project and idea set

EXAMPLE: Instead of "User features show strong potential", write "Your 'Referral Program for Users' idea sits in the quick-wins quadrant and could generate 30-40% user growth within 60 days based on similar B2B referral programs."

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
  "futureEnhancements": [
    {
      "title": "Enhancement Title",
      "description": "Detailed description of the enhancement opportunity that builds on existing ideas",
      "relatedIdea": "Name of related idea from the portfolio",
      "impact": "high|medium|low",
      "timeframe": "Time estimate for implementation"
    }
  ],
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

function getProjectTypeSpecificRequirements(projectType: string): string {
  switch (projectType.toLowerCase()) {
    case 'software':
      return `SOFTWARE PROJECT SPECIFIC ANALYSIS:
- Technical Architecture & Scalability Assessment
- User Acquisition & Retention Strategies
- Development Timeline & Resource Planning
- Technology Stack & Security Considerations
- API Strategy & Third-party Integrations
- DevOps & Deployment Strategy
- User Experience & Interface Design Priorities
- Data Privacy & Compliance Requirements`

    case 'marketing':
      return `MARKETING PROJECT SPECIFIC ANALYSIS:
- Campaign Performance & Attribution Modeling
- Audience Segmentation & Targeting Strategy
- Content Strategy & Creative Asset Planning
- Channel Mix & Budget Allocation Optimization
- Brand Positioning & Messaging Framework
- Customer Journey & Conversion Optimization
- Social Media & Influencer Strategy
- Marketing Technology Stack & Automation`

    case 'business_plan':
      return `BUSINESS PLAN SPECIFIC ANALYSIS:
- Business Model Validation & Unit Economics
- Market Sizing & Competitive Landscape
- Financial Projections & Funding Strategy
- Go-to-Market Strategy & Customer Validation
- Operational Framework & Organizational Structure
- Revenue Streams & Pricing Strategy
- Risk Assessment & Mitigation Planning
- Exit Strategy & Investor Relations`

    case 'product_development':
      return `PRODUCT DEVELOPMENT SPECIFIC ANALYSIS:
- Product-Market Fit Validation
- Feature Prioritization & Development Roadmap
- User Research & Customer Feedback Integration
- Design & User Experience Optimization
- Manufacturing & Supply Chain Considerations
- Quality Assurance & Testing Strategy
- Launch Strategy & Market Entry
- Product Lifecycle & Iteration Planning`

    case 'operations':
      return `OPERATIONS SPECIFIC ANALYSIS:
- Process Optimization & Efficiency Gains
- Resource Allocation & Capacity Planning
- Supply Chain & Vendor Management
- Quality Control & Performance Metrics
- Cost Reduction & Operational Excellence
- Technology & Automation Opportunities
- Team Structure & Workflow Optimization
- Compliance & Risk Management`

    case 'research':
      return `RESEARCH PROJECT SPECIFIC ANALYSIS:
- Research Methodology & Data Collection Strategy
- Literature Review & Competitive Analysis
- Resource Requirements & Timeline Planning
- Data Analysis & Interpretation Framework
- Publication & Dissemination Strategy
- Collaboration & Partnership Opportunities
- Funding Sources & Grant Applications
- Intellectual Property & Commercialization`

    default:
      return `GENERAL PROJECT ANALYSIS:
- Strategic Objectives & Success Metrics
- Resource Requirements & Timeline Planning
- Stakeholder Analysis & Communication Strategy
- Risk Assessment & Mitigation Planning
- Market Analysis & Competitive Intelligence
- Implementation Strategy & Change Management
- Performance Measurement & Optimization
- Scalability & Growth Planning`
  }
}