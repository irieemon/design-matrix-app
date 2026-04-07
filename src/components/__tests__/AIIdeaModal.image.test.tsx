/**
 * Wave 0 RED tests for AIIdeaModal Image tab.
 *
 * These tests are EXPECTED TO FAIL until Plan 03-02 implements the Image tab.
 * They must fail with assertion errors (cannot find element / fetch not called),
 * NOT with parse / import / module-not-found errors.
 *
 * Covers: MM-01 (visual analysis), MM-02 (OCR), MM-07 (direct storage upload).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  mockUploadFile,
  mockCreateSignedUrl,
  resetFileServiceMocks,
} from '../../test/mocks/fileService'

vi.mock('../../lib/fileService', () => ({
  FileService: {
    uploadFile: mockUploadFile,
  },
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUrl: mockCreateSignedUrl,
      }),
    },
  },
  createAuthenticatedClientFromLocalStorage: () => ({}),
}))

vi.mock('../../hooks/useCsrfToken', () => ({
  useCsrfToken: () => ({
    csrfToken: 'test-csrf',
    hasToken: true,
    refreshToken: () => {},
    getCsrfHeaders: () => ({ 'X-CSRF-Token': 'test-csrf' }),
  }),
}))

import AIIdeaModal from '../AIIdeaModal'

const mockProject = {
  id: 'test-project',
  name: 'Test Project',
  description: 'Test description',
  project_type: 'product',
} as any

const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
} as any

beforeEach(() => {
  resetFileServiceMocks()
  global.fetch = vi.fn()
})

async function selectImageTabAndUpload(user: ReturnType<typeof userEvent.setup>) {
  const imageTab = await screen.findByRole('tab', { name: /Image/i })
  await user.click(imageTab)

  const file = new File(['fake-image-bytes'], 'photo.jpg', { type: 'image/jpeg' })
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  await user.upload(input, file)

  const analyzeBtn = await screen.findByRole('button', { name: /Analyze Image/i })
  await user.click(analyzeBtn)
}

describe('AIIdeaModal Image tab (Wave 0 RED — MM-01, MM-02, MM-07)', () => {
  it('MM-01: renders visual analysis result after Analyze Image', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        analysis: {
          subject: 'A cat',
          description: 'Orange tabby',
          insights: ['Cute'],
          relevanceScore: 80,
        },
      }),
    })

    const user = userEvent.setup()
    render(
      <AIIdeaModal
        onClose={() => {}}
        onAdd={() => {}}
        currentProject={mockProject}
        currentUser={mockUser}
      />
    )

    await selectImageTabAndUpload(user)

    expect(await screen.findByText('A cat')).toBeTruthy()
    expect(await screen.findByText(/Orange tabby/)).toBeTruthy()
  })

  it('MM-02: surfaces OCR textContent and "Extracted Text:" label', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        analysis: {
          subject: 'Receipt',
          textContent: 'Total: $42.00',
          insights: [],
          relevanceScore: 60,
        },
      }),
    })

    const user = userEvent.setup()
    render(
      <AIIdeaModal
        onClose={() => {}}
        onAdd={() => {}}
        currentProject={mockProject}
        currentUser={mockUser}
      />
    )

    await selectImageTabAndUpload(user)

    expect(await screen.findByText(/Total: \$42\.00/)).toBeTruthy()
    expect(await screen.findByText(/Extracted Text:/i)).toBeTruthy()
  })

  it('MM-07: upload goes through FileService, fetch receives signed URL only', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        analysis: { subject: 'Thing', insights: [], relevanceScore: 50 },
      }),
    })

    const user = userEvent.setup()
    render(
      <AIIdeaModal
        onClose={() => {}}
        onAdd={() => {}}
        currentProject={mockProject}
        currentUser={mockUser}
      />
    )

    await selectImageTabAndUpload(user)

    expect(mockUploadFile).toHaveBeenCalledTimes(1)
    const [fileArg, projectIdArg, contentPreviewArg, userIdArg] =
      mockUploadFile.mock.calls[0]
    expect(fileArg).toBeInstanceOf(File)
    expect(projectIdArg).toBe('test-project')
    expect(typeof contentPreviewArg).toBe('string')
    expect(userIdArg).toBe('test-user-id')

    expect(global.fetch).toHaveBeenCalled()
    const [url, init] = (global.fetch as any).mock.calls[0]
    expect(url).toBe('/api/ai?action=analyze-image')
    const body = JSON.parse(init.body)
    expect(body.imageUrl).toBe('https://signed.example/test.jpg?token=abc')
  })

  it('includes X-CSRF-Token header on the analyze fetch', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        analysis: { subject: 'Thing', insights: [], relevanceScore: 50 },
      }),
    })

    const user = userEvent.setup()
    render(
      <AIIdeaModal
        onClose={() => {}}
        onAdd={() => {}}
        currentProject={mockProject}
        currentUser={mockUser}
      />
    )

    await selectImageTabAndUpload(user)

    const [, init] = (global.fetch as any).mock.calls[0]
    expect(init.headers['X-CSRF-Token']).toBe('test-csrf')
  })

  it('Create Idea from Analysis maps analysis to onAdd payload', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        analysis: {
          subject: 'A cat',
          description: 'Orange tabby',
          insights: ['Cute'],
          relevanceScore: 80,
        },
      }),
    })

    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(
      <AIIdeaModal
        onClose={() => {}}
        onAdd={onAdd}
        currentProject={mockProject}
        currentUser={mockUser}
      />
    )

    await selectImageTabAndUpload(user)

    const createBtn = await screen.findByRole('button', {
      name: /Create Idea from Analysis/i,
    })
    await user.click(createBtn)

    expect(onAdd).toHaveBeenCalledTimes(1)
    const payload = onAdd.mock.calls[0][0]
    expect(payload.content).toMatch(/A cat/i)
    expect(payload).toMatchObject({
      is_collapsed: true,
      editing_by: null,
      editing_at: null,
      created_by: 'test-user-id',
    })
    expect(typeof payload.x).toBe('number')
    expect(typeof payload.y).toBe('number')
    expect(payload.priority).toBeDefined()
  })
})
