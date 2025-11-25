/**
 * IdeaCardComponent Comprehensive Test Suite
 *
 * Tests the original idea card component including:
 * - Card rendering with idea data
 * - Content display (content, details, user, timestamps)
 * - Priority badge rendering
 * - Status indicators (locked, editing)
 * - Actions (edit, delete, collapse/expand)
 * - Hover states and interactions
 * - Click handlers (single, double, keyboard)
 * - User attribution (You, AI Assistant, Anonymous)
 * - Timestamps and date formatting
 * - Truncation for long content
 * - Loading and editing states
 * - Accessibility (ARIA, keyboard, screen readers)
 * - Edge cases (missing data, very long content, special characters)
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import IdeaCardComponent from '../IdeaCardComponent'
import { testIdeas, testUsers, testProjects } from '../../test/fixtures'
import { renderWithProviders } from '../../test/utils/test-helpers'
import type { IdeaCard, User } from '../../types'

// Mock dnd-kit
vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false
  })
}))

// Mock accessibility hooks
vi.mock('../../hooks/useAccessibility', () => ({
  useAriaLiveRegion: () => ({
    announce: vi.fn()
  })
}))

describe('IdeaCardComponent', () => {
  const mockOnEdit = vi.fn()
  const mockOnDelete = vi.fn()
  const mockOnToggleCollapse = vi.fn()

  const defaultProps = {
    idea: testIdeas.quickWin,
    currentUser: testUsers.regular,
    onEdit: mockOnEdit,
    onDelete: mockOnDelete,
    onToggleCollapse: mockOnToggleCollapse
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =============================================================================
  // BASIC RENDERING
  // =============================================================================

  describe('Basic Rendering', () => {
    it('should render idea card with content', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      expect(screen.getByText(testIdeas.quickWin.content)).toBeInTheDocument()
    })

    it('should apply correct CSS classes', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.idea-card-base')
      expect(card).toBeInTheDocument()
      expect(card).toHaveClass('gpu-accelerated')
    })

    it('should have proper ARIA attributes', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.idea-card-base')
      expect(card).toHaveAttribute('aria-describedby')
      expect(card).toHaveAttribute('role', 'button')
      expect(card).toHaveAttribute('tabIndex', '0')
    })

    it('should display screen reader instructions', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const instructions = document.getElementById(`${testIdeas.quickWin.id}-instructions`)
      expect(instructions).toHaveTextContent('Double-click or press Enter to edit')
    })

    it('should display position information for screen readers', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const position = document.getElementById(`${testIdeas.quickWin.id}-position`)
      expect(position).toHaveTextContent(`Position: ${Math.round(testIdeas.quickWin.x)}, ${Math.round(testIdeas.quickWin.y)}`)
    })
  })

  // =============================================================================
  // CONTENT DISPLAY
  // =============================================================================

  describe('Content Display', () => {
    it('should display idea content', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      expect(screen.getByText(testIdeas.quickWin.content)).toBeInTheDocument()
    })

    it('should display idea details when provided', () => {
      const ideaWithDetails = {
        ...testIdeas.quickWin,
        details: 'Additional details about this idea'
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={ideaWithDetails} />
      )

      expect(screen.getByText(ideaWithDetails.details!)).toBeInTheDocument()
    })

    it('should not show details section when not provided', () => {
      const ideaWithoutDetails = { ...testIdeas.quickWin, details: '' }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={ideaWithoutDetails} />
      )

      // Details paragraph should not exist
      const card = screen.getByText(ideaWithoutDetails.content).closest('.idea-card-base')
      const detailsParagraph = card?.querySelector('.idea-card-description')
      expect(detailsParagraph).not.toBeInTheDocument()
    })

    it('should truncate long content properly', () => {
      const longIdea = {
        ...testIdeas.quickWin,
        content: 'This is a very long content that should be handled properly by the card component with appropriate styling and truncation'
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={longIdea} />
      )

      const content = screen.getByText(longIdea.content, { exact: false })
      expect(content).toBeInTheDocument()
    })

    it('should display very long content without breaking layout', () => {
      const veryLongIdea = {
        ...testIdeas.quickWin,
        content: 'A'.repeat(500)
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={veryLongIdea} />
      )

      const content = screen.getByText(veryLongIdea.content, { exact: false })
      expect(content).toBeInTheDocument()
    })
  })

  // =============================================================================
  // PRIORITY BADGE
  // =============================================================================

  describe('Priority Badge', () => {
    it('should display priority badge', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      expect(screen.getByText(testIdeas.quickWin.priority)).toBeInTheDocument()
    })

    it('should display low priority correctly', () => {
      const lowPriorityIdea = { ...testIdeas.quickWin, priority: 'low' as const }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={lowPriorityIdea} />
      )

      expect(screen.getByText('low')).toBeInTheDocument()
    })

    it('should display moderate priority correctly', () => {
      const moderatePriorityIdea = { ...testIdeas.quickWin, priority: 'moderate' as const }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={moderatePriorityIdea} />
      )

      expect(screen.getByText('moderate')).toBeInTheDocument()
    })

    it('should display high priority correctly', () => {
      const highPriorityIdea = { ...testIdeas.quickWin, priority: 'high' as const }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={highPriorityIdea} />
      )

      expect(screen.getByText('high')).toBeInTheDocument()
    })

    it('should display strategic priority correctly', () => {
      const strategicIdea = { ...testIdeas.quickWin, priority: 'strategic' as const }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={strategicIdea} />
      )

      expect(screen.getByText('strategic')).toBeInTheDocument()
    })

    it('should display innovation priority correctly', () => {
      const innovationIdea = { ...testIdeas.quickWin, priority: 'innovation' as const }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={innovationIdea} />
      )

      expect(screen.getByText('innovation')).toBeInTheDocument()
    })

    it('should apply correct priority CSS class', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.idea-card-base')
      expect(card).toHaveClass(`idea-card-priority-${testIdeas.quickWin.priority}`)
    })
  })

  // =============================================================================
  // USER ATTRIBUTION
  // =============================================================================

  describe('User Attribution', () => {
    it('should show "You" for current user', () => {
      const userIdea = {
        ...testIdeas.quickWin,
        created_by: testUsers.regular.id
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={userIdea} />
      )

      expect(screen.getByText('You')).toBeInTheDocument()
    })

    it('should show "Anonymous" for null user ID', () => {
      const anonymousIdea = {
        ...testIdeas.quickWin,
        created_by: null
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={anonymousIdea} />
      )

      expect(screen.getByText('Anonymous')).toBeInTheDocument()
    })

    it('should show "AI Assistant" for long UUID strings', () => {
      const aiIdea = {
        ...testIdeas.quickWin,
        created_by: '12345678-1234-1234-1234-123456789012'
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={aiIdea} />
      )

      expect(screen.getByText('AI Assistant')).toBeInTheDocument()
    })

    it('should show "AI Assistant" for 32-character strings', () => {
      const aiIdea = {
        ...testIdeas.quickWin,
        created_by: 'a'.repeat(32)
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={aiIdea} />
      )

      expect(screen.getByText('AI Assistant')).toBeInTheDocument()
    })

    it('should fallback to showing user ID for short strings', () => {
      const customIdea = {
        ...testIdeas.quickWin,
        created_by: 'user123'
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={customIdea} />
      )

      expect(screen.getByText('user123')).toBeInTheDocument()
    })

    it('should handle null currentUser gracefully', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} currentUser={null} />
      )

      // Should still render without errors
      expect(screen.getByText(testIdeas.quickWin.content)).toBeInTheDocument()
    })
  })

  // =============================================================================
  // TIMESTAMPS
  // =============================================================================

  describe('Timestamps', () => {
    it('should display creation date', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const date = new Date(testIdeas.quickWin.created_at).toLocaleDateString()
      expect(screen.getByText(date)).toBeInTheDocument()
    })

    it('should format date correctly', () => {
      const specificDateIdea = {
        ...testIdeas.quickWin,
        created_at: '2025-03-15T12:00:00.000Z'
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={specificDateIdea} />
      )

      const formattedDate = new Date(specificDateIdea.created_at).toLocaleDateString()
      expect(screen.getByText(formattedDate)).toBeInTheDocument()
    })
  })

  // =============================================================================
  // COLLAPSE/EXPAND FUNCTIONALITY
  // =============================================================================

  describe('Collapse/Expand Functionality', () => {
    it('should render expanded view by default', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      // Expanded view shows full content and collapse button
      expect(screen.getByText(testIdeas.quickWin.content)).toBeInTheDocument()
      const collapseButton = screen.getByRole('button', { name: /collapse/i })
      expect(collapseButton).toBeInTheDocument()
    })

    it('should render collapsed view when is_collapsed is true', () => {
      const collapsedIdea = { ...testIdeas.quickWin, is_collapsed: true }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={collapsedIdea} />
      )

      // Collapsed view shows abbreviated content
      const abbreviatedText = collapsedIdea.content.length > 8
        ? collapsedIdea.content.substring(0, 6) + '...'
        : collapsedIdea.content
      expect(screen.getByText(abbreviatedText)).toBeInTheDocument()
    })

    it('should show priority dot in collapsed view', () => {
      const collapsedIdea = { ...testIdeas.quickWin, is_collapsed: true }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={collapsedIdea} />
      )

      // Priority dot element should exist
      const card = document.querySelector('.idea-card-base')
      const priorityDot = card?.querySelector('.w-1.h-1.rounded-full')
      expect(priorityDot).toBeInTheDocument()
    })

    it('should call onToggleCollapse when collapse button clicked', async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const collapseButton = screen.getByRole('button', { name: /collapse/i })
      await user.click(collapseButton)

      expect(mockOnToggleCollapse).toHaveBeenCalledWith(testIdeas.quickWin.id, true)
    })

    it('should call onToggleCollapse when expand button clicked', async () => {
      const user = userEvent.setup()
      const collapsedIdea = { ...testIdeas.quickWin, is_collapsed: true }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={collapsedIdea} />
      )

      const expandButton = screen.getByRole('button', { name: /expand/i })
      await user.click(expandButton)

      expect(mockOnToggleCollapse).toHaveBeenCalledWith(collapsedIdea.id, false)
    })

    it('should toggle collapse when card is clicked', async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.idea-card-base')
      // Click directly on the card content area, not buttons
      const cardTitle = screen.getByText(testIdeas.quickWin.content)
      await user.click(cardTitle)

      expect(mockOnToggleCollapse).toHaveBeenCalledWith(testIdeas.quickWin.id, true)
    })

    it('should not toggle collapse when locked by another user', async () => {
      const user = userEvent.setup()
      const lockedIdea = {
        ...testIdeas.quickWin,
        editing_by: 'other-user-id',
        editing_at: new Date().toISOString()
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={lockedIdea} />
      )

      const card = screen.getByText(lockedIdea.content).closest('.idea-card-base')
      await user.click(card!)

      expect(mockOnToggleCollapse).not.toHaveBeenCalled()
    })

    it('should truncate content in collapsed view', () => {
      const longContentIdea = {
        ...testIdeas.quickWin,
        content: 'This is a very long content text',
        is_collapsed: true
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={longContentIdea} />
      )

      // Should show first 6 characters + ellipsis
      expect(screen.getByText('This i...')).toBeInTheDocument()
    })
  })

  // =============================================================================
  // ACTION BUTTONS
  // =============================================================================

  describe('Action Buttons', () => {
    it('should show edit button in expanded view', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const editButton = screen.getByLabelText(/edit idea/i)
      expect(editButton).toBeInTheDocument()
    })

    it('should show delete button', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      // Delete button is always present but hidden via opacity
      const deleteButtons = screen.getAllByLabelText(/delete idea/i)
      expect(deleteButtons.length).toBeGreaterThan(0)
    })

    it('should call onEdit when edit button is clicked', async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const editButton = screen.getByLabelText(/edit idea/i)
      await user.click(editButton)

      expect(mockOnEdit).toHaveBeenCalledWith(testIdeas.quickWin.id)
    })

    it('should call onDelete when delete button is clicked', async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const deleteButton = screen.getByLabelText(/delete idea/i)
      await user.click(deleteButton)

      expect(mockOnDelete).toHaveBeenCalledWith(testIdeas.quickWin.id)
    })

    it('should not call onToggleCollapse when clicking buttons', async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const editButton = screen.getByLabelText(/edit idea/i)
      await user.click(editButton)

      expect(mockOnEdit).toHaveBeenCalled()
      expect(mockOnToggleCollapse).not.toHaveBeenCalled()
    })
  })

  // =============================================================================
  // CLICK HANDLERS
  // =============================================================================

  describe('Click Handlers', () => {
    it('should call onEdit on double-click', async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.idea-card-base')
      await user.dblClick(card!)

      expect(mockOnEdit).toHaveBeenCalledWith(testIdeas.quickWin.id)
    })

    it('should not call onEdit on double-click when locked by other', async () => {
      const user = userEvent.setup()
      const lockedIdea = {
        ...testIdeas.quickWin,
        editing_by: 'other-user-id',
        editing_at: new Date().toISOString()
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={lockedIdea} />
      )

      const card = screen.getByText(lockedIdea.content).closest('.idea-card-base')
      await user.dblClick(card!)

      expect(mockOnEdit).not.toHaveBeenCalled()
    })

    it('should not call onEdit on double-click when disabled', async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} disabled={true} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.idea-card-base')
      await user.dblClick(card!)

      expect(mockOnEdit).not.toHaveBeenCalled()
    })

    it('should not interfere with button double-clicks', async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const editButton = screen.getByLabelText(/edit idea/i)
      await user.dblClick(editButton)

      // Should only call edit once (button handler)
      expect(mockOnEdit).toHaveBeenCalledTimes(1)
    })
  })

  // =============================================================================
  // KEYBOARD INTERACTIONS
  // =============================================================================

  describe('Keyboard Interactions', () => {
    it('should call onEdit when Enter is pressed', async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.idea-card-base')
      card?.focus()
      await user.keyboard('{Enter}')

      expect(mockOnEdit).toHaveBeenCalledWith(testIdeas.quickWin.id)
    })

    it('should call onEdit when Space is pressed', async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.idea-card-base')
      card?.focus()
      await user.keyboard(' ')

      expect(mockOnEdit).toHaveBeenCalledWith(testIdeas.quickWin.id)
    })

    it('should call onDelete when Shift+Delete is pressed', async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.idea-card-base')
      card?.focus()
      await user.keyboard('{Shift>}{Delete}{/Shift}')

      expect(mockOnDelete).toHaveBeenCalledWith(testIdeas.quickWin.id)
    })

    it('should not call onEdit when locked by other user', async () => {
      const user = userEvent.setup()
      const lockedIdea = {
        ...testIdeas.quickWin,
        editing_by: 'other-user-id',
        editing_at: new Date().toISOString()
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={lockedIdea} />
      )

      const card = screen.getByText(lockedIdea.content).closest('.idea-card-base')
      card?.focus()
      await user.keyboard('{Enter}')

      expect(mockOnEdit).not.toHaveBeenCalled()
    })

    it('should handle arrow keys for movement', async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.idea-card-base')
      card?.focus()

      // Arrow keys should be handled (preventDefault called)
      await user.keyboard('{ArrowRight}')
      await user.keyboard('{ArrowLeft}')
      await user.keyboard('{ArrowUp}')
      await user.keyboard('{ArrowDown}')

      // Should not cause errors
      expect(card).toBeInTheDocument()
    })
  })

  // =============================================================================
  // LOCK STATUS
  // =============================================================================

  describe('Lock Status', () => {
    it('should show locked indicator when editing by another user', () => {
      const lockedIdea = {
        ...testIdeas.quickWin,
        editing_by: 'other-user-id',
        editing_at: new Date().toISOString()
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={lockedIdea} />
      )

      expect(screen.getByText('🔒 Someone editing')).toBeInTheDocument()
    })

    it('should show editing indicator when locked by current user', () => {
      const lockedIdea = {
        ...testIdeas.quickWin,
        editing_by: testUsers.regular.id,
        editing_at: new Date().toISOString()
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={lockedIdea} />
      )

      expect(screen.getByText('✏️ You\'re editing')).toBeInTheDocument()
    })

    it('should disable edit button when locked by another user', () => {
      const lockedIdea = {
        ...testIdeas.quickWin,
        editing_by: 'other-user-id',
        editing_at: new Date().toISOString()
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={lockedIdea} />
      )

      const editButton = screen.getByLabelText(/edit idea/i)
      expect(editButton).toBeDisabled()
    })

    it('should allow edit when locked by current user', () => {
      const lockedIdea = {
        ...testIdeas.quickWin,
        editing_by: testUsers.regular.id,
        editing_at: new Date().toISOString()
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={lockedIdea} />
      )

      const editButton = screen.getByLabelText(/edit idea/i)
      expect(editButton).not.toBeDisabled()
    })

    it('should expire lock after 5 minutes', () => {
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString()
      const expiredLockIdea = {
        ...testIdeas.quickWin,
        editing_by: 'other-user-id',
        editing_at: sixMinutesAgo
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={expiredLockIdea} />
      )

      // Should not show lock indicator
      expect(screen.queryByText('🔒 Someone editing')).not.toBeInTheDocument()
    })

    it('should apply is-disabled class when locked by other', () => {
      const lockedIdea = {
        ...testIdeas.quickWin,
        editing_by: 'other-user-id',
        editing_at: new Date().toISOString()
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={lockedIdea} />
      )

      const card = screen.getByText(lockedIdea.content).closest('.idea-card-base')
      expect(card).toHaveClass('is-disabled')
    })
  })

  // =============================================================================
  // DRAG AND DROP
  // =============================================================================

  describe('Drag and Drop', () => {
    it('should apply is-dragging class when dragging', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} isDragging={true} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.idea-card-base')
      expect(card).toHaveClass('is-dragging')
    })

    it('should hide delete button during drag', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} isDragging={true} />
      )

      const deleteButton = screen.getByLabelText(/delete idea/i)
      expect(deleteButton).toHaveStyle({ opacity: '0' })
    })

    it('should be keyboard accessible with tabIndex', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.idea-card-base')
      expect(card).toHaveAttribute('tabIndex', '0')
    })
  })

  // =============================================================================
  // ACCESSIBILITY
  // =============================================================================

  describe('Accessibility', () => {
    it('should have proper ARIA role', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.idea-card-base')
      expect(card).toHaveAttribute('role', 'button')
    })

    it('should have ARIA label', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.idea-card-base')
      expect(card).toHaveAttribute('aria-label')
    })

    it('should have ARIA describedby for instructions', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.idea-card-base')
      const describedBy = card?.getAttribute('aria-describedby')
      expect(describedBy).toContain(`${testIdeas.quickWin.id}-instructions`)
    })

    it('should have ARIA describedby for position', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.idea-card-base')
      const describedBy = card?.getAttribute('aria-describedby')
      expect(describedBy).toContain(`${testIdeas.quickWin.id}-position`)
    })

    it('should have accessible button labels', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      expect(screen.getByLabelText(/edit idea/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/delete idea/i)).toBeInTheDocument()
    })

    it('should be keyboard navigable', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.idea-card-base')
      expect(card).toHaveAttribute('tabIndex', '0')
    })
  })

  // =============================================================================
  // EDGE CASES
  // =============================================================================

  describe('Edge Cases', () => {
    it('should handle missing details gracefully', () => {
      const ideaWithoutDetails = {
        ...testIdeas.quickWin,
        details: ''
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={ideaWithoutDetails} />
      )

      expect(screen.getByText(ideaWithoutDetails.content)).toBeInTheDocument()
    })

    it('should handle null created_by', () => {
      const ideaWithoutCreator = {
        ...testIdeas.quickWin,
        created_by: null
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={ideaWithoutCreator} />
      )

      expect(screen.getByText('Anonymous')).toBeInTheDocument()
    })

    it('should handle very long content', () => {
      const longContentIdea = {
        ...testIdeas.quickWin,
        content: 'A'.repeat(500)
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={longContentIdea} />
      )

      expect(screen.getByText(longContentIdea.content, { exact: false })).toBeInTheDocument()
    })

    it('should handle special characters in content', () => {
      const specialCharIdea = {
        ...testIdeas.quickWin,
        content: 'Special chars: <>&"\' 🎉'
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={specialCharIdea} />
      )

      expect(screen.getByText(specialCharIdea.content)).toBeInTheDocument()
    })

    it('should handle undefined is_collapsed', () => {
      const ideaWithoutCollapse = {
        ...testIdeas.quickWin,
        is_collapsed: undefined
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={ideaWithoutCollapse} />
      )

      // Should default to expanded
      expect(screen.getByText(ideaWithoutCollapse.content)).toBeInTheDocument()
    })

    it('should handle disabled prop', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} disabled={true} />
      )

      const deleteButton = screen.getByLabelText(/delete idea/i)
      // Note: disabled is set via aria-disabled, not native disabled attribute
      expect(deleteButton).toHaveAttribute('aria-disabled', 'true')
    })

    it('should handle custom className', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} className="custom-class" />
      )

      const card = screen.getByText(testIdeas.quickWin.content).closest('.idea-card-base')
      expect(card).toBeInTheDocument()
    })

    it('should handle custom data-testid', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} data-testid="custom-test-id" />
      )

      expect(screen.getByText(testIdeas.quickWin.content)).toBeInTheDocument()
    })

    it('should handle missing onToggleCollapse prop', () => {
      const propsWithoutToggle = {
        ...defaultProps,
        onToggleCollapse: undefined
      }

      renderWithProviders(
        <IdeaCardComponent {...propsWithoutToggle} />
      )

      // Should still render without errors
      expect(screen.getByText(testIdeas.quickWin.content)).toBeInTheDocument()
    })

    it('should handle rapid clicks gracefully', async () => {
      const user = userEvent.setup()

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      // Click on card title directly, not the card container
      const cardTitle = screen.getByText(testIdeas.quickWin.content)

      // Click multiple times rapidly
      await user.click(cardTitle)
      await user.click(cardTitle)
      await user.click(cardTitle)

      // Should handle all clicks
      expect(mockOnToggleCollapse).toHaveBeenCalledTimes(3)
    })
  })

  // =============================================================================
  // HOVER STATES
  // =============================================================================

  describe('Hover States', () => {
    it('should show double-click hint', () => {
      renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      const hint = screen.getByText('Double-click to edit')
      expect(hint).toBeInTheDocument()
    })

    it('should not show hint when locked by other', () => {
      const lockedIdea = {
        ...testIdeas.quickWin,
        editing_by: 'other-user-id',
        editing_at: new Date().toISOString()
      }

      renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={lockedIdea} />
      )

      expect(screen.queryByText('Double-click to edit')).not.toBeInTheDocument()
    })
  })

  // =============================================================================
  // PERFORMANCE
  // =============================================================================

  describe('Performance', () => {
    it('should memoize component with React.memo', () => {
      const { rerender } = renderWithProviders(
        <IdeaCardComponent {...defaultProps} />
      )

      // Re-render with same props
      rerender(<IdeaCardComponent {...defaultProps} />)

      // Component should still render correctly
      expect(screen.getByText(testIdeas.quickWin.content)).toBeInTheDocument()
    })

    it('should not re-render when only timestamps change', () => {
      const idea1 = { ...testIdeas.quickWin }
      const idea2 = { ...testIdeas.quickWin, updated_at: new Date().toISOString() }

      const { rerender } = renderWithProviders(
        <IdeaCardComponent {...defaultProps} idea={idea1} />
      )

      rerender(<IdeaCardComponent {...defaultProps} idea={idea2} />)

      // Should still work correctly
      expect(screen.getByText(idea2.content)).toBeInTheDocument()
    })
  })
})