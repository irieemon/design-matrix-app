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

  async generateIdea(title: string): Promise<AIIdeaResponse> {
    console.log(`🧠 Generating idea for: "${title}" using provider: ${this.config.provider}`)
    
    switch (this.config.provider) {
      case 'openai':
        console.log('📡 Attempting OpenAI generation...')
        return this.generateWithOpenAI(title)
      case 'anthropic':
        console.log('📡 Attempting Anthropic generation...')
        return this.generateWithAnthropic(title)
      case 'mock':
      default:
        console.log('🎭 Using mock AI generation...')
        return this.generateMockIdea(title)
    }
  }

  private async generateWithOpenAI(title: string): Promise<AIIdeaResponse> {
    console.log('🔑 Checking OpenAI API key...', { hasKey: !!this.config.apiKey })
    
    if (!this.config.apiKey) {
      console.warn('❌ OpenAI API key not configured, falling back to mock')
      return this.generateMockIdea(title)
    }

    console.log('✅ OpenAI API key found, making API request...')

    const prompt = `You are a business and technology strategy consultant helping to develop detailed project ideas. Given the brief title "${title}", build out details for the card in the lense of what this idea means and some key insights. Think of a mini use case with some business value drivers.
CRITICAL: Respond ONLY with valid JSON in this exact format (no markdown, no extra text):

{
  "content": "${title}",
  "details": "Write a detailed 100-150 word description including specific implementation approach, key features, business value, timeline, resources needed, and success metrics",
  "priority": "low|moderate|high|strategic|innovation"
}

Requirements:
- Keep the title exactly as provided
- Make details a single string (not an object)
- Priority must be one of: low, moderate, high, strategic, innovation
- Be specific and actionable, avoid generic statements
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

  private async generateWithAnthropic(title: string): Promise<AIIdeaResponse> {
    if (!this.config.apiKey) {
      console.warn('Anthropic API key not configured, falling back to mock')
      return this.generateMockIdea(title)
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
      return this.generateMockIdea(title)
    }
  }

  private generateMockIdea(title: string): AIIdeaResponse {
    console.log(`🎭 Generating mock AI idea for: "${title}"`)
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

    // Detect domain based on keywords
    const titleLower = title.toLowerCase()
    let selectedDomain = businessDomains.business // default
    
    for (const [, config] of Object.entries(businessDomains)) {
      if (config.keywords.some(keyword => titleLower.includes(keyword))) {
        selectedDomain = config
        break
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

    const result = {
      content: title,
      details: `${randomIdea.details} ${randomInsight}`,
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
