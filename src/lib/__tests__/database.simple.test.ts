import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase before any imports
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn(() => Promise.resolve({
      data: { id: 'test-id', content: 'Test Idea' },
      error: null
    })),
    then: vi.fn((resolve) => {
      resolve({ data: [], error: null })
      return Promise.resolve({ data: [], error: null })
    })
  }))
}

vi.mock('../supabase', () => ({
  supabase: mockSupabase
}))

import { DatabaseService } from '../database'

describe('DatabaseService - Basic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getIdeasByProject', () => {
    it('should call supabase correctly', async () => {
      await DatabaseService.getIdeasByProject('test-project-id')

      expect(mockSupabase.from).toHaveBeenCalledWith('ideas')
    })

    it('should handle successful response', async () => {
      const result = await DatabaseService.getIdeasByProject('test-project-id')

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })
  })

  describe('createIdea', () => {
    it('should create idea with correct data', async () => {
      const newIdea = {
        content: 'Test Idea',
        details: 'Test details',
        x: 100,
        y: 200,
        priority: 'high' as const,
        project_id: 'test-project-id',
        created_by: 'test-user-id'
      }

      const result = await DatabaseService.createIdea(newIdea)

      expect(mockSupabase.from).toHaveBeenCalledWith('ideas')
      expect(result.success).toBe(true)
    })
  })

  describe('getAllProjects', () => {
    it('should fetch projects', async () => {
      const result = await DatabaseService.getAllProjects()

      expect(mockSupabase.from).toHaveBeenCalledWith('projects')
      expect(Array.isArray(result)).toBe(true)
    })
  })
})