/**
 * AI Insights Service Tests
 *
 * Critical tests for AI insights generation service that handles expensive API calls.
 * Proper testing prevents costly API failures and ensures quality insights generation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AIInsightsService } from '../aiInsightsService'
import { OpenAIModelRouter } from '../openaiModelRouter'
import { IdeaCard } from '../../../types'
import { logger } from '../../../utils/logger'

// Mock dependencies
vi.mock('../openaiModelRouter')
vi.mock('../../../utils/logger')
vi.mock('../../aiCache', () => ({
  aiCache: {
    getOrSet: vi.fn((key, callback) => callback()),
    generateKey: vi.fn((operation, params) => `cache_key_${operation}_${JSON.stringify(params)}`)
  },
  AICache: {
    generateKey: vi.fn((operation, params) => `cache_key_${operation}_${JSON.stringify(params)}`)
  }
}))
vi.mock('../../fileService', () => ({
  FileService: {
    getProjectFiles: vi.fn(() => Promise.resolve([]))
  }
}))
vi.mock('../../database', () => ({
  DatabaseService: {
    getProjectRoadmaps: vi.fn(() => Promise.resolve([]))
  }
}))

// Mock fetch and disable MSW
const mockFetch = vi.fn()
const originalFetch = global.fetch

// Override fetch at the global level to bypass MSW
Object.defineProperty(global, 'fetch', {
  value: mockFetch,
  writable: true,
  configurable: true
})

describe('AIInsightsService', () => {
  let service: AIInsightsService
  let mockModelSelection: any

  const sampleIdeas: IdeaCard[] = [
    {
      id: '1',
      content: 'User authentication system',
      details: 'Implement secure login with OAuth',
      x: 100,
      y: 100,
      priority: 'high',
      created_by: 'user1',
      created_at: '2023-01-01',
      updated_at: '2023-01-01'
    },
    {
      id: '2',
      content: 'Dashboard analytics',
      details: 'Real-time metrics display',
      x: 400,
      y: 200,
      priority: 'medium',
      created_by: 'user1',
      created_at: '2023-01-01',
      updated_at: '2023-01-01'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mock responses
    mockModelSelection = {
      model: 'gpt-5',
      temperature: 1,
      maxTokens: 6000,
      reasoning: 'Strategic insights require advanced reasoning',
      cost: 'medium'
    }

    vi.mocked(OpenAIModelRouter.selectModel).mockReturnValue(mockModelSelection)
    vi.mocked(OpenAIModelRouter.analyzeComplexity).mockReturnValue('medium')
    vi.mocked(OpenAIModelRouter.logSelection).mockImplementation(() => {})

    service = new AIInsightsService({ baseUrl: 'https://test-api.com' })
  })

  afterEach(() => {
    vi.resetAllMocks()
    mockFetch.mockReset()
    // Ensure fetch is properly mocked for next test
    Object.defineProperty(global, 'fetch', {
      value: mockFetch,
      writable: true,
      configurable: true
    })
  })

  describe('Service Initialization', () => {
    it('should initialize with provided base URL', () => {
      const customService = new AIInsightsService({ baseUrl: 'https://custom.com' })
      expect(customService).toBeDefined()
      expect(logger.debug).toHaveBeenCalledWith(
        '🔍 AI Insights Service initialized',
        { baseUrl: 'https://custom.com' }
      )
    })

    it('should use window origin in browser environment', () => {
      // Mock window object
      Object.defineProperty(window, 'location', {
        value: { origin: 'https://browser.com' },
        writable: true
      })

      const browserService = new AIInsightsService()
      expect(browserService).toBeDefined()
      expect(logger.debug).toHaveBeenCalledWith(
        '🔍 AI Insights Service initialized',
        { baseUrl: 'https://browser.com' }
      )
    })

    it('should default to localhost in Node environment', () => {
      // Remove window object
      const originalWindow = global.window
      delete (global as any).window

      const nodeService = new AIInsightsService()
      expect(nodeService).toBeDefined()
      expect(logger.debug).toHaveBeenCalledWith(
        '🔍 AI Insights Service initialized',
        { baseUrl: 'http://localhost:3000' }
      )

      // Restore window
      global.window = originalWindow
    })
  })

  describe('Model Selection Integration', () => {
    it('should use OpenAI model router for optimal model selection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          insights: {
            executiveSummary: 'Test summary',
            keyInsights: [],
            priorityRecommendations: { immediate: [], shortTerm: [], longTerm: [] }
          }
        })
      })

      await service.generateInsights(sampleIdeas, 'Test Project', 'SaaS')

      expect(OpenAIModelRouter.analyzeComplexity).toHaveBeenCalledWith({
        ideaCount: 2,
        hasFiles: false,
        hasImages: false,
        hasAudio: false,
        projectType: 'SaaS',
        documentCount: 0
      })

      expect(OpenAIModelRouter.selectModel).toHaveBeenCalledWith({
        type: 'strategic-insights',
        complexity: 'medium',
        ideaCount: 2,
        hasFiles: false,
        hasImages: false,
        hasAudio: false,
        userTier: 'pro'
      })

      expect(OpenAIModelRouter.logSelection).toHaveBeenCalled()
    })

    it('should override model selection when user specifies preferred model', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          insights: {
            executiveSummary: 'Test summary',
            keyInsights: [],
            priorityRecommendations: { immediate: [], shortTerm: [], longTerm: [] }
          }
        })
      })

      await service.generateInsights(sampleIdeas, 'Test Project', 'SaaS', 'project1', null, 'gpt-5-mini')

      // Verify the API request includes the overridden model
      const fetchCall = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)

      expect(requestBody.modelSelection.model).toBe('gpt-5-mini')
      expect(requestBody.modelSelection.reasoning).toContain('User selected gpt-5-mini')
      expect(logger.debug).toHaveBeenCalledWith('🎛️ User selected model override:', 'gpt-5-mini')
    })

    it('should upgrade to GPT-5 for multimodal content', async () => {
      // Mock file service to return image files
      const { FileService } = await import('../../fileService')
      vi.mocked(FileService.getProjectFiles).mockResolvedValue([
        {
          id: '1',
          name: 'image.png',
          mime_type: 'image/png',
          file_type: 'image',
          content_preview: 'Image content',
          storage_path: '/path/to/image.png',
          file_size: 1024,
          project_id: 'project1',
          created_at: '2023-01-01',
          updated_at: '2023-01-01'
        }
      ])

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          insights: {
            executiveSummary: 'Test summary with images',
            keyInsights: [],
            priorityRecommendations: { immediate: [], shortTerm: [], longTerm: [] }
          }
        })
      })

      await service.generateInsights(sampleIdeas, 'Test Project', 'SaaS', 'project1')

      expect(OpenAIModelRouter.analyzeComplexity).toHaveBeenCalledWith(
        expect.objectContaining({
          hasImages: true,
          hasFiles: true
        })
      )
    })
  })

  describe('Caching Behavior', () => {
    it('should generate proper cache keys including model selection', async () => {
      const { aiCache } = await import('../../aiCache')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          insights: {
            executiveSummary: 'Test summary',
            keyInsights: [],
            priorityRecommendations: { immediate: [], shortTerm: [], longTerm: [] }
          }
        })
      })

      await service.generateInsights(sampleIdeas, 'Test Project', 'SaaS', 'project1')

      expect(aiCache.getOrSet).toHaveBeenCalledWith(
        expect.stringContaining('generateInsights'),
        expect.any(Function),
        20 * 60 * 1000 // 20 minute cache
      )
    })

    it('should include model in cache key to prevent cross-contamination', async () => {
      const { AICache } = await import('../../aiCache')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          insights: {
            executiveSummary: 'Test summary',
            keyInsights: [],
            priorityRecommendations: { immediate: [], shortTerm: [], longTerm: [] }
          }
        })
      })

      await service.generateInsights(sampleIdeas, 'Test Project', 'SaaS', 'project1')

      expect(AICache.generateKey).toHaveBeenCalledWith(
        'generateInsights',
        expect.objectContaining({
          model: 'gpt-5',
          complexity: 'medium',
          version: 'v3-smart-routing'
        })
      )
    })
  })

  describe('Error Handling and Fallbacks', () => {
    it('should handle rate limiting errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429
      })

      await expect(
        service.generateInsights(sampleIdeas, 'Test Project', 'SaaS')
      ).rejects.toThrow('Rate limit exceeded. Please wait a moment before trying again.')
    })

    it('should handle server errors with appropriate messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      await expect(
        service.generateInsights(sampleIdeas, 'Test Project', 'SaaS')
      ).rejects.toThrow('Server error: 500')
    })

    it('should use intelligent mock data in development environment', async () => {
      // Create localhost service to trigger development mode
      const devService = new AIInsightsService({ baseUrl: 'http://localhost:3000' })

      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await devService.generateInsights(sampleIdeas, 'Test Project', 'SaaS')

      expect(result).toBeDefined()
      expect(result.executiveSummary).toContain('Test Project')
      expect(result.keyInsights).toBeDefined()
      expect(result.priorityRecommendations).toBeDefined()
      expect(logger.warn).toHaveBeenCalledWith(
        '🔧 Using intelligent mock insights for development and testing'
      )
    })

    it('should throw errors in production environment', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(
        service.generateInsights(sampleIdeas, 'Test Project', 'SaaS')
      ).rejects.toThrow('Failed to generate insights: Network error')
    })
  })

  describe('Response Validation', () => {
    it('should accept valid insight format', async () => {
      const validInsights = {
        executiveSummary: 'Valid project analysis',
        keyInsights: [
          { insight: 'Test insight', impact: 'Positive impact' }
        ],
        priorityRecommendations: {
          immediate: ['Action 1'],
          shortTerm: ['Action 2'],
          longTerm: ['Action 3']
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ insights: validInsights })
      })

      const result = await service.generateInsights(sampleIdeas, 'Test Project', 'SaaS')

      expect(result).toEqual(validInsights)
      expect(logger.debug).toHaveBeenCalledWith('✅ Insights data in correct format')
    })

    it('should transform legacy insight format', async () => {
      const legacyInsights = {
        matrixAnalysis: {
          quickWins: ['Quick win 1', 'Quick win 2'],
          majorProjects: ['Major project 1']
        },
        priorityRecommendations: {
          immediate: ['Legacy action 1'],
          shortTerm: ['Legacy action 2'],
          longTerm: ['Legacy action 3']
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ insights: legacyInsights })
      })

      const result = await service.generateInsights(sampleIdeas, 'Test Project', 'SaaS')

      expect(result.executiveSummary).toContain('Strategic analysis')
      expect(result.keyInsights).toHaveLength(3)
      expect(result.priorityRecommendations).toEqual(legacyInsights.priorityRecommendations)
      expect(logger.debug).toHaveBeenCalledWith('🔄 Transforming legacy insights format')
    })

    it('should detect and reject inappropriate template content', async () => {
      const templateInsights = {
        executiveSummary: 'Analysis of the $5.7 billion women\'s health app market',
        keyInsights: [
          { insight: 'Market opportunity', impact: 'Focusing on untapped areas beyond the oversaturated menstrual tracking segment' }
        ],
        priorityRecommendations: {
          immediate: ['Invest $500,000 in development'],
          shortTerm: ['Build hyper-personalized content engine'],
          longTerm: ['Dominate market']
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ insights: templateInsights })
      })

      const result = await service.generateInsights(sampleIdeas, 'SaaS Project', 'SaaS')

      // Should use project-specific mock instead of template
      expect(result.executiveSummary).toContain('SaaS Project')
      expect(result.executiveSummary).not.toContain('women\'s health')
      expect(logger.warn).toHaveBeenCalledWith(
        '🔧 Using project-specific insights instead of generic template response'
      )
    })

    it('should reject invalid insight format', async () => {
      const invalidInsights = {
        invalidField: 'This is not a valid format'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ insights: invalidInsights })
      })

      await expect(
        service.generateInsights(sampleIdeas, 'Test Project', 'SaaS')
      ).rejects.toThrow('AI service returned invalid insights format')

      expect(logger.error).toHaveBeenCalledWith(
        '❌ AI service returned invalid insights format:',
        invalidInsights
      )
    })
  })

  describe('Context Building', () => {
    it('should build comprehensive project context', async () => {
      const mockProject = {
        name: 'Test Project',
        description: 'A test project',
        project_type: 'SaaS',
        start_date: '2023-01-01',
        target_date: '2023-12-31',
        budget: 100000,
        team_size: 5,
        priority_level: 'high',
        tags: ['web', 'api'],
        ai_analysis: { score: 85 }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          insights: {
            executiveSummary: 'Test summary',
            keyInsights: [],
            priorityRecommendations: { immediate: [], shortTerm: [], longTerm: [] }
          }
        })
      })

      await service.generateInsights(sampleIdeas, 'Test Project', 'SaaS', 'project1', mockProject)

      const fetchCall = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)

      expect(requestBody.projectContext).toEqual({
        name: 'Test Project',
        description: 'A test project',
        type: 'SaaS',
        startDate: '2023-01-01',
        targetDate: '2023-12-31',
        budget: 100000,
        teamSize: 5,
        priorityLevel: 'high',
        tags: ['web', 'api'],
        aiAnalysis: { score: 85 }
      })
    })

    it('should include document context from project files', async () => {
      const { FileService } = await import('../../fileService')
      vi.mocked(FileService.getProjectFiles).mockResolvedValue([
        {
          id: '1',
          name: 'requirements.md',
          mime_type: 'text/markdown',
          file_type: 'document',
          content_preview: 'Project requirements content',
          storage_path: '/docs/requirements.md',
          file_size: 2048,
          project_id: 'project1',
          created_at: '2023-01-01',
          updated_at: '2023-01-01'
        }
      ])

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          insights: {
            executiveSummary: 'Test summary',
            keyInsights: [],
            priorityRecommendations: { immediate: [], shortTerm: [], longTerm: [] }
          }
        })
      })

      await service.generateInsights(sampleIdeas, 'Test Project', 'SaaS', 'project1')

      const fetchCall = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)

      expect(requestBody.documentContext).toHaveLength(1)
      expect(requestBody.documentContext[0]).toEqual({
        name: 'requirements.md',
        type: 'document',
        mimeType: 'text/markdown',
        content: 'Project requirements content',
        storagePath: '/docs/requirements.md'
      })
    })
  })

  describe('Quadrant Analysis', () => {
    it('should correctly map coordinates to quadrants', async () => {
      const testIdeas: IdeaCard[] = [
        { ...sampleIdeas[0], x: 100, y: 100 }, // quick-wins
        { ...sampleIdeas[1], x: 400, y: 100 }, // major-projects
        { ...sampleIdeas[0], x: 100, y: 400, id: '3' }, // fill-ins
        { ...sampleIdeas[1], x: 400, y: 400, id: '4' }  // thankless-tasks
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          insights: {
            executiveSummary: 'Test summary',
            keyInsights: [],
            priorityRecommendations: { immediate: [], shortTerm: [], longTerm: [] }
          }
        })
      })

      await service.generateInsights(testIdeas, 'Test Project', 'SaaS')

      const fetchCall = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)

      expect(requestBody.ideas[0].quadrant).toBe('quick-wins')
      expect(requestBody.ideas[1].quadrant).toBe('major-projects')
      expect(requestBody.ideas[2].quadrant).toBe('fill-ins')
      expect(requestBody.ideas[3].quadrant).toBe('thankless-tasks')
    })
  })

  describe('Risk Assessment', () => {
    it('should generate comprehensive risk assessment with dedicated task routing', async () => {
      const riskModelSelection = {
        model: 'gpt-5',
        temperature: 1,
        maxTokens: 7000,
        reasoning: 'Complex risk assessment requires advanced reasoning',
        cost: 'medium'
      }

      vi.mocked(OpenAIModelRouter.selectModel).mockReturnValue(riskModelSelection)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          insights: {
            riskAssessment: {
              risks: ['Technical complexity risk', 'Market timing risk'],
              mitigations: ['Phased development approach', 'Market research validation']
            }
          }
        })
      })

      const result = await service.generateComprehensiveRiskAssessment(
        sampleIdeas, 'Test Project', 'SaaS', 'project1'
      )

      expect(OpenAIModelRouter.selectModel).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'risk-assessment'
        })
      )

      expect(result.risks).toEqual(['Technical complexity risk', 'Market timing risk'])
      expect(result.mitigations).toEqual(['Phased development approach', 'Market research validation'])
    })

    it('should handle risk assessment API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      await expect(
        service.generateComprehensiveRiskAssessment(sampleIdeas, 'Test Project', 'SaaS')
      ).rejects.toThrow('Server error: 500')
    })
  })

  describe('Authentication', () => {
    it('should include proper authentication headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          insights: {
            executiveSummary: 'Test summary',
            keyInsights: [],
            priorityRecommendations: { immediate: [], shortTerm: [], longTerm: [] }
          }
        })
      })

      await service.generateInsights(sampleIdeas, 'Test Project', 'SaaS')

      const fetchCall = mockFetch.mock.calls[0]
      const headers = fetchCall[1].headers

      expect(headers['Content-Type']).toBe('application/json')
      expect(headers['Authorization']).toBe('Bearer placeholder-token')
    })
  })

  describe('Logging and Debugging', () => {
    it('should log insights request details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          insights: {
            executiveSummary: 'Test summary',
            keyInsights: [],
            priorityRecommendations: { immediate: [], shortTerm: [], longTerm: [] }
          }
        })
      })

      await service.generateInsights(sampleIdeas, 'Test Project', 'SaaS')

      expect(logger.debug).toHaveBeenCalledWith(
        '🚀 Sending AI insights request:',
        expect.objectContaining({
          ideaCount: 2,
          projectName: 'Test Project',
          projectType: 'SaaS'
        })
      )
    })

    it('should log insights response details', async () => {
      const mockInsights = {
        executiveSummary: 'Test summary',
        keyInsights: [{ insight: 'Test', impact: 'Impact' }],
        priorityRecommendations: { immediate: [], shortTerm: [], longTerm: [] }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ insights: mockInsights })
      })

      await service.generateInsights(sampleIdeas, 'Test Project', 'SaaS')

      expect(logger.debug).toHaveBeenCalledWith(
        '📥 Received AI insights response:',
        expect.objectContaining({
          hasExecutiveSummary: true,
          hasKeyInsights: true,
          keyInsightsCount: 1
        })
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty ideas array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          insights: {
            executiveSummary: 'Empty project analysis',
            keyInsights: [],
            priorityRecommendations: { immediate: [], shortTerm: [], longTerm: [] }
          }
        })
      })

      const result = await service.generateInsights([], 'Empty Project', 'SaaS')

      expect(result).toBeDefined()
      expect(OpenAIModelRouter.analyzeComplexity).toHaveBeenCalledWith(
        expect.objectContaining({ ideaCount: 0 })
      )
    })

    it('should handle null ideas parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          insights: {
            executiveSummary: 'Null analysis',
            keyInsights: [],
            priorityRecommendations: { immediate: [], shortTerm: [], longTerm: [] }
          }
        })
      })

      const result = await service.generateInsights(null as any, 'Null Project', 'SaaS')

      expect(result).toBeDefined()
    })

    it('should handle missing optional parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          insights: {
            executiveSummary: 'Minimal analysis',
            keyInsights: [],
            priorityRecommendations: { immediate: [], shortTerm: [], longTerm: [] }
          }
        })
      })

      const result = await service.generateInsights(sampleIdeas)

      expect(result).toBeDefined()

      const fetchCall = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)

      expect(requestBody.projectName).toBe('Project')
      expect(requestBody.projectType).toBe('General')
    })
  })
})