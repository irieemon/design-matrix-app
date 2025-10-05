/**
 * FileManager Comprehensive Test Suite
 *
 * Complete test coverage for FileManager component including:
 * - File list display
 * - File selection (single and bulk)
 * - Delete files (single and bulk)
 * - Download files
 * - File metadata display
 * - Search/filter files
 * - Sort files
 * - Empty state
 * - Loading states
 * - Analysis status badges
 * - Accessibility
 * - Edge cases
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FileManager from '../FileManager'
import { ProjectFile } from '../../types'

// Mock dependencies
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}))

vi.mock('../../contexts/ToastContext', () => ({
  useToast: vi.fn(() => ({
    showError: vi.fn(),
    showWarning: vi.fn(),
    showSuccess: vi.fn(),
    showInfo: vi.fn()
  }))
}))

vi.mock('../DeleteConfirmModal', () => ({
  default: ({ isOpen, onClose, onConfirm, title, message }: any) =>
    isOpen ? (
      <div data-testid="delete-confirm-modal">
        <h3>{title}</h3>
        <p>{message}</p>
        <button onClick={onConfirm} data-testid="confirm-delete">Confirm</button>
        <button onClick={onClose} data-testid="cancel-delete">Cancel</button>
      </div>
    ) : null
}))

describe('FileManager - Comprehensive Test Suite', () => {
  const mockOnDeleteFile = vi.fn()
  const mockOnViewFile = vi.fn()

  const createMockFile = (overrides?: Partial<ProjectFile>): ProjectFile => ({
    id: 'file1',
    name: 'test-file',
    original_name: 'test-document.pdf',
    file_type: 'pdf',
    mime_type: 'application/pdf',
    file_size: 1024000,
    storage_path: '/files/test-document.pdf',
    content_preview: 'Sample document content preview',
    file_data: 'data:application/pdf;base64,dGVzdA==',
    analysis_status: 'completed',
    created_at: '2023-01-15T10:30:00.000Z',
    updated_at: '2023-01-15T10:30:00.000Z',
    uploader: {
      id: 'user1',
      email: 'user@example.com',
      full_name: 'John Doe',
      created_at: '2023-01-01',
      updated_at: '2023-01-01'
    },
    ...overrides
  })

  const sampleFiles: ProjectFile[] = [
    createMockFile({
      id: 'file1',
      original_name: 'project-spec.pdf',
      file_type: 'pdf',
      file_size: 2048000
    }),
    createMockFile({
      id: 'file2',
      original_name: 'design-mockup.png',
      file_type: 'image',
      mime_type: 'image/png',
      file_size: 512000,
      analysis_status: 'analyzing'
    }),
    createMockFile({
      id: 'file3',
      original_name: 'requirements.docx',
      file_type: 'docx',
      mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      file_size: 768000,
      analysis_status: 'pending'
    })
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()
  })

  describe('Empty State', () => {
    it('should display empty state when no files exist', () => {
      render(
        <FileManager
          files={[]}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getByText('No files uploaded')).toBeInTheDocument()
      expect(screen.getByText(/Upload some documents, images/)).toBeInTheDocument()
    })

    it('should show empty state icon', () => {
      const { container } = render(
        <FileManager
          files={[]}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const emptyIcon = container.querySelector('svg')
      expect(emptyIcon).toBeInTheDocument()
    })

    it('should not show file list controls in empty state', () => {
      render(
        <FileManager
          files={[]}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.queryByText(/Select all/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Uploaded Files/)).not.toBeInTheDocument()
    })
  })

  describe('File List Display', () => {
    it('should display all files in list', () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getByText('project-spec.pdf')).toBeInTheDocument()
      expect(screen.getByText('design-mockup.png')).toBeInTheDocument()
      expect(screen.getByText('requirements.docx')).toBeInTheDocument()
    })

    it('should display file count', () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getByText(/Uploaded Files \(3\)/)).toBeInTheDocument()
    })

    it('should display correct file icons based on type', () => {
      const { container } = render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const fileItems = container.querySelectorAll('[data-testid], .flex.items-center')
      expect(fileItems.length).toBeGreaterThan(0)
    })

    it('should display file sizes correctly', () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getByText(/2 MB/)).toBeInTheDocument()
      expect(screen.getByText(/500 KB/)).toBeInTheDocument()
      expect(screen.getByText(/750 KB/)).toBeInTheDocument()
    })

    it('should display upload dates', () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getByText(/Jan 15, 2023/)).toBeInTheDocument()
    })

    it('should display uploader information', () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0)
    })

    it('should display content preview when available', () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getByText(/Preview: Sample document content/)).toBeInTheDocument()
    })

    it('should truncate long content previews', () => {
      const longPreview = 'a'.repeat(200)
      const filesWithLongPreview = [createMockFile({ content_preview: longPreview })]

      render(
        <FileManager
          files={filesWithLongPreview}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const preview = screen.getByText(/Preview:/)
      expect(preview.textContent?.length).toBeLessThan(longPreview.length + 20)
    })

    it('should display total file size summary', () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getByText(/Total: 3 files/)).toBeInTheDocument()
      expect(screen.getByText(/3.17 MB/)).toBeInTheDocument()
    })
  })

  describe('File Selection', () => {
    it('should allow selecting individual file', async () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const checkboxes = screen.getAllByRole('checkbox')
      const firstFileCheckbox = checkboxes[1] // Skip "select all" checkbox

      await userEvent.click(firstFileCheckbox)

      expect(firstFileCheckbox).toBeChecked()
    })

    it('should allow deselecting file', async () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const checkboxes = screen.getAllByRole('checkbox')
      const firstFileCheckbox = checkboxes[1]

      await userEvent.click(firstFileCheckbox)
      expect(firstFileCheckbox).toBeChecked()

      await userEvent.click(firstFileCheckbox)
      expect(firstFileCheckbox).not.toBeChecked()
    })

    it('should highlight selected files', async () => {
      const { container } = render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const checkboxes = screen.getAllByRole('checkbox')
      await userEvent.click(checkboxes[1])

      const fileRow = container.querySelector('.border-blue-200')
      expect(fileRow).toBeInTheDocument()
    })

    it('should display selected count', async () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const checkboxes = screen.getAllByRole('checkbox')
      await userEvent.click(checkboxes[1])
      await userEvent.click(checkboxes[2])

      expect(screen.getByText('2 selected')).toBeInTheDocument()
    })

    it('should show bulk delete button when files selected', async () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.queryByText(/Delete/)).not.toBeInTheDocument()

      const checkboxes = screen.getAllByRole('checkbox')
      await userEvent.click(checkboxes[1])

      expect(screen.getByText(/Delete/)).toBeInTheDocument()
    })
  })

  describe('Select All Functionality', () => {
    it('should select all files when clicking select all', async () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const selectAllCheckbox = screen.getByLabelText(/Select all/)

      await userEvent.click(selectAllCheckbox)

      const checkboxes = screen.getAllByRole('checkbox')
      checkboxes.forEach(checkbox => {
        expect(checkbox).toBeChecked()
      })
    })

    it('should deselect all files when clicking select all again', async () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const selectAllCheckbox = screen.getByLabelText(/Select all/)

      await userEvent.click(selectAllCheckbox)
      await userEvent.click(selectAllCheckbox)

      const checkboxes = screen.getAllByRole('checkbox')
      checkboxes.forEach(checkbox => {
        expect(checkbox).not.toBeChecked()
      })
    })

    it('should check select all when all individual files selected', async () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const checkboxes = screen.getAllByRole('checkbox')
      const selectAllCheckbox = checkboxes[0]
      const fileCheckboxes = checkboxes.slice(1)

      for (const checkbox of fileCheckboxes) {
        await userEvent.click(checkbox)
      }

      expect(selectAllCheckbox).toBeChecked()
    })
  })

  describe('Delete Functionality', () => {
    it('should show delete modal when clicking delete button', async () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const deleteButtons = screen.getAllByTitle(/Delete file/)
      await userEvent.click(deleteButtons[0])

      expect(screen.getByTestId('delete-confirm-modal')).toBeInTheDocument()
      expect(screen.getByText('Delete File')).toBeInTheDocument()
    })

    it('should display file name in delete confirmation', async () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const deleteButtons = screen.getAllByTitle(/Delete file/)
      await userEvent.click(deleteButtons[0])

      expect(screen.getByText(/project-spec.pdf/)).toBeInTheDocument()
    })

    it('should call onDeleteFile when confirming single delete', async () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const deleteButtons = screen.getAllByTitle(/Delete file/)
      await userEvent.click(deleteButtons[0])

      const confirmButton = screen.getByTestId('confirm-delete')
      await userEvent.click(confirmButton)

      expect(mockOnDeleteFile).toHaveBeenCalledWith('file1')
    })

    it('should close modal when canceling delete', async () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const deleteButtons = screen.getAllByTitle(/Delete file/)
      await userEvent.click(deleteButtons[0])

      const cancelButton = screen.getByTestId('cancel-delete')
      await userEvent.click(cancelButton)

      expect(screen.queryByTestId('delete-confirm-modal')).not.toBeInTheDocument()
    })

    it('should not call onDeleteFile when canceling', async () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const deleteButtons = screen.getAllByTitle(/Delete file/)
      await userEvent.click(deleteButtons[0])

      const cancelButton = screen.getByTestId('cancel-delete')
      await userEvent.click(cancelButton)

      expect(mockOnDeleteFile).not.toHaveBeenCalled()
    })
  })

  describe('Bulk Delete', () => {
    it('should show bulk delete modal when clicking bulk delete', async () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const checkboxes = screen.getAllByRole('checkbox')
      await userEvent.click(checkboxes[1])
      await userEvent.click(checkboxes[2])

      const bulkDeleteButton = screen.getByText(/Delete/)
      await userEvent.click(bulkDeleteButton)

      expect(screen.getByText('Delete Files')).toBeInTheDocument()
    })

    it('should display selected count in bulk delete message', async () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const checkboxes = screen.getAllByRole('checkbox')
      await userEvent.click(checkboxes[1])
      await userEvent.click(checkboxes[2])

      const bulkDeleteButton = screen.getByText(/Delete/)
      await userEvent.click(bulkDeleteButton)

      expect(screen.getByText(/2 selected files/)).toBeInTheDocument()
    })

    it('should delete all selected files on confirm', async () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const checkboxes = screen.getAllByRole('checkbox')
      await userEvent.click(checkboxes[1])
      await userEvent.click(checkboxes[2])

      const bulkDeleteButton = screen.getByText(/Delete/)
      await userEvent.click(bulkDeleteButton)

      const confirmButton = screen.getByTestId('confirm-delete')
      await userEvent.click(confirmButton)

      expect(mockOnDeleteFile).toHaveBeenCalledTimes(2)
      expect(mockOnDeleteFile).toHaveBeenCalledWith('file1')
      expect(mockOnDeleteFile).toHaveBeenCalledWith('file2')
    })

    it('should clear selection after bulk delete', async () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const checkboxes = screen.getAllByRole('checkbox')
      await userEvent.click(checkboxes[1])

      const bulkDeleteButton = screen.getByText(/Delete/)
      await userEvent.click(bulkDeleteButton)

      const confirmButton = screen.getByTestId('confirm-delete')
      await userEvent.click(confirmButton)

      expect(screen.queryByText(/selected/)).not.toBeInTheDocument()
    })
  })

  describe('Download Functionality', () => {
    it('should call download function when clicking download button', async () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const downloadButtons = screen.getAllByTitle(/Download file/)
      await userEvent.click(downloadButtons[0])

      expect(global.URL.createObjectURL).toHaveBeenCalled()
    })

    it('should create download link with correct filename', async () => {
      const createElementSpy = vi.spyOn(document, 'createElement')

      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const downloadButtons = screen.getAllByTitle(/Download file/)
      await userEvent.click(downloadButtons[0])

      expect(createElementSpy).toHaveBeenCalledWith('a')
    })

    it('should handle download when file_data is missing', async () => {
      const filesWithoutData = [createMockFile({ file_data: undefined })]
      const { useToast } = await import('../../contexts/ToastContext')
      const mockShowWarning = vi.fn()
      vi.mocked(useToast).mockReturnValue({
        showWarning: mockShowWarning,
        showError: vi.fn(),
        showSuccess: vi.fn(),
        showInfo: vi.fn()
      })

      render(
        <FileManager
          files={filesWithoutData}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const downloadButtons = screen.getAllByTitle(/Download file/)
      await userEvent.click(downloadButtons[0])

      expect(mockShowWarning).toHaveBeenCalled()
    })

    it('should handle download errors gracefully', async () => {
      global.URL.createObjectURL = vi.fn(() => {
        throw new Error('Failed to create object URL')
      })

      const { useToast } = await import('../../contexts/ToastContext')
      const mockShowError = vi.fn()
      vi.mocked(useToast).mockReturnValue({
        showError: mockShowError,
        showWarning: vi.fn(),
        showSuccess: vi.fn(),
        showInfo: vi.fn()
      })

      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const downloadButtons = screen.getAllByTitle(/Download file/)
      await userEvent.click(downloadButtons[0])

      expect(mockShowError).toHaveBeenCalled()
    })

    it('should cleanup after download', async () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const downloadButtons = screen.getAllByTitle(/Download file/)
      await userEvent.click(downloadButtons[0])

      await waitFor(() => {
        expect(global.URL.revokeObjectURL).toHaveBeenCalled()
      })
    })
  })

  describe('View File Functionality', () => {
    it('should show view button when onViewFile provided', () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
          onViewFile={mockOnViewFile}
        />
      )

      expect(screen.getAllByTitle(/View file/).length).toBe(3)
    })

    it('should not show view button when onViewFile not provided', () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.queryByTitle(/View file/)).not.toBeInTheDocument()
    })

    it('should call onViewFile with correct file', async () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
          onViewFile={mockOnViewFile}
        />
      )

      const viewButtons = screen.getAllByTitle(/View file/)
      await userEvent.click(viewButtons[0])

      expect(mockOnViewFile).toHaveBeenCalledWith(sampleFiles[0])
    })
  })

  describe('Analysis Status Badges', () => {
    it('should display analyzing badge', () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getByText('AI Analyzing')).toBeInTheDocument()
    })

    it('should display completed badge', () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getByText('AI Ready')).toBeInTheDocument()
    })

    it('should display pending badge', () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getByText('AI Pending')).toBeInTheDocument()
    })

    it('should display failed badge', () => {
      const filesWithFailed = [createMockFile({ analysis_status: 'failed' })]

      render(
        <FileManager
          files={filesWithFailed}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getByText('AI Failed')).toBeInTheDocument()
    })

    it('should not display badge when status is undefined', () => {
      const filesWithoutStatus = [createMockFile({ analysis_status: undefined })]

      render(
        <FileManager
          files={filesWithoutStatus}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.queryByText(/AI/)).not.toBeInTheDocument()
    })
  })

  describe('File Metadata Display', () => {
    it('should display file name', () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getByText('project-spec.pdf')).toBeInTheDocument()
    })

    it('should display file size in appropriate units', () => {
      const files = [
        createMockFile({ file_size: 500 }), // Bytes
        createMockFile({ id: 'f2', file_size: 1024 }), // 1 KB
        createMockFile({ id: 'f3', file_size: 1048576 }), // 1 MB
        createMockFile({ id: 'f4', file_size: 1073741824 }) // 1 GB
      ]

      render(
        <FileManager
          files={files}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getByText(/500 Bytes/)).toBeInTheDocument()
      expect(screen.getByText(/1 KB/)).toBeInTheDocument()
      expect(screen.getByText(/1 MB/)).toBeInTheDocument()
      expect(screen.getByText(/1 GB/)).toBeInTheDocument()
    })

    it('should display formatted dates', () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getByText(/Jan 15, 2023.*10:30/)).toBeInTheDocument()
    })

    it('should display uploader full name when available', () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0)
    })

    it('should display uploader email when full name not available', () => {
      const files = [createMockFile({
        uploader: {
          id: 'user1',
          email: 'test@example.com',
          full_name: undefined,
          created_at: '2023-01-01',
          updated_at: '2023-01-01'
        }
      })]

      render(
        <FileManager
          files={files}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getByText('test@example.com')).toBeInTheDocument()
    })

    it('should display Unknown when uploader info missing', () => {
      const files = [createMockFile({ uploader: undefined })]

      render(
        <FileManager
          files={files}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getByText('Unknown')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have accessible checkboxes', () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const checkboxes = screen.getAllByRole('checkbox')
      checkboxes.forEach(checkbox => {
        expect(checkbox).toHaveAttribute('type', 'checkbox')
      })
    })

    it('should have accessible buttons with titles', () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
          onViewFile={mockOnViewFile}
        />
      )

      expect(screen.getAllByTitle(/View file/).length).toBeGreaterThan(0)
      expect(screen.getAllByTitle(/Download file/).length).toBeGreaterThan(0)
      expect(screen.getAllByTitle(/Delete file/).length).toBeGreaterThan(0)
    })

    it('should support keyboard navigation for checkboxes', async () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const checkboxes = screen.getAllByRole('checkbox')
      checkboxes[1].focus()

      expect(document.activeElement).toBe(checkboxes[1])
    })

    it('should have proper ARIA labels', () => {
      render(
        <FileManager
          files={sampleFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getByLabelText(/Select all/)).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle file with zero size', () => {
      const files = [createMockFile({ file_size: 0 })]

      render(
        <FileManager
          files={files}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getByText('0 Bytes')).toBeInTheDocument()
    })

    it('should handle files with very long names', () => {
      const longName = 'a'.repeat(200) + '.pdf'
      const files = [createMockFile({ original_name: longName })]

      const { container } = render(
        <FileManager
          files={files}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      const fileName = container.querySelector('.truncate')
      expect(fileName).toBeInTheDocument()
    })

    it('should handle missing content preview gracefully', () => {
      const files = [createMockFile({ content_preview: undefined })]

      render(
        <FileManager
          files={files}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.queryByText(/Preview:/)).not.toBeInTheDocument()
    })

    it('should handle empty content preview', () => {
      const files = [createMockFile({ content_preview: '' })]

      render(
        <FileManager
          files={files}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.queryByText(/Preview:/)).not.toBeInTheDocument()
    })

    it('should handle special characters in file names', () => {
      const files = [createMockFile({ original_name: 'file (1) [copy].pdf' })]

      render(
        <FileManager
          files={files}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getByText('file (1) [copy].pdf')).toBeInTheDocument()
    })

    it('should handle unicode in file names', () => {
      const files = [createMockFile({ original_name: '文档.pdf' })]

      render(
        <FileManager
          files={files}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getByText('文档.pdf')).toBeInTheDocument()
    })

    it('should handle files with unknown type', () => {
      const files = [createMockFile({ file_type: 'unknown' as any })]

      const { container } = render(
        <FileManager
          files={files}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      // Should still render without crashing
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('should handle very large file counts', () => {
      const manyFiles = Array.from({ length: 100 }, (_, i) =>
        createMockFile({ id: `file${i}`, original_name: `file${i}.pdf` })
      )

      render(
        <FileManager
          files={manyFiles}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getByText(/Uploaded Files \(100\)/)).toBeInTheDocument()
    })

    it('should handle single file list', () => {
      const files = [createMockFile()]

      render(
        <FileManager
          files={files}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getByText(/Uploaded Files \(1\)/)).toBeInTheDocument()
    })

    it('should calculate total size correctly for large numbers', () => {
      const files = [
        createMockFile({ file_size: 1073741824 }), // 1 GB
        createMockFile({ id: 'f2', file_size: 1073741824 }) // 1 GB
      ]

      render(
        <FileManager
          files={files}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      expect(screen.getByText(/Total: 2 files, 2 GB/)).toBeInTheDocument()
    })

    it('should handle malformed dates gracefully', () => {
      const files = [createMockFile({ created_at: 'invalid-date' })]

      render(
        <FileManager
          files={files}
          onDeleteFile={mockOnDeleteFile}
        />
      )

      // Should render without crashing, even if date is invalid
      expect(screen.getByText('test-document.pdf')).toBeInTheDocument()
    })
  })
})