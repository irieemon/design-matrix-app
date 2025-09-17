import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the supabase client before importing anything else
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then: vi.fn()
    })),
    auth: {
      getSession: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn()
    },
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: vi.fn()
      }))
    })),
    removeChannel: vi.fn()
  }
}))

import { DatabaseService } from '../database'
import { mockIdea, mockProject, mockUser } from '../../test/utils/test-utils'

describe('DatabaseService', () => {
  beforeEach(() => {
    resetSupabaseMocks()
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Ideas Management', () => {
    describe('getIdeasByProject', () => {
      it('should fetch ideas for a specific project', async () => {
        const result = await DatabaseService.getIdeasByProject('test-project-id')

        expect(result.success).toBe(true)
        expect(result.data).toEqual(expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            content: expect.any(String),
            project_id: expect.any(String)
          })
        ]))
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('ideas')
        expect(mockSupabaseClient.eq).toHaveBeenCalledWith('project_id', 'test-project-id')
      })

      it('should fetch all ideas when no project ID provided', async () => {
        const result = await DatabaseService.getIdeasByProject()

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('ideas')
      })

      it('should handle database errors gracefully', async () => {
        mockDatabaseError('Connection failed')

        const result = await DatabaseService.getIdeasByProject('test-project-id')

        expect(result.success).toBe(false)
        expect(result.error).toEqual({
          type: 'database',
          message: expect.any(String),
          code: expect.any(String)
        })
      })

      it('should return appropriate error for not found resources', async () => {
        mockSupabaseClient.from.mockImplementation(() => ({
          ...mockSupabaseClient,
          then: vi.fn((resolve) => {
            resolve({ data: null, error: { code: 'PGRST116', message: 'Not found' } })
            return Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'Not found' } })
          })
        }))

        const result = await DatabaseService.getIdeasByProject('nonexistent-project')

        expect(result.success).toBe(false)
        expect(result.error?.code).toBe('NOT_FOUND')
      })
    })

    describe('createIdea', () => {
      it('should create a new idea successfully', async () => {
        const newIdea = {
          content: 'New Test Idea',
          details: 'Test details',
          x: 100,
          y: 200,
          priority: 'high' as const,
          project_id: 'test-project-id',
          created_by: 'test-user-id'
        }

        mockSupabaseClient.single.mockResolvedValue({
          data: { ...newIdea, id: 'new-idea-id' },
          error: null
        })

        const result = await DatabaseService.createIdea(newIdea)

        expect(result.success).toBe(true)
        expect(result.data).toEqual(expect.objectContaining({
          content: 'New Test Idea',
          id: expect.any(String)
        }))
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('ideas')
        expect(mockSupabaseClient.insert).toHaveBeenCalled()
      })

      it('should handle duplicate key errors', async () => {
        mockSupabaseClient.single.mockResolvedValue({
          data: null,
          error: { code: '23505', message: 'Duplicate key violation' }
        })

        const result = await DatabaseService.createIdea({
          content: 'Duplicate Idea',
          details: 'Test details',
          x: 100,
          y: 200,
          priority: 'high',
          project_id: 'test-project-id',
          created_by: 'test-user-id'
        })

        expect(result.success).toBe(false)
        expect(result.error?.code).toBe('DUPLICATE_KEY')
      })
    })

    describe('updateIdea', () => {
      it('should update an existing idea', async () => {
        const updates = {
          content: 'Updated Idea Content',
          details: 'Updated details',
          priority: 'moderate' as const
        }

        mockSupabaseClient.single.mockResolvedValue({
          data: { ...mockIdea, ...updates },
          error: null
        })

        const result = await DatabaseService.updateIdea('test-idea-id', updates)

        expect(result).toEqual(expect.objectContaining(updates))
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('ideas')
        expect(mockSupabaseClient.update).toHaveBeenCalledWith(
          expect.objectContaining({
            ...updates,
            updated_at: expect.any(String)
          })
        )
        expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'test-idea-id')
      })

      it('should return null on update failure', async () => {
        mockSupabaseClient.single.mockResolvedValue({
          data: null,
          error: { message: 'Update failed' }
        })

        const result = await DatabaseService.updateIdea('test-idea-id', { content: 'Failed Update' })

        expect(result).toBeNull()
      })
    })

    describe('deleteIdea', () => {
      it('should delete an idea successfully', async () => {
        mockSupabaseClient.delete.mockResolvedValue({ error: null })

        const result = await DatabaseService.deleteIdea('test-idea-id')

        expect(result).toBe(true)
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('ideas')
        expect(mockSupabaseClient.delete).toHaveBeenCalled()
        expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'test-idea-id')
      })

      it('should return false on delete failure', async () => {
        mockSupabaseClient.delete.mockResolvedValue({
          error: { message: 'Delete failed' }
        })

        const result = await DatabaseService.deleteIdea('test-idea-id')

        expect(result).toBe(false)
      })
    })
  })

  describe('Idea Locking', () => {
    describe('lockIdeaForEditing', () => {
      it('should lock an idea for editing', async () => {
        // Mock the select query to return an unlocked idea
        mockSupabaseClient.single.mockResolvedValueOnce({
          data: { editing_by: null, editing_at: null },
          error: null
        })

        // Mock the update query
        mockSupabaseClient.update.mockResolvedValue({ error: null })

        const result = await DatabaseService.lockIdeaForEditing('test-idea-id', 'test-user-id')

        expect(result).toBe(true)
        expect(mockSupabaseClient.update).toHaveBeenCalledWith({
          editing_by: 'test-user-id',
          editing_at: expect.any(String)
        })
      })

      it('should prevent locking if idea is already locked by another user', async () => {
        // Mock the select query to return a locked idea
        const fiveMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString()
        mockSupabaseClient.single.mockResolvedValueOnce({
          data: {
            editing_by: 'another-user-id',
            editing_at: fiveMinutesAgo
          },
          error: null
        })

        const result = await DatabaseService.lockIdeaForEditing('test-idea-id', 'test-user-id')

        expect(result).toBe(false)
      })

      it('should allow locking if previous lock is stale', async () => {
        // Mock the select query to return a stale lock
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
        mockSupabaseClient.single.mockResolvedValueOnce({
          data: {
            editing_by: 'another-user-id',
            editing_at: tenMinutesAgo
          },
          error: null
        })

        mockSupabaseClient.update.mockResolvedValue({ error: null })

        const result = await DatabaseService.lockIdeaForEditing('test-idea-id', 'test-user-id')

        expect(result).toBe(true)
      })
    })

    describe('unlockIdea', () => {
      it('should unlock an idea', async () => {
        mockSupabaseClient.update.mockResolvedValue({ error: null })

        const result = await DatabaseService.unlockIdea('test-idea-id', 'test-user-id')

        expect(result).toBe(true)
        expect(mockSupabaseClient.update).toHaveBeenCalledWith({
          editing_by: null,
          editing_at: null
        })
        expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'test-idea-id')
        expect(mockSupabaseClient.eq).toHaveBeenCalledWith('editing_by', 'test-user-id')
      })
    })

    describe('cleanupStaleLocks', () => {
      it('should clean up stale locks', async () => {
        mockSupabaseClient.update.mockResolvedValue({ error: null })

        await DatabaseService.cleanupStaleLocks()

        expect(mockSupabaseClient.update).toHaveBeenCalledWith({
          editing_by: null,
          editing_at: null
        })
        expect(mockSupabaseClient.lt).toHaveBeenCalledWith('editing_at', expect.any(String))
      })
    })
  })

  describe('Real-time Subscriptions', () => {
    it('should set up real-time subscription for ideas', () => {
      const mockCallback = vi.fn()
      const mockChannel = {
        on: vi.fn(() => ({
          subscribe: vi.fn((statusCallback) => {
            statusCallback('SUBSCRIBED')
            return { unsubscribe: vi.fn() }
          })
        }))
      }

      mockSupabaseClient.channel.mockReturnValue(mockChannel)

      const unsubscribe = DatabaseService.subscribeToIdeas(mockCallback, 'test-project-id')

      expect(mockSupabaseClient.channel).toHaveBeenCalledWith('ideas_changes')
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: '*',
          schema: 'public',
          table: 'ideas'
        }),
        expect.any(Function)
      )
      expect(typeof unsubscribe).toBe('function')
    })

    it('should filter out lock-only changes in real-time updates', () => {
      const mockCallback = vi.fn()
      let changeHandler: Function

      const mockChannel = {
        on: vi.fn((_, __, handler) => {
          changeHandler = handler
          return {
            subscribe: vi.fn(() => ({ unsubscribe: vi.fn() }))
          }
        })
      }

      mockSupabaseClient.channel.mockReturnValue(mockChannel)

      DatabaseService.subscribeToIdeas(mockCallback, 'test-project-id')

      // Simulate a lock-only change (heartbeat update)
      const lockOnlyPayload = {
        eventType: 'UPDATE',
        old: { id: 'test-id', content: 'Test', editing_by: 'user1', editing_at: '2024-01-01T00:00:00Z' },
        new: { id: 'test-id', content: 'Test', editing_by: 'user1', editing_at: '2024-01-01T00:01:00Z' }
      }

      changeHandler(lockOnlyPayload)

      // Should not trigger callback for heartbeat updates
      expect(mockCallback).not.toHaveBeenCalled()
    })
  })

  describe('Project Management', () => {
    describe('getAllProjects', () => {
      it('should fetch all projects', async () => {
        const result = await DatabaseService.getAllProjects()

        expect(result).toEqual(expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String)
          })
        ]))
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('projects')
        expect(mockSupabaseClient.order).toHaveBeenCalledWith('updated_at', { ascending: false })
      })
    })

    describe('createProject', () => {
      it('should create a new project', async () => {
        const newProject = {
          name: 'New Test Project',
          description: 'Test project description',
          project_type: 'Software',
          status: 'active' as const,
          owner_id: 'test-user-id'
        }

        mockSupabaseClient.single.mockResolvedValue({
          data: { ...newProject, id: 'new-project-id' },
          error: null
        })

        const result = await DatabaseService.createProject(newProject)

        expect(result).toEqual(expect.objectContaining({
          name: 'New Test Project',
          id: expect.any(String)
        }))
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('projects')
        expect(mockSupabaseClient.insert).toHaveBeenCalled()
      })
    })

    describe('getUserOwnedProjects', () => {
      it('should fetch projects owned by a specific user', async () => {
        const result = await DatabaseService.getUserOwnedProjects('test-user-id')

        expect(result).toEqual(expect.any(Array))
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('projects')
        expect(mockSupabaseClient.eq).toHaveBeenCalledWith('owner_id', 'test-user-id')
      })
    })
  })

  describe('Error Handling', () => {
    it('should map PostgreSQL error codes correctly', async () => {
      // Test NOT_FOUND error
      mockSupabaseClient.from.mockImplementation(() => ({
        ...mockSupabaseClient,
        then: vi.fn((resolve) => {
          resolve({ data: null, error: { code: 'PGRST116', message: 'Not found' } })
          return Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'Not found' } })
        })
      }))

      const result = await DatabaseService.getIdeasByProject('nonexistent')

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('NOT_FOUND')
    })

    it('should map permission errors correctly', async () => {
      mockSupabaseClient.from.mockImplementation(() => ({
        ...mockSupabaseClient,
        then: vi.fn((resolve) => {
          resolve({ data: null, error: { message: 'permission denied' } })
          return Promise.resolve({ data: null, error: { message: 'permission denied' } })
        })
      }))

      const result = await DatabaseService.getIdeasByProject('restricted')

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('PERMISSION_DENIED')
    })
  })

  describe('Collaboration Features', () => {
    describe('addProjectCollaborator', () => {
      it('should add a collaborator to a project', async () => {
        // Mock successful insertion
        mockSupabaseClient.insert.mockResolvedValue({ error: null })

        const result = await DatabaseService.addProjectCollaborator(
          'test-project-id',
          'collaborator@example.com',
          'viewer',
          'test-user-id',
          'Test Project',
          'Test User',
          'test@example.com'
        )

        expect(result).toBe(true)
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('project_collaborators')
        expect(mockSupabaseClient.insert).toHaveBeenCalledWith([
          expect.objectContaining({
            project_id: 'test-project-id',
            role: 'viewer',
            invited_by: 'test-user-id',
            status: 'pending'
          })
        ])
      })
    })

    describe('getProjectCollaborators', () => {
      it('should fetch project collaborators', async () => {
        const result = await DatabaseService.getProjectCollaborators('test-project-id')

        expect(result).toEqual(expect.any(Array))
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('project_collaborators')
        expect(mockSupabaseClient.eq).toHaveBeenCalledWith('project_id', 'test-project-id')
      })
    })
  })
})