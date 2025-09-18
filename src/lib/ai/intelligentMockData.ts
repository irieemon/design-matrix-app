/**
 * Intelligent Mock Data Service
 *
 * Provides realistic, diverse project scenarios for development and testing
 * of AI optimizations, smart model routing, and context engineering.
 */

import { IdeaCard } from '../../types'
import { OpenAIModelRouter, TaskContext, AITaskType } from './openaiModelRouter'

interface MockProjectScenario {
  id: string
  name: string
  type: string
  description: string
  complexity: 'low' | 'medium' | 'high'
  industry: string
  teamSize: number
  budget: number
  ideas: MockIdea[]
  context: {
    marketSegment: string
    competitiveAdvantage: string
    primaryChallenges: string[]
    keyMetrics: string[]
  }
  expectedAITaskType: AITaskType
  expectedModelComplexity: 'low' | 'medium' | 'high'
}

interface MockIdea {
  title: string
  description: string
  quadrant: 'quick-wins' | 'major-projects' | 'fill-ins' | 'thankless-tasks'
  effort: number
  impact: number
  details?: string
}

export class IntelligentMockDataService {

  /**
   * Get diverse project scenarios for testing AI optimizations
   */
  static getProjectScenarios(): MockProjectScenario[] {
    return [
      // HIGH COMPLEXITY - SaaS Platform (should use gpt-4o)
      {
        id: 'saas-platform-complex',
        name: 'DataFlow Analytics Platform',
        type: 'SaaS Platform',
        description: 'Enterprise data analytics platform with real-time processing and machine learning capabilities',
        complexity: 'high',
        industry: 'Enterprise Software',
        teamSize: 25,
        budget: 2500000,
        ideas: [
          {
            title: 'Real-time Data Pipeline Architecture',
            description: 'Build scalable data ingestion system handling 1M+ events per second with Apache Kafka and Stream processing',
            quadrant: 'major-projects',
            effort: 90,
            impact: 95,
            details: 'Complex distributed system requiring horizontal scaling, fault tolerance, and multi-tenant data isolation'
          },
          {
            title: 'Automated Anomaly Detection Engine',
            description: 'ML-powered system to identify data anomalies and business intelligence outliers',
            quadrant: 'major-projects',
            effort: 85,
            impact: 88,
            details: 'Advanced machine learning algorithms with continuous model training and real-time inference'
          },
          {
            title: 'Custom Dashboard Builder',
            description: 'Drag-and-drop interface for creating personalized analytics dashboards',
            quadrant: 'quick-wins',
            effort: 25,
            impact: 75,
            details: 'Reusable component library with pre-built visualization widgets'
          },
          {
            title: 'API Rate Limiting & Security',
            description: 'Implement comprehensive API security with OAuth 2.0, rate limiting, and audit logging',
            quadrant: 'thankless-tasks',
            effort: 40,
            impact: 30,
            details: 'Essential security infrastructure for enterprise compliance requirements'
          },
          {
            title: 'Performance Monitoring Dashboard',
            description: 'Internal monitoring for system performance, latency, and resource utilization',
            quadrant: 'fill-ins',
            effort: 15,
            impact: 25,
            details: 'DevOps tooling for maintaining system reliability and SLA compliance'
          }
        ],
        context: {
          marketSegment: 'Enterprise data teams and business intelligence analysts',
          competitiveAdvantage: 'Real-time processing capabilities with advanced ML integration',
          primaryChallenges: ['Data volume scalability', 'Multi-tenant security', 'Complex enterprise integrations'],
          keyMetrics: ['Data processing latency', 'Query response time', 'Customer retention rate', 'API reliability']
        },
        expectedAITaskType: 'strategic-insights',
        expectedModelComplexity: 'high'
      },

      // MEDIUM COMPLEXITY - E-commerce Platform (could use either model)
      {
        id: 'ecommerce-medium',
        name: 'ArtisanCraft Marketplace',
        type: 'E-commerce Platform',
        description: 'Specialized marketplace connecting independent artisans with conscious consumers',
        complexity: 'medium',
        industry: 'Retail & E-commerce',
        teamSize: 12,
        budget: 750000,
        ideas: [
          {
            title: 'Artisan Verification System',
            description: 'Comprehensive vetting process for authentic handmade products with certification badges',
            quadrant: 'major-projects',
            effort: 70,
            impact: 85,
            details: 'Multi-step verification including portfolio review, video interviews, and product authentication'
          },
          {
            title: 'Smart Recommendation Engine',
            description: 'Personalized product recommendations based on buying history and style preferences',
            quadrant: 'quick-wins',
            effort: 35,
            impact: 80,
            details: 'Collaborative filtering with style analysis and seasonal trending'
          },
          {
            title: 'Sustainable Shipping Calculator',
            description: 'Carbon footprint tracking and eco-friendly shipping options for conscious consumers',
            quadrant: 'quick-wins',
            effort: 20,
            impact: 60,
            details: 'Integration with green shipping providers and offset calculation'
          },
          {
            title: 'Payment Processing Compliance',
            description: 'PCI DSS compliance and international payment gateway integration',
            quadrant: 'thankless-tasks',
            effort: 50,
            impact: 25,
            details: 'Essential compliance for handling credit card transactions globally'
          },
          {
            title: 'Order Tracking System',
            description: 'Real-time order status updates with SMS and email notifications',
            quadrant: 'fill-ins',
            effort: 25,
            impact: 40,
            details: 'Standard e-commerce functionality for customer experience'
          }
        ],
        context: {
          marketSegment: 'Conscious consumers seeking authentic handmade products',
          competitiveAdvantage: 'Verified artisan network with sustainability focus',
          primaryChallenges: ['Artisan onboarding complexity', 'Quality consistency', 'Seasonal demand variation'],
          keyMetrics: ['Artisan retention rate', 'Average order value', 'Customer satisfaction score', 'Sustainability impact']
        },
        expectedAITaskType: 'roadmap-planning',
        expectedModelComplexity: 'medium'
      },

      // LOW COMPLEXITY - Mobile App (should use gpt-4o-mini)
      {
        id: 'mobile-app-simple',
        name: 'FitTracker Personal',
        type: 'Mobile App',
        description: 'Personal fitness tracking app with habit building and progress visualization',
        complexity: 'low',
        industry: 'Health & Fitness',
        teamSize: 5,
        budget: 150000,
        ideas: [
          {
            title: 'Daily Habit Tracker',
            description: 'Simple interface to log daily fitness activities and habits',
            quadrant: 'quick-wins',
            effort: 15,
            impact: 70,
            details: 'Basic CRUD functionality with local storage and simple UI'
          },
          {
            title: 'Progress Charts & Analytics',
            description: 'Visual charts showing fitness progress over time with basic statistics',
            quadrant: 'quick-wins',
            effort: 20,
            impact: 65,
            details: 'Chart library integration with simple data aggregation'
          },
          {
            title: 'Social Sharing Features',
            description: 'Share achievements and progress with friends through social media',
            quadrant: 'fill-ins',
            effort: 12,
            impact: 35,
            details: 'Social media API integration for sharing accomplishments'
          },
          {
            title: 'App Store Optimization',
            description: 'Optimize app store presence with keywords, screenshots, and description',
            quadrant: 'thankless-tasks',
            effort: 8,
            impact: 20,
            details: 'Marketing copy and visual assets for app store submission'
          },
          {
            title: 'Push Notification System',
            description: 'Reminder notifications for workout schedules and habit check-ins',
            quadrant: 'fill-ins',
            effort: 18,
            impact: 45,
            details: 'Basic push notification service with scheduling functionality'
          }
        ],
        context: {
          marketSegment: 'Individual fitness enthusiasts and casual exercisers',
          competitiveAdvantage: 'Simple, focused approach without overwhelming features',
          primaryChallenges: ['User engagement retention', 'Competitive market', 'Limited budget for marketing'],
          keyMetrics: ['Daily active users', 'Habit completion rate', 'App store rating', 'Retention rate']
        },
        expectedAITaskType: 'quick-analysis',
        expectedModelComplexity: 'low'
      },

      // HIGH COMPLEXITY - Fintech Platform (should use gpt-4o)
      {
        id: 'fintech-complex',
        name: 'InvestMent AI Advisory',
        type: 'Fintech Platform',
        description: 'AI-powered investment advisory platform with automated portfolio management',
        complexity: 'high',
        industry: 'Financial Services',
        teamSize: 30,
        budget: 5000000,
        ideas: [
          {
            title: 'AI Portfolio Optimization Engine',
            description: 'Machine learning algorithms for automated portfolio rebalancing based on risk tolerance and market conditions',
            quadrant: 'major-projects',
            effort: 95,
            impact: 90,
            details: 'Advanced ML models with real-time market data integration, risk analysis, and regulatory compliance'
          },
          {
            title: 'Regulatory Compliance Framework',
            description: 'Comprehensive system for SEC, FINRA, and international financial regulations compliance',
            quadrant: 'thankless-tasks',
            effort: 80,
            impact: 15,
            details: 'Essential regulatory infrastructure for financial services operation'
          },
          {
            title: 'Real-time Market Data Integration',
            description: 'High-frequency market data feeds with millisecond latency for trading decisions',
            quadrant: 'major-projects',
            effort: 75,
            impact: 85,
            details: 'Complex data infrastructure requiring financial market data providers and real-time processing'
          },
          {
            title: 'User Onboarding Wizard',
            description: 'Streamlined KYC process with document verification and risk assessment questionnaire',
            quadrant: 'quick-wins',
            effort: 30,
            impact: 70,
            details: 'Know Your Customer compliance with user-friendly interface'
          },
          {
            title: 'Performance Reporting Dashboard',
            description: 'Detailed investment performance analytics with tax-loss harvesting reports',
            quadrant: 'fill-ins',
            effort: 35,
            impact: 50,
            details: 'Financial reporting with tax optimization features'
          }
        ],
        context: {
          marketSegment: 'High-net-worth individuals and institutional investors',
          competitiveAdvantage: 'AI-driven investment strategies with institutional-grade technology',
          primaryChallenges: ['Regulatory complexity', 'Market volatility handling', 'Client trust and transparency'],
          keyMetrics: ['Assets under management', 'Alpha generation', 'Client acquisition cost', 'Regulatory audit success']
        },
        expectedAITaskType: 'risk-assessment',
        expectedModelComplexity: 'high'
      },

      // MEDIUM COMPLEXITY - EdTech Platform (balanced complexity)
      {
        id: 'edtech-medium',
        name: 'SkillBridge Learning Hub',
        type: 'EdTech Platform',
        description: 'Professional skills development platform with interactive courses and certification tracking',
        complexity: 'medium',
        industry: 'Education Technology',
        teamSize: 15,
        budget: 900000,
        ideas: [
          {
            title: 'Adaptive Learning Algorithm',
            description: 'Personalized learning paths that adapt to individual progress and learning style',
            quadrant: 'major-projects',
            effort: 65,
            impact: 80,
            details: 'Machine learning system that adjusts content difficulty and pacing based on learner performance'
          },
          {
            title: 'Interactive Video Player',
            description: 'Enhanced video player with note-taking, bookmarks, and progress tracking',
            quadrant: 'quick-wins',
            effort: 25,
            impact: 75,
            details: 'Custom video player with learning-focused features and analytics'
          },
          {
            title: 'Certification Management System',
            description: 'Digital certificates with blockchain verification and industry partner recognition',
            quadrant: 'major-projects',
            effort: 55,
            impact: 70,
            details: 'Secure credentialing system with industry validation and verification'
          },
          {
            title: 'Discussion Forums & Community',
            description: 'Learner community features with Q&A, study groups, and peer mentoring',
            quadrant: 'fill-ins',
            effort: 30,
            impact: 45,
            details: 'Social learning features to enhance engagement and knowledge sharing'
          },
          {
            title: 'SCORM Compliance Integration',
            description: 'Support for industry-standard learning content formats and LMS integration',
            quadrant: 'thankless-tasks',
            effort: 40,
            impact: 30,
            details: 'Technical standards compliance for enterprise learning management systems'
          }
        ],
        context: {
          marketSegment: 'Working professionals seeking skill advancement and career development',
          competitiveAdvantage: 'Industry-recognized certifications with adaptive learning technology',
          primaryChallenges: ['Content creation scalability', 'Industry partnership development', 'Learning engagement retention'],
          keyMetrics: ['Course completion rate', 'Certification achievement rate', 'Employment outcome improvement', 'Corporate partnership growth']
        },
        expectedAITaskType: 'idea-generation',
        expectedModelComplexity: 'medium'
      }
    ]
  }

  /**
   * Generate intelligent mock insights based on project scenario
   */
  static generateIntelligentMockInsights(scenario: MockProjectScenario): any {
    const taskContext: TaskContext = {
      type: scenario.expectedAITaskType,
      complexity: scenario.expectedModelComplexity,
      ideaCount: scenario.ideas.length,
      hasFiles: false,
      hasImages: false,
      hasAudio: false,
      userTier: 'pro'
    }

    const modelSelection = OpenAIModelRouter.selectModel(taskContext)

    return {
      executiveSummary: `Strategic analysis of ${scenario.name} reveals ${scenario.ideas.length} prioritized initiatives across ${scenario.industry.toLowerCase()}. This ${scenario.complexity}-complexity ${scenario.type.toLowerCase()} focuses on ${scenario.context.competitiveAdvantage.toLowerCase()} targeting ${scenario.context.marketSegment.toLowerCase()}. With a ${scenario.teamSize}-person team and $${(scenario.budget / 1000000).toFixed(1)}M budget, the project emphasizes ${this.getTopQuadrantFocus(scenario.ideas)} implementation for maximum market impact.`,

      keyInsights: [
        {
          insight: `${scenario.industry} Market Positioning`,
          impact: `${scenario.name}'s focus on "${scenario.context.competitiveAdvantage}" creates distinctive market positioning within ${scenario.context.marketSegment.toLowerCase()}, directly addressing industry challenges like ${scenario.context.primaryChallenges[0]?.toLowerCase()}.`
        },
        {
          insight: `Strategic Implementation Priority`,
          impact: `The "${scenario.ideas.find(i => i.quadrant === 'major-projects')?.title}" initiative represents the highest-impact opportunity, requiring ${scenario.ideas.find(i => i.quadrant === 'major-projects')?.effort} effort points but delivering ${scenario.ideas.find(i => i.quadrant === 'major-projects')?.impact} impact points for competitive differentiation.`
        },
        {
          insight: `Resource Optimization Strategy`,
          impact: `With ${scenario.teamSize} team members and ${scenario.complexity} complexity, prioritizing "${scenario.ideas.find(i => i.quadrant === 'quick-wins')?.title}" provides immediate value while building toward larger initiatives like "${scenario.ideas.find(i => i.quadrant === 'major-projects' && i !== scenario.ideas.find(j => j.quadrant === 'major-projects'))?.title}".`
        }
      ],

      priorityRecommendations: {
        immediate: [
          `Launch "${scenario.ideas.find(i => i.quadrant === 'quick-wins')?.title}" to establish early momentum`,
          `Begin architecture planning for "${scenario.ideas.find(i => i.quadrant === 'major-projects')?.title}"`,
          `Establish ${scenario.context.keyMetrics[0]} tracking and measurement framework`
        ],
        shortTerm: [
          `Execute ${scenario.ideas.filter(i => i.quadrant === 'quick-wins').length} quick-win initiatives for rapid ROI`,
          `Initiate development of primary major project: "${scenario.ideas.find(i => i.quadrant === 'major-projects')?.title}"`,
          `Address essential infrastructure: "${scenario.ideas.find(i => i.quadrant === 'thankless-tasks')?.title}"`
        ],
        longTerm: [
          `Scale successful initiatives across ${scenario.context.marketSegment.toLowerCase()}`,
          `Expand ${scenario.context.competitiveAdvantage.toLowerCase()} capabilities`,
          `Build strategic partnerships within ${scenario.industry.toLowerCase()} ecosystem`
        ]
      },

      riskAssessment: {
        highRisk: scenario.context.primaryChallenges.map(challenge => `${challenge} risk management`),
        opportunities: [
          `Market leadership in ${scenario.context.competitiveAdvantage.toLowerCase()}`,
          `${scenario.industry} industry disruption potential`,
          `Scalable ${scenario.type.toLowerCase()} architecture foundation`
        ]
      },



      // Add metadata for testing
      _mockMetadata: {
        scenarioId: scenario.id,
        selectedModel: modelSelection.model,
        modelReasoning: modelSelection.reasoning,
        complexity: scenario.complexity,
        aiTaskType: scenario.expectedAITaskType,
        generatedAt: new Date().toISOString()
      }
    }
  }

  /**
   * Convert mock scenario to IdeaCard format
   */
  static convertToIdeaCards(scenario: MockProjectScenario): IdeaCard[] {
    return scenario.ideas.map((idea, index) => ({
      id: `mock-${scenario.id}-${index}`,
      content: idea.title,
      details: idea.description,
      quadrant: idea.quadrant,
      x: this.getQuadrantPosition(idea.quadrant).x + (Math.random() * 20 - 10),
      y: this.getQuadrantPosition(idea.quadrant).y + (Math.random() * 20 - 10),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: 'mock-user',
      project_id: `mock-project-${scenario.id}`,
      priority: idea.quadrant === 'major-projects' ? 'strategic' : idea.quadrant === 'quick-wins' ? 'high' : 'moderate',
      created_by: 'mock-user',
      metadata: {
        effort: idea.effort,
        impact: idea.impact,
        mockData: true,
        scenarioId: scenario.id
      }
    }))
  }


  /**
   * Get top quadrant focus from ideas
   */
  private static getTopQuadrantFocus(ideas: MockIdea[]): string {
    const quadrantCounts = ideas.reduce((acc, idea) => {
      acc[idea.quadrant] = (acc[idea.quadrant] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topQuadrant = Object.entries(quadrantCounts)
      .sort(([,a], [,b]) => b - a)[0][0]

    switch (topQuadrant) {
      case 'quick-wins': return 'rapid value delivery'
      case 'major-projects': return 'strategic capability development'
      case 'fill-ins': return 'operational enhancement'
      case 'thankless-tasks': return 'infrastructure foundation'
      default: return 'strategic implementation'
    }
  }

  /**
   * Get position coordinates for quadrant
   */
  private static getQuadrantPosition(quadrant: string) {
    switch (quadrant) {
      case 'quick-wins': return { x: 750, y: 250 }
      case 'major-projects': return { x: 750, y: 750 }
      case 'fill-ins': return { x: 250, y: 250 }
      case 'thankless-tasks': return { x: 250, y: 750 }
      default: return { x: 500, y: 500 }
    }
  }

  /**
   * Get a random scenario for testing
   */
  static getRandomScenario(): MockProjectScenario {
    const scenarios = this.getProjectScenarios()
    return scenarios[Math.floor(Math.random() * scenarios.length)]
  }

  /**
   * Get scenario by complexity level
   */
  static getScenarioByComplexity(complexity: 'low' | 'medium' | 'high'): MockProjectScenario {
    const scenarios = this.getProjectScenarios()
    const matching = scenarios.filter(s => s.complexity === complexity)
    return matching[Math.floor(Math.random() * matching.length)]
  }

  /**
   * Test model routing with all scenarios
   */
  static testModelRouting(): Array<{scenario: string, selectedModel: string, reasoning: string}> {
    return this.getProjectScenarios().map(scenario => {
      const taskContext: TaskContext = {
        type: scenario.expectedAITaskType,
        complexity: scenario.expectedModelComplexity,
        ideaCount: scenario.ideas.length,
        hasFiles: false,
        hasImages: false,
        hasAudio: false,
        userTier: 'pro'
      }

      const modelSelection = OpenAIModelRouter.selectModel(taskContext)

      return {
        scenario: `${scenario.name} (${scenario.complexity})`,
        selectedModel: modelSelection.model,
        reasoning: modelSelection.reasoning
      }
    })
  }
}