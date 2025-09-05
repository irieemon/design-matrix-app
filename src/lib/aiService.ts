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

  static async analyzeProjectAndGenerateIdeas(projectName: string, projectDescription: string, additionalContext?: string): Promise<any> {
    console.log('🔍 AIService: Analyzing project and generating ideas...', { projectName, projectDescription, additionalContext })

    // Enhanced project-aware prompt that creates contextually relevant ideas
    const prompt = `You are a strategic business consultant helping to set up a priority matrix for a new project.

PROJECT: "${projectName}"
DESCRIPTION: "${projectDescription}"
${additionalContext ? `ADDITIONAL CONTEXT: "${additionalContext}"` : ''}

Analyze this project and provide strategic guidance in JSON format. Generate 6-8 contextually relevant ideas based on the PROJECT TYPE and DESCRIPTION.

CRITICAL REQUIREMENTS:
- For marketing projects: Generate marketing-specific ideas (campaigns, content, SEO, social media, brand awareness, lead generation)
- For software projects: Generate tech-specific ideas (features, architecture, user experience, integrations, security, scalability)
- For business projects: Generate operations ideas (processes, efficiency, automation, training, analytics, quality)

DO NOT mix project types - a marketing campaign should NOT suggest VR applications or software architecture.

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
    "primaryGoals": ["goal1", "goal2"]
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
    // 6-8 ideas total, ALL relevant to project type
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
    
    const baseIdeas = {
      'Marketing': [
        { content: 'Social Media Campaign Launch', details: `Launch coordinated social media campaign across LinkedIn, Instagram, Twitter and TikTok for ${name}. Develop content calendar with daily posts, engagement strategy, influencer collaborations, and performance tracking. Focus on building brand awareness and driving qualified leads through targeted messaging and hashtag strategies.`, x: 120, y: 140, priority: 'high' as const },
        { content: 'Content Marketing Strategy', details: `Create comprehensive content marketing hub for ${name} including blog posts, case studies, whitepapers, and video content. Establish thought leadership through educational resources, improve SEO rankings, and generate inbound leads. Requires content team and editorial calendar with weekly publishing schedule.`, x: 200, y: 180, priority: 'strategic' as const },
        { content: 'Email Marketing Automation', details: `Set up automated email marketing system for ${name} with welcome sequences, nurture campaigns, and behavioral triggers. Include A/B testing for subject lines and content, segmentation based on user behavior, and integration with CRM. Expected to increase conversion rates by 25%.`, x: 140, y: 160, priority: 'moderate' as const },
        { content: 'Paid Advertising Campaigns', details: `Launch targeted paid advertising campaigns for ${name} across Google Ads, Facebook, LinkedIn, and relevant industry platforms. Create compelling ad copy, landing pages, and conversion tracking. Focus on high-intent keywords and lookalike audiences for maximum ROI.`, x: 160, y: 200, priority: 'high' as const },
        { content: 'Influencer Partnership Program', details: `Develop influencer partnership program for ${name} by identifying and collaborating with industry thought leaders and micro-influencers. Create partnership agreements, content guidelines, and performance metrics. Focus on authentic endorsements and co-created content for expanded reach.`, x: 280, y: 240, priority: 'moderate' as const },
        { content: 'SEO & Organic Growth', details: `Implement comprehensive SEO strategy for ${name} including keyword research, on-page optimization, technical SEO improvements, and link building campaigns. Create pillar content and topic clusters to dominate search results for relevant industry terms and drive organic traffic.`, x: 220, y: 220, priority: 'strategic' as const },
        { content: 'Brand Identity Refresh', details: `Modernize brand identity for ${name} including logo redesign, color palette update, typography selection, and brand guideline documentation. Ensure consistency across all marketing materials and touchpoints. Requires design team and stakeholder approval process.`, x: 300, y: 280, priority: 'moderate' as const },
        { content: 'Quick Win PR Outreach', details: `Execute immediate PR outreach for ${name} by compiling targeted media lists and sending press releases to relevant publications. Focus on low-hanging fruit with existing industry contacts, local media, and trade publications for quick visibility wins.`, x: 80, y: 120, priority: 'low' as const }
      ],
      'Technology/Software': [
        { content: 'User Authentication System', details: `Implement secure user authentication system for ${name} with OAuth integration, multi-factor authentication, password recovery, and session management. Essential security foundation that enables user personalization, data protection, and compliance with privacy regulations. Estimated 2-3 weeks development time.`, x: 150, y: 160, priority: 'high' as const },
        { content: 'Core Feature MVP', details: `Build minimum viable product version of ${name} focusing on the essential user journey and primary value proposition. Include basic feature set needed to validate concept with early users and gather feedback for iterations. Foundation for all future development efforts.`, x: 200, y: 120, priority: 'strategic' as const },
        { content: 'Analytics & Monitoring Dashboard', details: `Create comprehensive analytics dashboard for ${name} to monitor user behavior, feature usage, system performance, and business metrics. Include real-time data visualization, custom reports, alerting system, and integration with popular analytics tools like Google Analytics.`, x: 320, y: 200, priority: 'moderate' as const },
        { content: 'Mobile-First Optimization', details: `Ensure ${name} delivers excellent mobile experience with responsive design, touch-optimized interactions, fast loading times, and mobile-specific features. Implement progressive web app capabilities and offline functionality for improved user engagement and retention.`, x: 180, y: 240, priority: 'moderate' as const },
        { content: 'AI/ML Integration', details: `Integrate advanced AI and machine learning capabilities into ${name} for personalization, intelligent recommendations, predictive analytics, or automation features. Requires research phase, model training, and significant computational resources but offers competitive differentiation.`, x: 380, y: 320, priority: 'innovation' as const },
        { content: 'User Onboarding Experience', details: `Design intuitive onboarding flow for ${name} with guided tutorials, interactive tooltips, progress indicators, and contextual help. Reduce time-to-value for new users and improve activation rates through strategic feature introduction and engagement hooks.`, x: 120, y: 140, priority: 'high' as const },
        { content: 'API & Integration Layer', details: `Develop robust API infrastructure for ${name} enabling third-party integrations, webhooks, and ecosystem expansion. Include comprehensive documentation, rate limiting, authentication, and SDKs for popular programming languages. Supports partnerships and enterprise adoption.`, x: 340, y: 260, priority: 'strategic' as const },
        { content: 'Performance Optimization', details: `Implement comprehensive performance optimization for ${name} including code splitting, lazy loading, caching strategies, CDN integration, and database query optimization. Target sub-2-second page load times and improved Core Web Vitals scores for better user experience and SEO.`, x: 180, y: 280, priority: 'moderate' as const }
      ],
      'Business Operations': [
        { content: 'Process Documentation & SOPs', details: `Create comprehensive documentation for ${name} including standard operating procedures, workflow diagrams, quality control checkpoints, and compliance guidelines. Establish foundation for training, consistency, and continuous improvement initiatives across all team members.`, x: 120, y: 160, priority: 'moderate' as const },
        { content: 'Workflow Automation System', details: `Implement automation tools for ${name} to eliminate repetitive manual tasks and streamline operations. Focus on high-volume, rule-based processes like data entry, approvals, notifications, and reporting. Expected to reduce processing time by 40% and minimize human errors.`, x: 200, y: 200, priority: 'strategic' as const },
        { content: 'Team Training & Development Program', details: `Develop comprehensive training program for ${name} including skills assessment, learning paths, certification components, and progress tracking. Create onboarding materials for new hires and continuous education for existing team members to improve productivity and job satisfaction.`, x: 240, y: 180, priority: 'moderate' as const },
        { content: 'Quick Efficiency Improvements', details: `Implement immediate process improvements for ${name} that require minimal investment: eliminate redundant steps, streamline communication flows, organize digital workspaces, and establish daily standups. Focus on low-hanging fruit for instant productivity gains.`, x: 80, y: 120, priority: 'low' as const },
        { content: 'Business Intelligence Platform', details: `Deploy comprehensive business intelligence solution for ${name} with automated reporting, trend analysis, predictive analytics, and executive dashboards. Enable data-driven decision making across all departments with real-time insights and customizable KPI tracking.`, x: 340, y: 280, priority: 'strategic' as const },
        { content: 'Quality Management Framework', details: `Establish quality control processes for ${name} including error tracking, root cause analysis, continuous improvement methodology, and customer feedback integration. Requires cultural change management and ongoing commitment but ensures consistent service delivery.`, x: 300, y: 300, priority: 'high' as const },
        { content: 'Digital Transformation Initiative', details: `Lead digital transformation for ${name} by modernizing legacy systems, implementing cloud infrastructure, and adopting digital-first processes. Includes change management, staff training, and phased rollout strategy. High impact but requires significant investment and leadership commitment.`, x: 380, y: 340, priority: 'strategic' as const },
        { content: 'Customer Service Optimization', details: `Optimize customer service operations for ${name} with helpdesk software, chatbot implementation, knowledge base creation, and response time improvements. Include customer satisfaction tracking and agent performance metrics to deliver exceptional support experience.`, x: 160, y: 200, priority: 'moderate' as const }
      ],
      'Product Development': [
        { content: 'Market Research & Validation', details: `Conduct comprehensive market research for ${name} including competitor analysis, customer interviews, surveys, and focus groups. Validate product-market fit, identify target segments, and gather requirements for MVP development. Critical foundation for all product decisions.`, x: 140, y: 160, priority: 'high' as const },
        { content: 'Product MVP Development', details: `Build minimum viable product for ${name} focusing on core value proposition and essential features. Use agile development methodology with 2-week sprints, user story mapping, and continuous stakeholder feedback. Target 3-month timeline for first release.`, x: 200, y: 140, priority: 'strategic' as const },
        { content: 'User Experience Design', details: `Create comprehensive UX/UI design system for ${name} including user personas, journey mapping, wireframes, prototypes, and usability testing. Ensure intuitive navigation, accessibility compliance, and consistent brand experience across all touchpoints.`, x: 180, y: 180, priority: 'high' as const },
        { content: 'Product Analytics Setup', details: `Implement product analytics infrastructure for ${name} with event tracking, funnel analysis, cohort studies, and A/B testing capabilities. Enable data-driven product decisions through user behavior insights, feature adoption metrics, and retention analysis.`, x: 280, y: 220, priority: 'moderate' as const },
        { content: 'Go-to-Market Strategy', details: `Develop comprehensive go-to-market plan for ${name} including pricing strategy, channel partnerships, launch timeline, marketing campaigns, and sales enablement. Create positioning documents and competitive differentiation messaging for successful market entry.`, x: 320, y: 200, priority: 'strategic' as const },
        { content: 'Beta Testing Program', details: `Launch beta testing program for ${name} with selected early adopters and power users. Create feedback collection systems, bug reporting processes, and feature request tracking. Use insights to refine product before public launch and build community of advocates.`, x: 160, y: 200, priority: 'moderate' as const },
        { content: 'Advanced Feature Roadmap', details: `Define advanced feature roadmap for ${name} based on user research, market trends, and strategic objectives. Prioritize features using scoring frameworks, resource allocation planning, and timeline estimation. Balance innovation with technical debt and maintenance requirements.`, x: 360, y: 280, priority: 'strategic' as const },
        { content: 'Quality Assurance Framework', details: `Establish comprehensive QA processes for ${name} including automated testing, manual test scripts, performance benchmarks, and security audits. Implement continuous integration pipelines and quality gates to ensure reliable product releases and customer satisfaction.`, x: 240, y: 260, priority: 'moderate' as const }
      ],
      'General Business': [
        { content: 'Strategic Planning & Goal Setting', details: `Develop comprehensive strategic plan for ${name} including vision statement, SMART goals, success metrics, and quarterly milestones. Conduct SWOT analysis, competitive landscape review, and resource allocation planning to ensure focused execution and measurable results.`, x: 180, y: 160, priority: 'strategic' as const },
        { content: 'Market Analysis & Competitive Intelligence', details: `Conduct thorough market analysis for ${name} including industry trends, competitor positioning, pricing strategies, and customer segments. Create competitive intelligence system with regular updates and actionable insights for strategic decision making.`, x: 220, y: 180, priority: 'moderate' as const },
        { content: 'Financial Planning & Budgeting', details: `Establish comprehensive financial planning system for ${name} with detailed budgets, cash flow projections, ROI calculations, and financial controls. Include monthly reporting, variance analysis, and scenario planning for different growth trajectories.`, x: 260, y: 200, priority: 'high' as const },
        { content: 'Team Building & Organization', details: `Design optimal organizational structure for ${name} including role definitions, reporting relationships, communication protocols, and performance management systems. Focus on talent acquisition, skills development, and culture building for sustainable growth.`, x: 200, y: 220, priority: 'moderate' as const },
        { content: 'Partnership Development', details: `Identify and develop strategic partnerships for ${name} including vendor relationships, distribution channels, technology integrations, and joint ventures. Create partnership criteria, negotiation strategies, and ongoing management processes to accelerate growth.`, x: 300, y: 240, priority: 'strategic' as const },
        { content: 'Risk Management & Compliance', details: `Implement comprehensive risk management framework for ${name} including risk assessment, mitigation strategies, insurance coverage, and compliance monitoring. Address operational, financial, legal, and reputational risks with appropriate controls and procedures.`, x: 340, y: 280, priority: 'high' as const },
        { content: 'Quick Wins & Early Momentum', details: `Identify and execute quick wins for ${name} that require minimal investment but deliver immediate value. Focus on process improvements, communication enhancements, and resource optimization that can be implemented within 30 days to build momentum.`, x: 100, y: 140, priority: 'low' as const },
        { content: 'Innovation & Future Planning', details: `Establish innovation pipeline for ${name} with trend monitoring, idea generation processes, experimentation frameworks, and future opportunity assessment. Allocate resources for R&D activities and emerging technology evaluation to maintain competitive advantage.`, x: 380, y: 320, priority: 'innovation' as const }
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
    
    console.log('📋 Mock AI: Selected idea set:', typeKey, 'with', (baseIdeas as any)[typeKey]?.length || 0, 'ideas')
    return (baseIdeas as any)[typeKey] || (baseIdeas as any)['General Business']
  }

  static async generateRoadmap(projectName: string, projectDescription: string, ideas: any[]): Promise<any> {
    const config = getAIConfig()
    
    if (config.provider === 'openai' && config.apiKey) {
      // Real OpenAI implementation
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
                content: `You are a strategic product manager and roadmap expert. Create a comprehensive project roadmap that converts priority matrix ideas into actionable user stories and deliverables.
                
                CRITICAL REQUIREMENTS:
                1. Analyze the provided ideas and group them into logical Epic-level user stories
                2. Create a timeline with phases (Phase 1, Phase 2, etc.)
                3. Each phase should have clear deliverables and success criteria
                4. Consider dependencies between ideas and logical implementation order
                5. Provide realistic time estimates based on complexity
                6. Include risk assessment and mitigation strategies
                
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
                content: `Project: ${projectName}
                Description: ${projectDescription}
                
                Ideas to convert into roadmap:
                ${ideas.map(idea => `- ${idea.content}: ${idea.details} (Priority: ${idea.priority})`).join('\n')}
                
                Generate a comprehensive project roadmap with user stories and deliverables.`
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
        const content = data.choices[0]?.message?.content

        if (!content) {
          throw new Error('No content received from OpenAI')
        }

        return JSON.parse(content)
      } catch (error) {
        console.error('OpenAI Roadmap Generation Error:', error)
        // Fall back to mock
        return this.generateMockRoadmap(projectName, projectDescription, ideas)
      }
    } else {
      // Mock implementation
      return this.generateMockRoadmap(projectName, projectDescription, ideas)
    }
  }

  private static generateMockRoadmap(projectName: string, _projectDescription: string, ideas: any[]) {
    console.log('🗺️ Mock AI: Generating roadmap for project:', projectName)
    console.log('📋 Mock AI: Processing', ideas.length, 'ideas into user stories')
    
    // Group ideas by priority/complexity
    const highPriorityIdeas = ideas.filter(i => i.priority === 'high' || i.priority === 'strategic')
    const moderateIdeas = ideas.filter(i => i.priority === 'moderate')
    const lowPriorityIdeas = ideas.filter(i => i.priority === 'low' || i.priority === 'innovation')
    
    return {
      roadmapAnalysis: {
        totalDuration: "3-4 months",
        phases: [
          {
            phase: "Phase 1: Foundation & Quick Wins",
            duration: "4-6 weeks",
            description: "Establish core functionality and deliver immediate value",
            epics: [
              {
                title: "Core Platform Setup",
                description: "Establish the foundational systems and architecture",
                userStories: [
                  "As a user, I can access the platform securely",
                  "As an admin, I can configure basic settings",
                  "As a user, I can navigate the main interface"
                ],
                deliverables: ["Authentication system", "Basic UI framework", "Core navigation"],
                priority: "High",
                complexity: "High",
                relatedIdeas: highPriorityIdeas.slice(0, 2).map(i => i.content)
              },
              {
                title: "Essential Features",
                description: "Implement the most critical user-facing features",
                userStories: [
                  "As a user, I can perform primary actions",
                  "As a user, I can view essential information",
                  "As a user, I can save my progress"
                ],
                deliverables: ["Primary feature set", "Data persistence", "User feedback system"],
                priority: "High", 
                complexity: "Medium",
                relatedIdeas: highPriorityIdeas.slice(2).map(i => i.content)
              }
            ],
            risks: ["Technical complexity", "Resource availability", "Integration challenges"],
            successCriteria: ["Core functionality working", "User can complete primary workflow", "System stability achieved"]
          },
          {
            phase: "Phase 2: Enhancement & Integration",
            duration: "4-5 weeks", 
            description: "Expand functionality and improve user experience",
            epics: [
              {
                title: "Advanced Features",
                description: "Add sophisticated capabilities and integrations",
                userStories: [
                  "As a user, I can access advanced tools",
                  "As a user, I can integrate with external systems",
                  "As a user, I can customize my experience"
                ],
                deliverables: ["Advanced feature set", "Third-party integrations", "Customization options"],
                priority: "Medium",
                complexity: "Medium",
                relatedIdeas: moderateIdeas.map(i => i.content)
              }
            ],
            risks: ["Integration complexity", "Performance issues", "User adoption"],
            successCriteria: ["All moderate priority features implemented", "Performance benchmarks met", "User satisfaction targets achieved"]
          },
          {
            phase: "Phase 3: Innovation & Scale",
            duration: "3-4 weeks",
            description: "Implement innovative features and prepare for scale",
            epics: [
              {
                title: "Innovation Features",
                description: "Cutting-edge capabilities and future-ready enhancements",
                userStories: [
                  "As a power user, I can leverage advanced analytics",
                  "As an organization, I can scale the solution",
                  "As a user, I can access innovative tools"
                ],
                deliverables: ["Innovation features", "Analytics dashboard", "Scalability improvements"],
                priority: "Low",
                complexity: "High", 
                relatedIdeas: lowPriorityIdeas.map(i => i.content)
              }
            ],
            risks: ["Technology adoption", "Market readiness", "Resource constraints"],
            successCriteria: ["Innovation features delivered", "System can handle scale", "Future roadmap defined"]
          }
        ]
      },
      executionStrategy: {
        methodology: "Agile/Scrum",
        sprintLength: "2 weeks",
        teamRecommendations: "Cross-functional team of 4-6 members: Product Manager, 2-3 Developers, Designer, QA Engineer",
        keyMilestones: [
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
