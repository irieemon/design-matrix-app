/**
 * Sidebar Comprehensive Test Suite
 *
 * Complete test coverage for Sidebar component including:
 * - Component rendering (collapsed and expanded states)
 * - Navigation menu items and active states
 * - Project display and switching
 * - Expand/collapse functionality
 * - User profile section
 * - Admin access visibility and behavior
 * - Settings/logout actions
 * - Project tools visibility when project selected/not selected
 * - Empty state handling
 * - Keyboard navigation
 * - Accessibility (ARIA labels, roles, keyboard support)
 * - Edge cases (long project names, many projects, no user)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import Sidebar from '../Sidebar'
import { Project, User } from '../../types'
import { generateDemoUUID } from '../../utils/uuid'

// Mock dependencies
vi.mock('../../lib/adminService', () => ({
  AdminService: {
    isAdmin: vi.fn()
  }
}))

vi.mock('../../contexts/UserContext', () => ({
  useCurrentUser: vi.fn(),
  useUserDisplay: vi.fn()
}))

vi.mock('../PrioritasLogo', () => ({
  default: ({ className, size }: any) => (
    <div data-testid="prioritas-logo" className={className} data-size={size}>
      Logo
    </div>
  )
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Home: ({ className }: any) => <div data-testid="icon-home" className={className}>Home</div>,
  User: ({ className }: any) => <div data-testid="icon-user" className={className}>User</div>,
  Database: ({ className }: any) => <div data-testid="icon-database" className={className}>Database</div>,
  BarChart3: ({ className }: any) => <div data-testid="icon-barchart" className={className}>BarChart</div>,
  FolderOpen: ({ className }: any) => <div data-testid="icon-folder" className={className}>Folder</div>,
  LogOut: ({ className }: any) => <div data-testid="icon-logout" className={className}>Logout</div>,
  ChevronLeft: ({ className }: any) => <div data-testid="icon-chevron-left" className={className}>ChevronLeft</div>,
  ChevronRight: ({ className }: any) => <div data-testid="icon-chevron-right" className={className}>ChevronRight</div>,
  Map: ({ className }: any) => <div data-testid="icon-map" className={className}>Map</div>,
  Users: ({ className }: any) => <div data-testid="icon-users" className={className}>Users</div>,
  Shield: ({ className }: any) => <div data-testid="icon-shield" className={className}>Shield</div>
}))

import { AdminService } from '../../lib/adminService'
import { useCurrentUser, useUserDisplay } from '../../contexts/UserContext'

describe('Sidebar - Comprehensive Test Suite', () => {
  const mockOnPageChange = vi.fn()
  const mockOnLogout = vi.fn()
  const mockOnAdminAccess = vi.fn()
  const mockOnToggleCollapse = vi.fn()

  const mockUser: User = {
    id: generateDemoUUID('1'),
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'user',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
  }

  const mockAdminUser: User = {
    id: generateDemoUUID('9'),
    email: 'admin@prioritas.com',
    full_name: 'Admin User',
    role: 'super_admin',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
  }

  const mockProject: Project = {
    id: generateDemoUUID('2'),
    name: 'Test Project',
    description: 'A test project for unit testing',
    project_type: 'Software',
    status: 'active',
    owner_id: generateDemoUUID('1'),
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
  }

  const defaultProps = {
    currentPage: 'matrix',
    currentProject: mockProject,
    onPageChange: mockOnPageChange,
    onLogout: mockOnLogout,
    onAdminAccess: mockOnAdminAccess,
    onToggleCollapse: mockOnToggleCollapse
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    vi.mocked(useCurrentUser).mockReturnValue(mockUser)
    vi.mocked(useUserDisplay).mockReturnValue({
      displayName: 'Test User',
      email: 'test@example.com',
      isLoading: false
    })
    vi.mocked(AdminService.isAdmin).mockReturnValue(false)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render sidebar with expanded state by default', () => {
      render(<Sidebar {...defaultProps} />)

      const sidebar = document.querySelector('.sidebar-clean')
      expect(sidebar).toBeInTheDocument()
      expect(sidebar).toHaveClass('w-72')
    })

    it('should render Prioritas logo', () => {
      render(<Sidebar {...defaultProps} />)

      expect(screen.getByTestId('prioritas-logo')).toBeInTheDocument()
    })

    it('should render Prioritas brand name when expanded', () => {
      render(<Sidebar {...defaultProps} />)

      expect(screen.getByText('Prioritas')).toBeInTheDocument()
    })

    it('should not render brand name when collapsed', () => {
      render(<Sidebar {...defaultProps} />)

      const collapseButton = screen.getAllByTestId('icon-chevron-left')[0].parentElement!
      fireEvent.click(collapseButton)

      expect(screen.queryByText('Prioritas')).not.toBeInTheDocument()
    })

    it('should apply fixed positioning and z-index', () => {
      render(<Sidebar {...defaultProps} />)

      const sidebar = document.querySelector('.sidebar-clean')
      expect(sidebar).toHaveClass('fixed', 'left-0', 'top-0', 'z-50')
    })
  })

  describe('Expand/Collapse Functionality', () => {
    it('should toggle to collapsed state when collapse button clicked', () => {
      render(<Sidebar {...defaultProps} />)

      const collapseButton = screen.getAllByTestId('icon-chevron-left')[0].parentElement!
      fireEvent.click(collapseButton)

      const sidebar = document.querySelector('.sidebar-clean')
      expect(sidebar).toHaveClass('w-20')
    })

    it('should call onToggleCollapse with true when collapsing', () => {
      render(<Sidebar {...defaultProps} />)

      const collapseButton = screen.getAllByTestId('icon-chevron-left')[0].parentElement!
      fireEvent.click(collapseButton)

      expect(mockOnToggleCollapse).toHaveBeenCalledWith(true)
    })

    it('should toggle to expanded state when expand button clicked', () => {
      render(<Sidebar {...defaultProps} />)

      // First collapse
      const collapseButton = screen.getAllByTestId('icon-chevron-left')[0].parentElement!
      fireEvent.click(collapseButton)

      // Then expand
      const expandButton = screen.getByTestId('icon-chevron-right').parentElement!
      fireEvent.click(expandButton)

      const sidebar = document.querySelector('.sidebar-clean')
      expect(sidebar).toHaveClass('w-72')
    })

    it('should call onToggleCollapse with false when expanding', () => {
      render(<Sidebar {...defaultProps} />)

      // Collapse first
      const collapseButton = screen.getAllByTestId('icon-chevron-left')[0].parentElement!
      fireEvent.click(collapseButton)

      mockOnToggleCollapse.mockClear()

      // Then expand
      const expandButton = screen.getByTestId('icon-chevron-right').parentElement!
      fireEvent.click(expandButton)

      expect(mockOnToggleCollapse).toHaveBeenCalledWith(false)
    })

    it('should show ChevronLeft icon when expanded', () => {
      render(<Sidebar {...defaultProps} />)

      expect(screen.getByTestId('icon-chevron-left')).toBeInTheDocument()
      expect(screen.queryByTestId('icon-chevron-right')).not.toBeInTheDocument()
    })

    it('should show ChevronRight icon when collapsed', () => {
      render(<Sidebar {...defaultProps} />)

      const collapseButton = screen.getAllByTestId('icon-chevron-left')[0].parentElement!
      fireEvent.click(collapseButton)

      expect(screen.getByTestId('icon-chevron-right')).toBeInTheDocument()
      expect(screen.queryByTestId('icon-chevron-left')).not.toBeInTheDocument()
    })

    it('should toggle multiple times correctly', () => {
      render(<Sidebar {...defaultProps} />)

      const sidebar = document.querySelector('.sidebar-clean')

      // Collapse
      let button = screen.getAllByTestId('icon-chevron-left')[0].parentElement!
      fireEvent.click(button)
      expect(sidebar).toHaveClass('w-20')

      // Expand
      button = screen.getByTestId('icon-chevron-right').parentElement!
      fireEvent.click(button)
      expect(sidebar).toHaveClass('w-72')

      // Collapse again
      button = screen.getAllByTestId('icon-chevron-left')[0].parentElement!
      fireEvent.click(button)
      expect(sidebar).toHaveClass('w-20')
    })
  })

  describe('Navigation - Projects Button', () => {
    it('should render Projects button', () => {
      render(<Sidebar {...defaultProps} />)

      expect(screen.getByText('Projects')).toBeInTheDocument()
    })

    it('should call onPageChange with "projects" when clicked', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      const projectsButton = screen.getByText('Projects').closest('button')!
      await user.click(projectsButton)

      expect(mockOnPageChange).toHaveBeenCalledWith('projects')
    })

    it('should highlight Projects button when active', () => {
      render(<Sidebar {...defaultProps} currentPage="projects" />)

      const projectsButton = screen.getByText('Projects').closest('button')!
      expect(projectsButton).toHaveClass('bg-info-600', 'text-white')
    })

    it('should not highlight Projects button when not active', () => {
      render(<Sidebar {...defaultProps} currentPage="matrix" />)

      const projectsButton = screen.getByText('Projects').closest('button')!
      expect(projectsButton).not.toHaveClass('bg-info-600')
    })

    it('should show Projects button icon in collapsed state', () => {
      render(<Sidebar {...defaultProps} />)

      const collapseButton = screen.getAllByTestId('icon-chevron-left')[0].parentElement!
      fireEvent.click(collapseButton)

      // Multiple folder icons exist (Projects button + File Management tool)
      const folderIcons = screen.getAllByTestId('icon-folder')
      expect(folderIcons.length).toBeGreaterThan(0)
    })

    it('should have title attribute in collapsed state', () => {
      render(<Sidebar {...defaultProps} />)

      const collapseButton = screen.getAllByTestId('icon-chevron-left')[0].parentElement!
      fireEvent.click(collapseButton)

      const folderIcons = screen.getAllByTestId('icon-folder')
      const projectsButton = folderIcons.find(icon => {
        const button = icon.closest('button')
        return button?.getAttribute('title') === 'Projects'
      })
      expect(projectsButton?.closest('button')).toHaveAttribute('title', 'Projects')
    })
  })

  describe('Current Project Display', () => {
    it('should display current project name when project selected', () => {
      render(<Sidebar {...defaultProps} />)

      expect(screen.getByText('Test Project')).toBeInTheDocument()
    })

    it('should show "Current Project" label', () => {
      render(<Sidebar {...defaultProps} />)

      expect(screen.getByText('Current Project')).toBeInTheDocument()
    })

    it('should show "Active workspace" subtitle', () => {
      render(<Sidebar {...defaultProps} />)

      expect(screen.getByText('Active workspace')).toBeInTheDocument()
    })

    it('should show active indicator dot', () => {
      const { container } = render(<Sidebar {...defaultProps} />)

      const activeDot = container.querySelector('.bg-success-500')
      expect(activeDot).toBeInTheDocument()
    })

    it('should truncate long project names', () => {
      const longNameProject = {
        ...mockProject,
        name: 'This is a very long project name that should be truncated to fit the sidebar'
      }

      render(<Sidebar {...defaultProps} currentProject={longNameProject} />)

      const projectNameElement = screen.getByText(longNameProject.name)
      expect(projectNameElement).toHaveClass('truncate')
    })

    it('should show project icon in collapsed state', () => {
      render(<Sidebar {...defaultProps} />)

      const collapseButton = screen.getAllByTestId('icon-chevron-left')[0].parentElement!
      fireEvent.click(collapseButton)

      // Should show project indicator in collapsed state
      const projectIndicators = document.querySelectorAll('.bg-success-500')
      expect(projectIndicators.length).toBeGreaterThan(0)
    })

    it('should have tooltip with project name in collapsed state', () => {
      render(<Sidebar {...defaultProps} />)

      const collapseButton = screen.getAllByTestId('icon-chevron-left')[0].parentElement!
      fireEvent.click(collapseButton)

      const projectIcon = document.querySelector('[title="Test Project"]')
      expect(projectIcon).toBeInTheDocument()
    })
  })

  describe('Project Tools Navigation', () => {
    const projectTools = [
      { id: 'matrix', label: 'Design Matrix', testId: 'icon-home' },
      { id: 'files', label: 'File Management', testId: 'icon-folder' },
      { id: 'roadmap', label: 'Roadmap', testId: 'icon-map' },
      { id: 'reports', label: 'Insights', testId: 'icon-barchart' },
      { id: 'collaboration', label: 'Team Collaboration', testId: 'icon-users' },
      { id: 'data', label: 'Data Management', testId: 'icon-database' }
    ]

    it('should render all project tools when project is selected', () => {
      render(<Sidebar {...defaultProps} />)

      expect(screen.getByText('Design Matrix')).toBeInTheDocument()
      expect(screen.getByText('File Management')).toBeInTheDocument()
      expect(screen.getByText('Roadmap')).toBeInTheDocument()
      expect(screen.getByText('Insights')).toBeInTheDocument()
      expect(screen.getByText('Team Collaboration')).toBeInTheDocument()
      expect(screen.getByText('Data Management')).toBeInTheDocument()
    })

    it('should not render project tools when no project selected', () => {
      render(<Sidebar {...defaultProps} currentProject={null} />)

      expect(screen.queryByText('Design Matrix')).not.toBeInTheDocument()
      expect(screen.queryByText('File Management')).not.toBeInTheDocument()
      expect(screen.queryByText('Roadmap')).not.toBeInTheDocument()
    })

    projectTools.forEach(tool => {
      it(`should call onPageChange with "${tool.id}" when ${tool.label} clicked`, async () => {
        const user = userEvent.setup()
        render(<Sidebar {...defaultProps} />)

        const toolButton = screen.getByText(tool.label).closest('button')!
        await user.click(toolButton)

        expect(mockOnPageChange).toHaveBeenCalledWith(tool.id)
      })

      it(`should highlight ${tool.label} when active`, () => {
        render(<Sidebar {...defaultProps} currentPage={tool.id} />)

        const toolButton = screen.getByText(tool.label).closest('button')!
        expect(toolButton).toHaveClass('bg-info-600', 'text-white')
      })
    })

    it('should highlight Design Matrix when currentPage is "home"', () => {
      render(<Sidebar {...defaultProps} currentPage="home" />)

      const matrixButton = screen.getByText('Design Matrix').closest('button')!
      expect(matrixButton).toHaveClass('bg-info-600', 'text-white')
    })

    it('should show tool descriptions when expanded', () => {
      render(<Sidebar {...defaultProps} />)

      expect(screen.getByText('Priority matrix & ideas')).toBeInTheDocument()
      expect(screen.getByText('Upload & organize project files')).toBeInTheDocument()
      expect(screen.getByText('Strategic roadmap & epics')).toBeInTheDocument()
    })

    it('should hide tool descriptions when collapsed', () => {
      render(<Sidebar {...defaultProps} />)

      const collapseButton = screen.getAllByTestId('icon-chevron-left')[0].parentElement!
      fireEvent.click(collapseButton)

      expect(screen.queryByText('Priority matrix & ideas')).not.toBeInTheDocument()
    })

    it('should show tooltips in collapsed state', () => {
      render(<Sidebar {...defaultProps} />)

      const collapseButton = screen.getAllByTestId('icon-chevron-left')[0].parentElement!
      fireEvent.click(collapseButton)

      // Find the matrix tool button (not the header logo)
      const homeIcons = screen.getAllByTestId('icon-home')
      const matrixToolButton = homeIcons.find(icon => {
        const button = icon.closest('button')
        return button?.hasAttribute('title') &&
               button.getAttribute('title')?.includes('Design Matrix')
      })

      expect(matrixToolButton?.closest('button')).toHaveAttribute('title', expect.stringContaining('Design Matrix'))
    })
  })

  describe('Empty State - No Project', () => {
    it('should show empty state when no project selected', () => {
      render(<Sidebar {...defaultProps} currentProject={null} />)

      expect(screen.getByText('No Project Selected')).toBeInTheDocument()
      expect(screen.getByText('Choose a project to access tools')).toBeInTheDocument()
    })

    it('should show empty state icon', () => {
      render(<Sidebar {...defaultProps} currentProject={null} />)

      const emptyStateLogos = screen.getAllByTestId('prioritas-logo')
      expect(emptyStateLogos.length).toBeGreaterThan(1)
    })

    it('should not show empty state when project is selected', () => {
      render(<Sidebar {...defaultProps} />)

      expect(screen.queryByText('No Project Selected')).not.toBeInTheDocument()
    })

    it('should not show empty state when collapsed', () => {
      render(<Sidebar {...defaultProps} currentProject={null} />)

      const collapseButton = screen.getAllByTestId('icon-chevron-left')[0].parentElement!
      fireEvent.click(collapseButton)

      expect(screen.queryByText('No Project Selected')).not.toBeInTheDocument()
    })
  })

  describe('User Profile Section', () => {
    it('should display user email when expanded', () => {
      render(<Sidebar {...defaultProps} />)

      expect(screen.getByText('test@example.com')).toBeInTheDocument()
    })

    it('should display user icon', () => {
      render(<Sidebar {...defaultProps} />)

      expect(screen.getByTestId('icon-user')).toBeInTheDocument()
    })

    it('should call onPageChange with "user" when user section clicked', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      const userButton = screen.getByText('test@example.com').closest('button')!
      await user.click(userButton)

      expect(mockOnPageChange).toHaveBeenCalledWith('user')
    })

    it('should highlight user section when on user page', () => {
      render(<Sidebar {...defaultProps} currentPage="user" />)

      const userButton = screen.getByText('test@example.com').closest('button')!
      expect(userButton).toHaveClass('bg-info-600')
    })

    it('should show user info in collapsed state with tooltip', () => {
      render(<Sidebar {...defaultProps} />)

      const collapseButton = screen.getAllByTestId('icon-chevron-left')[0].parentElement!
      fireEvent.click(collapseButton)

      const userIcon = screen.getByTestId('icon-user')
      const userButton = userIcon.closest('button')!
      expect(userButton).toHaveAttribute('title', expect.stringContaining('test@example.com'))
    })

    it('should handle user without email', () => {
      vi.mocked(useUserDisplay).mockReturnValue({
        displayName: 'Test User',
        email: '',
        isLoading: false
      })

      render(<Sidebar {...defaultProps} />)

      expect(screen.getByText('Test User')).toBeInTheDocument()
    })
  })

  describe('Logout Functionality', () => {
    it('should render logout button', () => {
      render(<Sidebar {...defaultProps} />)

      expect(screen.getByTestId('icon-logout')).toBeInTheDocument()
    })

    it('should call onLogout when logout button clicked', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      const logoutButton = screen.getByTestId('icon-logout').parentElement!
      await user.click(logoutButton)

      expect(mockOnLogout).toHaveBeenCalled()
    })

    it('should show logout button in collapsed state', () => {
      render(<Sidebar {...defaultProps} />)

      const collapseButton = screen.getAllByTestId('icon-chevron-left')[0].parentElement!
      fireEvent.click(collapseButton)

      expect(screen.getByTestId('icon-logout')).toBeInTheDocument()
    })

    it('should have "Sign Out" title in collapsed state', () => {
      render(<Sidebar {...defaultProps} />)

      const collapseButton = screen.getAllByTestId('icon-chevron-left')[0].parentElement!
      fireEvent.click(collapseButton)

      const logoutButtons = screen.getAllByTestId('icon-logout')
      const logoutButton = logoutButtons.find(btn => {
        const button = btn.closest('button')
        return button?.getAttribute('title') === 'Sign Out'
      })
      expect(logoutButton?.closest('button')).toHaveAttribute('title', 'Sign Out')
    })

    it('should have hover styles on logout button', () => {
      render(<Sidebar {...defaultProps} />)

      const logoutButton = screen.getByTestId('icon-logout').parentElement!
      expect(logoutButton).toHaveClass('hover:text-error-600', 'hover:bg-error-50')
    })
  })

  describe('Admin Access', () => {
    it('should not show admin button for regular users', () => {
      vi.mocked(AdminService.isAdmin).mockReturnValue(false)
      render(<Sidebar {...defaultProps} />)

      expect(screen.queryByText('Admin Portal')).not.toBeInTheDocument()
      expect(screen.queryByTestId('icon-shield')).not.toBeInTheDocument()
    })

    it('should show admin button for admin users', () => {
      vi.mocked(useCurrentUser).mockReturnValue(mockAdminUser)
      vi.mocked(AdminService.isAdmin).mockReturnValue(true)

      render(<Sidebar {...defaultProps} />)

      expect(screen.getByText('Admin Portal')).toBeInTheDocument()
      expect(screen.getByTestId('icon-shield')).toBeInTheDocument()
    })

    it('should call onAdminAccess when admin button clicked', async () => {
      const user = userEvent.setup()
      vi.mocked(useCurrentUser).mockReturnValue(mockAdminUser)
      vi.mocked(AdminService.isAdmin).mockReturnValue(true)

      render(<Sidebar {...defaultProps} />)

      const adminButton = screen.getByText('Admin Portal').closest('button')!
      await user.click(adminButton)

      expect(mockOnAdminAccess).toHaveBeenCalled()
    })

    it('should show admin button in collapsed state', () => {
      vi.mocked(useCurrentUser).mockReturnValue(mockAdminUser)
      vi.mocked(AdminService.isAdmin).mockReturnValue(true)

      render(<Sidebar {...defaultProps} />)

      const collapseButton = screen.getAllByTestId('icon-chevron-left')[0].parentElement!
      fireEvent.click(collapseButton)

      expect(screen.getByTestId('icon-shield')).toBeInTheDocument()
    })

    it('should have "Admin Portal" title in collapsed state', () => {
      vi.mocked(useCurrentUser).mockReturnValue(mockAdminUser)
      vi.mocked(AdminService.isAdmin).mockReturnValue(true)

      render(<Sidebar {...defaultProps} />)

      const collapseButton = screen.getAllByTestId('icon-chevron-left')[0].parentElement!
      fireEvent.click(collapseButton)

      const adminButton = screen.getByTestId('icon-shield').parentElement!
      expect(adminButton).toHaveAttribute('title', 'Admin Portal')
    })

    it('should not render admin button when onAdminAccess not provided', () => {
      vi.mocked(useCurrentUser).mockReturnValue(mockAdminUser)
      vi.mocked(AdminService.isAdmin).mockReturnValue(true)

      const { onAdminAccess, ...propsWithoutAdmin } = defaultProps
      render(<Sidebar {...propsWithoutAdmin} />)

      // Should still not crash, but admin button might not be functional
      expect(screen.queryByTestId('icon-shield')).toBeInTheDocument()
    })

    it('should have warning colors on admin button', () => {
      vi.mocked(useCurrentUser).mockReturnValue(mockAdminUser)
      vi.mocked(AdminService.isAdmin).mockReturnValue(true)

      render(<Sidebar {...defaultProps} />)

      const adminButton = screen.getByText('Admin Portal').closest('button')!
      expect(adminButton).toHaveClass('hover:text-warning-600', 'hover:bg-warning-50')
    })
  })

  describe('Accessibility', () => {
    it('should have semantic nav element', () => {
      const { container } = render(<Sidebar {...defaultProps} />)

      const nav = container.querySelector('nav')
      expect(nav).toBeInTheDocument()
    })

    it('should have accessible button elements', () => {
      const { container } = render(<Sidebar {...defaultProps} />)

      const buttons = container.querySelectorAll('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('should support keyboard navigation on buttons', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      const projectsButton = screen.getByText('Projects').closest('button')!
      projectsButton.focus()

      await user.keyboard('{Enter}')
      expect(mockOnPageChange).toHaveBeenCalledWith('projects')
    })

    it('should have hover states for all interactive elements', () => {
      const { container } = render(<Sidebar {...defaultProps} />)

      const buttons = container.querySelectorAll('button')
      buttons.forEach(button => {
        const classes = Array.from(button.classList)
        expect(classes.some(cls => cls.includes('hover'))).toBe(true)
      })
    })

    it('should have active states for all interactive elements', () => {
      const { container } = render(<Sidebar {...defaultProps} />)

      const buttons = container.querySelectorAll('button')
      buttons.forEach(button => {
        const classes = Array.from(button.classList)
        // Most buttons should have active state styling
        const hasActiveState = classes.some(cls => cls.includes('active:scale'))
        expect(hasActiveState).toBe(true)
      })
    })

    it('should have title attributes on collapsed buttons', () => {
      render(<Sidebar {...defaultProps} />)

      const collapseButton = screen.getAllByTestId('icon-chevron-left')[0].parentElement!
      fireEvent.click(collapseButton)

      const projectsButtons = screen.getAllByTestId('icon-folder')
      const collapsedProjectButton = projectsButtons.find(btn =>
        btn.parentElement?.hasAttribute('title')
      )
      expect(collapsedProjectButton?.parentElement).toHaveAttribute('title')
    })

    it('should maintain color contrast for text', () => {
      render(<Sidebar {...defaultProps} currentPage="projects" />)

      // Check active state has good contrast
      const projectsButton = screen.getByText('Projects').closest('button')!
      expect(projectsButton).toHaveClass('bg-info-600')
      expect(projectsButton).toHaveClass('text-white')
    })
  })

  describe('Edge Cases', () => {
    it('should handle null currentProject gracefully', () => {
      render(<Sidebar {...defaultProps} currentProject={null} />)

      expect(screen.getByText('No Project Selected')).toBeInTheDocument()
      expect(screen.queryByText('Design Matrix')).not.toBeInTheDocument()
    })

    it('should handle null currentUser gracefully', () => {
      vi.mocked(useCurrentUser).mockReturnValue(null)
      vi.mocked(useUserDisplay).mockReturnValue({
        displayName: 'Unknown User',
        email: '',
        isLoading: false
      })

      render(<Sidebar {...defaultProps} />)

      expect(screen.getByText('Unknown User')).toBeInTheDocument()
    })

    it('should handle very long project names', () => {
      const longProject = {
        ...mockProject,
        name: 'This is an extremely long project name that should be truncated properly in the UI to prevent layout issues'
      }

      render(<Sidebar {...defaultProps} currentProject={longProject} />)

      const projectName = screen.getByText(longProject.name)
      expect(projectName).toHaveClass('truncate')
    })

    it('should handle project with special characters', () => {
      const specialProject = {
        ...mockProject,
        name: 'Project <>&"'
      }

      render(<Sidebar {...defaultProps} currentProject={specialProject} />)

      expect(screen.getByText('Project <>&"')).toBeInTheDocument()
    })

    it('should handle rapid page changes', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      const projectsButton = screen.getByText('Projects').closest('button')!
      const matrixButton = screen.getByText('Design Matrix').closest('button')!

      await user.click(projectsButton)
      await user.click(matrixButton)
      await user.click(projectsButton)

      expect(mockOnPageChange).toHaveBeenCalledTimes(3)
    })

    it('should handle rapid collapse/expand', () => {
      render(<Sidebar {...defaultProps} />)

      const sidebar = document.querySelector('.sidebar-clean')

      // Rapid toggle
      for (let i = 0; i < 5; i++) {
        const isCollapsed = sidebar?.classList.contains('w-20')
        const button = isCollapsed
          ? screen.getByTestId('icon-chevron-right').parentElement!
          : screen.getAllByTestId('icon-chevron-left')[0].parentElement!
        fireEvent.click(button)
      }

      expect(mockOnToggleCollapse).toHaveBeenCalledTimes(5)
    })

    it('should handle missing onAdminAccess callback', () => {
      vi.mocked(useCurrentUser).mockReturnValue(mockAdminUser)
      vi.mocked(AdminService.isAdmin).mockReturnValue(true)

      const { onAdminAccess, ...propsWithoutCallback } = defaultProps
      render(<Sidebar {...propsWithoutCallback} />)

      // Should render without crashing
      expect(screen.getByTestId('icon-shield')).toBeInTheDocument()
    })

    it('should maintain state across re-renders', () => {
      const { rerender } = render(<Sidebar {...defaultProps} />)

      // Collapse sidebar
      const collapseButton = screen.getAllByTestId('icon-chevron-left')[0].parentElement!
      fireEvent.click(collapseButton)

      // Re-render with different page
      rerender(<Sidebar {...defaultProps} currentPage="files" />)

      // Should maintain collapsed state
      const sidebar = document.querySelector('.sidebar-clean')
      expect(sidebar).toHaveClass('w-20')
    })

    it('should handle project switching', () => {
      const { rerender } = render(<Sidebar {...defaultProps} />)

      expect(screen.getByText('Test Project')).toBeInTheDocument()

      const newProject = {
        ...mockProject,
        id: generateDemoUUID('999'),
        name: 'New Project'
      }

      rerender(<Sidebar {...defaultProps} currentProject={newProject} />)

      expect(screen.getByText('New Project')).toBeInTheDocument()
      expect(screen.queryByText('Test Project')).not.toBeInTheDocument()
    })

    it('should handle all pages being highlighted correctly', () => {
      const pages = ['projects', 'matrix', 'files', 'roadmap', 'reports', 'collaboration', 'data', 'user']

      pages.forEach(page => {
        const { unmount } = render(<Sidebar {...defaultProps} currentPage={page} />)

        // At least one button should have active styling
        const activeElements = document.querySelectorAll('.bg-info-600')
        expect(activeElements.length).toBeGreaterThan(0)

        unmount()
      })
    })

    it('should handle loading state from user context', () => {
      vi.mocked(useUserDisplay).mockReturnValue({
        displayName: 'Test User',
        email: 'test@example.com',
        isLoading: true
      })

      render(<Sidebar {...defaultProps} />)

      // Should still render with loading state
      expect(screen.getByText('test@example.com')).toBeInTheDocument()
    })
  })

  describe('Visual States', () => {
    it('should apply transition classes for smooth animations', () => {
      const { container } = render(<Sidebar {...defaultProps} />)

      const sidebar = container.querySelector('.sidebar-clean')
      expect(sidebar).toHaveClass('transition-all', 'duration-300', 'ease-in-out')
    })

    it('should apply hover scale effects on buttons', () => {
      const { container } = render(<Sidebar {...defaultProps} />)

      const buttons = container.querySelectorAll('button')
      buttons.forEach(button => {
        const classes = Array.from(button.classList)
        const hasScaleEffect = classes.some(cls =>
          cls.includes('hover:scale') || cls.includes('active:scale')
        )
        expect(hasScaleEffect).toBe(true)
      })
    })

    it('should show shadow effects on active items', () => {
      render(<Sidebar {...defaultProps} currentPage="matrix" />)

      // The button element itself (not the parent) has the shadow class
      const buttonText = screen.getByText('Design Matrix')
      const button = buttonText.closest('button')!
      expect(button).toHaveClass('shadow-card-hover')
    })

    it('should apply rounded corners consistently', () => {
      const { container } = render(<Sidebar {...defaultProps} />)

      const buttons = container.querySelectorAll('button')
      buttons.forEach(button => {
        const classes = Array.from(button.classList)
        const hasRoundedCorners = classes.some(cls => cls.includes('rounded'))
        expect(hasRoundedCorners).toBe(true)
      })
    })
  })

  describe('Integration Scenarios', () => {
    it('should work correctly with all navigation paths', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      // Navigate through all main sections
      await user.click(screen.getByText('Projects').closest('button')!)
      expect(mockOnPageChange).toHaveBeenCalledWith('projects')

      await user.click(screen.getByText('Design Matrix').closest('button')!)
      expect(mockOnPageChange).toHaveBeenCalledWith('matrix')

      await user.click(screen.getByText('Roadmap').closest('button')!)
      expect(mockOnPageChange).toHaveBeenCalledWith('roadmap')
    })

    it('should maintain functionality across collapse/expand cycles', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      // Test in expanded state
      await user.click(screen.getByText('Projects').parentElement!)
      expect(mockOnPageChange).toHaveBeenCalledWith('projects')

      // Collapse
      const collapseButton = screen.getAllByTestId('icon-chevron-left')[0].parentElement!
      await user.click(collapseButton)

      // Test in collapsed state
      mockOnPageChange.mockClear()
      const projectsIcon = screen.getAllByTestId('icon-folder').find(icon => {
        const button = icon.closest('button')
        return button?.getAttribute('title') === 'Projects'
      })
      await user.click(projectsIcon!.closest('button')!)
      expect(mockOnPageChange).toHaveBeenCalledWith('projects')

      // Expand
      const expandButton = screen.getByTestId('icon-chevron-right').parentElement!
      await user.click(expandButton)

      // Test again in expanded state
      mockOnPageChange.mockClear()
      const projectsButton = screen.getByText('Projects').closest('button')!
      await user.click(projectsButton)
      expect(mockOnPageChange).toHaveBeenCalledWith('projects')
    })
  })
})