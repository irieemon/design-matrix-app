/**
 * ProjectService Test Suite
 *
 * Comprehensive tests for ProjectService functionality including:
 * - CRUD operations (create, read, update, delete)
 * - Project querying and filtering
 * - User ownership and access
 * - Real-time subscriptions
 * - Error handling and validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ProjectService } from '../ProjectService'
import type { Project, CreateProjectInput } from '../../../types'

// Mock Supabase client
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis()
}

const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  delete: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  order: vi.fn(() => mockSupabase),
  limit: vi.fn(() => mockSupabase),
  single: vi.fn(() => Promise.resolve({ data: null, error: null })),
  channel: vi.fn(() => mockChannel),
  removeChannel: vi.fn()
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

describe('ProjectService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    global.crypto = {
      randomUUID: () => '12345678-1234-1234-1234-123456789abc'
    } as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
    ProjectService.cleanup()
  })

  describe('getAllProjects', () => {
    it('should fetch all projects', async () => {
      const mockProjects: Project[] = [
        {
          id: 'proj-1',
          name: 'Project 1',
          project_type: 'software',
          status: 'active',
          visibility: 'private',
          priority_level: 'high',
          owner_id: 'user-1',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        }
      ]

      mockSupabase.single.mockResolvedValue({ data: mockProjects, error: null })

      const result = await ProjectService.getAllProjects()

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockProjects)
      expect(mockSupabase.from).toHaveBeenCalledWith('projects')
      expect(mockSupabase.order).toHaveBeenCalledWith('updated_at', { ascending: false })
    })

    it('should filter by status', async () => {
      mockSupabase.single.mockResolvedValue({ data: [], error: null })

      await ProjectService.getAllProjects({ status: 'active' })

      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'active')
    })

    it('should filter by project type', async () => {
      mockSupabase.single.mockResolvedValue({ data: [], error: null })

      await ProjectService.getAllProjects({ type: 'software' })

      expect(mockSupabase.eq).toHaveBeenCalledWith('project_type', 'software')
    })

    it('should filter by owner ID', async () => {
      mockSupabase.single.mockResolvedValue({ data: [], error: null })

      await ProjectService.getAllProjects({ ownerId: 'user-1' })

      expect(mockSupabase.eq).toHaveBeenCalledWith('owner_id', 'user-1')
    })

    it('should filter by team ID', async () => {
      mockSupabase.single.mockResolvedValue({ data: [], error: null })

      await ProjectService.getAllProjects({ teamId: 'team-1' })

      expect(mockSupabase.eq).toHaveBeenCalledWith('team_id', 'team-1')
    })

    it('should filter by visibility', async () => {
      mockSupabase.single.mockResolvedValue({ data: [], error: null })

      await ProjectService.getAllProjects({ visibility: 'public' })

      expect(mockSupabase.eq).toHaveBeenCalledWith('visibility', 'public')
    })

    it('should apply limit', async () => {
      mockSupabase.single.mockResolvedValue({ data: [], error: null })

      await ProjectService.getAllProjects({ limit: 10 })

      expect(mockSupabase.limit).toHaveBeenCalledWith(10)
    })

    it('should handle database errors', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Connection failed', code: '08003' }
      })

      const result = await ProjectService.getAllProjects()

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('getUserOwnedProjects', () => {
    it('should fetch projects owned by user', async () => {
      const mockProjects: Project[] = [
        {
          id: 'proj-1',
          name: 'My Project',
          project_type: 'software',
          status: 'active',
          visibility: 'private',
          priority_level: 'high',
          owner_id: 'user-1',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        }
      ]

      mockSupabase.single.mockResolvedValue({ data: mockProjects, error: null })

      const result = await ProjectService.getUserOwnedProjects('user-1')

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockProjects)
      expect(mockSupabase.eq).toHaveBeenCalledWith('owner_id', 'user-1')
    })

    it('should validate user ID', async () => {
      const result = await ProjectService.getUserOwnedProjects('')

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    it('should return empty array when user has no projects', async () => {
      mockSupabase.single.mockResolvedValue({ data: [], error: null })

      const result = await ProjectService.getUserOwnedProjects('user-1')

      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
    })
  })

  describe('getCurrentProject', () => {
    it('should fetch current active project', async () => {
      const mockProject: Project = {
        id: 'proj-1',
        name: 'Active Project',
        project_type: 'software',
        status: 'active',
        visibility: 'private',
        priority_level: 'high',
        owner_id: 'user-1',
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      }

      mockSupabase.single.mockResolvedValue({ data: [mockProject], error: null })

      const result = await ProjectService.getCurrentProject()

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockProject)
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'active')
      expect(mockSupabase.limit).toHaveBeenCalledWith(1)
    })

    it('should return null when no active project exists', async () => {
      mockSupabase.single.mockResolvedValue({ data: [], error: null })

      const result = await ProjectService.getCurrentProject()

      expect(result.success).toBe(true)
      expect(result.data).toBeNull()
    })
  })

  describe('getProjectById', () => {
    it('should fetch project by ID', async () => {
      const mockProject: Project = {
        id: 'proj-1',
        name: 'Test Project',
        project_type: 'software',
        status: 'active',
        visibility: 'private',
        priority_level: 'high',
        owner_id: 'user-1',
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      }

      mockSupabase.single.mockResolvedValue({ data: mockProject, error: null })

      const result = await ProjectService.getProjectById('proj-1')

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockProject)
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'proj-1')
    })

    it('should return null for non-existent project', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' }
      })

      const result = await ProjectService.getProjectById('non-existent')

      expect(result.success).toBe(true)
      expect(result.data).toBeNull()
    })

    it('should validate project ID', async () => {
      const result = await ProjectService.getProjectById('')

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('getUserProjects', () => {
    it('should fetch owned and collaborated projects', async () => {
      const ownedProjects: Project[] = [
        {
          id: 'proj-1',
          name: 'Owned Project',
          project_type: 'software',
          status: 'active',
          visibility: 'private',
          priority_level: 'high',
          owner_id: 'user-1',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        }
      ]

      const collaboratedProjects = [
        {
          project: {
            id: 'proj-2',
            name: 'Collaborated Project',
            project_type: 'software',
            status: 'active',
            visibility: 'team',
            priority_level: 'medium',
            owner_id: 'user-2',
            created_at: '2024-01-01',
            updated_at: '2024-01-01'
          }
        }
      ]

      mockSupabase.single
        .mockResolvedValueOnce({ data: ownedProjects, error: null })
        .mockResolvedValueOnce({ data: collaboratedProjects, error: null })

      const result = await ProjectService.getUserProjects('user-1')

      expect(result.success).toBe(true)
      expect(result.data?.length).toBe(2)
    })

    it('should deduplicate projects', async () => {
      const project: Project = {
        id: 'proj-1',
        name: 'Project',
        project_type: 'software',
        status: 'active',
        visibility: 'private',
        priority_level: 'high',
        owner_id: 'user-1',
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      }

      mockSupabase.single
        .mockResolvedValueOnce({ data: [project], error: null })
        .mockResolvedValueOnce({ data: [{ project }], error: null })

      const result = await ProjectService.getUserProjects('user-1')

      expect(result.success).toBe(true)
      expect(result.data?.length).toBe(1)
    })

    it('should validate user ID', async () => {
      const result = await ProjectService.getUserProjects('')

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('createProject', () => {
    it('should create project with valid input', async () => {
      const input: CreateProjectInput = {
        name: 'New Project',
        project_type: 'software',
        status: 'active',
        visibility: 'private',
        priority_level: 'high',
        owner_id: 'user-1'
      }

      const mockCreatedProject: Project = {
        ...input,
        id: '12345678-1234-1234-1234-123456789abc',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      }

      mockSupabase.single.mockResolvedValue({ data: mockCreatedProject, error: null })

      const result = await ProjectService.createProject(input)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockCreatedProject)
      expect(mockSupabase.insert).toHaveBeenCalled()
    })

    it('should validate required name field', async () => {
      const input: CreateProjectInput = {
        name: '',
        project_type: 'software',
        status: 'active',
        visibility: 'private',
        priority_level: 'high',
        owner_id: 'user-1'
      }

      const result = await ProjectService.createProject(input)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
      expect(result.error?.message).toContain('Invalid name')
    })

    it('should validate status enum', async () => {
      const input: any = {
        name: 'Test',
        project_type: 'software',
        status: 'invalid-status',
        visibility: 'private',
        priority_level: 'high',
        owner_id: 'user-1'
      }

      const result = await ProjectService.createProject(input)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    it('should validate visibility enum', async () => {
      const input: any = {
        name: 'Test',
        project_type: 'software',
        status: 'active',
        visibility: 'invalid-visibility',
        priority_level: 'high',
        owner_id: 'user-1'
      }

      const result = await ProjectService.createProject(input)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    it('should generate UUID for new project', async () => {
      const input: CreateProjectInput = {
        name: 'Test',
        project_type: 'software',
        status: 'active',
        visibility: 'private',
        priority_level: 'high',
        owner_id: 'user-1'
      }

      mockSupabase.single.mockResolvedValue({
        data: { ...input, id: '12345678-1234-1234-1234-123456789abc' },
        error: null
      })

      const result = await ProjectService.createProject(input)

      expect(result.success).toBe(true)
      expect(result.data?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    })

    it('should set timestamps on creation', async () => {
      const input: CreateProjectInput = {
        name: 'Test',
        project_type: 'software',
        status: 'active',
        visibility: 'private',
        priority_level: 'high',
        owner_id: 'user-1'
      }

      const mockData = {
        ...input,
        id: 'proj-1',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      }

      mockSupabase.single.mockResolvedValue({ data: mockData, error: null })

      const result = await ProjectService.createProject(input)

      expect(result.success).toBe(true)
      expect(result.data?.created_at).toBeDefined()
      expect(result.data?.updated_at).toBeDefined()
    })
  })

  describe('updateProject', () => {
    it('should update project with valid changes', async () => {
      const updates = {
        name: 'Updated Name',
        status: 'completed' as const
      }

      const mockUpdatedProject: Project = {
        id: 'proj-1',
        name: updates.name,
        project_type: 'software',
        status: updates.status,
        visibility: 'private',
        priority_level: 'high',
        owner_id: 'user-1',
        created_at: '2024-01-01',
        updated_at: '2024-01-02'
      }

      mockSupabase.single.mockResolvedValue({ data: mockUpdatedProject, error: null })

      const result = await ProjectService.updateProject('proj-1', updates)

      expect(result.success).toBe(true)
      expect(result.data?.name).toBe(updates.name)
      expect(mockSupabase.update).toHaveBeenCalled()
    })

    it('should validate project ID', async () => {
      const result = await ProjectService.updateProject('', { name: 'Test' })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    it('should update timestamp on modification', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'proj-1',
          name: 'Updated',
          updated_at: '2024-01-02T00:00:00.000Z'
        },
        error: null
      })

      const result = await ProjectService.updateProject('proj-1', { name: 'Updated' })

      expect(result.success).toBe(true)
      expect(result.data?.updated_at).toBeDefined()
    })

    it('should check permissions before update', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Insufficient permissions' }
      })

      const result = await ProjectService.updateProject('proj-1', { name: 'Test' }, { userId: 'user-2' })

      expect(result.success).toBe(false)
    })
  })

  describe('deleteProject', () => {
    it('should delete project successfully', async () => {
      mockSupabase.delete.mockResolvedValue({ error: null })

      const result = await ProjectService.deleteProject('proj-1')

      expect(result.success).toBe(true)
      expect(result.data).toBe(true)
      expect(mockSupabase.delete).toHaveBeenCalled()
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'proj-1')
    })

    it('should validate project ID', async () => {
      const result = await ProjectService.deleteProject('')

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    it('should check permissions before deletion', async () => {
      mockSupabase.delete.mockResolvedValue({
        error: { message: 'Insufficient permissions' }
      })

      const result = await ProjectService.deleteProject('proj-1', { userId: 'user-2' })

      expect(result.success).toBe(false)
    })

    it('should handle foreign key violations', async () => {
      mockSupabase.delete.mockResolvedValue({
        error: { code: '23503', message: 'Foreign key violation' }
      })

      const result = await ProjectService.deleteProject('proj-1')

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('FOREIGN_KEY_VIOLATION')
    })
  })

  describe('Real-time Subscriptions', () => {
    it('should create subscription for project changes', () => {
      const callback = vi.fn()

      const unsubscribe = ProjectService.subscribeToProjects(callback)

      expect(mockSupabase.channel).toHaveBeenCalled()
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: '*',
          schema: 'public',
          table: 'projects'
        }),
        expect.any(Function)
      )
      expect(mockChannel.subscribe).toHaveBeenCalled()
      expect(typeof unsubscribe).toBe('function')
    })

    it('should call callback on project changes', async () => {
      const callback = vi.fn()
      const mockProjects: Project[] = [
        {
          id: 'proj-1',
          name: 'Project',
          project_type: 'software',
          status: 'active',
          visibility: 'private',
          priority_level: 'high',
          owner_id: 'user-1',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        }
      ]

      let changeHandler: Function = () => {}
      mockChannel.on.mockImplementation((event, config, handler) => {
        changeHandler = handler
        return mockChannel
      })

      mockSupabase.single.mockResolvedValue({ data: mockProjects, error: null })

      ProjectService.subscribeToProjects(callback)

      // Simulate a change event
      await changeHandler({ eventType: 'INSERT' })

      expect(callback).toHaveBeenCalledWith(mockProjects)
    })

    it('should unsubscribe correctly', () => {
      const callback = vi.fn()

      const unsubscribe = ProjectService.subscribeToProjects(callback)
      unsubscribe()

      expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel)
    })

    it('should include user ID in channel name when provided', () => {
      const callback = vi.fn()

      ProjectService.subscribeToProjects(callback, { userId: 'user-123' })

      expect(mockSupabase.channel).toHaveBeenCalledWith(
        expect.stringContaining('user_123')
      )
    })

    it('should handle errors in subscription callback', async () => {
      const callback = vi.fn()

      let changeHandler: Function = () => {}
      mockChannel.on.mockImplementation((event, config, handler) => {
        changeHandler = handler
        return mockChannel
      })

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      })

      ProjectService.subscribeToProjects(callback)

      await changeHandler({ eventType: 'UPDATE' })

      expect(callback).toHaveBeenCalledWith([])
    })
  })

  describe('Legacy Methods', () => {
    it('should support legacyGetAllProjects', async () => {
      const mockProjects: Project[] = []
      mockSupabase.single.mockResolvedValue({ data: mockProjects, error: null })

      const projects = await ProjectService.legacyGetAllProjects()

      expect(projects).toEqual(mockProjects)
    })

    it('should support legacyGetUserOwnedProjects', async () => {
      const mockProjects: Project[] = []
      mockSupabase.single.mockResolvedValue({ data: mockProjects, error: null })

      const projects = await ProjectService.legacyGetUserOwnedProjects('user-1')

      expect(projects).toEqual(mockProjects)
    })

    it('should support legacyGetCurrentProject', async () => {
      mockSupabase.single.mockResolvedValue({ data: [], error: null })

      const project = await ProjectService.legacyGetCurrentProject()

      expect(project).toBeNull()
    })

    it('should support legacyGetProjectById', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: null })

      const project = await ProjectService.legacyGetProjectById('proj-1')

      expect(project).toBeNull()
    })

    it('should return empty array on error in legacy methods', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Error' } })

      const projects = await ProjectService.legacyGetAllProjects()

      expect(projects).toEqual([])
    })
  })

  describe('serviceResultToApiResponse', () => {
    it('should convert success result to API response', () => {
      const serviceResult = {
        success: true as const,
        data: { id: 'proj-1', name: 'Test Project' }
      }

      const apiResponse = ProjectService.serviceResultToApiResponse(serviceResult)

      expect(apiResponse.success).toBe(true)
      expect(apiResponse.data).toEqual(serviceResult.data)
      expect(apiResponse.timestamp).toBeDefined()
    })

    it('should convert error result to API response', () => {
      const serviceResult = {
        success: false as const,
        error: {
          code: 'NOT_FOUND' as const,
          message: 'Project not found',
          operation: 'getProject',
          retryable: false,
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      }

      const apiResponse = ProjectService.serviceResultToApiResponse(serviceResult)

      expect(apiResponse.success).toBe(false)
      expect(apiResponse.error?.message).toBe('Project not found')
      expect(apiResponse.error?.code).toBe('NOT_FOUND')
    })

    it('should include meta with total for array data', () => {
      const serviceResult = {
        success: true as const,
        data: [{ id: '1' }, { id: '2' }, { id: '3' }]
      }

      const apiResponse = ProjectService.serviceResultToApiResponse(serviceResult)

      expect(apiResponse.meta?.total).toBe(3)
    })
  })
})
