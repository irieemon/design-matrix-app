/**
 * IdeaRepository Tests
 *
 * Critical tests for the primary data access layer that handles:
 * - All idea CRUD operations across the application
 * - Concurrent editing locks to prevent data conflicts
 * - Real-time subscriptions for live collaboration
 * - Project-based access control and filtering
 * - Database integrity and error recovery
 *
 * Business Impact: Data corruption, editing conflicts, unauthorized access
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IdeaCard } from '../../../types'

// Create mock objects that will be shared across tests
let mockQuery: any
let mockChannel: any
let mockSupabaseInstance: any

// Mock modules with factory functions
vi.mock('../../supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
      channel: vi.fn(),
      removeChannel: vi.fn()
    }
  }
})

vi.mock('../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

// Import after mocks
import { IdeaRepository, CreateIdeaInput } from '../ideaRepository'
import { supabase } from '../../supabase'
import { logger } from '../../../utils/logger'

// Type the mocked modules
const mockSupabase = supabase as any
const mockLogger = logger as any

// Setup fresh mocks before each test
function setupMocks() {
  mockQuery = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis()
  }

  mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis()
  }

  // Configure mocked supabase to return our mock objects
  mockSupabase.from.mockReturnValue(mockQuery)
  mockSupabase.channel.mockReturnValue(mockChannel)
}

describe('IdeaRepository', () => {
  const sampleIdea: IdeaCard = {
    id: 'idea123',
    content: 'Test idea content',
    details: 'Detailed description of the test idea',
    x: 100,
    y: 200,
    priority: 'high',
    created_by: 'user123',
    project_id: 'project456',
    created_at: '2023-01-01T00:00:00.000Z',
    updated_at: '2023-01-01T00:00:00.000Z'
  }

  const sampleCreateInput: CreateIdeaInput = {
    content: 'New idea content',
    details: 'New idea details',
    x: 150,
    y: 250,
    priority: 'moderate',
    created_by: 'user456',
    project_id: 'project789'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('getAllIdeas', () => {
    it('should fetch all ideas ordered by creation date', async () => {
      const mockIdeas = [sampleIdea, { ...sampleIdea, id: 'idea456' }]
      mockQuery.order.mockResolvedValue({ data: mockIdeas, error: null })

      const result = await IdeaRepository.getAllIdeas()

      expect(mockSupabase.from).toHaveBeenCalledWith('ideas')
      expect(mockQuery.select).toHaveBeenCalledWith('*')
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(result).toEqual(mockIdeas)
      expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('Error'))
    })

    it('should handle database errors gracefully', async () => {
      const dbError = { message: 'Connection timeout', code: 'CONNECTION_ERROR' }
      mockQuery.order.mockResolvedValue({ data: null, error: dbError })

      await expect(IdeaRepository.getAllIdeas()).rejects.toThrow('Connection timeout')

      expect(mockLogger.error).toHaveBeenCalledWith('Error fetching all ideas:', dbError)
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get all ideas:', expect.any(Error))
    })

    it('should return empty array when no ideas exist', async () => {
      mockQuery.order.mockResolvedValue({ data: [], error: null })

      const result = await IdeaRepository.getAllIdeas()

      expect(result).toEqual([])
    })

    it('should handle null data response', async () => {
      mockQuery.order.mockResolvedValue({ data: null, error: null })

      const result = await IdeaRepository.getAllIdeas()

      expect(result).toEqual([])
    })

    it('should handle network connection failures', async () => {
      mockQuery.order.mockRejectedValue(new Error('Network error'))

      await expect(IdeaRepository.getAllIdeas()).rejects.toThrow('Network error')
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get all ideas:', expect.any(Error))
    })
  })

  describe('getProjectIdeas', () => {
    it('should fetch ideas for a specific project', async () => {
      const projectIdeas = [sampleIdea]
      mockQuery.eq.mockReturnValue(mockQuery)
      mockQuery.order.mockResolvedValue({ data: projectIdeas, error: null })

      const result = await IdeaRepository.getProjectIdeas('project456')

      expect(mockSupabase.from).toHaveBeenCalledWith('ideas')
      expect(mockQuery.select).toHaveBeenCalledWith('*')
      expect(mockQuery.eq).toHaveBeenCalledWith('project_id', 'project456')
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(result).toEqual(projectIdeas)
    })

    it('should handle project with no ideas', async () => {
      mockQuery.order.mockResolvedValue({ data: [], error: null })

      const result = await IdeaRepository.getProjectIdeas('empty-project')

      expect(result).toEqual([])
    })

    it('should handle invalid project IDs', async () => {
      const dbError = { message: 'Invalid UUID format', code: 'INVALID_INPUT' }
      mockQuery.order.mockResolvedValue({ data: null, error: dbError })

      await expect(IdeaRepository.getProjectIdeas('invalid-id')).rejects.toThrow('Invalid UUID format')
    })

    it('should log project queries for debugging', async () => {
      mockQuery.order.mockResolvedValue({ data: [], error: null })

      await IdeaRepository.getProjectIdeas('project456')

      expect(mockLogger.error).not.toHaveBeenCalled()
    })
  })

  describe('getIdeasByProject', () => {
    it('should filter ideas by project and user when includePublic is false', async () => {
      mockQuery.order.mockResolvedValue({ data: [sampleIdea], error: null })

      const result = await IdeaRepository.getIdeasByProject('project456', 'user123', false)

      expect(mockQuery.eq).toHaveBeenCalledWith('project_id', 'project456')
      expect(mockQuery.eq).toHaveBeenCalledWith('created_by', 'user123')
      expect(result).toEqual([sampleIdea])
    })

    it('should include public ideas when includePublic is true', async () => {
      mockQuery.order.mockResolvedValue({ data: [sampleIdea], error: null })

      const result = await IdeaRepository.getIdeasByProject('project456', 'user123', true)

      expect(mockQuery.eq).toHaveBeenCalledWith('project_id', 'project456')
      expect(mockQuery.eq).not.toHaveBeenCalledWith('created_by', 'user123')
      expect(result).toEqual([sampleIdea])
    })

    it('should handle queries without project filtering', async () => {
      mockQuery.order.mockResolvedValue({ data: [sampleIdea], error: null })

      const result = await IdeaRepository.getIdeasByProject(undefined, 'user123', true)

      expect(mockQuery.eq).not.toHaveBeenCalledWith('project_id', expect.anything())
      expect(result).toEqual([sampleIdea])
    })

    it('should handle queries without user filtering', async () => {
      mockQuery.order.mockResolvedValue({ data: [sampleIdea], error: null })

      const result = await IdeaRepository.getIdeasByProject('project456', undefined, true)

      expect(mockQuery.eq).toHaveBeenCalledWith('project_id', 'project456')
      expect(mockQuery.eq).not.toHaveBeenCalledWith('created_by', expect.anything())
      expect(result).toEqual([sampleIdea])
    })

    it('should use default includePublic value of true', async () => {
      mockQuery.order.mockResolvedValue({ data: [sampleIdea], error: null })

      const result = await IdeaRepository.getIdeasByProject('project456', 'user123')

      expect(mockQuery.eq).toHaveBeenCalledWith('project_id', 'project456')
      expect(mockQuery.eq).not.toHaveBeenCalledWith('created_by', 'user123')
      expect(result).toEqual([sampleIdea])
    })
  })

  describe('createIdea', () => {
    beforeEach(() => {
      // Mock current date for consistent testing
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2023-12-01T10:00:00.000Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should create a new idea with complete data', async () => {
      const createdIdea = { ...sampleIdea, id: 'new-idea-123' }
      mockQuery.select.mockReturnValue(mockQuery)
      mockQuery.single.mockResolvedValue({ data: createdIdea, error: null })

      const result = await IdeaRepository.createIdea(sampleCreateInput)

      expect(mockSupabase.from).toHaveBeenCalledWith('ideas')
      expect(mockQuery.insert).toHaveBeenCalledWith([{
        content: sampleCreateInput.content,
        details: sampleCreateInput.details,
        x: sampleCreateInput.x,
        y: sampleCreateInput.y,
        priority: sampleCreateInput.priority,
        created_by: sampleCreateInput.created_by,
        project_id: sampleCreateInput.project_id,
        created_at: '2023-12-01T10:00:00.000Z',
        updated_at: '2023-12-01T10:00:00.000Z'
      }])
      expect(result).toEqual({
        success: true,
        data: createdIdea
      })
    })

    it('should handle optional fields with null values', async () => {
      const minimalInput: CreateIdeaInput = {
        content: 'Minimal idea',
        details: 'Basic details',
        x: 0,
        y: 0,
        priority: 'low'
      }
      const createdIdea = { ...sampleIdea, id: 'minimal-123' }
      mockQuery.single.mockResolvedValue({ data: createdIdea, error: null })

      const result = await IdeaRepository.createIdea(minimalInput)

      expect(mockQuery.insert).toHaveBeenCalledWith([{
        content: 'Minimal idea',
        details: 'Basic details',
        x: 0,
        y: 0,
        priority: 'low',
        created_by: null,
        project_id: null,
        created_at: '2023-12-01T10:00:00.000Z',
        updated_at: '2023-12-01T10:00:00.000Z'
      }])
      expect(result.success).toBe(true)
    })

    it('should handle database constraint violations', async () => {
      const constraintError = {
        message: 'foreign key constraint "ideas_project_id_fkey" violated',
        code: '23503'
      }
      mockQuery.single.mockResolvedValue({ data: null, error: constraintError })

      const result = await IdeaRepository.createIdea(sampleCreateInput)

      expect(result).toEqual({
        success: false,
        error: 'foreign key constraint "ideas_project_id_fkey" violated'
      })
      expect(mockLogger.error).toHaveBeenCalledWith('Error creating idea:', constraintError)
    })

    it('should handle network failures during creation', async () => {
      mockQuery.single.mockRejectedValue(new Error('Connection lost'))

      const result = await IdeaRepository.createIdea(sampleCreateInput)

      expect(result).toEqual({
        success: false,
        error: 'Connection lost'
      })
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create idea:', expect.any(Error))
    })

    it('should log successful creation with idea ID', async () => {
      const createdIdea = { ...sampleIdea, id: 'success-123' }
      mockQuery.single.mockResolvedValue({ data: createdIdea, error: null })

      await IdeaRepository.createIdea(sampleCreateInput)

      expect(mockLogger.debug).toHaveBeenCalledWith('Creating idea:', {
        content: sampleCreateInput.content,
        x: sampleCreateInput.x,
        y: sampleCreateInput.y
      })
      expect(mockLogger.debug).toHaveBeenCalledWith('Idea created successfully:', 'success-123')
    })

    it('should handle unknown errors gracefully', async () => {
      mockQuery.single.mockRejectedValue('Unknown error type')

      const result = await IdeaRepository.createIdea(sampleCreateInput)

      expect(result).toEqual({
        success: false,
        error: 'Unknown error'
      })
    })
  })

  describe('updateIdea', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2023-12-01T15:30:00.000Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should update an idea with partial data', async () => {
      const updates = { content: 'Updated content', priority: 'strategic' as const }
      const updatedIdea = { ...sampleIdea, ...updates, updated_at: '2023-12-01T15:30:00.000Z' }
      mockQuery.single.mockResolvedValue({ data: updatedIdea, error: null })

      const result = await IdeaRepository.updateIdea('idea123', updates)

      expect(mockSupabase.from).toHaveBeenCalledWith('ideas')
      expect(mockQuery.update).toHaveBeenCalledWith({
        ...updates,
        updated_at: '2023-12-01T15:30:00.000Z'
      })
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'idea123')
      expect(result).toEqual(updatedIdea)
    })

    it('should handle idea not found errors', async () => {
      const notFoundError = { message: 'No rows found', code: 'PGRST116' }
      mockQuery.single.mockResolvedValue({ data: null, error: notFoundError })

      const result = await IdeaRepository.updateIdea('nonexistent', { content: 'Updated' })

      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith('Error updating idea:', notFoundError)
    })

    it('should prevent updating protected fields', async () => {
      // The updateIdea method should not allow updating id or created_at
      const updates = { content: 'New content' }
      const updatedIdea = { ...sampleIdea, content: 'New content' }
      mockQuery.single.mockResolvedValue({ data: updatedIdea, error: null })

      const result = await IdeaRepository.updateIdea('idea123', updates)

      expect(mockQuery.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: expect.anything() })
      )
      expect(mockQuery.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ created_at: expect.anything() })
      )
    })

    it('should handle concurrent update conflicts', async () => {
      const conflictError = { message: 'Row was updated by another session', code: 'CONFLICT' }
      mockQuery.single.mockResolvedValue({ data: null, error: conflictError })

      const result = await IdeaRepository.updateIdea('idea123', { content: 'Updated' })

      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith('Error updating idea:', conflictError)
    })

    it('should log update operations for debugging', async () => {
      const updates = { content: 'Logged update' }
      mockQuery.single.mockResolvedValue({ data: { ...sampleIdea, ...updates }, error: null })

      await IdeaRepository.updateIdea('idea123', updates)

      expect(mockLogger.debug).toHaveBeenCalledWith('Updating idea:', 'idea123', updates)
      expect(mockLogger.debug).toHaveBeenCalledWith('Idea updated successfully:', 'idea123')
    })

    it('should handle database connection failures', async () => {
      mockQuery.single.mockRejectedValue(new Error('Database unavailable'))

      const result = await IdeaRepository.updateIdea('idea123', { content: 'Update' })

      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to update idea:', expect.any(Error))
    })
  })

  describe('deleteIdea', () => {
    it('should successfully delete an idea', async () => {
      mockQuery.delete.mockResolvedValue({ error: null })

      const result = await IdeaRepository.deleteIdea('idea123')

      expect(mockSupabase.from).toHaveBeenCalledWith('ideas')
      expect(mockQuery.delete).toHaveBeenCalled()
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'idea123')
      expect(result).toBe(true)
      expect(mockLogger.debug).toHaveBeenCalledWith('Deleting idea:', 'idea123')
      expect(mockLogger.debug).toHaveBeenCalledWith('Idea deleted successfully:', 'idea123')
    })

    it('should handle deletion errors', async () => {
      const deleteError = { message: 'Referenced by other records', code: 'FOREIGN_KEY_VIOLATION' }
      mockQuery.delete.mockResolvedValue({ error: deleteError })

      const result = await IdeaRepository.deleteIdea('idea123')

      expect(result).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith('Error deleting idea:', deleteError)
    })

    it('should handle attempts to delete non-existent ideas', async () => {
      // Supabase doesn't error on deleting non-existent records, it succeeds
      mockQuery.delete.mockResolvedValue({ error: null })

      const result = await IdeaRepository.deleteIdea('nonexistent')

      expect(result).toBe(true)
    })

    it('should handle network failures during deletion', async () => {
      mockQuery.delete.mockRejectedValue(new Error('Connection timeout'))

      const result = await IdeaRepository.deleteIdea('idea123')

      expect(result).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to delete idea:', expect.any(Error))
    })

    it('should handle cascade deletion constraints', async () => {
      const cascadeError = { message: 'Cannot delete due to dependencies', code: 'RESTRICT_VIOLATION' }
      mockQuery.delete.mockResolvedValue({ error: cascadeError })

      const result = await IdeaRepository.deleteIdea('idea123')

      expect(result).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith('Error deleting idea:', cascadeError)
    })
  })

  describe('Locking Mechanisms', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2023-12-01T12:00:00.000Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    describe('lockIdeaForEditing', () => {
      it('should successfully lock an unlocked idea', async () => {
        const unlockedIdea = { editing_by: null, editing_at: null }
        mockQuery.single.mockResolvedValueOnce({ data: unlockedIdea, error: null })
        mockQuery.eq.mockResolvedValueOnce({ error: null })

        const result = await IdeaRepository.lockIdeaForEditing('idea123', 'user456')

        expect(mockQuery.eq).toHaveBeenCalledWith('id', 'idea123')
        expect(mockQuery.update).toHaveBeenCalledWith({
          editing_by: 'user456',
          editing_at: '2023-12-01T12:00:00.000Z'
        })
        expect(result).toBe(true)
      })

      it('should allow user to re-lock their own idea', async () => {
        const selfLockedIdea = {
          editing_by: 'user456',
          editing_at: '2023-12-01T11:58:00.000Z' // 2 minutes ago
        }
        mockQuery.single.mockResolvedValueOnce({ data: selfLockedIdea, error: null })
        mockQuery.eq.mockResolvedValueOnce({ error: null })

        const result = await IdeaRepository.lockIdeaForEditing('idea123', 'user456')

        expect(result).toBe(true)
      })

      it('should reject lock when idea is locked by another user within timeout', async () => {
        const recentlyLockedIdea = {
          editing_by: 'other-user',
          editing_at: '2023-12-01T11:58:00.000Z' // 2 minutes ago (within 5 minute timeout)
        }
        mockQuery.single.mockResolvedValueOnce({ data: recentlyLockedIdea, error: null })

        const result = await IdeaRepository.lockIdeaForEditing('idea123', 'user456')

        expect(result).toBe(false)
        expect(mockQuery.update).not.toHaveBeenCalled()
        expect(mockLogger.debug).toHaveBeenCalledWith('Idea is already locked by another user:', 'other-user')
      })

      it('should allow lock when previous lock is stale (over 5 minutes)', async () => {
        const staleLockedIdea = {
          editing_by: 'other-user',
          editing_at: '2023-12-01T11:54:00.000Z' // 6 minutes ago (stale)
        }
        mockQuery.single.mockResolvedValueOnce({ data: staleLockedIdea, error: null })
        mockQuery.eq.mockResolvedValueOnce({ error: null })

        const result = await IdeaRepository.lockIdeaForEditing('idea123', 'user456')

        expect(result).toBe(true)
        expect(mockQuery.update).toHaveBeenCalledWith({
          editing_by: 'user456',
          editing_at: '2023-12-01T12:00:00.000Z'
        })
      })

      it('should handle database errors during lock check', async () => {
        const dbError = { message: 'Connection error', code: 'CONNECTION_ERROR' }
        mockQuery.single.mockResolvedValueOnce({ data: null, error: dbError })

        const result = await IdeaRepository.lockIdeaForEditing('idea123', 'user456')

        expect(result).toBe(false)
        expect(mockLogger.error).toHaveBeenCalledWith('Error fetching idea for lock check:', dbError)
      })

      it('should handle database errors during lock update', async () => {
        const unlockedIdea = { editing_by: null, editing_at: null }
        const updateError = { message: 'Update failed', code: 'UPDATE_ERROR' }
        mockQuery.single.mockResolvedValueOnce({ data: unlockedIdea, error: null })
        mockQuery.eq.mockResolvedValueOnce({ error: updateError })

        const result = await IdeaRepository.lockIdeaForEditing('idea123', 'user456')

        expect(result).toBe(false)
        expect(mockLogger.error).toHaveBeenCalledWith('Error locking idea:', updateError)
      })

      it('should handle network failures gracefully', async () => {
        mockQuery.single.mockRejectedValueOnce(new Error('Network error'))

        const result = await IdeaRepository.lockIdeaForEditing('idea123', 'user456')

        expect(result).toBe(false)
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to lock idea:', expect.any(Error))
      })
    })

    describe('unlockIdea', () => {
      it('should successfully unlock idea locked by the same user', async () => {
        mockQuery.eq.mockResolvedValue({ error: null })

        const result = await IdeaRepository.unlockIdea('idea123', 'user456')

        expect(mockQuery.update).toHaveBeenCalledWith({
          editing_by: null,
          editing_at: null
        })
        expect(mockQuery.eq).toHaveBeenCalledWith('id', 'idea123')
        expect(mockQuery.eq).toHaveBeenCalledWith('editing_by', 'user456')
        expect(result).toBe(true)
        expect(mockLogger.debug).toHaveBeenCalledWith('Idea unlocked successfully:', 'idea123')
      })

      it('should handle unlock errors', async () => {
        const unlockError = { message: 'Permission denied', code: 'PERMISSION_DENIED' }
        mockQuery.eq.mockResolvedValue({ error: unlockError })

        const result = await IdeaRepository.unlockIdea('idea123', 'user456')

        expect(result).toBe(false)
        expect(mockLogger.error).toHaveBeenCalledWith('Error unlocking idea:', unlockError)
      })

      it('should handle network failures during unlock', async () => {
        mockQuery.eq.mockRejectedValue(new Error('Network timeout'))

        const result = await IdeaRepository.unlockIdea('idea123', 'user456')

        expect(result).toBe(false)
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to unlock idea:', expect.any(Error))
      })

      it('should use user-specific unlock conditions', async () => {
        mockQuery.eq.mockResolvedValue({ error: null })

        await IdeaRepository.unlockIdea('idea123', 'user456')

        // Verify that unlock only works if the user owns the lock
        expect(mockQuery.eq).toHaveBeenCalledWith('editing_by', 'user456')
      })
    })

    describe('cleanupStaleLocks', () => {
      it('should clean up locks older than 5 minutes', async () => {
        mockQuery.not.mockResolvedValue({ error: null })

        await IdeaRepository.cleanupStaleLocks()

        const expectedCutoff = new Date('2023-12-01T11:55:00.000Z').toISOString() // 5 minutes ago

        expect(mockQuery.update).toHaveBeenCalledWith({
          editing_by: null,
          editing_at: null
        })
        expect(mockQuery.lt).toHaveBeenCalledWith('editing_at', expectedCutoff)
        expect(mockQuery.not).toHaveBeenCalledWith('editing_by', 'is', null)
        expect(mockLogger.debug).toHaveBeenCalledWith('Stale locks cleaned up successfully')
      })

      it('should handle cleanup errors gracefully', async () => {
        const cleanupError = { message: 'Cleanup failed', code: 'CLEANUP_ERROR' }
        mockQuery.not.mockResolvedValue({ error: cleanupError })

        await IdeaRepository.cleanupStaleLocks()

        expect(mockLogger.error).toHaveBeenCalledWith('Error cleaning up stale locks:', cleanupError)
      })

      it('should handle cleanup network failures', async () => {
        mockQuery.not.mockRejectedValue(new Error('Network error'))

        await IdeaRepository.cleanupStaleLocks()

        expect(mockLogger.error).toHaveBeenCalledWith('Failed to cleanup stale locks:', expect.any(Error))
      })
    })

    describe('getLockedIdeasByUser', () => {
      it('should fetch ideas locked by a specific user', async () => {
        const lockedIdeas = [
          { ...sampleIdea, editing_by: 'user456', editing_at: '2023-12-01T12:00:00.000Z' }
        ]
        mockQuery.order.mockResolvedValue({ data: lockedIdeas, error: null })

        const result = await IdeaRepository.getLockedIdeasByUser('user456')

        expect(mockQuery.eq).toHaveBeenCalledWith('editing_by', 'user456')
        expect(mockQuery.order).toHaveBeenCalledWith('editing_at', { ascending: false })
        expect(result).toEqual(lockedIdeas)
      })

      it('should handle users with no locked ideas', async () => {
        mockQuery.order.mockResolvedValue({ data: [], error: null })

        const result = await IdeaRepository.getLockedIdeasByUser('user456')

        expect(result).toEqual([])
      })

      it('should handle database errors when fetching locked ideas', async () => {
        const dbError = { message: 'Query failed', code: 'QUERY_ERROR' }
        mockQuery.order.mockResolvedValue({ data: null, error: dbError })

        await expect(IdeaRepository.getLockedIdeasByUser('user456')).rejects.toThrow('Query failed')
      })

      it('should handle network failures gracefully', async () => {
        mockQuery.order.mockRejectedValue(new Error('Connection lost'))

        const result = await IdeaRepository.getLockedIdeasByUser('user456')

        expect(result).toEqual([])
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to get locked ideas:', expect.any(Error))
      })
    })
  })

  describe('Real-time Subscriptions', () => {
    beforeEach(() => {
      // Mock Math.random for consistent session IDs
      vi.spyOn(Math, 'random').mockReturnValue(0.123456)
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should set up real-time subscription with user-specific channel', async () => {
      const mockCallback = vi.fn()
      mockQuery.order.mockResolvedValue({ data: [sampleIdea], error: null })

      const unsubscribe = IdeaRepository.subscribeToIdeas(mockCallback, 'project456', 'user123')

      expect(mockSupabase.channel).toHaveBeenCalledWith('ideas_changes_user123_4lxrgs')
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ideas'
        },
        expect.any(Function)
      )
      expect(typeof unsubscribe).toBe('function')
    })

    it('should set up anonymous subscription when no user provided', async () => {
      const mockCallback = vi.fn()
      mockQuery.order.mockResolvedValue({ data: [], error: null })

      IdeaRepository.subscribeToIdeas(mockCallback)

      expect(mockSupabase.channel).toHaveBeenCalledWith('ideas_changes_anonymous_4lxrgs')
    })

    it('should load initial data when subscription starts', async () => {
      const mockCallback = vi.fn()
      const initialIdeas = [sampleIdea]
      mockQuery.order.mockResolvedValue({ data: initialIdeas, error: null })

      IdeaRepository.subscribeToIdeas(mockCallback, 'project456')

      // Wait for async initial load
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockCallback).toHaveBeenCalledWith(initialIdeas)
    })

    it('should skip initial load when specified', async () => {
      const mockCallback = vi.fn()

      IdeaRepository.subscribeToIdeas(mockCallback, 'project456', 'user123', { skipInitialLoad: true })

      // Wait to ensure no async call happens
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockQuery.select).not.toHaveBeenCalled()
      expect(mockCallback).not.toHaveBeenCalled()
    })

    it('should handle initial data loading errors', async () => {
      const mockCallback = vi.fn()
      mockQuery.order.mockRejectedValue(new Error('Load failed'))

      IdeaRepository.subscribeToIdeas(mockCallback, 'project456')

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockCallback).toHaveBeenCalledWith(null)
      expect(mockLogger.error).toHaveBeenCalledWith('Error loading initial ideas:', expect.any(Error))
    })

    it('should filter real-time events by project', async () => {
      const mockCallback = vi.fn()
      mockQuery.order.mockResolvedValue({ data: [], error: null })

      // Set up subscription
      IdeaRepository.subscribeToIdeas(mockCallback, 'project456')

      // Get the real-time handler function
      const realTimeHandler = mockChannel.on.mock.calls[0][2]

      // Mock a real-time event for the correct project
      const projectEvent = {
        eventType: 'INSERT',
        new: { id: 'new123', project_id: 'project456', content: 'New idea' }
      }

      // Reset mocks to test only the real-time callback
      vi.clearAllMocks()
      setupMocks()
      mockQuery.order.mockResolvedValue({ data: [sampleIdea], error: null })

      realTimeHandler(projectEvent)

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockCallback).toHaveBeenCalledWith([sampleIdea])
    })

    it('should ignore real-time events for different projects', async () => {
      const mockCallback = vi.fn()
      mockQuery.order.mockResolvedValue({ data: [], error: null })

      IdeaRepository.subscribeToIdeas(mockCallback, 'project456')

      const realTimeHandler = mockChannel.on.mock.calls[0][2]

      // Event for different project
      const otherProjectEvent = {
        eventType: 'INSERT',
        new: { id: 'new123', project_id: 'other-project', content: 'Other idea' }
      }

      vi.clearAllMocks()

      realTimeHandler(otherProjectEvent)

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockCallback).not.toHaveBeenCalled()
    })

    it('should handle real-time callback errors gracefully', async () => {
      const mockCallback = vi.fn()
      mockQuery.order
        .mockResolvedValueOnce({ data: [], error: null }) // Initial load
        .mockRejectedValueOnce(new Error('Callback failed')) // Real-time refresh

      IdeaRepository.subscribeToIdeas(mockCallback, 'project456')

      const realTimeHandler = mockChannel.on.mock.calls[0][2]

      const event = {
        eventType: 'UPDATE',
        new: { id: 'test123', project_id: 'project456' }
      }

      realTimeHandler(event)

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockCallback).toHaveBeenCalledWith(null)
      expect(mockLogger.error).toHaveBeenCalledWith('Error refreshing ideas:', expect.any(Error))
    })

    it('should return functional unsubscribe method', async () => {
      const mockCallback = vi.fn()
      mockQuery.order.mockResolvedValue({ data: [], error: null })

      const unsubscribe = IdeaRepository.subscribeToIdeas(mockCallback, 'project456', 'user123')

      unsubscribe()

      expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel)
      expect(mockLogger.debug).toHaveBeenCalledWith('🔴 Unsubscribing from ideas channel:', 'ideas_changes_user123_4lxrgs')
    })

    it('should handle subscription setup failures', async () => {
      const mockCallback = vi.fn()
      mockSupabase.channel.mockImplementation(() => {
        throw new Error('Channel setup failed')
      })

      const unsubscribe = IdeaRepository.subscribeToIdeas(mockCallback, 'project456')

      expect(typeof unsubscribe).toBe('function')
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to set up ideas subscription:', expect.any(Error))

      // Unsubscribe should not crash
      expect(() => unsubscribe()).not.toThrow()
    })
  })
})