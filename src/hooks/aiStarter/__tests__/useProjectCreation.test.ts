import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useProjectCreation } from '../useProjectCreation'
import { DatabaseService } from '../../../lib/database'

// Mock dependencies
vi.mock('../../../lib/database', () => ({
  DatabaseService: {
    createProject: vi.fn(),
    createIdea: vi.fn()
  }
}))

vi.mock('../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn()
  }
}))

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User'
}

const mockProject = {
  id: 'project-1',
  name: 'Test Project',
  description: 'Test project description',
  project_type: 'software',
  status: 'active',
  priority_level: 'medium',
  visibility: 'private',
  owner_id: 'user-1',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}

const mockAnalysis = {
  needsClarification: false,
  clarifyingQuestions: [],
  projectAnalysis: {
    industry: 'Technology',
    scope: 'Standard',
    timeline: 'Medium-term',
    primaryGoals: ['Development'],
    recommendedProjectType: 'software',
    projectTypeReasoning: 'Technical project'
  },
  generatedIdeas: [
    {
      content: 'User authentication system',
      details: 'Implement secure login',
      x: 150,
      y: 200,
      priority: 'high' as const,
      reasoning: 'Critical for security'
    },
    {
      content: 'Dashboard analytics',
      details: 'Create user activity dashboard',
      x: 300,
      y: 400,
      priority: 'medium' as const,
      reasoning: 'Valuable for insights'
    }
  ]
}

const mockCreatedIdea = {
  success: true,
  data: {
    id: 'idea-1',
    content: 'User authentication system',
    details: 'Implement secure login',
    x: 150,
    y: 200,
    priority: 'high',
    created_by: 'user-1',
    is_collapsed: true,
    project_id: 'project-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

describe('useProjectCreation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(DatabaseService.createProject).mockResolvedValue(mockProject)
    vi.mocked(DatabaseService.createIdea).mockResolvedValue(mockCreatedIdea)
  })

  describe('createProject', () => {
    it('should create project with correct data', async () => {
      const { result } = renderHook(() => useProjectCreation())

      const projectData = {
        name: 'Test Project',
        description: 'Test description',
        projectType: 'software' as const,
        analysis: mockAnalysis
      }

      await act(async () => {
        const project = await result.current.createProject(projectData, mockUser)
        expect(project).toEqual(mockProject)
      })

      expect(DatabaseService.createProject).toHaveBeenCalledWith({
        name: 'Test Project',
        description: 'Test description',
        project_type: 'software',
        status: 'active',
        priority_level: 'medium',
        visibility: 'private',
        owner_id: 'user-1',
        ai_analysis: mockAnalysis.projectAnalysis
      })
    })

    it('should throw error when project creation fails', async () => {
      const { result } = renderHook(() => useProjectCreation())
      vi.mocked(DatabaseService.createProject).mockResolvedValue(null)

      const projectData = {
        name: 'Test Project',
        description: 'Test description',
        projectType: 'software' as const,
        analysis: mockAnalysis
      }

      await act(async () => {
        await expect(result.current.createProject(projectData, mockUser))
          .rejects.toThrow('Failed to create project')
      })
    })

    it('should handle database service errors', async () => {
      const { result } = renderHook(() => useProjectCreation())
      vi.mocked(DatabaseService.createProject).mockRejectedValue(new Error('Database error'))

      const projectData = {
        name: 'Test Project',
        description: 'Test description',
        projectType: 'software' as const,
        analysis: mockAnalysis
      }

      await act(async () => {
        await expect(result.current.createProject(projectData, mockUser))
          .rejects.toThrow('Database error')
      })
    })
  })

  describe('createIdeas', () => {
    it('should create all ideas successfully', async () => {
      const { result } = renderHook(() => useProjectCreation())

      await act(async () => {
        const ideas = await result.current.createIdeas(
          mockAnalysis.generatedIdeas,
          'project-1',
          mockUser
        )

        expect(ideas).toHaveLength(2)
        expect(ideas[0]).toEqual(mockCreatedIdea.data)
      })

      expect(DatabaseService.createIdea).toHaveBeenCalledTimes(2)
      expect(DatabaseService.createIdea).toHaveBeenCalledWith({
        content: 'User authentication system',
        details: 'Implement secure login',
        x: 150,
        y: 200,
        priority: 'high',
        created_by: 'user-1',
        is_collapsed: true,
        project_id: 'project-1'
      })
    })

    it('should handle failed idea creation gracefully', async () => {
      const { result } = renderHook(() => useProjectCreation())

      // Mock one success and one failure
      vi.mocked(DatabaseService.createIdea)
        .mockResolvedValueOnce(mockCreatedIdea)
        .mockResolvedValueOnce({ success: false, error: 'Creation failed' })

      await act(async () => {
        const ideas = await result.current.createIdeas(
          mockAnalysis.generatedIdeas,
          'project-1',
          mockUser
        )

        expect(ideas).toHaveLength(1) // Only successful one
        expect(ideas[0]).toEqual(mockCreatedIdea.data)
      })
    })

    it('should throw error when no ideas are created', async () => {
      const { result } = renderHook(() => useProjectCreation())
      vi.mocked(DatabaseService.createIdea).mockResolvedValue({ success: false, error: 'Failed' })

      await act(async () => {
        await expect(result.current.createIdeas(
          mockAnalysis.generatedIdeas,
          'project-1',
          mockUser
        )).rejects.toThrow('Failed to create any ideas')
      })
    })

    it('should handle empty ideas array', async () => {
      const { result } = renderHook(() => useProjectCreation())

      await act(async () => {
        const ideas = await result.current.createIdeas([], 'project-1', mockUser)
        expect(ideas).toHaveLength(0)
      })

      expect(DatabaseService.createIdea).not.toHaveBeenCalled()
    })

    it('should round coordinates correctly', async () => {
      const { result } = renderHook(() => useProjectCreation())

      const ideasWithFloats = [
        {
          content: 'Test idea',
          details: 'Test details',
          x: 150.7,
          y: 200.3,
          priority: 'high' as const,
          reasoning: 'Test'
        }
      ]

      await act(async () => {
        await result.current.createIdeas(ideasWithFloats, 'project-1', mockUser)
      })

      expect(DatabaseService.createIdea).toHaveBeenCalledWith({
        content: 'Test idea',
        details: 'Test details',
        x: 151, // Rounded
        y: 200, // Rounded
        priority: 'high',
        created_by: 'user-1',
        is_collapsed: true,
        project_id: 'project-1'
      })
    })

    it('should handle idea creation exceptions', async () => {
      const { result } = renderHook(() => useProjectCreation())
      vi.mocked(DatabaseService.createIdea)
        .mockResolvedValueOnce(mockCreatedIdea)
        .mockRejectedValueOnce(new Error('Network error'))

      await act(async () => {
        const ideas = await result.current.createIdeas(
          mockAnalysis.generatedIdeas,
          'project-1',
          mockUser
        )

        expect(ideas).toHaveLength(1) // Only successful one
      })
    })
  })

  describe('createProjectAndIdeas', () => {
    it('should create project and ideas successfully', async () => {
      const { result } = renderHook(() => useProjectCreation())
      const onSuccess = vi.fn()

      const projectData = {
        name: 'Test Project',
        description: 'Test description',
        projectType: 'software' as const,
        analysis: mockAnalysis
      }

      await act(async () => {
        await result.current.createProjectAndIdeas(projectData, mockUser, onSuccess)
      })

      expect(DatabaseService.createProject).toHaveBeenCalledOnce()
      expect(DatabaseService.createIdea).toHaveBeenCalledTimes(2)
      expect(onSuccess).toHaveBeenCalledWith(mockProject, [mockCreatedIdea.data, mockCreatedIdea.data])
    })

    it('should handle project creation failure', async () => {
      const { result } = renderHook(() => useProjectCreation())
      const onSuccess = vi.fn()
      vi.mocked(DatabaseService.createProject).mockRejectedValue(new Error('Project creation failed'))

      const projectData = {
        name: 'Test Project',
        description: 'Test description',
        projectType: 'software' as const,
        analysis: mockAnalysis
      }

      await act(async () => {
        await expect(result.current.createProjectAndIdeas(projectData, mockUser, onSuccess))
          .rejects.toThrow('Project creation failed')
      })

      expect(onSuccess).not.toHaveBeenCalled()
      expect(DatabaseService.createIdea).not.toHaveBeenCalled()
    })

    it('should handle idea creation failure', async () => {
      const { result } = renderHook(() => useProjectCreation())
      const onSuccess = vi.fn()
      vi.mocked(DatabaseService.createIdea).mockResolvedValue({ success: false, error: 'Idea creation failed' })

      const projectData = {
        name: 'Test Project',
        description: 'Test description',
        projectType: 'software' as const,
        analysis: mockAnalysis
      }

      await act(async () => {
        await expect(result.current.createProjectAndIdeas(projectData, mockUser, onSuccess))
          .rejects.toThrow('Failed to create any ideas')
      })

      expect(DatabaseService.createProject).toHaveBeenCalledOnce()
      expect(onSuccess).not.toHaveBeenCalled()
    })

    it('should call onSuccess with correct parameters', async () => {
      const { result } = renderHook(() => useProjectCreation())
      const onSuccess = vi.fn()

      const projectData = {
        name: 'Test Project',
        description: 'Test description',
        projectType: 'marketing' as const,
        analysis: {
          ...mockAnalysis,
          generatedIdeas: [mockAnalysis.generatedIdeas[0]] // Only one idea
        }
      }

      await act(async () => {
        await result.current.createProjectAndIdeas(projectData, mockUser, onSuccess)
      })

      expect(onSuccess).toHaveBeenCalledWith(mockProject, [mockCreatedIdea.data])
    })

    it('should handle mixed success/failure in idea creation', async () => {
      const { result } = renderHook(() => useProjectCreation())
      const onSuccess = vi.fn()

      // Mock one success and one failure
      vi.mocked(DatabaseService.createIdea)
        .mockResolvedValueOnce(mockCreatedIdea)
        .mockResolvedValueOnce({ success: false, error: 'Second idea failed' })

      const projectData = {
        name: 'Test Project',
        description: 'Test description',
        projectType: 'software' as const,
        analysis: mockAnalysis
      }

      await act(async () => {
        await result.current.createProjectAndIdeas(projectData, mockUser, onSuccess)
      })

      expect(onSuccess).toHaveBeenCalledWith(mockProject, [mockCreatedIdea.data])
    })
  })
})