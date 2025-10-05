/**
 * IdeaService Test Suite
 *
 * Comprehensive tests for IdeaService functionality including:
 * - CRUD operations (create, read, update, delete)
 * - Idea locking mechanism
 * - Lock timeout and cleanup
 * - Query filtering and sorting
 * - Error handling and validation
 * - Optimistic updates
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IdeaService } from '../IdeaService'
import type { IdeaCard, CreateIdeaInput } from '../../../types'

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  delete: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  lt: vi.fn(() => mockSupabase),
  not: vi.fn(() => mockSupabase),
  order: vi.fn(() => mockSupabase),
  limit: vi.fn(() => mockSupabase),
  in: vi.fn(() => mockSupabase),
  single: vi.fn(() => Promise.resolve({ data: null, error: null }))
}

vi.mock('../../supabase', () => ({
  supabase: mockSupabase
}))

vi.mock('../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

vi.mock('../../../utils/uuid', () => ({
  sanitizeProjectId: (id: string) => id.match(/^[0-9a-f-]+$/i) ? id : null
}))

describe('IdeaService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Mock crypto.randomUUID
    global.crypto = {
      randomUUID: () => '12345678-1234-1234-1234-123456789abc'
    } as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
    IdeaService.cleanup()
  })

  describe('getIdeasByProject', () => {
    it('should fetch all ideas when no project ID provided', async () => {
      const mockIdeas: IdeaCard[] = [
        { id: '1', title: 'Idea 1', description: 'Description 1', project_id: 'proj-1', created_at: '2024-01-01', updated_at: '2024-01-01', editing_by: null, editing_at: null },
        { id: '2', title: 'Idea 2', description: 'Description 2', project_id: 'proj-2', created_at: '2024-01-02', updated_at: '2024-01-02', editing_by: null, editing_at: null }
      ]

      mockSupabase.single.mockResolvedValue({ data: mockIdeas, error: null })

      const result = await IdeaService.getIdeasByProject()

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockIdeas)
      expect(mockSupabase.from).toHaveBeenCalledWith('ideas')
      expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: false })
    })

    it('should filter ideas by project ID', async () => {
      const projectId = 'proj-123'
      const mockIdeas: IdeaCard[] = [
        { id: '1', title: 'Idea 1', description: 'Description 1', project_id: projectId, created_at: '2024-01-01', updated_at: '2024-01-01', editing_by: null, editing_at: null }
      ]

      mockSupabase.single.mockResolvedValue({ data: mockIdeas, error: null })

      const result = await IdeaService.getIdeasByProject(projectId)

      expect(result.success).toBe(true)
      expect(mockSupabase.eq).toHaveBeenCalledWith('project_id', projectId)
    })

    it('should return empty array for invalid project ID', async () => {
      const result = await IdeaService.getIdeasByProject('invalid-id!')

      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
    })

    it('should filter by status when provided', async () => {
      const mockIdeas: IdeaCard[] = []
      mockSupabase.single.mockResolvedValue({ data: mockIdeas, error: null })

      await IdeaService.getIdeasByProject('proj-1', { status: 'active' })

      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'active')
    })

    it('should filter by priority when provided', async () => {
      const mockIdeas: IdeaCard[] = []
      mockSupabase.single.mockResolvedValue({ data: mockIdeas, error: null })

      await IdeaService.getIdeasByProject('proj-1', { priority: 'high' })

      expect(mockSupabase.eq).toHaveBeenCalledWith('priority', 'high')
    })

    it('should apply limit when provided', async () => {
      const mockIdeas: IdeaCard[] = []
      mockSupabase.single.mockResolvedValue({ data: mockIdeas, error: null })

      await IdeaService.getIdeasByProject('proj-1', { limit: 10 })

      expect(mockSupabase.limit).toHaveBeenCalledWith(10)
    })

    it('should handle database errors', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Connection failed', code: '08003' } })

      const result = await IdeaService.getIdeasByProject('proj-1')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('createIdea', () => {
    it('should create a new idea with valid input', async () => {
      const input: CreateIdeaInput = {
        title: 'New Idea',
        description: 'Test description',
        project_id: 'proj-123'
      }

      const mockCreatedIdea: IdeaCard = {
        ...input,
        id: '1234567890abcdef',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        editing_by: null,
        editing_at: null
      }

      mockSupabase.single.mockResolvedValue({ data: mockCreatedIdea, error: null })

      const result = await IdeaService.createIdea(input)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockCreatedIdea)
      expect(mockSupabase.insert).toHaveBeenCalled()
    })

    it('should validate required title field', async () => {
      const input: CreateIdeaInput = {
        title: '',
        description: 'Description',
        project_id: 'proj-123'
      }

      const result = await IdeaService.createIdea(input)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
      expect(result.error?.message).toContain('Invalid title')
    })

    it('should validate project ID format', async () => {
      const input: CreateIdeaInput = {
        title: 'Test',
        description: 'Description',
        project_id: 'invalid-id!'
      }

      const result = await IdeaService.createIdea(input)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    it('should generate unique ID for new idea', async () => {
      const input: CreateIdeaInput = {
        title: 'Test',
        description: 'Description',
        project_id: 'proj-123'
      }

      mockSupabase.single.mockResolvedValue({ data: { ...input, id: '1234567890abcdef' }, error: null })

      const result = await IdeaService.createIdea(input)

      expect(result.success).toBe(true)
      expect(result.data?.id).toBeDefined()
      expect(result.data?.id.length).toBe(16)
    })

    it('should set timestamps on creation', async () => {
      const input: CreateIdeaInput = {
        title: 'Test',
        description: 'Description',
        project_id: 'proj-123'
      }

      const mockData = {
        ...input,
        id: '123',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        editing_by: null,
        editing_at: null
      }

      mockSupabase.single.mockResolvedValue({ data: mockData, error: null })

      const result = await IdeaService.createIdea(input)

      expect(result.success).toBe(true)
      expect(result.data?.created_at).toBeDefined()
      expect(result.data?.updated_at).toBeDefined()
    })

    it('should handle duplicate key errors', async () => {
      const input: CreateIdeaInput = {
        title: 'Test',
        description: 'Description',
        project_id: 'proj-123'
      }

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'Duplicate key' }
      })

      const result = await IdeaService.createIdea(input)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('DUPLICATE_KEY')
    })
  })

  describe('updateIdea', () => {
    it('should update idea with valid changes', async () => {
      const updates = {
        title: 'Updated Title',
        description: 'Updated Description'
      }

      const mockUpdatedIdea: IdeaCard = {
        id: 'idea-1',
        title: updates.title,
        description: updates.description,
        project_id: 'proj-1',
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
        editing_by: null,
        editing_at: null
      }

      mockSupabase.single.mockResolvedValueOnce({ data: { editing_by: null }, error: null })
      mockSupabase.single.mockResolvedValueOnce({ data: mockUpdatedIdea, error: null })

      const result = await IdeaService.updateIdea('idea-1', updates)

      expect(result.success).toBe(true)
      expect(result.data?.title).toBe(updates.title)
      expect(mockSupabase.update).toHaveBeenCalled()
    })

    it('should validate idea ID', async () => {
      const result = await IdeaService.updateIdea('', { title: 'Test' })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    it('should update timestamp on modification', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: { editing_by: null }, error: null })
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'idea-1',
          title: 'Updated',
          updated_at: '2024-01-02T00:00:00.000Z'
        },
        error: null
      })

      const result = await IdeaService.updateIdea('idea-1', { title: 'Updated' })

      expect(result.success).toBe(true)
      expect(result.data?.updated_at).toBeDefined()
    })

    it('should check editing lock before update', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          editing_by: 'other-user',
          editing_at: new Date().toISOString()
        },
        error: null
      })

      const result = await IdeaService.updateIdea('idea-1', { title: 'Test' }, { userId: 'current-user' })

      expect(result.success).toBe(false)
    })

    it('should allow update if lock is expired', async () => {
      const expiredTime = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          editing_by: 'other-user',
          editing_at: expiredTime
        },
        error: null
      })
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'idea-1', title: 'Updated' },
        error: null
      })

      const result = await IdeaService.updateIdea('idea-1', { title: 'Updated' }, { userId: 'current-user' })

      expect(result.success).toBe(true)
    })
  })

  describe('deleteIdea', () => {
    it('should delete idea successfully', async () => {
      mockSupabase.single.mockResolvedValue({ data: { editing_by: null }, error: null })
      mockSupabase.delete.mockResolvedValue({ error: null })

      const result = await IdeaService.deleteIdea('idea-1')

      expect(result.success).toBe(true)
      expect(result.data).toBe(true)
      expect(mockSupabase.delete).toHaveBeenCalled()
    })

    it('should check lock before deletion', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          editing_by: 'other-user',
          editing_at: new Date().toISOString()
        },
        error: null
      })

      const result = await IdeaService.deleteIdea('idea-1', { userId: 'current-user' })

      expect(result.success).toBe(false)
    })

    it('should handle database errors during deletion', async () => {
      mockSupabase.single.mockResolvedValue({ data: { editing_by: null }, error: null })
      mockSupabase.delete.mockResolvedValue({ error: { message: 'Foreign key violation', code: '23503' } })

      const result = await IdeaService.deleteIdea('idea-1')

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('FOREIGN_KEY_VIOLATION')
    })
  })

  describe('Lock Management', () => {
    describe('lockIdeaForEditing', () => {
      it('should acquire lock successfully', async () => {
        mockSupabase.single.mockResolvedValueOnce({
          data: { editing_by: null, editing_at: null },
          error: null
        })
        mockSupabase.update.mockResolvedValue({ error: null })

        const result = await IdeaService.lockIdeaForEditing('idea-1', 'user-1')

        expect(result.success).toBe(true)
        expect(mockSupabase.update).toHaveBeenCalledWith(
          expect.objectContaining({
            editing_by: 'user-1'
          })
        )
      })

      it('should fail if locked by another user', async () => {
        mockSupabase.single.mockResolvedValue({
          data: {
            editing_by: 'other-user',
            editing_at: new Date().toISOString()
          },
          error: null
        })

        const result = await IdeaService.lockIdeaForEditing('idea-1', 'user-1')

        expect(result.success).toBe(false)
      })

      it('should allow lock if previous lock expired', async () => {
        const expiredTime = new Date(Date.now() - 10 * 60 * 1000).toISOString()
        mockSupabase.single.mockResolvedValue({
          data: {
            editing_by: 'other-user',
            editing_at: expiredTime
          },
          error: null
        })
        mockSupabase.update.mockResolvedValue({ error: null })

        const result = await IdeaService.lockIdeaForEditing('idea-1', 'user-1')

        expect(result.success).toBe(true)
      })

      it('should skip timestamp update if already locked by same user', async () => {
        mockSupabase.single.mockResolvedValue({
          data: {
            editing_by: 'user-1',
            editing_at: new Date().toISOString()
          },
          error: null
        })

        const result = await IdeaService.lockIdeaForEditing('idea-1', 'user-1')

        expect(result.success).toBe(true)
        expect(mockSupabase.update).not.toHaveBeenCalled()
      })
    })

    describe('unlockIdea', () => {
      it('should release lock successfully', async () => {
        mockSupabase.update.mockResolvedValue({ error: null })

        const result = await IdeaService.unlockIdea('idea-1', 'user-1')

        expect(result.success).toBe(true)
        expect(mockSupabase.update).toHaveBeenCalledWith({
          editing_by: null,
          editing_at: null
        })
        expect(mockSupabase.eq).toHaveBeenCalledWith('editing_by', 'user-1')
      })

      it('should only unlock if user owns the lock', async () => {
        mockSupabase.update.mockResolvedValue({ error: null })

        await IdeaService.unlockIdea('idea-1', 'user-1')

        expect(mockSupabase.eq).toHaveBeenCalledWith('editing_by', 'user-1')
      })
    })

    describe('cleanupStaleLocks', () => {
      it('should clean up expired locks', async () => {
        const staleLocks = [
          { id: 'idea-1' },
          { id: 'idea-2' },
          { id: 'idea-3' }
        ]

        mockSupabase.single.mockResolvedValue({ data: staleLocks, error: null })

        const result = await IdeaService.cleanupStaleLocks()

        expect(result.success).toBe(true)
        expect(result.data).toBe(3)
        expect(mockSupabase.update).toHaveBeenCalledWith({
          editing_by: null,
          editing_at: null
        })
      })

      it('should filter by stale timestamp', async () => {
        mockSupabase.single.mockResolvedValue({ data: [], error: null })

        await IdeaService.cleanupStaleLocks()

        expect(mockSupabase.lt).toHaveBeenCalledWith('editing_at', expect.any(String))
        expect(mockSupabase.not).toHaveBeenCalledWith('editing_by', 'is', null)
      })

      it('should return 0 when no stale locks found', async () => {
        mockSupabase.single.mockResolvedValue({ data: [], error: null })

        const result = await IdeaService.cleanupStaleLocks()

        expect(result.success).toBe(true)
        expect(result.data).toBe(0)
      })
    })

    describe('getLockInfo', () => {
      it('should return lock information', async () => {
        const lockData = {
          editing_by: 'user-1',
          editing_at: '2024-01-01T00:00:00.000Z'
        }

        mockSupabase.single.mockResolvedValue({ data: lockData, error: null })

        const result = await IdeaService.getLockInfo('idea-1')

        expect(result.success).toBe(true)
        expect(result.data).toMatchObject({
          id: 'idea-1',
          userId: 'user-1',
          operation: 'editing'
        })
      })

      it('should return null if no lock exists', async () => {
        mockSupabase.single.mockResolvedValue({
          data: { editing_by: null, editing_at: null },
          error: null
        })

        const result = await IdeaService.getLockInfo('idea-1')

        expect(result.success).toBe(true)
        expect(result.data).toBeNull()
      })

      it('should calculate lock expiration time', async () => {
        const acquiredAt = '2024-01-01T00:00:00.000Z'
        mockSupabase.single.mockResolvedValue({
          data: {
            editing_by: 'user-1',
            editing_at: acquiredAt
          },
          error: null
        })

        const result = await IdeaService.getLockInfo('idea-1')

        expect(result.success).toBe(true)
        expect(result.data?.expires_at).toBeDefined()
        // Verify expiration is 5 minutes after acquisition
        const expiresAt = new Date(result.data!.expires_at)
        const acquired = new Date(acquiredAt)
        expect(expiresAt.getTime() - acquired.getTime()).toBe(5 * 60 * 1000)
      })
    })
  })

  describe('Legacy Methods', () => {
    it('should support getAllIdeas legacy method', async () => {
      const mockIdeas: IdeaCard[] = []
      mockSupabase.single.mockResolvedValue({ data: mockIdeas, error: null })

      const ideas = await IdeaService.getAllIdeas()

      expect(ideas).toEqual(mockIdeas)
    })

    it('should support getProjectIdeas legacy method', async () => {
      const mockIdeas: IdeaCard[] = []
      mockSupabase.single.mockResolvedValue({ data: mockIdeas, error: null })

      const ideas = await IdeaService.getProjectIdeas('proj-1')

      expect(ideas).toEqual(mockIdeas)
    })

    it('should return empty array on error in legacy methods', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Error' } })

      const ideas = await IdeaService.getAllIdeas()

      expect(ideas).toEqual([])
    })
  })

  describe('serviceResultToApiResponse', () => {
    it('should convert success result to API response', () => {
      const serviceResult = {
        success: true as const,
        data: { id: '1', title: 'Test' }
      }

      const apiResponse = IdeaService.serviceResultToApiResponse(serviceResult)

      expect(apiResponse.success).toBe(true)
      expect(apiResponse.data).toEqual(serviceResult.data)
      expect(apiResponse.timestamp).toBeDefined()
    })

    it('should convert error result to API response', () => {
      const serviceResult = {
        success: false as const,
        error: {
          code: 'NOT_FOUND' as const,
          message: 'Idea not found',
          operation: 'getIdea',
          retryable: false,
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      }

      const apiResponse = IdeaService.serviceResultToApiResponse(serviceResult)

      expect(apiResponse.success).toBe(false)
      expect(apiResponse.error?.message).toBe('Idea not found')
      expect(apiResponse.error?.code).toBe('NOT_FOUND')
    })

    it('should include meta with total for array data', () => {
      const serviceResult = {
        success: true as const,
        data: [{ id: '1' }, { id: '2' }]
      }

      const apiResponse = IdeaService.serviceResultToApiResponse(serviceResult)

      expect(apiResponse.meta?.total).toBe(2)
    })
  })
})
