/**
 * AI Idea Service Tests
 *
 * Critical tests for AI idea generation service that handles user-facing idea creation.
 * Tests ensure reliable idea generation, proper categorization, and intelligent fallbacks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AIIdeaService } from '../aiIdeaService'
import { logger } from '../../../utils/logger'

// Mock dependencies
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

// Mock fetch and disable MSW
const mockFetch = vi.fn()
const originalFetch = global.fetch

// Override fetch at the global level to bypass MSW
Object.defineProperty(global, 'fetch', {
  value: mockFetch,
  writable: true,
  configurable: true
})

describe('AIIdeaService', () => {
  let service: AIIdeaService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AIIdeaService({ baseUrl: 'https://test-api.com' })
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
      const customService = new AIIdeaService({ baseUrl: 'https://custom.com' })
      expect(customService).toBeDefined()
      expect(logger.debug).toHaveBeenCalledWith(
        '🧠 AI Idea Service initialized',
        { baseUrl: 'https://custom.com' }
      )
    })

    it('should use window origin in browser environment', () => {
      Object.defineProperty(window, 'location', {
        value: { origin: 'https://browser.com' },
        writable: true
      })

      const browserService = new AIIdeaService()
      expect(browserService).toBeDefined()
      expect(logger.debug).toHaveBeenCalledWith(
        '🧠 AI Idea Service initialized',
        { baseUrl: 'https://browser.com' }
      )
    })

    it('should default to localhost in Node environment', () => {
      const originalWindow = global.window
      delete (global as any).window

      const nodeService = new AIIdeaService()
      expect(nodeService).toBeDefined()
      expect(logger.debug).toHaveBeenCalledWith(
        '🧠 AI Idea Service initialized',
        { baseUrl: 'http://localhost:3000' }
      )

      global.window = originalWindow
    })
  })

  describe('Single Idea Generation', () => {
    it('should generate a single idea successfully', async () => {
      const mockApiResponse = {
        ideas: [{
          title: 'User Dashboard',
          description: 'Interactive user dashboard with analytics',
          impact: 'high',
          effort: 'medium'
        }]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })

      const result = await service.generateIdea('Dashboard', {
        name: 'Test Project',
        description: 'A test project',
        type: 'Web Application'
      })

      expect(result).toEqual({
        content: 'User Dashboard',
        details: 'Interactive user dashboard with analytics',
        priority: 'high'
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-api.com/api/ai/generate-ideas',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer placeholder-token'
          }),
          body: JSON.stringify({
            title: 'Dashboard',
            description: 'A test project',
            projectType: 'Web Application'
          })
        })
      )
    })

    it('should handle API failures gracefully with mock fallback', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      const result = await service.generateIdea('User Interface')

      expect(result).toBeDefined()
      expect(result.content).toBe('User Interface')
      expect(result.details).toContain('user experience enhancement')
      expect(['low', 'moderate', 'high']).toContain(result.priority)
      expect(logger.error).toHaveBeenCalledWith('Error generating idea:', expect.any(Error))
    })

    it('should handle rate limiting errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429
      })

      const result = await service.generateIdea('API Integration')

      // Should fall back to mock since rate limited
      expect(result).toBeDefined()
      expect(result.content).toBe('API Integration')
      expect(result.details).toContain('integration')
    })

    it('should handle empty API response with mock fallback', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ideas: [] })
      })

      const result = await service.generateIdea('Analytics')

      expect(result).toBeDefined()
      expect(result.content).toBe('Analytics')
      expect(result.details).toContain('analytics')
    })
  })

  describe('Multiple Idea Generation', () => {
    it('should generate multiple ideas successfully', async () => {
      const mockApiResponse = {
        ideas: [
          { title: 'User Auth', description: 'Authentication system', impact: 'high', effort: 'low' },
          { title: 'Data Analytics', description: 'Analytics dashboard', impact: 'high', effort: 'high' },
          { title: 'Email System', description: 'Email notifications', impact: 'medium', effort: 'low' }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })

      const result = await service.generateMultipleIdeas(
        'Web App',
        'A modern web application',
        'SaaS',
        3,
        75
      )

      expect(result).toHaveLength(3)
      expect(result[0]).toMatchObject({
        content: 'User Auth',
        details: 'Authentication system',
        priority: 'strategic', // high impact, low effort
        created_by: 'ai-assistant'
      })
      expect(result[1]).toMatchObject({
        content: 'Data Analytics',
        details: 'Analytics dashboard',
        priority: 'innovation', // high impact, high effort
        created_by: 'ai-assistant'
      })

      // Verify API call
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-api.com/api/ai/generate-ideas',
        expect.objectContaining({
          body: JSON.stringify({
            title: 'Web App',
            description: 'A modern web application',
            projectType: 'SaaS',
            count: 3,
            tolerance: 75
          })
        })
      )
    })

    it('should generate ideas with proper positioning based on quadrants', async () => {
      const mockApiResponse = {
        ideas: [
          { title: 'Quick Win', description: 'Easy feature', impact: 'high', effort: 'low' },
          { title: 'Major Project', description: 'Complex feature', impact: 'high', effort: 'high' },
          { title: 'Fill In', description: 'Small feature', impact: 'low', effort: 'low' },
          { title: 'Thankless Task', description: 'Infrastructure', impact: 'low', effort: 'high' }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })

      const result = await service.generateMultipleIdeas('Test', 'Test project', 'General', 4)

      // Quick win should be in top-left quadrant (low x, low y)
      expect(result[0].x).toBeLessThan(260)
      expect(result[0].y).toBeLessThan(260)

      // Major project should be in top-right quadrant (high x, low y)
      expect(result[1].x).toBeGreaterThan(260)
      expect(result[1].y).toBeLessThan(260)

      // Fill in should be in bottom-left quadrant (low x, high y)
      expect(result[2].x).toBeLessThan(260)
      expect(result[2].y).toBeGreaterThan(260)

      // Thankless task should be in bottom-right quadrant (high x, high y)
      expect(result[3].x).toBeGreaterThan(260)
      expect(result[3].y).toBeGreaterThan(260)
    })

    it('should use mock ideas when API fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await service.generateMultipleIdeas('Test Project', 'Description', 'SaaS', 5)

      expect(result).toHaveLength(5)
      expect(result[0].content).toBe('Quick Setup Process')
      expect(result[1].content).toBe('Advanced Analytics Dashboard')
      expect(logger.warn).toHaveBeenCalledWith('🚫 AI generation failed, using mock:', expect.any(Error))
    })
  })

  describe('Project Idea Generation', () => {
    it('should generate project ideas successfully', async () => {
      const mockApiResponse = {
        ideas: [
          { title: 'Core Feature', description: 'Main functionality', impact: 'high', effort: 'medium' },
          { title: 'User Experience', description: 'UI improvements', impact: 'medium', effort: 'low' }
        ]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      })

      const result = await service.generateProjectIdeas(
        'E-commerce Platform',
        'Online shopping platform',
        'E-commerce',
        2,
        60
      )

      expect(result).toHaveLength(2)
      expect(result[0].content).toBe('Core Feature')
      expect(result[0].details).toBe('Main functionality')
      expect(result[0].priority).toBe('high')

      // Verify correct endpoint and payload
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-api.com/api/ai/generate-project-ideas',
        expect.objectContaining({
          body: JSON.stringify({
            projectName: 'E-commerce Platform',
            description: 'Online shopping platform',
            projectType: 'E-commerce',
            count: 2,
            tolerance: 60
          })
        })
      )
    })

    it('should use enhanced mock ideas for software projects', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API error'))

      const result = await service.generateProjectIdeas(
        'Software App',
        'A software application',
        'Software',
        4
      )

      expect(result).toHaveLength(4)
      expect(result[0].content).toBe('User Authentication System')
      expect(result[0].details).toContain('Software App')
      expect(result[0].details).toContain('A software application')
      expect(logger.warn).toHaveBeenCalledWith(
        '🚫 Project idea generation failed, using enhanced mock:',
        expect.any(Error)
      )
    })

    it('should use marketing templates for marketing projects', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API error'))

      const result = await service.generateProjectIdeas(
        'Marketing Campaign',
        'Brand awareness campaign',
        'Marketing',
        3
      )

      expect(result).toHaveLength(3)
      expect(result[0].content).toBe('Social Media Campaign')
      expect(result[0].details).toContain('Marketing Campaign')
      expect(result[0].details).toContain('Brand awareness campaign')
    })

    it('should use generic templates for unknown project types', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API error'))

      const result = await service.generateProjectIdeas(
        'Custom Project',
        'A custom project',
        'Unknown',
        3
      )

      expect(result).toHaveLength(3)
      expect(result[0].content).toBe('Project Planning Framework')
      expect(result[0].details).toContain('Custom Project')
    })
  })

  describe('Priority Mapping Logic', () => {
    it('should map high impact + low effort to strategic priority', async () => {
      const mockResponse = {
        ideas: [{ title: 'Test', description: 'Test', impact: 'high', effort: 'low' }]
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await service.generateMultipleIdeas('Test', 'Test', 'General', 1)
      expect(result[0].priority).toBe('strategic')
    })

    it('should map high impact + medium effort to high priority', async () => {
      const mockResponse = {
        ideas: [{ title: 'Test', description: 'Test', impact: 'high', effort: 'medium' }]
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await service.generateMultipleIdeas('Test', 'Test', 'General', 1)
      expect(result[0].priority).toBe('high')
    })

    it('should map high impact + high effort to innovation priority', async () => {
      const mockResponse = {
        ideas: [{ title: 'Test', description: 'Test', impact: 'high', effort: 'high' }]
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await service.generateMultipleIdeas('Test', 'Test', 'General', 1)
      expect(result[0].priority).toBe('innovation')
    })

    it('should map medium impact to moderate priority', async () => {
      const mockResponse = {
        ideas: [{ title: 'Test', description: 'Test', impact: 'medium', effort: 'low' }]
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await service.generateMultipleIdeas('Test', 'Test', 'General', 1)
      expect(result[0].priority).toBe('moderate')
    })

    it('should map low impact to low priority', async () => {
      const mockResponse = {
        ideas: [{ title: 'Test', description: 'Test', impact: 'low', effort: 'medium' }]
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await service.generateMultipleIdeas('Test', 'Test', 'General', 1)
      expect(result[0].priority).toBe('low')
    })
  })

  describe('Quadrant Mapping Logic', () => {
    it('should correctly map effort/impact combinations to quadrants', async () => {
      const mockResponse = {
        ideas: [
          { title: 'Quick Win', description: 'Test', impact: 'high', effort: 'low' },
          { title: 'Major Project', description: 'Test', impact: 'high', effort: 'high' },
          { title: 'Fill In', description: 'Test', impact: 'low', effort: 'low' },
          { title: 'Thankless', description: 'Test', impact: 'low', effort: 'high' }
        ]
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await service.generateMultipleIdeas('Test', 'Test', 'General', 4)

      // Verify positioning matches expected quadrants
      expect(result[0].x).toBeLessThan(260) // Quick win: left side
      expect(result[0].y).toBeLessThan(260) // Quick win: top side

      expect(result[1].x).toBeGreaterThan(260) // Major project: right side
      expect(result[1].y).toBeLessThan(260) // Major project: top side

      expect(result[2].x).toBeLessThan(260) // Fill in: left side
      expect(result[2].y).toBeGreaterThan(260) // Fill in: bottom side

      expect(result[3].x).toBeGreaterThan(260) // Thankless: right side
      expect(result[3].y).toBeGreaterThan(260) // Thankless: bottom side
    })

    it('should handle medium values correctly', async () => {
      const mockResponse = {
        ideas: [
          { title: 'Medium Impact', description: 'Test', impact: 'medium', effort: 'high' },
          { title: 'Medium Effort', description: 'Test', impact: 'high', effort: 'medium' }
        ]
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await service.generateMultipleIdeas('Test', 'Test', 'General', 2)

      // Medium impact + high effort should go to major projects (right side)
      expect(result[0].x).toBeGreaterThan(260)

      // High impact + medium effort should go to major projects (right side)
      expect(result[1].x).toBeGreaterThan(260)
    })
  })

  describe('Caching Behavior', () => {
    it('should use proper cache keys for single idea generation', async () => {
      const { aiCache } = await import('../../aiCache')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ideas: [{ title: 'Test', description: 'Test', impact: 'medium', effort: 'low' }] })
      })

      await service.generateIdea('Test Idea', { name: 'Project', type: 'Web' })

      expect(aiCache.getOrSet).toHaveBeenCalledWith(
        expect.stringContaining('generateIdea'),
        expect.any(Function),
        10 * 60 * 1000 // 10 minute cache
      )
    })

    it('should use proper cache keys for multiple ideas with all parameters', async () => {
      const { AICache } = await import('../../aiCache')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ideas: [{ title: 'Test', description: 'Test', impact: 'medium', effort: 'low' }] })
      })

      await service.generateMultipleIdeas('Project', 'Description', 'SaaS', 5, 75)

      expect(AICache.generateKey).toHaveBeenCalledWith(
        'generateMultipleIdeas',
        expect.objectContaining({
          title: 'Project',
          description: 'Description',
          projectType: 'SaaS',
          count: 5,
          tolerance: 75
        })
      )
    })

    it('should use longer cache for project ideas', async () => {
      const { aiCache } = await import('../../aiCache')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ideas: [] })
      })

      await service.generateProjectIdeas('Project', 'Description', 'Type', 8, 50)

      expect(aiCache.getOrSet).toHaveBeenCalledWith(
        expect.stringContaining('generateProjectIdeas'),
        expect.any(Function),
        20 * 60 * 1000 // 20 minute cache
      )
    })
  })

  describe('Mock Idea Generation Intelligence', () => {
    it('should categorize user interface related titles correctly', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API error'))

      const result = await service.generateIdea('user interface design')

      expect(result.content).toBe('User interface design')
      expect(result.details.toLowerCase()).toContain('user experience')
    })

    it('should categorize API related titles correctly', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API error'))

      const result = await service.generateIdea('API integration')

      expect(result.content).toBe('API integration')
      expect(result.details.toLowerCase()).toContain('integration')
    })

    it('should categorize data/analytics related titles correctly', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API error'))

      const result = await service.generateIdea('data analytics dashboard')

      expect(result.content).toBe('Data analytics dashboard')
      expect(result.details.toLowerCase()).toContain('analytics')
    })

    it('should provide generic suggestions for unrecognized categories', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API error'))

      const result = await service.generateIdea('unknown feature')

      expect(result.content).toBe('Unknown feature')
      expect(result.details).toContain('functionality')
    })
  })

  describe('Error Handling', () => {
    it('should handle network failures gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await service.generateIdea('Test Feature')

      expect(result).toBeDefined()
      expect(result.content).toBe('Test Feature')
      expect(logger.error).toHaveBeenCalledWith('Error generating idea:', expect.any(Error))
    })

    it('should handle rate limiting with proper error messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429
      })

      // For single idea - should fall back to mock
      const result = await service.generateIdea('Test')
      expect(result).toBeDefined()

      // For multiple ideas - should also fall back
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429
      })

      const multipleResult = await service.generateMultipleIdeas('Test', 'Test', 'General', 3)
      expect(multipleResult).toHaveLength(3)
    })

    it('should handle server errors correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      const result = await service.generateMultipleIdeas('Test', 'Test', 'General', 2)
      expect(result).toHaveLength(2)
      expect(logger.warn).toHaveBeenCalledWith('🚫 AI generation failed, using mock:', expect.any(Error))
    })
  })

  describe('Authentication', () => {
    it('should include proper authentication headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ideas: [] })
      })

      await service.generateIdea('Test')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer placeholder-token'
          })
        })
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty project context gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ideas: [] })
      })

      const result = await service.generateIdea('Test Feature')

      expect(result).toBeDefined()
      expect(result.content).toBe('Test Feature')
    })

    it('should handle zero count for multiple ideas', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ideas: [] })
      })

      const result = await service.generateMultipleIdeas('Test', 'Test', 'General', 0)

      expect(result).toHaveLength(0)
    })

    it('should handle missing project type gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ideas: [] })
      })

      const result = await service.generateProjectIdeas('Project', 'Description')

      expect(result).toBeDefined()

      const fetchCall = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)
      expect(requestBody.projectType).toBe('General')
    })

    it('should generate random positions within quadrant boundaries', async () => {
      const mockResponse = {
        ideas: Array(10).fill(null).map((_, i) => ({
          title: `Idea ${i}`,
          description: 'Test',
          impact: 'high',
          effort: 'low' // All quick wins
        }))
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await service.generateMultipleIdeas('Test', 'Test', 'General', 10)

      // All should be in quick-wins quadrant but with different positions
      const positions = result.map(idea => ({ x: idea.x, y: idea.y }))
      const uniquePositions = new Set(positions.map(p => `${p.x},${p.y}`))

      // Should have some variation in positions (not all identical)
      expect(uniquePositions.size).toBeGreaterThan(1)

      // All should be in top-left quadrant (quick wins)
      result.forEach(idea => {
        expect(idea.x).toBeLessThan(260)
        expect(idea.y).toBeLessThan(260)
        expect(idea.x).toBeGreaterThan(50) // Within margins
        expect(idea.y).toBeGreaterThan(50)
      })
    })
  })

  describe('Logging', () => {
    it('should log idea generation attempts', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ideas: [] })
      })

      await service.generateIdea('Test Feature')

      expect(logger.debug).toHaveBeenCalledWith('🧠 Generating idea for: "Test Feature"')
    })

    it('should log multiple idea generation with details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ideas: [] })
      })

      await service.generateMultipleIdeas('Project', 'Description', 'SaaS', 5, 75)

      expect(logger.debug).toHaveBeenCalledWith(
        '🧠 Generating 5 ideas for project: "Project" with 75% tolerance'
      )
    })

    it('should log enhanced project idea generation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ideas: [] })
      })

      await service.generateProjectIdeas('Test Project', 'Description')

      expect(logger.debug).toHaveBeenCalledWith(
        '🚀 Generating enhanced project ideas for: "Test Project"'
      )
    })
  })
})