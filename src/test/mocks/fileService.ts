/**
 * Test mocks for FileService and signed URL flow.
 * Used by AIIdeaModal image tab tests.
 */
import { vi } from 'vitest'

export const mockUploadFile = vi.fn().mockResolvedValue({
  success: true,
  file: {
    id: 'test-file-id',
    name: 'test.jpg',
    storage_path: 'projects/test-project/files/test.jpg',
    mime_type: 'image/jpeg',
    file_size: 1024,
  },
})

export const mockCreateSignedUrl = vi.fn().mockResolvedValue({
  data: { signedUrl: 'https://signed.example/test.jpg?token=abc' },
  error: null,
})

export function resetFileServiceMocks() {
  mockUploadFile.mockClear()
  mockCreateSignedUrl.mockClear()
}
