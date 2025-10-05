import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { mockProject, mockUser } from '../../test/utils/test-utils'
import { ProjectFile } from '../../types'
import { generateDemoUUID } from '../../utils/uuid'

// Mock FileService
vi.mock('../../lib/fileService', () => ({
  FileService: {
    getProjectFiles: vi.fn(),
    uploadFile: vi.fn(),
    deleteFile: vi.fn(),
    getFileUrl: vi.fn()
  }
}))

// Mock Supabase with real-time subscription support
vi.mock('../../lib/supabase', () => ({
  supabase: {
    channel: vi.fn(),
    from: vi.fn()
  }
}))

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

// Import mocked modules
import { FileService } from '../../lib/fileService'
import { supabase } from '../../lib/supabase'
import { useProjectFiles } from '../useProjectFiles'

// Mock file data
const mockFile: ProjectFile = {
  id: generateDemoUUID('101'),
  project_id: mockProject.id,
  name: 'test-file.pdf',
  original_name: 'test-file.pdf',
  file_type: 'pdf',
  file_size: 1024000,
  mime_type: 'application/pdf',
  storage_path: 'projects/project-1/files/uuid-test-file.pdf',
  content_preview: 'Test file content',
  uploaded_by: mockUser.id,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  analysis_status: 'pending'
}

const mockFiles: ProjectFile[] = [
  mockFile,
  {
    ...mockFile,
    id: generateDemoUUID('102'),
    name: 'second-file.docx',
    file_type: 'docx',
    analysis_status: 'completed'
  },
  {
    ...mockFile,
    id: generateDemoUUID('103'),
    name: 'third-file.txt',
    file_type: 'txt',
    analysis_status: 'failed'
  }
]

// Create mock channel
const createMockChannel = () => ({
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn(function(this: any, callback: Function) {
    callback('SUBSCRIBED')
    return this
  }),
  send: vi.fn(),
  unsubscribe: vi.fn()
})

describe('useProjectFiles', () => {
  let mockChannel: ReturnType<typeof createMockChannel>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Create new mock channel for each test
    mockChannel = createMockChannel()

    // Reset mock implementations
    vi.mocked(FileService.getProjectFiles).mockResolvedValue(mockFiles)
    vi.mocked(FileService.deleteFile).mockResolvedValue({ success: true })
    vi.mocked(supabase.channel).mockReturnValue(mockChannel as any)
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(() => Promise.resolve({ data: mockFile, error: null }))
    } as any)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should start with empty state when no project provided', () => {
      const { result } = renderHook(() => useProjectFiles(null))

      expect(result.current.projectFiles).toEqual({})
      expect(result.current.getCurrentProjectFiles()).toEqual([])
      expect(result.current.isLoading).toBe(false)
    })

    it('should load files when project is provided', async () => {
      const { result } = renderHook(() => useProjectFiles(mockProject))

      await waitFor(() => {
        expect(FileService.getProjectFiles).toHaveBeenCalledWith(mockProject.id)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.projectFiles[mockProject.id]).toEqual(mockFiles)
    })

    it('should set loading state while fetching files', async () => {
      let resolveFiles: (value: ProjectFile[]) => void
      vi.mocked(FileService.getProjectFiles).mockReturnValue(
        new Promise((resolve) => {
          resolveFiles = resolve
        })
      )

      const { result } = renderHook(() => useProjectFiles(mockProject))

      expect(result.current.isLoading).toBe(true)

      await act(async () => {
        resolveFiles!(mockFiles)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('should handle file loading errors gracefully', async () => {
      vi.mocked(FileService.getProjectFiles).mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useProjectFiles(mockProject))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.projectFiles[mockProject.id]).toBeUndefined()
    })

    it('should reload files when project changes', async () => {
      const { rerender } = renderHook(
        ({ project }) => useProjectFiles(project),
        { initialProps: { project: mockProject } }
      )

      await waitFor(() => {
        expect(FileService.getProjectFiles).toHaveBeenCalledWith(mockProject.id)
      })

      const newProject = { ...mockProject, id: 'new-project-id', name: 'New Project' }
      const newProjectFiles = [{ ...mockFile, project_id: newProject.id }]
      vi.mocked(FileService.getProjectFiles).mockResolvedValue(newProjectFiles)

      rerender({ project: newProject })

      await waitFor(() => {
        expect(FileService.getProjectFiles).toHaveBeenCalledWith(newProject.id)
        expect(FileService.getProjectFiles).toHaveBeenCalledTimes(2)
      })
    })

    it('should not reload files if project id remains the same', async () => {
      const { rerender } = renderHook(
        ({ project }) => useProjectFiles(project),
        { initialProps: { project: mockProject } }
      )

      await waitFor(() => {
        expect(FileService.getProjectFiles).toHaveBeenCalledTimes(1)
      })

      // Update project but keep same ID
      rerender({ project: { ...mockProject, name: 'Updated Name' } })

      // Should not call getProjectFiles again
      expect(FileService.getProjectFiles).toHaveBeenCalledTimes(1)
    })
  })

  describe('real-time subscription', () => {
    it('should set up real-time subscription for project files', async () => {
      renderHook(() => useProjectFiles(mockProject))

      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalledWith(`project_files_${mockProject.id}`)
      })

      expect(mockChannel.on).toHaveBeenCalledWith(
        'broadcast',
        { event: 'test' },
        expect.any(Function)
      )
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'INSERT',
          schema: 'public',
          table: 'project_files',
          filter: `project_id=eq.${mockProject.id}`
        }),
        expect.any(Function)
      )
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'UPDATE',
          schema: 'public',
          table: 'project_files',
          filter: `project_id=eq.${mockProject.id}`
        }),
        expect.any(Function)
      )
      expect(mockChannel.subscribe).toHaveBeenCalled()
    })

    it('should handle INSERT event by adding new file to state', async () => {
      let insertCallback: Function

      mockChannel.on.mockImplementation((type, config, callback) => {
        if (type === 'postgres_changes' && config.event === 'INSERT') {
          insertCallback = callback
        }
        return mockChannel
      })

      const { result } = renderHook(() => useProjectFiles(mockProject))

      await waitFor(() => {
        expect(FileService.getProjectFiles).toHaveBeenCalled()
      })

      const newFile: ProjectFile = {
        ...mockFile,
        id: generateDemoUUID('104'),
        name: 'newly-uploaded.pdf'
      }

      await act(async () => {
        insertCallback!({ new: newFile })
      })

      await waitFor(() => {
        const files = result.current.getCurrentProjectFiles()
        expect(files).toContainEqual(newFile)
        expect(files.length).toBeGreaterThan(mockFiles.length)
      })
    })

    it('should not add duplicate files on INSERT event', async () => {
      let insertCallback: Function

      mockChannel.on.mockImplementation((type, config, callback) => {
        if (type === 'postgres_changes' && config.event === 'INSERT') {
          insertCallback = callback
        }
        return mockChannel
      })

      const { result } = renderHook(() => useProjectFiles(mockProject))

      await waitFor(() => {
        expect(result.current.projectFiles[mockProject.id]).toEqual(mockFiles)
      })

      // Try to insert a file that already exists
      await act(async () => {
        insertCallback!({ new: mockFiles[0] })
      })

      // Should not add duplicate
      expect(result.current.getCurrentProjectFiles().length).toBe(mockFiles.length)
    })

    it('should handle UPDATE event by updating file in state', async () => {
      let updateCallback: Function

      mockChannel.on.mockImplementation((type, config, callback) => {
        if (type === 'postgres_changes' && config.event === 'UPDATE') {
          updateCallback = callback
        }
        return mockChannel
      })

      const { result } = renderHook(() => useProjectFiles(mockProject))

      await waitFor(() => {
        expect(result.current.projectFiles[mockProject.id]).toEqual(mockFiles)
      })

      const updatedFile: ProjectFile = {
        ...mockFiles[0],
        analysis_status: 'completed',
        ai_analysis: {
          summary: 'Test analysis',
          industry: 'Tech',
          scope: 'Medium'
        }
      }

      await act(async () => {
        updateCallback!({
          old: mockFiles[0],
          new: updatedFile
        })
      })

      await waitFor(() => {
        const files = result.current.getCurrentProjectFiles()
        const updatedFileInState = files.find(f => f.id === updatedFile.id)
        expect(updatedFileInState?.analysis_status).toBe('completed')
        expect(updatedFileInState?.ai_analysis).toEqual(updatedFile.ai_analysis)
      })
    })

    it('should ignore UPDATE event for non-existent file', async () => {
      let updateCallback: Function

      mockChannel.on.mockImplementation((type, config, callback) => {
        if (type === 'postgres_changes' && config.event === 'UPDATE') {
          updateCallback = callback
        }
        return mockChannel
      })

      const { result } = renderHook(() => useProjectFiles(mockProject))

      await waitFor(() => {
        expect(result.current.projectFiles[mockProject.id]).toEqual(mockFiles)
      })

      const nonExistentFile: ProjectFile = {
        ...mockFile,
        id: 'non-existent-id'
      }

      await act(async () => {
        updateCallback!({ new: nonExistentFile })
      })

      // State should remain unchanged
      expect(result.current.getCurrentProjectFiles()).toEqual(mockFiles)
    })

    it('should cleanup subscription on unmount', async () => {
      const { unmount } = renderHook(() => useProjectFiles(mockProject))

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled()
      })

      unmount()

      expect(mockChannel.unsubscribe).toHaveBeenCalled()
    })

    it('should cleanup old subscription when project changes', async () => {
      const { rerender } = renderHook(
        ({ project }) => useProjectFiles(project),
        { initialProps: { project: mockProject } }
      )

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalledTimes(1)
      })

      const newProject = { ...mockProject, id: 'new-project-id' }
      rerender({ project: newProject })

      await waitFor(() => {
        expect(mockChannel.unsubscribe).toHaveBeenCalled()
        expect(supabase.channel).toHaveBeenCalledWith(`project_files_${newProject.id}`)
      })
    })

    it('should send test broadcast after subscription setup', async () => {
      renderHook(() => useProjectFiles(mockProject))

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled()
      })

      // Fast-forward to trigger test broadcast
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'test',
        payload: { message: 'test from useProjectFiles' }
      })
    })
  })

  describe('file management operations', () => {
    describe('handleFilesUploaded', () => {
      it('should add new files to state', async () => {
        const { result } = renderHook(() => useProjectFiles(mockProject))

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false)
        })

        const newFiles: ProjectFile[] = [
          {
            ...mockFile,
            id: generateDemoUUID('105'),
            name: 'new-upload-1.pdf'
          },
          {
            ...mockFile,
            id: generateDemoUUID('106'),
            name: 'new-upload-2.pdf'
          }
        ]

        act(() => {
          result.current.handleFilesUploaded(newFiles)
        })

        await waitFor(() => {
          const currentFiles = result.current.getCurrentProjectFiles()
          expect(currentFiles.length).toBe(mockFiles.length + newFiles.length)
          expect(currentFiles).toContainEqual(newFiles[0])
          expect(currentFiles).toContainEqual(newFiles[1])
        })
      })

      it('should do nothing when no project is selected', async () => {
        const { result } = renderHook(() => useProjectFiles(null))

        const newFiles: ProjectFile[] = [mockFile]

        act(() => {
          result.current.handleFilesUploaded(newFiles)
        })

        expect(result.current.getCurrentProjectFiles()).toEqual([])
      })

      it('should maintain existing files when adding new ones', async () => {
        const { result } = renderHook(() => useProjectFiles(mockProject))

        await waitFor(() => {
          expect(result.current.getCurrentProjectFiles()).toEqual(mockFiles)
        })

        const newFile: ProjectFile = {
          ...mockFile,
          id: generateDemoUUID('107'),
          name: 'additional-file.pdf'
        }

        act(() => {
          result.current.handleFilesUploaded([newFile])
        })

        await waitFor(() => {
          const currentFiles = result.current.getCurrentProjectFiles()
          expect(currentFiles.length).toBe(mockFiles.length + 1)
          // Should contain all original files plus new one
          mockFiles.forEach(file => {
            expect(currentFiles).toContainEqual(file)
          })
          expect(currentFiles).toContainEqual(newFile)
        })
      })

      it('should handle empty array gracefully', async () => {
        const { result } = renderHook(() => useProjectFiles(mockProject))

        await waitFor(() => {
          expect(result.current.getCurrentProjectFiles()).toEqual(mockFiles)
        })

        act(() => {
          result.current.handleFilesUploaded([])
        })

        expect(result.current.getCurrentProjectFiles()).toEqual(mockFiles)
      })
    })

    describe('handleDeleteFile', () => {
      it('should delete file successfully', async () => {
        const { result } = renderHook(() => useProjectFiles(mockProject))

        await waitFor(() => {
          expect(result.current.getCurrentProjectFiles()).toEqual(mockFiles)
        })

        await act(async () => {
          await result.current.handleDeleteFile(mockFiles[0].id)
        })

        expect(FileService.deleteFile).toHaveBeenCalledWith(mockFiles[0].id)

        await waitFor(() => {
          const currentFiles = result.current.getCurrentProjectFiles()
          expect(currentFiles.length).toBe(mockFiles.length - 1)
          expect(currentFiles.find(f => f.id === mockFiles[0].id)).toBeUndefined()
        })
      })

      it('should handle deletion errors', async () => {
        vi.mocked(FileService.deleteFile).mockResolvedValue({
          success: false,
          error: 'Deletion failed'
        })

        const { result } = renderHook(() => useProjectFiles(mockProject))

        await waitFor(() => {
          expect(result.current.getCurrentProjectFiles()).toEqual(mockFiles)
        })

        await expect(
          act(async () => {
            await result.current.handleDeleteFile(mockFiles[0].id)
          })
        ).rejects.toThrow('Deletion failed')

        // State should remain unchanged
        expect(result.current.getCurrentProjectFiles()).toEqual(mockFiles)
      })

      it('should handle deletion exceptions', async () => {
        vi.mocked(FileService.deleteFile).mockRejectedValue(new Error('Network error'))

        const { result } = renderHook(() => useProjectFiles(mockProject))

        await waitFor(() => {
          expect(result.current.getCurrentProjectFiles()).toEqual(mockFiles)
        })

        await expect(
          act(async () => {
            await result.current.handleDeleteFile(mockFiles[0].id)
          })
        ).rejects.toThrow('Network error')

        // State should remain unchanged
        expect(result.current.getCurrentProjectFiles()).toEqual(mockFiles)
      })

      it('should do nothing when no project is selected', async () => {
        const { result } = renderHook(() => useProjectFiles(null))

        await act(async () => {
          await result.current.handleDeleteFile(mockFile.id)
        })

        expect(FileService.deleteFile).not.toHaveBeenCalled()
      })

      it('should handle deleting non-existent file', async () => {
        const { result } = renderHook(() => useProjectFiles(mockProject))

        await waitFor(() => {
          expect(result.current.getCurrentProjectFiles()).toEqual(mockFiles)
        })

        await act(async () => {
          await result.current.handleDeleteFile('non-existent-id')
        })

        expect(FileService.deleteFile).toHaveBeenCalledWith('non-existent-id')
        // State should remain unchanged (file wasn't there to begin with)
        expect(result.current.getCurrentProjectFiles()).toEqual(mockFiles)
      })
    })
  })

  describe('getCurrentProjectFiles', () => {
    it('should return files for current project', async () => {
      const { result } = renderHook(() => useProjectFiles(mockProject))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.getCurrentProjectFiles()).toEqual(mockFiles)
    })

    it('should return empty array when no project selected', () => {
      const { result } = renderHook(() => useProjectFiles(null))

      expect(result.current.getCurrentProjectFiles()).toEqual([])
    })

    it('should return empty array when project has no files', async () => {
      vi.mocked(FileService.getProjectFiles).mockResolvedValue([])

      const { result } = renderHook(() => useProjectFiles(mockProject))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.getCurrentProjectFiles()).toEqual([])
    })

    it('should return correct files after project change', async () => {
      const { rerender, result } = renderHook(
        ({ project }) => useProjectFiles(project),
        { initialProps: { project: mockProject } }
      )

      await waitFor(() => {
        expect(result.current.getCurrentProjectFiles()).toEqual(mockFiles)
      })

      const newProject = { ...mockProject, id: 'new-project-id' }
      const newProjectFiles = [{ ...mockFile, id: 'new-file-id', project_id: newProject.id }]
      vi.mocked(FileService.getProjectFiles).mockResolvedValue(newProjectFiles)

      rerender({ project: newProject })

      await waitFor(() => {
        expect(result.current.getCurrentProjectFiles()).toEqual(newProjectFiles)
      })
    })
  })

  describe('refreshProjectFiles', () => {
    it('should reload files from backend', async () => {
      const { result } = renderHook(() => useProjectFiles(mockProject))

      await waitFor(() => {
        expect(FileService.getProjectFiles).toHaveBeenCalledTimes(1)
      })

      // Update mock to return different files
      const updatedFiles = [
        ...mockFiles,
        { ...mockFile, id: generateDemoUUID('108'), name: 'new-file.pdf' }
      ]
      vi.mocked(FileService.getProjectFiles).mockResolvedValue(updatedFiles)

      await act(async () => {
        await result.current.refreshProjectFiles()
      })

      expect(FileService.getProjectFiles).toHaveBeenCalledTimes(2)
      expect(FileService.getProjectFiles).toHaveBeenCalledWith(mockProject.id)

      await waitFor(() => {
        expect(result.current.getCurrentProjectFiles()).toEqual(updatedFiles)
      })
    })

    it('should do nothing when no project selected', async () => {
      const { result } = renderHook(() => useProjectFiles(null))

      await act(async () => {
        await result.current.refreshProjectFiles()
      })

      expect(FileService.getProjectFiles).not.toHaveBeenCalled()
    })

    it('should handle refresh errors gracefully', async () => {
      const { result } = renderHook(() => useProjectFiles(mockProject))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      vi.mocked(FileService.getProjectFiles).mockRejectedValue(new Error('Refresh failed'))

      await act(async () => {
        await result.current.refreshProjectFiles()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should not crash, but files may remain unchanged
      expect(result.current.getCurrentProjectFiles()).toBeTruthy()
    })
  })

  describe('edge cases and concurrent operations', () => {
    it('should handle multiple rapid project changes', async () => {
      const { rerender } = renderHook(
        ({ project }) => useProjectFiles(project),
        { initialProps: { project: mockProject } }
      )

      const project2 = { ...mockProject, id: 'project-2' }
      const project3 = { ...mockProject, id: 'project-3' }

      rerender({ project: project2 })
      rerender({ project: project3 })
      rerender({ project: mockProject })

      await waitFor(() => {
        expect(FileService.getProjectFiles).toHaveBeenCalledWith(mockProject.id)
      })

      // Should handle rapid changes without errors
      expect(supabase.channel).toHaveBeenCalled()
    })

    it('should handle concurrent file uploads', async () => {
      const { result } = renderHook(() => useProjectFiles(mockProject))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const batch1 = [
        { ...mockFile, id: generateDemoUUID('201'), name: 'batch1-file1.pdf' },
        { ...mockFile, id: generateDemoUUID('202'), name: 'batch1-file2.pdf' }
      ]
      const batch2 = [
        { ...mockFile, id: generateDemoUUID('203'), name: 'batch2-file1.pdf' },
        { ...mockFile, id: generateDemoUUID('204'), name: 'batch2-file2.pdf' }
      ]

      act(() => {
        result.current.handleFilesUploaded(batch1)
        result.current.handleFilesUploaded(batch2)
      })

      await waitFor(() => {
        const files = result.current.getCurrentProjectFiles()
        expect(files.length).toBe(mockFiles.length + batch1.length + batch2.length)
      })
    })

    it('should handle switching from project to null', async () => {
      const { rerender } = renderHook(
        ({ project }) => useProjectFiles(project),
        { initialProps: { project: mockProject } }
      )

      await waitFor(() => {
        expect(FileService.getProjectFiles).toHaveBeenCalled()
      })

      rerender({ project: null })

      await waitFor(() => {
        expect(mockChannel.unsubscribe).toHaveBeenCalled()
      })
    })

    it('should handle switching from null to project', async () => {
      const { rerender, result } = renderHook(
        ({ project }) => useProjectFiles(project),
        { initialProps: { project: null } }
      )

      expect(result.current.getCurrentProjectFiles()).toEqual([])

      rerender({ project: mockProject })

      await waitFor(() => {
        expect(FileService.getProjectFiles).toHaveBeenCalledWith(mockProject.id)
      })
    })

    it('should maintain separate file lists for different projects', async () => {
      const { result, rerender } = renderHook(
        ({ project }) => useProjectFiles(project),
        { initialProps: { project: mockProject } }
      )

      await waitFor(() => {
        expect(result.current.projectFiles[mockProject.id]).toEqual(mockFiles)
      })

      const project2 = { ...mockProject, id: 'project-2' }
      const project2Files = [{ ...mockFile, id: 'p2-file-1', project_id: project2.id }]
      vi.mocked(FileService.getProjectFiles).mockResolvedValue(project2Files)

      rerender({ project: project2 })

      await waitFor(() => {
        expect(result.current.projectFiles[project2.id]).toEqual(project2Files)
      })

      // Both project file lists should exist
      expect(result.current.projectFiles[mockProject.id]).toEqual(mockFiles)
      expect(result.current.projectFiles[project2.id]).toEqual(project2Files)
    })
  })
})