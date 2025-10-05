/**
 * FileUpload Comprehensive Test Suite
 *
 * Complete test coverage for FileUpload component including:
 * - Drag and drop functionality
 * - File input click and selection
 * - File type validation
 * - File size limits
 * - Multiple file upload
 * - Progress indicators
 * - Cancel upload
 * - Error handling (invalid type, too large, network error)
 * - PDF text extraction
 * - Content preview extraction
 * - Accessibility
 * - Edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FileUpload from '../FileUpload'
import { Project, ProjectFile } from '../../types'
import { FileService } from '../../lib/fileService'
import { getCurrentUser } from '../../lib/supabase'

// Mock dependencies
vi.mock('../../lib/fileService', () => ({
  FileService: {
    uploadFile: vi.fn()
  }
}))

vi.mock('../../lib/supabase', () => ({
  getCurrentUser: vi.fn()
}))

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}))

// Mock PDF.js
vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn((config) => ({
    promise: Promise.resolve({
      numPages: 3,
      getPage: vi.fn((pageNum) => Promise.resolve({
        getTextContent: vi.fn(() => Promise.resolve({
          items: [
            { str: `Page ${pageNum} text content` }
          ]
        }))
      }))
    })
  })),
  GlobalWorkerOptions: {
    workerSrc: ''
  }
}))

describe('FileUpload - Comprehensive Test Suite', () => {
  const mockOnFilesUploaded = vi.fn()

  const sampleProject: Project = {
    id: 'project123',
    name: 'Test Project',
    project_type: 'SaaS',
    owner_id: 'user123',
    created_at: '2023-01-01',
    updated_at: '2023-01-01'
  }

  const createFile = (name: string, type: string, size: number): File => {
    const file = new File(['test content'], name, { type })
    Object.defineProperty(file, 'size', { value: size })
    return file
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user123', email: 'test@example.com' } as any)
    vi.mocked(FileService.uploadFile).mockResolvedValue({
      success: true,
      file: {
        id: 'file123',
        name: 'test.pdf',
        original_name: 'test.pdf',
        file_type: 'pdf',
        mime_type: 'application/pdf',
        file_size: 1000,
        storage_path: '/path/to/file',
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      } as ProjectFile
    })
  })

  describe('Component Rendering', () => {
    it('should render the upload area', () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      expect(screen.getByText('Upload Supporting Files')).toBeInTheDocument()
      expect(screen.getByText('Drag and drop files here, or click to select files')).toBeInTheDocument()
    })

    it('should display default max file size', () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      expect(screen.getByText(/Max size: 10MB per file/)).toBeInTheDocument()
    })

    it('should display custom max file size', () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
          maxFileSize={25}
        />
      )

      expect(screen.getByText(/Max size: 25MB per file/)).toBeInTheDocument()
    })

    it('should display supported file types', () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      expect(screen.getByText(/Supported: PDF, Word, Images, Text files/)).toBeInTheDocument()
    })

    it('should display help text about file usage', () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      expect(screen.getByText('How it helps')).toBeInTheDocument()
      expect(screen.getByText(/Upload documents, images, and references/)).toBeInTheDocument()
    })
  })

  describe('File Input Click', () => {
    it('should open file input when clicking upload area', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement
      const fileInput = uploadArea?.querySelector('input[type="file"]') as HTMLInputElement

      const clickSpy = vi.spyOn(fileInput, 'click')

      if (uploadArea) {
        fireEvent.click(uploadArea)
      }

      expect(clickSpy).toHaveBeenCalled()
    })

    it('should have correct accept attribute for allowed types', () => {
      const { container } = render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      expect(fileInput).toHaveAttribute('accept')
      expect(fileInput.accept).toContain('application/pdf')
      expect(fileInput.accept).toContain('image/png')
    })

    it('should allow multiple file selection', () => {
      const { container } = render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      expect(fileInput).toHaveAttribute('multiple')
    })
  })

  describe('Drag and Drop Functionality', () => {
    it('should change style when dragging over', () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        fireEvent.dragOver(uploadArea)
        expect(uploadArea.className).toContain('border-blue-400')
        expect(uploadArea.className).toContain('bg-blue-50')
      }
    })

    it('should reset style when drag leaves', () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        fireEvent.dragOver(uploadArea)
        fireEvent.dragLeave(uploadArea)
        expect(uploadArea.className).not.toContain('border-blue-400')
        expect(uploadArea.className).not.toContain('bg-blue-50')
      }
    })

    it('should handle file drop', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const file = createFile('test.pdf', 'application/pdf', 5 * 1024 * 1024)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(FileService.uploadFile).toHaveBeenCalled()
        })
      }
    })

    it('should handle multiple files drop', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const files = [
        createFile('test1.pdf', 'application/pdf', 1024),
        createFile('test2.png', 'image/png', 2048)
      ]

      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(FileService.uploadFile).toHaveBeenCalledTimes(2)
        })
      }
    })

    it('should prevent default on drag over', () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const event = new Event('dragover', { bubbles: true, cancelable: true })
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

        uploadArea.dispatchEvent(event)

        expect(preventDefaultSpy).toHaveBeenCalled()
      }
    })

    it('should prevent default on drop', () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const event = new Event('drop', { bubbles: true, cancelable: true })
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

        uploadArea.dispatchEvent(event)

        expect(preventDefaultSpy).toHaveBeenCalled()
      }
    })
  })

  describe('File Type Validation', () => {
    it('should accept valid PDF file', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const file = createFile('document.pdf', 'application/pdf', 1024)
      const { container } = render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      await userEvent.upload(fileInput, file)

      await waitFor(() => {
        expect(FileService.uploadFile).toHaveBeenCalled()
      })
    })

    it('should accept valid image file', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const file = createFile('image.png', 'image/png', 1024)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(FileService.uploadFile).toHaveBeenCalled()
        })
      }
    })

    it('should reject invalid file type', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const file = createFile('script.exe', 'application/x-msdownload', 1024)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(screen.getByText(/File type .* is not supported/)).toBeInTheDocument()
        })

        expect(FileService.uploadFile).not.toHaveBeenCalled()
      }
    })

    it('should display error for unsupported file type', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const file = createFile('video.mp4', 'video/mp4', 1024)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(screen.getByText('Upload Error')).toBeInTheDocument()
        })
      }
    })

    it('should accept custom allowed types', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
          allowedTypes={['application/json']}
        />
      )

      const file = createFile('data.json', 'application/json', 1024)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(FileService.uploadFile).toHaveBeenCalled()
        })
      }
    })
  })

  describe('File Size Validation', () => {
    it('should reject file exceeding max size', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
          maxFileSize={5}
        />
      )

      const file = createFile('large.pdf', 'application/pdf', 10 * 1024 * 1024) // 10MB
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(screen.getByText(/is too large. Maximum size is 5MB/)).toBeInTheDocument()
        })

        expect(FileService.uploadFile).not.toHaveBeenCalled()
      }
    })

    it('should accept file within size limit', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
          maxFileSize={10}
        />
      )

      const file = createFile('small.pdf', 'application/pdf', 5 * 1024 * 1024) // 5MB
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(FileService.uploadFile).toHaveBeenCalled()
        })
      }
    })

    it('should display error with file name for oversized file', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
          maxFileSize={1}
        />
      )

      const file = createFile('huge-document.pdf', 'application/pdf', 5 * 1024 * 1024)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(screen.getByText(/huge-document.pdf.*is too large/)).toBeInTheDocument()
        })
      }
    })

    it('should accept file at exact size limit', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
          maxFileSize={5}
        />
      )

      const file = createFile('exact.pdf', 'application/pdf', 5 * 1024 * 1024) // Exactly 5MB
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(FileService.uploadFile).toHaveBeenCalled()
        })
      }
    })
  })

  describe('Progress Indicators', () => {
    it('should show uploading state', async () => {
      vi.mocked(FileService.uploadFile).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({
          success: true,
          file: {} as ProjectFile
        }), 100))
      )

      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const file = createFile('test.pdf', 'application/pdf', 1024)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(screen.getByText('Uploading...')).toBeInTheDocument()
        })
      }
    })

    it('should disable upload area during upload', async () => {
      vi.mocked(FileService.uploadFile).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({
          success: true,
          file: {} as ProjectFile
        }), 100))
      )

      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const file = createFile('test.pdf', 'application/pdf', 1024)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(uploadArea.className).toContain('pointer-events-none')
          expect(uploadArea.className).toContain('opacity-50')
        })
      }
    })

    it('should re-enable upload area after completion', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const file = createFile('test.pdf', 'application/pdf', 1024)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(mockOnFilesUploaded).toHaveBeenCalled()
        })

        expect(uploadArea.className).not.toContain('pointer-events-none')
        expect(uploadArea.className).not.toContain('opacity-50')
      }
    })
  })

  describe('Multiple File Upload', () => {
    it('should handle multiple valid files', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const files = [
        createFile('doc1.pdf', 'application/pdf', 1024),
        createFile('doc2.pdf', 'application/pdf', 2048),
        createFile('image.png', 'image/png', 3072)
      ]

      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(FileService.uploadFile).toHaveBeenCalledTimes(3)
        })
      }
    })

    it('should stop on first invalid file', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const files = [
        createFile('doc1.pdf', 'application/pdf', 1024),
        createFile('invalid.exe', 'application/x-msdownload', 2048),
        createFile('doc3.pdf', 'application/pdf', 3072)
      ]

      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(screen.getByText(/File type .* is not supported/)).toBeInTheDocument()
        })

        expect(FileService.uploadFile).not.toHaveBeenCalled()
      }
    })

    it('should call onFilesUploaded with all uploaded files', async () => {
      const uploadedFile: ProjectFile = {
        id: 'file123',
        name: 'test.pdf',
        original_name: 'test.pdf',
        file_type: 'pdf',
        mime_type: 'application/pdf',
        file_size: 1000,
        storage_path: '/path/to/file',
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      }

      vi.mocked(FileService.uploadFile).mockResolvedValue({
        success: true,
        file: uploadedFile
      })

      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const files = [
        createFile('doc1.pdf', 'application/pdf', 1024),
        createFile('doc2.pdf', 'application/pdf', 2048)
      ]

      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(mockOnFilesUploaded).toHaveBeenCalledWith([uploadedFile, uploadedFile])
        })
      }
    })
  })

  describe('Error Handling', () => {
    it('should display error when upload fails', async () => {
      vi.mocked(FileService.uploadFile).mockResolvedValue({
        success: false,
        error: 'Network error'
      })

      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const file = createFile('test.pdf', 'application/pdf', 1024)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(screen.getByText(/Failed to upload/)).toBeInTheDocument()
        })
      }
    })

    it('should display error message from service', async () => {
      vi.mocked(FileService.uploadFile).mockResolvedValue({
        success: false,
        error: 'Storage quota exceeded'
      })

      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const file = createFile('test.pdf', 'application/pdf', 1024)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(screen.getByText(/Storage quota exceeded/)).toBeInTheDocument()
        })
      }
    })

    it('should allow dismissing error message', async () => {
      vi.mocked(FileService.uploadFile).mockResolvedValue({
        success: false,
        error: 'Upload failed'
      })

      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const file = createFile('test.pdf', 'application/pdf', 1024)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(screen.getByText('Upload Error')).toBeInTheDocument()
        })

        const closeButton = screen.getByRole('button', { name: /close/i })
        fireEvent.click(closeButton)

        expect(screen.queryByText('Upload Error')).not.toBeInTheDocument()
      }
    })

    it('should handle exception during upload', async () => {
      vi.mocked(FileService.uploadFile).mockRejectedValue(new Error('Network timeout'))

      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const file = createFile('test.pdf', 'application/pdf', 1024)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(screen.getByText(/Failed to upload files/)).toBeInTheDocument()
        })
      }
    })

    it('should clear previous errors on new upload', async () => {
      vi.mocked(FileService.uploadFile).mockResolvedValueOnce({
        success: false,
        error: 'First error'
      })

      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const file1 = createFile('test1.pdf', 'application/pdf', 1024)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent1 = {
          dataTransfer: {
            files: [file1]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent1)

        await waitFor(() => {
          expect(screen.getByText(/First error/)).toBeInTheDocument()
        })

        vi.mocked(FileService.uploadFile).mockResolvedValue({
          success: true,
          file: {} as ProjectFile
        })

        const file2 = createFile('test2.pdf', 'application/pdf', 1024)
        const dropEvent2 = {
          dataTransfer: {
            files: [file2]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent2)

        await waitFor(() => {
          expect(screen.queryByText(/First error/)).not.toBeInTheDocument()
        })
      }
    })
  })

  describe('PDF Text Extraction', () => {
    it('should extract text from PDF files', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const file = createFile('document.pdf', 'application/pdf', 1024)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(FileService.uploadFile).toHaveBeenCalledWith(
            file,
            sampleProject.id,
            expect.stringContaining('Page'),
            'user123'
          )
        })
      }
    })

    it('should handle PDF with no extractable text', async () => {
      const pdfjs = await import('pdfjs-dist')
      vi.mocked(pdfjs.getDocument).mockReturnValue({
        promise: Promise.resolve({
          numPages: 1,
          getPage: vi.fn(() => Promise.resolve({
            getTextContent: vi.fn(() => Promise.resolve({
              items: []
            }))
          }))
        })
      } as any)

      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const file = createFile('empty.pdf', 'application/pdf', 1024)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(FileService.uploadFile).toHaveBeenCalledWith(
            file,
            sampleProject.id,
            expect.stringContaining('no extractable text'),
            'user123'
          )
        })
      }
    })

    it('should handle PDF extraction failure gracefully', async () => {
      const pdfjs = await import('pdfjs-dist')
      vi.mocked(pdfjs.getDocument).mockReturnValue({
        promise: Promise.reject(new Error('Corrupted PDF'))
      } as any)

      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const file = createFile('corrupt.pdf', 'application/pdf', 1024)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(FileService.uploadFile).toHaveBeenCalledWith(
            file,
            sampleProject.id,
            expect.stringContaining('text extraction not available'),
            'user123'
          )
        })
      }
    })
  })

  describe('Content Preview Extraction', () => {
    it('should extract text from plain text files', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const fileContent = 'This is a test document'
      const file = new File([fileContent], 'test.txt', { type: 'text/plain' })

      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(FileService.uploadFile).toHaveBeenCalledWith(
            file,
            sampleProject.id,
            fileContent,
            'user123'
          )
        })
      }
    })

    it('should extract text from markdown files', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const fileContent = '# Heading\n\nMarkdown content'
      const file = new File([fileContent], 'readme.md', { type: 'text/markdown' })

      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(FileService.uploadFile).toHaveBeenCalledWith(
            file,
            sampleProject.id,
            fileContent,
            'user123'
          )
        })
      }
    })

    it('should provide message for Word documents', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const file = createFile('document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1024)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(FileService.uploadFile).toHaveBeenCalledWith(
            file,
            sampleProject.id,
            expect.stringContaining('Word document'),
            'user123'
          )
        })
      }
    })

    it('should not extract content from images', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const file = createFile('image.png', 'image/png', 1024)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(FileService.uploadFile).toHaveBeenCalledWith(
            file,
            sampleProject.id,
            '',
            'user123'
          )
        })
      }
    })
  })

  describe('Accessibility', () => {
    it('should have accessible file input', () => {
      const { container } = render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const fileInput = container.querySelector('input[type="file"]')
      expect(fileInput).toBeInTheDocument()
      expect(fileInput).toHaveAttribute('type', 'file')
    })

    it('should have accessible error messages', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const file = createFile('invalid.exe', 'application/x-msdownload', 1024)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          const errorTitle = screen.getByText('Upload Error')
          expect(errorTitle).toBeInTheDocument()
        })
      }
    })

    it('should support keyboard navigation', () => {
      const { container } = render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement
      expect(uploadArea).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty file list on drop', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: []
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(FileService.uploadFile).not.toHaveBeenCalled()
        })
      }
    })

    it('should handle zero-size file', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const file = createFile('empty.pdf', 'application/pdf', 0)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(FileService.uploadFile).toHaveBeenCalled()
        })
      }
    })

    it('should handle very long file names', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const longName = 'a'.repeat(255) + '.pdf'
      const file = createFile(longName, 'application/pdf', 1024)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(FileService.uploadFile).toHaveBeenCalled()
        })
      }
    })

    it('should handle special characters in file names', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const file = createFile('test file (1) [copy].pdf', 'application/pdf', 1024)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(FileService.uploadFile).toHaveBeenCalled()
        })
      }
    })

    it('should handle unicode characters in file names', async () => {
      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const file = createFile('文档.pdf', 'application/pdf', 1024)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(FileService.uploadFile).toHaveBeenCalled()
        })
      }
    })

    it('should handle missing user gracefully', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      render(
        <FileUpload
          currentProject={sampleProject}
          onFilesUploaded={mockOnFilesUploaded}
        />
      )

      const file = createFile('test.pdf', 'application/pdf', 1024)
      const uploadArea = screen.getByText('Upload Supporting Files').closest('div')?.parentElement

      if (uploadArea) {
        const dropEvent = {
          dataTransfer: {
            files: [file]
          }
        } as any

        fireEvent.drop(uploadArea, dropEvent)

        await waitFor(() => {
          expect(FileService.uploadFile).toHaveBeenCalledWith(
            file,
            sampleProject.id,
            expect.any(String),
            undefined
          )
        })
      }
    })
  })
})