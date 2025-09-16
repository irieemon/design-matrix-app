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
  try {
    console.log('🚀 AI Insights API called at:', new Date().toISOString())
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }
    
    const clientIP = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown'
    
    if (!checkRateLimit(clientIP)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' })
    }
    console.log('📥 Request body keys:', Object.keys(req.body))
    const { ideas, projectName, projectType, roadmapContext, documentContext, projectContext } = req.body
    
    console.log('🔍 Parsed request:', {
      ideasCount: ideas?.length || 0,
      projectName,
      projectType,
      hasRoadmapContext: !!roadmapContext,
      documentCount: documentContext?.length || 0,
      hasProjectContext: !!projectContext
    })
    
    if (!ideas || !Array.isArray(ideas)) {
      console.error('❌ Ideas validation failed:', { ideas: typeof ideas, isArray: Array.isArray(ideas) })
      return res.status(400).json({ error: 'Ideas array is required' })
    }
    
    const openaiKey = process.env.OPENAI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    
    console.log('🔑 API Keys check:', { 
      hasOpenAI: !!openaiKey, 
      hasAnthropic: !!anthropicKey,
      openaiLength: openaiKey?.length || 0
    })
    
    if (!openaiKey && !anthropicKey) {
      return res.status(500).json({ error: 'No AI service configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.' })
    }
    
    let insights = {}
    
    if (openaiKey) {
      console.log('Using OpenAI for insights generation')
      insights = await generateInsightsWithOpenAI(openaiKey, ideas, projectName, projectType, roadmapContext, documentContext, projectContext)
    } else if (anthropicKey) {
      console.log('Using Anthropic for insights generation')
      insights = await generateInsightsWithAnthropic(anthropicKey, ideas, projectName, projectType, roadmapContext, documentContext, projectContext)
    }
    
    console.log('Generated insights:', Object.keys(insights))
    
    // Validate that we got proper insights structure
    if (!insights || typeof insights !== 'object' || Object.keys(insights).length === 0) {
      throw new Error('AI service returned empty or invalid response')
    }
    
    return res.status(200).json({ insights })
    
  } catch (error) {
    console.error('❌ FUNCTION ERROR:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      type: typeof error,
      timestamp: new Date().toISOString()
    })
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return res.status(500).json({ 
      error: `Failed to generate insights: ${errorMessage}`,
      timestamp: new Date().toISOString(),
      functionId: 'generate-insights'
    })
  }
}

async function generateInsightsWithOpenAI(apiKey: string, ideas: any[], projectName: string, projectType: string, roadmapContext: any = null, documentContext: any[] = [], projectContext: any = null) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      seed: Math.floor(Math.random() * 1000000),
      messages: [
        {
          role: 'system',
          content: `You are an experienced strategic consultant analyzing this specific project. Think like a seasoned advisor who asks the right questions and provides insights based on what you actually see.

Analyze the actual ideas provided - what do they tell you about this project's real focus, challenges, and opportunities? Look for patterns, gaps, and strategic priorities that emerge from the specific context.

Avoid generic business templates. Instead, provide thoughtful analysis that someone familiar with this exact project would find valuable and actionable.

Write conversationally and insightfully, like you're advising a founder or product team who knows their domain well.

IMPORTANT: Respond ONLY with valid JSON. Do not include any explanatory text before or after the JSON.

Provide your analysis as a JSON object with these sections:
{
  "executiveSummary": "Your strategic overview of what you see in this project",
  "keyInsights": [
    {
      "insight": "What stands out to you",
      "impact": "Why this matters for the project"
    }
  ],
  "priorityRecommendations": {
    "immediate": ["What should they do first"],
    "shortTerm": ["Next steps"],
    "longTerm": ["Bigger picture moves"]
  },
  "riskAssessment": {
    "highRisk": ["What concerns you"],
    "opportunities": ["What excites you about this"]
  },
  "suggestedRoadmap": [
    {
      "phase": "Logical next phase",
      "duration": "Realistic timeframe",
      "focus": "What this phase accomplishes",
      "ideas": ["Specific ideas from their list that fit here"]
    }
  ],
  "resourceAllocation": {
    "quickWins": "Where to focus energy first",
    "strategic": "Longer-term investments"
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
          content: `I'm looking for strategic insights on this project. Take a look at what we're working on and give me your honest assessment - what do you see? What patterns emerge? What should we be thinking about?

Here's what we're building:

PROJECT: ${projectName} (${projectType})

IDEAS WE'RE CONSIDERING:
${ideas.map(idea => `• ${idea.title} - ${idea.description}`).join('\n')}

${roadmapContext ? `We already have some roadmap planning in place.` : ''}

${documentContext && documentContext.length > 0 ? `
ADDITIONAL CONTEXT:
${documentContext.map(doc => `• ${doc.name}: ${doc.content.substring(0, 200)}...`).join('\n')}
` : ''}

What insights jump out at you? What should we be prioritizing or watching out for?

`
        }
      ],
      temperature: getRandomTemperature(),
      max_tokens: 4000,
    }),
  })
  
  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`)
  }
  
  const data = await response.json()
  const content = data.choices[0]?.message?.content
  
  if (!content) {
    throw new Error('OpenAI returned empty response')
  }
  
  console.log('OpenAI raw response:', content.substring(0, 200) + '...')
  
  try {
    // Remove markdown code blocks if present (```json ... ```)
    let cleanContent = content.trim()
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }
    
    console.log('Attempting to parse cleaned content:', cleanContent.substring(0, 300) + '...')
    const parsed = JSON.parse(cleanContent)
    console.log('OpenAI parsed response keys:', Object.keys(parsed))
    
    // Validate the response has the expected structure
    if (!parsed.executiveSummary || !parsed.keyInsights) {
      console.warn('OpenAI response missing expected fields, attempting to fix...')
      // Return a basic structure if parsing succeeded but fields are missing
      return {
        executiveSummary: parsed.executiveSummary || 'Strategic analysis pending review.',
        keyInsights: parsed.keyInsights || [{ insight: 'Analysis in progress', impact: 'Detailed insights will be provided.' }],
        priorityRecommendations: parsed.priorityRecommendations || { immediate: [], shortTerm: [], longTerm: [] },
        riskAssessment: parsed.riskAssessment || { highRisk: [], opportunities: [] },
        suggestedRoadmap: parsed.suggestedRoadmap || [],
        resourceAllocation: parsed.resourceAllocation || { quickWins: '', strategic: '' },
        futureEnhancements: parsed.futureEnhancements || [],
        nextSteps: parsed.nextSteps || []
      }
    }
    
    return parsed
  } catch (parseError) {
    console.error('Failed to parse OpenAI response:', parseError)
    console.error('Content that failed to parse:', content.substring(0, 500))
    throw new Error(`OpenAI returned invalid JSON: ${parseError}`)
  }
}

async function generateInsightsWithAnthropic(apiKey: string, ideas: any[], projectName: string, projectType: string, roadmapContext: any = null, documentContext: any[] = [], projectContext: any = null) {
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
          content: `I'm looking for strategic insights on this project. Take a look at what we're working on and give me your honest assessment - what do you see? What patterns emerge? What should we be thinking about?

Here's what we're building:

PROJECT: ${projectName} (${projectType})

IDEAS WE'RE CONSIDERING:
${ideas.map(idea => `• ${idea.title} - ${idea.description}`).join('\n')}

${roadmapContext ? `We already have some roadmap planning in place.` : ''}

${documentContext && documentContext.length > 0 ? `
ADDITIONAL CONTEXT:
${documentContext.map(doc => `• ${doc.name}: ${doc.content.substring(0, 200)}...`).join('\n')}
` : ''}

What insights jump out at you? What should we be prioritizing or watching out for?

Please provide your analysis as JSON with these sections:
{
  "executiveSummary": "Your strategic overview of what you see in this project",
  "keyInsights": [
    {
      "insight": "What stands out to you",
      "impact": "Why this matters for the project"
    }
  ],
  "priorityRecommendations": {
    "immediate": ["What should they do first"],
    "shortTerm": ["Next steps"],
    "longTerm": ["Bigger picture moves"]
  },
  "riskAssessment": {
    "highRisk": ["What concerns you"],
    "opportunities": ["What excites you about this"]
  },
  "suggestedRoadmap": [
    {
      "phase": "Logical next phase",
      "duration": "Realistic timeframe",
      "focus": "What this phase accomplishes",
      "ideas": ["Specific ideas from their list that fit here"]
    }
  ],
  "resourceAllocation": {
    "quickWins": "Where to focus energy first",
    "strategic": "Longer-term investments"
  },
  "futureEnhancements": [],
  "nextSteps": ["Practical next steps"]
}`
- Connect document insights to broader strategic implications and market opportunities
- Use document content to ground all recommendations in real research and best practices

STRATEGIC DEPTH REQUIREMENTS:
Each insight must demonstrate sophisticated thinking:

EXECUTIVE SUMMARY: Identify 2-3 non-obvious strategic opportunities that emerge from document analysis and market positioning. Include specific leverage points for competitive advantage and quantified growth potential.

KEY INSIGHTS: Provide breakthrough observations that combine document insights with advanced strategic frameworks. Focus on:
- Hidden patterns and inflection points others would miss
- Psychological and behavioral drivers of adoption
- Systemic advantages and defensive moats
- Non-linear scaling opportunities and network effects

PRIORITY RECOMMENDATIONS: Structure as venture capital-style value creation plan with:
- Specific hypotheses to test and experiments to run
- Behavioral interventions and growth hacking opportunities  
- Operational leverage points and margin expansion strategies
- Technology enablers and platform dynamics

RISK ASSESSMENT: Apply venture capital risk framework - identify the 2-3 risks that could kill the business and the specific de-risking strategies with timelines and success metrics.

Think like a senior partner who has seen patterns across hundreds of companies and can identify the subtle factors that separate category winners from also-rans.

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
      temperature: getRandomTemperature(),
    }),
  })
  
  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`)
  }
  
  const data = await response.json()
  const content = data.content[0]?.text
  
  if (!content) {
    throw new Error('Anthropic returned empty response')
  }
  
  console.log('Anthropic raw response:', content.substring(0, 200) + '...')
  
  try {
    // Remove markdown code blocks if present (```json ... ```)
    let cleanContent = content.trim()
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }
    
    const parsed = JSON.parse(cleanContent)
    console.log('Anthropic parsed response keys:', Object.keys(parsed))
    return parsed
  } catch (parseError) {
    console.error('Failed to parse Anthropic response:', parseError)
    console.error('Content that failed to parse:', content.substring(0, 500))
    throw new Error(`Anthropic returned invalid JSON: ${parseError}`)
  }
}

// Dynamic prompt variation helpers to reduce repetitive AI responses
function getRandomTemperature(): number {
  const temperatures = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
  return temperatures[Math.floor(Math.random() * temperatures.length)]
}

// Generate unique session ID to prevent AI caching/repetition
function generateUniqueSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function getRandomAnalysisStyle(): string {
  const styles = [
    'You are a team of expert business consultants providing executive-level strategic analysis.',
    'Acting as senior strategic advisors with deep industry expertise, you are conducting a comprehensive business analysis.',
    'As a specialized consulting team combining market intelligence and strategic planning expertise, you are analyzing this venture.',
    'You represent a boutique strategy firm known for data-driven insights and actionable recommendations.',
    'Operating as veteran business strategists with successful exits and scaling experience, you are evaluating this opportunity.'
  ]
  return styles[Math.floor(Math.random() * styles.length)]
}

function getRandomConsultantRole(): string {
  const roles = [
    'Lead Strategy Consultant and Market Analyst',
    'Senior Business Strategist and Product Expert',
    'Principal Consultant specializing in Growth Strategy',
    'Executive Advisory Partner with deep domain expertise',
    'Strategic Planning Director and Investment Analyst',
    'Business Development Strategist and Operations Expert'
  ]
  return roles[Math.floor(Math.random() * roles.length)]
}

function getRandomWritingTone(): string {
  const tones = [
    'Write in human, consultant language - not robotic AI speak. Use "we recommend" and "our analysis shows" rather than technical jargon.',
    'Communicate like experienced advisors presenting to executives. Use "our team believes" and "based on our assessment" with confident, actionable language.',
    'Write as seasoned consultants would speak in a board room. Use "we\'ve identified" and "our strategic review indicates" with precise, professional tone.',
    'Present insights like senior partners addressing the C-suite. Use "our analysis reveals" and "we strongly advise" with authoritative, consultative voice.',
    'Deliver recommendations as industry experts would to key stakeholders. Use "our assessment shows" and "we propose" with strategic, results-focused language.'
  ]
  return tones[Math.floor(Math.random() * tones.length)]
}

function getRandomAnalysisFramework(): string {
  const frameworks = [
    'Structure your analysis using proven strategic frameworks including market sizing, competitive positioning, and execution roadmaps.',
    'Apply systematic business analysis including opportunity assessment, risk evaluation, and strategic prioritization.',
    'Use comprehensive strategic methodology covering market dynamics, competitive landscape, and operational excellence.',
    'Employ strategic consulting frameworks including value proposition analysis, market entry strategy, and execution planning.',
    'Utilize proven analytical approaches including stakeholder analysis, market opportunity sizing, and strategic recommendations.'
  ]
  return frameworks[Math.floor(Math.random() * frameworks.length)]
}

function getRandomContextualOpener(projectType: string, ideaCount: number): string {
  const openers = [
    `Act as a senior consulting team presenting strategic analysis to the executive board.`,
    `You are presenting as expert advisors conducting a comprehensive ${projectType} project assessment.`,
    `Assume the role of veteran business strategists analyzing this ${projectType} initiative with ${ideaCount} strategic ideas.`,
    `Present as experienced consultants delivering executive insights on this ${projectType} venture.`,
    `Acting as specialized strategic advisors, you are conducting deep analysis of this ${projectType} opportunity.`
  ]
  return openers[Math.floor(Math.random() * openers.length)]
}

function getRandomPersonaInstruction(): string {
  const instructions = [
    'Write like humans, not AI - use "we", "our analysis", "we recommend". Be conversational but professional.',
    'Communicate as experienced consultants would - use "our team believes", "based on our assessment", "we advise". Professional yet personable.',
    'Present like senior advisors speaking to the board - use "our strategic review", "we\'ve identified", "our recommendation". Confident and authoritative.',
    'Write as industry experts would - use "our analysis shows", "we propose", "based on our evaluation". Strategic and action-oriented.',
    'Deliver insights like veteran consultants - use "our assessment indicates", "we strongly suggest", "our findings reveal". Consultative and decisive.'
  ]
  return instructions[Math.floor(Math.random() * instructions.length)]
}

function getRandomRoadmapAnalysisApproach(): string {
  const approaches = [
    'Use this roadmap information to provide insights that COMPLEMENT and ENHANCE the existing plan, identifying gaps, optimization opportunities, and strategic pivots.',
    'Analyze the existing roadmap to identify acceleration opportunities, resource optimization potential, and strategic enhancements.',
    'Review the current roadmap structure to suggest improvements, efficiency gains, and strategic alignments with market opportunities.',
    'Evaluate the existing roadmap for optimization potential, competitive advantages, and execution excellence opportunities.',
    'Assess the roadmap framework to recommend strategic enhancements, timeline optimizations, and market positioning improvements.'
  ]
  return approaches[Math.floor(Math.random() * approaches.length)]
}

function getRandomDocumentAnalysisApproach(): string {
  const approaches = [
    'Use these documents to understand the project\'s deeper context, requirements, constraints, and vision. Reference specific content from these documents in your analysis.',
    'Analyze the uploaded documentation to extract strategic insights, identify constraints, and inform your recommendations with specific document references.',
    'Review these project documents to understand operational context, strategic requirements, and implementation considerations. Cite specific content in your analysis.',
    'Examine the provided documentation to inform strategic planning, identify opportunities, and ground your recommendations in project-specific details.',
    'Study these documents to understand project scope, strategic objectives, and contextual factors. Incorporate specific insights from the documentation throughout your analysis.'
  ]
  return approaches[Math.floor(Math.random() * approaches.length)]
}

function getRandomAnalysisApproach(projectType: string): string {
  const approaches = [
    `Based on the PROJECT TYPE "${projectType}", tailor your analysis specifically for this domain:`,
    `Given this is a ${projectType} project, focus your strategic analysis on domain-specific opportunities and challenges:`,
    `Considering the ${projectType} nature of this venture, structure your assessment around industry-specific factors:`,
    `For this ${projectType} initiative, frame your analysis within the context of sector-specific dynamics:`,
    `As a ${projectType} project, orient your strategic evaluation toward industry-relevant considerations:`
  ]
  return approaches[Math.floor(Math.random() * approaches.length)]
}

function getRandomUniversalRequirements(projectType: string): string {
  const requirements = [
    `UNIVERSAL REQUIREMENTS:
1. Market Opportunity Analysis (sized specifically for this project's scope and type)
2. Execution Strategy (tailored to ${projectType} best practices)
3. Risk Assessment (specific to ${projectType} challenges and this project's unique aspects)
4. Resource Optimization (based on actual project roadmap and constraints)
5. Competitive Intelligence (relevant to this specific market/industry)
6. Success Metrics & KPIs (appropriate for ${projectType} projects)
7. Timeline & Milestone Optimization (considering existing roadmap if available)`,
    
    `CORE ANALYSIS AREAS:
1. Strategic Market Positioning (relevant to ${projectType} sector dynamics)
2. Execution Excellence Framework (aligned with ${projectType} best practices)
3. Comprehensive Risk & Opportunity Assessment (tailored to this project's specifics)
4. Resource Allocation Strategy (optimized for project constraints and roadmap)
5. Competitive Advantage Development (positioned within industry landscape)
6. Performance Measurement System (appropriate metrics for ${projectType} success)
7. Strategic Timeline Optimization (considering implementation complexities)`,

    `STRATEGIC EVALUATION FRAMEWORK:
1. Market Dynamics & Opportunity Sizing (calibrated for ${projectType} sector)
2. Strategic Execution Planning (informed by ${projectType} industry standards)
3. Risk Mitigation & Opportunity Capture (specific to project and market context)
4. Operational Excellence & Resource Strategy (aligned with roadmap and constraints)
5. Competitive Intelligence & Positioning (relevant to target market dynamics)
6. Success Framework & Measurement (tailored to ${projectType} project outcomes)
7. Implementation Strategy & Milestone Planning (optimized for execution success)`
  ]
  return requirements[Math.floor(Math.random() * requirements.length)]
}

function getRandomCriticalInstructions(projectType: string, ideas: any[]): string {
  const instructions = [
    `CRITICAL INSTRUCTIONS:
- Reference specific ideas by name throughout your analysis - mention each idea by its exact title
- Provide specific insights for each individual idea, not just broad categories
- If roadmap exists, suggest specific improvements, gaps, or optimizations
- If documents are provided, reference specific content and insights from them
- Create futureEnhancements that build upon or extend existing ideas with new capabilities
- Make recommendations that are ACTIONABLE and SPECIFIC to this exact project
- Avoid generic business advice - everything should be tailored to this project
- Think like a ${projectType} expert who deeply understands this specific venture
- Each insight should feel personally crafted for this specific project and idea set`,

    `ANALYSIS GUIDELINES:
- Call out individual ideas by their specific titles and provide targeted insights for each
- Build upon existing roadmap elements with concrete optimization suggestions
- Extract and reference specific insights from uploaded project documents
- Design futureEnhancements that logically extend current ideas with new value propositions
- Deliver recommendations that are immediately actionable for this specific ${projectType} project
- Avoid templated business advice - focus on project-specific strategic guidance
- Apply deep ${projectType} domain expertise to every recommendation
- Ensure each strategic insight feels custom-crafted for this unique venture`,

    `STRATEGIC FOCUS AREAS:
- Analyze each idea individually by name, providing specific strategic insights and recommendations
- Enhance existing roadmap with targeted improvements and optimization opportunities
- Leverage uploaded documents to inform analysis with project-specific context and constraints
- Develop futureEnhancements that build meaningfully on current ideas with expanded capabilities
- Create actionable recommendations tailored specifically to this ${projectType} venture
- Apply industry-specific expertise rather than generic business consulting approaches
- Craft insights that demonstrate deep understanding of this particular project's unique characteristics
- Ensure strategic guidance feels personally relevant to this specific initiative and idea portfolio`
  ]
  return instructions[Math.floor(Math.random() * instructions.length)]
}

function getRandomFinalInspiration(projectType: string): string {
  const inspirations = [
    `Think like a board advisor providing strategic guidance for maximum impact and success in the ${projectType} domain.`,
    `Channel the perspective of a seasoned ${projectType} expert who has successfully scaled similar ventures to market leadership.`,
    `Apply the mindset of a proven strategic advisor with deep ${projectType} experience and a track record of successful exits.`,
    `Adopt the viewpoint of an industry veteran who understands both the challenges and opportunities unique to ${projectType} projects.`,
    `Embody the expertise of a specialized consultant with demonstrated success in ${projectType} strategic planning and execution.`
  ]
  return inspirations[Math.floor(Math.random() * inspirations.length)]
}

// Additional helper to add dynamic insight generation approaches
function getRandomInsightGenerationStyle(): string {
  const styles = [
    'INSIGHT GENERATION APPROACH: Focus on contrarian insights that challenge conventional wisdom while remaining grounded in data.',
    'STRATEGIC LENS: Prioritize insights that reveal hidden market dynamics and non-obvious competitive advantages.',
    'ANALYSIS METHODOLOGY: Emphasize insights that connect cross-functional opportunities and reveal systemic optimization potential.',
    'CONSULTING APPROACH: Generate insights that demonstrate deep pattern recognition from successful ventures in adjacent markets.',
    'STRATEGIC FRAMEWORK: Focus on insights that identify inflection points and timing advantages in market dynamics.'
  ]
  return styles[Math.floor(Math.random() * styles.length)]
}

// Dynamic variations based on document content
function getDocumentContextualPrompt(documentContext: any[]): string {
  if (!documentContext || documentContext.length === 0) {
    return 'DOCUMENT ANALYSIS: No uploaded documents to reference in this analysis.'
  }

  const fileTypes = documentContext.map(doc => doc.type).join(', ')
  const totalContentLength = documentContext.reduce((sum, doc) => sum + (doc.content?.length || 0), 0)
  
  const variations = [
    `DOCUMENT INTELLIGENCE: Leveraging ${documentContext.length} uploaded documents (${fileTypes}) with ${totalContentLength} characters of content. Extract specific insights, quotes, and data points from these documents to ground your strategic recommendations.`,
    
    `CONTENT-DRIVEN ANALYSIS: The ${documentContext.length} project documents (${fileTypes}) provide rich context for strategic planning. Reference specific sections, methodologies, and findings from these documents throughout your analysis.`,
    
    `DOCUMENTATION-INFORMED STRATEGY: Utilizing comprehensive project documentation (${fileTypes}) to inform strategic insights. Cite specific content and draw connections between document insights and market opportunities.`,
    
    `EVIDENCE-BASED RECOMMENDATIONS: Drawing from ${documentContext.length} source documents with ${Math.round(totalContentLength/1000)}k characters of content. Build recommendations on specific data, processes, and insights found in the uploaded materials.`,
    
    `DOCUMENT-ANCHORED INSIGHTS: The uploaded ${fileTypes} files provide critical project context. Reference specific content, methodologies, and findings to create highly relevant strategic recommendations.`
  ]
  
  return variations[Math.floor(Math.random() * variations.length)]
}

// GPT-4o optimized strategic insight prompts
function getConsultancyGradePrompt(): string {
  const sessionId = generateUniqueSessionId()
  const prompts = [
    `STRATEGIC INSIGHT MASTERY (Session ${sessionId}): You are the senior partner at McKinsey leading a transformational strategy engagement. Go beyond obvious observations to identify hidden inflection points, non-linear growth opportunities, and systemic advantages that others miss. Apply second-order thinking: what do the obvious patterns reveal about deeper market dynamics? What would a contrarian investor see that consensus misses? Provide breakthrough insights that challenge conventional wisdom while being grounded in rigorous analysis.`,
    
    `VENTURE CAPITAL DUE DILIGENCE (Session ${sessionId}): Analyze this as Sequoia Capital evaluating a Series B investment. Think like someone who has seen hundreds of companies succeed and fail. Identify the specific psychological triggers that drive user behavior, the defensive moats that create lasting competitive advantage, and the operational leverage points that enable exponential scaling. What makes this a potential category-defining company versus just another incremental improvement?`,
    
    `BCG GAMMA BEHAVIORAL ECONOMICS (Session ${sessionId}): Apply advanced behavioral economics and systems thinking. Identify cognitive biases affecting market adoption, network effects and viral coefficients, psychological switching costs, and habit formation mechanics. What behavioral interventions could dramatically improve unit economics? How do psychological principles create unfair competitive advantages? Think like a behavioral scientist meets strategy consultant.`,
    
    `BAIN PRIVATE EQUITY TRANSFORMATION (Session ${sessionId}): Analyze with the lens of a PE firm seeking 3-5x returns through operational transformation. Identify specific value creation levers, operational inefficiencies to exploit, market positioning gaps to capture, and strategic capabilities to build. What operational changes would drive disproportionate margin expansion? How can technology create step-function improvements in productivity?`,
    
    `INNOVATION CATALYST ANALYSIS (Session ${sessionId}): Think like Clayton Christensen analyzing disruptive innovation potential. Identify jobs-to-be-done that are underserved, market gaps where incumbents are overserving/underserving, and technological convergence points that enable new business models. What would make this solution 10x better than alternatives? How could this become the dominant platform in its category?`
  ]
  
  return prompts[Math.floor(Math.random() * prompts.length)]
}

// Dynamic variations based on idea characteristics  
function getIdeaContextualPrompt(ideas: any[]): string {
  if (!ideas || ideas.length === 0) {
    return 'IDEA ANALYSIS: No ideas provided for strategic assessment.'
  }

  const ideaCount = ideas.length
  const quickWins = ideas.filter(idea => idea.quadrant === 'quick-wins').length
  const majorProjects = ideas.filter(idea => idea.quadrant === 'major-projects').length
  const fillIns = ideas.filter(idea => idea.quadrant === 'fill-ins').length
  const thankless = ideas.filter(idea => idea.quadrant === 'thankless-tasks').length
  
  const variations = [
    `PORTFOLIO ANALYSIS: Analyzing ${ideaCount} strategic initiatives with ${quickWins} quick wins, ${majorProjects} major projects, ${fillIns} fill-ins, and ${thankless} operational tasks. Focus on cross-quadrant synergies and execution sequencing.`,
    
    `STRATEGIC PORTFOLIO ASSESSMENT: Your ${ideaCount}-idea portfolio shows ${Math.round((quickWins + majorProjects)/ideaCount * 100)}% high-impact initiatives. Analyze each idea's strategic contribution and interconnections for maximum value creation.`,
    
    `INITIATIVE PRIORITIZATION: With ${ideaCount} ideas spanning all strategic quadrants, identify which specific combinations create compound value and accelerated market entry opportunities.`,
    
    `QUADRANT-BASED STRATEGY: The portfolio distribution (${quickWins} quick wins, ${majorProjects} major projects) suggests specific strategic approaches. Analyze each idea's role in overall venture success and timing optimization.`,
    
    `COMPREHENSIVE IDEA EVALUATION: ${ideaCount} strategic initiatives provide multiple execution pathways. Assess each idea's individual merit and contribution to overall strategic objectives and competitive positioning.`
  ]
  
  return variations[Math.floor(Math.random() * variations.length)]
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