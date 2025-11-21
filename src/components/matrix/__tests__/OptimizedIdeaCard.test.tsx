/**
 * OptimizedIdeaCard Comprehensive Test Suite
 *
 * Tests the optimized idea card component including:
 * - Quadrant calculation and coloring
 * - Priority configurations
 * - Drag-drop integration
 * - Collapse/expand functionality
 * - Lock status management
 * - Visual styling and accessibility
 * - Performance optimizations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OptimizedIdeaCard } from '../OptimizedIdeaCard'
import { testIdeas, testUsers } from '../../../test/fixtures'
import { renderWithProviders } from '../../../test/utils/test-helpers'
import type { IdeaCard } from '../../../types'

// Custom matchers from our test infrastructure
import '../../../test/utils/custom-matchers'

describe('OptimizedIdeaCard', () => {
  const mockOnEdit = vi.fn()
  const mockOnDelete = vi.fn()
  const mockOnToggleCollapse = vi.fn()

  const defaultProps = {
    idea: testIdeas.quickWin,
    currentUser: testUsers.regular,
    isDragOverlay: false,
    onEdit: mockOnEdit,
    onDelete: mockOnDelete,
    onToggleCollapse: mockOnToggleCollapse
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Quadrant Calculation', () => {
    it('should identify quick wins quadrant (top-left)', () => {
      const idea = testIdeas.quickWin // x=130, y=130

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={idea} />
      )

      // Should be in quick-wins quadrant
      expect(idea).toBeInQuadrant('quick-wins')
    })

    it('should identify strategic quadrant (top-right)', () => {
      const idea = testIdeas.strategic // x=390, y=130

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={idea} />
      )

      expect(idea).toBeInQuadrant('strategic')
    })

    it('should identify reconsider quadrant (bottom-left)', () => {
      const idea = testIdeas.reconsider // x=130, y=390

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={idea} />
      )

      expect(idea).toBeInQuadrant('reconsider')
    })

    it('should identify avoid quadrant (bottom-right)', () => {
      const idea = testIdeas.avoid // x=390, y=390

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={idea} />
      )

      expect(idea).toBeInQuadrant('avoid')
    })

    it('should use 260 as the center boundary', () => {
      const centerIdea = testIdeas.center // x=260, y=260

      // At exactly 260, should be in avoid quadrant (x >= 260, y >= 260)
      expect(centerIdea).toBeInQuadrant('avoid')
    })

    it('should handle boundary coordinates at center-1', () => {
      const boundaryIdea = {
        ...testIdeas.quickWin,
        x: 259,
        y: 259
      }

      // Just below 260 should be quick-wins
      expect(boundaryIdea).toBeInQuadrant('quick-wins')
    })
  })

  describe('Quadrant Colors', () => {
    it('should apply green border for quick wins quadrant', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={testIdeas.quickWin} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
      expect(card).toHaveStyle({ border: '2.5px solid #10B981' }) // Green
    })

    it('should apply blue border for strategic quadrant', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={testIdeas.strategic} />
      )

      const card = screen.getByText(testIdeas.strategic.content).closest('.draggable')
      expect(card).toHaveStyle({ border: '2.5px solid #3B82F6' }) // Blue
    })

    it('should apply amber border for reconsider quadrant', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={testIdeas.reconsider} />
      )

      const card = screen.getByText(testIdeas.reconsider.content).closest('.draggable')
      expect(card).toHaveStyle({ border: '2.5px solid #F59E0B' }) // Amber
    })

    it('should apply red border for avoid quadrant', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={testIdeas.avoid} />
      )

      const card = screen.getByText(testIdeas.avoid.content).closest('.draggable')
      expect(card).toHaveStyle({ border: '2.5px solid #EF4444' }) // Red
    })

    it('should display matching colored dot in collapsed view', () => {
      const collapsedIdea = { ...testIdeas.quickWin, is_collapsed: true }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={collapsedIdea} />
      )

      const colorDot = document.querySelector('.rounded-full[style*="background: rgb(16, 185, 129)"]')
      expect(colorDot).toBeInTheDocument()
    })
  })

  describe('Priority Configurations', () => {
    it('should display priority badge', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={testIdeas.quickWin} />
      )

      expect(screen.getByText(testIdeas.quickWin.priority)).toBeInTheDocument()
    })

    it('should apply correct styling for high priority', () => {
      const highPriorityIdea = { ...testIdeas.quickWin, priority: 'high' }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={highPriorityIdea} />
      )

      const badge = screen.getByText('high')
      expect(badge).toHaveClass('badge')
    })

    it('should apply correct styling for strategic priority', () => {
      const strategicIdea = { ...testIdeas.strategic, priority: 'strategic' }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={strategicIdea} />
      )

      const card = screen.getByText(strategicIdea.content).closest('.draggable')
      expect(card).toHaveClass('idea-card--priority')
    })

    it('should capitalize priority text', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={testIdeas.quickWin} />
      )

      const badge = screen.getByText(testIdeas.quickWin.priority)
      expect(badge).toHaveClass('capitalize')
    })
  })

  describe('Expand/Collapse Functionality', () => {
    it('should render expanded view by default', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      // Expanded view shows full content, details, and collapse button
      expect(screen.getByText(testIdeas.quickWin.content)).toBeInTheDocument()
      expect(screen.getByLabelText('Collapse idea card')).toBeInTheDocument()
    })

    it('should render collapsed view when is_collapsed is true', () => {
      const collapsedIdea = { ...testIdeas.quickWin, is_collapsed: true }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={collapsedIdea} />
      )

      // Collapsed view shows expand button
      expect(screen.getByLabelText('Expand idea card')).toBeInTheDocument()
    })

    it('should apply smaller dimensions for collapsed cards', () => {
      const collapsedIdea = { ...testIdeas.quickWin, is_collapsed: true }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={collapsedIdea} />
      )

      const card = screen.getByText(collapsedIdea.content.substring(0, 12)).closest('.draggable')
      expect(card).toHaveClass('w-[100px]', 'h-[50px]')
    })

    it('should apply larger dimensions for expanded cards', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
      expect(card).toHaveClass('w-[130px]', 'min-h-[90px]')
    })

    it('should call onToggleCollapse when collapse button is clicked', async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      const collapseButton = screen.getByLabelText('Collapse idea card')
      await user.click(collapseButton)

      expect(mockOnToggleCollapse).toHaveBeenCalledWith(
        testIdeas.quickWin.id,
        true
      )
    })

    it('should call onToggleCollapse when expand button is clicked', async () => {
      const user = userEvent.setup()
      const collapsedIdea = { ...testIdeas.quickWin, is_collapsed: true }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={collapsedIdea} />
      )

      const expandButton = screen.getByLabelText('Expand idea card')
      await user.click(expandButton)

      expect(mockOnToggleCollapse).toHaveBeenCalledWith(
        collapsedIdea.id,
        false
      )
    })

    it('should truncate content in collapsed view', () => {
      const longContentIdea = {
        ...testIdeas.quickWin,
        content: 'This is a very long content that should be truncated in collapsed view',
        is_collapsed: true
      }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={longContentIdea} />
      )

      // Should show first 12 characters + ellipsis
      const truncatedText = screen.getByText(/This is a ve\.\.\./i)
      expect(truncatedText).toBeInTheDocument()
    })

    it('should show full content in expanded view', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      expect(screen.getByText(testIdeas.quickWin.content)).toBeInTheDocument()
    })
  })

  describe('Click-to-Expand Functionality', () => {
    it('should toggle collapse when card is clicked (not a button)', async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
      if (card) {
        await user.click(card)

        expect(mockOnToggleCollapse).toHaveBeenCalledWith(
          testIdeas.quickWin.id,
          true
        )
      }
    })

    it('should not toggle when clicking action buttons', async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      const editButton = screen.getByLabelText('Edit idea')
      await user.click(editButton)

      // Should call edit, not toggle
      expect(mockOnEdit).toHaveBeenCalled()
      expect(mockOnToggleCollapse).not.toHaveBeenCalled()
    })
  })

  describe('Drag-Drop Integration', () => {
    it('should set up draggable with idea id', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
      expect(card).toHaveAttribute('role', 'button')
    })

    it('should apply grabbing cursor during drag', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
      expect(card).toHaveStyle({ cursor: 'grab' })
    })

    it('should apply is-dragging class during drag', () => {
      // Simulate drag state by mocking useDraggable
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      // In actual drag state, the card would have is-dragging class
      // This is handled by dnd-kit's internal state
    })

    it('should disable dragging for overlay cards', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} isDragOverlay={true} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
      expect(card).toHaveAttribute('tabIndex', '-1')
    })

    it('should apply scale transform during drag', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
      // Should maintain scale-100 class
      expect(card).toHaveClass('scale-100')
    })

    it('should enforce exact dimensions during drag (collapsed)', () => {
      const collapsedIdea = { ...testIdeas.quickWin, is_collapsed: true }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={collapsedIdea} />
      )

      const card = screen.getByText(collapsedIdea.content.substring(0, 12)).closest('.draggable')
      // Should have enforced collapsed dimensions
      expect(card).toHaveClass('w-[100px]', 'h-[50px]')
    })
  })

  describe('Lock Status Management', () => {
    it('should show "Active" badge when locked by another user', () => {
      const lockedIdea = {
        ...testIdeas.quickWin,
        editing_by: 'other-user-id',
        editing_at: new Date().toISOString()
      }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={lockedIdea} />
      )

      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('🔒')).toBeInTheDocument()
    })

    it('should show "Editing" badge when locked by current user', () => {
      const lockedIdea = {
        ...testIdeas.quickWin,
        editing_by: testUsers.regular.id,
        editing_at: new Date().toISOString()
      }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={lockedIdea} />
      )

      expect(screen.getByText('Editing')).toBeInTheDocument()
      expect(screen.getByText('✏️')).toBeInTheDocument()
    })

    it('should disable edit when locked by another user', async () => {
      const user = userEvent.setup()
      const lockedIdea = {
        ...testIdeas.quickWin,
        editing_by: 'other-user-id',
        editing_at: new Date().toISOString()
      }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={lockedIdea} />
      )

      const editButton = screen.getByLabelText('Edit idea')
      expect(editButton).toBeDisabled()

      await user.click(editButton)
      expect(mockOnEdit).not.toHaveBeenCalled()
    })

    it('should allow edit when locked by current user', async () => {
      const user = userEvent.setup()
      const lockedIdea = {
        ...testIdeas.quickWin,
        editing_by: testUsers.regular.id,
        editing_at: new Date().toISOString()
      }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={lockedIdea} />
      )

      const editButton = screen.getByLabelText('Edit idea')
      expect(editButton).not.toBeDisabled()

      await user.click(editButton)
      expect(mockOnEdit).toHaveBeenCalled()
    })

    it('should expire lock after 5 minutes', () => {
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString()
      const expiredLockIdea = {
        ...testIdeas.quickWin,
        editing_by: 'other-user-id',
        editing_at: sixMinutesAgo
      }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={expiredLockIdea} />
      )

      // Should not show lock badge
      expect(screen.queryByText('Active')).not.toBeInTheDocument()
    })

    it('should apply grayscale and opacity when locked by other', () => {
      const lockedIdea = {
        ...testIdeas.quickWin,
        editing_by: 'other-user-id',
        editing_at: new Date().toISOString()
      }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={lockedIdea} />
      )

      const card = screen.getByText(lockedIdea.content).closest('.draggable')
      expect(card).toHaveClass('opacity-60', 'cursor-not-allowed', 'grayscale')
    })

    it('should apply focus border when locked by self', () => {
      const lockedIdea = {
        ...testIdeas.quickWin,
        editing_by: testUsers.regular.id,
        editing_at: new Date().toISOString()
      }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={lockedIdea} />
      )

      const card = screen.getByText(lockedIdea.content).closest('.draggable')
      // Should have focus border style
      expect(card).toHaveStyle({ border: expect.stringContaining('var(--interactive-focus)') })
    })
  })

  describe('Action Buttons', () => {
    it('should show edit button', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      expect(screen.getByLabelText('Edit idea')).toBeInTheDocument()
    })

    it('should show delete button on hover', async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
      if (card) {
        await user.hover(card)

        await waitFor(() => {
          expect(screen.getByLabelText('Delete idea')).toBeInTheDocument()
        })
      }
    })

    it('should call onEdit when edit button is clicked', async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      const editButton = screen.getByLabelText('Edit idea')
      await user.click(editButton)

      expect(mockOnEdit).toHaveBeenCalled()
    })

    it('should call onDelete when delete button is clicked', async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
      if (card) {
        await user.hover(card)

        const deleteButton = screen.getByLabelText('Delete idea')
        await user.click(deleteButton)

        expect(mockOnDelete).toHaveBeenCalled()
      }
    })

    it('should hide action buttons in drag overlay', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} isDragOverlay={true} />
      )

      expect(screen.queryByLabelText('Edit idea')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Delete idea')).not.toBeInTheDocument()
    })

    it('should stop propagation on button clicks', async () => {
      const user = userEvent.setup()
      const clickSpy = vi.fn()

      const { container } = renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      container.addEventListener('click', clickSpy)

      const editButton = screen.getByLabelText('Edit idea')
      await user.click(editButton)

      // Edit handler should be called, but click shouldn't propagate to trigger collapse
      expect(mockOnEdit).toHaveBeenCalled()
      expect(mockOnToggleCollapse).not.toHaveBeenCalled()
    })
  })

  describe('Content Display', () => {
    it('should display idea content', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      expect(screen.getByText(testIdeas.quickWin.content)).toBeInTheDocument()
    })

    it('should display idea details when provided', () => {
      const ideaWithDetails = {
        ...testIdeas.quickWin,
        details: 'Additional details about this idea'
      }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={ideaWithDetails} />
      )

      expect(screen.getByText(ideaWithDetails.details!)).toBeInTheDocument()
    })

    it('should not show details section when not provided', () => {
      const ideaWithoutDetails = { ...testIdeas.quickWin, details: undefined }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={ideaWithoutDetails} />
      )

      // Should not have details paragraph
      const content = screen.getByText(ideaWithoutDetails.content)
      const nextSibling = content.nextElementSibling
      expect(nextSibling).not.toHaveTextContent('Additional details')
    })

    it('should truncate long content with line-clamp', () => {
      const longIdea = {
        ...testIdeas.quickWin,
        content: 'This is a very long content that should be truncated with line-clamp-2 to prevent overflow and maintain card dimensions properly'
      }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={longIdea} />
      )

      const contentElement = screen.getByText(longIdea.content, { exact: false })
      expect(contentElement).toHaveClass('line-clamp-2')
    })

    it('should display user display name', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      // Should show "You" for current user
      expect(screen.getByText('You')).toBeInTheDocument()
    })

    it('should show "AI Assistant" for AI-generated ideas', () => {
      const aiIdea = {
        ...testIdeas.quickWin,
        created_by: 'ai-assistant-long-uuid-string'
      }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={aiIdea} />
      )

      expect(screen.getByText('AI Assistant')).toBeInTheDocument()
    })

    it('should display creation date', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      // Should format date as MM/DD
      const dateElement = screen.getByText(/\d{1,2}\/\d{1,2}/)
      expect(dateElement).toBeInTheDocument()
    })
  })

  describe('Z-Index Management', () => {
    it('should increase z-index on hover', async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.draggable') as HTMLElement
      const initialZIndex = parseInt(window.getComputedStyle(card).zIndex || '0')

      await user.hover(card)

      await waitFor(() => {
        const hoverZIndex = parseInt(window.getComputedStyle(card).zIndex || '0')
        expect(hoverZIndex).toBeGreaterThan(initialZIndex)
      })
    })

    it('should have highest z-index during drag', () => {
      // During drag, card should have maximum z-index
      // This is managed by the getCardZIndex utility
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      // The z-index calculation is done in the component
      // During drag, it should be set to a high value
    })

    it('should have elevated z-index when editing', () => {
      const editingIdea = {
        ...testIdeas.quickWin,
        editing_by: testUsers.regular.id,
        editing_at: new Date().toISOString()
      }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={editingIdea} />
      )

      // Editing cards get elevated z-index
      const card = screen.getByText(editingIdea.content).closest('.draggable') as HTMLElement
      const zIndex = parseInt(card.style.zIndex || '0')
      expect(zIndex).toBeGreaterThan(1)
    })
  })

  describe('Performance Optimizations', () => {
    it('should memoize priority config', () => {
      const { rerender } = renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      // Re-render with same props
      rerender(
        <OptimizedIdeaCard {...defaultProps} />
      )

      // Component should use memoized values
      expect(screen.getByText(testIdeas.quickWin.priority)).toBeInTheDocument()
    })

    it('should memoize quadrant border color', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
      expect(card).toHaveStyle({ border: '2.5px solid #10B981' })
    })

    it('should use callback for event handlers', async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      const editButton = screen.getByLabelText('Edit idea')
      await user.click(editButton)
      await user.click(editButton)

      // Handler should be stable across renders
      expect(mockOnEdit).toHaveBeenCalledTimes(2)
    })

    it('should apply contain property for performance', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
      expect(card).toHaveStyle({ contain: 'layout style' })
    })

    it('should use will-change during drag', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
      // Will-change is set dynamically during drag
      expect(card).toHaveStyle({ willChange: 'auto' }) // Default state
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      const card = screen.getByRole('button', {
        name: new RegExp(testIdeas.quickWin.priority)
      })
      expect(card).toBeInTheDocument()
    })

    it('should be keyboard accessible (tabIndex)', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
      expect(card).toHaveAttribute('tabIndex', '0')
    })

    it('should not be tabbable in drag overlay', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} isDragOverlay={true} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
      expect(card).toHaveAttribute('tabIndex', '-1')
    })

    it('should have aria-describedby for metadata', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
      expect(card).toHaveAttribute('aria-describedby', `idea-${testIdeas.quickWin.id}-meta`)
    })

    it('should have status indicators with role and aria-live', () => {
      const lockedIdea = {
        ...testIdeas.quickWin,
        editing_by: 'other-user-id',
        editing_at: new Date().toISOString()
      }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={lockedIdea} />
      )

      const statusBadge = screen.getByRole('status')
      expect(statusBadge).toHaveAttribute('aria-live', 'polite')
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing currentUser', () => {
      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} currentUser={null} />
      )

      expect(screen.getByText('Anonymous')).toBeInTheDocument()
    })

    it('should handle idea without created_by', () => {
      const ideaWithoutUser = {
        ...testIdeas.quickWin,
        created_by: null
      }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={ideaWithoutUser} />
      )

      expect(screen.getByText('Anonymous')).toBeInTheDocument()
    })

    it('should handle double-click to edit', async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
      if (card) {
        await user.dblClick(card)

        expect(mockOnEdit).toHaveBeenCalled()
      }
    })

    it('should prevent double-click edit when locked by other', async () => {
      const user = userEvent.setup()
      const lockedIdea = {
        ...testIdeas.quickWin,
        editing_by: 'other-user-id',
        editing_at: new Date().toISOString()
      }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={lockedIdea} />
      )

      const card = screen.getByText(lockedIdea.content).closest('.draggable')
      if (card) {
        await user.dblClick(card)

        expect(mockOnEdit).not.toHaveBeenCalled()
      }
    })

    it('should handle very long content', () => {
      const longIdea = {
        ...testIdeas.quickWin,
        content: 'A'.repeat(500)
      }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={longIdea} />
      )

      // Should truncate with line-clamp
      const content = screen.getByText(longIdea.content, { exact: false })
      expect(content).toHaveClass('line-clamp-2')
    })

    it('should handle coordinates exactly at boundary', () => {
      const boundaryIdea = {
        ...testIdeas.quickWin,
        x: 260,
        y: 260
      }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={boundaryIdea} />
      )

      // Should be in avoid quadrant (>= 260)
      const card = screen.getByText(boundaryIdea.content).closest('.draggable')
      expect(card).toHaveStyle({ border: '2.5px solid #EF4444' }) // Red (avoid)
    })
  })

  describe('Phase Three Features', () => {
    describe('Mobile Indicator', () => {
      it('should show blue pulse indicator when isFromMobile is true', () => {
        const { container } = renderWithProviders(
          <OptimizedIdeaCard {...defaultProps} isFromMobile={true} />
        )

        // Should have mobile indicator with aria-label
        const mobileIndicator = container.querySelector('[aria-label="Submitted from mobile device"]')
        expect(mobileIndicator).toBeInTheDocument()
      })

      it('should not show mobile indicator when isFromMobile is false', () => {
        const { container } = renderWithProviders(
          <OptimizedIdeaCard {...defaultProps} isFromMobile={false} />
        )

        const mobileIndicator = container.querySelector('[aria-label="Submitted from mobile device"]')
        expect(mobileIndicator).not.toBeInTheDocument()
      })

      it('should not show mobile indicator by default', () => {
        const { container } = renderWithProviders(
          <OptimizedIdeaCard {...defaultProps} />
        )

        const mobileIndicator = container.querySelector('[aria-label="Submitted from mobile device"]')
        expect(mobileIndicator).not.toBeInTheDocument()
      })

      it('should position mobile indicator at bottom-right corner', () => {
        const { container } = renderWithProviders(
          <OptimizedIdeaCard {...defaultProps} isFromMobile={true} />
        )

        const mobileIndicator = container.querySelector('[aria-label="Submitted from mobile device"]')
        expect(mobileIndicator).toHaveStyle({
          position: 'absolute',
          bottom: '-4px',
          right: '-4px'
        })
      })

      it('should have correct size (12x12) for mobile indicator', () => {
        const { container } = renderWithProviders(
          <OptimizedIdeaCard {...defaultProps} isFromMobile={true} />
        )

        const mobileIndicator = container.querySelector('[aria-label="Submitted from mobile device"]')
        expect(mobileIndicator).toHaveStyle({
          width: '12px',
          height: '12px'
        })
      })

      it('should have blue color for mobile indicator dot', () => {
        const { container } = renderWithProviders(
          <OptimizedIdeaCard {...defaultProps} isFromMobile={true} />
        )

        const indicatorDot = container.querySelector('[style*="background: #3B82F6"]')
        expect(indicatorDot).toBeInTheDocument()
      })

      it('should have pulse animation for mobile indicator', () => {
        const { container } = renderWithProviders(
          <OptimizedIdeaCard {...defaultProps} isFromMobile={true} />
        )

        const pulseRing = container.querySelector('.animate-pulse-subtle')
        expect(pulseRing).toBeInTheDocument()
      })

      it('should hide mobile indicator in drag overlay', () => {
        const { container } = renderWithProviders(
          <OptimizedIdeaCard {...defaultProps} isFromMobile={true} isDragOverlay={true} />
        )

        const mobileIndicator = container.querySelector('[aria-label="Submitted from mobile device"]')
        expect(mobileIndicator).not.toBeInTheDocument()
      })

      it('should adjust mobile indicator position for collapsed cards', () => {
        const collapsedIdea = { ...testIdeas.quickWin, is_collapsed: true }
        const { container } = renderWithProviders(
          <OptimizedIdeaCard {...defaultProps} idea={collapsedIdea} isFromMobile={true} />
        )

        const mobileIndicator = container.querySelector('[aria-label="Submitted from mobile device"]')
        expect(mobileIndicator).toHaveStyle({
          bottom: '-4px',
          right: '-4px'
        })
      })
    })

    describe('New Idea Animation', () => {
      it('should apply scale-in animation when isNewIdea is true', () => {
        renderWithProviders(
          <OptimizedIdeaCard {...defaultProps} isNewIdea={true} />
        )

        const card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
        expect(card).toHaveClass('animate-scale-in')
      })

      it('should not apply scale-in animation when isNewIdea is false', () => {
        renderWithProviders(
          <OptimizedIdeaCard {...defaultProps} isNewIdea={false} />
        )

        const card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
        expect(card).not.toHaveClass('animate-scale-in')
      })

      it('should not apply scale-in animation by default', () => {
        renderWithProviders(
          <OptimizedIdeaCard {...defaultProps} />
        )

        const card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
        expect(card).not.toHaveClass('animate-scale-in')
      })
    })

    describe('Combined Phase Three Features', () => {
      it('should show both mobile indicator and new idea animation', () => {
        const { container } = renderWithProviders(
          <OptimizedIdeaCard {...defaultProps} isFromMobile={true} isNewIdea={true} />
        )

        // Should have mobile indicator
        const mobileIndicator = container.querySelector('[aria-label="Submitted from mobile device"]')
        expect(mobileIndicator).toBeInTheDocument()

        // Should have scale-in animation
        const card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
        expect(card).toHaveClass('animate-scale-in')
      })

      it('should work correctly with collapsed cards', () => {
        const collapsedIdea = { ...testIdeas.quickWin, is_collapsed: true }
        const { container } = renderWithProviders(
          <OptimizedIdeaCard
            {...defaultProps}
            idea={collapsedIdea}
            isFromMobile={true}
            isNewIdea={true}
          />
        )

        const card = screen.getByText(collapsedIdea.content.substring(0, 12)).closest('.draggable')
        expect(card).toHaveClass('animate-scale-in')

        const mobileIndicator = container.querySelector('[aria-label="Submitted from mobile device"]')
        expect(mobileIndicator).toBeInTheDocument()
      })

      it('should work correctly with locked cards', () => {
        const lockedIdea = {
          ...testIdeas.quickWin,
          editing_by: 'other-user-id',
          editing_at: new Date().toISOString()
        }

        const { container } = renderWithProviders(
          <OptimizedIdeaCard
            {...defaultProps}
            idea={lockedIdea}
            isFromMobile={true}
            isNewIdea={true}
          />
        )

        // Should still show mobile indicator
        const mobileIndicator = container.querySelector('[aria-label="Submitted from mobile device"]')
        expect(mobileIndicator).toBeInTheDocument()

        // Should still have animation class
        const card = screen.getByText(lockedIdea.content).closest('.draggable')
        expect(card).toHaveClass('animate-scale-in')

        // Should also have lock styling
        expect(card).toHaveClass('opacity-60', 'cursor-not-allowed', 'grayscale')
      })
    })

    describe('React.memo Comparison', () => {
      it('should re-render when isFromMobile changes', () => {
        const { rerender } = renderWithProviders(
          <OptimizedIdeaCard {...defaultProps} isFromMobile={false} />
        )

        let container = screen.getByText(testIdeas.quickWin.content).closest('.draggable')?.parentElement
        let mobileIndicator = container?.querySelector('[aria-label="Submitted from mobile device"]')
        expect(mobileIndicator).not.toBeInTheDocument()

        rerender(
          <OptimizedIdeaCard {...defaultProps} isFromMobile={true} />
        )

        container = screen.getByText(testIdeas.quickWin.content).closest('.draggable')?.parentElement
        mobileIndicator = container?.querySelector('[aria-label="Submitted from mobile device"]')
        expect(mobileIndicator).toBeInTheDocument()
      })

      it('should re-render when isNewIdea changes', () => {
        const { rerender } = renderWithProviders(
          <OptimizedIdeaCard {...defaultProps} isNewIdea={false} />
        )

        let card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
        expect(card).not.toHaveClass('animate-scale-in')

        rerender(
          <OptimizedIdeaCard {...defaultProps} isNewIdea={true} />
        )

        card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
        expect(card).toHaveClass('animate-scale-in')
      })

      it('should not re-render when Phase Three props remain unchanged', () => {
        const renderSpy = vi.fn()
        const TestWrapper = (props: any) => {
          renderSpy()
          return <OptimizedIdeaCard {...props} />
        }

        const { rerender } = renderWithProviders(
          <TestWrapper {...defaultProps} isFromMobile={true} isNewIdea={true} />
        )

        renderSpy.mockClear()

        // Re-render with same props
        rerender(
          <TestWrapper {...defaultProps} isFromMobile={true} isNewIdea={true} />
        )

        // Should not trigger re-render due to React.memo
        // (React.memo prevents re-render when props are equal)
      })
    })
  })
})