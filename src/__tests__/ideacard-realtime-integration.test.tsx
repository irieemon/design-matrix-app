/**
 * IdeaCard Real-Time Rendering Integration Tests
 * Phase Three Implementation
 *
 * Tests the integration between OptimizedIdeaCard and real-time idea updates:
 * - Mobile indicator appears when ideas arrive from mobile
 * - New idea animation triggers on fresh submissions
 * - Animation timing and lifecycle
 * - Indicator persistence across card states
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { OptimizedIdeaCard } from '../components/matrix/OptimizedIdeaCard'
import { testIdeas, testUsers } from '../test/fixtures'
import { renderWithProviders } from '../test/utils/test-helpers'

describe('IdeaCard Real-Time Rendering Integration', () => {
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

  describe('Mobile Indicator Real-Time Behavior', () => {
    it('should show mobile indicator immediately when mobile idea arrives', () => {
      // Simulate idea arriving from mobile (has session_id)
      const mobileIdea = {
        ...testIdeas.quickWin,
        session_id: 'session-123' // Indicates mobile origin
      }

      const { container } = renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={mobileIdea} isFromMobile={true} />
      )

      const mobileIndicator = container.querySelector('[aria-label="Submitted from mobile device"]')
      expect(mobileIndicator).toBeInTheDocument()
    })

    it('should maintain mobile indicator through card re-renders', () => {
      const { container, rerender } = renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} isFromMobile={true} />
      )

      let mobileIndicator = container.querySelector('[aria-label="Submitted from mobile device"]')
      expect(mobileIndicator).toBeInTheDocument()

      // Re-render with updated idea (e.g., after editing)
      const updatedIdea = {
        ...testIdeas.quickWin,
        content: 'Updated content'
      }

      rerender(<OptimizedIdeaCard {...defaultProps} idea={updatedIdea} isFromMobile={true} />)

      mobileIndicator = container.querySelector('[aria-label="Submitted from mobile device"]')
      expect(mobileIndicator).toBeInTheDocument()
    })

    it('should show mobile indicator on collapsed cards', () => {
      const collapsedIdea = {
        ...testIdeas.quickWin,
        is_collapsed: true
      }

      const { container } = renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={collapsedIdea} isFromMobile={true} />
      )

      const mobileIndicator = container.querySelector('[aria-label="Submitted from mobile device"]')
      expect(mobileIndicator).toBeInTheDocument()
    })

    it('should persist mobile indicator when card is locked', () => {
      const lockedIdea = {
        ...testIdeas.quickWin,
        editing_by: 'other-user-id',
        editing_at: new Date().toISOString()
      }

      const { container } = renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={lockedIdea} isFromMobile={true} />
      )

      const mobileIndicator = container.querySelector('[aria-label="Submitted from mobile device"]')
      expect(mobileIndicator).toBeInTheDocument()
    })

    it('should distinguish mobile vs desktop ideas in mixed list', () => {
      const ideas = [
        { ...testIdeas.quickWin, id: 'mobile-1', session_id: 'session-1' },
        { ...testIdeas.strategic, id: 'desktop-1', session_id: null },
        { ...testIdeas.reconsider, id: 'mobile-2', session_id: 'session-1' }
      ]

      const { container } = render(
        <div>
          <OptimizedIdeaCard {...defaultProps} idea={ideas[0]} isFromMobile={true} />
          <OptimizedIdeaCard {...defaultProps} idea={ideas[1]} isFromMobile={false} />
          <OptimizedIdeaCard {...defaultProps} idea={ideas[2]} isFromMobile={true} />
        </div>
      )

      const mobileIndicators = container.querySelectorAll(
        '[aria-label="Submitted from mobile device"]'
      )
      expect(mobileIndicators.length).toBe(2) // Only mobile-1 and mobile-2
    })
  })

  describe('New Idea Animation Real-Time Behavior', () => {
    it('should trigger animation for freshly submitted ideas', () => {
      renderWithProviders(<OptimizedIdeaCard {...defaultProps} isNewIdea={true} />)

      const card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
      expect(card).toHaveClass('animate-scale-in')
    })

    it('should apply animation only to recently created ideas (< 3 seconds)', async () => {
      vi.useFakeTimers()

      const recentIdea = {
        ...testIdeas.quickWin,
        created_at: new Date().toISOString() // Just created
      }

      const { rerender } = renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={recentIdea} isNewIdea={true} />
      )

      let card = screen.getByText(recentIdea.content).closest('.draggable')
      expect(card).toHaveClass('animate-scale-in')

      // Advance time by 4 seconds
      vi.advanceTimersByTime(4000)

      // Simulate re-render without isNewIdea flag (real-time system would update this)
      rerender(<OptimizedIdeaCard {...defaultProps} idea={recentIdea} isNewIdea={false} />)

      card = screen.getByText(recentIdea.content).closest('.draggable')
      expect(card).not.toHaveClass('animate-scale-in')

      vi.useRealTimers()
    })

    it('should not animate ideas created in previous sessions', () => {
      const oldIdea = {
        ...testIdeas.quickWin,
        created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 min ago
      }

      renderWithProviders(<OptimizedIdeaCard {...defaultProps} idea={oldIdea} isNewIdea={false} />)

      const card = screen.getByText(oldIdea.content).closest('.draggable')
      expect(card).not.toHaveClass('animate-scale-in')
    })

    it('should animate mobile ideas on arrival', () => {
      const newMobileIdea = {
        ...testIdeas.quickWin,
        session_id: 'session-1',
        created_at: new Date().toISOString()
      }

      renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} idea={newMobileIdea} isFromMobile={true} isNewIdea={true} />
      )

      const card = screen.getByText(newMobileIdea.content).closest('.draggable')
      expect(card).toHaveClass('animate-scale-in')
    })
  })

  describe('Combined Mobile + New Animation Behavior', () => {
    it('should show both mobile indicator and animation for fresh mobile ideas', () => {
      const freshMobileIdea = {
        ...testIdeas.quickWin,
        session_id: 'session-1',
        created_at: new Date().toISOString()
      }

      const { container } = renderWithProviders(
        <OptimizedIdeaCard
          {...defaultProps}
          idea={freshMobileIdea}
          isFromMobile={true}
          isNewIdea={true}
        />
      )

      // Should have mobile indicator
      const mobileIndicator = container.querySelector(
        '[aria-label="Submitted from mobile device"]'
      )
      expect(mobileIndicator).toBeInTheDocument()

      // Should have animation
      const card = screen.getByText(freshMobileIdea.content).closest('.draggable')
      expect(card).toHaveClass('animate-scale-in')
    })

    it('should transition from new animation to stable state while keeping mobile indicator', async () => {
      vi.useFakeTimers()

      const mobileIdea = {
        ...testIdeas.quickWin,
        session_id: 'session-1',
        created_at: new Date().toISOString()
      }

      const { container, rerender } = renderWithProviders(
        <OptimizedIdeaCard
          {...defaultProps}
          idea={mobileIdea}
          isFromMobile={true}
          isNewIdea={true}
        />
      )

      // Initially: both mobile indicator and animation
      let mobileIndicator = container.querySelector(
        '[aria-label="Submitted from mobile device"]'
      )
      let card = screen.getByText(mobileIdea.content).closest('.draggable')
      expect(mobileIndicator).toBeInTheDocument()
      expect(card).toHaveClass('animate-scale-in')

      // After 3 seconds: animation removed, mobile indicator persists
      vi.advanceTimersByTime(3000)

      rerender(
        <OptimizedIdeaCard
          {...defaultProps}
          idea={mobileIdea}
          isFromMobile={true}
          isNewIdea={false}
        />
      )

      mobileIndicator = container.querySelector('[aria-label="Submitted from mobile device"]')
      card = screen.getByText(mobileIdea.content).closest('.draggable')
      expect(mobileIndicator).toBeInTheDocument() // Still present
      expect(card).not.toHaveClass('animate-scale-in') // Animation removed

      vi.useRealTimers()
    })
  })

  describe('Real-Time List Updates', () => {
    it('should handle batch idea arrivals from mobile session', () => {
      const mobileIdeas = [
        { ...testIdeas.quickWin, id: 'idea-1', session_id: 'session-1' },
        { ...testIdeas.strategic, id: 'idea-2', session_id: 'session-1' },
        { ...testIdeas.reconsider, id: 'idea-3', session_id: 'session-1' }
      ]

      const { container } = render(
        <div>
          {mobileIdeas.map((idea) => (
            <OptimizedIdeaCard
              key={idea.id}
              {...defaultProps}
              idea={idea}
              isFromMobile={true}
              isNewIdea={true}
            />
          ))}
        </div>
      )

      // All should have mobile indicators
      const mobileIndicators = container.querySelectorAll(
        '[aria-label="Submitted from mobile device"]'
      )
      expect(mobileIndicators.length).toBe(3)

      // All should have animations
      const animatedCards = container.querySelectorAll('.animate-scale-in')
      expect(animatedCards.length).toBe(3)
    })

    it('should maintain visual distinction as ideas age', async () => {
      vi.useFakeTimers()

      const ideas = [
        {
          ...testIdeas.quickWin,
          id: 'new-idea',
          created_at: new Date().toISOString(),
          session_id: 'session-1'
        },
        {
          ...testIdeas.strategic,
          id: 'old-idea',
          created_at: new Date(Date.now() - 60000).toISOString(),
          session_id: 'session-1'
        }
      ]

      const { container } = render(
        <div>
          <OptimizedIdeaCard
            {...defaultProps}
            idea={ideas[0]}
            isFromMobile={true}
            isNewIdea={true}
          />
          <OptimizedIdeaCard
            {...defaultProps}
            idea={ideas[1]}
            isFromMobile={true}
            isNewIdea={false}
          />
        </div>
      )

      // Both should have mobile indicators
      let mobileIndicators = container.querySelectorAll(
        '[aria-label="Submitted from mobile device"]'
      )
      expect(mobileIndicators.length).toBe(2)

      // Only new idea should have animation
      let animatedCards = container.querySelectorAll('.animate-scale-in')
      expect(animatedCards.length).toBe(1)

      vi.useRealTimers()
    })
  })

  describe('Performance and Edge Cases', () => {
    it('should handle rapid idea arrivals without performance degradation', () => {
      const rapidIdeas = Array.from({ length: 20 }, (_, i) => ({
        ...testIdeas.quickWin,
        id: `rapid-${i}`,
        session_id: 'session-1',
        created_at: new Date().toISOString()
      }))

      const startTime = performance.now()

      const { container } = render(
        <div>
          {rapidIdeas.map((idea) => (
            <OptimizedIdeaCard
              key={idea.id}
              {...defaultProps}
              idea={idea}
              isFromMobile={true}
              isNewIdea={true}
            />
          ))}
        </div>
      )

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render quickly (< 500ms for 20 cards)
      expect(renderTime).toBeLessThan(500)

      // All should have indicators and animations
      const mobileIndicators = container.querySelectorAll(
        '[aria-label="Submitted from mobile device"]'
      )
      expect(mobileIndicators.length).toBe(20)
    })

    it('should maintain correctness when toggling between states', () => {
      const { container, rerender } = renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} isFromMobile={false} isNewIdea={false} />
      )

      // Initial: no indicator, no animation
      let mobileIndicator = container.querySelector(
        '[aria-label="Submitted from mobile device"]'
      )
      let card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
      expect(mobileIndicator).not.toBeInTheDocument()
      expect(card).not.toHaveClass('animate-scale-in')

      // Add mobile indicator
      rerender(<OptimizedIdeaCard {...defaultProps} isFromMobile={true} isNewIdea={false} />)

      mobileIndicator = container.querySelector('[aria-label="Submitted from mobile device"]')
      expect(mobileIndicator).toBeInTheDocument()

      // Add animation
      rerender(<OptimizedIdeaCard {...defaultProps} isFromMobile={true} isNewIdea={true} />)

      card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
      expect(card).toHaveClass('animate-scale-in')

      // Remove mobile indicator
      rerender(<OptimizedIdeaCard {...defaultProps} isFromMobile={false} isNewIdea={true} />)

      mobileIndicator = container.querySelector('[aria-label="Submitted from mobile device"]')
      expect(mobileIndicator).not.toBeInTheDocument()
      expect(card).toHaveClass('animate-scale-in')
    })

    it('should handle null/undefined props gracefully', () => {
      const { container } = renderWithProviders(
        <OptimizedIdeaCard
          {...defaultProps}
          isFromMobile={undefined}
          isNewIdea={undefined}
        />
      )

      // Should not show mobile indicator
      const mobileIndicator = container.querySelector(
        '[aria-label="Submitted from mobile device"]'
      )
      expect(mobileIndicator).not.toBeInTheDocument()

      // Should not have animation
      const card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
      expect(card).not.toHaveClass('animate-scale-in')
    })
  })

  describe('Integration with Card State Changes', () => {
    it('should preserve mobile indicator during collapse/expand', () => {
      const { container, rerender } = renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} isFromMobile={true} />
      )

      let mobileIndicator = container.querySelector(
        '[aria-label="Submitted from mobile device"]'
      )
      expect(mobileIndicator).toBeInTheDocument()

      // Collapse card
      const collapsedIdea = { ...testIdeas.quickWin, is_collapsed: true }
      rerender(<OptimizedIdeaCard {...defaultProps} idea={collapsedIdea} isFromMobile={true} />)

      mobileIndicator = container.querySelector('[aria-label="Submitted from mobile device"]')
      expect(mobileIndicator).toBeInTheDocument()

      // Expand card
      const expandedIdea = { ...testIdeas.quickWin, is_collapsed: false }
      rerender(<OptimizedIdeaCard {...defaultProps} idea={expandedIdea} isFromMobile={true} />)

      mobileIndicator = container.querySelector('[aria-label="Submitted from mobile device"]')
      expect(mobileIndicator).toBeInTheDocument()
    })

    it('should maintain mobile indicator during drag operations', () => {
      const { container, rerender } = renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} isFromMobile={true} />
      )

      const mobileIndicator = container.querySelector(
        '[aria-label="Submitted from mobile device"]'
      )
      expect(mobileIndicator).toBeInTheDocument()

      // Simulate drag (isDragOverlay should hide indicator)
      rerender(<OptimizedIdeaCard {...defaultProps} isFromMobile={true} isDragOverlay={true} />)

      const dragOverlayIndicator = container.querySelector(
        '[aria-label="Submitted from mobile device"]'
      )
      expect(dragOverlayIndicator).not.toBeInTheDocument()

      // End drag
      rerender(<OptimizedIdeaCard {...defaultProps} isFromMobile={true} isDragOverlay={false} />)

      const restoredIndicator = container.querySelector(
        '[aria-label="Submitted from mobile device"]'
      )
      expect(restoredIndicator).toBeInTheDocument()
    })

    it('should handle animation with priority changes', () => {
      const { rerender } = renderWithProviders(
        <OptimizedIdeaCard {...defaultProps} isNewIdea={true} />
      )

      let card = screen.getByText(testIdeas.quickWin.content).closest('.draggable')
      expect(card).toHaveClass('animate-scale-in')

      // Change priority
      const highPriorityIdea = { ...testIdeas.quickWin, priority: 'high' as const }
      rerender(<OptimizedIdeaCard {...defaultProps} idea={highPriorityIdea} isNewIdea={true} />)

      card = screen.getByText(highPriorityIdea.content).closest('.draggable')
      expect(card).toHaveClass('animate-scale-in')
    })
  })
})
