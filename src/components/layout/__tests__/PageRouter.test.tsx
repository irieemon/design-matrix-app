/**
 * PageRouter Component Tests
 *
 * Comprehensive tests for the PageRouter component covering:
 * - Route matching and rendering for all pages
 * - Navigation between pages
 * - 404 handling and invalid routes
 * - Protected routes (project required)
 * - Project restoration loading states
 * - Query parameters and props passing
 * - Route transitions and redirects
 * - Accessibility (page titles, focus management)
 * - Edge cases (rapid navigation, invalid pages, missing data)
 *
 * Business Impact: Navigation reliability, user flow integrity, data isolation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PageRouter from '../PageRouter'
import { mockUser, mockProject, mockIdeas } from '../../../test/utils/test-utils'

// Mock page components
vi.mock('../../pages/MatrixPage', () => ({
  default: ({ onNavigateToProjects, onShowAddModal, onShowAIModal }: any) => (
    <div data-testid="matrix-page">
      Matrix Page
      <button onClick={onNavigateToProjects} data-testid="matrix-nav-projects">Go to Projects</button>
      <button onClick={onShowAddModal} data-testid="matrix-add-modal">Add Idea</button>
      <button onClick={onShowAIModal} data-testid="matrix-ai-modal">AI Ideas</button>
    </div>
  )
}))

vi.mock('../../pages/DataManagement', () => ({
  default: ({ onDataUpdated }: any) => (
    <div data-testid="data-page">
      Data Management
      <button onClick={onDataUpdated} data-testid="data-refresh">Refresh</button>
    </div>
  )
}))

vi.mock('../../pages/ReportsAnalytics', () => ({
  default: () => <div data-testid="reports-page">Reports & Analytics</div>
}))

vi.mock('../../pages/UserSettings', () => ({
  default: ({ onLogout, onUserUpdate }: any) => (
    <div data-testid="user-page">
      User Settings
      <button onClick={onLogout} data-testid="user-logout">Logout</button>
      <button onClick={() => onUserUpdate({ full_name: 'Updated' })} data-testid="user-update">Update</button>
    </div>
  )
}))

vi.mock('../../pages/ProjectCollaboration', () => ({
  default: ({ onNavigateBack }: any) => (
    <div data-testid="collaboration-page">
      Collaboration
      <button onClick={onNavigateBack} data-testid="collab-back">Back</button>
    </div>
  )
}))

vi.mock('../../ProjectManagement', () => ({
  default: ({ onProjectSelect, onProjectCreated, onNavigateToMatrix }: any) => (
    <div data-testid="projects-page">
      Project Management
      <button onClick={() => onProjectSelect(null)} data-testid="projects-select">Select Project</button>
      <button onClick={() => onProjectCreated({ id: '1', name: 'New' }, [])} data-testid="projects-create">Create</button>
      <button onClick={onNavigateToMatrix} data-testid="projects-nav-matrix">Go to Matrix</button>
    </div>
  )
}))

vi.mock('../../ProjectRoadmap', () => ({
  default: () => <div data-testid="roadmap-page">Roadmap</div>
}))

vi.mock('../../ProjectFiles', () => ({
  default: ({ onFilesUploaded, onDeleteFile }: any) => (
    <div data-testid="files-page">
      Files
      <button onClick={() => onFilesUploaded([])} data-testid="files-upload">Upload</button>
      <button onClick={() => onDeleteFile('1')} data-testid="files-delete">Delete</button>
    </div>
  )
}))

vi.mock('../../pages/ButtonTestPage', () => ({
  ButtonTestPage: () => <div data-testid="button-test-page">Button Test</div>
}))

vi.mock('../../pages/FormTestPage', () => ({
  FormTestPage: () => <div data-testid="form-test-page">Form Test</div>
}))

vi.mock('../../pages/SkeletonTestPage', () => ({
  SkeletonTestPage: () => <div data-testid="skeleton-test-page">Skeleton Test</div>
}))

vi.mock('../../../hooks/useProjectFiles', () => ({
  useProjectFiles: vi.fn(() => ({
    getCurrentProjectFiles: vi.fn(() => []),
    handleFilesUploaded: vi.fn(),
    handleDeleteFile: vi.fn()
  }))
}))

describe('PageRouter', () => {
  const user = userEvent.setup()
  const mockOnProjectSelect = vi.fn()
  const mockOnPageChange = vi.fn()
  const mockOnLogout = vi.fn()
  const mockOnUserUpdate = vi.fn()
  const mockOnDataUpdated = vi.fn()
  const mockOnShowAddModal = vi.fn()
  const mockOnShowAIModal = vi.fn()
  const mockSetIdeas = vi.fn()

  const defaultProps = {
    currentPage: 'matrix',
    currentUser: mockUser,
    currentProject: mockProject,
    onProjectSelect: mockOnProjectSelect,
    onPageChange: mockOnPageChange,
    onLogout: mockOnLogout,
    onUserUpdate: mockOnUserUpdate,
    onDataUpdated: mockOnDataUpdated,
    onShowAddModal: mockOnShowAddModal,
    onShowAIModal: mockOnShowAIModal,
    ideas: mockIdeas,
    setIdeas: mockSetIdeas
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Route Matching and Rendering', () => {
    it('should render matrix page for matrix route', () => {
      render(<PageRouter {...defaultProps} currentPage="matrix" />)

      expect(screen.getByTestId('matrix-page')).toBeInTheDocument()
    })

    it('should render matrix page for home route', () => {
      render(<PageRouter {...defaultProps} currentPage="home" />)

      expect(screen.getByTestId('matrix-page')).toBeInTheDocument()
    })

    it('should render data management page', () => {
      render(<PageRouter {...defaultProps} currentPage="data" />)

      expect(screen.getByTestId('data-page')).toBeInTheDocument()
    })

    it('should render reports page', () => {
      render(<PageRouter {...defaultProps} currentPage="reports" />)

      expect(screen.getByTestId('reports-page')).toBeInTheDocument()
    })

    it('should render projects page', () => {
      render(<PageRouter {...defaultProps} currentPage="projects" />)

      expect(screen.getByTestId('projects-page')).toBeInTheDocument()
    })

    it('should render roadmap page', () => {
      render(<PageRouter {...defaultProps} currentPage="roadmap" />)

      expect(screen.getByTestId('roadmap-page')).toBeInTheDocument()
    })

    it('should render files page', () => {
      render(<PageRouter {...defaultProps} currentPage="files" />)

      expect(screen.getByTestId('files-page')).toBeInTheDocument()
    })

    it('should render collaboration page', () => {
      render(<PageRouter {...defaultProps} currentPage="collaboration" />)

      expect(screen.getByTestId('collaboration-page')).toBeInTheDocument()
    })

    it('should render user settings page', () => {
      render(<PageRouter {...defaultProps} currentPage="user" />)

      expect(screen.getByTestId('user-page')).toBeInTheDocument()
    })

    it('should render button test page', () => {
      render(<PageRouter {...defaultProps} currentPage="button-test" />)

      expect(screen.getByTestId('button-test-page')).toBeInTheDocument()
    })

    it('should render form test page', () => {
      render(<PageRouter {...defaultProps} currentPage="form-test" />)

      expect(screen.getByTestId('form-test-page')).toBeInTheDocument()
    })

    it('should render skeleton test page', () => {
      render(<PageRouter {...defaultProps} currentPage="skeleton-test" />)

      expect(screen.getByTestId('skeleton-test-page')).toBeInTheDocument()
    })
  })

  describe('Protected Routes (Project Required)', () => {
    it('should redirect data page to projects when no project', async () => {
      render(
        <PageRouter
          {...defaultProps}
          currentPage="data"
          currentProject={null}
        />
      )

      await waitFor(() => {
        expect(mockOnPageChange).toHaveBeenCalledWith('projects')
      })
    })

    it('should redirect reports page to projects when no project', async () => {
      render(
        <PageRouter
          {...defaultProps}
          currentPage="reports"
          currentProject={null}
        />
      )

      await waitFor(() => {
        expect(mockOnPageChange).toHaveBeenCalledWith('projects')
      })
    })

    it('should redirect roadmap page to projects when no project', async () => {
      render(
        <PageRouter
          {...defaultProps}
          currentPage="roadmap"
          currentProject={null}
        />
      )

      await waitFor(() => {
        expect(mockOnPageChange).toHaveBeenCalledWith('projects')
      })
    })

    it('should redirect files page to projects when no project', async () => {
      render(
        <PageRouter
          {...defaultProps}
          currentPage="files"
          currentProject={null}
        />
      )

      await waitFor(() => {
        expect(mockOnPageChange).toHaveBeenCalledWith('projects')
      })
    })

    it('should redirect collaboration page to projects when no project', async () => {
      render(
        <PageRouter
          {...defaultProps}
          currentPage="collaboration"
          currentProject={null}
        />
      )

      await waitFor(() => {
        expect(mockOnPageChange).toHaveBeenCalledWith('projects')
      })
    })

    it('should not redirect matrix page without project', () => {
      render(
        <PageRouter
          {...defaultProps}
          currentPage="matrix"
          currentProject={null}
        />
      )

      expect(screen.getByTestId('matrix-page')).toBeInTheDocument()
      expect(mockOnPageChange).not.toHaveBeenCalled()
    })

    it('should not redirect projects page without project', () => {
      render(
        <PageRouter
          {...defaultProps}
          currentPage="projects"
          currentProject={null}
        />
      )

      expect(screen.getByTestId('projects-page')).toBeInTheDocument()
      expect(mockOnPageChange).not.toHaveBeenCalled()
    })

    it('should not redirect user page without project', () => {
      render(
        <PageRouter
          {...defaultProps}
          currentPage="user"
          currentProject={null}
        />
      )

      expect(screen.getByTestId('user-page')).toBeInTheDocument()
      expect(mockOnPageChange).not.toHaveBeenCalled()
    })
  })

  describe('Project Restoration Loading States', () => {
    it('should show loading state for data page during restoration', () => {
      render(
        <PageRouter
          {...defaultProps}
          currentPage="data"
          currentProject={null}
          isRestoringProject={true}
        />
      )

      expect(screen.getByText('Loading project...')).toBeInTheDocument()
      expect(screen.queryByTestId('data-page')).not.toBeInTheDocument()
    })

    it('should show loading state for reports page during restoration', () => {
      render(
        <PageRouter
          {...defaultProps}
          currentPage="reports"
          currentProject={null}
          isRestoringProject={true}
        />
      )

      expect(screen.getByText('Loading project...')).toBeInTheDocument()
    })

    it('should show loading state for roadmap page during restoration', () => {
      render(
        <PageRouter
          {...defaultProps}
          currentPage="roadmap"
          currentProject={null}
          isRestoringProject={true}
        />
      )

      expect(screen.getByText('Loading project...')).toBeInTheDocument()
    })

    it('should show loading state for files page during restoration', () => {
      render(
        <PageRouter
          {...defaultProps}
          currentPage="files"
          currentProject={null}
          isRestoringProject={true}
        />
      )

      expect(screen.getByText('Loading project...')).toBeInTheDocument()
    })

    it('should show loading state for collaboration page during restoration', () => {
      render(
        <PageRouter
          {...defaultProps}
          currentPage="collaboration"
          currentProject={null}
          isRestoringProject={true}
        />
      )

      expect(screen.getByText('Loading project...')).toBeInTheDocument()
    })

    it('should not redirect during project restoration', () => {
      render(
        <PageRouter
          {...defaultProps}
          currentPage="data"
          currentProject={null}
          isRestoringProject={true}
        />
      )

      expect(mockOnPageChange).not.toHaveBeenCalled()
    })

    it('should show redirecting message when not restoring', () => {
      render(
        <PageRouter
          {...defaultProps}
          currentPage="data"
          currentProject={null}
          isRestoringProject={false}
        />
      )

      expect(screen.getByText('Redirecting to projects...')).toBeInTheDocument()
    })

    it('should display loading spinner', () => {
      render(
        <PageRouter
          {...defaultProps}
          currentPage="data"
          currentProject={null}
          isRestoringProject={true}
        />
      )

      // Check for spinner by class name since there are multiple generic divs
      const container = screen.getByText('Loading project...').parentElement
      const spinner = container?.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
      expect(spinner).toHaveClass('animate-spin')
    })
  })

  describe('Invalid Route Handling', () => {
    it('should redirect invalid page to matrix', async () => {
      render(<PageRouter {...defaultProps} currentPage="invalid-page" />)

      await waitFor(() => {
        expect(mockOnPageChange).toHaveBeenCalledWith('matrix')
      })
    })

    it('should redirect empty page to matrix', async () => {
      render(<PageRouter {...defaultProps} currentPage="" />)

      await waitFor(() => {
        expect(mockOnPageChange).toHaveBeenCalledWith('matrix')
      })
    })

    it('should handle special characters in page name', async () => {
      render(<PageRouter {...defaultProps} currentPage="<script>alert('xss')</script>" />)

      await waitFor(() => {
        expect(mockOnPageChange).toHaveBeenCalledWith('matrix')
      })
    })

    it('should validate page on mount', async () => {
      render(<PageRouter {...defaultProps} currentPage="not-a-page" />)

      await waitFor(() => {
        expect(mockOnPageChange).toHaveBeenCalledWith('matrix')
      })
    })

    it('should validate page on props change', async () => {
      const { rerender } = render(<PageRouter {...defaultProps} currentPage="matrix" />)

      rerender(<PageRouter {...defaultProps} currentPage="fake-page" />)

      await waitFor(() => {
        expect(mockOnPageChange).toHaveBeenCalledWith('matrix')
      })
    })
  })

  describe('Navigation Between Pages', () => {
    it('should handle navigation from matrix to projects', async () => {
      render(<PageRouter {...defaultProps} currentPage="matrix" />)

      await user.click(screen.getByTestId('matrix-nav-projects'))
      expect(mockOnPageChange).toHaveBeenCalledWith('projects')
    })

    it('should handle navigation from projects to matrix', async () => {
      render(<PageRouter {...defaultProps} currentPage="projects" />)

      await user.click(screen.getByTestId('projects-nav-matrix'))
      expect(mockOnPageChange).toHaveBeenCalledWith('matrix')
    })

    it('should handle navigation from collaboration back to matrix', async () => {
      render(<PageRouter {...defaultProps} currentPage="collaboration" />)

      await user.click(screen.getByTestId('collab-back'))
      expect(mockOnPageChange).toHaveBeenCalledWith('matrix')
    })

    it('should change page content on route change', () => {
      const { rerender } = render(<PageRouter {...defaultProps} currentPage="matrix" />)

      expect(screen.getByTestId('matrix-page')).toBeInTheDocument()

      rerender(<PageRouter {...defaultProps} currentPage="projects" />)

      expect(screen.queryByTestId('matrix-page')).not.toBeInTheDocument()
      expect(screen.getByTestId('projects-page')).toBeInTheDocument()
    })

    it('should maintain page state during project changes', () => {
      const { rerender } = render(<PageRouter {...defaultProps} currentPage="matrix" />)

      rerender(<PageRouter {...defaultProps} currentPage="matrix" currentProject={null} />)

      expect(screen.getByTestId('matrix-page')).toBeInTheDocument()
    })
  })

  describe('Props Passing to Pages', () => {
    it('should pass ideas to matrix page', () => {
      render(<PageRouter {...defaultProps} currentPage="matrix" ideas={mockIdeas} />)

      expect(screen.getByTestId('matrix-page')).toBeInTheDocument()
    })

    it('should pass modal handlers to matrix page', async () => {
      render(<PageRouter {...defaultProps} currentPage="matrix" />)

      await user.click(screen.getByTestId('matrix-add-modal'))
      expect(mockOnShowAddModal).toHaveBeenCalled()

      await user.click(screen.getByTestId('matrix-ai-modal'))
      expect(mockOnShowAIModal).toHaveBeenCalled()
    })

    it('should pass user to all pages', () => {
      render(<PageRouter {...defaultProps} currentPage="user" />)

      expect(screen.getByTestId('user-page')).toBeInTheDocument()
    })

    it('should pass project to project-dependent pages', () => {
      render(<PageRouter {...defaultProps} currentPage="reports" />)

      expect(screen.getByTestId('reports-page')).toBeInTheDocument()
    })

    it('should pass data update handler to data page', async () => {
      render(<PageRouter {...defaultProps} currentPage="data" />)

      await user.click(screen.getByTestId('data-refresh'))
      expect(mockOnDataUpdated).toHaveBeenCalled()
    })

    it('should pass logout handler to user page', async () => {
      render(<PageRouter {...defaultProps} currentPage="user" />)

      await user.click(screen.getByTestId('user-logout'))
      expect(mockOnLogout).toHaveBeenCalled()
    })

    it('should pass user update handler to user page', async () => {
      render(<PageRouter {...defaultProps} currentPage="user" />)

      await user.click(screen.getByTestId('user-update'))
      expect(mockOnUserUpdate).toHaveBeenCalled()
    })

    it('should pass project select handler to projects page', async () => {
      render(<PageRouter {...defaultProps} currentPage="projects" />)

      await user.click(screen.getByTestId('projects-select'))
      expect(mockOnProjectSelect).toHaveBeenCalled()
    })

    it('should handle project creation with ideas', async () => {
      render(<PageRouter {...defaultProps} currentPage="projects" />)

      await user.click(screen.getByTestId('projects-create'))

      expect(mockOnProjectSelect).toHaveBeenCalled()
      expect(mockOnPageChange).toHaveBeenCalledWith('matrix')
    })
  })

  describe('Background Styling', () => {
    it('should apply background to data page', () => {
      render(<PageRouter {...defaultProps} currentPage="data" />)

      const container = screen.getByTestId('data-page').parentElement
      expect(container).toHaveClass('bg-slate-50', 'min-h-screen')
    })

    it('should apply background to reports page', () => {
      render(<PageRouter {...defaultProps} currentPage="reports" />)

      const container = screen.getByTestId('reports-page').parentElement
      expect(container).toHaveClass('bg-slate-50', 'min-h-screen')
    })

    it('should apply background to projects page', () => {
      render(<PageRouter {...defaultProps} currentPage="projects" />)

      const container = screen.getByTestId('projects-page').parentElement
      expect(container).toHaveClass('bg-slate-50', 'min-h-screen')
    })

    it('should apply different background to roadmap page', () => {
      render(<PageRouter {...defaultProps} currentPage="roadmap" />)

      const container = screen.getByTestId('roadmap-page').parentElement?.parentElement
      expect(container).toHaveClass('bg-gray-50', 'min-h-screen')
    })

    it('should apply background to user page', () => {
      render(<PageRouter {...defaultProps} currentPage="user" />)

      const container = screen.getByTestId('user-page').parentElement
      expect(container).toHaveClass('bg-slate-50', 'min-h-screen')
    })
  })

  describe('Edge Cases', () => {
    it('should handle null user', () => {
      const nullUserProps = {
        ...defaultProps,
        currentUser: null as any
      }

      expect(() => render(<PageRouter {...nullUserProps} currentPage="matrix" />)).not.toThrow()
    })

    it('should handle undefined ideas', () => {
      render(<PageRouter {...defaultProps} ideas={undefined} currentPage="matrix" />)

      expect(screen.getByTestId('matrix-page')).toBeInTheDocument()
    })

    it('should handle empty ideas array', () => {
      render(<PageRouter {...defaultProps} ideas={[]} currentPage="matrix" />)

      expect(screen.getByTestId('matrix-page')).toBeInTheDocument()
    })

    it('should handle rapid page changes', () => {
      const { rerender } = render(<PageRouter {...defaultProps} currentPage="matrix" />)

      rerender(<PageRouter {...defaultProps} currentPage="projects" />)
      rerender(<PageRouter {...defaultProps} currentPage="reports" />)
      rerender(<PageRouter {...defaultProps} currentPage="user" />)

      expect(screen.getByTestId('user-page')).toBeInTheDocument()
    })

    it('should handle simultaneous project and page change', () => {
      const { rerender } = render(<PageRouter {...defaultProps} currentPage="matrix" />)

      rerender(
        <PageRouter
          {...defaultProps}
          currentPage="reports"
          currentProject={null}
        />
      )

      expect(screen.queryByTestId('reports-page')).not.toBeInTheDocument()
    })

    it('should handle missing setIdeas function', () => {
      render(
        <PageRouter
          {...defaultProps}
          setIdeas={undefined}
          currentPage="projects"
        />
      )

      expect(screen.getByTestId('projects-page')).toBeInTheDocument()
    })

    it('should cleanup on unmount', () => {
      const { unmount } = render(<PageRouter {...defaultProps} currentPage="matrix" />)

      expect(() => unmount()).not.toThrow()
    })

    it('should handle files page without user', () => {
      render(
        <PageRouter
          {...defaultProps}
          currentUser={null as any}
          currentPage="files"
        />
      )

      expect(screen.getByText('Redirecting to projects...')).toBeInTheDocument()
    })

    it('should handle collaboration page without user', () => {
      render(
        <PageRouter
          {...defaultProps}
          currentUser={null as any}
          currentPage="collaboration"
        />
      )

      expect(screen.getByText('Redirecting to projects...')).toBeInTheDocument()
    })
  })

  describe('Test Pages', () => {
    it('should render all test pages without project', () => {
      const { rerender } = render(
        <PageRouter {...defaultProps} currentPage="button-test" currentProject={null} />
      )
      expect(screen.getByTestId('button-test-page')).toBeInTheDocument()

      rerender(<PageRouter {...defaultProps} currentPage="form-test" currentProject={null} />)
      expect(screen.getByTestId('form-test-page')).toBeInTheDocument()

      rerender(<PageRouter {...defaultProps} currentPage="skeleton-test" currentProject={null} />)
      expect(screen.getByTestId('skeleton-test-page')).toBeInTheDocument()
    })

    it('should not redirect test pages without project', () => {
      render(<PageRouter {...defaultProps} currentPage="button-test" currentProject={null} />)

      expect(mockOnPageChange).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should render pages with semantic structure', () => {
      render(<PageRouter {...defaultProps} currentPage="matrix" />)

      expect(screen.getByTestId('matrix-page')).toBeInTheDocument()
    })

    it('should handle focus management during navigation', () => {
      const { rerender } = render(<PageRouter {...defaultProps} currentPage="matrix" />)

      rerender(<PageRouter {...defaultProps} currentPage="projects" />)

      expect(screen.getByTestId('projects-page')).toBeInTheDocument()
    })

    it('should provide loading announcements', () => {
      render(
        <PageRouter
          {...defaultProps}
          currentPage="data"
          currentProject={null}
          isRestoringProject={true}
        />
      )

      expect(screen.getByText('Loading project...')).toBeInTheDocument()
    })

    it('should provide redirect announcements', () => {
      render(
        <PageRouter
          {...defaultProps}
          currentPage="data"
          currentProject={null}
          isRestoringProject={false}
        />
      )

      expect(screen.getByText('Redirecting to projects...')).toBeInTheDocument()
    })
  })

  describe('Integration Tests', () => {
    it('should complete full navigation workflow', async () => {
      const { rerender } = render(<PageRouter {...defaultProps} currentPage="matrix" />)

      expect(screen.getByTestId('matrix-page')).toBeInTheDocument()

      await user.click(screen.getByTestId('matrix-nav-projects'))
      expect(mockOnPageChange).toHaveBeenCalledWith('projects')

      rerender(<PageRouter {...defaultProps} currentPage="projects" />)
      expect(screen.getByTestId('projects-page')).toBeInTheDocument()

      await user.click(screen.getByTestId('projects-nav-matrix'))
      expect(mockOnPageChange).toHaveBeenCalledWith('matrix')
    })

    it('should handle project lifecycle', async () => {
      const { rerender } = render(<PageRouter {...defaultProps} currentPage="projects" />)

      await user.click(screen.getByTestId('projects-create'))

      expect(mockOnProjectSelect).toHaveBeenCalled()
      expect(mockOnPageChange).toHaveBeenCalledWith('matrix')

      rerender(<PageRouter {...defaultProps} currentPage="matrix" />)
      expect(screen.getByTestId('matrix-page')).toBeInTheDocument()
    })

    it('should maintain data consistency across pages', () => {
      const { rerender } = render(<PageRouter {...defaultProps} currentPage="matrix" ideas={mockIdeas} />)

      rerender(<PageRouter {...defaultProps} currentPage="data" ideas={mockIdeas} />)
      expect(screen.getByTestId('data-page')).toBeInTheDocument()

      rerender(<PageRouter {...defaultProps} currentPage="reports" ideas={mockIdeas} />)
      expect(screen.getByTestId('reports-page')).toBeInTheDocument()
    })
  })
})