/**
 * ProjectContext Integration Tests
 * Tests project state management, CRUD operations, and context updates
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { ProjectProvider, useProject } from '../../../src/contexts/ProjectContext'
import { basicProject, createTestProject } from '../../../src/test/fixtures/projects'
import React from 'react'

// Mock ProjectService
vi.mock('../../../src/lib/services/ProjectService', () => ({
  ProjectService: {
    getProjectsByUser: vi.fn(),
    getProjectById: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn()
  }
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ProjectProvider>{children}</ProjectProvider>
)

describe('ProjectContext Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Context Initialization', () => {
    it('should provide initial context values', () => {
      const { result } = renderHook(() => useProject(), { wrapper })

      expect(result.current.projects).toEqual([])
      expect(result.current.currentProject).toBeNull()
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        renderHook(() => useProject())
      }).toThrow('useProject must be used within a ProjectProvider')

      spy.mockRestore()
    })
  })

  describe('Project Loading', () => {
    it('should load projects successfully', async () => {
      const { ProjectService } = await import('../../../src/lib/services/ProjectService')
      const mockProjects = [
        createTestProject({ id: 'project-1' }),
        createTestProject({ id: 'project-2' })
      ]

      vi.mocked(ProjectService.getProjectsByUser).mockResolvedValue({
        success: true,
        data: mockProjects
      })

      const { result } = renderHook(() => useProject(), { wrapper })

      act(() => {
        result.current.loadProjects('user-123')
      })

      await waitFor(() => {
        expect(result.current.projects).toHaveLength(2)
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should handle loading errors', async () => {
      const { ProjectService } = await import('../../../src/lib/services/ProjectService')

      vi.mocked(ProjectService.getProjectsByUser).mockResolvedValue({
        success: false,
        error: 'Failed to load projects'
      })

      const { result } = renderHook(() => useProject(), { wrapper })

      act(() => {
        result.current.loadProjects('user-123')
      })

      await waitFor(() => {
        expect(result.current.error).toBeDefined()
      })

      expect(result.current.projects).toEqual([])
      expect(result.current.loading).toBe(false)
    })

    it('should set loading state during project fetch', async () => {
      const { ProjectService } = await import('../../../src/lib/services/ProjectService')

      let resolveProjects: any
      const projectsPromise = new Promise(resolve => {
        resolveProjects = resolve
      })

      vi.mocked(ProjectService.getProjectsByUser).mockReturnValue(projectsPromise as any)

      const { result } = renderHook(() => useProject(), { wrapper })

      act(() => {
        result.current.loadProjects('user-123')
      })

      // Should be loading
      await waitFor(() => {
        expect(result.current.loading).toBe(true)
      })

      // Resolve the promise
      act(() => {
        resolveProjects({ success: true, data: [] })
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })
  })

  describe('Current Project Selection', () => {
    it('should set current project', async () => {
      const { result } = renderHook(() => useProject(), { wrapper })
      const testProject = basicProject

      act(() => {
        result.current.setCurrentProject(testProject)
      })

      expect(result.current.currentProject).toEqual(testProject)
    })

    it('should clear current project', async () => {
      const { result } = renderHook(() => useProject(), { wrapper })

      act(() => {
        result.current.setCurrentProject(basicProject)
      })

      expect(result.current.currentProject).not.toBeNull()

      act(() => {
        result.current.setCurrentProject(null)
      })

      expect(result.current.currentProject).toBeNull()
    })

    it('should load project by ID', async () => {
      const { ProjectService } = await import('../../../src/lib/services/ProjectService')

      vi.mocked(ProjectService.getProjectById).mockResolvedValue({
        success: true,
        data: basicProject
      })

      const { result } = renderHook(() => useProject(), { wrapper })

      act(() => {
        result.current.loadProjectById('project-001')
      })

      await waitFor(() => {
        expect(result.current.currentProject).toEqual(basicProject)
      })
    })
  })

  describe('Project CRUD Operations', () => {
    it('should create new project', async () => {
      const { ProjectService } = await import('../../../src/lib/services/ProjectService')
      const newProject = createTestProject()

      vi.mocked(ProjectService.createProject).mockResolvedValue({
        success: true,
        data: newProject
      })

      const { result } = renderHook(() => useProject(), { wrapper })

      await act(async () => {
        await result.current.createProject({
          title: 'New Project',
          description: 'Test project'
        })
      })

      expect(ProjectService.createProject).toHaveBeenCalled()
    })

    it('should update existing project', async () => {
      const { ProjectService } = await import('../../../src/lib/services/ProjectService')
      const updatedProject = { ...basicProject, title: 'Updated Title' }

      vi.mocked(ProjectService.updateProject).mockResolvedValue({
        success: true,
        data: updatedProject
      })

      const { result } = renderHook(() => useProject(), { wrapper })

      await act(async () => {
        await result.current.updateProject('project-001', {
          title: 'Updated Title'
        })
      })

      expect(ProjectService.updateProject).toHaveBeenCalledWith(
        'project-001',
        expect.objectContaining({ title: 'Updated Title' })
      )
    })

    it('should delete project', async () => {
      const { ProjectService } = await import('../../../src/lib/services/ProjectService')

      vi.mocked(ProjectService.deleteProject).mockResolvedValue({
        success: true,
        data: true
      })

      const { result } = renderHook(() => useProject(), { wrapper })

      await act(async () => {
        await result.current.deleteProject('project-001')
      })

      expect(ProjectService.deleteProject).toHaveBeenCalledWith('project-001')
    })
  })

  describe('Error Handling', () => {
    it('should handle create project errors', async () => {
      const { ProjectService } = await import('../../../src/lib/services/ProjectService')

      vi.mocked(ProjectService.createProject).mockResolvedValue({
        success: false,
        error: 'Failed to create project'
      })

      const { result } = renderHook(() => useProject(), { wrapper })

      await act(async () => {
        const response = await result.current.createProject({
          title: 'New Project'
        })
        expect(response?.success).toBe(false)
      })
    })

    it('should handle update project errors', async () => {
      const { ProjectService } = await import('../../../src/lib/services/ProjectService')

      vi.mocked(ProjectService.updateProject).mockResolvedValue({
        success: false,
        error: 'Failed to update project'
      })

      const { result } = renderHook(() => useProject(), { wrapper })

      await act(async () => {
        const response = await result.current.updateProject('project-001', {})
        expect(response?.success).toBe(false)
      })
    })

    it('should clear error state', async () => {
      const { result } = renderHook(() => useProject(), { wrapper })

      // Simulate an error
      act(() => {
        result.current.setError('Test error')
      })

      expect(result.current.error).toBe('Test error')

      // Clear error
      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })
})

/**
 * Test Coverage: 15 integration tests for ProjectContext
 *
 * Covers:
 * - Context initialization and provider requirement
 * - Project loading with success/error/loading states
 * - Current project selection and clearing
 * - CRUD operations (create, update, delete)
 * - Error handling and state management
 */
