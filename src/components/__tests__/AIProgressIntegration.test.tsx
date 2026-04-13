/**
 * AIProgressIntegration -- ADR-0015 Step 3 Integration Tests
 *
 * Covered test IDs (from ADR-0015 test table):
 *
 *   ProjectRoadmap (ADR Step 5):
 *   T-0015-077  AIProgressOverlay renders during roadmap generation with roadmap stage config
 *   T-0015-078  ProjectRoadmap Cancel button aborts fetch
 *   T-0015-079  ProjectRoadmap fires success toast "Roadmap generated successfully" (3s)
 *   T-0015-080  ProjectRoadmap dispatches `ai-quota-changed` event on successful generation
 *
 *   AIStarterModal (ADR Step 6):
 *   T-0015-092  AIStarterModal renders AIProgressOverlay with batch ideas stage config
 *   T-0015-093  AIStarterModal Cancel button aborts fetch
 *   T-0015-094  AIStarterModal fires success toast "{count} ideas generated" with dynamic count
 *   T-0015-095  AIStarterModal dispatches `ai-quota-changed` on success
 *
 *   AIIdeaModal (ADR Step 6):
 *   T-0015-084  AIIdeaModal renders AIProgressOverlay with text stage config during text idea generation
 *   T-0015-088  AIIdeaModal Cancel button aborts fetch for any input mode
 *   T-0015-089  AIIdeaModal fires success toast "Idea created" (3s) on completion
 *   T-0015-090  AIIdeaModal dispatches `ai-quota-changed` on success
 *
 * Pre-build expected state: ALL FAIL
 *   None of the three modals import useAIGeneration or render AIProgressOverlay
 *   yet. The mocked hook's `isGenerating: true` state is not consumed, so no
 *   overlay is rendered and the cancel/toast/event assertions fail.
 *
 *   A test that passes before Colby builds is suspicious and flagged inline.
 *
 * Mock strategy:
 *   - `../../hooks/useAIGeneration`  mocked globally; tests control isGenerating
 *     and the execute/cancel functions via mutable module-level variables.
 *   - `../../lib/aiService`          mocked to prevent real network calls.
 *   - `../../contexts/ToastContext`  mocked; showSuccess captured for assertions.
 *   - Side-effect mocks (logger, supabase, database) silence stderr noise.
 *
 * NOTE: vi.mock is hoisted by Vitest. Factory functions must not reference outer
 * let/const bindings. Mutable state is read inside vi.fn() closures at call time.
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Mutable mock state — tests write these before rendering to control hook output
// ---------------------------------------------------------------------------

let mockIsGenerating = false
let mockCancel = vi.fn()
let mockExecute = vi.fn()
let mockError: string | null = null
let mockProgress = 0
let mockStage = ''

// ---------------------------------------------------------------------------
// vi.mock stubs (all hoisted to module top by Vitest)
// ---------------------------------------------------------------------------

vi.mock('../../hooks/useAIGeneration', () => ({
  useAIGeneration: () => ({
    isGenerating: mockIsGenerating,
    cancel: mockCancel,
    execute: mockExecute,
    retry: vi.fn(),
    progress: mockProgress,
    stage: mockStage,
    estimatedSecondsRemaining: mockIsGenerating ? 10 : 0,
    processingSteps: ['Analyzing project context', 'Generating ideas', 'Finalizing'],
    stageSequence: ['analyzing', 'generating', 'finalizing'],
    error: mockError,
    quotaExhausted: null,
  }),
}))

vi.mock('../../lib/aiService', () => ({
  aiService: {
    generateProjectIdeas: vi.fn(),
    generateIdea: vi.fn(),
    generateRoadmap: vi.fn(),
  },
}))

const mockShowSuccess = vi.fn()
const mockShowError = vi.fn()
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    showToast: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
  }),
}))

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  useLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: null } })) },
    storage: { from: () => ({ createSignedUrl: vi.fn() }) },
  },
  createAuthenticatedClientFromLocalStorage: () => ({}),
}))

// Database — covers AIStarterModal + ProjectRoadmap methods
vi.mock('../../lib/database', () => ({
  DatabaseService: {
    createProject: vi.fn(() => Promise.resolve({ id: 'project-new', name: 'Created' })),
    createIdea: vi.fn(() => Promise.resolve({ id: 'idea-new', content: 'Created idea' })),
    getProjectRoadmaps: vi.fn(() => Promise.resolve([])),
    saveProjectRoadmap: vi.fn(() => Promise.resolve('roadmap-saved-id')),
    updateProjectRoadmap: vi.fn(() => Promise.resolve()),
  },
}))

vi.mock('../../hooks/useCsrfToken', () => ({
  useCsrfToken: () => ({
    csrfToken: 'test-csrf',
    hasToken: true,
    refreshToken: vi.fn(),
    getCsrfHeaders: () => ({ 'X-CSRF-Token': 'test-csrf' }),
  }),
}))

vi.mock('../../hooks/useBreakpoint', () => ({
  useBreakpoint: () => ({ isMobile: false }),
}))

vi.mock('../../hooks/useAudioRecorder', () => ({
  useAudioRecorder: () => ({
    isRecording: false,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    audioBlob: null,
    audioUrl: null,
    elapsedMs: 0,
    clearRecording: vi.fn(),
  }),
}))

vi.mock('../../lib/fileService', () => ({
  FileService: {
    uploadFile: vi.fn(),
    getProjectFiles: vi.fn(() => Promise.resolve([])),
  },
}))

vi.mock('../../lib/imageResize', () => ({
  resizeImageToFile: vi.fn(async (file: File) => file),
}))

vi.mock('../../lib/video/extractFrames', () => ({
  extractFrames: vi.fn(),
  VIDEO_FRAME_COUNT: 10,
  VideoTooLargeError: class VideoTooLargeError extends Error {},
  VideoTooLongError: class VideoTooLongError extends Error {},
  VideoDecodeError: class VideoDecodeError extends Error {},
  VideoUnsupportedFormatError: class VideoUnsupportedFormatError extends Error {},
}))

// VideoAnalysisProgress is imported by AIStarterModal as './video/VideoAnalysisProgress'
// From __tests__/ that resolves to '../video/VideoAnalysisProgress'
vi.mock('../video/VideoAnalysisProgress', () => ({
  default: () => null,
}))

vi.mock('../RoadmapExportModal', () => ({
  default: () => null,
}))

vi.mock('../TimelineRoadmap', () => ({
  default: () => null,
}))

// analyzeVideo is a named export from '../lib/ai/aiService' (relative to AIStarterModal)
vi.mock('../../lib/ai/aiService', () => ({
  analyzeVideo: vi.fn(),
}))

// AIStarterModal sub-components
vi.mock('../aiStarter', () => ({
  AIStarterHeader: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="ai-starter-header">{children}</div>
  ),
  ProjectBasicsStep: ({
    projectName,
    onProjectNameChange,
    projectDescription,
    onProjectDescriptionChange,
    onNext,
  }: {
    projectName: string
    onProjectNameChange: (v: string) => void
    projectDescription: string
    onProjectDescriptionChange: (v: string) => void
    onNext: () => void
  }) => (
    <div>
      <input
        aria-label="Project name"
        value={projectName}
        onChange={(e) => onProjectNameChange(e.target.value)}
      />
      <input
        aria-label="Project description"
        value={projectDescription}
        onChange={(e) => onProjectDescriptionChange(e.target.value)}
      />
      <button onClick={onNext}>Generate Project Ideas</button>
    </div>
  ),
  ClarifyingQuestionsStep: () => <div data-testid="clarifying-questions" />,
  ProjectReviewStep: () => <div data-testid="project-review" />,
}))

vi.mock('../aiStarter/config/aiStarterUtils', () => ({
  analyzeProjectContext: vi.fn(() => ({
    needsClarification: false,
    clarifyingQuestions: [],
    recommendedProjectType: 'software',
    industry: 'tech',
    timeline: '3 months',
    primaryGoals: ['Build product'],
    reasoning: 'Standard software project',
  })),
  validateAIStarterForm: vi.fn(() => true),
  generateEnhancedDescription: vi.fn((desc: string) => desc),
}))

vi.mock('../aiStarter/config/aiStarterConstants', () => ({
  AI_STARTER_VALIDATION: {
    DEFAULT_IDEA_COUNT: 5,
    DEFAULT_IDEA_TOLERANCE: 2,
  },
  AI_STARTER_MESSAGES: {
    ERROR_ANALYSIS_FAILED: 'Analysis failed. Please try again.',
  },
}))

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const MOCK_PROJECT = {
  id: 'project-1',
  name: 'Alpha Project',
  description: 'A test project',
  project_type: 'software',
  status: 'active',
  priority_level: 'medium',
  visibility: 'private',
  owner_id: 'user-1',
} as const

const MOCK_USER = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
} as const

const MOCK_IDEAS = [
  {
    id: 'idea-1',
    content: 'Auth system',
    details: 'Implement auth',
    x: 100,
    y: 100,
    priority: 'high' as const,
    created_by: 'user-1',
    project_id: 'project-1',
    is_collapsed: false,
    editing_by: null,
    editing_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
]

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function resetMockGenerationState() {
  mockIsGenerating = false
  mockCancel = vi.fn()
  mockExecute = vi.fn()
  mockError = null
  mockProgress = 0
  mockStage = ''
  mockShowSuccess.mockClear()
  mockShowError.mockClear()
}

// ---------------------------------------------------------------------------
// ProjectRoadmap tests
// ---------------------------------------------------------------------------

describe('ProjectRoadmap — AIProgressOverlay integration', () => {
  beforeEach(() => {
    resetMockGenerationState()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('T-0015-077: renders AIProgressOverlay (role=progressbar) when useAIGeneration.isGenerating is true', async () => {
    // Arrange: put hook into generating state before render
    mockIsGenerating = true
    mockProgress = 30
    mockStage = 'analyzing'

    const { default: ProjectRoadmap } = await import('../ProjectRoadmap/ProjectRoadmap')

    render(
      <ProjectRoadmap
        currentUser={MOCK_USER.id}
        currentProject={MOCK_PROJECT as any}
        ideas={MOCK_IDEAS as any}
      />
    )

    // Pre-build FAIL: component does not import useAIGeneration or render
    // AIProgressOverlay, so no progressbar role exists in the DOM.
    expect(screen.getByRole('progressbar', { name: /AI generation progress/i })).toBeInTheDocument()
  })

  it('T-0015-078: Cancel button visible during generation and calls useAIGeneration.cancel', async () => {
    mockIsGenerating = true
    mockProgress = 45
    mockStage = 'generating'

    const { default: ProjectRoadmap } = await import('../ProjectRoadmap/ProjectRoadmap')
    const user = userEvent.setup()

    render(
      <ProjectRoadmap
        currentUser={MOCK_USER.id}
        currentProject={MOCK_PROJECT as any}
        ideas={MOCK_IDEAS as any}
      />
    )

    // Pre-build FAIL: overlay not wired in, cancel button absent.
    const cancelBtn = screen.getByRole('button', { name: /Cancel AI generation/i })
    await user.click(cancelBtn)
    expect(mockCancel).toHaveBeenCalledTimes(1)
  })

  it('T-0015-079: fires success toast "Roadmap generated successfully" when execute resolves', async () => {
    // execute calls the generator fn, which calls aiService.generateRoadmap
    mockExecute = vi.fn(async (fn: (signal: AbortSignal) => Promise<unknown>) => {
      const controller = new AbortController()
      await fn(controller.signal)
    })
    const { aiService } = await import('../../lib/aiService')
    vi.mocked(aiService.generateRoadmap).mockResolvedValue({
      roadmapAnalysis: { phases: [] },
    } as any)

    const { default: ProjectRoadmap } = await import('../ProjectRoadmap/ProjectRoadmap')
    const user = userEvent.setup()

    render(
      <ProjectRoadmap
        currentUser={MOCK_USER.id}
        currentProject={MOCK_PROJECT as any}
        ideas={MOCK_IDEAS as any}
      />
    )

    const generateBtn = screen.getByRole('button', { name: /Generate Roadmap/i })
    await user.click(generateBtn)

    // Pre-build FAIL: component calls aiService.generateRoadmap directly without
    // going through useAIGeneration.execute; toast is never dispatched.
    await waitFor(() => {
      expect(mockShowSuccess).toHaveBeenCalledWith(
        expect.stringMatching(/Roadmap generated successfully/i),
        expect.any(Number)
      )
    })
  })

  it('T-0015-080: dispatches ai-quota-changed CustomEvent on successful roadmap generation', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    mockExecute = vi.fn(async (fn: (signal: AbortSignal) => Promise<unknown>) => {
      const controller = new AbortController()
      await fn(controller.signal)
    })
    const { aiService } = await import('../../lib/aiService')
    vi.mocked(aiService.generateRoadmap).mockResolvedValue({
      roadmapAnalysis: { phases: [] },
    } as any)

    const { default: ProjectRoadmap } = await import('../ProjectRoadmap/ProjectRoadmap')
    const user = userEvent.setup()

    render(
      <ProjectRoadmap
        currentUser={MOCK_USER.id}
        currentProject={MOCK_PROJECT as any}
        ideas={MOCK_IDEAS as any}
      />
    )

    const generateBtn = screen.getByRole('button', { name: /Generate Roadmap/i })
    await user.click(generateBtn)

    // Pre-build FAIL: no CustomEvent dispatch in current implementation.
    await waitFor(() => {
      const calls = dispatchSpy.mock.calls
      const quotaEvent = calls.find(
        ([evt]) => evt instanceof CustomEvent && evt.type === 'ai-quota-changed'
      )
      expect(quotaEvent).toBeDefined()
    })
  })
})

// ---------------------------------------------------------------------------
// AIStarterModal tests
// ---------------------------------------------------------------------------

describe('AIStarterModal — AIProgressOverlay integration', () => {
  beforeEach(() => {
    resetMockGenerationState()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('T-0015-092: renders AIProgressOverlay (role=progressbar) when useAIGeneration.isGenerating is true', async () => {
    mockIsGenerating = true
    mockProgress = 20
    mockStage = 'analyzing'

    const { default: AIStarterModal } = await import('../AIStarterModal')

    render(
      <AIStarterModal
        currentUser={MOCK_USER as any}
        onClose={vi.fn()}
        onProjectCreated={vi.fn()}
      />
    )

    // Pre-build FAIL: modal does not render AIProgressOverlay.
    expect(screen.getByRole('progressbar', { name: /AI generation progress/i })).toBeInTheDocument()
  })

  it('T-0015-093: Cancel button visible during generation and calls useAIGeneration.cancel', async () => {
    mockIsGenerating = true
    mockProgress = 35
    mockStage = 'generating'

    const { default: AIStarterModal } = await import('../AIStarterModal')
    const user = userEvent.setup()

    render(
      <AIStarterModal
        currentUser={MOCK_USER as any}
        onClose={vi.fn()}
        onProjectCreated={vi.fn()}
      />
    )

    // Pre-build FAIL: overlay not wired in; cancel button absent.
    const cancelBtn = screen.getByRole('button', { name: /Cancel AI generation/i })
    await user.click(cancelBtn)
    expect(mockCancel).toHaveBeenCalledTimes(1)
  })

  it('T-0015-094: fires success toast with dynamic idea count on generation completion', async () => {
    const generatedIdeas = [
      { content: 'Idea A', details: '', x: 100, y: 100, priority: 'high' },
      { content: 'Idea B', details: '', x: 200, y: 200, priority: 'medium' },
      { content: 'Idea C', details: '', x: 300, y: 300, priority: 'low' },
    ]
    const { aiService } = await import('../../lib/aiService')
    vi.mocked(aiService.generateProjectIdeas).mockResolvedValue(generatedIdeas as any)

    mockExecute = vi.fn(async (fn: (signal: AbortSignal) => Promise<unknown>) => {
      const controller = new AbortController()
      await fn(controller.signal)
    })

    const { default: AIStarterModal } = await import('../AIStarterModal')
    const user = userEvent.setup()

    render(
      <AIStarterModal
        currentUser={MOCK_USER as any}
        onClose={vi.fn()}
        onProjectCreated={vi.fn()}
      />
    )

    const nameInput = screen.getByRole('textbox', { name: /Project name/i })
    const descInput = screen.getByRole('textbox', { name: /Project description/i })
    await user.type(nameInput, 'My Project')
    await user.type(descInput, 'A great project')

    const nextBtn = screen.getByRole('button', { name: /Generate Project Ideas/i })
    await user.click(nextBtn)

    // Pre-build FAIL: modal calls aiService.generateProjectIdeas directly;
    // toast is not dispatched via useAIGeneration lifecycle.
    await waitFor(() => {
      expect(mockShowSuccess).toHaveBeenCalledWith(
        expect.stringMatching(/3 ideas generated/i),
        expect.any(Number)
      )
    })
  })

  it('T-0015-095: dispatches ai-quota-changed CustomEvent on successful batch generation', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const { aiService } = await import('../../lib/aiService')
    vi.mocked(aiService.generateProjectIdeas).mockResolvedValue([
      { content: 'Idea A', details: '', x: 100, y: 100, priority: 'high' },
    ] as any)

    mockExecute = vi.fn(async (fn: (signal: AbortSignal) => Promise<unknown>) => {
      const controller = new AbortController()
      await fn(controller.signal)
    })

    const { default: AIStarterModal } = await import('../AIStarterModal')
    const user = userEvent.setup()

    render(
      <AIStarterModal
        currentUser={MOCK_USER as any}
        onClose={vi.fn()}
        onProjectCreated={vi.fn()}
      />
    )

    const nameInput = screen.getByRole('textbox', { name: /Project name/i })
    const descInput = screen.getByRole('textbox', { name: /Project description/i })
    await user.type(nameInput, 'My Project')
    await user.type(descInput, 'A great project')

    const nextBtn = screen.getByRole('button', { name: /Generate Project Ideas/i })
    await user.click(nextBtn)

    // Pre-build FAIL: no CustomEvent dispatch in current AIStarterModal.
    await waitFor(() => {
      const calls = dispatchSpy.mock.calls
      const quotaEvent = calls.find(
        ([evt]) => evt instanceof CustomEvent && evt.type === 'ai-quota-changed'
      )
      expect(quotaEvent).toBeDefined()
    })
  })
})

// ---------------------------------------------------------------------------
// AIIdeaModal tests
// ---------------------------------------------------------------------------

describe('AIIdeaModal — AIProgressOverlay integration', () => {
  beforeEach(() => {
    resetMockGenerationState()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('T-0015-084: renders AIProgressOverlay (role=progressbar) during text idea generation', async () => {
    // Arrange: hook reports active generation
    mockIsGenerating = true
    mockProgress = 25
    mockStage = 'analyzing'

    const { default: AIIdeaModal } = await import('../AIIdeaModal')

    render(
      <AIIdeaModal
        onClose={vi.fn()}
        onAdd={vi.fn()}
        currentProject={MOCK_PROJECT as any}
        currentUser={MOCK_USER as any}
      />
    )

    // Pre-build FAIL: modal does not render AIProgressOverlay.
    expect(screen.getByRole('progressbar', { name: /AI generation progress/i })).toBeInTheDocument()
  })

  it('T-0015-088: Cancel button visible during generation and calls useAIGeneration.cancel', async () => {
    mockIsGenerating = true
    mockProgress = 50
    mockStage = 'generating'

    const { default: AIIdeaModal } = await import('../AIIdeaModal')
    const user = userEvent.setup()

    render(
      <AIIdeaModal
        onClose={vi.fn()}
        onAdd={vi.fn()}
        currentProject={MOCK_PROJECT as any}
        currentUser={MOCK_USER as any}
      />
    )

    // Pre-build FAIL: overlay not wired in; cancel button absent.
    const cancelBtn = screen.getByRole('button', { name: /Cancel AI generation/i })
    await user.click(cancelBtn)
    expect(mockCancel).toHaveBeenCalledTimes(1)
  })

  it('T-0015-089: fires success toast "Idea created" (3s) when generation completes', async () => {
    const { aiService } = await import('../../lib/aiService')
    vi.mocked(aiService.generateIdea).mockResolvedValue({
      content: 'Generated idea content',
      details: 'Detailed description',
      priority: 'high' as const,
    })

    mockExecute = vi.fn(async (fn: (signal: AbortSignal) => Promise<unknown>) => {
      const controller = new AbortController()
      await fn(controller.signal)
    })

    const { default: AIIdeaModal } = await import('../AIIdeaModal')
    const user = userEvent.setup()

    render(
      <AIIdeaModal
        onClose={vi.fn()}
        onAdd={vi.fn()}
        currentProject={MOCK_PROJECT as any}
        currentUser={MOCK_USER as any}
      />
    )

    const titleInput = screen.getByPlaceholderText(/Enter a brief title for your idea/i)
    await user.type(titleInput, 'My new idea')

    const generateBtn = screen.getByRole('button', { name: /Generate AI Ideas/i })
    await user.click(generateBtn)

    // Pre-build FAIL: modal calls aiService.generateIdea directly without
    // useAIGeneration; success toast never dispatched.
    await waitFor(() => {
      expect(mockShowSuccess).toHaveBeenCalledWith(
        expect.stringMatching(/Idea created/i),
        3000
      )
    })
  })

  it('T-0015-090: dispatches ai-quota-changed CustomEvent on successful idea generation', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const { aiService } = await import('../../lib/aiService')
    vi.mocked(aiService.generateIdea).mockResolvedValue({
      content: 'Generated idea',
      details: 'Details',
      priority: 'moderate' as const,
    })

    mockExecute = vi.fn(async (fn: (signal: AbortSignal) => Promise<unknown>) => {
      const controller = new AbortController()
      await fn(controller.signal)
    })

    const { default: AIIdeaModal } = await import('../AIIdeaModal')
    const user = userEvent.setup()

    render(
      <AIIdeaModal
        onClose={vi.fn()}
        onAdd={vi.fn()}
        currentProject={MOCK_PROJECT as any}
        currentUser={MOCK_USER as any}
      />
    )

    const titleInput = screen.getByPlaceholderText(/Enter a brief title for your idea/i)
    await user.type(titleInput, 'Another idea')

    const generateBtn = screen.getByRole('button', { name: /Generate AI Ideas/i })
    await user.click(generateBtn)

    // Pre-build FAIL: no CustomEvent dispatch in current AIIdeaModal.
    await waitFor(() => {
      const calls = dispatchSpy.mock.calls
      const quotaEvent = calls.find(
        ([evt]) => evt instanceof CustomEvent && evt.type === 'ai-quota-changed'
      )
      expect(quotaEvent).toBeDefined()
    })
  })
})
