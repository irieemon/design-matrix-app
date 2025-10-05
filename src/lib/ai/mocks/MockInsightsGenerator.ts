/**
 * Mock Insights Generator
 * Generates mock insights for fallback when AI service is unavailable
 */

import { IdeaCard } from '../../../types'
import { logger } from '../../../utils/logger'

/**
 * Mock insights generator for fallback scenarios
 */
export class MockInsightsGenerator {
  /**
   * Generate project-specific mock insights based on actual project context
   * @param ideas - Array of idea cards
   * @param projectName - Project name
   * @param projectType - Project type
   * @param documentContext - Document context array
   * @returns Project-specific mock insights
   */
  static generateProjectSpecificMockInsights(
    ideas: IdeaCard[],
    projectName: string,
    projectType: string,
    documentContext: any[] = []
  ): any {
    const hasFiles = documentContext && documentContext.length > 0
    const ideaCount = (ideas || []).length

    // Analyze actual idea content to understand what this project is really about
    const allIdeaText = (ideas || []).map((idea) => `${idea.content} ${idea.details || ''}`).join(' ').toLowerCase()
    const projectText = `${projectName} ${projectType}`.toLowerCase()
    const combinedText = `${projectText} ${allIdeaText}`

    // Smart context detection based on actual project content
    let industry = 'business'
    let focus = 'operations'
    let marketContext = 'market'
    let specificFocus: string[] = []
    let keyThemes: string[] = []

    // Analyze the actual ideas to understand the project's real focus
    if (combinedText.includes('health') || combinedText.includes('medical') || combinedText.includes('patient')) {
      industry = 'healthcare'
      focus = 'patient care and health outcomes'
      marketContext = 'healthcare market'
    } else if (combinedText.includes('senior') || combinedText.includes('aging') || combinedText.includes('elderly')) {
      industry = 'senior care'
      focus = 'senior wellness and care quality'
      marketContext = 'senior care market'
    } else if (combinedText.includes('marketing') || combinedText.includes('campaign') || combinedText.includes('brand')) {
      industry = 'marketing'
      focus = 'brand engagement and customer acquisition'
      marketContext = 'target market'
    } else if (combinedText.includes('holiday') || combinedText.includes('seasonal')) {
      industry = 'seasonal marketing'
      focus = 'holiday customer engagement'
      marketContext = 'seasonal market'
    } else if (combinedText.includes('platform') || combinedText.includes('app') || combinedText.includes('software')) {
      industry = 'technology platform'
      focus = 'platform development and user experience'
      marketContext = 'technology market'
    } else if (
      combinedText.includes('subscription') ||
      combinedText.includes('premium') ||
      combinedText.includes('features')
    ) {
      industry = 'subscription technology'
      focus = 'subscription model and premium feature development'
      marketContext = 'SaaS market'
    }

    // Extract specific themes from actual ideas
    const ideaTitles = (ideas || []).map((idea) => idea.content)
    if (ideaTitles.some((title) => title.toLowerCase().includes('subscription'))) {
      specificFocus.push('subscription model optimization')
      keyThemes.push('recurring revenue growth')
    }
    if (
      ideaTitles.some(
        (title) => title.toLowerCase().includes('premium') || title.toLowerCase().includes('advanced')
      )
    ) {
      specificFocus.push('premium feature development')
      keyThemes.push('feature differentiation')
    }
    if (ideaTitles.some((title) => title.toLowerCase().includes('user') || title.toLowerCase().includes('experience'))) {
      specificFocus.push('user experience enhancement')
      keyThemes.push('customer satisfaction')
    }
    if (ideaTitles.some((title) => title.toLowerCase().includes('social') || title.toLowerCase().includes('sharing'))) {
      specificFocus.push('social engagement features')
      keyThemes.push('community building')
    }
    if (
      ideaTitles.some((title) => title.toLowerCase().includes('onboarding') || title.toLowerCase().includes('tutorial'))
    ) {
      specificFocus.push('user onboarding optimization')
      keyThemes.push('user activation')
    }

    // If no specific themes detected, use more generic but project-relevant themes
    if (specificFocus.length === 0) {
      specificFocus = ['core functionality improvement', 'user engagement enhancement']
      keyThemes = ['market positioning', 'competitive advantage']
    }

    // Get the top 3 most relevant ideas for insights
    const topIdeas = (ideas || []).slice(0, 3)
    const mainFocus = specificFocus[0] || focus
    const primaryTheme = keyThemes[0] || 'growth'

    return {
      executiveSummary: `Analysis of ${ideaCount} ideas for ${projectName} shows specific opportunities in ${mainFocus}${
        specificFocus.length > 1 ? ` and ${specificFocus[1]}` : ''
      }. Based on your actual project ideas like "${topIdeas[0]?.content || 'core features'}" and "${
        topIdeas[1]?.content || 'user experience'
      }", this ${industry} project focuses on practical ${primaryTheme} implementation${
        hasFiles ? ` with ${documentContext.length} supporting documents providing additional context` : ''
      }.`,

      keyInsights: [
        {
          insight: `${specificFocus[0]?.charAt(0).toUpperCase() + specificFocus[0]?.slice(1) || 'Strategic Focus'}`,
          impact: `Initiative "${
            topIdeas[0]?.content || 'Primary feature'
          }" represents a core opportunity for ${projectName} to establish ${primaryTheme} through targeted ${mainFocus} in the ${marketContext}.`
        },
        {
          insight: `${keyThemes[0]?.charAt(0).toUpperCase() + keyThemes[0]?.slice(1) || 'Market Positioning'}`,
          impact: `Features like "${topIdeas[1]?.content || 'Secondary feature'}" and "${
            topIdeas[2]?.content || 'Supporting feature'
          }" create a cohesive strategy for ${projectName} ${primaryTheme} and competitive differentiation.`
        },
        {
          insight: hasFiles
            ? 'Document-Informed Strategy'
            : `${industry.charAt(0).toUpperCase() + industry.slice(1)} Implementation`,
          impact: hasFiles
            ? `Uploaded documentation provides specific context for implementing ${specificFocus.join(
                ' and '
              )} within ${projectName}'s ${industry} strategy.`
            : `${projectName}'s focus on ${specificFocus.join(' and ')} aligns with current ${industry} market demands and user expectations.`
        }
      ],

      priorityRecommendations: {
        immediate: hasFiles
          ? [
              `Implement "${topIdeas[0]?.content || 'primary feature'}" leveraging document insights`,
              `Execute quick wins from "${topIdeas[1]?.content || 'secondary feature'}" for immediate ${primaryTheme}`,
              `Validate ${specificFocus[0]} approach with target users`
            ]
          : [
              `Prioritize "${topIdeas[0]?.content || 'core feature'}" development for ${projectName}`,
              `Launch pilot program for "${topIdeas[1]?.content || 'key feature'}" testing`,
              `Establish ${mainFocus} metrics and success criteria`
            ],
        shortTerm: [
          `Scale "${topIdeas[0]?.content || 'primary initiative'}" based on user feedback`,
          `Integrate ${specificFocus.join(' with ')} for comprehensive user experience`,
          `Develop ${projectName} competitive advantages in ${keyThemes.join(' and ')}`
        ],
        longTerm: [
          `Expand ${projectName} platform with advanced ${specificFocus.join(' and ')} capabilities`,
          `Build ecosystem around successful features like "${topIdeas[0]?.content || 'core offering'}"`,
          `Position ${projectName} for ${industry} market leadership through ${primaryTheme}`
        ]
      },

      riskAssessment: {
        highRisk: hasFiles
          ? [
              `Documentation gaps may impact ${industry} execution clarity`,
              `File-based insights need validation with real ${marketContext} data`,
              `${focus.charAt(0).toUpperCase() + focus.slice(1)} scalability and operational complexity`
            ]
          : [
              `${marketContext.charAt(0).toUpperCase() + marketContext.slice(1)} entry timing and competitive response risks`,
              `Customer acquisition economics within ${industry} sector`,
              `${focus.charAt(0).toUpperCase() + focus.slice(1)} scalability and operational complexity`
            ],
        opportunities: [
          `${marketContext.charAt(0).toUpperCase() + marketContext.slice(1)} consolidation and partnership opportunities`,
          `Strategic alliance potential within ${industry} sector`,
          hasFiles
            ? `Document-driven ${focus} optimization potential`
            : `${projectName} expansion and revenue diversification`
        ]
      },

      suggestedRoadmap: [
        {
          phase: `${specificFocus[0]?.charAt(0).toUpperCase() + specificFocus[0]?.slice(1) || 'Foundation'} Phase`,
          duration: '0-6 months',
          focus: hasFiles
            ? `Implement core features like "${topIdeas[0]?.content}" using document insights for ${primaryTheme}`
            : `Launch "${topIdeas[0]?.content}" and "${topIdeas[1]?.content}" to establish ${projectName} in ${marketContext}`,
          ideas: (ideas || []).slice(0, 3).map((idea) => idea.content)
        },
        {
          phase: `${keyThemes[0]?.charAt(0).toUpperCase() + keyThemes[0]?.slice(1) || 'Growth'} Acceleration`,
          duration: '6-18 months',
          focus: `Scale successful features and develop advanced ${specificFocus.join(' and ')} capabilities`,
          ideas: (ideas || []).slice(3, 6).map((idea) => idea.content)
        }
      ],

      resourceAllocation: {
        quickWins: hasFiles
          ? `Focus initial efforts on implementing "${topIdeas[0]?.content || 'priority features'}" using insights from uploaded documentation.`
          : `Prioritize immediate implementation of "${topIdeas[0]?.content || 'core features'}" and "${topIdeas[1]?.content || 'key functionality'}" for early ${primaryTheme}.`,
        strategic: `Build sustainable ${focus} around successful features like "${topIdeas[0]?.content || 'main functionality'}", focusing on ${industry} best practices and user needs.`
      },

      futureEnhancements: hasFiles
        ? [
            {
              title: `Advanced ${specificFocus[0] || 'Feature'} Analytics`,
              description: `Enhanced analytics and insights for ${topIdeas[0]?.content || 'core features'} based on document guidance`,
              relatedIdea: (ideas || [])[0]?.content || `${specificFocus[0]} Analytics`,
              impact: 'high',
              timeframe: '3-6 months'
            }
          ]
        : [
            {
              title: `${topIdeas[0]?.content || projectName} Enhancement Platform`,
              description: `Next-generation ${specificFocus.join(' and ')} capabilities building on "${topIdeas[1]?.content || 'current features'}"`,
              relatedIdea: (ideas || [])[0]?.content || 'Platform Enhancement',
              impact: 'high',
              timeframe: '3-6 months'
            }
          ],

      nextSteps: hasFiles
        ? [
            `Review and validate ${industry} insights from uploaded documentation`,
            `Conduct comprehensive ${marketContext} analysis incorporating document insights`,
            `Develop ${focus} implementation strategy based on ${projectName} documentation`,
            `Establish measurement framework for ${industry} initiatives`
          ]
        : [
            `Conduct comprehensive ${marketContext} analysis and competitive intelligence`,
            `Develop ${projectName} materials and strategic positioning`,
            `Establish ${industry} advisory relationships and partnerships`,
            `Implement ${focus} discovery and validation processes`
          ]
    }
  }

  /**
   * Generate mock insights with file context
   * @param ideas - Array of idea cards
   * @param documentContext - Document context array
   * @returns Mock insights with file context
   */
  static generateMockInsightsWithFiles(ideas: IdeaCard[], documentContext: any[] = []): any {
    const hasFiles = documentContext && documentContext.length > 0
    const fileTypes = hasFiles ? documentContext.map((doc: any) => doc.type).join(', ') : 'none'
    const fileCount = hasFiles ? documentContext.length : 0

    // Categorize files by type
    const imageFiles = documentContext.filter((doc) => doc.mimeType?.startsWith('image/'))
    const audioFiles = documentContext.filter(
      (doc) => doc.mimeType?.startsWith('audio/') || doc.mimeType?.startsWith('video/')
    )
    const textFiles = documentContext.filter(
      (doc) =>
        !doc.mimeType?.startsWith('image/') &&
        !doc.mimeType?.startsWith('audio/') &&
        !doc.mimeType?.startsWith('video/')
    )

    logger.debug('📁 Generating mock insights with ALL file types:', {
      totalFiles: fileCount,
      images: imageFiles.length,
      audioVideo: audioFiles.length,
      textDocs: textFiles.length
    })

    if (hasFiles) {
      logger.warn('🎯 MOCK INSIGHTS: ALL FILES detected and being processed!')
      logger.warn(`🎯 Total files: ${fileCount}`)
      logger.warn(`🎯 Images: ${imageFiles.length}`)
      logger.warn(`🎯 Audio/Video: ${audioFiles.length}`)
      logger.warn(`🎯 Text/Documents: ${textFiles.length}`)
      logger.warn(`🎯 File types: ${fileTypes}`)
      documentContext.forEach((doc: any, index: number) => {
        const fileTypeIcon = doc.mimeType?.startsWith('image/')
          ? '🖼️'
          : doc.mimeType?.startsWith('video/')
          ? '🎥'
          : doc.mimeType?.startsWith('audio/')
          ? '🎵'
          : '📄'
        logger.warn(
          `🎯 File ${index + 1}: ${fileTypeIcon} ${doc.name} - ${doc.content?.length || 0} characters (${doc.mimeType})`
        )
      })
    } else {
      logger.warn('🎯 MOCK INSIGHTS: No files detected - using generic insights')
    }

    const fileTypeBreakdown = hasFiles
      ? `${textFiles.length} text documents${imageFiles.length > 0 ? `, ${imageFiles.length} images` : ''}${audioFiles.length > 0 ? `, ${audioFiles.length} audio/video files` : ''}`
      : 'no files'

    return {
      executiveSummary: `Strategic analysis of ${(ideas || []).length} initiatives reveals significant market opportunity${
        hasFiles ? ` informed by ${fileCount} uploaded files (${fileTypeBreakdown})` : ''
      }. Analysis shows strong potential for rapid growth and market capture based on current initiative portfolio${
        hasFiles ? ' and multi-modal supporting content including visual and document assets' : ''
      }.`,

      keyInsights: [
        {
          insight:
            hasFiles && imageFiles.length > 0
              ? 'Visual Content-Informed Strategy'
              : hasFiles
              ? 'Document-Informed Market Opportunity'
              : 'Market Opportunity Analysis',
          impact:
            hasFiles && imageFiles.length > 0
              ? `Analysis of uploaded visual content (${imageFiles.length} images) combined with ${
                  textFiles.length > 0 ? 'documentation' : 'project context'
                } reveals strategic opportunities for visual design and user experience optimization.`
              : hasFiles
              ? `Based on uploaded content (${fileTypeBreakdown}), market conditions present significant opportunity for rapid growth and competitive positioning.`
              : 'Current market conditions and competitive landscape present significant opportunity for rapid growth and market share capture.'
        },
        {
          insight: 'Strategic Execution Priority',
          impact:
            'Portfolio balance between quick wins and strategic initiatives optimizes risk-adjusted returns and stakeholder value creation.'
        },
        {
          insight: hasFiles ? 'Multi-Modal Content Analysis' : 'Competitive Positioning',
          impact: hasFiles
            ? `Project analysis leverages ${fileTypeBreakdown} providing comprehensive context for strategic planning across visual, textual, and ${
                audioFiles.length > 0 ? 'audio/video ' : ''
              }content dimensions.`
            : 'First-mover advantages and differentiated capabilities create defensible market position with scalable growth potential.'
        }
      ],

      priorityRecommendations: {
        immediate: hasFiles
          ? [
              'Leverage uploaded documentation insights for immediate market validation',
              'Execute quick wins identified through document analysis',
              'Establish stakeholder alignment based on project documentation'
            ]
          : [
              'Execute market validation and customer discovery initiatives',
              'Secure strategic partnerships and distribution channels',
              'Establish funding pipeline and investor relations'
            ],
        shortTerm: [
          'Scale go-to-market operations and sales processes',
          'Build product-market fit and customer success programs',
          'Develop strategic moats and competitive advantages'
        ],
        longTerm: [
          'Expand to adjacent markets and international opportunities',
          'Build platform ecosystem and strategic partnerships',
          'Position for strategic exit or public offering'
        ]
      },

      riskAssessment: {
        highRisk: hasFiles
          ? [
              'Documentation gaps may impact execution clarity',
              'File-based insights need validation with real market data',
              'Technology scalability and operational complexity'
            ]
          : [
              'Market entry timing and competitive response risks',
              'Customer acquisition economics and unit profitability',
              'Technology scalability and operational complexity'
            ],
        opportunities: [
          'Market consolidation and acquisition opportunities',
          'Strategic partnership and channel expansion potential',
          hasFiles ? 'Document-driven process optimization potential' : 'Data monetization and platform revenue streams'
        ]
      },

      suggestedRoadmap: [
        {
          phase: 'Market Validation',
          duration: '0-6 months',
          focus: hasFiles
            ? 'Validate insights from uploaded documentation and establish initial customer base'
            : 'Validate product-market fit and establish initial customer base',
          ideas: (ideas || []).slice(0, 3).map((idea) => idea.content)
        },
        {
          phase: 'Growth Acceleration',
          duration: '6-18 months',
          focus: 'Scale operations and capture market share',
          ideas: (ideas || []).slice(3, 6).map((idea) => idea.content)
        }
      ],

      resourceAllocation: {
        quickWins: hasFiles
          ? 'Deploy 30% of resources to document-validated quick wins and high-velocity market validation initiatives.'
          : 'Deploy 30% of resources to high-velocity market validation and customer acquisition initiatives with rapid feedback cycles.',
        strategic:
          'Invest 70% of capital in scalable growth infrastructure, strategic partnerships, and competitive differentiation capabilities.'
      },

      futureEnhancements: hasFiles
        ? [
            {
              title: 'Document Analysis Automation',
              description: 'Automated analysis of project documents to extract insights and recommendations',
              relatedIdea: (ideas || [])[0]?.content || 'Document Processing',
              impact: 'high',
              timeframe: '3-6 months'
            },
            {
              title: 'File-Based Workflow Integration',
              description: 'Integration of uploaded file insights into daily workflow and decision-making processes',
              relatedIdea: (ideas || [])[1]?.content || 'Process Integration',
              impact: 'medium',
              timeframe: '6-12 months'
            }
          ]
        : [
            {
              title: 'Advanced Analytics Platform',
              description: 'Comprehensive analytics and reporting capabilities for better insights',
              relatedIdea: (ideas || [])[0]?.content || 'Analytics Enhancement',
              impact: 'high',
              timeframe: '3-6 months'
            }
          ],

      nextSteps: hasFiles
        ? [
            'Review and validate insights from uploaded documentation',
            'Conduct comprehensive market analysis incorporating file-based insights',
            'Develop implementation strategy based on document recommendations',
            'Establish measurement framework for document-driven initiatives'
          ]
        : [
            'Conduct comprehensive market analysis and competitive intelligence',
            'Develop investor materials and funding strategy',
            'Establish strategic advisory board and industry partnerships',
            'Implement customer discovery and validation processes'
          ]
    }
  }
}
