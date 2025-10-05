/**
 * CollaborationService Test Suite
 *
 * Comprehensive tests for CollaborationService functionality including:
 * - Collaborator management (add, remove, update)
 * - Role assignment and permissions
 * - Real-time subscriptions
 * - Email invitations
 * - User access validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CollaborationService } from '../CollaborationService'
import type { ProjectRole, ProjectCollaborator } from '../../../types'
import type { AddCollaboratorInput, CollaboratorWithUser } from '../CollaborationService'

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
  in: vi.fn(() => mockSupabase),
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

// Mock EmailService
const mockEmailService = {
  sendCollaborationInvitation: vi.fn().mockResolvedValue(true),
  generateInvitationUrl: vi.fn((projectId: string) => `https://app.example.com/projects/${projectId}`)
}

vi.mock('../../emailService', () => ({
  EmailService: mockEmailService
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    clear: () => { store = {} }
  }
})()

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock
})

describe('CollaborationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    localStorageMock.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    CollaborationService.cleanup()
  })

  describe('addProjectCollaborator', () => {
    it('should add collaborator with valid input', async () => {
      const input: AddCollaboratorInput = {
        projectId: 'proj-1',
        userEmail: 'test@example.com',
        role: 'editor',
        invitedBy: 'user-1',
        projectName: 'Test Project',
        inviterName: 'John Doe',
        inviterEmail: 'john@example.com'
      }

      mockSupabase.single
        .mockResolvedValueOnce({ data: [], error: null }) // Check existing
        .mockResolvedValueOnce({ error: null }) // Insert

      const result = await CollaborationService.addProjectCollaborator(input)

      expect(result.success).toBe(true)
      expect(mockSupabase.insert).toHaveBeenCalled()
      expect(mockEmailService.sendCollaborationInvitation).toHaveBeenCalled()
    })

    it('should validate required fields', async () => {
      const input: AddCollaboratorInput = {
        projectId: '',
        userEmail: 'test@example.com',
        invitedBy: 'user-1'
      }

      const result = await CollaborationService.addProjectCollaborator(input)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    it('should validate email format', async () => {
      const input: AddCollaboratorInput = {
        projectId: 'proj-1',
        userEmail: 'invalid-email',
        invitedBy: 'user-1'
      }

      const result = await CollaborationService.addProjectCollaborator(input)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
      expect(result.error?.message).toContain('Invalid userEmail')
    })

    it('should validate role enum', async () => {
      const input: any = {
        projectId: 'proj-1',
        userEmail: 'test@example.com',
        role: 'invalid-role',
        invitedBy: 'user-1'
      }

      const result = await CollaborationService.addProjectCollaborator(input)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    it('should default role to viewer if not specified', async () => {
      const input: AddCollaboratorInput = {
        projectId: 'proj-1',
        userEmail: 'test@example.com',
        invitedBy: 'user-1'
      }

      mockSupabase.single.mockResolvedValueOnce({ data: [], error: null })
      mockSupabase.insert.mockResolvedValue({ error: null })

      await CollaborationService.addProjectCollaborator(input)

      expect(mockSupabase.insert).toHaveBeenCalledWith([
        expect.objectContaining({ role: 'viewer' })
      ])
    })

    it('should prevent duplicate collaborators', async () => {
      const input: AddCollaboratorInput = {
        projectId: 'proj-1',
        userEmail: 'test@example.com',
        invitedBy: 'user-1'
      }

      // Set up existing collaboration
      localStorageMock.setItem('collaboratorEmailMappings', JSON.stringify({
        'mockUserId123': 'test@example.com'
      }))

      mockSupabase.single.mockResolvedValueOnce({
        data: [{ id: '1', user_id: 'mockUserId123' }],
        error: null
      })

      const result = await CollaborationService.addProjectCollaborator(input)

      expect(result.success).toBe(false)
    })

    it('should store email mapping in localStorage', async () => {
      const input: AddCollaboratorInput = {
        projectId: 'proj-1',
        userEmail: 'test@example.com',
        invitedBy: 'user-1'
      }

      mockSupabase.single.mockResolvedValueOnce({ data: [], error: null })
      mockSupabase.insert.mockResolvedValue({ error: null })

      await CollaborationService.addProjectCollaborator(input)

      const mappings = JSON.parse(localStorageMock.getItem('collaboratorEmailMappings') || '{}')
      expect(Object.values(mappings)).toContain('test@example.com')
    })

    it('should send invitation email', async () => {
      const input: AddCollaboratorInput = {
        projectId: 'proj-1',
        userEmail: 'test@example.com',
        role: 'editor',
        invitedBy: 'user-1',
        projectName: 'Test Project',
        inviterName: 'John Doe',
        inviterEmail: 'john@example.com'
      }

      mockSupabase.single.mockResolvedValueOnce({ data: [], error: null })
      mockSupabase.insert.mockResolvedValue({ error: null })

      await CollaborationService.addProjectCollaborator(input)

      expect(mockEmailService.sendCollaborationInvitation).toHaveBeenCalledWith({
        inviterName: 'John Doe',
        inviterEmail: 'john@example.com',
        inviteeEmail: 'test@example.com',
        projectName: 'Test Project',
        role: 'editor',
        invitationUrl: expect.stringContaining('proj-1')
      })
    })

    it('should succeed even if email fails', async () => {
      const input: AddCollaboratorInput = {
        projectId: 'proj-1',
        userEmail: 'test@example.com',
        invitedBy: 'user-1'
      }

      mockSupabase.single.mockResolvedValueOnce({ data: [], error: null })
      mockSupabase.insert.mockResolvedValue({ error: null })
      mockEmailService.sendCollaborationInvitation.mockRejectedValue(new Error('Email error'))

      const result = await CollaborationService.addProjectCollaborator(input)

      expect(result.success).toBe(true)
    })
  })

  describe('getProjectCollaborators', () => {
    it('should fetch collaborators for project', async () => {
      const mockCollaborators: ProjectCollaborator[] = [
        {
          id: '1',
          project_id: 'proj-1',
          user_id: 'user-1',
          role: 'editor',
          status: 'active',
          invited_by: 'owner-1',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        }
      ]

      localStorageMock.setItem('collaboratorEmailMappings', JSON.stringify({
        'user-1': 'test@example.com'
      }))

      mockSupabase.single.mockResolvedValue({ data: mockCollaborators, error: null })

      const result = await CollaborationService.getProjectCollaborators('proj-1')

      expect(result.success).toBe(true)
      expect(result.data?.length).toBe(1)
      expect(result.data?.[0].user.email).toBe('test@example.com')
    })

    it('should validate project ID', async () => {
      const result = await CollaborationService.getProjectCollaborators('')

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    it('should return empty array when no collaborators exist', async () => {
      mockSupabase.single.mockResolvedValue({ data: [], error: null })

      const result = await CollaborationService.getProjectCollaborators('proj-1')

      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
    })

    it('should filter by active and pending status', async () => {
      mockSupabase.single.mockResolvedValue({ data: [], error: null })

      await CollaborationService.getProjectCollaborators('proj-1')

      expect(mockSupabase.in).toHaveBeenCalledWith('status', ['active', 'pending'])
    })

    it('should create user data from email mappings', async () => {
      const mockCollaborators: ProjectCollaborator[] = [
        {
          id: '1',
          project_id: 'proj-1',
          user_id: 'user-123',
          role: 'editor',
          status: 'active',
          invited_by: 'owner-1',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        }
      ]

      localStorageMock.setItem('collaboratorEmailMappings', JSON.stringify({
        'user-123': 'alice@example.com'
      }))

      mockSupabase.single.mockResolvedValue({ data: mockCollaborators, error: null })

      const result = await CollaborationService.getProjectCollaborators('proj-1')

      expect(result.success).toBe(true)
      expect(result.data?.[0].user).toMatchObject({
        id: 'user-123',
        email: 'alice@example.com'
      })
    })

    it('should generate fallback email for unmapped users', async () => {
      const mockCollaborators: ProjectCollaborator[] = [
        {
          id: '1',
          project_id: 'proj-1',
          user_id: 'unmapped-user',
          role: 'viewer',
          status: 'active',
          invited_by: 'owner-1',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        }
      ]

      mockSupabase.single.mockResolvedValue({ data: mockCollaborators, error: null })

      const result = await CollaborationService.getProjectCollaborators('proj-1')

      expect(result.success).toBe(true)
      expect(result.data?.[0].user.email).toContain('@example.com')
    })
  })

  describe('removeProjectCollaborator', () => {
    it('should remove collaborator successfully', async () => {
      mockSupabase.delete.mockResolvedValue({ error: null })

      const result = await CollaborationService.removeProjectCollaborator('proj-1', 'user-1')

      expect(result.success).toBe(true)
      expect(mockSupabase.delete).toHaveBeenCalled()
      expect(mockSupabase.eq).toHaveBeenCalledWith('project_id', 'proj-1')
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user-1')
    })

    it('should validate project ID', async () => {
      const result = await CollaborationService.removeProjectCollaborator('', 'user-1')

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    it('should validate user ID', async () => {
      const result = await CollaborationService.removeProjectCollaborator('proj-1', '')

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    it('should check permissions before removal', async () => {
      mockSupabase.delete.mockResolvedValue({
        error: { message: 'Insufficient permissions' }
      })

      const result = await CollaborationService.removeProjectCollaborator('proj-1', 'user-1', { userId: 'other-user' })

      expect(result.success).toBe(false)
    })
  })

  describe('updateCollaboratorRole', () => {
    it('should update collaborator role', async () => {
      mockSupabase.update.mockResolvedValue({ error: null })

      const result = await CollaborationService.updateCollaboratorRole('proj-1', 'user-1', 'editor')

      expect(result.success).toBe(true)
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'editor' })
      )
    })

    it('should validate project ID', async () => {
      const result = await CollaborationService.updateCollaboratorRole('', 'user-1', 'editor')

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    it('should validate user ID', async () => {
      const result = await CollaborationService.updateCollaboratorRole('proj-1', '', 'editor')

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    it('should validate role enum', async () => {
      const result = await CollaborationService.updateCollaboratorRole('proj-1', 'user-1', 'invalid-role' as ProjectRole)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    it('should update timestamp on role change', async () => {
      mockSupabase.update.mockResolvedValue({ error: null })

      await CollaborationService.updateCollaboratorRole('proj-1', 'user-1', 'editor')

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ updated_at: expect.any(String) })
      )
    })

    it('should check permissions before update', async () => {
      mockSupabase.update.mockResolvedValue({
        error: { message: 'Insufficient permissions' }
      })

      const result = await CollaborationService.updateCollaboratorRole('proj-1', 'user-1', 'editor', { userId: 'other-user' })

      expect(result.success).toBe(false)
    })
  })

  describe('getUserProjectRole', () => {
    it('should return owner role for project owner', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({ data: { owner_id: 'user-1' }, error: null })

      const result = await CollaborationService.getUserProjectRole('proj-1', 'user-1')

      expect(result.success).toBe(true)
      expect(result.data).toBe('owner')
    })

    it('should return collaborator role', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({ data: { owner_id: 'other-user' }, error: null })
        .mockResolvedValueOnce({ data: { role: 'editor' }, error: null })

      const result = await CollaborationService.getUserProjectRole('proj-1', 'user-1')

      expect(result.success).toBe(true)
      expect(result.data).toBe('editor')
    })

    it('should return null for non-collaborator', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({ data: { owner_id: 'other-user' }, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Not found' } })

      const result = await CollaborationService.getUserProjectRole('proj-1', 'user-1')

      expect(result.success).toBe(true)
      expect(result.data).toBeNull()
    })

    it('should validate project ID', async () => {
      const result = await CollaborationService.getUserProjectRole('', 'user-1')

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    it('should validate user ID', async () => {
      const result = await CollaborationService.getUserProjectRole('proj-1', '')

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    it('should filter by active status', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({ data: { owner_id: 'other-user' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null })

      await CollaborationService.getUserProjectRole('proj-1', 'user-1')

      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'active')
    })
  })

  describe('canUserAccessProject', () => {
    it('should return true for users with access', async () => {
      mockSupabase.single.mockResolvedValue({ data: { owner_id: 'user-1' }, error: null })

      const result = await CollaborationService.canUserAccessProject('proj-1', 'user-1')

      expect(result.success).toBe(true)
      expect(result.data).toBe(true)
    })

    it('should return false for users without access', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({ data: { owner_id: 'other-user' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null })

      const result = await CollaborationService.canUserAccessProject('proj-1', 'user-1')

      expect(result.success).toBe(true)
      expect(result.data).toBe(false)
    })
  })

  describe('Real-time Subscriptions', () => {
    it('should create subscription for collaborator changes', () => {
      const callback = vi.fn()

      const unsubscribe = CollaborationService.subscribeToProjectCollaborators('proj-1', callback)

      expect(mockSupabase.channel).toHaveBeenCalled()
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: '*',
          schema: 'public',
          table: 'project_collaborators',
          filter: 'project_id=eq.proj-1'
        }),
        expect.any(Function)
      )
      expect(mockChannel.subscribe).toHaveBeenCalled()
      expect(typeof unsubscribe).toBe('function')
    })

    it('should call callback on collaborator changes', async () => {
      const callback = vi.fn()
      const mockCollaborators: CollaboratorWithUser[] = [
        {
          id: '1',
          project_id: 'proj-1',
          user_id: 'user-1',
          role: 'editor',
          status: 'active',
          invited_by: 'owner-1',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          user: {
            id: 'user-1',
            email: 'test@example.com',
            created_at: '2024-01-01',
            updated_at: '2024-01-01',
            raw_user_meta_data: { full_name: 'Test User' }
          }
        }
      ]

      let changeHandler: Function = () => {}
      mockChannel.on.mockImplementation((event, config, handler) => {
        changeHandler = handler
        return mockChannel
      })

      mockSupabase.single.mockResolvedValue({ data: mockCollaborators, error: null })

      CollaborationService.subscribeToProjectCollaborators('proj-1', callback)

      await changeHandler({ eventType: 'INSERT' })

      expect(callback).toHaveBeenCalled()
    })

    it('should unsubscribe correctly', () => {
      const callback = vi.fn()

      const unsubscribe = CollaborationService.subscribeToProjectCollaborators('proj-1', callback)
      unsubscribe()

      expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel)
    })

    it('should include user ID in channel name when provided', () => {
      const callback = vi.fn()

      CollaborationService.subscribeToProjectCollaborators('proj-1', callback, { userId: 'user-123' })

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

      CollaborationService.subscribeToProjectCollaborators('proj-1', callback)

      await changeHandler({ eventType: 'UPDATE' })

      expect(callback).toHaveBeenCalledWith([])
    })
  })

  describe('Legacy Methods', () => {
    it('should support legacyAddProjectCollaborator', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: [], error: null })
      mockSupabase.insert.mockResolvedValue({ error: null })

      const success = await CollaborationService.legacyAddProjectCollaborator(
        'proj-1',
        'test@example.com',
        'editor',
        'user-1'
      )

      expect(success).toBe(true)
    })

    it('should support legacyGetProjectCollaborators', async () => {
      mockSupabase.single.mockResolvedValue({ data: [], error: null })

      const collaborators = await CollaborationService.legacyGetProjectCollaborators('proj-1')

      expect(collaborators).toEqual([])
    })

    it('should support legacyRemoveProjectCollaborator', async () => {
      mockSupabase.delete.mockResolvedValue({ error: null })

      const success = await CollaborationService.legacyRemoveProjectCollaborator('proj-1', 'user-1')

      expect(success).toBe(true)
    })

    it('should support legacyUpdateCollaboratorRole', async () => {
      mockSupabase.update.mockResolvedValue({ error: null })

      const success = await CollaborationService.legacyUpdateCollaboratorRole('proj-1', 'user-1', 'editor')

      expect(success).toBe(true)
    })

    it('should return false on error in legacy methods', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Error' } })

      const success = await CollaborationService.legacyAddProjectCollaborator(
        'proj-1',
        'test@example.com',
        'editor',
        'user-1'
      )

      expect(success).toBe(false)
    })
  })

  describe('serviceResultToApiResponse', () => {
    it('should convert success result to API response', () => {
      const serviceResult = {
        success: true as const,
        data: { id: '1', role: 'editor' }
      }

      const apiResponse = CollaborationService.serviceResultToApiResponse(serviceResult)

      expect(apiResponse.success).toBe(true)
      expect(apiResponse.data).toEqual(serviceResult.data)
      expect(apiResponse.timestamp).toBeDefined()
    })

    it('should convert error result to API response', () => {
      const serviceResult = {
        success: false as const,
        error: {
          code: 'PERMISSION_DENIED' as const,
          message: 'Insufficient permissions',
          operation: 'addCollaborator',
          retryable: false,
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      }

      const apiResponse = CollaborationService.serviceResultToApiResponse(serviceResult)

      expect(apiResponse.success).toBe(false)
      expect(apiResponse.error?.message).toBe('Insufficient permissions')
      expect(apiResponse.error?.code).toBe('PERMISSION_DENIED')
    })

    it('should include meta with total for array data', () => {
      const serviceResult = {
        success: true as const,
        data: [{ id: '1' }, { id: '2' }]
      }

      const apiResponse = CollaborationService.serviceResultToApiResponse(serviceResult)

      expect(apiResponse.meta?.total).toBe(2)
    })
  })
})
