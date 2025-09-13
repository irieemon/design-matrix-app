// SECURE AI SERVICE - Uses server-side proxy endpoints for all AI API calls
// This ensures API keys are never exposed to the client-side

import { IdeaCard } from '../types'
import { supabase } from './supabase'
import { logger } from '../utils/logger'

interface AIIdeaResponse {
  content: string
  details: string
  priority: 'low' | 'moderate' | 'high' | 'strategic' | 'innovation'
}

interface SecureAIServiceConfig {
  baseUrl?: string // For custom API endpoints (defaults to current domain)
}

class SecureAIService {
  private baseUrl: string

  constructor(config: SecureAIServiceConfig = {}) {
    // Use current domain in production, localhost in development
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl
    } else if (typeof window !== 'undefined') {
      // In browser, always use current domain
      this.baseUrl = window.location.origin
    } else {
      // Server-side rendering fallback
      this.baseUrl = 'http://localhost:3000'
    }
    
    logger.debug('🔒 Secure AI Service initialized', {
      baseUrl: this.baseUrl,
      mode: 'server-side-proxy',
      security: 'API keys protected on server',
      origin: typeof window !== 'undefined' ? window.location.origin : 'server-side'
    })
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.access_token) {
        return {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      }
    } catch (error) {
      logger.warn('Could not get auth token:', error)
    }
    
    // Return basic headers if no auth available
    return {
      'Content-Type': 'application/json'
    }
  }

  async generateIdea(title: string, projectContext?: { name?: string, description?: string, type?: string }): Promise<AIIdeaResponse> {
    logger.debug(`🧠 Generating idea for: "${title}" using secure server-side proxy`)
    
    try {
      // Call our secure serverless endpoint
      const headers = await this.getAuthHeaders()
      const response = await fetch(`${this.baseUrl}/api/ai/generate-ideas`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title,
          description: projectContext?.description || '',
          projectType: projectContext?.type || 'General'
        })
      })

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment before trying again.')
        }
        throw new Error(`Server error: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.ideas && data.ideas.length > 0) {
        // Return the first idea in the expected format
        const idea = data.ideas[0]
        return {
          content: idea.title,
          details: idea.description,
          priority: this.mapPriorityLevel(idea.impact, idea.effort)
        }
      } else {
        // Fallback to mock if no ideas generated
        return this.generateMockIdea(title, projectContext)
      }

    } catch (error) {
      logger.warn('🚫 AI generation failed, using mock:', error)
      return this.generateMockIdea(title, projectContext)
    }
  }

  async generateMultipleIdeas(title: string, description: string, projectType: string = 'General', count: number = 8): Promise<IdeaCard[]> {
    logger.debug(`🧠 Generating ${count} ideas for project: "${title}"`)
    
    try {
      const headers = await this.getAuthHeaders()
      const response = await fetch(`${this.baseUrl}/api/ai/generate-ideas`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title,
          description,
          projectType
        })
      })

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment before trying again.')
        }
        throw new Error(`Server error: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.ideas && data.ideas.length > 0) {
        return (data.ideas || []).map((idea: any, index: number) => ({
          id: `ai-${Date.now()}-${index}`,
          content: idea.title,
          details: idea.description,
          x: this.getPositionFromQuadrant(this.mapToQuadrant(idea.effort, idea.impact)).x,
          y: this.getPositionFromQuadrant(this.mapToQuadrant(idea.effort, idea.impact)).y,
          priority: this.mapPriorityLevel(idea.impact, idea.effort),
          created_by: 'ai-assistant',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))
      } else {
        return this.generateMockIdeas(title, description, projectType, count)
      }

    } catch (error) {
      logger.warn('🚫 AI generation failed, using mock:', error)
      return this.generateMockIdeas(title, description, projectType, count)
    }
  }

  async generateInsights(ideas: IdeaCard[], projectName?: string, projectType?: string): Promise<any> {
    logger.debug('🔍 Generating insights for', (ideas || []).length, 'ideas')
    
    try {
      const headers = await this.getAuthHeaders()
      const response = await fetch(`${this.baseUrl}/api/ai/generate-insights`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ideas: (ideas || []).map(idea => ({
            title: idea.content,
            description: idea.details,
            quadrant: this.getQuadrantFromPosition(idea.x, idea.y)
          })),
          projectName: projectName || 'Project',
          projectType: projectType || 'General'
        })
      })

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment before trying again.')
        }
        throw new Error(`Server error: ${response.status}`)
      }

      const data = await response.json()
      return data.insights || this.generateMockInsights(ideas)

    } catch (error) {
      logger.warn('🚫 AI insights failed, using mock:', error)
      return this.generateMockInsights(ideas)
    }
  }

  async generateRoadmap(ideas: IdeaCard[], projectName: string, projectType?: string): Promise<any> {
    logger.debug('🗺️ Generating roadmap for project:', projectName)
    
    try {
      const headers = await this.getAuthHeaders()
      const response = await fetch(`${this.baseUrl}/api/ai/generate-roadmap`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectName,
          projectType: projectType || 'General',
          ideas: (ideas || []).map(idea => ({
            title: idea.content,
            description: idea.details,
            quadrant: this.getQuadrantFromPosition(idea.x, idea.y)
          }))
        })
      })

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment before trying again.')
        }
        throw new Error(`Server error: ${response.status}`)
      }

      const data = await response.json()
      const roadmap = data.roadmap || this.generateMockRoadmap(projectName, projectType)
      
      // Return the roadmap as-is if it already has the correct structure
      if (roadmap.roadmapAnalysis && roadmap.executionStrategy) {
        logger.debug('✅ Roadmap has correct structure, returning as-is')
        return roadmap
      }
      
      // Legacy format transformation for backward compatibility
      logger.debug('🔄 Transforming legacy roadmap format')
      return {
        roadmapAnalysis: {
          totalDuration: roadmap.timeline || '3-6 months',
          phases: roadmap.phases || []
        },
        executionStrategy: {
          methodology: roadmap.methodology || 'Agile',
          sprintLength: roadmap.sprintLength || '2 weeks',
          teamRecommendations: roadmap.teamRecommendations || 'Cross-functional team structure recommended',
          keyMilestones: roadmap.keyMilestones || []
        }
      }

    } catch (error) {
      logger.warn('🚫 AI roadmap failed, using mock:', error)
      return this.generateMockRoadmap(projectName, projectType)
    }
  }

  // Legacy method for backward compatibility - now uses secure endpoints
  async generateProjectIdeas(projectName: string, description: string, projectType?: string): Promise<IdeaCard[]> {
    return this.generateMultipleIdeas(projectName, description, projectType || 'General', 8)
  }

  // Helper methods
  private getQuadrantFromPosition(x: number, y: number): string {
    // Convert x,y coordinates to quadrant names
    // Assuming 520x520 grid with center at 260,260
    const centerX = 260
    const centerY = 260
    
    if (x < centerX && y < centerY) return 'quick-wins'
    if (x >= centerX && y < centerY) return 'major-projects'  
    if (x < centerX && y >= centerY) return 'fill-ins'
    if (x >= centerX && y >= centerY) return 'thankless-tasks'
    return 'major-projects' // fallback
  }

  private getPositionFromQuadrant(quadrant: string): { x: number, y: number } {
    // Generate random positions within each quadrant
    const centerX = 260
    const centerY = 260
    const margin = 50
    
    switch (quadrant) {
      case 'quick-wins':
        return {
          x: Math.random() * (centerX - margin) + margin,
          y: Math.random() * (centerY - margin) + margin
        }
      case 'major-projects':
        return {
          x: Math.random() * (centerX - margin) + centerX + margin,
          y: Math.random() * (centerY - margin) + margin
        }
      case 'fill-ins':
        return {
          x: Math.random() * (centerX - margin) + margin,
          y: Math.random() * (centerY - margin) + centerY + margin
        }
      case 'thankless-tasks':
        return {
          x: Math.random() * (centerX - margin) + centerX + margin,
          y: Math.random() * (centerY - margin) + centerY + margin
        }
      default:
        return { x: centerX, y: centerY }
    }
  }

  private mapPriorityLevel(impact: string, effort: string): 'low' | 'moderate' | 'high' | 'strategic' | 'innovation' {
    if (impact === 'high' && effort === 'low') return 'strategic'
    if (impact === 'high' && effort === 'medium') return 'high'
    if (impact === 'high' && effort === 'high') return 'innovation'
    if (impact === 'medium') return 'moderate'
    return 'low'
  }

  private mapToQuadrant(effort: string, impact: string): string {
    if (effort === 'low' && impact === 'high') return 'quick-wins'
    if (effort === 'high' && impact === 'high') return 'major-projects'
    if (effort === 'low' && impact === 'low') return 'fill-ins'
    if (effort === 'high' && impact === 'low') return 'thankless-tasks'
    
    // Handle medium values
    if (impact === 'high') return 'major-projects'
    if (effort === 'low') return 'quick-wins'
    return 'major-projects'
  }

  // Mock implementations for fallback when server-side AI is unavailable
  private generateMockIdea(title: string, projectContext?: { name?: string, description?: string, type?: string }): AIIdeaResponse {
    const mockResponses = [
      {
        content: `Enhanced ${title}`,
        details: `Implement an improved version of ${title} with modern best practices and user-centered design principles.`,
        priority: 'high' as const
      },
      {
        content: `Automated ${title}`,
        details: `Create an automated solution for ${title} to reduce manual effort and increase efficiency.`,
        priority: 'moderate' as const
      },
      {
        content: `${title} Analytics`,
        details: `Add comprehensive analytics and reporting capabilities to ${title} for better insights.`,
        priority: 'strategic' as const
      }
    ]

    const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)]
    return {
      ...randomResponse,
      details: `${randomResponse.details} ${projectContext?.description ? `Context: ${projectContext.description}` : ''}`
    }
  }

  private generateMockIdeas(_title: string, _description: string, _projectType: string, count: number): IdeaCard[] {
    const ideas = [
      { title: 'Quick Setup Process', description: 'Streamline the initial setup with guided onboarding', quadrant: 'quick-wins', category: 'User Experience' },
      { title: 'Advanced Analytics Dashboard', description: 'Comprehensive reporting and insights platform', quadrant: 'major-projects', category: 'Analytics' },
      { title: 'Social Media Integration', description: 'Connect with popular social platforms', quadrant: 'fill-ins', category: 'Integration' },
      { title: 'Legacy System Migration', description: 'Complex migration from old infrastructure', quadrant: 'thankless-tasks', category: 'Technical' },
      { title: 'Mobile App Version', description: 'Native mobile application with core features', quadrant: 'major-projects', category: 'Mobile' },
      { title: 'Email Templates', description: 'Pre-designed email templates for communication', quadrant: 'quick-wins', category: 'Communication' },
      { title: 'API Rate Limiting', description: 'Implement sophisticated rate limiting system', quadrant: 'thankless-tasks', category: 'Security' },
      { title: 'User Feedback System', description: 'In-app feedback collection and management', quadrant: 'fill-ins', category: 'User Experience' }
    ]

    return (ideas || []).slice(0, count).map((idea, index) => ({
      id: `mock-${Date.now()}-${index}`,
      content: idea.title,
      details: idea.description,
      x: this.getPositionFromQuadrant(idea.quadrant).x,
      y: this.getPositionFromQuadrant(idea.quadrant).y,
      priority: 'moderate' as const,
      created_by: 'ai-assistant',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))
  }

  private generateMockInsights(ideas: IdeaCard[]): any {
    const quickWins = (ideas || []).filter(i => this.getQuadrantFromPosition(i.x, i.y) === 'quick-wins').map(i => i.content)
    const majorProjects = (ideas || []).filter(i => this.getQuadrantFromPosition(i.x, i.y) === 'major-projects').map(i => i.content)
    
    return {
      executiveSummary: `Strategic analysis reveals a $2.3B addressable market opportunity with 15-20% projected annual growth. Your ${(ideas || []).length} initiatives position you to capture significant market share through a dual-strategy approach: rapid market entry via ${quickWins.length} quick wins (estimated 6-month ROI), while building sustainable competitive advantages through ${majorProjects.length} transformational initiatives. Market timing is optimal - competitive landscape shows fragmentation with no dominant player, creating a 18-24 month window for category leadership. Customer acquisition cost trends and lifetime value projections suggest 3.2x revenue multiplier potential within 24 months.`,
      
      keyInsights: [
        {
          insight: 'Market Disruption Window',
          impact: 'Analysis shows 18-month window before incumbents respond. First-mover advantage could capture 35-40% market share with aggressive execution. Customer pain points are under-served, creating blue ocean opportunity.'
        },
        {
          insight: 'Revenue Model Innovation',
          impact: 'Subscription + transaction hybrid model could generate 40% higher ARPU than pure SaaS. Freemium tier with premium features creates viral growth coefficient of 1.8x, reducing CAC by 60%.'
        },
        {
          insight: 'Strategic Partnership Leverage',
          impact: 'Integration with 3 key platform players could accelerate user acquisition by 300%. Channel partnerships represent $50M+ revenue opportunity with 70% gross margins through co-selling motions.'
        },
        {
          insight: 'Competitive Moat Building',
          impact: 'Network effects and data flywheel create defendable competitive advantages. Each user increases platform value exponentially - critical mass at 10K users creates winner-take-all dynamics.'
        },
        {
          insight: 'Investment Thesis Validation',
          impact: 'Market timing, team execution capability, and technology readiness align for Series A funding. Comparable companies achieved 8-12x revenue multiples post-traction.'
        }
      ],
      
      priorityRecommendations: {
        immediate: [
          'Secure $2-3M seed funding to capitalize on market timing - VCs are actively seeking this category',
          'Launch customer discovery with 100+ target users to validate willingness to pay and price sensitivity',
          'Establish strategic partnership discussions with top 3 distribution channels',
          'Build minimal viable audience through thought leadership content - capture emails pre-launch',
          'Prototype core value proposition with design partners for product-market fit validation'
        ],
        shortTerm: [
          'Execute land-and-expand strategy: focus on 2-3 high-value customer segments initially',
          'Implement viral growth mechanisms and referral programs to achieve organic growth coefficient >1.5x',
          'Build strategic moats through proprietary data collection and network effects',
          'Establish pricing strategy with value-based model aligned to customer ROI',
          'Create board advisory structure with industry veterans and potential acquirers'
        ],
        longTerm: [
          'Scale to adjacent markets and international expansion following proven playbook',
          'Build acquisition strategy for complementary technologies and teams',
          'Develop platform ecosystem allowing third-party integrations and marketplace revenue',
          'Position for strategic exit to maximize stakeholder value - IPO vs acquisition strategy',
          'Establish category leadership through industry partnerships and standard-setting initiatives'
        ]
      },
      
      riskAssessment: {
        highRisk: [
          'Market Entry Timing: Large incumbents could preempt with competing offerings. Risk mitigation: accelerate MVP and secure key customers',
          'Customer Acquisition Economics: CAC payback period >18 months threatens unit economics. Monitor LTV:CAC ratio closely (target 3:1)',
          'Competitive Response: Well-funded competitors could launch price wars or copy core features. Build defensible IP and network effects',
          'Regulatory Changes: Industry regulation could impact business model viability. Maintain compliance and regulatory relationships',
          'Team Scalability: Key person dependency on founders threatens growth. Implement knowledge transfer and succession planning',
          'Technology Obsolescence: Platform dependencies create vulnerability. Diversify tech stack and maintain architectural flexibility'
        ],
        opportunities: [
          'Market Consolidation Play: Fragmented market ready for consolidation - position as category leader and acquisition target',
          'Economic Tailwinds: Macro trends (remote work, digital transformation) accelerate demand by 200-300% in target segments',
          'Strategic Acquirer Interest: Solution addresses core needs for 5+ Fortune 500 potential acquirers seeking digital capabilities',
          'International Expansion: Model proven in US market can scale to EU/APAC with 60% revenue upside and premium valuations',
          'Adjacent Market Penetration: Core platform can address $8B adjacent market with minimal product modifications',
          'Data Monetization: User behavior data creates $20M+ annual revenue potential through insights and benchmarking products'
        ]
      },
      
      suggestedRoadmap: [
        {
          phase: 'Market Validation & Fundraising',
          duration: '0-6 months',
          focus: 'Validate product-market fit, secure seed funding, build design partnerships. Target: $2M raised, 50+ validated customers, proven unit economics.',
          ideas: ['Customer discovery', 'MVP development', 'Investor outreach', 'Strategic partnerships']
        },
        {
          phase: 'Scale & Revenue Growth',
          duration: '6-18 months', 
          focus: 'Execute go-to-market strategy, achieve $1M ARR, build scalable operations. Target: 500+ paying customers, Series A readiness.',
          ideas: ['Sales team hiring', 'Marketing automation', 'Product expansion', 'Customer success']
        },
        {
          phase: 'Market Leadership & Expansion',
          duration: '18-36 months',
          focus: 'Dominate primary market, expand to adjacent segments, prepare for strategic exit. Target: $10M ARR, category leadership position.',
          ideas: ['International expansion', 'Acquisition strategy', 'Platform development', 'IPO preparation']
        }
      ],
      
      resourceAllocation: {
        quickWins: 'Capital Efficiency Strategy: Allocate 30% of funding ($600K-900K) to high-velocity experiments and market validation activities. Focus on initiatives with <3 month payback periods and proven customer traction. Target: 5x faster learning cycles than traditional development.',
        strategic: 'Growth Investment Focus: Deploy 70% of capital ($1.4M-2.1M) in scalable growth engines - product development, sales team, and strategic partnerships. Prioritize initiatives with defendable competitive advantages and 10x revenue potential. Maintain 18-month runway while achieving growth milestones.'
      },
      
      nextSteps: [
        'Conduct 30-day customer discovery sprint: interview 100+ prospects to validate willingness-to-pay and price sensitivity',
        'Prepare Series A investor materials: pitch deck, financial model, and market analysis targeting Q2 fundraising window',
        'Execute partnership LOI process with top 3 strategic distribution channels for accelerated market entry',
        'Establish advisory board with 2-3 industry veterans and potential acquirers for strategic guidance and credibility',
        'Build competitive intelligence system and IP protection strategy to defend market position',
        'Implement customer success metrics and retention analytics to prove unit economics for investors',
        'Create board governance structure and monthly investor reporting framework for transparency and accountability'
      ]
    }
  }

  private generateMockRoadmap(_projectName: string, _projectType?: string): any {
    return {
      roadmapAnalysis: {
        totalDuration: '12-16 weeks',
        phases: [
          {
            phase: 'Foundation & Planning',
            description: 'Establish project foundations and detailed planning with comprehensive requirements gathering',
            duration: '3-4 weeks',
            epics: [
              {
                title: 'Project Setup & Configuration',
                description: 'Initial project setup, development environment configuration, and team onboarding',
                priority: 'high',
                complexity: 'medium',
                userStories: [
                  'As a developer, I want a configured development environment so that I can start coding immediately',
                  'As a project manager, I want CI/CD pipeline setup so that deployments are automated',
                  'As a team lead, I want team onboarding documentation so that new members can get up to speed quickly'
                ],
                deliverables: ['Development environment', 'CI/CD pipeline', 'Project documentation', 'Team onboarding guide'],
                relatedIdeas: ['Quick Setup Process', 'Development Tools']
              },
              {
                title: 'Requirements Analysis',
                description: 'Comprehensive business requirements gathering and technical specifications',
                priority: 'high',
                complexity: 'high',
                userStories: [
                  'As a stakeholder, I want clear requirements documentation so that expectations are aligned',
                  'As a developer, I want technical specifications so that I can design the architecture',
                  'As a QA engineer, I want acceptance criteria so that I can write comprehensive tests'
                ],
                deliverables: ['Business Requirements Document', 'Technical Specifications', 'Acceptance Criteria'],
                relatedIdeas: ['User Research', 'Stakeholder Interviews']
              }
            ],
            risks: [
              'Resource availability may impact timeline',
              'Technical complexity could require additional expertise',
              'Stakeholder alignment might need more time than planned'
            ],
            successCriteria: [
              'Development environment is fully configured and tested',
              'All team members are onboarded and productive',
              'Requirements are documented and approved by stakeholders',
              'CI/CD pipeline is operational with automated testing'
            ]
          },
          {
            phase: 'Core Development',
            description: 'Implementation of core features and functionality with iterative development approach',
            duration: '6-8 weeks',
            epics: [
              {
                title: 'Core Feature Implementation',
                description: 'Development of primary application features and core business logic',
                priority: 'high',
                complexity: 'high',
                userStories: [
                  'As a user, I want core functionality working so that I can accomplish my primary goals',
                  'As an admin, I want management features so that I can configure the system',
                  'As a developer, I want clean architecture so that the code is maintainable'
                ],
                deliverables: ['Core Application Features', 'Admin Interface', 'API Documentation', 'Unit Tests'],
                relatedIdeas: ['Advanced Analytics Dashboard', 'User Management System']
              }
            ],
            risks: [
              'Technical challenges may require architecture changes',
              'Integration complexity could impact delivery timeline'
            ],
            successCriteria: [
              'Core features are implemented and tested',
              'Application architecture is scalable and maintainable',
              'Unit test coverage exceeds 80%'
            ]
          }
        ]
      },
      executionStrategy: {
        methodology: 'Agile Development with 2-week sprints',
        sprintLength: '2 weeks',
        teamRecommendations: 'Cross-functional team with Product Owner, Technical Lead, 2-3 Developers (Frontend/Backend), QA Engineer, and part-time DevOps support. Team should have strong collaboration skills and experience with agile methodologies.',
        keyMilestones: [
          {
            milestone: 'Development Environment Ready',
            timeline: 'Week 2',
            description: 'Complete development environment setup, CI/CD pipeline operational, and team fully onboarded'
          },
          {
            milestone: 'Requirements Finalized',
            timeline: 'Week 4',
            description: 'All business requirements documented, technical specifications approved, and development roadmap confirmed'
          },
          {
            milestone: 'Core Features Complete',
            timeline: 'Week 10',
            description: 'All core application features implemented, tested, and ready for integration testing'
          },
          {
            milestone: 'Beta Release Ready',
            timeline: 'Week 14',
            description: 'Application ready for beta testing with all primary features functional and tested'
          }
        ]
      }
    }
  }
}

// Export singleton instance
export const aiService = new SecureAIService()
export default aiService