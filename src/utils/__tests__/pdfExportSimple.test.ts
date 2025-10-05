import { describe, it, expect, beforeEach, vi } from 'vitest'
import { exportRoadmapToPDF, exportInsightsToPDF } from '../pdfExportSimple'
import { RoadmapData, Project } from '../../types'

// Mock jsPDF
const mockSave = vi.fn()
const mockAddPage = vi.fn()
const mockText = vi.fn()
const mockSetFontSize = vi.fn()
const mockSetFont = vi.fn()
const mockSetTextColor = vi.fn()
const mockSetFillColor = vi.fn()
const mockSetDrawColor = vi.fn()
const mockSetLineWidth = vi.fn()
const mockRect = vi.fn()
const mockLine = vi.fn()
const mockCircle = vi.fn()
const mockSplitTextToSize = vi.fn((text: string) => [text])
const mockGetTextWidth = vi.fn(() => 50)
const mockAddImage = vi.fn()
const mockGetNumberOfPages = vi.fn(() => 1)
const mockSetPage = vi.fn()

vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    internal: {
      pageSize: {
        getWidth: () => 841.89, // A4 landscape width in points
        getHeight: () => 595.28 // A4 landscape height in points
      }
    },
    save: mockSave,
    addPage: mockAddPage,
    text: mockText,
    setFontSize: mockSetFontSize,
    setFont: mockSetFont,
    setTextColor: mockSetTextColor,
    setFillColor: mockSetFillColor,
    setDrawColor: mockSetDrawColor,
    setLineWidth: mockSetLineWidth,
    rect: mockRect,
    line: mockLine,
    circle: mockCircle,
    splitTextToSize: mockSplitTextToSize,
    getTextWidth: mockGetTextWidth,
    addImage: mockAddImage,
    getNumberOfPages: mockGetNumberOfPages,
    setPage: mockSetPage
  }))
}))

describe('pdfExportSimple', () => {
  let mockProject: Project
  let mockRoadmapData: RoadmapData
  let mockInsights: any

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Mock alert
    global.alert = vi.fn()

    mockProject = {
      id: 'project-1',
      name: 'Test Project',
      description: 'A test project for PDF export',
      project_type: 'Software',
      status: 'active',
      owner_id: 'user-1',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z'
    }

    mockRoadmapData = {
      roadmapAnalysis: {
        totalDuration: '6 months',
        phases: [
          {
            phase: 'Foundation Phase',
            duration: '2 months',
            description: 'Initial setup and foundation',
            epics: [
              {
                title: 'Authentication System',
                description: 'Implement secure authentication',
                priority: 'high',
                complexity: 'medium',
                userStories: ['As a user, I want to login securely'],
                deliverables: ['OAuth integration', '2FA setup'],
                relatedIdeas: ['SSO integration']
              }
            ],
            risks: ['Security vulnerabilities'],
            successCriteria: ['100% test coverage']
          }
        ]
      },
      executionStrategy: {
        methodology: 'Agile',
        sprintLength: '2 weeks',
        teamRecommendations: 'Cross-functional team of 5-7 members',
        keyMilestones: [
          {
            milestone: 'Phase 1 Complete',
            timeline: 'End of Month 2',
            description: 'Foundation phase completed'
          }
        ]
      }
    }

    mockInsights = {
      executiveSummary: 'Strategic analysis reveals key opportunities',
      keyInsights: [
        {
          insight: 'High-priority feature needed',
          impact: 'High impact on user engagement'
        },
        {
          insight: 'Technical debt identified',
          impact: 'Medium impact on velocity'
        }
      ],
      suggestedRoadmap: [
        {
          phase: 'Phase 1',
          focus: 'Core features',
          duration: '2 months',
          ideas: ['Feature A', 'Feature B']
        }
      ],
      priorityRecommendations: {
        immediate: ['Fix critical bug', 'Improve performance'],
        shortTerm: ['Add new feature', 'Refactor code'],
        longTerm: ['Scale infrastructure', 'Expand to new markets']
      },
      riskAssessment: {
        highRisk: ['Security vulnerability', 'Performance bottleneck'],
        opportunities: ['Market expansion', 'New partnerships']
      },
      nextSteps: ['Begin Phase 1', 'Assemble team', 'Setup infrastructure']
    }
  })

  describe('exportRoadmapToPDF', () => {
    it('should export roadmap data to PDF', () => {
      exportRoadmapToPDF(mockRoadmapData, 10, mockProject)

      expect(mockSave).toHaveBeenCalled()
      expect(mockText).toHaveBeenCalled()
      expect(global.alert).not.toHaveBeenCalled()
    })

    it('should include project name in title', () => {
      exportRoadmapToPDF(mockRoadmapData, 10, mockProject)

      expect(mockText).toHaveBeenCalledWith(
        expect.stringContaining('Test Project'),
        expect.any(Number),
        expect.any(Number)
      )
    })

    it('should include project description', () => {
      exportRoadmapToPDF(mockRoadmapData, 10, mockProject)

      expect(mockSplitTextToSize).toHaveBeenCalledWith(
        expect.stringContaining('A test project'),
        expect.any(Number)
      )
    })

    it('should include idea count in overview', () => {
      exportRoadmapToPDF(mockRoadmapData, 25, mockProject)

      expect(mockSplitTextToSize).toHaveBeenCalledWith(
        expect.stringContaining('25 ideas'),
        expect.any(Number)
      )
    })

    it('should include execution strategy methodology', () => {
      exportRoadmapToPDF(mockRoadmapData, 10, mockProject)

      expect(mockSplitTextToSize).toHaveBeenCalledWith(
        expect.stringContaining('Agile Development'),
        expect.any(Number)
      )
    })

    it('should include sprint length', () => {
      exportRoadmapToPDF(mockRoadmapData, 10, mockProject)

      expect(mockSplitTextToSize).toHaveBeenCalledWith(
        expect.stringContaining('2 weeks'),
        expect.any(Number)
      )
    })

    it('should render all phases', () => {
      exportRoadmapToPDF(mockRoadmapData, 10, mockProject)

      expect(mockText).toHaveBeenCalledWith(
        expect.stringContaining('PHASE 1: FOUNDATION PHASE'),
        expect.any(Number),
        expect.any(Number)
      )
    })

    it('should render epics with titles', () => {
      exportRoadmapToPDF(mockRoadmapData, 10, mockProject)

      expect(mockSplitTextToSize).toHaveBeenCalledWith(
        expect.stringContaining('Authentication System'),
        expect.any(Number)
      )
    })

    it('should include user stories', () => {
      exportRoadmapToPDF(mockRoadmapData, 10, mockProject)

      expect(mockSplitTextToSize).toHaveBeenCalledWith(
        expect.stringContaining('As a user'),
        expect.any(Number)
      )
    })

    it('should include deliverables', () => {
      exportRoadmapToPDF(mockRoadmapData, 10, mockProject)

      expect(mockSplitTextToSize).toHaveBeenCalledWith(
        expect.stringContaining('OAuth integration'),
        expect.any(Number)
      )
    })

    it('should include risks', () => {
      exportRoadmapToPDF(mockRoadmapData, 10, mockProject)

      expect(mockSplitTextToSize).toHaveBeenCalledWith(
        expect.stringContaining('Security vulnerabilities'),
        expect.any(Number)
      )
    })

    it('should include success criteria', () => {
      exportRoadmapToPDF(mockRoadmapData, 10, mockProject)

      expect(mockSplitTextToSize).toHaveBeenCalledWith(
        expect.stringContaining('test coverage'),
        expect.any(Number)
      )
    })

    it('should create professional filename with project name', () => {
      exportRoadmapToPDF(mockRoadmapData, 10, mockProject)

      expect(mockSave).toHaveBeenCalledWith(
        expect.stringContaining('Test_Project_Complete_Project_Roadmap')
      )
    })

    it('should include table of contents', () => {
      exportRoadmapToPDF(mockRoadmapData, 10, mockProject)

      expect(mockText).toHaveBeenCalledWith(
        expect.stringContaining('TABLE OF CONTENTS'),
        expect.any(Number),
        expect.any(Number)
      )
    })

    it('should include technical requirements section', () => {
      exportRoadmapToPDF(mockRoadmapData, 10, mockProject)

      expect(mockText).toHaveBeenCalledWith(
        expect.stringContaining('TECHNICAL REQUIREMENTS'),
        expect.any(Number),
        expect.any(Number)
      )
    })

    it('should include resource requirements section', () => {
      exportRoadmapToPDF(mockRoadmapData, 10, mockProject)

      expect(mockText).toHaveBeenCalledWith(
        expect.stringContaining('RESOURCE REQUIREMENTS'),
        expect.any(Number),
        expect.any(Number)
      )
    })

    it('should include quality assurance section', () => {
      exportRoadmapToPDF(mockRoadmapData, 10, mockProject)

      expect(mockText).toHaveBeenCalledWith(
        expect.stringContaining('QUALITY ASSURANCE'),
        expect.any(Number),
        expect.any(Number)
      )
    })

    it('should add page footers', () => {
      exportRoadmapToPDF(mockRoadmapData, 10, mockProject)

      expect(mockText).toHaveBeenCalledWith(
        expect.stringContaining('Prioritas AI'),
        expect.any(Number),
        expect.any(Number)
      )
    })

    it('should handle roadmap without project', () => {
      exportRoadmapToPDF(mockRoadmapData, 10, null)

      expect(mockSave).toHaveBeenCalled()
      expect(mockText).toHaveBeenCalledWith(
        expect.stringContaining('Complete Project Roadmap'),
        expect.any(Number),
        expect.any(Number)
      )
    })

    it('should handle empty phases array', () => {
      const emptyRoadmap = {
        ...mockRoadmapData,
        roadmapAnalysis: {
          ...mockRoadmapData.roadmapAnalysis,
          phases: []
        }
      }

      exportRoadmapToPDF(emptyRoadmap, 10, mockProject)

      expect(mockSave).toHaveBeenCalled()
      expect(global.alert).not.toHaveBeenCalled()
    })

    it('should handle phase without epics', () => {
      const noEpicsRoadmap = {
        ...mockRoadmapData,
        roadmapAnalysis: {
          ...mockRoadmapData.roadmapAnalysis,
          phases: [{
            phase: 'Empty Phase',
            duration: '1 month',
            description: 'Phase with no epics',
            epics: []
          }]
        }
      }

      exportRoadmapToPDF(noEpicsRoadmap, 10, mockProject)

      expect(mockSave).toHaveBeenCalled()
    })

    it('should handle errors gracefully', () => {
      mockSave.mockImplementationOnce(() => {
        throw new Error('Save failed')
      })

      exportRoadmapToPDF(mockRoadmapData, 10, mockProject)

      expect(global.alert).toHaveBeenCalledWith(
        expect.stringContaining('PDF export failed')
      )
    })
  })

  describe('exportInsightsToPDF', () => {
    it('should export insights to PDF', () => {
      exportInsightsToPDF(mockInsights, 10, mockProject, [])

      expect(mockSave).toHaveBeenCalled()
      expect(global.alert).not.toHaveBeenCalled()
    })

    it('should include project name in title', () => {
      exportInsightsToPDF(mockInsights, 10, mockProject, [])

      expect(mockText).toHaveBeenCalledWith(
        expect.stringContaining('Test Project'),
        expect.any(Number),
        expect.any(Number)
      )
    })

    it('should include executive summary', () => {
      exportInsightsToPDF(mockInsights, 10, mockProject, [])

      expect(mockSplitTextToSize).toHaveBeenCalledWith(
        expect.stringContaining('Strategic analysis'),
        expect.any(Number)
      )
    })

    it('should render all key insights', () => {
      exportInsightsToPDF(mockInsights, 10, mockProject, [])

      expect(mockSplitTextToSize).toHaveBeenCalledWith(
        expect.stringContaining('High-priority feature'),
        expect.any(Number)
      )

      expect(mockSplitTextToSize).toHaveBeenCalledWith(
        expect.stringContaining('Technical debt'),
        expect.any(Number)
      )
    })

    it('should color code insights by impact level', () => {
      exportInsightsToPDF(mockInsights, 10, mockProject, [])

      // High impact should use danger color (red)
      expect(mockSetFillColor).toHaveBeenCalledWith(239, 68, 68)
    })

    it('should include roadmap phases', () => {
      exportInsightsToPDF(mockInsights, 10, mockProject, [])

      expect(mockSplitTextToSize).toHaveBeenCalledWith(
        expect.stringContaining('Phase 1'),
        expect.any(Number)
      )
    })

    it('should include immediate priority recommendations', () => {
      exportInsightsToPDF(mockInsights, 10, mockProject, [])

      expect(mockSplitTextToSize).toHaveBeenCalledWith(
        expect.stringContaining('Fix critical bug'),
        expect.any(Number)
      )
    })

    it('should include short-term recommendations', () => {
      exportInsightsToPDF(mockInsights, 10, mockProject, [])

      expect(mockSplitTextToSize).toHaveBeenCalledWith(
        expect.stringContaining('Add new feature'),
        expect.any(Number)
      )
    })

    it('should include long-term recommendations', () => {
      exportInsightsToPDF(mockInsights, 10, mockProject, [])

      expect(mockSplitTextToSize).toHaveBeenCalledWith(
        expect.stringContaining('Scale infrastructure'),
        expect.any(Number)
      )
    })

    it('should include risk assessment', () => {
      exportInsightsToPDF(mockInsights, 10, mockProject, [])

      expect(mockSplitTextToSize).toHaveBeenCalledWith(
        expect.stringContaining('Security vulnerability'),
        expect.any(Number)
      )
    })

    it('should include opportunities', () => {
      exportInsightsToPDF(mockInsights, 10, mockProject, [])

      expect(mockSplitTextToSize).toHaveBeenCalledWith(
        expect.stringContaining('Market expansion'),
        expect.any(Number)
      )
    })

    it('should include next steps', () => {
      exportInsightsToPDF(mockInsights, 10, mockProject, [])

      expect(mockSplitTextToSize).toHaveBeenCalledWith(
        expect.stringContaining('Begin Phase 1'),
        expect.any(Number)
      )
    })

    it('should create professional filename', () => {
      exportInsightsToPDF(mockInsights, 10, mockProject, [])

      expect(mockSave).toHaveBeenCalledWith(
        expect.stringContaining('Test_Project_AI_Strategic_Insights')
      )
    })

    it('should sanitize project name in filename', () => {
      const projectWithSpecialChars = {
        ...mockProject,
        name: 'Project "2024" & More!'
      }

      exportInsightsToPDF(mockInsights, 10, projectWithSpecialChars, [])

      expect(mockSave).toHaveBeenCalledWith(
        expect.stringMatching(/Project_2024_More_AI_Strategic_Insights/)
      )
    })

    it('should handle insights without project', () => {
      exportInsightsToPDF(mockInsights, 10, null, [])

      expect(mockSave).toHaveBeenCalled()
      expect(mockText).toHaveBeenCalledWith(
        expect.stringContaining('AI Strategic Insights Report'),
        expect.any(Number),
        expect.any(Number)
      )
    })

    it('should handle empty key insights', () => {
      const emptyInsights = {
        ...mockInsights,
        keyInsights: []
      }

      exportInsightsToPDF(emptyInsights, 10, mockProject, [])

      expect(mockSave).toHaveBeenCalled()
    })

    it('should handle missing priority recommendations', () => {
      const noRecommendations = {
        ...mockInsights,
        priorityRecommendations: undefined
      }

      exportInsightsToPDF(noRecommendations, 10, mockProject, [])

      expect(mockSave).toHaveBeenCalled()
    })

    it('should handle errors gracefully', () => {
      mockSave.mockImplementationOnce(() => {
        throw new Error('Export failed')
      })

      exportInsightsToPDF(mockInsights, 10, mockProject, [])

      expect(global.alert).toHaveBeenCalledWith(
        expect.stringContaining('PDF export failed')
      )
    })

    it('should include file count in overview', () => {
      const files = [
        { name: 'file1.txt', content: 'content1' },
        { name: 'file2.txt', content: 'content2' }
      ]

      exportInsightsToPDF(mockInsights, 10, mockProject, files)

      // Should reflect the file count in stats
      expect(mockSave).toHaveBeenCalled()
    })
  })

  describe('PDF Formatting', () => {
    it('should use colored headers', () => {
      exportRoadmapToPDF(mockRoadmapData, 10, mockProject)

      // Check that fill color was set for headers
      expect(mockSetFillColor).toHaveBeenCalledWith(102, 16, 242) // Primary color
    })

    it('should create tables with proper structure', () => {
      exportRoadmapToPDF(mockRoadmapData, 10, mockProject)

      // Tables should use rect for structure
      expect(mockRect).toHaveBeenCalled()
    })

    it('should add dividers between sections', () => {
      exportRoadmapToPDF(mockRoadmapData, 10, mockProject)

      // Dividers use lines
      expect(mockLine).toHaveBeenCalled()
    })

    it('should handle page breaks appropriately', () => {
      const largeRoadmap = {
        ...mockRoadmapData,
        roadmapAnalysis: {
          ...mockRoadmapData.roadmapAnalysis,
          phases: Array(10).fill(mockRoadmapData.roadmapAnalysis.phases[0])
        }
      }

      exportRoadmapToPDF(largeRoadmap, 10, mockProject)

      // Should add pages when content is large
      expect(mockAddPage).toHaveBeenCalled()
    })

    it('should use consistent font sizes', () => {
      exportRoadmapToPDF(mockRoadmapData, 10, mockProject)

      expect(mockSetFontSize).toHaveBeenCalledWith(expect.any(Number))
    })

    it('should use varied font weights', () => {
      exportRoadmapToPDF(mockRoadmapData, 10, mockProject)

      expect(mockSetFont).toHaveBeenCalledWith('helvetica', 'bold')
      expect(mockSetFont).toHaveBeenCalledWith('helvetica', 'normal')
    })
  })
})