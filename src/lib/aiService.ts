import { IdeaCard } from '../types'

interface AIIdeaResponse {
  content: string
  details: string
  priority: 'low' | 'moderate' | 'high' | 'strategic' | 'innovation'
}

interface AIServiceConfig {
  provider: 'openai' | 'anthropic' | 'mock'
  apiKey?: string
  model?: string
}

class AIService {
  private config: AIServiceConfig

  constructor(config: AIServiceConfig = { provider: 'mock' }) {
    this.config = config
    console.log('🤖 AI Service initialized:', {
      provider: this.config.provider,
      hasApiKey: !!this.config.apiKey,
      model: this.config.model
    })
  }

  async generateIdea(title: string, projectContext?: { name?: string, description?: string, type?: string }): Promise<AIIdeaResponse> {
    console.log(`🧠 Generating idea for: "${title}" using provider: ${this.config.provider}`)
    console.log('🎯 Project context:', projectContext)
    
    switch (this.config.provider) {
      case 'openai':
        console.log('📡 Attempting OpenAI generation...')
        return this.generateWithOpenAI(title, projectContext)
      case 'anthropic':
        console.log('📡 Attempting Anthropic generation...')
        return this.generateWithAnthropic(title, projectContext)
      case 'mock':
      default:
        console.log('🎭 Using mock AI generation...')
        return this.generateMockIdea(title, projectContext)
    }
  }

  private async generateWithOpenAI(title: string, projectContext?: { name?: string, description?: string, type?: string }): Promise<AIIdeaResponse> {
    console.log('🔑 Checking OpenAI API key...', { hasKey: !!this.config.apiKey })
    
    if (!this.config.apiKey) {
      console.warn('❌ OpenAI API key not configured, falling back to mock')
      return this.generateMockIdea(title, projectContext)
    }

    console.log('✅ OpenAI API key found, making API request...')

    const contextInfo = projectContext ? 
      `PROJECT CONTEXT: This idea is for "${projectContext.name}" (${projectContext.type}): ${projectContext.description}

CRITICAL: Generate an idea that is contextually relevant to this project type and description. 
- For marketing projects: Focus on marketing strategies, campaigns, content, social media, SEO, brand awareness
- For software projects: Focus on technical features, architecture, user experience, development, APIs, security  
- For business projects: Focus on operations, processes, efficiency, training, analytics, management
- For product projects: Focus on product features, user research, design, testing, roadmap, market fit

DO NOT suggest ideas outside the project's domain (e.g., don't suggest VR development for a marketing campaign).` : ''

    const prompt = `You are a business and technology strategy consultant helping to develop detailed project ideas. Given the brief title "${title}", build out details for the card in the lens of what this idea means and some key insights. Think of a mini use case with some business value drivers.

${contextInfo}

CRITICAL: Respond ONLY with valid JSON in this exact format (no markdown, no extra text):

{
  "content": "${title}",
  "details": "Write a detailed 150-200 word description including specific implementation approach, key features, business value, timeline, resources needed, and success metrics. Make it contextually relevant to the project type if provided.",
  "priority": "low|moderate|high|strategic|innovation"
}

Requirements:
- Keep the title exactly as provided
- Make details a single string (not an object)
- Priority must be one of: low, moderate, high, strategic, innovation
- Be specific and actionable, avoid generic statements
- Ensure the idea fits the project context and type
- Return only the JSON object, nothing else`

    try {
      console.log('📞 Making OpenAI API request with model:', this.config.model || 'gpt-4o-mini')
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a business strategy consultant. Always respond with valid JSON in the exact format requested.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 300,
          temperature: 0.8,
        }),
      })

      console.log('📊 OpenAI API response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ OpenAI API error:', response.status, errorText)
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      const data = await response.json()
      console.log('📥 OpenAI API response received:', { hasChoices: !!data.choices, choicesLength: data.choices?.length })
      
      const content = data.choices[0]?.message?.content
      console.log('📝 OpenAI content:', content ? `${content.substring(0, 100)}...` : 'No content')

      if (!content) {
        throw new Error('No content received from OpenAI')
      }

      // Parse JSON response (handle markdown code blocks)
      console.log('🔍 Parsing OpenAI JSON response...')
      let cleanedContent = content.trim()
      
      // Remove markdown code block formatting if present
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }
      
      console.log('📄 Cleaned content for parsing:', cleanedContent.substring(0, 200) + '...')
      
      const parsed = JSON.parse(cleanedContent)
      console.log('✅ Parsed JSON:', { content: parsed.content, hasDetails: !!parsed.details, priority: parsed.priority, fullResponse: parsed })
      
      // Handle different response formats from OpenAI
      let details = parsed.details
      if (typeof details === 'object' && details.description) {
        details = details.description
      }
      
      // Provide default priority if missing
      let priority = parsed.priority || 'moderate'
      
      // Validate response format
      if (!parsed.content || !details) {
        console.error('❌ Invalid OpenAI response format:', parsed)
        throw new Error('Invalid response format from OpenAI')
      }

      console.log('🎉 OpenAI generation successful!')
      return {
        content: parsed.content,
        details: details,
        priority: priority as AIIdeaResponse['priority']
      }
    } catch (error) {
      console.error('OpenAI API error:', error)
      console.log('Falling back to mock AI')
      return this.generateMockIdea(title)
    }
  }

  private async generateWithAnthropic(title: string, projectContext?: { name?: string, description?: string, type?: string }): Promise<AIIdeaResponse> {
    if (!this.config.apiKey) {
      console.warn('Anthropic API key not configured, falling back to mock')
      return this.generateMockIdea(title, projectContext)
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.config.model || 'claude-3-haiku-20240307',
          max_tokens: 300,
          messages: [
            {
              role: 'user',
              content: `You are a business strategy consultant. Given the brief title "${title}", create a comprehensive business idea.

Respond with JSON in this exact format:
{"content": "keep original title", "details": "100-150 word detailed description with specific implementation approach, key features, business value, timeline, resources needed, and success metrics", "priority": "low|moderate|high|strategic|innovation"}

Be specific and insightful, not generic.`
            }
          ]
        }),
      })

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`)
      }

      const data = await response.json()
      const content = data.content[0]?.text

      if (!content) {
        throw new Error('No content received from Anthropic')
      }

      // Parse JSON response (handle markdown code blocks)
      console.log('🔍 Parsing Anthropic JSON response...')
      let cleanedContent = content.trim()
      
      // Remove markdown code block formatting if present
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }
      
      console.log('📄 Cleaned Anthropic content:', cleanedContent.substring(0, 200) + '...')
      
      const parsed = JSON.parse(cleanedContent)
      
      // Validate response format
      if (!parsed.content || !parsed.details || !parsed.priority) {
        throw new Error('Invalid response format from Anthropic')
      }

      return {
        content: parsed.content,
        details: parsed.details,
        priority: parsed.priority
      }
    } catch (error) {
      console.error('Anthropic API error:', error)
      console.log('Falling back to mock AI')
      return this.generateMockIdea(title, projectContext)
    }
  }

  private generateMockIdea(title: string, projectContext?: { name?: string, description?: string, type?: string }): AIIdeaResponse {
    console.log(`🎭 Generating mock AI idea for: "${title}"`)
    console.log('🎯 Mock AI project context:', projectContext)
    // Enhanced mock AI with much more variety
    const businessDomains: Record<string, {
      keywords: string[]
      ideas: Array<{
        details: string
        priority: AIIdeaResponse['priority']
      }>
    }> = {
      technology: {
        keywords: ['app', 'software', 'platform', 'system', 'api', 'mobile', 'web', 'cloud', 'ai', 'automation'],
        ideas: [
          {
            details: `Build ${title} using microservices architecture with containerized deployment on AWS/GCP. Implement real-time data processing, user authentication via OAuth 2.0, and comprehensive API documentation. Include monitoring dashboards, automated testing pipelines, and staged rollout strategy. Target 99.9% uptime with horizontal scaling capabilities.`,
            priority: 'strategic' as const
          },
          {
            details: `Develop ${title} as Progressive Web App with offline capabilities, push notifications, and responsive design. Integrate with existing CRM systems through REST APIs. Implement A/B testing framework for feature validation. Expected development timeline: 4-6 months with monthly release cycles.`,
            priority: 'moderate' as const
          },
          {
            details: `Create ${title} using cutting-edge technologies like GraphQL, WebRTC, or blockchain smart contracts. Pioneer new industry standards with patent-potential innovations. Requires dedicated R&D team and substantial investment but offers first-mover advantage and market differentiation.`,
            priority: 'innovation' as const
          }
        ]
      },
      marketing: {
        keywords: ['marketing', 'campaign', 'brand', 'social', 'advertising', 'promotion', 'content', 'seo'],
        ideas: [
          {
            details: `Launch ${title} across LinkedIn, Instagram, and TikTok with influencer partnerships and user-generated content campaigns. Implement attribution modeling to track customer journey from awareness to conversion. Target 25% increase in qualified leads with $50 CAC and 3:1 ROAS within 6 months.`,
            priority: 'high' as const
          },
          {
            details: `Execute ${title} through content marketing strategy featuring weekly blog posts, monthly webinars, and SEO-optimized landing pages. Leverage existing email list and partnerships for organic growth. Focus on thought leadership and long-term brand building with measurable engagement metrics.`,
            priority: 'moderate' as const
          },
          {
            details: `Pioneer ${title} using AR/VR experiences, AI-powered personalization, or interactive voice campaigns on smart speakers. Experiment with emerging platforms and unconventional channels. High creativity potential but uncertain ROI - allocate 10-15% of marketing budget for testing.`,
            priority: 'innovation' as const
          }
        ]
      },
      business: {
        keywords: ['revenue', 'profit', 'cost', 'efficiency', 'process', 'workflow', 'operations', 'analytics'],
        ideas: [
          {
            details: `Implement ${title} to achieve 15-25% operational cost reduction through process automation and resource optimization. Deploy across 3 business units with dedicated change management team. Include staff training, performance metrics tracking, and quarterly review cycles. Expected payback period: 8-12 months.`,
            priority: 'strategic' as const
          },
          {
            details: `Execute ${title} using lean methodology with cross-functional teams and weekly sprint reviews. Focus on eliminating waste, improving quality scores, and reducing cycle times. Implement continuous improvement culture with employee feedback loops and recognition programs.`,
            priority: 'moderate' as const
          },
          {
            details: `Address ${title} as critical business issue requiring immediate C-level attention and emergency budget allocation. Deploy rapid response team with weekly executive reviews. Expected to prevent $500K+ annual losses and restore operational stability within 90 days.`,
            priority: 'high' as const
          }
        ]
      }
    }

    // Detect domain based on project context first, then title keywords
    const titleLower = title.toLowerCase()
    let selectedDomain = businessDomains.business // default
    
    // Use project context if available for better domain detection
    if (projectContext?.type) {
      const contextType = projectContext.type.toLowerCase()
      console.log('🎯 Using project context type for domain detection:', contextType)
      
      if (contextType.includes('marketing') || contextType.includes('campaign') || contextType.includes('brand')) {
        selectedDomain = businessDomains.marketing
        console.log('📢 Selected marketing domain from project context')
      } else if (contextType.includes('software') || contextType.includes('tech') || contextType.includes('app') || contextType.includes('development')) {
        selectedDomain = businessDomains.technology
        console.log('💻 Selected technology domain from project context')
      } else if (contextType.includes('business') || contextType.includes('operations') || contextType.includes('process')) {
        selectedDomain = businessDomains.business
        console.log('💼 Selected business domain from project context')
      }
    } else {
      // Fallback to title-based detection
      console.log('🔍 Using title-based domain detection')
      for (const [, config] of Object.entries(businessDomains)) {
        if (config.keywords.some(keyword => titleLower.includes(keyword))) {
          selectedDomain = config
          break
        }
      }
    }

    // Select random idea from domain
    const randomIdea = selectedDomain.ideas[Math.floor(Math.random() * selectedDomain.ideas.length)]
    
    // Add random business insights
    const insights = [
      'Conduct competitive analysis and market research before implementation.',
      'Consider regulatory compliance requirements and data privacy laws.',
      'Establish partnerships with key vendors and technology providers.',
      'Plan for scalability challenges and future market expansion.',
      'Implement robust security measures and regular penetration testing.',
      'Create comprehensive documentation and knowledge transfer protocols.',
      'Develop change management strategy for user adoption and training.',
      'Set up analytics dashboard with KPIs and real-time monitoring.',
      'Design disaster recovery plan and business continuity procedures.',
      'Evaluate intellectual property implications and patent opportunities.'
    ]

    const randomInsight = insights[Math.floor(Math.random() * insights.length)]
    
    // Enhance details with project context if available
    let enhancedDetails = randomIdea.details
    if (projectContext?.name && projectContext?.description) {
      enhancedDetails = enhancedDetails.replace(title, `${title} for ${projectContext.name}`)
      enhancedDetails += ` This aligns with the project goal: ${projectContext.description.substring(0, 100)}...`
    }

    const result = {
      content: title,
      details: `${enhancedDetails} ${randomInsight}`,
      priority: randomIdea.priority
    }
    
    console.log('🎭 Mock AI generation complete:', {
      title: result.content,
      priority: result.priority,
      detailsLength: result.details.length
    })
    
    return result
  }

  static async generateInsights(ideas: IdeaCard[]): Promise<any> {
    console.log('🔍 AIService: Generating insights for', ideas.length, 'ideas...')

    // Create idea analysis summary
    const ideaAnalysis = this.analyzeIdeas(ideas)
    
    const prompt = `Analyze these ${ideas.length} business ideas positioned on a priority matrix and provide strategic insights.

MATRIX POSITIONING:
- Quick Wins (high value, low effort): ${ideaAnalysis.quickWins} ideas
- Strategic (high value, high effort): ${ideaAnalysis.strategic} ideas
- Reconsider (low value, low effort): ${ideaAnalysis.reconsider} ideas
- Avoid (low value, high effort): ${ideaAnalysis.avoid} ideas

IDEAS BREAKDOWN:
${ideas.map(idea => 
  `"${idea.content}" - ${this.getQuadrantName(idea)} quadrant, Priority: ${idea.priority}`
).join('\n')}

Provide a comprehensive strategic report in JSON format with:
{
  "executiveSummary": "2-3 sentence high-level overview",
  "keyInsights": [
    {"insight": "Key observation", "impact": "Business impact"},
    // 3-5 key insights
  ],
  "priorityRecommendations": {
    "immediate": ["Action items for next 30 days"],
    "shortTerm": ["Actions for next 3 months"],
    "longTerm": ["Strategic initiatives for 6-12 months"]
  },
  "riskAssessment": {
    "highRisk": ["Major risks to address"],
    "opportunities": ["Key opportunities to leverage"]
  },
  "suggestedRoadmap": [
    {"phase": "Phase 1", "duration": "1-2 months", "focus": "Description", "ideas": ["idea names"]},
    {"phase": "Phase 2", "duration": "3-4 months", "focus": "Description", "ideas": ["idea names"]},
    // Continue phases as needed
  ],
  "resourceAllocation": {
    "quickWins": "Resource recommendation for quick wins",
    "strategic": "Resource recommendation for strategic initiatives"
  },
  "nextSteps": ["Specific actionable next steps"]
}`

    const config = getAIConfig()
    
    try {
      if (config.provider === 'openai') {
        console.log('🤖 AIService: Using OpenAI for insights generation...')
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a strategic business consultant specializing in prioritization frameworks and roadmap planning. Provide detailed, actionable insights based on idea positioning and business value assessment.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.7,
            max_tokens: 2000
          })
        })

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status}`)
        }

        const data = await response.json()
        console.log('✅ AIService: Received OpenAI insights response')
        
        const content = data.choices[0]?.message?.content
        if (!content) {
          throw new Error('No content in OpenAI response')
        }

        // Parse JSON from response (handle code blocks)
        return this.parseAIResponse(content)
        
      } else if (config.provider === 'anthropic') {
        console.log('🤖 AIService: Using Anthropic for insights generation...')
        // Anthropic implementation would go here
        throw new Error('Anthropic insights not implemented yet')
      }
    } catch (error) {
      console.error('❌ AIService: Error generating insights:', error)
      console.log('🔄 AIService: Falling back to enhanced mock insights...')
      
      return this.generateMockInsights(ideaAnalysis)
    }
  }

  private static parseAIResponse(content: string): any {
    let cleanedContent = content.trim()
    
    // Remove markdown code block formatting if present
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }
    
    return JSON.parse(cleanedContent)
  }

  private static analyzeIdeas(ideas: IdeaCard[]) {
    const analysis = {
      quickWins: ideas.filter(i => i.x <= 260 && i.y < 260).length,
      strategic: ideas.filter(i => i.x > 260 && i.y < 260).length,
      reconsider: ideas.filter(i => i.x <= 260 && i.y >= 260).length,
      avoid: ideas.filter(i => i.x > 260 && i.y >= 260).length,
      totalIdeas: ideas.length,
      highPriority: ideas.filter(i => i.priority === 'high' || i.priority === 'strategic').length,
      contributors: [...new Set(ideas.map(i => i.created_by))].length
    }
    
    return analysis
  }

  private static getQuadrantName(idea: IdeaCard): string {
    if (idea.x <= 260 && idea.y < 260) return 'Quick Wins'
    if (idea.x > 260 && idea.y < 260) return 'Strategic'
    if (idea.x <= 260 && idea.y >= 260) return 'Reconsider'
    return 'Avoid'
  }

  private static generateMockInsights(analysis: any) {
    return {
      executiveSummary: `Portfolio analysis of ${analysis.totalIdeas} ideas shows ${analysis.quickWins} quick wins and ${analysis.strategic} strategic initiatives. Focus recommended on immediate value delivery while building long-term strategic capabilities.`,
      keyInsights: [
        {
          insight: `${Math.round((analysis.quickWins / analysis.totalIdeas) * 100)}% of ideas are positioned as Quick Wins`,
          impact: "High potential for immediate ROI and momentum building"
        },
        {
          insight: `${analysis.strategic} strategic initiatives identified`,
          impact: "Balanced approach between short-term gains and long-term value"
        },
        {
          insight: `${analysis.contributors} contributors across ${analysis.totalIdeas} ideas`,
          impact: "Good team engagement and diverse perspective inputs"
        }
      ],
      priorityRecommendations: {
        immediate: [
          "Execute all Quick Wins ideas to build momentum",
          "Assign dedicated owners to top 3 strategic initiatives",
          "Create detailed project plans for high-priority items"
        ],
        shortTerm: [
          "Begin strategic initiatives with clearest ROI",
          "Establish regular review cycles for progress tracking",
          "Reallocate resources from 'Avoid' quadrant ideas"
        ],
        longTerm: [
          "Develop capabilities needed for strategic initiatives",
          "Create innovation pipeline for future opportunities",
          "Build measurement framework for success tracking"
        ]
      },
      riskAssessment: {
        highRisk: [
          "Resource constraints may limit parallel execution",
          "Strategic initiatives require sustained commitment",
          "Stakeholder alignment needed for major changes"
        ],
        opportunities: [
          "Quick wins can fund strategic investments",
          "Strong team engagement enables rapid execution",
          "Balanced portfolio reduces overall risk"
        ]
      },
      suggestedRoadmap: [
        {
          phase: "Foundation Phase",
          duration: "1-2 months",
          focus: "Execute quick wins and prepare strategic foundation",
          ideas: ["Quick Wins ideas", "Initial planning for strategic items"]
        },
        {
          phase: "Strategic Launch",
          duration: "3-6 months", 
          focus: "Launch strategic initiatives with proven quick win momentum",
          ideas: ["Top strategic priorities", "Resource reallocation"]
        },
        {
          phase: "Scale & Optimize",
          duration: "6-12 months",
          focus: "Scale successful initiatives and optimize portfolio",
          ideas: ["Scaled strategic implementations", "Continuous improvement"]
        }
      ],
      resourceAllocation: {
        quickWins: "Allocate 30% of resources to quick wins for immediate impact and funding",
        strategic: "Dedicate 60% of resources to strategic initiatives with long-term focus"
      },
      nextSteps: [
        "Schedule stakeholder alignment meeting within 1 week",
        "Assign project owners to top 5 priority ideas",
        "Create detailed project plans for next quarter",
        "Establish success metrics and review cadence"
      ]
    }
  }

  static async analyzeProjectAndGenerateIdeas(projectName: string, projectDescription: string, additionalContext?: string, selectedProjectType?: string, ideaCount: number = 6, ideaTolerance: number = 50, projectFiles?: any[]): Promise<any> {
    console.log('🔍 AIService: Analyzing project and generating ideas...', { projectName, projectDescription, additionalContext, ideaCount, ideaTolerance, filesCount: projectFiles?.length || 0 })

    // Enhanced project-aware prompt that creates contextually relevant ideas
    const prompt = `You are a strategic business consultant helping to set up a priority matrix for a new project.

PROJECT: "${projectName}"
DESCRIPTION: "${projectDescription}"
${selectedProjectType && selectedProjectType !== 'auto' ? `SELECTED PROJECT TYPE: "${selectedProjectType}"` : ''}
${additionalContext ? `ADDITIONAL CONTEXT: "${additionalContext}"` : ''}
IDEA REQUIREMENTS:
- Generate exactly ${ideaCount} ideas
- Tolerance Level: ${ideaTolerance}% (${ideaTolerance < 30 ? 'Conservative - focus on proven, low-risk ideas' : ideaTolerance < 70 ? 'Balanced - mix of safe and innovative ideas' : 'Experimental - include bold, high-risk/high-reward ideas'})

${projectFiles && projectFiles.length > 0 ? `SUPPORTING FILES AND CONTENT:
The following files have been uploaded as supporting materials for this project:
${projectFiles.map(file => `
- ${file.original_name} (${file.file_type.toUpperCase()}, ${Math.round(file.file_size / 1024)}KB)
  ${file.content_preview ? `Content preview: ${file.content_preview.substring(0, 300)}...` : 'Binary file - content not extracted'}
`).join('')}

Please reference this supporting content when generating ideas and ensure the ideas are relevant to the information provided in these files.` : ''}

**TASK 1: PROJECT TYPE ANALYSIS**
${selectedProjectType && selectedProjectType !== 'auto' ? 
`Use the specified project type "${selectedProjectType}" for analysis.` :
`Analyze the project description and recommend the MOST APPROPRIATE project type from:
- software (Software Development)
- product_development (Physical Product Development)  
- business_plan (Business Planning & Strategy)
- marketing (Marketing Campaign)
- operations (Operations Improvement)
- research (Research & Development)
- other (if none fit perfectly)

If recommending "other", provide detailed reasoning for custom user stories.`}

**TASK 2: IDEA GENERATION**
Generate 6-8 contextually relevant ideas based on the PROJECT TYPE:

CRITICAL REQUIREMENTS:
- For marketing projects: Generate marketing-specific ideas (campaigns, content, SEO, social media, brand awareness, lead generation)
- For software projects: Generate tech-specific ideas (features, architecture, user experience, integrations, security, scalability)  
- For product_development: Generate product ideas (design, prototyping, testing, manufacturing, materials, user research)
- For business_plan: Generate strategy ideas (market research, financials, operations, partnerships, growth strategies)
- For operations: Generate process ideas (efficiency, automation, training, analytics, quality control)
- For research: Generate research ideas (methodology, data collection, analysis, validation, publication)
- For other: Generate domain-specific ideas based on the actual project description

DO NOT mix project types - each project should have domain-specific ideas only.

Respond with this JSON structure:

{
  "needsClarification": boolean,
  "clarifyingQuestions": [
    {"question": "What is your primary goal?", "context": "Understanding objectives helps prioritize features"},
    // 2-4 questions if clarification needed
  ],
  "projectAnalysis": {
    "industry": "detected industry/sector",
    "scope": "project scope assessment", 
    "timeline": "estimated timeline",
    "primaryGoals": ["goal1", "goal2"],
    ${selectedProjectType && selectedProjectType !== 'auto' ? '' : 
    `"recommendedProjectType": "software|product_development|business_plan|marketing|operations|research|other",
    "projectTypeReasoning": "Detailed explanation of why this project type fits best",`}
  },
  "generatedIdeas": [
    {
      "content": "Idea title (must be relevant to project type)",
      "details": "Detailed description with implementation approach, business value, resources needed (150-200 words)",
      "x": 100-400, // pixel position (lower = higher value)
      "y": 100-400, // pixel position (lower = easier to implement)
      "priority": "low|moderate|high|strategic|innovation",
      "reasoning": "Why positioned here on the matrix and how it relates to project goals"
    }
    // Generate exactly ${ideaCount} ideas total, ALL relevant to project type and tolerance level
  ]
}`

    const config = getAIConfig()
    
    try {
      if (config.provider === 'openai') {
        console.log('🤖 AIService: Using OpenAI for project analysis...')
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a strategic business consultant specializing in project planning and priority matrix development. Generate contextually relevant ideas based on project type. Never mix project types - marketing projects get marketing ideas, software projects get technical ideas, etc. Always respond with valid JSON in the exact format requested.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.7,
            max_tokens: 2500
          })
        })

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status}`)
        }

        const data = await response.json()
        console.log('✅ AIService: Received OpenAI project analysis response')
        
        const content = data.choices[0]?.message?.content
        if (!content) {
          throw new Error('No content in OpenAI response')
        }

        // Parse JSON from response (handle code blocks)
        const result = this.parseAIResponse(content)
        console.log('🎯 AIService: OpenAI generated', result.generatedIdeas?.length || 0, 'ideas')
        return result
        
      } else if (config.provider === 'anthropic') {
        console.log('🤖 AIService: Using Anthropic for project analysis...')
        // Anthropic implementation would go here
        throw new Error('Anthropic project analysis not implemented yet')
      }
    } catch (error) {
      console.error('❌ AIService: Error analyzing project:', error)
      console.log('🔄 AIService: Falling back to enhanced mock analysis...')
      
      return this.generateMockProjectAnalysis(projectName, projectDescription)
    }
  }

  private static generateMockProjectAnalysis(projectName: string, projectDescription: string) {
    console.log('🎭 Mock AI: Analyzing project...', { projectName, projectDescription })
    
    // Be less strict about requiring clarification - generate ideas even for shorter descriptions
    const needsClarification = projectDescription.length < 20 || projectDescription.trim().split(' ').length < 3

    if (needsClarification) {
      console.log('🔍 Mock AI: Project needs clarification, returning questions...')
      return {
        needsClarification: true,
        clarifyingQuestions: [
          {
            question: "What are the primary business goals for this project?",
            context: "Understanding objectives helps prioritize features and determine success metrics"
          },
          {
            question: "Who is the target audience or user base?", 
            context: "Knowing your users helps prioritize user-facing features vs internal improvements"
          },
          {
            question: "What's your timeline and budget constraints?",
            context: "Timeline affects whether we focus on quick wins vs long-term strategic initiatives"
          },
          {
            question: "Are there any existing systems or technical constraints?",
            context: "Understanding limitations helps position ideas realistically on the effort axis"
          }
        ],
        projectAnalysis: {
          industry: "General",
          scope: "Requires clarification",
          timeline: "Unknown", 
          primaryGoals: ["To be determined"]
        },
        generatedIdeas: []
      }
    }

    // Generate mock ideas based on project type - ALWAYS generate ideas when not asking for clarification
    console.log('🎯 Mock AI: Detecting project type and generating ideas...')
    const projectType = this.detectProjectType(projectName, projectDescription)
    const ideas = this.generateIdeasForProjectType(projectType, projectName, projectDescription)

    console.log('✅ Mock AI: Generated', ideas.length, 'ideas for project type:', projectType.industry)

    const result = {
      needsClarification: false,
      clarifyingQuestions: [],
      projectAnalysis: {
        industry: projectType.industry,
        scope: projectType.scope,
        timeline: "3-6 months estimated",
        primaryGoals: projectType.goals
      },
      generatedIdeas: ideas
    }

    console.log('🎭 Mock AI: Final analysis result:', { 
      hasIdeas: result.generatedIdeas.length > 0,
      ideasCount: result.generatedIdeas.length,
      industry: result.projectAnalysis.industry 
    })

    return result
  }

  private static detectProjectType(name: string, description: string) {
    const combined = (name + ' ' + description).toLowerCase()
    console.log('🔍 Mock AI: Detecting project type from:', combined.substring(0, 100) + '...')
    
    // Marketing projects
    if (combined.includes('marketing') || combined.includes('campaign') || combined.includes('brand') || 
        combined.includes('advertising') || combined.includes('social media') || combined.includes('seo') ||
        combined.includes('content') || combined.includes('promotion') || combined.includes('lead generation') ||
        combined.includes('awareness') || combined.includes('outreach')) {
      console.log('🎯 Detected: Marketing project')
      return {
        industry: 'Marketing',
        scope: 'Marketing Initiative',
        goals: ['Brand awareness', 'Lead generation', 'Customer engagement', 'Market reach']
      }
    }
    
    // Technology/Software projects
    else if (combined.includes('app') || combined.includes('mobile') || combined.includes('web') || 
             combined.includes('software') || combined.includes('platform') || combined.includes('system') ||
             combined.includes('api') || combined.includes('code') || combined.includes('development') ||
             combined.includes('tech') || combined.includes('digital') || combined.includes('online')) {
      console.log('🎯 Detected: Technology/Software project')
      return {
        industry: 'Technology/Software',
        scope: 'Application Development',
        goals: ['User acquisition', 'Feature development', 'Technical excellence', 'User experience']
      }
    }
    
    // Business Operations projects
    else if (combined.includes('business') || combined.includes('process') || combined.includes('operation') ||
             combined.includes('efficiency') || combined.includes('workflow') || combined.includes('management') ||
             combined.includes('optimization') || combined.includes('automation') || combined.includes('training')) {
      console.log('🎯 Detected: Business Operations project')
      return {
        industry: 'Business Operations',
        scope: 'Process Improvement',
        goals: ['Operational efficiency', 'Cost reduction', 'Quality improvement', 'Team productivity']
      }
    }
    
    // Product Development projects
    else if (combined.includes('product') || combined.includes('launch') || combined.includes('design') ||
             combined.includes('prototype') || combined.includes('mvp') || combined.includes('feature')) {
      console.log('🎯 Detected: Product Development project')
      return {
        industry: 'Product Development',
        scope: 'Product Innovation',
        goals: ['Product market fit', 'User satisfaction', 'Innovation', 'Competitive advantage']
      }
    }
    
    // Default to General Business
    else {
      console.log('🎯 Detected: General Business project (default)')
      return {
        industry: 'General Business',
        scope: 'Strategic Initiative',
        goals: ['Market expansion', 'Innovation', 'Competitive advantage', 'Revenue growth']
      }
    }
  }

  private static generateIdeasForProjectType(projectType: any, name: string, _description: string) {
    console.log('🎯 Mock AI: Generating ideas for project type:', projectType.industry)
    
    // Smart positioning algorithm for better card distribution
    const generatePosition = (priority: string, index: number, _totalCount: number) => {
      // Matrix boundaries: 0-520 for x and y
      // Quadrants: High Impact/Low Effort (top-left), High Impact/High Effort (top-right)
      //           Low Impact/Low Effort (bottom-left), Low Impact/High Effort (bottom-right)
      
      const quadrantWidth = 260 // Half of 520
      const quadrantHeight = 260
      const cardWidth = 200 // Idea card width (slightly smaller for better fit)
      const cardHeight = 120 // Idea card height (slightly smaller for better fit)
      const padding = 30 // Increased padding from edges
      
      let baseX = 0, baseY = 0
      
      // Determine quadrant based on priority - Matrix mapping:
      // Top-left: High Impact, Low Effort (Quick Wins)
      // Top-right: High Impact, High Effort (Major Projects)  
      // Bottom-left: Low Impact, Low Effort (Fill-ins)
      // Bottom-right: Low Impact, High Effort (Questionable/Avoid)
      switch (priority) {
        case 'strategic':
          // High Impact, Low Effort (Quick Wins) - top-left
          baseX = padding
          baseY = padding
          break
        case 'innovation':
          // High Impact, High Effort (Major Projects) - top-right  
          baseX = quadrantWidth + padding
          baseY = padding
          break
        case 'low':
          // Low Impact, Low Effort (Fill-ins) - bottom-left
          baseX = padding
          baseY = quadrantHeight + padding
          break
        case 'high':
          // High Impact, High Effort (Major Projects) - top-right
          baseX = quadrantWidth + padding
          baseY = padding
          break
        case 'moderate':
        default:
          // Low Impact, High Effort (Questionable) - bottom-right
          baseX = quadrantWidth + padding  
          baseY = quadrantHeight + padding
          break
      }
      
      // Calculate grid position within quadrant to avoid overlap
      const availableWidth = quadrantWidth - padding * 2
      const spacingX = 25 // Horizontal spacing between cards
      const spacingY = 30 // Vertical spacing between cards
      
      const itemsPerRow = Math.max(1, Math.floor(availableWidth / (cardWidth + spacingX)))
      const row = Math.floor(index / itemsPerRow)
      const col = index % itemsPerRow
      
      // Add some randomization to make it look more natural (smaller range)
      const randomOffsetX = Math.random() * 20 - 10
      const randomOffsetY = Math.random() * 15 - 7.5
      
      const finalX = baseX + col * (cardWidth + spacingX) + randomOffsetX
      const finalY = baseY + row * (cardHeight + spacingY) + randomOffsetY
      
      return {
        x: Math.max(10, Math.min(520 - cardWidth, finalX)),
        y: Math.max(10, Math.min(520 - cardHeight, finalY))
      }
    }
    
    // Define base ideas without positions (will be calculated dynamically)
    // Balanced priority distribution: strategic (25%), high (25%), moderate (25%), low (15%), innovation (10%)
    const rawIdeas = {
      'Marketing': [
        { content: 'Social Media Campaign Launch', details: `Launch coordinated social media campaign across LinkedIn, Instagram, Twitter and TikTok for ${name}. Develop content calendar with daily posts, engagement strategy, influencer collaborations, and performance tracking. Focus on building brand awareness and driving qualified leads through targeted messaging and hashtag strategies.`, priority: 'strategic' as const },
        { content: 'Content Marketing Strategy', details: `Create comprehensive content marketing hub for ${name} including blog posts, case studies, whitepapers, and video content. Establish thought leadership through educational resources, improve SEO rankings, and generate inbound leads. Requires content team and editorial calendar with weekly publishing schedule.`, priority: 'strategic' as const },
        { content: 'Email Marketing Automation', details: `Set up automated email marketing system for ${name} with welcome sequences, nurture campaigns, and behavioral triggers. Include A/B testing for subject lines and content, segmentation based on user behavior, and integration with CRM. Expected to increase conversion rates by 25%.`, priority: 'strategic' as const },
        { content: 'Paid Advertising Campaigns', details: `Launch targeted paid advertising campaigns for ${name} across Google Ads, Facebook, LinkedIn, and relevant industry platforms. Create compelling ad copy, landing pages, and conversion tracking. Focus on high-intent keywords and lookalike audiences for maximum ROI.`, priority: 'high' as const },
        { content: 'Influencer Partnership Program', details: `Develop influencer partnership program for ${name} by identifying and collaborating with industry thought leaders and micro-influencers. Create partnership agreements, content guidelines, and performance metrics. Focus on authentic endorsements and co-created content for expanded reach.`, priority: 'high' as const },
        { content: 'SEO & Organic Growth', details: `Implement comprehensive SEO strategy for ${name} including keyword research, on-page optimization, technical SEO improvements, and link building campaigns. Create pillar content and topic clusters to dominate search results for relevant industry terms and drive organic traffic.`, priority: 'high' as const },
        { content: 'Brand Identity Refresh', details: `Modernize brand identity for ${name} including logo redesign, color palette update, typography selection, and brand guideline documentation. Ensure consistency across all marketing materials and touchpoints. Requires design team and stakeholder approval process.`, priority: 'moderate' as const },
        { content: 'Quick Win PR Outreach', details: `Execute immediate PR outreach for ${name} by compiling targeted media lists and sending press releases to relevant publications. Focus on low-hanging fruit with existing industry contacts, local media, and trade publications for quick visibility wins.`, priority: 'low' as const },
        { content: 'Customer Feedback Collection', details: `Set up systematic customer feedback collection for ${name} through surveys, interviews, and review monitoring. Create feedback analysis workflow and response protocols to improve satisfaction and identify improvement opportunities.`, priority: 'moderate' as const },
        { content: 'Marketing Automation Platform', details: `Implement comprehensive marketing automation platform for ${name} with lead scoring, nurture campaigns, and customer journey mapping. Include integration with CRM and analytics for full-funnel visibility and optimization.`, priority: 'innovation' as const },
        { content: 'Referral Program Launch', details: `Create customer referral program for ${name} with incentive structure, tracking system, and promotional materials. Focus on turning satisfied customers into brand advocates and reducing customer acquisition costs through word-of-mouth marketing.`, priority: 'moderate' as const },
        { content: 'Video Marketing Initiative', details: `Develop video marketing strategy for ${name} including explainer videos, customer testimonials, behind-the-scenes content, and educational tutorials. Includes video production, editing, and distribution across multiple platforms.`, priority: 'low' as const }
      ],
      'Technology/Software': [
        { content: 'User Authentication System', details: `Implement secure user authentication system for ${name} with OAuth integration, multi-factor authentication, password recovery, and session management. Essential security foundation that enables user personalization, data protection, and compliance with privacy regulations. Estimated 2-3 weeks development time.`, priority: 'strategic' as const },
        { content: 'Core Feature MVP', details: `Build minimum viable product version of ${name} focusing on the essential user journey and primary value proposition. Include basic feature set needed to validate concept with early users and gather feedback for iterations. Foundation for all future development efforts.`, priority: 'strategic' as const },
        { content: 'Analytics & Monitoring Dashboard', details: `Create comprehensive analytics dashboard for ${name} to monitor user behavior, feature usage, system performance, and business metrics. Include real-time data visualization, custom reports, alerting system, and integration with popular analytics tools like Google Analytics.`, priority: 'moderate' as const },
        { content: 'Mobile-First Optimization', details: `Ensure ${name} delivers excellent mobile experience with responsive design, touch-optimized interactions, fast loading times, and mobile-specific features. Implement progressive web app capabilities and offline functionality for improved user engagement and retention.`, priority: 'moderate' as const },
        { content: 'AI/ML Integration', details: `Integrate advanced AI and machine learning capabilities into ${name} for personalization, intelligent recommendations, predictive analytics, or automation features. Requires research phase, model training, and significant computational resources but offers competitive differentiation.`, priority: 'innovation' as const },
        { content: 'User Onboarding Experience', details: `Design intuitive onboarding flow for ${name} with guided tutorials, interactive tooltips, progress indicators, and contextual help. Reduce time-to-value for new users and improve activation rates through strategic feature introduction and engagement hooks.`, priority: 'strategic' as const },
        { content: 'API & Integration Layer', details: `Develop robust API infrastructure for ${name} enabling third-party integrations, webhooks, and ecosystem expansion. Include comprehensive documentation, rate limiting, authentication, and SDKs for popular programming languages. Supports partnerships and enterprise adoption.`, priority: 'high' as const },
        { content: 'Performance Optimization', details: `Implement comprehensive performance optimization for ${name} including code splitting, lazy loading, caching strategies, CDN integration, and database query optimization. Target sub-2-second page load times and improved Core Web Vitals scores for better user experience and SEO.`, priority: 'moderate' as const },
        { content: 'Security & Privacy Compliance', details: `Implement comprehensive security measures for ${name} including data encryption, vulnerability assessments, privacy compliance (GDPR/CCPA), and security monitoring. Essential for building user trust and meeting regulatory requirements.`, priority: 'high' as const },
        { content: 'Automated Testing & CI/CD', details: `Set up automated testing pipeline for ${name} with unit tests, integration tests, and deployment automation. Includes continuous integration, code quality checks, and staging environments for reliable software delivery.`, priority: 'low' as const },
        { content: 'Database Architecture & Scaling', details: `Design scalable database architecture for ${name} with proper indexing, query optimization, backup strategies, and horizontal scaling capabilities. Critical for handling growth and ensuring data integrity.`, priority: 'high' as const },
        { content: 'Real-time Features', details: `Implement real-time functionality for ${name} using WebSocket connections, live updates, and collaborative features. Enhances user experience with instant feedback and multi-user interactions.`, priority: 'innovation' as const }
      ],
      'Business Operations': [
        { content: 'Process Documentation & SOPs', details: `Create comprehensive documentation for ${name} including standard operating procedures, workflow diagrams, quality control checkpoints, and compliance guidelines. Establish foundation for training, consistency, and continuous improvement initiatives across all team members.`, priority: 'moderate' as const },
        { content: 'Workflow Automation System', details: `Implement automation tools for ${name} to eliminate repetitive manual tasks and streamline operations. Focus on high-volume, rule-based processes like data entry, approvals, notifications, and reporting. Expected to reduce processing time by 40% and minimize human errors.`, priority: 'strategic' as const },
        { content: 'Team Training & Development Program', details: `Develop comprehensive training program for ${name} including skills assessment, learning paths, certification components, and progress tracking. Create onboarding materials for new hires and continuous education for existing team members to improve productivity and job satisfaction.`, priority: 'moderate' as const },
        { content: 'Quick Efficiency Improvements', details: `Implement immediate process improvements for ${name} that require minimal investment: eliminate redundant steps, streamline communication flows, organize digital workspaces, and establish daily standups. Focus on low-hanging fruit for instant productivity gains.`, priority: 'low' as const },
        { content: 'Business Intelligence Platform', details: `Deploy comprehensive business intelligence solution for ${name} with automated reporting, trend analysis, predictive analytics, and executive dashboards. Enable data-driven decision making across all departments with real-time insights and customizable KPI tracking.`, priority: 'strategic' as const },
        { content: 'Quality Management Framework', details: `Establish quality control processes for ${name} including error tracking, root cause analysis, continuous improvement methodology, and customer feedback integration. Requires cultural change management and ongoing commitment but ensures consistent service delivery.`, priority: 'high' as const },
        { content: 'Digital Transformation Initiative', details: `Lead digital transformation for ${name} by modernizing legacy systems, implementing cloud infrastructure, and adopting digital-first processes. Includes change management, staff training, and phased rollout strategy. High impact but requires significant investment and leadership commitment.`, priority: 'strategic' as const },
        { content: 'Customer Service Optimization', details: `Optimize customer service operations for ${name} with helpdesk software, chatbot implementation, knowledge base creation, and response time improvements. Include customer satisfaction tracking and agent performance metrics to deliver exceptional support experience.`, priority: 'moderate' as const }
      ],
      'Product Development': [
        { content: 'Market Research & Validation', details: `Conduct comprehensive market research for ${name} including competitor analysis, customer interviews, surveys, and focus groups. Validate product-market fit, identify target segments, and gather requirements for MVP development. Critical foundation for all product decisions.`, priority: 'high' as const },
        { content: 'Product MVP Development', details: `Build minimum viable product for ${name} focusing on core value proposition and essential features. Use agile development methodology with 2-week sprints, user story mapping, and continuous stakeholder feedback. Target 3-month timeline for first release.`, priority: 'strategic' as const },
        { content: 'User Experience Design', details: `Create comprehensive UX/UI design system for ${name} including user personas, journey mapping, wireframes, prototypes, and usability testing. Ensure intuitive navigation, accessibility compliance, and consistent brand experience across all touchpoints.`, priority: 'high' as const },
        { content: 'Product Analytics Setup', details: `Implement product analytics infrastructure for ${name} with event tracking, funnel analysis, cohort studies, and A/B testing capabilities. Enable data-driven product decisions through user behavior insights, feature adoption metrics, and retention analysis.`, priority: 'moderate' as const },
        { content: 'Go-to-Market Strategy', details: `Develop comprehensive go-to-market plan for ${name} including pricing strategy, channel partnerships, launch timeline, marketing campaigns, and sales enablement. Create positioning documents and competitive differentiation messaging for successful market entry.`, priority: 'strategic' as const },
        { content: 'Beta Testing Program', details: `Launch beta testing program for ${name} with selected early adopters and power users. Create feedback collection systems, bug reporting processes, and feature request tracking. Use insights to refine product before public launch and build community of advocates.`, priority: 'moderate' as const },
        { content: 'Advanced Feature Roadmap', details: `Define advanced feature roadmap for ${name} based on user research, market trends, and strategic objectives. Prioritize features using scoring frameworks, resource allocation planning, and timeline estimation. Balance innovation with technical debt and maintenance requirements.`, priority: 'strategic' as const },
        { content: 'Quality Assurance Framework', details: `Establish comprehensive QA processes for ${name} including automated testing, manual test scripts, performance benchmarks, and security audits. Implement continuous integration pipelines and quality gates to ensure reliable product releases and customer satisfaction.`, priority: 'moderate' as const }
      ],
      'General Business': [
        { content: 'Strategic Planning & Goal Setting', details: `Develop comprehensive strategic plan for ${name} including vision statement, SMART goals, success metrics, and quarterly milestones. Conduct SWOT analysis, competitive landscape review, and resource allocation planning to ensure focused execution and measurable results.`, priority: 'strategic' as const },
        { content: 'Market Analysis & Competitive Intelligence', details: `Conduct thorough market analysis for ${name} including industry trends, competitor positioning, pricing strategies, and customer segments. Create competitive intelligence system with regular updates and actionable insights for strategic decision making.`, priority: 'moderate' as const },
        { content: 'Financial Planning & Budgeting', details: `Establish comprehensive financial planning system for ${name} with detailed budgets, cash flow projections, ROI calculations, and financial controls. Include monthly reporting, variance analysis, and scenario planning for different growth trajectories.`, priority: 'high' as const },
        { content: 'Team Building & Organization', details: `Design optimal organizational structure for ${name} including role definitions, reporting relationships, communication protocols, and performance management systems. Focus on talent acquisition, skills development, and culture building for sustainable growth.`, priority: 'moderate' as const },
        { content: 'Partnership Development', details: `Identify and develop strategic partnerships for ${name} including vendor relationships, distribution channels, technology integrations, and joint ventures. Create partnership criteria, negotiation strategies, and ongoing management processes to accelerate growth.`, priority: 'strategic' as const },
        { content: 'Risk Management & Compliance', details: `Implement comprehensive risk management framework for ${name} including risk assessment, mitigation strategies, insurance coverage, and compliance monitoring. Address operational, financial, legal, and reputational risks with appropriate controls and procedures.`, priority: 'high' as const },
        { content: 'Quick Wins & Early Momentum', details: `Identify and execute quick wins for ${name} that require minimal investment but deliver immediate value. Focus on process improvements, communication enhancements, and resource optimization that can be implemented within 30 days to build momentum.`, priority: 'low' as const },
        { content: 'Innovation & Future Planning', details: `Establish innovation pipeline for ${name} with trend monitoring, idea generation processes, experimentation frameworks, and future opportunity assessment. Allocate resources for R&D activities and emerging technology evaluation to maintain competitive advantage.`, priority: 'innovation' as const }
      ]
    }

    // Get the right set of ideas based on industry
    let typeKey = 'General Business' // default
    if (projectType.industry.includes('Technology') || projectType.industry.includes('Software')) {
      typeKey = 'Technology/Software'
    } else if (projectType.industry.includes('Marketing')) {
      typeKey = 'Marketing'
    } else if (projectType.industry.includes('Business Operations')) {
      typeKey = 'Business Operations'
    } else if (projectType.industry.includes('Product')) {
      typeKey = 'Product Development'
    }
    
    // Get base ideas and apply smart positioning
    const selectedIdeas = (rawIdeas as any)[typeKey] || (rawIdeas as any)['General Business']
    
    // Group ideas by priority for better positioning
    const priorityGroups: {[key: string]: number} = {}
    selectedIdeas.forEach((idea: any) => {
      priorityGroups[idea.priority] = (priorityGroups[idea.priority] || 0) + 1
    })
    
    // Apply positioning algorithm
    const positionedIdeas = selectedIdeas.map((idea: any, index: number) => {
      const priorityIndex = selectedIdeas.filter((i: any, idx: number) => 
        idx < index && i.priority === idea.priority
      ).length
      
      const position = generatePosition(idea.priority, priorityIndex, priorityGroups[idea.priority] || 1)
      return {
        ...idea,
        x: Math.round(position.x),
        y: Math.round(position.y)
      }
    })
    
    console.log('📋 Mock AI: Selected idea set:', typeKey, 'with', positionedIdeas.length, 'ideas')
    console.log('🎯 Priority distribution:', priorityGroups)
    
    return positionedIdeas
  }

  static async generateRoadmap(projectName: string, projectDescription: string, ideas: any[], projectType?: string, aiAnalysis?: any): Promise<any> {
    const config = getAIConfig()
    
    console.log('🔍 Roadmap generation - Provider:', config.provider, 'Has API Key:', !!config.apiKey)
    
    if (config.provider === 'openai' && config.apiKey) {
      // Real OpenAI implementation
      console.log('🚀 Using real OpenAI API for roadmap generation')
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: config.model,
            messages: [
              {
                role: 'system',
                content: `You are a senior Business Analyst and ${this.getProjectExpertise(projectType, aiAnalysis)} with deep domain expertise. Your task is to perform a comprehensive analysis of the project ideas and create a strategic roadmap that demonstrates thorough business analysis thinking.
                
                PROJECT CONTEXT: ${this.getProjectContext(projectType, aiAnalysis)}
                
                BUSINESS ANALYST APPROACH - YOU MUST:
                1. **DEEP IDEA ANALYSIS**: Carefully analyze each provided idea to understand:
                   - The underlying business need/problem being solved
                   - Technical/operational complexity and dependencies
                   - Resource requirements and constraints
                   - Business value and strategic importance
                   - Risk factors and mitigation needs
                
                2. **STRATEGIC GROUPING**: Group related ideas into coherent ${this.getEpicTerminology(projectType)}s based on:
                   - Functional relationships and dependencies  
                   - Implementation complexity and sequencing
                   - Business value delivery cadence
                   - Resource allocation optimization
                   - Risk distribution and mitigation
                
                3. **CONTEXTUAL EPIC CREATION**: Each ${this.getEpicTerminology(projectType).toLowerCase()} must be:
                   - Highly specific to the project domain (${projectType || 'this industry'})
                   - Directly derived from the actual ideas provided
                   - Include specific technical/business requirements
                   - Address real implementation challenges
                   - Consider stakeholder needs and constraints
                
                4. **DETAILED USER STORIES**: Create ${this.getProjectTerminology(projectType)} that are:
                   - Specific to the project domain and context
                   - Based on actual stakeholder needs (not generic templates)
                   - Include acceptance criteria thinking
                   - Reference specific features/capabilities from the ideas
                
                5. **REALISTIC DELIVERABLES**: List concrete, measurable deliverables that:
                   - Map directly to the provided ideas
                   - Are specific to the ${projectType || 'project'} domain
                   - Include technical specifications, documentation, and validation criteria
                   - Consider compliance, testing, and quality requirements
                
                ANALYSIS DEPTH: Don't use generic templates. Analyze the specific ideas provided and create roadmap elements that demonstrate you understand the project's unique challenges, opportunities, and requirements.
                
                Return ONLY valid JSON with this exact structure:
                {
                  "roadmapAnalysis": {
                    "totalDuration": "X months",
                    "phases": [
                      {
                        "phase": "Phase 1: Foundation",
                        "duration": "4-6 weeks",
                        "description": "Core infrastructure and high-priority features",
                        "epics": [
                          {
                            "title": "Epic Title",
                            "description": "Epic description",
                            "userStories": ["Story 1", "Story 2"],
                            "deliverables": ["Deliverable 1", "Deliverable 2"],
                            "priority": "High",
                            "complexity": "Medium",
                            "relatedIdeas": ["idea content 1", "idea content 2"]
                          }
                        ],
                        "risks": ["Risk 1", "Risk 2"],
                        "successCriteria": ["Criteria 1", "Criteria 2"]
                      }
                    ]
                  },
                  "executionStrategy": {
                    "methodology": "Agile/Scrum",
                    "sprintLength": "2 weeks",
                    "teamRecommendations": "Team composition suggestions",
                    "keyMilestones": [
                      {
                        "milestone": "MVP Release",
                        "timeline": "Week 8",
                        "description": "First working version"
                      }
                    ]
                  }
                }`
              },
              {
                role: 'user',
                content: `PROJECT ANALYSIS REQUEST

**Project Name**: ${projectName}
**Project Description**: ${projectDescription}
**Project Type**: ${projectType || 'Not specified'}
${aiAnalysis ? `**AI Analysis**: Industry: ${aiAnalysis.projectAnalysis?.industry || 'N/A'}, Scope: ${aiAnalysis.projectAnalysis?.scope || 'N/A'}, Timeline: ${aiAnalysis.projectAnalysis?.timeline || 'N/A'}` : ''}

**IDEAS FOR ANALYSIS** (${ideas.length} total):
${ideas.map((idea, index) => `
${index + 1}. **${idea.content}** (Priority: ${idea.priority?.toUpperCase()})
   Details: ${idea.details}
   Matrix Position: (${idea.x}, ${idea.y})
   ${idea.reasoning ? `AI Reasoning: ${idea.reasoning}` : ''}
`).join('\n')}

**BUSINESS ANALYST TASK**: 
CRITICAL: You MUST analyze the specific ideas listed above. Do NOT create generic work packages or templates.

${projectType === 'other' ? 
`**SPECIAL INSTRUCTIONS FOR CUSTOM PROJECT TYPE:**
This project doesn't fit standard categories. Based on the project name "${projectName}" and description "${projectDescription}", analyze what type of domain this actually represents. Then create roadmap content that reflects the ACTUAL domain requirements:

- If it's about physical products → use manufacturing/design terminology
- If it's about events → use event planning terminology  
- If it's about education → use curriculum/learning terminology
- If it's about healthcare → use medical/clinical terminology
- If it's about finance → use financial/investment terminology
- etc.

Create user stories that start with roles relevant to this specific domain, not generic "As a user" statements.` :
`Focus on ${projectType} domain expertise and terminology.`}

For each epic you create:
1. **Use specific idea content** - Reference the exact ideas by their content (e.g., "${ideas[0]?.content || 'actual idea content'}")
2. **Create contextual titles** - Epic titles should reflect the actual domain and specific ideas, not generic "Work Package X.Y" 
3. **Write detailed descriptions** - Include technical specifics, domain expertise, and implementation details relevant to the actual ideas
4. **Group related ideas** - Combine complementary ideas into logical implementation groups

Example of what I want:
- Epic Title: "${ideas[0]?.content || 'Actual idea title'}" (not "Work Package 1.1")
- Description: Detailed analysis of this specific idea including technical approach, domain considerations, and implementation strategy

Group these ${ideas.length} ideas into logical, implementation-focused ${this.getEpicTerminology(projectType).toLowerCase()}s that demonstrate deep understanding of the actual project requirements, not generic project management templates.`
              }
            ],
            temperature: 0.7,
            max_tokens: 4000
          })
        })

        console.log('📊 OpenAI roadmap API call status:', response.status)
        if (!response.ok) {
          const errorText = await response.text()
          console.error('❌ OpenAI roadmap API error:', response.status, errorText)
          throw new Error(`OpenAI API error: ${response.status}`)
        }

        const data = await response.json()
        console.log('✅ OpenAI roadmap response received, tokens used:', data.usage?.total_tokens || 'unknown')
        const content = data.choices[0]?.message?.content

        if (!content) {
          throw new Error('No content received from OpenAI')
        }

        // Parse JSON from response (handle code blocks)
        return this.parseAIResponse(content)
      } catch (error) {
        console.error('❌ OpenAI Roadmap Generation Error:', error)
        console.log('🎭 Falling back to mock roadmap generation')
        // Fall back to mock
        return this.generateMockRoadmap(projectName, projectDescription, ideas, projectType, aiAnalysis)
      }
    } else {
      console.log('🎭 Using mock roadmap generation (no OpenAI API key)')
      // Mock implementation
      return this.generateMockRoadmap(projectName, projectDescription, ideas, projectType, aiAnalysis)
    }
  }

  private static getProjectExpertise(projectType?: string, aiAnalysis?: any): string {
    if (aiAnalysis?.projectAnalysis?.industry) {
      return `${aiAnalysis.projectAnalysis.industry} expert`
    }
    
    switch (projectType) {
      case 'software': return 'software development expert'
      case 'product_development': return 'product development expert'
      case 'business_plan': return 'business strategy consultant'
      case 'marketing': return 'marketing strategist'
      case 'operations': return 'operations consultant'
      case 'research': return 'research and development expert'
      default: return 'project management expert'
    }
  }

  private static getProjectTerminology(projectType?: string): string {
    switch (projectType) {
      case 'software': return 'user stories'
      case 'product_development': return 'development milestones'
      case 'business_plan': return 'strategic initiatives'
      case 'marketing': return 'campaign activities'
      case 'operations': return 'process improvements'
      case 'research': return 'research objectives'
      default: return 'action items'
    }
  }

  private static getEpicTerminology(projectType?: string): string {
    switch (projectType) {
      case 'software': return 'Epic'
      case 'product_development': return 'Feature Set'
      case 'business_plan': return 'Strategic Theme'
      case 'marketing': return 'Campaign'
      case 'operations': return 'Process Area'
      case 'research': return 'Research Track'
      default: return 'Work Package'
    }
  }

  private static getProjectMethodology(projectType?: string): string {
    switch (projectType) {
      case 'software': return 'Agile/Scrum'
      case 'product_development': return 'Stage-Gate'
      case 'business_plan': return 'Strategic Planning'
      case 'marketing': return 'Campaign Management'
      case 'operations': return 'Continuous Improvement'
      case 'research': return 'Research Methodology'
      default: return 'Project Management'
    }
  }

  private static getProjectContext(projectType?: string, aiAnalysis?: any): string {
    if (aiAnalysis?.projectAnalysis) {
      const analysis = aiAnalysis.projectAnalysis
      return `This is a ${analysis.industry || projectType || 'general'} project with a focus on ${analysis.scope || 'various aspects'} over a ${analysis.timeline || 'standard'} timeframe. Primary goals include: ${analysis.primaryGoals?.join(', ') || 'achieving project objectives'}.`
    }
    
    switch (projectType) {
      case 'software': 
        return 'This is a software development project requiring technical implementation, user experience design, and system architecture.'
      case 'product_development': 
        return 'This is a product development project involving design, prototyping, testing, and manufacturing considerations.'
      case 'business_plan': 
        return 'This is a business planning project requiring market analysis, financial modeling, and strategic positioning.'
      case 'marketing': 
        return 'This is a marketing project focusing on brand awareness, customer engagement, and campaign effectiveness.'
      case 'operations': 
        return 'This is an operations project aimed at improving processes, efficiency, and organizational effectiveness.'
      case 'research': 
        return 'This is a research and development project involving investigation, experimentation, and knowledge discovery.'
      case 'other':
        return 'This is a specialized project with unique domain requirements. The roadmap should be tailored to the specific project context and goals rather than following generic templates.'
      default: 
        return 'This is a multi-faceted project requiring careful planning and execution across various domains.'
    }
  }

  private static getProjectDuration(projectType?: string): string {
    switch (projectType) {
      case 'software': return "3-4 months"
      case 'product_development': return "6-12 months"  
      case 'business_plan': return "2-3 months"
      case 'marketing': return "3-6 months"
      case 'operations': return "4-6 months"
      case 'research': return "6-18 months"
      case 'other': return "4-8 months"
      default: return "3-6 months"
    }
  }

  private static getPhaseDuration(phase: number, projectType?: string): string {
    const durations: Record<string, string[]> = {
      'software': ["4-6 weeks", "4-5 weeks", "3-4 weeks"],
      'product_development': ["8-12 weeks", "12-16 weeks", "8-10 weeks"], 
      'business_plan': ["3-4 weeks", "4-6 weeks", "2-3 weeks"],
      'marketing': ["4-8 weeks", "6-10 weeks", "4-6 weeks"],
      'operations': ["6-8 weeks", "8-10 weeks", "4-6 weeks"],
      'research': ["8-16 weeks", "16-24 weeks", "12-16 weeks"],
      'other': ["6-8 weeks", "8-12 weeks", "6-8 weeks"]
    }
    
    const defaultDurations = ["4-6 weeks", "6-8 weeks", "4-5 weeks"]
    const phaseDurations = durations[projectType || 'default'] || defaultDurations
    
    return phaseDurations[phase - 1] || "4-6 weeks"
  }

  private static getPhaseDescription(phase: number, projectType?: string): string {
    const descriptions: Record<string, string[]> = {
      'software': [
        "Establish core functionality and deliver immediate value",
        "Expand functionality and improve user experience", 
        "Implement innovative features and prepare for scale"
      ],
      'product_development': [
        "Concept development and initial prototyping",
        "Design refinement and testing validation",
        "Manufacturing preparation and market launch"
      ],
      'business_plan': [
        "Market research and competitive analysis", 
        "Financial modeling and strategy development",
        "Implementation planning and launch preparation"
      ],
      'marketing': [
        "Campaign planning and creative development",
        "Launch execution and optimization", 
        "Performance analysis and scaling"
      ],
      'operations': [
        "Process analysis and improvement identification",
        "Implementation and performance monitoring",
        "Optimization and continuous improvement"
      ],
      'research': [
        "Literature review and methodology design",
        "Data collection and analysis",
        "Results validation and publication"
      ],
      'other': [
        "Foundation and initial setup",
        "Core implementation and development",
        "Optimization and completion"
      ]
    }
    
    const defaultDescriptions = [
      "Foundation and initial implementation",
      "Enhancement and refinement", 
      "Innovation and scaling"
    ]
    
    const phaseDescriptions = descriptions[projectType || 'default'] || defaultDescriptions
    return phaseDescriptions[phase - 1] || "Phase implementation"
  }

  private static getEpicTitle(phase: number, epic: number, projectType?: string): string {
    const titles: Record<string, Record<number, Record<number, string>>> = {
      'software': {
        1: { 1: "Core Platform Setup", 2: "Essential Features" },
        2: { 1: "Advanced Features", 2: "Performance & Security" },
        3: { 1: "Innovation Features" }
      },
      'product_development': {
        1: { 1: "Initial Design & Concepts", 2: "Prototype Development" },
        2: { 1: "Testing & Validation", 2: "Manufacturing Preparation" },
        3: { 1: "Production Launch" }
      },
      'business_plan': {
        1: { 1: "Market Analysis", 2: "Competitive Positioning" },
        2: { 1: "Financial Projections", 2: "Implementation Strategy" },
        3: { 1: "Launch Execution" }
      },
      'marketing': {
        1: { 1: "Campaign Strategy", 2: "Creative Development" },
        2: { 1: "Launch Execution", 2: "Performance Optimization" },
        3: { 1: "Scaling & Growth" }
      },
      'operations': {
        1: { 1: "Process Assessment", 2: "Improvement Design" },
        2: { 1: "Implementation", 2: "Monitoring & Control" },
        3: { 1: "Continuous Improvement" }
      },
      'research': {
        1: { 1: "Research Framework", 2: "Methodology Design" },
        2: { 1: "Data Collection", 2: "Analysis & Insights" },
        3: { 1: "Publication & Dissemination" }
      }
    }
    
    return titles[projectType || 'default']?.[phase]?.[epic] || `Work Package ${phase}.${epic}`
  }

  private static getEpicDescription(phase: number, epic: number, projectType?: string): string {
    const descriptions: Record<string, Record<number, Record<number, string>>> = {
      'product_development': {
        1: { 
          1: "Analyze performance requirements, regulatory constraints, and driver ergonomics to establish comprehensive design specifications. Includes aerodynamic modeling, structural analysis, and safety regulation compliance planning.",
          2: "Build functional prototypes focusing on critical subsystems validation. Emphasis on chassis dynamics, powertrain integration, and safety systems testing with iterative design refinement."
        },
        2: {
          1: "Execute comprehensive testing protocols including track performance, crash safety, and regulatory compliance validation. Data-driven optimization of aerodynamics, handling characteristics, and driver interface systems.",
          2: "Establish production-ready manufacturing processes, supply chain partnerships, and quality control systems. Focus on scalable production methods, cost optimization, and component standardization."
        },
        3: {
          1: "Execute market launch strategy with emphasis on performance validation, customer delivery systems, and post-delivery support infrastructure. Include dealer network setup and service capability development."
        }
      },
      'marketing': {
        1: {
          1: "Conduct comprehensive market analysis including competitor positioning, customer segmentation, and channel opportunity assessment. Develop data-driven buyer personas and messaging framework.",
          2: "Create integrated creative campaign strategy including brand positioning, visual identity, content strategy, and multi-channel creative asset development with A/B testing framework."
        },
        2: {
          1: "Execute full-scale campaign launch across identified channels with real-time performance monitoring, budget optimization, and rapid iteration based on performance metrics.",
          2: "Implement advanced analytics, attribution modeling, and conversion optimization strategies. Focus on ROI maximization and customer acquisition cost optimization."
        }
      }
    }
    
    return descriptions[projectType || 'default']?.[phase]?.[epic] || 
           `Execute specialized deliverables combining domain expertise with strategic business analysis for phase ${phase}, work package ${epic}`
  }

  // Generate user stories based on specific idea content
  private static generateIdeaBasedUserStories(ideaContent: string, _ideaDetails?: string, projectType?: string): string[] {
    const stories: string[] = []
    const lowerContent = ideaContent.toLowerCase()
    
    // Define user personas based on project type
    const personas = this.getPersonasForProjectType(projectType)
    
    // Generate contextual stories based on the idea content
    if (lowerContent.includes('dashboard') || lowerContent.includes('monitoring') || lowerContent.includes('analytics')) {
      stories.push(
        `As a ${personas.analyst}, I need a comprehensive dashboard that displays key metrics and trends so I can make data-driven decisions`,
        `As a ${personas.manager}, I need real-time monitoring capabilities so I can respond quickly to issues and opportunities`,
        `As a ${personas.user}, I need intuitive data visualization that helps me understand performance without technical expertise`
      )
    } else if (lowerContent.includes('interface') || lowerContent.includes('design') || lowerContent.includes('ux') || lowerContent.includes('ui')) {
      stories.push(
        `As a ${personas.user}, I need an intuitive interface that allows me to complete tasks efficiently without confusion`,
        `As a ${personas.designer}, I need design systems and components that ensure consistency across the platform`,
        `As a ${personas.manager}, I need user-friendly features that reduce training time and support costs`
      )
    } else if (lowerContent.includes('automation') || lowerContent.includes('workflow') || lowerContent.includes('process')) {
      stories.push(
        `As a ${personas.user}, I need automated processes that eliminate repetitive manual tasks and reduce errors`,
        `As a ${personas.manager}, I need workflow optimization that increases team productivity and efficiency`,
        `As a ${personas.admin}, I need process controls and monitoring to ensure automation runs smoothly`
      )
    } else if (lowerContent.includes('security') || lowerContent.includes('authentication') || lowerContent.includes('privacy')) {
      stories.push(
        `As a ${personas.user}, I need secure authentication that protects my data while being easy to use`,
        `As a ${personas.admin}, I need comprehensive security controls to protect against threats and ensure compliance`,
        `As a ${personas.manager}, I need security reporting and audit trails for governance and risk management`
      )
    } else if (lowerContent.includes('integration') || lowerContent.includes('api') || lowerContent.includes('connect')) {
      stories.push(
        `As a ${personas.developer}, I need robust API documentation and tools to integrate with existing systems`,
        `As a ${personas.admin}, I need seamless data synchronization between platforms without manual intervention`,
        `As a ${personas.user}, I need unified access to information from multiple sources in one place`
      )
    } else if (lowerContent.includes('mobile') || lowerContent.includes('app') || lowerContent.includes('responsive')) {
      stories.push(
        `As a ${personas.user}, I need mobile-optimized features that work seamlessly across all my devices`,
        `As a ${personas.manager}, I need mobile access to critical functions so I can work effectively from anywhere`,
        `As a ${personas.developer}, I need responsive design patterns that provide consistent experiences across platforms`
      )
    } else {
      // Generic but contextual stories based on idea content
      stories.push(
        `As a ${personas.user}, I need ${ideaContent.toLowerCase()} functionality that solves my core business needs effectively`,
        `As a ${personas.manager}, I need ${ideaContent.toLowerCase()} implementation that delivers measurable value to the organization`,
        `As a ${personas.stakeholder}, I need clear success metrics and progress tracking for ${ideaContent.toLowerCase()}`
      )
    }
    
    return stories
  }

  private static getPersonasForProjectType(projectType?: string): {[key: string]: string} {
    switch (projectType) {
      case 'software':
      case 'Technology/Software':
        return {
          user: 'end user',
          developer: 'software developer', 
          manager: 'product manager',
          admin: 'system administrator',
          analyst: 'data analyst',
          designer: 'UX designer',
          stakeholder: 'business stakeholder'
        }
      case 'marketing':
      case 'Marketing':
        return {
          user: 'customer',
          developer: 'marketing technologist',
          manager: 'marketing manager', 
          admin: 'campaign administrator',
          analyst: 'marketing analyst',
          designer: 'creative director',
          stakeholder: 'brand manager'
        }
      case 'business_plan':
      case 'Business Operations':
        return {
          user: 'employee',
          developer: 'process analyst',
          manager: 'operations manager',
          admin: 'business administrator', 
          analyst: 'business analyst',
          designer: 'process designer',
          stakeholder: 'executive sponsor'
        }
      default:
        return {
          user: 'user',
          developer: 'developer',
          manager: 'project manager',
          admin: 'administrator',
          analyst: 'analyst', 
          designer: 'designer',
          stakeholder: 'stakeholder'
        }
    }
  }

  private static getContextualStories(phase: number, epic: number, projectType?: string, ideaContent?: string, ideaDetails?: string): string[] {
    // If we have specific idea content, generate contextual user stories
    if (ideaContent) {
      return this.generateIdeaBasedUserStories(ideaContent, ideaDetails, projectType)
    }
    
    switch (projectType) {
      case 'product_development':
        if (phase === 1 && epic === 1) {
          return [
            "As a race car driver, I need a cockpit design that provides optimal visibility, ergonomic controls within reach, and crash protection that meets FIA safety standards",
            "As a design engineer, I need detailed aerodynamic specifications including downforce targets, drag coefficients, and airflow optimization for front/rear wing configurations",
            "As a manufacturing engineer, I need comprehensive technical drawings with material specifications, tolerances, and assembly procedures for chassis construction",
            "As a safety officer, I need designs that incorporate roll cage specifications, fire suppression systems, and crash energy absorption zones"
          ]
        }
        if (phase === 1 && epic === 2) {
          return [
            "As a test driver, I need a functional prototype with validated steering response, brake performance, and suspension tuning that allows safe track testing",
            "As a powertrain engineer, I need engine integration with validated power delivery, cooling systems, and exhaust routing that meets performance targets",
            "As a data analyst, I need telemetry systems that capture real-time performance metrics including speed, G-forces, engine parameters, and tire temperatures",
            "As a team principal, I need a prototype that demonstrates competitive lap times and reliability metrics for stakeholder validation"
          ]
        }
        if (phase === 2 && epic === 1) {
          return [
            "As a test engineer, I need comprehensive track testing data showing lap times, cornering speeds, and performance benchmarks against competitor vehicles",
            "As a safety inspector, I need crash test validation demonstrating compliance with racing safety standards and driver protection systems",
            "As a performance analyst, I need aerodynamic tunnel testing results with optimization recommendations for maximum downforce and minimum drag"
          ]
        }
        break
      case 'marketing':
        if (phase === 1 && epic === 1) {
          return [
            "As a market researcher, I need detailed competitor analysis including pricing strategies, feature comparisons, and market positioning gaps",
            "As a customer insights analyst, I need buyer personas based on demographic data, purchasing behavior, and motivation factors",
            "As a channel strategist, I need ROI analysis of digital vs traditional marketing channels with audience reach and conversion metrics"
          ]
        }
        break
      default:
        return [
          `As a domain expert, I need comprehensive requirements analysis that addresses specific ${projectType || 'project'} challenges and constraints`,
          `As a stakeholder, I need clear value delivery milestones with measurable business outcomes and success criteria`,
          `As an implementation team, I need detailed technical specifications with dependencies, risks, and resource requirements clearly defined`
        ]
    }
    return [
      "As a stakeholder, I need clear objectives with measurable success criteria",
      "As an implementation team, I need detailed technical requirements and constraints",
      "As a project manager, I need realistic timelines with dependency analysis"
    ]
  }

  private static getContextualDeliverables(phase: number, epic: number, projectType?: string): string[] {
    switch (projectType) {
      case 'product_development':
        if (phase === 1 && epic === 1) {
          return [
            "Complete technical specification document (200+ pages) including aerodynamics, chassis, powertrain, and safety systems",
            "3D CAD models with full assembly drawings and component specifications using SolidWorks/CATIA",
            "Material selection analysis with weight optimization, cost analysis, and supplier qualification matrix",
            "FIA safety compliance documentation including roll cage specifications, fire suppression, and crash structure design",
            "Aerodynamic analysis report with CFD modeling results and wind tunnel test plan",
            "Powertrain integration specifications including engine mounting, cooling, and exhaust routing"
          ]
        }
        if (phase === 1 && epic === 2) {
          return [
            "Alpha prototype chassis with validated structural integrity and safety systems integration",
            "Performance validation report with track testing data, lap times, and handling characteristics",
            "Telemetry system with real-time data acquisition for speed, G-forces, engine parameters, and tire temperatures",
            "Component stress testing results including suspension loads, brake performance, and powertrain durability",
            "Driver feedback analysis with ergonomic assessment and control system validation",
            "System integration validation covering electrical, hydraulic, and mechanical subsystems"
          ]
        }
        if (phase === 2 && epic === 1) {
          return [
            "Comprehensive track testing report with performance benchmarks vs competitor analysis",
            "Safety validation certification including crash test results and FIA compliance verification",
            "Aerodynamic optimization report with wind tunnel test data and on-track validation",
            "Reliability testing summary with failure analysis, MTBF calculations, and improvement recommendations"
          ]
        }
        break
      case 'marketing':
        if (phase === 1 && epic === 1) {
          return [
            "Comprehensive market analysis report (50+ pages) with competitor pricing, positioning, and SWOT analysis",
            "Detailed buyer personas with demographic analysis, purchasing behavior, and decision-making factors",
            "Multi-channel strategy document with ROI projections, audience reach analysis, and budget allocation",
            "Brand positioning framework with messaging hierarchy, value propositions, and differentiation strategy"
          ]
        }
        break
      case 'software':
        if (phase === 1 && epic === 1) {
          return [
            "System architecture documentation with scalability analysis and security framework",
            "API specification with endpoint documentation, authentication protocols, and rate limiting",
            "Database design with entity relationships, indexing strategy, and data migration plan",
            "Development environment setup with CI/CD pipeline, testing framework, and deployment automation"
          ]
        }
        break
      default:
        return [
          `Domain-specific technical specifications with detailed requirements and acceptance criteria`,
          `Comprehensive project documentation including architecture, design decisions, and implementation guides`,
          `Validation and testing results with performance metrics, quality assurance, and stakeholder sign-off`,
          `Risk assessment and mitigation plan with contingency strategies and resource optimization recommendations`
        ]
    }
    return [
      "Detailed technical specifications with measurable acceptance criteria",
      "Comprehensive validation documentation with test results and quality metrics", 
      "Stakeholder review and approval with change management procedures"
    ]
  }

  private static getContextualRisks(phase: number, projectType?: string): string[] {
    switch (projectType) {
      case 'product_development':
        if (phase === 1) {
          return [
            "Aerodynamic design complexity may require multiple CFD iterations affecting 4-week timeline extension risk",
            "Carbon fiber supply chain disruptions could impact chassis material costs by 25-40%",
            "FIA safety regulation changes mid-development requiring design modifications and re-certification",
            "Integration challenges between chassis, powertrain, and safety systems leading to prototype delays",
            "Supplier qualification delays for critical components (engine, transmission, electronics)",
            "Weight optimization vs. structural integrity trade-offs requiring extensive material testing"
          ]
        } else if (phase === 2) {
          return [
            "Track testing weather dependencies could compress validation timeline by 2-3 weeks",
            "Component failure during testing requiring redesign and manufacturing lead time delays",
            "Competitor benchmarking data unavailability limiting performance validation accuracy",
            "Manufacturing process scalability issues affecting transition from prototype to production",
            "Quality control system implementation challenges with measurement accuracy and repeatability"
          ]
        }
        return ["Design complexity exceeding timeline", "Material availability and cost", "Safety regulation compliance"]
      case 'marketing':
        return [
          "Market sentiment shifts due to economic conditions affecting target audience purchasing power",
          "Competitive product launches disrupting positioning strategy and requiring campaign pivots",
          "Creative asset approval bottlenecks with legal/compliance review extending timeline by 2-4 weeks",
          "Digital platform algorithm changes impacting organic reach and requiring budget reallocation",
          "Attribution modeling complexity affecting ROI measurement accuracy and optimization decisions"
        ]
      case 'research':
        return [
          "Participant recruitment challenges due to specific demographic requirements affecting sample size",
          "Data collection methodology limitations discovered during pilot testing requiring protocol revision",
          "Ethical review board feedback requiring significant protocol modifications and timeline extension",
          "Data quality issues requiring additional validation steps and statistical analysis complexity"
        ]
      default:
        return [
          "Technical complexity escalation requiring specialized expertise and extended development timeline",
          "Resource availability constraints during peak demand periods affecting critical path activities",
          "Stakeholder alignment challenges on requirements scope leading to scope creep and budget overruns",
          "Integration dependencies with external systems creating bottlenecks and coordination overhead"
        ]
    }
  }

  private static getContextualSuccessCriteria(phase: number, projectType?: string): string[] {
    switch (projectType) {
      case 'product_development':
        if (phase === 1) {
          return [
            "Complete design specifications approved by engineering review board with <5% requirement changes needed",
            "CAD models pass structural analysis with safety factor >1.5x and weight targets within 10% of specification",
            "Material selection validated with cost analysis showing <15% variance from budget allocation",
            "FIA safety compliance documentation complete with pre-approval from certification body",
            "Aerodynamic CFD analysis shows >90% correlation with target downforce and drag coefficients",
            "Prototype fabrication timeline confirmed with supplier commitments and quality agreements"
          ]
        } else if (phase === 2) {
          return [
            "Track testing demonstrates lap times within 2% of performance targets with consistent repeatability",
            "Safety validation passes all crash tests with driver safety metrics exceeding FIA minimums by 20%",
            "Aerodynamic performance validated with <5% variance between CFD predictions and wind tunnel results",
            "System reliability testing shows >95% uptime during 500+ hour validation protocol",
            "Manufacturing process qualification complete with capability studies showing Cpk >1.33"
          ]
        }
        return ["Design specifications approved", "Prototype meets performance targets", "Safety standards validated"]
      case 'marketing':
        return [
          "Market research validates target audience size >500K with purchasing intent >40% within price range",
          "Campaign creative assets achieve >85% approval rating in focus group testing with target demographics", 
          "Channel strategy validated with projected ROI >300% and customer acquisition cost <$150 per lead",
          "Brand positioning framework demonstrates >20% differentiation advantage over key competitors",
          "Launch readiness confirmed with all stakeholder approvals and budget allocation within 5% variance"
        ]
      case 'research':
        return [
          "Research methodology peer-reviewed with >90% approval from subject matter experts",
          "Data collection framework validates sample size adequacy with statistical power >80%",
          "Ethical approval obtained with <3 rounds of revision and full IRB committee endorsement",
          "Pilot study confirms data quality metrics with <10% missing data and >95% reliability coefficients"
        ]
      default:
        return [
          "Core project objectives achieved with measurable KPI targets met within 10% variance",
          "Quality standards validated through independent review with >95% compliance score",
          "Stakeholder satisfaction survey results show >85% approval with clear value delivery confirmation",
          "Project timeline maintained with <15% variance and all critical path milestones achieved"
        ]
    }
  }

  private static getSprintLength(projectType?: string): string {
    switch (projectType) {
      case 'software': return "2 weeks"
      case 'product_development': return "4 weeks"
      case 'business_plan': return "1 week"
      case 'marketing': return "2 weeks"
      case 'operations': return "3 weeks"
      case 'research': return "4 weeks"
      default: return "2 weeks"
    }
  }

  private static getTeamRecommendations(projectType?: string): string {
    switch (projectType) {
      case 'software': 
        return "Cross-functional team of 4-6 members: Product Manager, 2-3 Developers, Designer, QA Engineer"
      case 'product_development':
        return "Multidisciplinary team of 6-8 members: Project Manager, Design Engineers, CAD Specialist, Materials Engineer, Manufacturing Engineer, Test Engineer"
      case 'business_plan':
        return "Strategic team of 3-4 members: Business Analyst, Market Researcher, Financial Analyst, Strategy Consultant"
      case 'marketing':
        return "Creative team of 4-5 members: Marketing Manager, Creative Director, Content Creator, Data Analyst, Campaign Specialist"
      case 'operations':
        return "Process improvement team of 3-5 members: Operations Manager, Process Analyst, Change Management Specialist, Quality Engineer"
      case 'research':
        return "Research team of 4-6 members: Principal Researcher, Research Associates, Data Analyst, Subject Matter Expert, Research Coordinator"
      default:
        return "Cross-functional team of 4-6 members with relevant domain expertise"
    }
  }

  private static getContextualMilestones(projectType?: string): any[] {
    switch (projectType) {
      case 'product_development':
        return [
          {
            milestone: "Design Approval",
            timeline: "Week 8",
            description: "Final design specifications approved and ready for prototyping"
          },
          {
            milestone: "Prototype Complete",
            timeline: "Week 16",
            description: "Functional prototype built and tested"
          },
          {
            milestone: "Production Ready",
            timeline: "Week 24",
            description: "Manufacturing process validated and ready for production"
          }
        ]
      case 'marketing':
        return [
          {
            milestone: "Campaign Strategy Approval",
            timeline: "Week 6",
            description: "Campaign strategy and creative direction approved"
          },
          {
            milestone: "Campaign Launch",
            timeline: "Week 12",
            description: "Campaign launched across all channels"
          },
          {
            milestone: "Performance Review",
            timeline: "Week 18",
            description: "Campaign performance analyzed and optimizations implemented"
          }
        ]
      case 'research':
        return [
          {
            milestone: "Methodology Approval",
            timeline: "Week 8",
            description: "Research methodology validated and ethical approvals obtained"
          },
          {
            milestone: "Data Collection Complete",
            timeline: "Week 24",
            description: "All data collection activities completed"
          },
          {
            milestone: "Results Published",
            timeline: "Week 36",
            description: "Research findings analyzed and published"
          }
        ]
      default:
        return [
          {
            milestone: "MVP Release",
            timeline: "Week 6",
            description: "Minimum viable product with core functionality"
          },
          {
            milestone: "Feature Complete",
            timeline: "Week 10",
            description: "All planned features implemented and tested"
          },
          {
            milestone: "Production Ready",
            timeline: "Week 12",
            description: "Full solution ready for production deployment"
          }
        ]
    }
  }

  private static generateMockRoadmap(projectName: string, _projectDescription: string, ideas: any[], projectType?: string, _aiAnalysis?: any) {
    console.log('🗺️ Mock AI: Generating roadmap for project:', projectName)
    console.log('📋 Mock AI: Processing', ideas.length, 'ideas into user stories')
    console.log('💡 Mock AI: Available ideas:', ideas.map(i => `"${i.content}" (${i.priority})`).join(', '))
    
    // Group ideas by priority/complexity
    const highPriorityIdeas = ideas.filter(i => i.priority === 'high' || i.priority === 'strategic')
    const moderateIdeas = ideas.filter(i => i.priority === 'moderate')
    const lowPriorityIdeas = ideas.filter(i => i.priority === 'low' || i.priority === 'innovation')
    
    // Generate context-aware roadmap content
    // const epicTerm = this.getEpicTerminology(projectType)
    // const actionTerm = this.getProjectTerminology(projectType)
    const methodology = this.getProjectMethodology(projectType)
    
    return {
      roadmapAnalysis: {
        totalDuration: this.getProjectDuration(projectType),
        phases: [
          {
            phase: "Phase 1: Foundation & Quick Wins",
            duration: this.getPhaseDuration(1, projectType),
            description: this.getPhaseDescription(1, projectType),
            epics: [
              {
                title: highPriorityIdeas[0]?.content || this.getEpicTitle(1, 1, projectType),
                description: `Implementation of "${highPriorityIdeas[0]?.content || 'core functionality'}" - ${this.getEpicDescription(1, 1, projectType)}${highPriorityIdeas[0]?.details ? '. Details: ' + highPriorityIdeas[0].details : ''}`,
                userStories: this.getContextualStories(1, 1, projectType, highPriorityIdeas[0]?.content, highPriorityIdeas[0]?.details),
                deliverables: this.getContextualDeliverables(1, 1, projectType),
                priority: "High",
                complexity: "High",
                relatedIdeas: highPriorityIdeas.slice(0, 2).map(i => i.content)
              },
              {
                title: highPriorityIdeas[1]?.content || this.getEpicTitle(1, 2, projectType),
                description: `Development of "${highPriorityIdeas[1]?.content || 'secondary features'}" - ${this.getEpicDescription(1, 2, projectType)}${highPriorityIdeas[1]?.details ? '. Details: ' + highPriorityIdeas[1].details : ''}`,
                userStories: this.getContextualStories(1, 2, projectType, highPriorityIdeas[1]?.content, highPriorityIdeas[1]?.details),
                deliverables: this.getContextualDeliverables(1, 2, projectType),
                priority: "High", 
                complexity: "Medium",
                relatedIdeas: highPriorityIdeas.slice(2).map(i => i.content)
              }
            ],
            risks: this.getContextualRisks(1, projectType),
            successCriteria: this.getContextualSuccessCriteria(1, projectType)
          },
          {
            phase: "Phase 2: Enhancement & Integration",
            duration: this.getPhaseDuration(2, projectType),
            description: this.getPhaseDescription(2, projectType),
            epics: [
              {
                title: moderateIdeas[0]?.content || this.getEpicTitle(2, 1, projectType),
                description: `Enhancement and optimization of "${moderateIdeas[0]?.content || 'core systems'}" - ${this.getEpicDescription(2, 1, projectType)}${moderateIdeas[0]?.details ? '. Details: ' + moderateIdeas[0].details : ''}`,
                userStories: this.getContextualStories(2, 1, projectType, moderateIdeas[0]?.content, moderateIdeas[0]?.details),
                deliverables: this.getContextualDeliverables(2, 1, projectType),
                priority: "Medium",
                complexity: "Medium",
                relatedIdeas: moderateIdeas.map(i => i.content)
              }
            ],
            risks: this.getContextualRisks(2, projectType),
            successCriteria: this.getContextualSuccessCriteria(2, projectType)
          },
          {
            phase: "Phase 3: Innovation & Scale",
            duration: this.getPhaseDuration(3, projectType),
            description: this.getPhaseDescription(3, projectType),
            epics: [
              {
                title: lowPriorityIdeas[0]?.content || this.getEpicTitle(3, 1, projectType),
                description: `Future innovation with "${lowPriorityIdeas[0]?.content || 'advanced capabilities'}" - ${this.getEpicDescription(3, 1, projectType)}${lowPriorityIdeas[0]?.details ? '. Details: ' + lowPriorityIdeas[0].details : ''}`,
                userStories: this.getContextualStories(3, 1, projectType, lowPriorityIdeas[0]?.content, lowPriorityIdeas[0]?.details),
                deliverables: this.getContextualDeliverables(3, 1, projectType),
                priority: "Low",
                complexity: "High", 
                relatedIdeas: lowPriorityIdeas.map(i => i.content)
              }
            ],
            risks: this.getContextualRisks(3, projectType),
            successCriteria: this.getContextualSuccessCriteria(3, projectType)
          }
        ]
      },
      executionStrategy: {
        methodology: methodology,
        sprintLength: this.getSprintLength(projectType),
        teamRecommendations: this.getTeamRecommendations(projectType),
        keyMilestones: this.getContextualMilestones(projectType)
      }
    }
  }
}

// Environment-based configuration
const getAIConfig = (): AIServiceConfig => {
  // Check for environment variables (these would be set in your .env file)
  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY
  const anthropicKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  
  console.log('🔧 Environment variables check:', {
    hasOpenAI: !!openaiKey,
    hasAnthropic: !!anthropicKey,
    openAIKeyPreview: openaiKey ? `${openaiKey.substring(0, 7)}...` : 'none',
    availableEnvVars: Object.keys(import.meta.env).filter(key => key.startsWith('VITE_'))
  })
  
  if (openaiKey) {
    console.log('🎯 Selected OpenAI as AI provider')
    return {
      provider: 'openai',
      apiKey: openaiKey,
      model: 'gpt-4o-mini'
    }
  }
  
  if (anthropicKey) {
    console.log('🎯 Selected Anthropic as AI provider')
    return {
      provider: 'anthropic',
      apiKey: anthropicKey,
      model: 'claude-3-haiku-20240307'
    }
  }
  
  // Default to enhanced mock if no API keys
  console.log('🎯 No AI keys found, using enhanced mock AI')
  return { provider: 'mock' }
}

// Export configured AI service instance
export const aiService = new AIService(getAIConfig())
export { AIService, type AIIdeaResponse, type AIServiceConfig }
