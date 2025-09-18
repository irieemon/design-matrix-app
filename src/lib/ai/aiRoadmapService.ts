import { IdeaCard } from '../../types'
import { logger } from '../../utils/logger'
import { aiCache, AICache } from '../aiCache'

interface RoadmapEpic {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  complexity: 'low' | 'medium' | 'high'
  userStories: string[]
  deliverables: string[]
  relatedIdeas: string[]
}

interface RoadmapPhase {
  phase: string
  description: string
  duration: string
  epics: RoadmapEpic[]
}

interface RoadmapAnalysis {
  totalDuration: string
  phases: RoadmapPhase[]
}

interface ExecutionStrategy {
  methodology: string
  sprintLength: string
  teamRecommendations: string
  keyMilestones: string[]
}

interface RoadmapResponse {
  roadmapAnalysis: RoadmapAnalysis
  executionStrategy: ExecutionStrategy
}

interface RoadmapRequest {
  projectName: string
  projectType: string
  ideas: Array<{
    title: string
    description: string
    quadrant: string
  }>
}

interface SecureAIServiceConfig {
  baseUrl?: string
}

/**
 * AI Roadmap Generation Service
 *
 * Handles AI-powered roadmap generation, project planning,
 * and strategic timeline development based on project ideas.
 */
export class AIRoadmapService {
  private baseUrl: string

  constructor(config: SecureAIServiceConfig = {}) {
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl
    } else if (typeof window !== 'undefined') {
      this.baseUrl = window.location.origin
    } else {
      this.baseUrl = 'http://localhost:3000'
    }

    logger.debug('🗺️ AI Roadmap Service initialized', { baseUrl: this.baseUrl })
  }

  /**
   * Get authentication headers for API calls
   */
  private async getAuthHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    try {
      // In a real implementation, get actual auth token
      headers['Authorization'] = 'Bearer placeholder-token'
    } catch (error) {
      logger.warn('Failed to get auth headers:', error)
    }

    return headers
  }

  /**
   * Generate comprehensive AI roadmap for project ideas
   */
  async generateRoadmap(
    ideas: IdeaCard[],
    projectName: string,
    projectType?: string
  ): Promise<RoadmapResponse> {
    logger.debug('🗺️ Generating roadmap for project:', projectName)

    // Create cache key from core parameters
    const ideaSignature = (ideas || []).map(idea => ({
      content: idea.content,
      x: Math.round(idea.x / 10) * 10,
      y: Math.round(idea.y / 10) * 10
    }))

    const cacheKey = AICache.generateKey('generateRoadmap', {
      ideas: ideaSignature,
      projectName: projectName || 'Project',
      projectType: projectType || 'General'
    })

    return aiCache.getOrSet(cacheKey, async () => {
      try {
        const requestPayload: RoadmapRequest = {
          projectName,
          projectType: projectType || 'General',
          ideas: (ideas || []).map(idea => ({
            title: idea.content,
            description: idea.details,
            quadrant: this.getQuadrantFromPosition(idea.x, idea.y)
          }))
        }

        logger.debug('🚀 Sending roadmap generation request:', {
          projectName: requestPayload.projectName,
          projectType: requestPayload.projectType,
          ideaCount: requestPayload.ideas.length,
          ideas: requestPayload.ideas.map(idea => ({ title: idea.title, quadrant: idea.quadrant }))
        })

        const headers = await this.getAuthHeaders()
        const response = await fetch(`${this.baseUrl}/api/ai/generate-roadmap-v2`, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestPayload)
        })

        if (!response.ok) {
          if (response.status === 429) {
            throw new Error('Rate limit exceeded. Please wait a moment before trying again.')
          }
          throw new Error(`Server error: ${response.status}`)
        }

        const data = await response.json()
        const roadmap = data.roadmap || this.generateMockRoadmap(projectName, projectType)

        // Return roadmap if it has correct structure
        if (roadmap.roadmapAnalysis && roadmap.executionStrategy) {
          logger.debug('✅ Roadmap has correct structure, returning as-is')
          return roadmap
        }

        // Transform legacy format for backward compatibility
        logger.debug('🔄 Transforming legacy roadmap format')
        return this.transformLegacyRoadmap(roadmap)

      } catch (error) {
        logger.warn('🚫 AI roadmap failed, using mock:', error)
        logger.debug('Roadmap API error details:', {
          projectName,
          projectType,
          ideaCount: (ideas || []).length,
          error: error instanceof Error ? error.message : String(error)
        })
        return this.generateMockRoadmap(projectName, projectType)
      }
    }, 25 * 60 * 1000) // 25 minute cache for roadmaps
  }

  /**
   * Generate enhanced roadmap with project context
   */
  async generateEnhancedRoadmap(
    ideas: IdeaCard[],
    projectName: string,
    projectType?: string,
    projectContext?: {
      budget?: number
      teamSize?: number
      timeline?: string
      priority?: string
    }
  ): Promise<RoadmapResponse> {
    logger.debug('🗺️ Generating enhanced roadmap with context for:', projectName)

    // Use base roadmap generation but with enhanced context
    const baseRoadmap = await this.generateRoadmap(ideas, projectName, projectType)

    // Enhance roadmap with project context
    if (projectContext) {
      return this.enhanceRoadmapWithContext(baseRoadmap, projectContext)
    }

    return baseRoadmap
  }

  /**
   * Get quadrant name from position coordinates
   */
  private getQuadrantFromPosition(x: number, y: number): string {
    const centerX = 260
    const centerY = 260

    if (x < centerX && y < centerY) return 'quick-wins'
    if (x >= centerX && y < centerY) return 'major-projects'
    if (x < centerX && y >= centerY) return 'fill-ins'
    if (x >= centerX && y >= centerY) return 'thankless-tasks'
    return 'major-projects' // fallback
  }

  /**
   * Transform legacy roadmap format to new structure
   */
  private transformLegacyRoadmap(roadmap: any): RoadmapResponse {
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
  }

  /**
   * Enhance roadmap with project context
   */
  private enhanceRoadmapWithContext(
    baseRoadmap: RoadmapResponse,
    context: {
      budget?: number
      teamSize?: number
      timeline?: string
      priority?: string
    }
  ): RoadmapResponse {
    const enhanced = { ...baseRoadmap }

    // Adjust timeline based on team size
    if (context.teamSize) {
      if (context.teamSize < 3) {
        enhanced.roadmapAnalysis.totalDuration = '16-24 weeks'
      } else if (context.teamSize > 8) {
        enhanced.roadmapAnalysis.totalDuration = '8-12 weeks'
      }
    }

    // Adjust methodology based on team size and priority
    if (context.teamSize && context.teamSize < 5) {
      enhanced.executionStrategy.methodology = 'Lean Startup'
      enhanced.executionStrategy.sprintLength = '1 week'
    } else if (context.priority === 'high') {
      enhanced.executionStrategy.methodology = 'Scrumban'
      enhanced.executionStrategy.sprintLength = '1 week'
    }

    // Add budget considerations to team recommendations
    if (context.budget) {
      const budgetTier = context.budget < 100000 ? 'startup' :
                        context.budget < 500000 ? 'mid-market' : 'enterprise'

      enhanced.executionStrategy.teamRecommendations += ` Optimized for ${budgetTier} budget constraints.`
    }

    return enhanced
  }

  /**
   * Generate comprehensive mock roadmap when AI service is unavailable
   */
  private generateMockRoadmap(projectName: string, projectType?: string): RoadmapResponse {
    const type = projectType?.toLowerCase() || 'general'

    // Customize roadmap based on project type
    let phases: RoadmapPhase[] = []
    let totalDuration = '12-16 weeks'
    let methodology = 'Agile'

    if (type.includes('software') || type.includes('app') || type.includes('web')) {
      phases = this.generateSoftwareProjectPhases(projectName)
      totalDuration = '14-18 weeks'
      methodology = 'Scrum'
    } else if (type.includes('marketing') || type.includes('campaign')) {
      phases = this.generateMarketingProjectPhases(projectName)
      totalDuration = '8-12 weeks'
      methodology = 'Kanban'
    } else if (type.includes('research') || type.includes('analysis')) {
      phases = this.generateResearchProjectPhases(projectName)
      totalDuration = '10-14 weeks'
      methodology = 'Lean'
    } else {
      phases = this.generateGenericProjectPhases(projectName)
    }

    return {
      roadmapAnalysis: {
        totalDuration,
        phases
      },
      executionStrategy: {
        methodology,
        sprintLength: '2 weeks',
        teamRecommendations: `Cross-functional team structure recommended for ${projectName}. Include Product Owner, Technical Lead, 2-3 Developers, QA Engineer, and part-time DevOps support. Team should have strong collaboration skills and experience with ${methodology.toLowerCase()} methodologies.`,
        keyMilestones: [
          'Project kickoff and team onboarding',
          'Requirements validation and design approval',
          'Core functionality implementation',
          'Beta testing and user feedback integration',
          'Production deployment and monitoring setup'
        ]
      }
    }
  }

  /**
   * Generate software project phases
   */
  private generateSoftwareProjectPhases(projectName: string): RoadmapPhase[] {
    return [
      {
        phase: 'Foundation & Planning',
        description: 'Establish project foundations and detailed planning',
        duration: '3-4 weeks',
        epics: [
          {
            title: 'Project Setup & Configuration',
            description: 'Initial project setup and development environment',
            priority: 'high',
            complexity: 'medium',
            userStories: [
              'As a developer, I want a configured development environment',
              'As a project manager, I want CI/CD pipeline setup',
              'As a team lead, I want team onboarding documentation'
            ],
            deliverables: ['Development environment', 'CI/CD pipeline', 'Project documentation'],
            relatedIdeas: ['Quick Setup Process', 'Development Tools']
          },
          {
            title: 'Technical Architecture',
            description: 'Design system architecture and technical specifications',
            priority: 'high',
            complexity: 'high',
            userStories: [
              'As a developer, I want clear technical architecture',
              'As a stakeholder, I want scalable system design'
            ],
            deliverables: ['Architecture documentation', 'Technical specifications', 'Database design'],
            relatedIdeas: ['System Design', 'Scalability']
          }
        ]
      },
      {
        phase: 'Core Development',
        description: 'Implementation of core features and functionality',
        duration: '6-8 weeks',
        epics: [
          {
            title: 'User Authentication System',
            description: 'Secure user management and authentication',
            priority: 'high',
            complexity: 'medium',
            userStories: [
              'As a user, I want to register an account',
              'As a user, I want to login securely',
              'As an admin, I want to manage user permissions'
            ],
            deliverables: ['User registration', 'Login system', 'Role management'],
            relatedIdeas: ['User Management', 'Security']
          },
          {
            title: 'Core Application Features',
            description: `Primary functionality for ${projectName}`,
            priority: 'high',
            complexity: 'high',
            userStories: [
              'As a user, I want core functionality working',
              'As a user, I want intuitive user interface'
            ],
            deliverables: ['Core features', 'User interface', 'Data management'],
            relatedIdeas: ['Primary Features', 'User Experience']
          }
        ]
      },
      {
        phase: 'Testing & Optimization',
        description: 'Quality assurance and performance optimization',
        duration: '3-4 weeks',
        epics: [
          {
            title: 'Quality Assurance',
            description: 'Comprehensive testing and bug resolution',
            priority: 'high',
            complexity: 'medium',
            userStories: [
              'As a QA engineer, I want comprehensive test coverage',
              'As a user, I want bug-free experience'
            ],
            deliverables: ['Test automation', 'Bug fixes', 'Performance optimization'],
            relatedIdeas: ['Testing', 'Quality Control']
          }
        ]
      },
      {
        phase: 'Launch & Monitoring',
        description: 'Production deployment and monitoring setup',
        duration: '2-3 weeks',
        epics: [
          {
            title: 'Production Deployment',
            description: 'Live deployment and monitoring implementation',
            priority: 'high',
            complexity: 'medium',
            userStories: [
              'As a user, I want reliable production access',
              'As an admin, I want system monitoring'
            ],
            deliverables: ['Production deployment', 'Monitoring setup', 'User documentation'],
            relatedIdeas: ['Deployment', 'Monitoring']
          }
        ]
      }
    ]
  }

  /**
   * Generate marketing project phases
   */
  private generateMarketingProjectPhases(projectName: string): RoadmapPhase[] {
    return [
      {
        phase: 'Strategy & Planning',
        description: 'Market research and campaign strategy development',
        duration: '2-3 weeks',
        epics: [
          {
            title: 'Market Research',
            description: 'Comprehensive market and competitor analysis',
            priority: 'high',
            complexity: 'medium',
            userStories: [
              'As a marketer, I want to understand target audience',
              'As a strategist, I want competitive analysis'
            ],
            deliverables: ['Market research report', 'Competitor analysis', 'Target personas'],
            relatedIdeas: ['Market Analysis', 'Customer Research']
          }
        ]
      },
      {
        phase: 'Content Creation',
        description: 'Development of marketing materials and content',
        duration: '4-5 weeks',
        epics: [
          {
            title: 'Brand Content Development',
            description: `Create compelling content for ${projectName}`,
            priority: 'high',
            complexity: 'medium',
            userStories: [
              'As a customer, I want engaging brand content',
              'As a marketer, I want consistent messaging'
            ],
            deliverables: ['Brand guidelines', 'Marketing materials', 'Content calendar'],
            relatedIdeas: ['Brand Content', 'Messaging']
          }
        ]
      },
      {
        phase: 'Campaign Execution',
        description: 'Launch and manage marketing campaigns',
        duration: '2-4 weeks',
        epics: [
          {
            title: 'Multi-Channel Campaign',
            description: 'Execute coordinated marketing campaign',
            priority: 'high',
            complexity: 'high',
            userStories: [
              'As a customer, I want to discover the brand',
              'As a marketer, I want measurable results'
            ],
            deliverables: ['Campaign launch', 'Performance tracking', 'Optimization'],
            relatedIdeas: ['Campaign Management', 'Analytics']
          }
        ]
      }
    ]
  }

  /**
   * Generate research project phases
   */
  private generateResearchProjectPhases(projectName: string): RoadmapPhase[] {
    return [
      {
        phase: 'Research Design',
        description: 'Define research methodology and framework',
        duration: '2-3 weeks',
        epics: [
          {
            title: 'Research Framework',
            description: `Establish research methodology for ${projectName}`,
            priority: 'high',
            complexity: 'high',
            userStories: [
              'As a researcher, I want clear research objectives',
              'As a stakeholder, I want valid methodology'
            ],
            deliverables: ['Research plan', 'Methodology framework', 'Success metrics'],
            relatedIdeas: ['Research Design', 'Methodology']
          }
        ]
      },
      {
        phase: 'Data Collection',
        description: 'Gather and process research data',
        duration: '4-6 weeks',
        epics: [
          {
            title: 'Data Gathering',
            description: 'Collect comprehensive research data',
            priority: 'high',
            complexity: 'medium',
            userStories: [
              'As a researcher, I want quality data',
              'As an analyst, I want structured datasets'
            ],
            deliverables: ['Data collection', 'Data validation', 'Preliminary analysis'],
            relatedIdeas: ['Data Collection', 'Analysis']
          }
        ]
      },
      {
        phase: 'Analysis & Reporting',
        description: 'Analyze findings and create comprehensive reports',
        duration: '4-5 weeks',
        epics: [
          {
            title: 'Research Analysis',
            description: 'Comprehensive analysis and reporting',
            priority: 'high',
            complexity: 'high',
            userStories: [
              'As a stakeholder, I want actionable insights',
              'As a decision maker, I want clear recommendations'
            ],
            deliverables: ['Analysis report', 'Recommendations', 'Presentation'],
            relatedIdeas: ['Data Analysis', 'Reporting']
          }
        ]
      }
    ]
  }

  /**
   * Generate generic project phases
   */
  private generateGenericProjectPhases(projectName: string): RoadmapPhase[] {
    return [
      {
        phase: 'Planning & Setup',
        description: 'Project initialization and planning',
        duration: '2-3 weeks',
        epics: [
          {
            title: 'Project Foundation',
            description: `Establish foundation for ${projectName}`,
            priority: 'high',
            complexity: 'medium',
            userStories: [
              'As a project manager, I want clear project scope',
              'As a team member, I want defined roles'
            ],
            deliverables: ['Project plan', 'Team structure', 'Resource allocation'],
            relatedIdeas: ['Project Planning', 'Team Setup']
          }
        ]
      },
      {
        phase: 'Implementation',
        description: 'Core project execution',
        duration: '6-8 weeks',
        epics: [
          {
            title: 'Core Implementation',
            description: 'Execute main project deliverables',
            priority: 'high',
            complexity: 'high',
            userStories: [
              'As a stakeholder, I want project objectives met',
              'As a user, I want functional outcomes'
            ],
            deliverables: ['Core deliverables', 'Quality assurance', 'Progress tracking'],
            relatedIdeas: ['Implementation', 'Execution']
          }
        ]
      },
      {
        phase: 'Completion & Review',
        description: 'Project finalization and evaluation',
        duration: '2-3 weeks',
        epics: [
          {
            title: 'Project Closure',
            description: 'Finalize project and conduct review',
            priority: 'medium',
            complexity: 'low',
            userStories: [
              'As a stakeholder, I want project completion',
              'As a team, I want lessons learned'
            ],
            deliverables: ['Final deliverables', 'Project review', 'Documentation'],
            relatedIdeas: ['Project Closure', 'Review']
          }
        ]
      }
    ]
  }
}

// Export singleton instance
export const aiRoadmapService = new AIRoadmapService()