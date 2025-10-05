/**
 * Test File Fixtures
 * Provides consistent mock file data for testing file upload and management
 */

import { basicProject } from './projects'
import { testUser } from './users'

/**
 * Mock file structure for testing
 */
export interface TestFile {
  id: string
  project_id: string
  filename: string
  file_type: string
  file_size: number
  mime_type: string
  storage_path: string
  uploaded_by: string
  created_at: string
  url?: string
  thumbnail_url?: string
}

/**
 * Mock image file - PNG
 */
export const mockImagePNG: TestFile = {
  id: 'file-image-001',
  project_id: basicProject.id,
  filename: 'wireframe-mockup.png',
  file_type: 'image',
  file_size: 245678,
  mime_type: 'image/png',
  storage_path: `${basicProject.id}/wireframe-mockup.png`,
  uploaded_by: testUser.id,
  created_at: '2025-01-01T00:00:00.000Z',
  url: 'https://storage.example.com/wireframe-mockup.png',
  thumbnail_url: 'https://storage.example.com/thumbs/wireframe-mockup.png'
}

/**
 * Mock image file - JPEG
 */
export const mockImageJPEG: TestFile = {
  id: 'file-image-002',
  project_id: basicProject.id,
  filename: 'design-concept.jpg',
  file_type: 'image',
  file_size: 512340,
  mime_type: 'image/jpeg',
  storage_path: `${basicProject.id}/design-concept.jpg`,
  uploaded_by: testUser.id,
  created_at: '2025-01-02T00:00:00.000Z',
  url: 'https://storage.example.com/design-concept.jpg',
  thumbnail_url: 'https://storage.example.com/thumbs/design-concept.jpg'
}

/**
 * Mock document file - PDF
 */
export const mockPDF: TestFile = {
  id: 'file-doc-001',
  project_id: basicProject.id,
  filename: 'requirements-doc.pdf',
  file_type: 'document',
  file_size: 1024567,
  mime_type: 'application/pdf',
  storage_path: `${basicProject.id}/requirements-doc.pdf`,
  uploaded_by: testUser.id,
  created_at: '2025-01-03T00:00:00.000Z',
  url: 'https://storage.example.com/requirements-doc.pdf'
}

/**
 * Mock audio file - MP3
 */
export const mockAudioMP3: TestFile = {
  id: 'file-audio-001',
  project_id: basicProject.id,
  filename: 'meeting-recording.mp3',
  file_type: 'audio',
  file_size: 3456789,
  mime_type: 'audio/mpeg',
  storage_path: `${basicProject.id}/meeting-recording.mp3`,
  uploaded_by: testUser.id,
  created_at: '2025-01-04T00:00:00.000Z',
  url: 'https://storage.example.com/meeting-recording.mp3'
}

/**
 * Mock audio file - WAV
 */
export const mockAudioWAV: TestFile = {
  id: 'file-audio-002',
  project_id: basicProject.id,
  filename: 'voice-note.wav',
  file_type: 'audio',
  file_size: 5678901,
  mime_type: 'audio/wav',
  storage_path: `${basicProject.id}/voice-note.wav`,
  uploaded_by: testUser.id,
  created_at: '2025-01-05T00:00:00.000Z',
  url: 'https://storage.example.com/voice-note.wav'
}

/**
 * Mock video file - MP4
 */
export const mockVideoMP4: TestFile = {
  id: 'file-video-001',
  project_id: basicProject.id,
  filename: 'product-demo.mp4',
  file_type: 'video',
  file_size: 15678901,
  mime_type: 'video/mp4',
  storage_path: `${basicProject.id}/product-demo.mp4`,
  uploaded_by: testUser.id,
  created_at: '2025-01-06T00:00:00.000Z',
  url: 'https://storage.example.com/product-demo.mp4',
  thumbnail_url: 'https://storage.example.com/thumbs/product-demo.jpg'
}

/**
 * Mock large file for size limit testing
 */
export const mockLargeFile: TestFile = {
  id: 'file-large-001',
  project_id: basicProject.id,
  filename: 'large-video.mov',
  file_type: 'video',
  file_size: 52428800, // 50MB
  mime_type: 'video/quicktime',
  storage_path: `${basicProject.id}/large-video.mov`,
  uploaded_by: testUser.id,
  created_at: '2025-01-07T00:00:00.000Z',
  url: 'https://storage.example.com/large-video.mov'
}

/**
 * Mock files by type for filtering tests
 */
export const filesByType = {
  images: [mockImagePNG, mockImageJPEG],
  documents: [mockPDF],
  audio: [mockAudioMP3, mockAudioWAV],
  video: [mockVideoMP4]
}

/**
 * Browser File object mock for upload testing
 */
export class MockFile {
  name: string
  size: number
  type: string
  lastModified: number

  constructor(
    content: string | ArrayBuffer,
    filename: string,
    options: { type?: string; lastModified?: number } = {}
  ) {
    this.name = filename
    this.size = typeof content === 'string' ? content.length : content.byteLength
    this.type = options.type || 'text/plain'
    this.lastModified = options.lastModified || Date.now()
  }

  async text(): Promise<string> {
    return 'mock file content'
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return new ArrayBuffer(this.size)
  }

  stream(): ReadableStream {
    return new ReadableStream()
  }

  slice(start?: number, end?: number, contentType?: string): Blob {
    return new Blob()
  }
}

/**
 * Create mock File for testing uploads
 */
export function createMockFile(
  filename: string,
  type: string,
  size: number = 1024
): File {
  const content = 'x'.repeat(size)
  return new MockFile(content, filename, { type }) as unknown as File
}

/**
 * Create mock FileList for testing multiple uploads
 */
export function createMockFileList(files: File[]): FileList {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] || null,
    [Symbol.iterator]: function* () {
      for (const file of files) {
        yield file
      }
    }
  }

  // Add indexed access
  files.forEach((file, index) => {
    Object.defineProperty(fileList, index, {
      value: file,
      enumerable: true
    })
  })

  return fileList as FileList
}

/**
 * Mock upload progress event
 */
export interface MockUploadProgress {
  loaded: number
  total: number
  percentage: number
}

/**
 * Generate mock upload progress events
 */
export function* generateUploadProgress(
  totalSize: number,
  chunkSize: number = 1024
): Generator<MockUploadProgress> {
  let loaded = 0
  while (loaded < totalSize) {
    loaded = Math.min(loaded + chunkSize, totalSize)
    yield {
      loaded,
      total: totalSize,
      percentage: Math.round((loaded / totalSize) * 100)
    }
  }
}

/**
 * Mock Supabase storage upload response
 */
export interface MockStorageUploadResponse {
  data: {
    path: string
    id: string
    fullPath: string
  } | null
  error: {
    message: string
    statusCode?: string
  } | null
}

/**
 * Successful upload response
 */
export const mockSuccessfulUpload: MockStorageUploadResponse = {
  data: {
    path: 'project-001/test-file.png',
    id: 'upload-001',
    fullPath: 'projects/project-001/test-file.png'
  },
  error: null
}

/**
 * Failed upload response - file too large
 */
export const mockUploadErrorTooLarge: MockStorageUploadResponse = {
  data: null,
  error: {
    message: 'File size exceeds maximum allowed size',
    statusCode: '413'
  }
}

/**
 * Failed upload response - invalid file type
 */
export const mockUploadErrorInvalidType: MockStorageUploadResponse = {
  data: null,
  error: {
    message: 'File type not allowed',
    statusCode: '400'
  }
}

/**
 * Failed upload response - storage quota exceeded
 */
export const mockUploadErrorQuotaExceeded: MockStorageUploadResponse = {
  data: null,
  error: {
    message: 'Storage quota exceeded',
    statusCode: '507'
  }
}

/**
 * Create a test file with custom properties
 */
export function createTestFile(overrides: Partial<TestFile> = {}): TestFile {
  const timestamp = Date.now()
  return {
    id: `file-${timestamp}`,
    project_id: basicProject.id,
    filename: `test-file-${timestamp}.txt`,
    file_type: 'document',
    file_size: 1024,
    mime_type: 'text/plain',
    storage_path: `${basicProject.id}/test-file-${timestamp}.txt`,
    uploaded_by: testUser.id,
    created_at: new Date().toISOString(),
    url: `https://storage.example.com/test-file-${timestamp}.txt`,
    ...overrides
  }
}

/**
 * Generate multiple test files
 */
export function createTestFiles(count: number, baseOverrides: Partial<TestFile> = {}): TestFile[] {
  return Array.from({ length: count }, (_, index) =>
    createTestFile({
      ...baseOverrides,
      filename: `test-file-${index + 1}.${baseOverrides.mime_type?.split('/')[1] || 'txt'}`
    })
  )
}

/**
 * All test files for easy iteration
 */
export const allTestFiles = [
  mockImagePNG,
  mockImageJPEG,
  mockPDF,
  mockAudioMP3,
  mockAudioWAV,
  mockVideoMP4,
  mockLargeFile
]

/**
 * Allowed file types configuration
 */
export const allowedFileTypes = {
  images: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'],
  documents: ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  audio: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm'],
  video: ['video/mp4', 'video/webm', 'video/quicktime']
}

/**
 * File size limits (in bytes)
 */
export const fileSizeLimits = {
  image: 5 * 1024 * 1024,      // 5MB
  document: 10 * 1024 * 1024,  // 10MB
  audio: 20 * 1024 * 1024,     // 20MB
  video: 50 * 1024 * 1024,     // 50MB
  default: 10 * 1024 * 1024    // 10MB
}
