/**
 * AIInsightsModal — ADR-0014 Step 2 Component Contract Tests
 *
 * T-0014-015: AIInsightsModal renders and calls aiService.generateInsights
 *             (facade mock, NOT legacy aiInsightsService) when modal opens
 *             with ideas.
 * T-0014-016: AIInsightsModal passes preferredModel prop through to
 *             aiService.generateInsights().
 * T-0014-017: AIInsightsModal displays insights report after successful
 *             generation (existing behavior preserved through migration).
 *
 * Pre-build expected state:
 *   FAIL — T-0014-015: component currently imports legacy aiInsightsService,
 *           not the facade. The facade mock is not called.
 *   FAIL — T-0014-016: facade's generateInsights() does not yet accept
 *           preferredModel. Assertion on arg[5] will be undefined.
 *   FAIL — T-0014-017: because the facade mock is not called, no insights
 *           data is returned to the component and the report is never shown.
 *
 * After Colby's Step 2 implementation all three must PASS.
 *
 * Mock strategy:
 * - '../../lib/aiService'            — the FACADE wrapper (post-migration)
 * - '../../lib/ai/aiInsightsService' — the LEGACY service; mocked inline to
 *   prevent real network calls while the component still uses the legacy
 *   import. Mocked with vi.fn() inline (not a const reference) to satisfy
 *   Vitest's vi.mock hoisting requirement.
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import AIInsightsModal from '../AIInsightsModal'
import type { IdeaCard, Project } from '../../types'

// ---------------------------------------------------------------------------
// Mock the FACADE (post-migration import target)
// vi.mock is hoisted — factory must not reference outer const/let bindings.
// We use vi.fn() inline and access it via vi.mocked() after import.
// ---------------------------------------------------------------------------

vi.mock('../../lib/aiService', () => ({
  aiService: {
    generateInsights: vi.fn(),
  },
  default: {
    generateInsights: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Mock the LEGACY service inline — no outer variable reference.
// This suppresses real Supabase network calls while the component still
// imports from the legacy path. The facade assertion is independent: if the
// component still calls the legacy service, the facade mock stays un-called
// and T-0014-015/016 fail correctly.
// ---------------------------------------------------------------------------

vi.mock('../../lib/ai/aiInsightsService', () => ({
  aiInsightsService: {
    generateInsights: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Other side-effect dependencies
// ---------------------------------------------------------------------------

vi.mock('../../lib/fileService', () => ({
  FileService: {
    getProjectFiles: vi.fn(() => Promise.resolve([])),
  },
}))

vi.mock('../../lib/repositories', () => ({
  ProjectRepository: {
    getProjectInsight: vi.fn(() => Promise.resolve(null)),
    saveProjectInsights: vi.fn(() => Promise.resolve('insight-saved-id')),
  },
}))

vi.mock('../../utils/pdfExportSimple', () => ({
  exportInsightsToPDFProfessional: vi.fn(() => Promise.resolve(undefined)),
  exportGraphicalInsightsToPDF: vi.fn(() => Promise.resolve(undefined)),
}))

vi.mock('../../hooks/useAIWorker', () => ({
  useAIWorker: vi.fn(() => ({})),
}))

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('../shared/Modal', () => ({
  BaseModal: ({
    children,
    isOpen,
    onClose,
  }: {
    children: React.ReactNode
    isOpen: boolean
    onClose: () => void
  }) =>
    isOpen ? (
      <div data-testid="ai-insights-modal">
        <button onClick={onClose} data-testid="modal-close">
          Close
        </button>
        {children}
      </div>
    ) : null,
}))

// ---------------------------------------------------------------------------
// Resolve mocked modules — must come AFTER the vi.mock() calls above
// ---------------------------------------------------------------------------

import { aiService } from '../../lib/aiService'
import { aiInsightsService } from '../../lib/ai/aiInsightsService'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sampleProject: Project = {
  id: 'project-abc',
  name: 'Design Matrix App',
  project_type: 'SaaS',
  owner_id: 'user-xyz',
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
}

const sampleIdeas: IdeaCard[] = [
  {
    id: 'idea-1',
    content: 'Collaborative editing',
    details: 'Real-time multi-user editing',
    x: 120,
    y: 80,
    priority: 'high',
    created_by: 'user-xyz',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: 'idea-2',
    content: 'AI model selection UI',
    details: 'Let users pick the AI model per task',
    x: 200,
    y: 160,
    priority: 'strategic',
    created_by: 'user-xyz',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
]

const sampleInsightsReport = {
  executiveSummary: 'Strong product with high user value potential.',
  keyInsights: [
    {
      insight: 'Collaborative features drive retention',
      impact: 'Projected 35% increase in daily active users',
    },
  ],
  priorityRecommendations: {
    immediate: ['Ship collaborative editing MVP'],
    shortTerm: ['Add model selection UI'],
    longTerm: ['Expand AI capabilities'],
  },
  riskAssessment: {
    risks: ['Scaling real-time sync'],
    mitigations: ['Use established CRDT library'],
  },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AIInsightsModal — ADR-0014 Step 2 facade migration', () => {
  const onClose = vi.fn()
  const onInsightSaved = vi.fn()

  const defaultProps = {
    isOpen: true,
    ideas: sampleIdeas,
    currentProject: sampleProject,
    onClose,
    onInsightSaved,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Facade mock: called only after migration; returns the full report.
    vi.mocked(aiService.generateInsights).mockResolvedValue(sampleInsightsReport)
    // Legacy mock: keeps the component functional in its pre-migration state.
    vi.mocked(aiInsightsService.generateInsights).mockResolvedValue(sampleInsightsReport)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it(
    // T-0014-015
    'calls aiService.generateInsights (facade) when modal opens with ideas',
    async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(
        () => {
          expect(vi.mocked(aiService.generateInsights)).toHaveBeenCalledOnce()
        },
        { timeout: 5000 }
      )

      // The call must include the ideas array as the first argument.
      const [calledIdeas] = vi.mocked(aiService.generateInsights).mock.calls[0]
      expect(calledIdeas).toEqual(sampleIdeas)
    }
  )

  it(
    // T-0014-016
    'passes preferredModel prop through to aiService.generateInsights()',
    async () => {
      await act(async () => {
        render(
          <AIInsightsModal {...defaultProps} preferredModel="gpt-5-mini" />
        )
      })

      await waitFor(
        () => {
          expect(vi.mocked(aiService.generateInsights)).toHaveBeenCalledOnce()
        },
        { timeout: 5000 }
      )

      // preferredModel is the 6th positional argument (index 5).
      const callArgs = vi.mocked(aiService.generateInsights).mock.calls[0]
      expect(callArgs[5]).toBe('gpt-5-mini')
    }
  )

  it(
    // T-0014-017
    'displays insights report after successful generation',
    async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(
        () => {
          expect(
            screen.getByText('Strong product with high user value potential.')
          ).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      expect(
        screen.getByText('Collaborative features drive retention')
      ).toBeInTheDocument()
    }
  )
})
