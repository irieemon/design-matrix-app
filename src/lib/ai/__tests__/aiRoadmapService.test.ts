/**
 * AI Roadmap Service Tests
 *
 * Comprehensive tests for roadmap generation, timeline calculations,
 * and project planning logic. Critical for ensuring quality AI-powered
 * roadmap generation with proper fallback mechanisms.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AIRoadmapService } from '../aiRoadmapService'
import { IdeaCard } from '../../../types'
import { logger } from '../../../utils/logger'
import { aiCache } from '../../aiCache'

// Mock dependencies
vi.mock('../../../utils/logger')
vi.mock('../../aiCache', () => ({
  aiCache: {
    getOrSet: vi.fn((key, callback) => callback()),
  },
  AICache: {
    generateKey: vi.fn((operation, params) => `cache_key_${operation}_${JSON.stringify(params)}`)
  }
}))

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch as any

describe('AIRoadmapService', () => {
  let service: AIRoadmapService

  const sampleIdeas: IdeaCard[] = [
    {
      id: '1',
      content: 'User Authentication',
      details: 'Implement secure login with OAuth 2.0',
      x: 150, y: 150,
      priority: 'high',
      created_by: 'user1',
      created_at: '2023-01-01',
      updated_at: '2023-01-01'
    },
    {
      id: '2',
      content: 'Dashboard Analytics',
      details: 'Real-time metrics and reporting',
      x: 350, y: 150,
      priority: 'high',
      created_by: 'user1',
      created_at: '2023-01-01',
      updated_at: '2023-01-01'
    },
    {
      id: '3',
      content: 'Email Notifications',
      details: 'Automated email alerts',
      x: 150, y: 350,
      priority: 'medium',
      created_by: 'user1',
      created_at: '2023-01-01',
      updated_at: '2023-01-01'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockClear()
    // Reset cache mock to always execute callback
    vi.mocked(aiCache.getOrSet).mockImplementation((key, callback) => callback())
    service = new AIRoadmapService({ baseUrl: 'https://test-api.com' })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Constructor and Initialization', () => {
    it('should initialize with provided baseUrl', () => {
      const customService = new AIRoadmapService({ baseUrl: 'https://custom.com' })
      expect(customService).toBeDefined()
    })

    it('should use window.location.origin in browser environment', () => {
      const windowSpy = vi.spyOn(global, 'window', 'get')
      windowSpy.mockReturnValue({ location: { origin: 'https://browser.com' } } as any)

      const browserService = new AIRoadmapService()
      expect(browserService).toBeDefined()

      windowSpy.mockRestore()
    })

    it('should default to localhost when window is undefined', () => {
      const windowSpy = vi.spyOn(global, 'window', 'get')
      windowSpy.mockReturnValue(undefined as any)

      const nodeService = new AIRoadmapService()
      expect(nodeService).toBeDefined()

      windowSpy.mockRestore()
    })
  })

  describe('Roadmap Generation - API Success', () => {
    beforeEach(() => {
      mockFetch.mockClear()
    })

    it('should generate roadmap from API successfully', async () => {
      const mockRoadmap = {
        roadmapAnalysis: {
          totalDuration: '12-16 weeks',
          phases: [
            {
              phase: 'Foundation',
              description: 'Setup and planning',
              duration: '3-4 weeks',
              epics: []
            }
          ]
        },
        executionStrategy: {
          methodology: 'Scrum',
          sprintLength: '2 weeks',
          teamRecommendations: 'Cross-functional team',
          keyMilestones: ['Kickoff', 'MVP', 'Launch']
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ roadmap: mockRoadmap })
      })

      const result = await service.generateRoadmap(sampleIdeas, 'Test Project', 'Software')

      expect(result).toEqual(mockRoadmap)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-api.com/api/ai/generate-roadmap-v2',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer placeholder-token'
          })
        })
      )
    })

    it('should map ideas to correct quadrants', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          roadmap: {
            roadmapAnalysis: { totalDuration: '12 weeks', phases: [] },
            executionStrategy: { methodology: 'Agile', sprintLength: '2 weeks', teamRecommendations: '', keyMilestones: [] }
          }
        })
      })

      await service.generateRoadmap(sampleIdeas, 'Test Project')

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)

      expect(callBody.ideas[0].quadrant).toBe('quick-wins') // x < 260, y < 260
      expect(callBody.ideas[1].quadrant).toBe('major-projects') // x >= 260, y < 260
      expect(callBody.ideas[2].quadrant).toBe('fill-ins') // x < 260, y >= 260
    })

    it('should use cache key based on ideas and project info', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          roadmap: {
            roadmapAnalysis: { totalDuration: '12 weeks', phases: [] },
            executionStrategy: { methodology: 'Agile', sprintLength: '2 weeks', teamRecommendations: '', keyMilestones: [] }
          }
        })
      })

      await service.generateRoadmap(sampleIdeas, 'My Project', 'Software')

      expect(aiCache.getOrSet).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        25 * 60 * 1000 // 25 minute cache
      )
    })
  })

  describe('Roadmap Generation - Error Handling', () => {
    beforeEach(() => {
      mockFetch.mockClear()
    })

    it('should fallback to mock roadmap on API error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await service.generateRoadmap(sampleIdeas, 'Test Project', 'Software')

      expect(result.roadmapAnalysis).toBeDefined()
      expect(result.executionStrategy).toBeDefined()
      expect(result.roadmapAnalysis.phases.length).toBeGreaterThan(0)
    })

    it('should handle 429 rate limit error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429
      })

      await expect(
        service.generateRoadmap(sampleIdeas, 'Test Project')
      ).rejects.toThrow('Rate limit exceeded')
    })

    it('should handle generic server errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      const result = await service.generateRoadmap(sampleIdeas, 'Test Project')

      // Should fallback to mock roadmap
      expect(result.roadmapAnalysis).toBeDefined()
      expect(result.executionStrategy).toBeDefined()
    })

    it('should transform legacy roadmap format', async () => {
      const legacyRoadmap = {
        timeline: '6-8 months',
        phases: [{ phase: 'Test', description: 'Test phase', duration: '2 weeks', epics: [] }],
        methodology: 'Kanban',
        sprintLength: '1 week',
        teamRecommendations: 'Small team',
        keyMilestones: ['Start', 'End']
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ roadmap: legacyRoadmap })
      })

      const result = await service.generateRoadmap(sampleIdeas, 'Test Project')

      expect(result.roadmapAnalysis.totalDuration).toBe('6-8 months')
      expect(result.roadmapAnalysis.phases).toEqual(legacyRoadmap.phases)
      expect(result.executionStrategy.methodology).toBe('Kanban')
    })
  })

  describe('Enhanced Roadmap with Context', () => {
    beforeEach(() => {
      mockFetch.mockClear()
    })

    it('should adjust timeline for small team size', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          roadmap: {
            roadmapAnalysis: { totalDuration: '12 weeks', phases: [] },
            executionStrategy: { methodology: 'Agile', sprintLength: '2 weeks', teamRecommendations: 'Team', keyMilestones: [] }
          }
        })
      })

      const result = await service.generateEnhancedRoadmap(
        sampleIdeas,
        'Test Project',
        'Software',
        { teamSize: 2 }
      )

      expect(result.roadmapAnalysis.totalDuration).toBe('16-24 weeks')
    })

    it('should adjust timeline for large team size', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          roadmap: {
            roadmapAnalysis: { totalDuration: '12 weeks', phases: [] },
            executionStrategy: { methodology: 'Agile', sprintLength: '2 weeks', teamRecommendations: 'Team', keyMilestones: [] }
          }
        })
      })

      const result = await service.generateEnhancedRoadmap(
        sampleIdeas,
        'Test Project',
        'Software',
        { teamSize: 10 }
      )

      expect(result.roadmapAnalysis.totalDuration).toBe('8-12 weeks')
    })

    it('should adjust methodology for small teams', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          roadmap: {
            roadmapAnalysis: { totalDuration: '12 weeks', phases: [] },
            executionStrategy: { methodology: 'Scrum', sprintLength: '2 weeks', teamRecommendations: 'Team', keyMilestones: [] }
          }
        })
      })

      const result = await service.generateEnhancedRoadmap(
        sampleIdeas,
        'Test Project',
        'Software',
        { teamSize: 3 }
      )

      expect(result.executionStrategy.methodology).toBe('Lean Startup')
      expect(result.executionStrategy.sprintLength).toBe('1 week')
    })

    it('should adjust methodology for high priority projects', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          roadmap: {
            roadmapAnalysis: { totalDuration: '12 weeks', phases: [] },
            executionStrategy: { methodology: 'Scrum', sprintLength: '2 weeks', teamRecommendations: 'Team', keyMilestones: [] }
          }
        })
      })

      const result = await service.generateEnhancedRoadmap(
        sampleIdeas,
        'Test Project',
        'Software',
        { priority: 'high', teamSize: 7 }
      )

      expect(result.executionStrategy.methodology).toBe('Scrumban')
      expect(result.executionStrategy.sprintLength).toBe('1 week')
    })

    it('should add budget tier to team recommendations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          roadmap: {
            roadmapAnalysis: { totalDuration: '12 weeks', phases: [] },
            executionStrategy: { methodology: 'Agile', sprintLength: '2 weeks', teamRecommendations: 'Cross-functional team', keyMilestones: [] }
          }
        })
      })

      const startupResult = await service.generateEnhancedRoadmap(
        sampleIdeas, 'Test', 'Software', { budget: 50000 }
      )
      expect(startupResult.executionStrategy.teamRecommendations).toContain('startup budget')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          roadmap: {
            roadmapAnalysis: { totalDuration: '12 weeks', phases: [] },
            executionStrategy: { methodology: 'Agile', sprintLength: '2 weeks', teamRecommendations: 'Cross-functional team', keyMilestones: [] }
          }
        })
      })

      const midMarketResult = await service.generateEnhancedRoadmap(
        sampleIdeas, 'Test', 'Software', { budget: 250000 }
      )
      expect(midMarketResult.executionStrategy.teamRecommendations).toContain('mid-market budget')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          roadmap: {
            roadmapAnalysis: { totalDuration: '12 weeks', phases: [] },
            executionStrategy: { methodology: 'Agile', sprintLength: '2 weeks', teamRecommendations: 'Cross-functional team', keyMilestones: [] }
          }
        })
      })

      const enterpriseResult = await service.generateEnhancedRoadmap(
        sampleIdeas, 'Test', 'Software', { budget: 1000000 }
      )
      expect(enterpriseResult.executionStrategy.teamRecommendations).toContain('enterprise budget')
    })
  })

  describe('Quadrant Position Mapping', () => {
    beforeEach(() => {
      mockFetch.mockClear()
      vi.mocked(aiCache.getOrSet).mockClear()
    })

    it('should map top-left to quick-wins', async () => {
      const ideas: IdeaCard[] = [
        { ...sampleIdeas[0], x: 100, y: 100 }
      ]

      let capturedBody: any = null
      vi.mocked(aiCache.getOrSet).mockImplementationOnce(async (key, callback) => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            roadmap: {
              roadmapAnalysis: { totalDuration: '12 weeks', phases: [] },
              executionStrategy: { methodology: 'Agile', sprintLength: '2 weeks', teamRecommendations: '', keyMilestones: [] }
            }
          })
        })

        const result = await callback()

        if (mockFetch.mock.calls.length > 0) {
          capturedBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        }

        return result
      })

      await service.generateRoadmap(ideas, 'Test_QuickWins')

      expect(capturedBody).not.toBeNull()
      expect(capturedBody.ideas[0].quadrant).toBe('quick-wins')
    })

    it('should map top-right to major-projects', async () => {
      const ideas: IdeaCard[] = [
        { ...sampleIdeas[0], x: 400, y: 100 }
      ]

      let capturedBody: any = null
      vi.mocked(aiCache.getOrSet).mockImplementationOnce(async (key, callback) => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            roadmap: {
              roadmapAnalysis: { totalDuration: '12 weeks', phases: [] },
              executionStrategy: { methodology: 'Agile', sprintLength: '2 weeks', teamRecommendations: '', keyMilestones: [] }
            }
          })
        })

        const result = await callback()

        if (mockFetch.mock.calls.length > 0) {
          capturedBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        }

        return result
      })

      await service.generateRoadmap(ideas, 'Test_MajorProjects')

      expect(capturedBody).not.toBeNull()
      expect(capturedBody.ideas[0].quadrant).toBe('major-projects')
    })

    it('should map bottom-left to fill-ins', async () => {
      const ideas: IdeaCard[] = [
        { ...sampleIdeas[0], x: 100, y: 400 }
      ]

      let capturedBody: any = null
      vi.mocked(aiCache.getOrSet).mockImplementationOnce(async (key, callback) => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            roadmap: {
              roadmapAnalysis: { totalDuration: '12 weeks', phases: [] },
              executionStrategy: { methodology: 'Agile', sprintLength: '2 weeks', teamRecommendations: '', keyMilestones: [] }
            }
          })
        })

        const result = await callback()

        if (mockFetch.mock.calls.length > 0) {
          capturedBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        }

        return result
      })

      await service.generateRoadmap(ideas, 'Test_FillIns')

      expect(capturedBody).not.toBeNull()
      expect(capturedBody.ideas[0].quadrant).toBe('fill-ins')
    })

    it('should map bottom-right to thankless-tasks', async () => {
      const ideas: IdeaCard[] = [
        { ...sampleIdeas[0], x: 400, y: 400 }
      ]

      let capturedBody: any = null
      vi.mocked(aiCache.getOrSet).mockImplementationOnce(async (key, callback) => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            roadmap: {
              roadmapAnalysis: { totalDuration: '12 weeks', phases: [] },
              executionStrategy: { methodology: 'Agile', sprintLength: '2 weeks', teamRecommendations: '', keyMilestones: [] }
            }
          })
        })

        const result = await callback()

        if (mockFetch.mock.calls.length > 0) {
          capturedBody = JSON.parse(mockFetch.mock.calls[0][1].body)
        }

        return result
      })

      await service.generateRoadmap(ideas, 'Test_ThanklessTasks')

      expect(capturedBody).not.toBeNull()
      expect(capturedBody.ideas[0].quadrant).toBe('thankless-tasks')
    })
  })

  describe('Mock Roadmap Generation - Software Projects', () => {
    beforeEach(() => {
      mockFetch.mockClear()
    })

    it('should generate software project roadmap with 4 phases', () => {
      mockFetch.mockRejectedValueOnce(new Error('API unavailable'))

      return service.generateRoadmap(sampleIdeas, 'My App', 'Software Platform').then(result => {
        expect(result.roadmapAnalysis.phases).toHaveLength(4)
        expect(result.roadmapAnalysis.totalDuration).toBe('14-18 weeks')
        expect(result.executionStrategy.methodology).toBe('Scrum')

        const phaseNames = result.roadmapAnalysis.phases.map(p => p.phase)
        expect(phaseNames).toContain('Foundation & Planning')
        expect(phaseNames).toContain('Core Development')
        expect(phaseNames).toContain('Testing & Optimization')
        expect(phaseNames).toContain('Launch & Monitoring')
      })
    })

    it('should include authentication and core features epics', () => {
      mockFetch.mockRejectedValueOnce(new Error('API unavailable'))

      return service.generateRoadmap(sampleIdeas, 'My App', 'Web Application').then(result => {
        const allEpics = result.roadmapAnalysis.phases.flatMap(p => p.epics)
        const epicTitles = allEpics.map(e => e.title)

        expect(epicTitles).toContain('User Authentication System')
        expect(epicTitles).toContain('Core Application Features')
      })
    })
  })

  describe('Mock Roadmap Generation - Marketing Projects', () => {
    beforeEach(() => {
      mockFetch.mockClear()
    })

    it('should generate marketing project roadmap with 3 phases', () => {
      mockFetch.mockRejectedValueOnce(new Error('API unavailable'))

      return service.generateRoadmap(sampleIdeas, 'Brand Campaign', 'Marketing Campaign').then(result => {
        expect(result.roadmapAnalysis.phases).toHaveLength(3)
        expect(result.roadmapAnalysis.totalDuration).toBe('8-12 weeks')
        expect(result.executionStrategy.methodology).toBe('Kanban')

        const phaseNames = result.roadmapAnalysis.phases.map(p => p.phase)
        expect(phaseNames).toContain('Strategy & Planning')
        expect(phaseNames).toContain('Content Creation')
        expect(phaseNames).toContain('Campaign Execution')
      })
    })

    it('should include market research epic', () => {
      mockFetch.mockRejectedValueOnce(new Error('API unavailable'))

      return service.generateRoadmap(sampleIdeas, 'Campaign', 'Marketing').then(result => {
        const allEpics = result.roadmapAnalysis.phases.flatMap(p => p.epics)
        const epicTitles = allEpics.map(e => e.title)

        expect(epicTitles).toContain('Market Research')
      })
    })
  })

  describe('Mock Roadmap Generation - Research Projects', () => {
    beforeEach(() => {
      mockFetch.mockClear()
    })

    it('should generate research project roadmap with 3 phases', () => {
      mockFetch.mockRejectedValueOnce(new Error('API unavailable'))

      return service.generateRoadmap(sampleIdeas, 'Market Study', 'Research Analysis').then(result => {
        expect(result.roadmapAnalysis.phases).toHaveLength(3)
        expect(result.roadmapAnalysis.totalDuration).toBe('10-14 weeks')
        expect(result.executionStrategy.methodology).toBe('Lean')

        const phaseNames = result.roadmapAnalysis.phases.map(p => p.phase)
        expect(phaseNames).toContain('Research Design')
        expect(phaseNames).toContain('Data Collection')
        expect(phaseNames).toContain('Analysis & Reporting')
      })
    })
  })

  describe('Mock Roadmap Generation - Generic Projects', () => {
    beforeEach(() => {
      mockFetch.mockClear()
    })

    it('should generate generic project roadmap with 3 phases', () => {
      mockFetch.mockRejectedValueOnce(new Error('API unavailable'))

      return service.generateRoadmap(sampleIdeas, 'My Project', 'General').then(result => {
        expect(result.roadmapAnalysis.phases).toHaveLength(3)
        expect(result.roadmapAnalysis.totalDuration).toBe('12-16 weeks')
        expect(result.executionStrategy.methodology).toBe('Agile')

        const phaseNames = result.roadmapAnalysis.phases.map(p => p.phase)
        expect(phaseNames).toContain('Planning & Setup')
        expect(phaseNames).toContain('Implementation')
        expect(phaseNames).toContain('Completion & Review')
      })
    })
  })

  describe('Epic Structure Validation', () => {
    beforeEach(() => {
      mockFetch.mockClear()
    })

    it('should include all required epic fields', () => {
      mockFetch.mockRejectedValueOnce(new Error('API unavailable'))

      return service.generateRoadmap(sampleIdeas, 'Test', 'Software').then(result => {
        const firstEpic = result.roadmapAnalysis.phases[0].epics[0]

        expect(firstEpic).toHaveProperty('title')
        expect(firstEpic).toHaveProperty('description')
        expect(firstEpic).toHaveProperty('priority')
        expect(firstEpic).toHaveProperty('complexity')
        expect(firstEpic).toHaveProperty('userStories')
        expect(firstEpic).toHaveProperty('deliverables')
        expect(firstEpic).toHaveProperty('relatedIdeas')

        expect(firstEpic.userStories).toBeInstanceOf(Array)
        expect(firstEpic.deliverables).toBeInstanceOf(Array)
        expect(firstEpic.relatedIdeas).toBeInstanceOf(Array)
      })
    })

    it('should have valid priority values', () => {
      mockFetch.mockRejectedValueOnce(new Error('API unavailable'))

      return service.generateRoadmap(sampleIdeas, 'Test', 'Software').then(result => {
        const allEpics = result.roadmapAnalysis.phases.flatMap(p => p.epics)

        allEpics.forEach(epic => {
          expect(['low', 'medium', 'high']).toContain(epic.priority)
        })
      })
    })

    it('should have valid complexity values', () => {
      mockFetch.mockRejectedValueOnce(new Error('API unavailable'))

      return service.generateRoadmap(sampleIdeas, 'Test', 'Software').then(result => {
        const allEpics = result.roadmapAnalysis.phases.flatMap(p => p.epics)

        allEpics.forEach(epic => {
          expect(['low', 'medium', 'high']).toContain(epic.complexity)
        })
      })
    })
  })

  describe('Execution Strategy', () => {
    beforeEach(() => {
      mockFetch.mockClear()
    })

    it('should include team recommendations', () => {
      mockFetch.mockRejectedValueOnce(new Error('API unavailable'))

      return service.generateRoadmap(sampleIdeas, 'Test Project', 'Software').then(result => {
        expect(result.executionStrategy.teamRecommendations).toBeTruthy()
        expect(result.executionStrategy.teamRecommendations).toContain('Test Project')
      })
    })

    it('should include key milestones', () => {
      mockFetch.mockRejectedValueOnce(new Error('API unavailable'))

      return service.generateRoadmap(sampleIdeas, 'Test', 'Software').then(result => {
        expect(result.executionStrategy.keyMilestones).toBeInstanceOf(Array)
        expect(result.executionStrategy.keyMilestones.length).toBeGreaterThan(0)
        expect(result.executionStrategy.keyMilestones).toContain('Project kickoff and team onboarding')
      })
    })

    it('should set appropriate sprint lengths', () => {
      mockFetch.mockRejectedValueOnce(new Error('API unavailable'))

      return service.generateRoadmap(sampleIdeas, 'Test', 'Software').then(result => {
        expect(['1 week', '2 weeks', '3 weeks', '4 weeks']).toContain(result.executionStrategy.sprintLength)
      })
    })
  })

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockFetch.mockClear()
    })

    it('should handle empty ideas array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          roadmap: {
            roadmapAnalysis: { totalDuration: '12 weeks', phases: [] },
            executionStrategy: { methodology: 'Agile', sprintLength: '2 weeks', teamRecommendations: '', keyMilestones: [] }
          }
        })
      })

      const result = await service.generateRoadmap([], 'Empty Project', 'Software')

      expect(result).toBeDefined()
      expect(result.roadmapAnalysis).toBeDefined()
    })

    it('should handle undefined project type', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API unavailable'))

      const result = await service.generateRoadmap(sampleIdeas, 'Test Project')

      expect(result).toBeDefined()
      expect(result.roadmapAnalysis).toBeDefined()
      expect(result.executionStrategy.methodology).toBe('Agile')
    })

    it('should handle ideas without details', async () => {
      const minimalIdeas: IdeaCard[] = [
        {
          id: '1',
          content: 'Simple idea',
          details: '',
          x: 100, y: 100,
          priority: 'low',
          created_by: 'user1',
          created_at: '2023-01-01',
          updated_at: '2023-01-01'
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          roadmap: {
            roadmapAnalysis: { totalDuration: '12 weeks', phases: [] },
            executionStrategy: { methodology: 'Agile', sprintLength: '2 weeks', teamRecommendations: '', keyMilestones: [] }
          }
        })
      })

      const result = await service.generateRoadmap(minimalIdeas, 'Test')

      expect(result).toBeDefined()
    })

    it('should handle null/undefined in context', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          roadmap: {
            roadmapAnalysis: { totalDuration: '12 weeks', phases: [] },
            executionStrategy: { methodology: 'Agile', sprintLength: '2 weeks', teamRecommendations: 'Team', keyMilestones: [] }
          }
        })
      })

      const result = await service.generateEnhancedRoadmap(
        sampleIdeas,
        'Test',
        'Software',
        { budget: undefined, teamSize: undefined }
      )

      expect(result).toBeDefined()
      expect(result.executionStrategy).toBeDefined()
    })
  })

  describe('Singleton Instance', () => {
    it('should export singleton instance', async () => {
      const { aiRoadmapService } = await import('../aiRoadmapService')

      expect(aiRoadmapService).toBeDefined()
      expect(aiRoadmapService).toBeInstanceOf(AIRoadmapService)
    })
  })
})
