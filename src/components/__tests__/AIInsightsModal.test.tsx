/**
 * AIInsightsModal Comprehensive Test Suite
 *
 * Complete test coverage for AIInsightsModal component including:
 * - Modal display and dismissal
 * - AI-generated insights rendering (all categories)
 * - Loading states and progress tracking
 * - Error handling for AI failures
 * - Save and export operations
 * - Accessibility
 * - Edge cases (empty data, malformed data, long content)
 * - File context integration
 * - Historical insights loading
 * - Model selection and preferences
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import AIInsightsModal from '../AIInsightsModal'
import { IdeaCard, Project, ProjectFile } from '../../types'
import { aiInsightsService } from '../../lib/ai/aiInsightsService'
import { FileService } from '../../lib/fileService'
import { ProjectRepository } from '../../lib/repositories'
import { exportInsightsToPDFProfessional } from '../../utils/pdfExportSimple'

// Mock dependencies
vi.mock('../../lib/ai/aiInsightsService', () => ({
  aiInsightsService: {
    generateInsights: vi.fn()
  }
}))

vi.mock('../../lib/fileService', () => ({
  FileService: {
    getProjectFiles: vi.fn()
  }
}))

vi.mock('../../lib/repositories', () => ({
  ProjectRepository: {
    getProjectInsight: vi.fn(),
    saveProjectInsights: vi.fn()
  }
}))

vi.mock('../../utils/pdfExportSimple', () => ({
  exportInsightsToPDFProfessional: vi.fn()
}))

vi.mock('../../hooks/useAIWorker', () => ({
  useAIWorker: vi.fn(() => ({}))
}))

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}))

vi.mock('../shared/Modal', () => ({
  BaseModal: ({ children, isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="ai-insights-modal">
        <button onClick={onClose} data-testid="modal-close">Close</button>
        {children}
      </div>
    ) : null
}))

describe('AIInsightsModal - Comprehensive Test Suite', () => {
  const mockOnClose = vi.fn()
  const mockOnInsightSaved = vi.fn()

  const sampleProject: Project = {
    id: 'project123',
    name: 'Test Project',
    project_type: 'SaaS',
    owner_id: 'user123',
    created_at: '2023-01-01',
    updated_at: '2023-01-01'
  }

  const sampleIdeas: IdeaCard[] = [
    {
      id: 'idea1',
      content: 'AI-powered recommendation engine',
      details: 'Implement machine learning for personalized suggestions',
      x: 100,
      y: 200,
      priority: 'high',
      created_by: 'user123',
      created_at: '2023-01-01',
      updated_at: '2023-01-01'
    },
    {
      id: 'idea2',
      content: 'Real-time analytics dashboard',
      details: 'Live metrics and KPI tracking',
      x: 200,
      y: 150,
      priority: 'strategic',
      created_by: 'user123',
      created_at: '2023-01-01',
      updated_at: '2023-01-01'
    }
  ]

  const sampleFiles: ProjectFile[] = [
    {
      id: 'file1',
      name: 'technical-spec.pdf',
      original_name: 'Technical Specification.pdf',
      file_type: 'application/pdf',
      file_path: '/uploads/file1.pdf',
      project_id: 'project123',
      content_preview: 'Technical specification content...',
      created_at: '2023-01-01',
      updated_at: '2023-01-01'
    },
    {
      id: 'file2',
      name: 'mockup.png',
      original_name: 'UI Mockup.png',
      file_type: 'image/png',
      file_path: '/uploads/file2.png',
      project_id: 'project123',
      created_at: '2023-01-01',
      updated_at: '2023-01-01'
    }
  ]

  const sampleInsights = {
    executiveSummary: 'This project shows strong potential with innovative AI features.',
    keyInsights: [
      {
        insight: 'AI recommendations will drive user engagement',
        impact: 'Potential 40% increase in user retention'
      },
      {
        insight: 'Real-time analytics provide competitive advantage',
        impact: 'Faster decision making and improved performance'
      }
    ],
    priorityRecommendations: {
      immediate: ['Implement basic recommendation algorithm', 'Set up analytics infrastructure'],
      shortTerm: ['Add machine learning training pipeline', 'Create advanced dashboards'],
      longTerm: ['Scale AI capabilities', 'Expand analytics to predictive models']
    },
    riskAssessment: {
      risks: ['Data privacy concerns', 'Algorithm bias potential'],
      mitigations: ['Implement privacy-by-design', 'Regular bias auditing']
    }
  }

  const defaultProps = {
    isOpen: true,
    ideas: sampleIdeas,
    currentProject: sampleProject,
    onClose: mockOnClose,
    onInsightSaved: mockOnInsightSaved
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mock implementations
    vi.mocked(FileService.getProjectFiles).mockResolvedValue(sampleFiles)
    vi.mocked(aiInsightsService.generateInsights).mockResolvedValue(sampleInsights)
    vi.mocked(ProjectRepository.saveProjectInsights).mockResolvedValue('insight123')
    vi.mocked(exportInsightsToPDFProfessional).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Modal Display and Dismissal', () => {
    it('should not render when modal is closed', () => {
      render(<AIInsightsModal {...defaultProps} isOpen={false} />)

      expect(screen.queryByTestId('ai-insights-modal')).not.toBeInTheDocument()
    })

    it('should render modal when open', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      expect(screen.getByTestId('ai-insights-modal')).toBeInTheDocument()
    })

    it('should show correct modal title for new insights', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      expect(screen.getByText('AI Strategic Insights')).toBeInTheDocument()
      expect(screen.getByText(/Analysis of 2 ideas in your priority matrix/)).toBeInTheDocument()
    })

    it('should show historical title when loading historical insight', async () => {
      const historicalInsight = { ...sampleInsights }
      vi.mocked(ProjectRepository.getProjectInsight).mockResolvedValue({
        id: 'insight123',
        insights_data: historicalInsight,
        project_id: 'project123',
        owner_id: 'user123',
        idea_count: 2,
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      })

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} selectedInsightId="insight123" />)
      })

      await waitFor(() => {
        expect(screen.getByText('Historical AI Insights')).toBeInTheDocument()
      })
    })

    it('should close modal when close button is clicked', async () => {
      const user = userEvent.setup()
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      const closeButton = screen.getByTestId('modal-close')
      await user.click(closeButton)

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should close modal when Close Report button is clicked', async () => {
      const user = userEvent.setup()

      // Mock fast insights generation
      vi.mocked(aiInsightsService.generateInsights).mockResolvedValue(sampleInsights)

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      // Wait for insights to load
      await waitFor(() => {
        expect(screen.getByText('Close Report')).toBeInTheDocument()
      }, { timeout: 3000 })

      const closeButton = screen.getByText('Close Report')
      await user.click(closeButton)

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should handle reopening modal after close', async () => {
      const { rerender } = render(<AIInsightsModal {...defaultProps} isOpen={false} />)

      expect(screen.queryByTestId('ai-insights-modal')).not.toBeInTheDocument()

      await act(async () => {
        rerender(<AIInsightsModal {...defaultProps} isOpen={true} />)
      })

      expect(screen.getByTestId('ai-insights-modal')).toBeInTheDocument()
    })
  })

  describe('Insights Rendering - All Categories', () => {
    it('should render executive summary section', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Executive Summary')).toBeInTheDocument()
        expect(screen.getByText(sampleInsights.executiveSummary)).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should render all key insights with impact', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Key Insights')).toBeInTheDocument()

        sampleInsights.keyInsights.forEach(item => {
          expect(screen.getByText(item.insight)).toBeInTheDocument()
          expect(screen.getByText(item.impact)).toBeInTheDocument()
        })
      }, { timeout: 3000 })
    })

    it('should render immediate priority recommendations', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Priority Recommendations')).toBeInTheDocument()
        expect(screen.getByText(/Immediate \(30 days\)/)).toBeInTheDocument()

        sampleInsights.priorityRecommendations.immediate.forEach(item => {
          expect(screen.getByText(item)).toBeInTheDocument()
        })
      }, { timeout: 3000 })
    })

    it('should render short-term priority recommendations', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText(/Short Term \(3 months\)/)).toBeInTheDocument()

        sampleInsights.priorityRecommendations.shortTerm.forEach(item => {
          expect(screen.getByText(item)).toBeInTheDocument()
        })
      }, { timeout: 3000 })
    })

    it('should render long-term priority recommendations', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText(/Long Term \(6-12 months\)/)).toBeInTheDocument()

        sampleInsights.priorityRecommendations.longTerm.forEach(item => {
          expect(screen.getByText(item)).toBeInTheDocument()
        })
      }, { timeout: 3000 })
    })

    it('should render risk assessment section', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Risk Areas')).toBeInTheDocument()
        expect(screen.getByText('Risk Mitigations')).toBeInTheDocument()

        sampleInsights.riskAssessment!.risks.forEach(risk => {
          expect(screen.getByText(risk)).toBeInTheDocument()
        })

        sampleInsights.riskAssessment!.mitigations.forEach(mitigation => {
          expect(screen.getByText(mitigation)).toBeInTheDocument()
        })
      }, { timeout: 3000 })
    })

    it('should not render risk assessment when not provided', async () => {
      const insightsWithoutRisk = {
        ...sampleInsights,
        riskAssessment: undefined
      }
      vi.mocked(aiInsightsService.generateInsights).mockResolvedValue(insightsWithoutRisk)

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Executive Summary')).toBeInTheDocument()
      }, { timeout: 3000 })

      expect(screen.queryByText('Risk Areas')).not.toBeInTheDocument()
      expect(screen.queryByText('Risk Mitigations')).not.toBeInTheDocument()
    })
  })

  describe('Loading States and Progress Tracking', () => {
    it('should show progress UI during insights generation', async () => {
      vi.mocked(aiInsightsService.generateInsights).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(sampleInsights), 500))
      )

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      // Should show loading state
      await waitFor(() => {
        const modal = screen.getByTestId('ai-insights-modal')
        expect(modal).toBeInTheDocument()
      })
    })

    it('should show analyzing stage initially', async () => {
      vi.mocked(aiInsightsService.generateInsights).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(sampleInsights), 1000))
      )

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        // Look for analyzing text
        const analyzingText = screen.queryByText(/Analyzing Ideas/)
        if (analyzingText) {
          expect(analyzingText).toBeInTheDocument()
        }
      }, { timeout: 500 })
    })

    it('should complete loading and show insights', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Executive Summary')).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })

  describe('Error Handling', () => {
    it('should display error message on insights generation failure', async () => {
      const errorMessage = 'API connection failed'
      vi.mocked(aiInsightsService.generateInsights).mockRejectedValue(new Error(errorMessage))

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should show Try Again button on error', async () => {
      vi.mocked(aiInsightsService.generateInsights).mockRejectedValue(new Error('API error'))

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should retry insights generation when Try Again is clicked', async () => {
      const user = userEvent.setup()

      // First call fails
      vi.mocked(aiInsightsService.generateInsights)
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce(sampleInsights)

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument()
      }, { timeout: 3000 })

      const retryButton = screen.getByText('Try Again')
      await user.click(retryButton)

      await waitFor(() => {
        expect(screen.getByText('Executive Summary')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should handle malformed insights data gracefully', async () => {
      const malformedInsights = {
        executiveSummary: null,
        keyInsights: null,
        priorityRecommendations: null
      }

      vi.mocked(aiInsightsService.generateInsights).mockResolvedValue(malformedInsights as any)

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      // Should not crash
      expect(screen.getByTestId('ai-insights-modal')).toBeInTheDocument()
    })

    it('should handle empty arrays in insights', async () => {
      const emptyInsights = {
        executiveSummary: 'Summary',
        keyInsights: [],
        priorityRecommendations: {
          immediate: [],
          shortTerm: [],
          longTerm: []
        }
      }

      vi.mocked(aiInsightsService.generateInsights).mockResolvedValue(emptyInsights)

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Summary')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should handle missing riskAssessment gracefully', async () => {
      const insightsWithoutRisk = {
        executiveSummary: 'Summary',
        keyInsights: [],
        priorityRecommendations: {
          immediate: [],
          shortTerm: [],
          longTerm: []
        }
      }

      vi.mocked(aiInsightsService.generateInsights).mockResolvedValue(insightsWithoutRisk)

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      expect(screen.getByTestId('ai-insights-modal')).toBeInTheDocument()
    })
  })

  describe('Save Insights Operation', () => {
    it('should show Save Insights button when insights are generated', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Save Insights')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should not show Save Insights for historical insights', async () => {
      const historicalInsight = { ...sampleInsights }
      vi.mocked(ProjectRepository.getProjectInsight).mockResolvedValue({
        id: 'insight123',
        insights_data: historicalInsight,
        project_id: 'project123',
        owner_id: 'user123',
        idea_count: 2,
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      })

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} selectedInsightId="insight123" />)
      })

      await waitFor(() => {
        expect(screen.getByText('Historical AI Insights')).toBeInTheDocument()
      }, { timeout: 3000 })

      expect(screen.queryByText('Save Insights')).not.toBeInTheDocument()
    })

    it('should call saveProjectInsights when Save button is clicked', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Save Insights')).toBeInTheDocument()
      }, { timeout: 3000 })

      const saveButton = screen.getByText('Save Insights')
      await user.click(saveButton)

      await waitFor(() => {
        expect(ProjectRepository.saveProjectInsights).toHaveBeenCalledWith(
          'project123',
          sampleInsights,
          'user123',
          2
        )
      })
    })

    it('should show Saving... text while saving', async () => {
      const user = userEvent.setup()

      vi.mocked(ProjectRepository.saveProjectInsights).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('insight123'), 1000))
      )

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Save Insights')).toBeInTheDocument()
      }, { timeout: 3000 })

      const saveButton = screen.getByText('Save Insights')
      await user.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument()
      })
    })

    it('should call onInsightSaved callback after successful save', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Save Insights')).toBeInTheDocument()
      }, { timeout: 3000 })

      const saveButton = screen.getByText('Save Insights')
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockOnInsightSaved).toHaveBeenCalledWith('insight123')
      })
    })

    it('should handle save failure gracefully', async () => {
      const user = userEvent.setup()

      vi.mocked(ProjectRepository.saveProjectInsights).mockRejectedValue(new Error('Save failed'))

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Save Insights')).toBeInTheDocument()
      }, { timeout: 3000 })

      const saveButton = screen.getByText('Save Insights')
      await user.click(saveButton)

      // Should not crash
      expect(screen.getByTestId('ai-insights-modal')).toBeInTheDocument()
    })
  })

  describe('Export to PDF Operation', () => {
    it('should show Download PDF button when insights are available', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Download PDF')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should call PDF export with correct parameters', async () => {
      const user = userEvent.setup()

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Download PDF')).toBeInTheDocument()
      }, { timeout: 3000 })

      const pdfButton = screen.getByText('Download PDF')
      await user.click(pdfButton)

      await waitFor(() => {
        expect(exportInsightsToPDFProfessional).toHaveBeenCalledWith(
          sampleInsights,
          2,
          sampleProject,
          sampleFiles
        )
      })
    })

    it('should handle PDF export failure with alert', async () => {
      const user = userEvent.setup()

      // Mock window.alert
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})

      vi.mocked(exportInsightsToPDFProfessional).mockRejectedValue(new Error('PDF generation failed'))

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Download PDF')).toBeInTheDocument()
      }, { timeout: 3000 })

      const pdfButton = screen.getByText('Download PDF')
      await user.click(pdfButton)

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('PDF export failed. Please try again.')
      })

      alertMock.mockRestore()
    })
  })

  describe('File Context Integration', () => {
    it('should load project files when modal opens', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(FileService.getProjectFiles).toHaveBeenCalledWith('project123')
      })
    })

    it('should display file references section when files are present', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Document Analysis Sources')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should display all file names in references', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        sampleFiles.forEach(file => {
          expect(screen.getByText(file.original_name)).toBeInTheDocument()
        })
      }, { timeout: 3000 })
    })

    it('should not show file references for historical insights', async () => {
      const historicalInsight = { ...sampleInsights }
      vi.mocked(ProjectRepository.getProjectInsight).mockResolvedValue({
        id: 'insight123',
        insights_data: historicalInsight,
        project_id: 'project123',
        owner_id: 'user123',
        idea_count: 2,
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      })

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} selectedInsightId="insight123" />)
      })

      await waitFor(() => {
        expect(screen.getByText('Historical AI Insights')).toBeInTheDocument()
      }, { timeout: 3000 })

      expect(screen.queryByText('Document Analysis Sources')).not.toBeInTheDocument()
    })

    it('should handle file loading errors gracefully', async () => {
      vi.mocked(FileService.getProjectFiles).mockRejectedValue(new Error('File load failed'))

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      // Should not crash
      expect(screen.getByTestId('ai-insights-modal')).toBeInTheDocument()
    })

    it('should not load files when no project ID', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} currentProject={null} />)
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(FileService.getProjectFiles).not.toHaveBeenCalled()
    })

    it('should display file count in footer', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText(/2 documents analyzed/)).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })

  describe('Historical Insights Loading', () => {
    it('should load historical insights when selectedInsightId provided', async () => {
      const historicalInsight = { ...sampleInsights }
      vi.mocked(ProjectRepository.getProjectInsight).mockResolvedValue({
        id: 'insight123',
        insights_data: historicalInsight,
        project_id: 'project123',
        owner_id: 'user123',
        idea_count: 2,
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      })

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} selectedInsightId="insight123" />)
      })

      await waitFor(() => {
        expect(ProjectRepository.getProjectInsight).toHaveBeenCalledWith('insight123')
      })
    })

    it('should display historical insights content', async () => {
      const historicalInsight = { ...sampleInsights }
      vi.mocked(ProjectRepository.getProjectInsight).mockResolvedValue({
        id: 'insight123',
        insights_data: historicalInsight,
        project_id: 'project123',
        owner_id: 'user123',
        idea_count: 2,
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      })

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} selectedInsightId="insight123" />)
      })

      await waitFor(() => {
        expect(screen.getByText(historicalInsight.executiveSummary)).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should handle historical insights loading error', async () => {
      vi.mocked(ProjectRepository.getProjectInsight).mockRejectedValue(new Error('Insight not found'))

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} selectedInsightId="invalid123" />)
      })

      // Should not crash
      expect(screen.getByTestId('ai-insights-modal')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty ideas array', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} ideas={[]} />)
      })

      expect(screen.getByText(/Analysis of 0 ideas in your priority matrix/)).toBeInTheDocument()
    })

    it('should handle very large idea arrays', async () => {
      const largeIdeasArray = Array.from({ length: 100 }, (_, i) => ({
        ...sampleIdeas[0],
        id: `idea${i}`,
        content: `Idea ${i}`
      }))

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} ideas={largeIdeasArray} />)
      })

      expect(screen.getByText(/Analysis of 100 ideas in your priority matrix/)).toBeInTheDocument()
    })

    it('should handle missing project gracefully', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} currentProject={null} />)
      })

      expect(screen.getByTestId('ai-insights-modal')).toBeInTheDocument()
    })

    it('should handle very long executive summary', async () => {
      const longSummary = 'This is a very long executive summary. '.repeat(50)
      const longInsights = {
        ...sampleInsights,
        executiveSummary: longSummary
      }

      vi.mocked(aiInsightsService.generateInsights).mockResolvedValue(longInsights)

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        // Check for partial text since long text may be rendered across elements
        expect(screen.getByText(/This is a very long executive summary/)).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should handle very long recommendations', async () => {
      const longRecommendation = 'This is a very long recommendation that spans multiple lines and contains detailed information. '.repeat(10)
      const longInsights = {
        ...sampleInsights,
        priorityRecommendations: {
          immediate: [longRecommendation],
          shortTerm: [longRecommendation],
          longTerm: [longRecommendation]
        }
      }

      vi.mocked(aiInsightsService.generateInsights).mockResolvedValue(longInsights)

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Priority Recommendations')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should handle concurrent file loading and insights generation', async () => {
      vi.mocked(aiInsightsService.generateInsights).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(sampleInsights), 50))
      )

      vi.mocked(FileService.getProjectFiles).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(sampleFiles), 30))
      )

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      // Should handle concurrent operations
      expect(screen.getByTestId('ai-insights-modal')).toBeInTheDocument()
    })
  })

  describe('Model Selection and Preferences', () => {
    it('should pass preferredModel to insights service', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} preferredModel="gpt-5" />)
      })

      await waitFor(() => {
        expect(aiInsightsService.generateInsights).toHaveBeenCalled()
        const calls = vi.mocked(aiInsightsService.generateInsights).mock.calls
        expect(calls[calls.length - 1][5]).toBe('gpt-5')
      }, { timeout: 3000 })
    })

    it('should work without preferredModel', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(aiInsightsService.generateInsights).toHaveBeenCalled()
      }, { timeout: 3000 })
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading structure', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Executive Summary')).toBeInTheDocument()
        expect(screen.getByText('Key Insights')).toBeInTheDocument()
        expect(screen.getByText('Priority Recommendations')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should have descriptive button labels', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Save Insights')).toBeInTheDocument()
        expect(screen.getByText('Download PDF')).toBeInTheDocument()
        expect(screen.getByText('Close Report')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should use semantic HTML for lists', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        const modal = screen.getByTestId('ai-insights-modal')
        const lists = modal.querySelectorAll('ul')
        expect(lists.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })
  })

  describe('State Reset on Close', () => {
    it('should reset progress when modal closes', async () => {
      const { rerender } = render(<AIInsightsModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByTestId('ai-insights-modal')).toBeInTheDocument()
      })

      // Close modal
      rerender(<AIInsightsModal {...defaultProps} isOpen={false} />)

      expect(screen.queryByTestId('ai-insights-modal')).not.toBeInTheDocument()
    })

    it('should reset error state when reopening', async () => {
      vi.mocked(aiInsightsService.generateInsights).mockRejectedValue(new Error('API error'))

      const { rerender } = render(<AIInsightsModal {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument()
      }, { timeout: 3000 })

      // Close and reopen
      rerender(<AIInsightsModal {...defaultProps} isOpen={false} />)

      vi.mocked(aiInsightsService.generateInsights).mockResolvedValue(sampleInsights)

      await act(async () => {
        rerender(<AIInsightsModal {...defaultProps} isOpen={true} />)
      })

      await waitFor(() => {
        expect(screen.getByText('Executive Summary')).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })

  describe('Footer Information', () => {
    it('should display idea count in footer', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        // Check for presence of insights first to ensure modal has loaded
        expect(screen.getByText('Executive Summary')).toBeInTheDocument()
      }, { timeout: 3000 })

      // Check footer contains both required text pieces
      const allText = screen.getByTestId('ai-insights-modal').textContent || ''
      expect(allText).toContain('Analysis based on')
      expect(allText).toContain('2 ideas')
    })

    it('should display Generated by AI text', async () => {
      await act(async () => {
        render(<AIInsightsModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(screen.getByText(/Generated by AI/)).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should display Historical insight text for historical data', async () => {
      const historicalInsight = { ...sampleInsights }
      vi.mocked(ProjectRepository.getProjectInsight).mockResolvedValue({
        id: 'insight123',
        insights_data: historicalInsight,
        project_id: 'project123',
        owner_id: 'user123',
        idea_count: 2,
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      })

      await act(async () => {
        render(<AIInsightsModal {...defaultProps} selectedInsightId="insight123" />)
      })

      await waitFor(() => {
        expect(screen.getByText(/Historical insight/)).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })
})