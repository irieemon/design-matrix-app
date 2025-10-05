/**
 * ProjectRepository Tests
 *
 * Critical tests for project management and access control that handles:
 * - Project CRUD operations with proper ownership validation
 * - Multi-user access control and collaboration features
 * - Project insights storage and versioning system
 * - Real-time project updates for collaborative workspaces
 * - LocalStorage integration for session persistence
 * - Project statistics and analytics data
 *
 * Business Impact: Unauthorized access, data leaks, collaboration conflicts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Project } from '../../../types'

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

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
})

// Import after mocks
import { ProjectRepository } from '../projectRepository'
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
    limit: vi.fn().mockReturnThis(),
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

describe('ProjectRepository', () => {
  const sampleProject: Project = {
    id: 'proj123',
    name: 'Test Project',
    description: 'A test project for validation',
    owner_id: 'user123',
    is_public: false,
    created_at: '2023-01-01T00:00:00.000Z',
    updated_at: '2023-01-01T00:00:00.000Z'
  }

  const sampleCreateProject: Omit<Project, 'id' | 'created_at' | 'updated_at'> = {
    name: 'New Project',
    description: 'A new project for testing',
    owner_id: 'user456',
    is_public: true
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
    mockLocalStorage.getItem.mockClear()
    mockLocalStorage.setItem.mockClear()
    mockLocalStorage.removeItem.mockClear()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('getAllProjects', () => {
    it('should fetch all projects ordered by creation date', async () => {
      const mockProjects = [sampleProject, { ...sampleProject, id: 'proj456' }]
      mockQuery.order.mockResolvedValue({ data: mockProjects, error: null })

      const result = await ProjectRepository.getAllProjects()

      expect(mockSupabase.from).toHaveBeenCalledWith('projects')
      expect(mockQuery.select).toHaveBeenCalledWith('*')
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(result).toEqual(mockProjects)
    })

    it('should handle database errors gracefully', async () => {
      const dbError = { message: 'Database connection failed', code: 'CONNECTION_ERROR' }
      mockQuery.order.mockResolvedValue({ data: null, error: dbError })

      await expect(ProjectRepository.getAllProjects()).rejects.toThrow('Database connection failed')

      expect(mockLogger.error).toHaveBeenCalledWith('Error fetching all projects:', dbError)
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get all projects:', expect.any(Error))
    })

    it('should return empty array when no projects exist', async () => {
      mockQuery.order.mockResolvedValue({ data: [], error: null })

      const result = await ProjectRepository.getAllProjects()

      expect(result).toEqual([])
    })

    it('should handle null data response', async () => {
      mockQuery.order.mockResolvedValue({ data: null, error: null })

      const result = await ProjectRepository.getAllProjects()

      expect(result).toEqual([])
    })

    it('should handle network failures', async () => {
      mockQuery.order.mockRejectedValue(new Error('Network timeout'))

      await expect(ProjectRepository.getAllProjects()).rejects.toThrow('Network timeout')
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get all projects:', expect.any(Error))
    })
  })

  describe('getUserOwnedProjects', () => {
    it('should fetch projects owned by a specific user', async () => {
      const userProjects = [sampleProject]
      mockQuery.order.mockResolvedValue({ data: userProjects, error: null })

      const result = await ProjectRepository.getUserOwnedProjects('user123')

      expect(mockSupabase.from).toHaveBeenCalledWith('projects')
      expect(mockQuery.select).toHaveBeenCalledWith('*')
      expect(mockQuery.eq).toHaveBeenCalledWith('owner_id', 'user123')
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(result).toEqual(userProjects)
    })

    it('should handle users with no projects', async () => {
      mockQuery.order.mockResolvedValue({ data: [], error: null })

      const result = await ProjectRepository.getUserOwnedProjects('user456')

      expect(result).toEqual([])
    })

    it('should handle database errors when fetching user projects', async () => {
      const dbError = { message: 'User access denied', code: 'ACCESS_DENIED' }
      mockQuery.order.mockResolvedValue({ data: null, error: dbError })

      await expect(ProjectRepository.getUserOwnedProjects('user123')).rejects.toThrow('User access denied')
    })

    it('should handle invalid user IDs', async () => {
      const invalidError = { message: 'Invalid user ID format', code: 'INVALID_INPUT' }
      mockQuery.order.mockResolvedValue({ data: null, error: invalidError })

      await expect(ProjectRepository.getUserOwnedProjects('invalid-id')).rejects.toThrow('Invalid user ID format')
    })
  })

  describe('getUserProjects', () => {
    it('should return owned projects for now (as documented)', async () => {
      const userProjects = [sampleProject]
      mockQuery.order.mockResolvedValue({ data: userProjects, error: null })

      const result = await ProjectRepository.getUserProjects('user123')

      expect(result).toEqual(userProjects)
    })

    it('should handle errors from getUserOwnedProjects', async () => {
      mockQuery.order.mockRejectedValue(new Error('Database error'))

      const result = await ProjectRepository.getUserProjects('user123')

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get user accessible projects:', expect.any(Error))
      // Should not throw, should return empty or handle gracefully
    })
  })

  describe('getCurrentProject', () => {
    it('should get project from localStorage when available', async () => {
      const projectId = 'stored-project-123'
      mockLocalStorage.getItem.mockReturnValue(projectId)
      mockQuery.single.mockResolvedValue({ data: sampleProject, error: null })

      const result = await ProjectRepository.getCurrentProject()

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('currentProjectId')
      expect(mockSupabase.from).toHaveBeenCalledWith('projects')
      expect(mockQuery.eq).toHaveBeenCalledWith('id', projectId)
      expect(result).toEqual(sampleProject)
    })

    it('should return null when no stored project ID', async () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      const result = await ProjectRepository.getCurrentProject()

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('currentProjectId')
      expect(result).toBeNull()
    })

    it('should handle localStorage errors gracefully', async () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage unavailable')
      })

      const result = await ProjectRepository.getCurrentProject()

      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get current project:', expect.any(Error))
    })

    it('should handle project not found in database', async () => {
      mockLocalStorage.getItem.mockReturnValue('nonexistent-project')
      mockQuery.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })

      const result = await ProjectRepository.getCurrentProject()

      expect(result).toBeNull()
    })
  })

  describe('getProjectById', () => {
    it('should fetch a specific project by ID', async () => {
      mockQuery.single.mockResolvedValue({ data: sampleProject, error: null })

      const result = await ProjectRepository.getProjectById('proj123')

      expect(mockSupabase.from).toHaveBeenCalledWith('projects')
      expect(mockQuery.select).toHaveBeenCalledWith('*')
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'proj123')
      expect(mockQuery.single).toHaveBeenCalled()
      expect(result).toEqual(sampleProject)
    })

    it('should return null when project not found', async () => {
      mockQuery.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })

      const result = await ProjectRepository.getProjectById('nonexistent')

      expect(result).toBeNull()
    })

    it('should handle database errors', async () => {
      const dbError = { message: 'Database error', code: 'DB_ERROR' }
      mockQuery.single.mockResolvedValue({ data: null, error: dbError })

      await expect(ProjectRepository.getProjectById('proj123')).rejects.toThrow('Database error')
    })

    it('should handle network failures', async () => {
      mockQuery.single.mockRejectedValue(new Error('Connection lost'))

      const result = await ProjectRepository.getProjectById('proj123')

      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get project by ID:', expect.any(Error))
    })
  })

  describe('createProject', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2023-12-01T10:00:00.000Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should create a new project with timestamps', async () => {
      const createdProject = { ...sampleProject, id: 'new-proj-123' }
      mockQuery.single.mockResolvedValue({ data: createdProject, error: null })

      const result = await ProjectRepository.createProject(sampleCreateProject)

      expect(mockSupabase.from).toHaveBeenCalledWith('projects')
      expect(mockQuery.insert).toHaveBeenCalledWith([{
        ...sampleCreateProject,
        created_at: '2023-12-01T10:00:00.000Z',
        updated_at: '2023-12-01T10:00:00.000Z'
      }])
      expect(mockQuery.select).toHaveBeenCalled()
      expect(mockQuery.single).toHaveBeenCalled()
      expect(result).toEqual(createdProject)
    })

    it('should handle project creation errors', async () => {
      const constraintError = {
        message: 'Unique constraint violation',
        code: '23505'
      }
      mockQuery.single.mockResolvedValue({ data: null, error: constraintError })

      await expect(ProjectRepository.createProject(sampleCreateProject)).rejects.toThrow('Unique constraint violation')

      expect(mockLogger.error).toHaveBeenCalledWith('Error creating project:', constraintError)
    })

    it('should handle network failures during creation', async () => {
      mockQuery.single.mockRejectedValue(new Error('Network error'))

      const result = await ProjectRepository.createProject(sampleCreateProject)

      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create project:', expect.any(Error))
    })

    it('should log successful creation', async () => {
      const createdProject = { ...sampleProject, id: 'logged-proj' }
      mockQuery.single.mockResolvedValue({ data: createdProject, error: null })

      await ProjectRepository.createProject(sampleCreateProject)

      expect(mockLogger.debug).toHaveBeenCalledWith('Creating project:', sampleCreateProject.name)
      expect(mockLogger.debug).toHaveBeenCalledWith('Project created successfully:', 'logged-proj')
    })
  })

  describe('updateProject', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2023-12-01T15:30:00.000Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should update a project with new timestamp', async () => {
      const updates = { name: 'Updated Project', description: 'Updated description' }
      const updatedProject = { ...sampleProject, ...updates, updated_at: '2023-12-01T15:30:00.000Z' }
      mockQuery.single.mockResolvedValue({ data: updatedProject, error: null })

      const result = await ProjectRepository.updateProject('proj123', updates)

      expect(mockSupabase.from).toHaveBeenCalledWith('projects')
      expect(mockQuery.update).toHaveBeenCalledWith({
        ...updates,
        updated_at: '2023-12-01T15:30:00.000Z'
      })
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'proj123')
      expect(result).toEqual(updatedProject)
    })

    it('should handle project not found errors', async () => {
      const notFoundError = { message: 'No rows found', code: 'PGRST116' }
      mockQuery.single.mockResolvedValue({ data: null, error: notFoundError })

      await expect(ProjectRepository.updateProject('nonexistent', { name: 'Updated' })).rejects.toThrow('No rows found')
    })

    it('should handle permission errors', async () => {
      const permissionError = { message: 'Permission denied', code: 'PERMISSION_DENIED' }
      mockQuery.single.mockResolvedValue({ data: null, error: permissionError })

      await expect(ProjectRepository.updateProject('proj123', { name: 'Updated' })).rejects.toThrow('Permission denied')
    })

    it('should handle network failures', async () => {
      mockQuery.single.mockRejectedValue(new Error('Connection timeout'))

      const result = await ProjectRepository.updateProject('proj123', { name: 'Updated' })

      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to update project:', expect.any(Error))
    })

    it('should log update operations', async () => {
      const updates = { name: 'Logged Update' }
      const updatedProject = { ...sampleProject, ...updates }
      mockQuery.single.mockResolvedValue({ data: updatedProject, error: null })

      await ProjectRepository.updateProject('proj123', updates)

      expect(mockLogger.debug).toHaveBeenCalledWith('Updating project:', 'proj123', updates)
      expect(mockLogger.debug).toHaveBeenCalledWith('Project updated successfully:', 'proj123')
    })
  })

  describe('deleteProject', () => {
    it('should successfully delete a project', async () => {
      mockQuery.delete.mockResolvedValue({ error: null })

      const result = await ProjectRepository.deleteProject('proj123')

      expect(mockSupabase.from).toHaveBeenCalledWith('projects')
      expect(mockQuery.delete).toHaveBeenCalled()
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'proj123')
      expect(result).toBe(true)
      expect(mockLogger.debug).toHaveBeenCalledWith('Deleting project:', 'proj123')
      expect(mockLogger.debug).toHaveBeenCalledWith('Project deleted successfully:', 'proj123')
    })

    it('should handle deletion errors', async () => {
      const deleteError = { message: 'Foreign key constraint violation', code: 'FOREIGN_KEY_VIOLATION' }
      mockQuery.delete.mockResolvedValue({ error: deleteError })

      const result = await ProjectRepository.deleteProject('proj123')

      expect(result).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith('Error deleting project:', deleteError)
    })

    it('should handle cascade deletion requirements', async () => {
      const cascadeError = { message: 'Cannot delete project with existing ideas', code: 'RESTRICT_VIOLATION' }
      mockQuery.delete.mockResolvedValue({ error: cascadeError })

      const result = await ProjectRepository.deleteProject('proj123')

      expect(result).toBe(false)
    })

    it('should handle network failures during deletion', async () => {
      mockQuery.delete.mockRejectedValue(new Error('Network timeout'))

      const result = await ProjectRepository.deleteProject('proj123')

      expect(result).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to delete project:', expect.any(Error))
    })
  })

  describe('LocalStorage Integration', () => {
    describe('setCurrentProject', () => {
      it('should store project ID in localStorage', () => {
        ProjectRepository.setCurrentProject('proj123')

        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('currentProjectId', 'proj123')
        expect(mockLogger.debug).toHaveBeenCalledWith('Current project set:', 'proj123')
      })

      it('should handle localStorage errors gracefully', () => {
        mockLocalStorage.setItem.mockImplementation(() => {
          throw new Error('localStorage full')
        })

        expect(() => ProjectRepository.setCurrentProject('proj123')).not.toThrow()
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to set current project:', expect.any(Error))
      })
    })

    describe('clearCurrentProject', () => {
      it('should remove project ID from localStorage', () => {
        ProjectRepository.clearCurrentProject()

        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('currentProjectId')
        expect(mockLogger.debug).toHaveBeenCalledWith('Current project cleared')
      })

      it('should handle localStorage errors gracefully', () => {
        mockLocalStorage.removeItem.mockImplementation(() => {
          throw new Error('localStorage error')
        })

        expect(() => ProjectRepository.clearCurrentProject()).not.toThrow()
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to clear current project:', expect.any(Error))
      })
    })
  })

  describe('getProjectStats', () => {
    it('should fetch project statistics correctly', async () => {
      // Mock idea count query
      mockQuery.select.mockReturnValueOnce(mockQuery)
      mockQuery.eq.mockReturnValueOnce(mockQuery)

      // Mock idea count response
      const mockCountResponse = { count: 15, error: null }

      // Mock last activity query
      const lastActivityData = { updated_at: '2023-12-01T10:00:00.000Z' }

      // Configure the chain for different calls
      mockQuery.eq
        .mockReturnValueOnce(mockQuery) // for count query
        .mockReturnValueOnce(mockQuery) // for activity query

      mockQuery.order.mockReturnValueOnce(mockQuery)
      mockQuery.limit.mockReturnValueOnce(mockQuery)

      // Setup different responses for different queries
      mockSupabase.from
        .mockReturnValueOnce({ // First call for idea count
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue(mockCountResponse)
          })
        })
        .mockReturnValueOnce({ // Second call for last activity
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: lastActivityData, error: null })
                })
              })
            })
          })
        })

      const result = await ProjectRepository.getProjectStats('proj123')

      expect(result).toEqual({
        ideaCount: 15,
        collaboratorCount: 1,
        lastActivity: '2023-12-01T10:00:00.000Z'
      })
    })

    it('should handle idea count query errors', async () => {
      const countError = { message: 'Count query failed', code: 'QUERY_ERROR' }

      mockSupabase.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: null, error: countError })
          })
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
                })
              })
            })
          })
        })

      const result = await ProjectRepository.getProjectStats('proj123')

      expect(mockLogger.error).toHaveBeenCalledWith('Error getting idea count:', countError)
      expect(result).toEqual({
        ideaCount: 0,
        collaboratorCount: 1,
        lastActivity: null
      })
    })

    it('should handle no activity found', async () => {
      mockSupabase.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 5, error: null })
          })
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
                })
              })
            })
          })
        })

      const result = await ProjectRepository.getProjectStats('proj123')

      expect(result.lastActivity).toBeNull()
    })

    it('should handle complete stats query failure', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Database unavailable')
      })

      const result = await ProjectRepository.getProjectStats('proj123')

      expect(result).toEqual({
        ideaCount: 0,
        collaboratorCount: 0,
        lastActivity: null
      })
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get project stats:', expect.any(Error))
    })
  })

  describe('Project Insights', () => {
    describe('getProjectInsight', () => {
      it('should fetch a specific project insight', async () => {
        const insightData = {
          id: 'insight123',
          project_id: 'proj123',
          version: 1,
          name: 'Insights v1',
          insights_data: { summary: 'Test insights' },
          created_by: 'user123'
        }
        mockQuery.single.mockResolvedValue({ data: insightData, error: null })

        const result = await ProjectRepository.getProjectInsight('insight123')

        expect(mockSupabase.from).toHaveBeenCalledWith('project_insights')
        expect(mockQuery.select).toHaveBeenCalledWith('*')
        expect(mockQuery.eq).toHaveBeenCalledWith('id', 'insight123')
        expect(result).toEqual(insightData)
      })

      it('should return null when insight not found', async () => {
        mockQuery.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })

        const result = await ProjectRepository.getProjectInsight('nonexistent')

        expect(result).toBeNull()
      })

      it('should handle database errors', async () => {
        const dbError = { message: 'Access denied', code: 'ACCESS_DENIED' }
        mockQuery.single.mockResolvedValue({ data: null, error: dbError })

        await expect(ProjectRepository.getProjectInsight('insight123')).rejects.toThrow('Access denied')
      })
    })

    describe('saveProjectInsights', () => {
      beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2023-12-01T10:00:00.000Z'))
      })

      afterEach(() => {
        vi.useRealTimers()
      })

      it('should save new project insights with version increment', async () => {
        const existingInsights = [{ version: 2 }]
        const newInsightId = 'insight456'
        const insightsData = { summary: 'AI analysis', recommendations: ['Improve UX', 'Add features'] }

        // Mock version query
        mockSupabase.from
          .mockReturnValueOnce({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: existingInsights, error: null })
                })
              })
            })
          })
          .mockReturnValueOnce({
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: newInsightId },
                  error: null
                })
              })
            })
          })

        const result = await ProjectRepository.saveProjectInsights('proj123', insightsData, 'user123', 10)

        expect(result).toBe(newInsightId)
        expect(mockLogger.debug).toHaveBeenCalledWith('Saving project insights for project:', 'proj123', 'with', 10, 'ideas')
        expect(mockLogger.debug).toHaveBeenCalledWith('Project insights saved successfully:', newInsightId)
      })

      it('should handle first insights save (version 1)', async () => {
        const insightsData = { summary: 'First analysis' }
        const newInsightId = 'insight789'

        mockSupabase.from
          .mockReturnValueOnce({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null })
                })
              })
            })
          })
          .mockReturnValueOnce({
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: newInsightId },
                  error: null
                })
              })
            })
          })

        const result = await ProjectRepository.saveProjectInsights('proj123', insightsData, 'user123', 5)

        expect(result).toBe(newInsightId)
      })

      it('should handle insights save errors', async () => {
        const saveError = { message: 'Storage quota exceeded', code: 'STORAGE_ERROR' }

        mockSupabase.from
          .mockReturnValueOnce({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null })
                })
              })
            })
          })
          .mockReturnValueOnce({
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: saveError })
              })
            })
          })

        await expect(
          ProjectRepository.saveProjectInsights('proj123', {}, 'user123', 1)
        ).rejects.toThrow('Storage quota exceeded')

        expect(mockLogger.error).toHaveBeenCalledWith('Error saving project insights:', saveError)
      })

      it('should handle network failures during insights save', async () => {
        mockSupabase.from.mockImplementation(() => {
          throw new Error('Network error')
        })

        const result = await ProjectRepository.saveProjectInsights('proj123', {}, 'user123', 1)

        expect(result).toBeNull()
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to save project insights:', expect.any(Error))
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

    it('should set up real-time subscription with user filter', async () => {
      const mockCallback = vi.fn()
      mockQuery.order.mockResolvedValue({ data: [sampleProject], error: null })

      const unsubscribe = ProjectRepository.subscribeToProjects(mockCallback, 'user123')

      expect(mockSupabase.channel).toHaveBeenCalledWith('projects_changes_user123_4lxrgs')
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: 'owner_id=eq.user123'
        },
        expect.any(Function)
      )
      expect(typeof unsubscribe).toBe('function')
    })

    it('should set up anonymous subscription without filter', async () => {
      const mockCallback = vi.fn()
      mockQuery.order.mockResolvedValue({ data: [], error: null })

      ProjectRepository.subscribeToProjects(mockCallback)

      expect(mockSupabase.channel).toHaveBeenCalledWith('projects_changes_anonymous_4lxrgs')
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects'
        },
        expect.any(Function)
      )
    })

    it('should load initial data when subscription starts', async () => {
      const mockCallback = vi.fn()
      const initialProjects = [sampleProject]
      mockQuery.order.mockResolvedValue({ data: initialProjects, error: null })

      ProjectRepository.subscribeToProjects(mockCallback, 'user123')

      // Wait for async initial load
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockCallback).toHaveBeenCalledWith(initialProjects)
    })

    it('should handle initial data loading errors', async () => {
      const mockCallback = vi.fn()
      mockQuery.order.mockRejectedValue(new Error('Load failed'))

      ProjectRepository.subscribeToProjects(mockCallback, 'user123')

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockCallback).toHaveBeenCalledWith(null)
      expect(mockLogger.error).toHaveBeenCalledWith('Error loading initial projects:', expect.any(Error))
    })

    it('should handle real-time callback errors gracefully', async () => {
      const mockCallback = vi.fn()
      mockQuery.order
        .mockResolvedValueOnce({ data: [], error: null }) // Initial load
        .mockRejectedValueOnce(new Error('Callback failed')) // Real-time refresh

      ProjectRepository.subscribeToProjects(mockCallback, 'user123')

      const realTimeHandler = mockChannel.on.mock.calls[0][2]
      const event = {
        eventType: 'INSERT',
        new: { id: 'new-proj', owner_id: 'user123' }
      }

      realTimeHandler(event)

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockCallback).toHaveBeenCalledWith(null)
      expect(mockLogger.error).toHaveBeenCalledWith('Error refreshing projects:', expect.any(Error))
    })

    it('should return functional unsubscribe method', async () => {
      const mockCallback = vi.fn()
      mockQuery.order.mockResolvedValue({ data: [], error: null })

      const unsubscribe = ProjectRepository.subscribeToProjects(mockCallback, 'user123')

      unsubscribe()

      expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel)
      expect(mockLogger.debug).toHaveBeenCalledWith('🔴 Unsubscribing from projects channel:', 'projects_changes_user123_4lxrgs')
    })

    it('should handle subscription setup failures', async () => {
      const mockCallback = vi.fn()
      mockSupabase.channel.mockImplementation(() => {
        throw new Error('Channel setup failed')
      })

      const unsubscribe = ProjectRepository.subscribeToProjects(mockCallback, 'user123')

      expect(typeof unsubscribe).toBe('function')
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to set up projects subscription:', expect.any(Error))

      // Unsubscribe should not crash
      expect(() => unsubscribe()).not.toThrow()
    })
  })
})