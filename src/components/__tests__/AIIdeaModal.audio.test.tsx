/**
 * Plan 04-02 RED tests for AIIdeaModal Audio tab.
 *
 * Covers: MM-03 (audio file upload), MM-04 (mobile voice record),
 *         MM-06 (stage indicators), review-then-create.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockUploadFile = vi.fn()
vi.mock('../../lib/fileService', () => ({
  FileService: {
    uploadFile: (...args: any[]) => mockUploadFile(...args),
  },
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUrl: vi.fn(),
      }),
    },
  },
  createAuthenticatedClientFromLocalStorage: () => ({}),
}))

vi.mock('../../lib/imageResize', () => ({
  resizeImageToFile: vi.fn(async (file: File) => file),
}))

vi.mock('../../hooks/useCsrfToken', () => ({
  useCsrfToken: () => ({
    csrfToken: 'test-csrf-token',
    hasToken: true,
    refreshToken: () => {},
    getCsrfHeaders: () => ({ 'X-CSRF-Token': 'test-csrf-token' }),
  }),
}))

const mockRecorderState: {
  isRecording: boolean
  elapsedMs: number
  error: string | null
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
} = {
  isRecording: false,
  elapsedMs: 0,
  error: null,
  start: vi.fn(),
  stop: vi.fn(),
}

vi.mock('../../hooks/useAudioRecorder', () => ({
  useAudioRecorder: () => mockRecorderState,
}))

import AIIdeaModal from '../AIIdeaModal'

const mockProject = {
  id: 'p1',
  name: 'Test Project',
  description: 'desc',
  project_type: 'product',
} as any

const mockUser = { id: 'u1', email: 'a@b.c' } as any

function createAudioFile(sizeBytes: number, type = 'audio/webm', name = 'sample.webm'): File {
  return new File([new Uint8Array(sizeBytes)], name, { type })
}

function defaultUploadResolved() {
  mockUploadFile.mockResolvedValue({
    success: true,
    file: {
      id: 'f1',
      storage_path: 'projects/p1/files/x.webm',
      publicUrl: 'https://signed.example/audio.webm',
    },
  })
}

function defaultTranscribeResolved() {
  ;(global.fetch as any).mockResolvedValue({
    ok: true,
    json: async () => ({
      transcription: {
        text: 'hello world this is the transcript',
        summary: 'auto title',
        keyPoints: ['k1'],
        language: 'en',
        duration: 3,
      },
    }),
  })
}

beforeEach(() => {
  mockUploadFile.mockReset()
  mockRecorderState.isRecording = false
  mockRecorderState.elapsedMs = 0
  mockRecorderState.error = null
  mockRecorderState.start = vi.fn(async () => {
    mockRecorderState.isRecording = true
  })
  mockRecorderState.stop = vi.fn(async () => {
    mockRecorderState.isRecording = false
    return new Blob(['x'], { type: 'audio/webm' })
  })
  global.fetch = vi.fn() as any
})

afterEach(() => {
  vi.clearAllMocks()
})

async function gotoAudioTab(user: ReturnType<typeof userEvent.setup>) {
  const audioTab = await screen.findByRole('tab', { name: /Audio/i })
  await user.click(audioTab)
}

describe('AIIdeaModal Audio tab', () => {
  it('MM-03 upload happy path: drop audio file → review panel', async () => {
    defaultUploadResolved()
    defaultTranscribeResolved()

    const user = userEvent.setup()
    render(
      <AIIdeaModal onClose={() => {}} onAdd={() => {}} currentProject={mockProject} currentUser={mockUser} />
    )
    await gotoAudioTab(user)

    const file = createAudioFile(1024 * 1024, 'audio/webm')
    const input = screen.getByLabelText(/Upload audio file/i) as HTMLInputElement
    await user.upload(input, file)

    expect(await screen.findByText(/hello world this is the transcript/)).toBeTruthy()
    expect(await screen.findByText(/k1/)).toBeTruthy()
  })

  it('MM-03 size reject: 30MB file is rejected before upload (25MB limit)', async () => {
    const user = userEvent.setup()
    render(
      <AIIdeaModal onClose={() => {}} onAdd={() => {}} currentProject={mockProject} currentUser={mockUser} />
    )
    await gotoAudioTab(user)

    const big = createAudioFile(30 * 1024 * 1024, 'audio/webm', 'big.webm')
    const input = screen.getByLabelText(/Upload audio file/i) as HTMLInputElement
    await user.upload(input, big)

    expect(mockUploadFile).not.toHaveBeenCalled()
    expect(await screen.findByText(/File too large \(max 25MB\)/i)).toBeTruthy()
  })

  it('MM-03 MIME reject: non-audio file shows Unsupported audio format', async () => {
    const user = userEvent.setup()
    render(
      <AIIdeaModal onClose={() => {}} onAdd={() => {}} currentProject={mockProject} currentUser={mockUser} />
    )
    await gotoAudioTab(user)

    const txt = new File(['text'], 'note.txt', { type: 'text/plain' })
    const input = screen.getByLabelText(/Upload audio file/i) as HTMLInputElement
    fireEvent.change(input, { target: { files: [txt] } })

    expect(mockUploadFile).not.toHaveBeenCalled()
    expect(await screen.findByText(/Unsupported audio format/i)).toBeTruthy()
  })

  it('MM-04 record happy path: record → REC indicator → stop → review', async () => {
    defaultUploadResolved()
    defaultTranscribeResolved()

    const user = userEvent.setup()
    const { rerender } = render(
      <AIIdeaModal onClose={() => {}} onAdd={() => {}} currentProject={mockProject} currentUser={mockUser} />
    )
    await gotoAudioTab(user)

    const recBtn = await screen.findByRole('button', { name: /Record/i })
    await user.click(recBtn)

    // Force re-render so the mock state flip becomes visible
    mockRecorderState.elapsedMs = 1500
    rerender(
      <AIIdeaModal onClose={() => {}} onAdd={() => {}} currentProject={mockProject} currentUser={mockUser} />
    )

    expect(await screen.findByText(/● REC/)).toBeTruthy()
    expect(screen.getByText(/\d+:\d{2}/)).toBeTruthy()

    const stopBtn = await screen.findByRole('button', { name: /Stop/i })
    await user.click(stopBtn)

    expect(await screen.findByText(/hello world this is the transcript/)).toBeTruthy()
  })

  it('MM-04 permission denied: error message visible', async () => {
    mockRecorderState.error = 'Microphone permission denied or unavailable'
    const user = userEvent.setup()
    render(
      <AIIdeaModal onClose={() => {}} onAdd={() => {}} currentProject={mockProject} currentUser={mockUser} />
    )
    await gotoAudioTab(user)

    expect(await screen.findByText(/Microphone permission denied or unavailable/i)).toBeTruthy()
  })

  it('MM-06 stage indicators upload path: 3-step (Upload, Transcribing, Done)', async () => {
    defaultUploadResolved()
    defaultTranscribeResolved()

    const user = userEvent.setup()
    render(
      <AIIdeaModal onClose={() => {}} onAdd={() => {}} currentProject={mockProject} currentUser={mockUser} />
    )
    await gotoAudioTab(user)

    const file = createAudioFile(1024, 'audio/webm')
    const input = screen.getByLabelText(/Upload audio file/i) as HTMLInputElement
    await user.upload(input, file)

    // After flow completes, the indicator list should not include a "Recording" step
    await waitFor(() => {
      const steps = screen.getByLabelText(/Audio progress/i)
      expect(within(steps).queryByText(/Recording/i)).toBeNull()
      expect(within(steps).getByText(/Uploading/i)).toBeTruthy()
      expect(within(steps).getByText(/Transcribing/i)).toBeTruthy()
      expect(within(steps).getByText(/Done/i)).toBeTruthy()
    })
  })

  it('MM-06 stage indicators record path: 4-step (Recording, Uploading, Transcribing, Done)', async () => {
    mockRecorderState.isRecording = true
    mockRecorderState.elapsedMs = 1000

    const user = userEvent.setup()
    render(
      <AIIdeaModal onClose={() => {}} onAdd={() => {}} currentProject={mockProject} currentUser={mockUser} />
    )
    await gotoAudioTab(user)

    const steps = await screen.findByLabelText(/Audio progress/i)
    expect(within(steps).getByText(/Recording/i)).toBeTruthy()
    expect(within(steps).getByText(/Uploading/i)).toBeTruthy()
    expect(within(steps).getByText(/Transcribing/i)).toBeTruthy()
    expect(within(steps).getByText(/Done/i)).toBeTruthy()
  })

  it('review-then-create: edits title and calls onAdd with custom title', async () => {
    defaultUploadResolved()
    defaultTranscribeResolved()

    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(
      <AIIdeaModal onClose={() => {}} onAdd={onAdd} currentProject={mockProject} currentUser={mockUser} />
    )
    await gotoAudioTab(user)

    const file = createAudioFile(2048, 'audio/webm')
    const input = screen.getByLabelText(/Upload audio file/i) as HTMLInputElement
    await user.upload(input, file)

    const titleInput = (await screen.findByLabelText(/Title/i)) as HTMLInputElement
    await user.clear(titleInput)
    await user.type(titleInput, 'my custom title')

    const createBtn = await screen.findByRole('button', { name: /Create Idea/i })
    await user.click(createBtn)

    expect(onAdd).toHaveBeenCalledTimes(1)
    const payload = onAdd.mock.calls[0][0]
    expect(payload.content).toBe('my custom title')
    expect(payload.details).toMatch(/auto title/)
  })

  it('CSRF + endpoint: fetch called with transcribe-audio + X-CSRF-Token + language en', async () => {
    defaultUploadResolved()
    defaultTranscribeResolved()

    const user = userEvent.setup()
    render(
      <AIIdeaModal onClose={() => {}} onAdd={() => {}} currentProject={mockProject} currentUser={mockUser} />
    )
    await gotoAudioTab(user)

    const file = createAudioFile(2048, 'audio/webm')
    const input = screen.getByLabelText(/Upload audio file/i) as HTMLInputElement
    await user.upload(input, file)

    await waitFor(() => expect((global.fetch as any).mock.calls.length).toBeGreaterThan(0))
    const [url, init] = (global.fetch as any).mock.calls[0]
    expect(String(url)).toContain('transcribe-audio')
    expect(init.method).toBe('POST')
    expect(init.headers['X-CSRF-Token']).toBe('test-csrf-token')
    const body = JSON.parse(init.body)
    expect(body.language).toBe('en')
    expect(body.audioUrl).toBe('https://signed.example/audio.webm')
  })

  it('cleanup on close: closing modal while recording calls recorder.stop', async () => {
    mockRecorderState.isRecording = true

    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <AIIdeaModal onClose={onClose} onAdd={() => {}} currentProject={mockProject} currentUser={mockUser} />
    )
    await gotoAudioTab(user)

    const closeBtn = await screen.findByRole('button', { name: /Close modal/i })
    await user.click(closeBtn)

    expect(mockRecorderState.stop).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
