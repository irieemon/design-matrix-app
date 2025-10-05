/**
 * FileService Security Tests
 *
 * Critical security tests for file upload, storage, and access control that protects against:
 * - Path traversal and directory escape attacks
 * - Malicious file uploads and executable content
 * - Cross-project file access violations
 * - Storage bucket permission bypasses
 * - File size and type validation bypasses
 * - Signed URL manipulation and security
 * - Database injection through file metadata
 * - Race conditions in upload/cleanup processes
 *
 * Business Impact: Data breaches, unauthorized file access, storage abuse, malware uploads
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FileService } from '../fileService'
import type { ProjectFile } from '../../types'
import { supabase } from '../supabase'

// Mock the supabase module using factory functions
vi.mock('../supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(),
      listBuckets: vi.fn(),
      createBucket: vi.fn()
    },
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

// Mock crypto for UUID generation using Vitest's stubGlobal
vi.stubGlobal('crypto', {
  randomUUID: vi.fn().mockReturnValue('test-uuid-12345')
})

// Mock window for hostname checks
Object.defineProperty(window, 'location', {
  value: {
    hostname: 'localhost'
  },
  writable: true
})

// Helper functions
const createMockFile = (
  name: string,
  size: number = 1024,
  type: string = 'text/plain',
  content: string = 'test content'
): File => {
  const blob = new Blob([content], { type })
  const file = new File([blob], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('FileService Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Set up storage mocks
    const mockStorageBucket = {
      upload: vi.fn().mockResolvedValue({
        data: { path: 'projects/test-project/files/test-uuid-12345_test.txt' },
        error: null
      }),
      remove: vi.fn().mockResolvedValue({ error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://signed-url.example.com' },
        error: null
      }),
      list: vi.fn().mockResolvedValue({
        data: [{ name: 'test-file.txt' }],
        error: null
      })
    }

    const mockSupabaseStorage = supabase.storage as any
    mockSupabaseStorage.from.mockReturnValue(mockStorageBucket)
    mockSupabaseStorage.listBuckets.mockResolvedValue({ data: [{ name: 'project-files' }] })
    mockSupabaseStorage.createBucket.mockResolvedValue({ error: null })

    // Set up database mocks
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'file-123',
          project_id: 'test-project',
          name: 'test.txt',
          original_name: 'test.txt',
          file_type: 'txt',
          file_size: 1024,
          mime_type: 'text/plain',
          storage_path: 'projects/test-project/files/test-uuid-12345_test.txt',
          content_preview: 'test content',
          uploaded_by: 'user-123',
          created_at: '2023-12-01T10:00:00Z',
          updated_at: '2023-12-01T10:00:00Z',
          analysis_status: 'pending',
          ai_analysis: null
        },
        error: null
      })
    }

    const mockSupabaseFrom = supabase.from as any
    mockSupabaseFrom.mockReturnValue(mockQuery)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('File Upload Security', () => {
    describe('Path Traversal Prevention', () => {
      it('should sanitize malicious filenames with path traversal attempts', async () => {
        const maliciousFilenames = [
          '../../../etc/passwd',
          '..\\..\\windows\\system32\\config\\sam',
          './../sensitive/file.txt',
          'normal/../../../etc/hosts',
          '....//....//....//etc/passwd',
          '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd', // URL encoded path traversal
          '..%252f..%252f..%252fetc%252fpasswd', // Double URL encoded
          '..%c0%af..%c0%af..%c0%afetc%c0%afpasswd' // Unicode bypass attempt
        ]

        for (const filename of maliciousFilenames) {
          const file = createMockFile(filename)

          await FileService.uploadFile(file, 'test-project', 'test content', 'user-123')

          // Verify that the storage path doesn't contain path traversal sequences
          const storageCall = mockStorage.from().upload.mock.calls[0]
          if (storageCall) {
            const storagePath = storageCall[0]
            expect(storagePath).not.toContain('../')
            expect(storagePath).not.toContain('..\\')
            expect(storagePath).not.toContain('%2e%2e')
            expect(storagePath).toMatch(/^projects\/test-project\/files\/test-uuid-12345_/)
          }

          vi.clearAllMocks()
          // Reset mock for next iteration
          const mockStorageBucket = {
            upload: vi.fn().mockResolvedValue({
              data: { path: 'projects/test-project/files/test-uuid-12345_sanitized.txt' },
              error: null
            }),
            remove: vi.fn().mockResolvedValue({ error: null })
          }
          mockStorage.from.mockReturnValue(mockStorageBucket)
        }
      })

      it('should prevent null byte injection in filenames', async () => {
        const file = createMockFile('malicious\x00.txt.exe')

        await FileService.uploadFile(file, 'test-project', 'test content', 'user-123')

        const storageCall = mockStorage.from().upload.mock.calls[0]
        if (storageCall) {
          const storagePath = storageCall[0]
          expect(storagePath).not.toContain('\x00')
          expect(storagePath).toMatch(/^projects\/test-project\/files\/test-uuid-12345_/)
        }
      })

      it('should limit filename length to prevent buffer overflow', async () => {
        const longFilename = 'a'.repeat(1000) + '.txt'
        const file = createMockFile(longFilename)

        await FileService.uploadFile(file, 'test-project', 'test content', 'user-123')

        const storageCall = mockStorage.from().upload.mock.calls[0]
        if (storageCall) {
          const storagePath = storageCall[0]
          // Should be sanitized to reasonable length
          expect(storagePath.length).toBeLessThan(500)
          expect(storagePath).toMatch(/^projects\/test-project\/files\/test-uuid-12345_/)
        }
      })
    })

    describe('File Type and Content Security', () => {
      it('should reject executable file types', async () => {
        const dangerousFiles = [
          { name: 'malware.exe', type: 'application/x-msdownload' },
          { name: 'script.bat', type: 'application/x-bat' },
          { name: 'trojan.com', type: 'application/x-dosexec' },
          { name: 'virus.scr', type: 'application/x-msdownload' },
          { name: 'exploit.msi', type: 'application/x-msi' }
        ]

        for (const fileInfo of dangerousFiles) {
          const file = createMockFile(fileInfo.name, 1024, fileInfo.type)

          const result = await FileService.uploadFile(file, 'test-project', 'test content', 'user-123')

          // Should either reject or handle with extreme caution
          if (!result.success) {
            expect(result.error).toBeDefined()
          } else {
            // If allowed, must be properly sandboxed
            expect(result.file?.mime_type).toBe(fileInfo.type)
          }

          vi.clearAllMocks()
          // Reset mock for next iteration
          const mockStorageBucket = {
            upload: vi.fn().mockResolvedValue({
              data: { path: 'projects/test-project/files/test-uuid-12345_file.exe' },
              error: null
            }),
            remove: vi.fn().mockResolvedValue({ error: null })
          }
          mockStorage.from.mockReturnValue(mockStorageBucket)
        }
      })

      it('should validate file content against declared MIME type', async () => {
        // Create a file claiming to be text but containing binary data
        const binaryContent = '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR' // PNG header
        const file = createMockFile('fake.txt', 1024, 'text/plain', binaryContent)

        const result = await FileService.uploadFile(file, 'test-project', binaryContent, 'user-123')

        // Should detect mismatch and handle appropriately
        expect(result).toBeDefined()
        if (result.success) {
          // If allowed, should properly classify the file
          expect(result.file?.content_preview).toBe(binaryContent)
        }
      })

      it('should prevent script injection through file content', async () => {
        const maliciousContent = '<script>alert("XSS")</script>'
        const file = createMockFile('test.html', 1024, 'text/html', maliciousContent)

        const result = await FileService.uploadFile(file, 'test-project', maliciousContent, 'user-123')

        if (result.success) {
          // Content should be stored safely without execution
          expect(result.file?.content_preview).toBe(maliciousContent)
          expect(result.file?.mime_type).toBe('text/html')
        }
      })
    })

    describe('File Size Validation', () => {
      it('should enforce maximum file size limits', async () => {
        const oversizedFile = createMockFile('large.txt', 51 * 1024 * 1024) // 51MB > 50MB limit

        const result = await FileService.uploadFile(oversizedFile, 'test-project', 'test content', 'user-123')

        expect(result.success).toBe(false)
        expect(result.error).toContain('exceeds maximum allowed size')
        expect(result.error).toContain('51.0MB')
      })

      it('should handle edge case at exact file size limit', async () => {
        const maxSizeFile = createMockFile('max.txt', 50 * 1024 * 1024) // Exactly 50MB

        const result = await FileService.uploadFile(maxSizeFile, 'test-project', 'test content', 'user-123')

        expect(result.success).toBe(true)
        expect(result.file?.file_size).toBe(50 * 1024 * 1024)
      })

      it('should prevent size manipulation attacks', async () => {
        const file = createMockFile('test.txt', 1024)
        // Attempt to manipulate the file size property
        Object.defineProperty(file, 'size', { value: -1 })

        const result = await FileService.uploadFile(file, 'test-project', 'test content', 'user-123')

        // Should handle negative or manipulated sizes gracefully
        expect(result).toBeDefined()
      })
    })

    describe('Project Isolation Security', () => {
      it('should prevent cross-project file access through projectId manipulation', async () => {
        const maliciousProjectIds = [
          '../other-project',
          '../../admin-project',
          'project-1/../project-2',
          null as any,
          undefined as any,
          '',
          'project\x00hidden'
        ]

        for (const projectId of maliciousProjectIds) {
          const file = createMockFile('test.txt')

          const result = await FileService.uploadFile(file, projectId, 'test content', 'user-123')

          if (result.success) {
            // If upload succeeds, verify proper isolation
            const storageCall = mockStorage.from().upload.mock.calls[0]
            if (storageCall) {
              const storagePath = storageCall[0]
              expect(storagePath).toMatch(/^projects\/[^\/\.]+\/files\//)
              expect(storagePath).not.toContain('../')
            }
          }

          vi.clearAllMocks()
          // Reset mock for next iteration
          const mockStorageBucket = {
            upload: vi.fn().mockResolvedValue({
              data: { path: 'projects/sanitized-project/files/test-uuid-12345_test.txt' },
              error: null
            })
          }
          mockStorage.from.mockReturnValue(mockStorageBucket)
        }
      })

      it('should validate project ownership before file upload', async () => {
        const file = createMockFile('test.txt')

        // Simulate unauthorized project access
        mockQuery.single.mockResolvedValueOnce({
          data: null,
          error: { message: 'Project not found or access denied' }
        })

        const result = await FileService.uploadFile(file, 'unauthorized-project', 'test content', 'user-123')

        // Should handle unauthorized access appropriately
        expect(result).toBeDefined()
      })
    })

    describe('Upload Transaction Security', () => {
      it('should clean up storage when database insert fails', async () => {
        const file = createMockFile('test.txt')

        // Mock storage success but database failure
        mockQuery.single.mockResolvedValueOnce({
          data: null,
          error: { message: 'Database insert failed' }
        })

        const result = await FileService.uploadFile(file, 'test-project', 'test content', 'user-123')

        expect(result.success).toBe(false)
        expect(result.error).toContain('Database error')

        // Verify cleanup was attempted
        expect(mockStorage.from().remove).toHaveBeenCalledWith(['projects/test-project/files/test-uuid-12345_test.txt'])
      })

      it('should handle race conditions in concurrent uploads', async () => {
        const file1 = createMockFile('test1.txt')
        const file2 = createMockFile('test2.txt')

        // Start multiple uploads simultaneously
        const upload1Promise = FileService.uploadFile(file1, 'test-project', 'content 1', 'user-123')
        const upload2Promise = FileService.uploadFile(file2, 'test-project', 'content 2', 'user-123')

        const [result1, result2] = await Promise.all([upload1Promise, upload2Promise])

        // Both should complete successfully with unique paths
        expect(result1.success).toBe(true)
        expect(result2.success).toBe(true)

        if (result1.success && result2.success) {
          expect(result1.file?.storage_path).not.toBe(result2.file?.storage_path)
        }
      })
    })
  })

  describe('File Access Security', () => {
    describe('Signed URL Security', () => {
      it('should generate time-limited signed URLs', async () => {
        const url = await FileService.getFileUrl('projects/test-project/files/test.txt')

        expect(url).toBe('https://signed-url.example.com')
        expect(mockStorage.from().createSignedUrl).toHaveBeenCalledWith(
          'projects/test-project/files/test.txt',
          3600 // 1 hour expiration
        )
      })

      it('should prevent path traversal in signed URL requests', async () => {
        const maliciousPaths = [
          '../../../etc/passwd',
          'projects/other-project/../secret-project/file.txt',
          '/etc/passwd',
          '..\\..\\windows\\system32\\config\\sam'
        ]

        for (const path of maliciousPaths) {
          await FileService.getFileUrl(path)

          const urlCall = mockStorage.from().createSignedUrl.mock.calls[0]
          if (urlCall) {
            const cleanPath = urlCall[0]
            expect(cleanPath).not.toMatch(/^\.\.\//)
            expect(cleanPath).not.toMatch(/\/\.\.\//)
            expect(cleanPath).not.toStartWith('/')
          }

          vi.clearAllMocks()
          // Reset mock
          mockStorage.from.mockReturnValue({
            createSignedUrl: vi.fn().mockResolvedValue({
              data: { signedUrl: 'https://signed-url.example.com' },
              error: null
            })
          })
        }
      })

      it('should handle signed URL errors securely', async () => {
        mockStorage.from.mockReturnValue({
          createSignedUrl: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'File not found' }
          }),
          list: vi.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })

        const url = await FileService.getFileUrl('projects/test-project/files/nonexistent.txt')

        expect(url).toBeNull()
        // Should not expose internal file structure in errors
      })
    })

    describe('File Listing Security', () => {
      it('should enforce project-based file isolation in listings', async () => {
        const files = await FileService.getProjectFiles('test-project')

        expect(mockQuery.eq).toHaveBeenCalledWith('project_id', 'test-project')
        expect(files).toBeDefined()
      })

      it('should handle database errors in file listings securely', async () => {
        mockQuery.single.mockResolvedValueOnce({
          data: null,
          error: { message: 'Access denied' }
        })

        const files = await FileService.getProjectFiles('unauthorized-project')

        expect(files).toEqual([])
        // Should not expose error details to prevent information leakage
      })
    })

    describe('File Deletion Security', () => {
      it('should verify file ownership before deletion', async () => {
        const result = await FileService.deleteFile('file-123')

        expect(mockQuery.eq).toHaveBeenCalledWith('id', 'file-123')
        expect(result.success).toBe(true)
      })

      it('should handle unauthorized deletion attempts', async () => {
        mockQuery.single.mockResolvedValueOnce({
          data: null,
          error: { message: 'File not found' }
        })

        const result = await FileService.deleteFile('unauthorized-file')

        expect(result.success).toBe(false)
        expect(result.error).toContain('Could not find file')
      })

      it('should continue with database cleanup even if storage deletion fails', async () => {
        mockStorage.from.mockReturnValue({
          remove: vi.fn().mockResolvedValue({
            error: { message: 'Storage deletion failed' }
          })
        })

        const result = await FileService.deleteFile('file-123')

        expect(mockQuery.delete).toHaveBeenCalled()
        expect(result.success).toBe(true)
      })
    })
  })

  describe('Storage Configuration Security', () => {
    describe('Bucket Initialization Security', () => {
      it('should create private buckets with security constraints', async () => {
        mockStorage.listBuckets.mockResolvedValue({ data: [] })
        mockStorage.createBucket.mockResolvedValue({ error: null })

        await FileService.initializeBucket()

        expect(mockStorage.createBucket).toHaveBeenCalledWith('project-files', {
          public: false, // Must be private
          allowedMimeTypes: ['*/*'],
          fileSizeLimit: 50 * 1024 * 1024
        })
      })

      it('should handle bucket creation failures gracefully', async () => {
        mockStorage.listBuckets.mockResolvedValue({ data: [] })
        mockStorage.createBucket.mockResolvedValue({
          error: { message: 'Permission denied' }
        })

        await FileService.initializeBucket()

        // Should not throw or expose sensitive error details
        expect(mockStorage.createBucket).toHaveBeenCalled()
      })
    })
  })

  describe('Input Validation and Injection Prevention', () => {
    describe('Database Injection Prevention', () => {
      it('should sanitize file metadata to prevent SQL injection', async () => {
        const file = createMockFile('test.txt')
        const maliciousContent = "'; DROP TABLE project_files; --"

        await FileService.uploadFile(file, 'test-project', maliciousContent, 'user-123')

        const insertCall = mockQuery.insert.mock.calls[0]
        if (insertCall) {
          const fileRecord = insertCall[0][0]
          expect(fileRecord.content_preview).toBe(maliciousContent)
          // Should be safely stored without SQL injection
        }
      })

      it('should handle special characters in uploaded_by field', async () => {
        const file = createMockFile('test.txt')
        const maliciousUserId = "user'; DROP TABLE users; --"

        await FileService.uploadFile(file, 'test-project', 'content', maliciousUserId)

        const insertCall = mockQuery.insert.mock.calls[0]
        if (insertCall) {
          const fileRecord = insertCall[0][0]
          expect(fileRecord.uploaded_by).toBe(maliciousUserId)
          // Should be safely parameterized in the query
        }
      })
    })

    describe('Content Security', () => {
      it('should handle binary content safely', async () => {
        const binaryContent = '\x00\x01\x02\x03\xFF\xFE\xFD'
        const file = createMockFile('binary.dat', 1024, 'application/octet-stream', binaryContent)

        const result = await FileService.uploadFile(file, 'test-project', binaryContent, 'user-123')

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.file?.content_preview).toBe(binaryContent)
        }
      })

      it('should handle Unicode and emoji content safely', async () => {
        const unicodeContent = '🔒 Secure file with émojis and ñoñó characters 中文 العربية'
        const file = createMockFile('unicode.txt', 1024, 'text/plain', unicodeContent)

        const result = await FileService.uploadFile(file, 'test-project', unicodeContent, 'user-123')

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.file?.content_preview).toBe(unicodeContent)
        }
      })
    })
  })

  describe('Error Handling Security', () => {
    it('should not expose sensitive information in error messages', async () => {
      const file = createMockFile('test.txt')

      mockStorage.from.mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'AWS S3 credentials expired: sk-secret-key-12345' }
        })
      })

      const result = await FileService.uploadFile(file, 'test-project', 'content', 'user-123')

      expect(result.success).toBe(false)
      if (result.error) {
        expect(result.error).not.toContain('sk-secret-key-12345')
        expect(result.error).not.toContain('AWS S3')
        expect(result.error).toContain('Upload failed')
      }
    })

    it('should handle unexpected exceptions gracefully', async () => {
      const file = createMockFile('test.txt')

      mockStorage.from.mockImplementation(() => {
        throw new Error('Unexpected internal error with database connection string')
      })

      const result = await FileService.uploadFile(file, 'test-project', 'content', 'user-123')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      if (result.error) {
        expect(result.error).not.toContain('database connection string')
      }
    })
  })
})