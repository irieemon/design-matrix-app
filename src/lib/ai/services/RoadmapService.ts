/**
 * Roadmap Service
 * Handles AI-powered roadmap generation for projects
 */

import { IdeaCard } from '../../../types'
import { logger } from '../../../utils/logger'
import { BaseAiService, SecureAIServiceConfig } from './BaseAiService'
import { getQuadrantFromPosition } from '../utils'

/**
 * Service for generating project roadmaps using AI
 */
export class RoadmapService extends BaseAiService {
  constructor(config: SecureAIServiceConfig = {}) {
    super(config)
  }

  /**
   * Generate a project roadmap from ideas
   * @param ideas - Array of idea cards
   * @param projectName - Project name
   * @param projectType - Project type
   * @returns Generated roadmap
   */
  async generateRoadmap(ideas: IdeaCard[], projectName: string, projectType?: string): Promise<any> {
    logger.debug('🗺️ Generating roadmap for project:', projectName)

    // Create cache key from core parameters
    const ideaSignature = (ideas || []).map((idea) => ({
      content: idea.content,
      x: Math.round(idea.x / 10) * 10,
      y: Math.round(idea.y / 10) * 10
    }))

    const cacheKey = this.generateCacheKey('generateRoadmap', {
      ideas: ideaSignature,
      projectName: projectName || 'Project',
      projectType: projectType || 'General'
    })

    return this.getOrSetCache(
      cacheKey,
      async () => {
        try {
          const data = await this.fetchWithErrorHandling<any>('/api/ai?action=generate-roadmap', {
            projectName,
            projectType: projectType || 'General',
            ideas: (ideas || []).map((idea) => ({
              title: idea.content,
              description: idea.details,
              quadrant: getQuadrantFromPosition(idea.x, idea.y)
            }))
          })

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
          logger.debug('Roadmap API error details:', {
            projectName,
            projectType,
            ideaCount: (ideas || []).length,
            error: error instanceof Error ? error.message : String(error)
          })
          return this.generateMockRoadmap(projectName, projectType)
        }
      },
      25 * 60 * 1000 // 25 minute cache for roadmaps (longest TTL due to complexity)
    )
  }

  /**
   * Generate mock roadmap for fallback
   * @param projectName - Project name
   * @param projectType - Project type
   * @returns Mock roadmap data
   */
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
                deliverables: [
                  'Development environment',
                  'CI/CD pipeline',
                  'Project documentation',
                  'Team onboarding guide'
                ],
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
        teamRecommendations:
          'Cross-functional team with Product Owner, Technical Lead, 2-3 Developers (Frontend/Backend), QA Engineer, and part-time DevOps support. Team should have strong collaboration skills and experience with agile methodologies.',
        keyMilestones: [
          {
            milestone: 'Development Environment Ready',
            timeline: 'Week 2',
            description:
              'Complete development environment setup, CI/CD pipeline operational, and team fully onboarded'
          },
          {
            milestone: 'Requirements Finalized',
            timeline: 'Week 4',
            description:
              'All business requirements documented, technical specifications approved, and development roadmap confirmed'
          },
          {
            milestone: 'Core Features Complete',
            timeline: 'Week 10',
            description:
              'All core application features implemented, tested, and ready for integration testing'
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
