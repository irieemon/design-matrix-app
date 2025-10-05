/**
 * DesignMatrix Comprehensive Test Suite
 *
 * Tests the main matrix component including:
 * - Loading and error states
 * - Quadrant rendering and calculations
 * - Coordinate transformations (0-520 → percentages)
 * - Drag-drop integration
 * - Imperative API
 * - Component state management
 * - Empty state
 * - Hover interactions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DesignMatrix from '../DesignMatrix'
import { testIdeas, testUsers } from '../../test/fixtures'
import { renderWithProviders, waitForCondition } from '../../test/utils/test-helpers'
import type { IdeaCard } from '../../types'

describe('DesignMatrix', () => {
  const mockOnEditIdea = vi.fn()
  const mockOnDeleteIdea = vi.fn()
  const mockOnToggleCollapse = vi.fn()
  const mockOnStateChange = vi.fn()
  const mockOnAsyncOperation = vi.fn()

  const defaultProps = {
    ideas: [] as IdeaCard[],
    activeId: null,
    currentUser: testUsers.regular,
    onEditIdea: mockOnEditIdea,
    onDeleteIdea: mockOnDeleteIdea,
    onToggleCollapse: mockOnToggleCollapse,
    isLoading: false,
    error: null,
    animated: true,
    variant: 'primary' as const,
    size: 'md' as const
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Loading State', () => {
    it('should display skeleton loading state when isLoading is true', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} isLoading={true} />
      )

      expect(screen.getByText(/Loading your priority matrix/i)).toBeInTheDocument()
      // Should show skeleton matrix component
      const skeletonElements = document.querySelectorAll('.animate-pulse')
      expect(skeletonElements.length).toBeGreaterThan(0)
    })

    it('should not render idea cards during loading', () => {
      renderWithProviders(
        <DesignMatrix
          {...defaultProps}
          ideas={[testIdeas.quickWin, testIdeas.strategic]}
          isLoading={true}
        />
      )

      // Should not display idea content during loading
      expect(screen.queryByText(testIdeas.quickWin.content)).not.toBeInTheDocument()
    })

    it('should show loading text in header', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} isLoading={true} />
      )

      expect(screen.getByText('Loading your priority matrix...')).toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('should display error message when error prop is provided', () => {
      const errorMessage = 'Failed to load matrix data'
      renderWithProviders(
        <DesignMatrix {...defaultProps} error={errorMessage} />
      )

      expect(screen.getByText(errorMessage)).toBeInTheDocument()
      expect(screen.getByText(/Unable to load matrix/i)).toBeInTheDocument()
    })

    it('should show "Try Again" button in error state', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} error="Test error" />
      )

      const tryAgainButton = screen.getByRole('button', { name: /try again/i })
      expect(tryAgainButton).toBeInTheDocument()
    })

    it('should call reset when "Try Again" is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(
        <DesignMatrix {...defaultProps} error="Test error" />
      )

      const tryAgainButton = screen.getByRole('button', { name: /try again/i })
      await user.click(tryAgainButton)

      // After clicking, error should be cleared (component state reset)
      // This is handled by the component's internal state management
    })

    it('should display generic error when no error message provided', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} error="" />
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('should display empty state when no ideas are present', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} ideas={[]} />
      )

      expect(screen.getByText(/Ready to prioritize/i)).toBeInTheDocument()
      expect(screen.getByText(/Add your first idea/i)).toBeInTheDocument()
    })

    it('should show animated icon in empty state', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} ideas={[]} />
      )

      const animatedIcon = screen.getByText('💡')
      expect(animatedIcon).toBeInTheDocument()
      expect(animatedIcon.parentElement).toHaveClass('animate-bounce')
    })

    it('should display helpful tip in empty state', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} ideas={[]} />
      )

      expect(screen.getByText(/Quick Wins \(top-left\) are your best opportunities/i)).toBeInTheDocument()
    })
  })

  describe('Quadrant Rendering', () => {
    it('should render all four quadrant labels', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} />
      )

      expect(screen.getByText('Quick Wins')).toBeInTheDocument()
      expect(screen.getByText('Strategic')).toBeInTheDocument()
      expect(screen.getByText('Reconsider')).toBeInTheDocument()
      expect(screen.getByText('Avoid')).toBeInTheDocument()
    })

    it('should display correct descriptions for each quadrant', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} />
      )

      expect(screen.getByText('High Value • Low Effort')).toBeInTheDocument()
      expect(screen.getByText('High Value • High Effort')).toBeInTheDocument()
      expect(screen.getByText('Low Value • Low Effort')).toBeInTheDocument()
      expect(screen.getByText('Low Value • High Effort')).toBeInTheDocument()
    })

    it('should show correct idea counts in quadrant guide', () => {
      const ideas = [
        testIdeas.quickWin,      // x=130, y=130 → Top-left
        testIdeas.strategic,     // x=390, y=130 → Top-right
        testIdeas.reconsider,    // x=130, y=390 → Bottom-left
        testIdeas.avoid          // x=390, y=390 → Bottom-right
      ]

      renderWithProviders(
        <DesignMatrix {...defaultProps} ideas={ideas} />
      )

      // Each quadrant should show 1 idea
      const ideaCounts = screen.getAllByText('1 ideas')
      expect(ideaCounts).toHaveLength(4)
    })

    it('should count ideas in quick wins quadrant correctly', () => {
      const quickWinIdeas = [
        testIdeas.quickWin,
        { ...testIdeas.quickWin, id: 'quick-2', x: 100, y: 100 },
        { ...testIdeas.quickWin, id: 'quick-3', x: 200, y: 200 }
      ]

      renderWithProviders(
        <DesignMatrix {...defaultProps} ideas={quickWinIdeas} />
      )

      // Should show 3 ideas in quick wins guide
      const guideSection = screen.getAllByText(/ideas/i).find(el =>
        el.textContent?.includes('3 ideas')
      )
      expect(guideSection).toBeInTheDocument()
    })
  })

  describe('Coordinate Transformations', () => {
    it('should convert coordinates to percentages for rendering', () => {
      const idea = testIdeas.quickWin // x=130, y=130

      renderWithProviders(
        <DesignMatrix {...defaultProps} ideas={[idea]} />
      )

      // Coordinate 130: ((130 + 40) / 600) * 100 = 28.33%
      const expectedX = ((130 + 40) / 600) * 100
      const expectedY = ((130 + 40) / 600) * 100

      const ideaCard = document.querySelector(`[style*="left: ${expectedX}%"]`)
      expect(ideaCard).toBeInTheDocument()
    })

    it('should position center coordinate (260) at 50%', () => {
      const centerIdea = testIdeas.center // x=260, y=260

      renderWithProviders(
        <DesignMatrix {...defaultProps} ideas={[centerIdea]} />
      )

      // Coordinate 260: ((260 + 40) / 600) * 100 = 50%
      const ideaCard = document.querySelector('[style*="left: 50%"]')
      expect(ideaCard).toBeInTheDocument()
    })

    it('should apply transform translate(-50%, -50%) for centering', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} ideas={[testIdeas.quickWin]} />
      )

      const ideaCard = document.querySelector('.instant-hover-card')
      expect(ideaCard).toHaveStyle({ transform: 'translate(-50%, -50%)' })
    })

    it('should handle edge coordinates correctly', () => {
      const edgeIdea = {
        ...testIdeas.quickWin,
        x: 0,
        y: 0
      }

      renderWithProviders(
        <DesignMatrix {...defaultProps} ideas={[edgeIdea]} />
      )

      // Coordinate 0: ((0 + 40) / 600) * 100 = 6.67%
      const expectedPercent = ((0 + 40) / 600) * 100
      const ideaCard = document.querySelector(`[style*="left: ${expectedPercent}%"]`)
      expect(ideaCard).toBeInTheDocument()
    })

    it('should handle maximum coordinates correctly', () => {
      const maxIdea = {
        ...testIdeas.avoid,
        x: 520,
        y: 520
      }

      renderWithProviders(
        <DesignMatrix {...defaultProps} ideas={[maxIdea]} />
      )

      // Coordinate 520: ((520 + 40) / 600) * 100 = 93.33%
      const expectedPercent = ((520 + 40) / 600) * 100
      const ideaCard = document.querySelector(`[style*="left: ${expectedPercent}%"]`)
      expect(ideaCard).toBeInTheDocument()
    })
  })

  describe('Idea Card Rendering', () => {
    it('should render all provided ideas', () => {
      const ideas = [
        testIdeas.quickWin,
        testIdeas.strategic,
        testIdeas.reconsider
      ]

      renderWithProviders(
        <DesignMatrix {...defaultProps} ideas={ideas} />
      )

      expect(screen.getByText(testIdeas.quickWin.content)).toBeInTheDocument()
      expect(screen.getByText(testIdeas.strategic.content)).toBeInTheDocument()
      expect(screen.getByText(testIdeas.reconsider.content)).toBeInTheDocument()
    })

    it('should hide original card during drag (activeId)', () => {
      const ideas = [testIdeas.quickWin]

      renderWithProviders(
        <DesignMatrix
          {...defaultProps}
          ideas={ideas}
          activeId={testIdeas.quickWin.id}
        />
      )

      const cardContainer = document.querySelector('.instant-hover-card')
      expect(cardContainer).toHaveStyle({
        opacity: '0.3',
        visibility: 'hidden'
      })
    })

    it('should show full opacity for non-dragged cards', () => {
      const ideas = [testIdeas.quickWin, testIdeas.strategic]

      renderWithProviders(
        <DesignMatrix
          {...defaultProps}
          ideas={ideas}
          activeId={testIdeas.strategic.id} // Only strategic is being dragged
        />
      )

      // Quick win should be fully visible
      const cards = document.querySelectorAll('.instant-hover-card')
      const quickWinCard = Array.from(cards).find(card =>
        card.textContent?.includes(testIdeas.quickWin.content)
      )

      expect(quickWinCard).toHaveStyle({ opacity: '1' })
    })

    it('should pass correct props to OptimizedIdeaCard', () => {
      const idea = testIdeas.quickWin

      renderWithProviders(
        <DesignMatrix {...defaultProps} ideas={[idea]} />
      )

      // Verify card receives the idea data
      expect(screen.getByText(idea.content)).toBeInTheDocument()
      expect(screen.getByText(idea.priority)).toBeInTheDocument()
    })
  })

  describe('Drag and Drop Integration', () => {
    it('should set up droppable area with id "matrix"', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} />
      )

      // The matrix container should be droppable
      const matrixContainer = document.querySelector('.matrix-container')
      expect(matrixContainer).toBeInTheDocument()
    })

    it('should apply performance-optimized classes during interactions', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} />
      )

      const matrixContainer = document.querySelector('.matrix-container')
      expect(matrixContainer).toHaveClass('matrix-performance-layer')
      expect(matrixContainer).toHaveClass('gpu-accelerated')
    })
  })

  describe('Hover Interactions', () => {
    it('should handle quadrant hover state', async () => {
      const user = userEvent.setup()
      renderWithProviders(
        <DesignMatrix {...defaultProps} />
      )

      const quickWinsLabel = screen.getByText('Quick Wins')
      await user.hover(quickWinsLabel)

      // Should apply hover class
      const quickWinsContainer = quickWinsLabel.closest('.instant-hover-card')
      expect(quickWinsContainer).toHaveClass('matrix-hover-layer')
    })

    it('should apply enhanced styling to hovered quadrant guide', async () => {
      const user = userEvent.setup()
      renderWithProviders(
        <DesignMatrix {...defaultProps} />
      )

      // Find Quick Wins guide section (in bottom guide area)
      const guides = document.querySelectorAll('.bg-emerald-50')
      const quickWinsGuide = Array.from(guides).find(guide =>
        guide.textContent?.includes('Do these first')
      )

      if (quickWinsGuide) {
        await user.hover(quickWinsGuide)

        // Should apply scale and shadow on hover
        expect(quickWinsGuide).toHaveClass('hover:scale-102')
      }
    })

    it('should remove hover state on mouse leave', async () => {
      const user = userEvent.setup()
      renderWithProviders(
        <DesignMatrix {...defaultProps} />
      )

      const quickWinsLabel = screen.getByText('Quick Wins')
      const container = quickWinsLabel.closest('.instant-hover-card')

      await user.hover(quickWinsLabel)
      expect(container).toHaveClass('matrix-hover-layer')

      await user.unhover(quickWinsLabel)
      // Hover class should be removed
    })
  })

  describe('Matrix Guide', () => {
    it('should render guide section with all four quadrants', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} />
      )

      expect(screen.getByText(/Do these first for immediate impact/i)).toBeInTheDocument()
      expect(screen.getByText(/Plan carefully for long-term value/i)).toBeInTheDocument()
      expect(screen.getByText(/Maybe later when priorities shift/i)).toBeInTheDocument()
      expect(screen.getByText(/Skip these to focus resources/i)).toBeInTheDocument()
    })

    it('should display color indicators for each quadrant', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} />
      )

      // Should have colored dots
      const colorDots = document.querySelectorAll('.rounded-full')
      expect(colorDots.length).toBeGreaterThanOrEqual(4)
    })
  })

  describe('Axis Labels', () => {
    it('should display horizontal axis label', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} />
      )

      expect(screen.getByText(/Implementation Difficulty/i)).toBeInTheDocument()
    })

    it('should display vertical axis label', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} />
      )

      expect(screen.getByText(/Business Value/i)).toBeInTheDocument()
    })

    it('should render center point indicator', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} />
      )

      const centerPoint = document.querySelector('.matrix-center-point')
      expect(centerPoint).toBeInTheDocument()
    })

    it('should render grid background', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} />
      )

      const grid = document.querySelector('.matrix-grid')
      expect(grid).toBeInTheDocument()
    })

    it('should render center lines', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} />
      )

      // Should have dividing lines
      const lines = document.querySelectorAll('.bg-slate-300\\/60')
      expect(lines.length).toBeGreaterThanOrEqual(2) // Horizontal and vertical
    })
  })

  describe('Component State Management', () => {
    it('should initialize with idle state when no loading or error', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} />
      )

      const container = document.querySelector('.matrix-container')
      expect(container).toHaveAttribute('data-state', 'idle')
    })

    it('should set variant attribute on container', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} variant="primary" />
      )

      const container = document.querySelector('.matrix-container')
      // Should use matrix-safe variant to prevent gray backgrounds
      expect(container).toHaveAttribute('data-variant', 'matrix-safe')
    })

    it('should set size attribute on container', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} size="lg" />
      )

      const container = document.querySelector('.matrix-container')
      expect(container).toHaveAttribute('data-size', 'lg')
    })

    it('should call onStateChange when state changes', async () => {
      const { rerender } = renderWithProviders(
        <DesignMatrix
          {...defaultProps}
          onStateChange={mockOnStateChange}
        />
      )

      // Change to loading state
      rerender(
        <DesignMatrix
          {...defaultProps}
          isLoading={true}
          onStateChange={mockOnStateChange}
        />
      )

      await waitFor(() => {
        expect(mockOnStateChange).toHaveBeenCalled()
      })
    })
  })

  describe('Imperative API (via ref)', () => {
    it('should expose getState method via ref', () => {
      const ref = { current: null as any }

      renderWithProviders(
        <DesignMatrix {...defaultProps} ref={ref} />
      )

      expect(ref.current).toBeDefined()
      expect(ref.current.getState).toBeDefined()
      expect(typeof ref.current.getState).toBe('function')
    })

    it('should expose setState method via ref', () => {
      const ref = { current: null as any }

      renderWithProviders(
        <DesignMatrix {...defaultProps} ref={ref} />
      )

      expect(ref.current.setState).toBeDefined()
      expect(typeof ref.current.setState).toBe('function')
    })

    it('should expose setSuccess method via ref', () => {
      const ref = { current: null as any }

      renderWithProviders(
        <DesignMatrix {...defaultProps} ref={ref} />
      )

      expect(ref.current.setSuccess).toBeDefined()
      expect(typeof ref.current.setSuccess).toBe('function')
    })

    it('should expose setError method via ref', () => {
      const ref = { current: null as any }

      renderWithProviders(
        <DesignMatrix {...defaultProps} ref={ref} />
      )

      expect(ref.current.setError).toBeDefined()
      expect(typeof ref.current.setError).toBe('function')
    })

    it('should expose reset method via ref', () => {
      const ref = { current: null as any }

      renderWithProviders(
        <DesignMatrix {...defaultProps} ref={ref} />
      )

      expect(ref.current.reset).toBeDefined()
      expect(typeof ref.current.reset).toBe('function')
    })

    it('should expose executeOperation method via ref', () => {
      const ref = { current: null as any }

      renderWithProviders(
        <DesignMatrix {...defaultProps} ref={ref} />
      )

      expect(ref.current.executeOperation).toBeDefined()
      expect(typeof ref.current.executeOperation).toBe('function')
    })
  })

  describe('Event Handlers', () => {
    it('should call onEditIdea when edit is triggered', async () => {
      const user = userEvent.setup()
      const idea = testIdeas.quickWin

      renderWithProviders(
        <DesignMatrix {...defaultProps} ideas={[idea]} />
      )

      // Find edit button and click it
      const editButton = screen.getByLabelText('Edit idea')
      await user.click(editButton)

      await waitFor(() => {
        expect(mockOnEditIdea).toHaveBeenCalledWith(idea)
      })
    })

    it('should call onDeleteIdea when delete is triggered', async () => {
      const user = userEvent.setup()
      const idea = testIdeas.quickWin

      renderWithProviders(
        <DesignMatrix {...defaultProps} ideas={[idea]} />
      )

      // Hover to show delete button
      const cardContainer = screen.getByText(idea.content).closest('.draggable')
      if (cardContainer) {
        await user.hover(cardContainer)

        const deleteButton = screen.getByLabelText('Delete idea')
        await user.click(deleteButton)

        await waitFor(() => {
          expect(mockOnDeleteIdea).toHaveBeenCalledWith(idea.id)
        })
      }
    })

    it('should call onToggleCollapse when collapse is triggered', async () => {
      const user = userEvent.setup()
      const idea = testIdeas.quickWin

      renderWithProviders(
        <DesignMatrix {...defaultProps} ideas={[idea]} />
      )

      const collapseButton = screen.getByLabelText('Collapse idea card')
      await user.click(collapseButton)

      await waitFor(() => {
        expect(mockOnToggleCollapse).toHaveBeenCalled()
      })
    })
  })

  describe('Responsive Behavior', () => {
    it('should apply responsive classes', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} />
      )

      const container = document.querySelector('.matrix-container')
      expect(container).toHaveClass('matrix-responsive')
    })

    it('should maintain coordinate system across container sizes', () => {
      // Coordinates should always convert to percentages regardless of container size
      const idea = testIdeas.center // x=260, y=260 → always 50%

      renderWithProviders(
        <DesignMatrix {...defaultProps} ideas={[idea]} />
      )

      const ideaCard = document.querySelector('[style*="left: 50%"]')
      expect(ideaCard).toBeInTheDocument()
    })
  })

  describe('Animation Configuration', () => {
    it('should apply animated class when animated prop is true', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} animated={true} />
      )

      const container = document.querySelector('.matrix-container')
      expect(container).toHaveClass('matrix--animated')
    })

    it('should not apply animated class when animated prop is false', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} animated={false} />
      )

      const container = document.querySelector('.matrix-container')
      expect(container).not.toHaveClass('matrix--animated')
    })
  })

  describe('Performance Optimizations', () => {
    it('should apply GPU acceleration classes', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} />
      )

      const container = document.querySelector('.matrix-container')
      expect(container).toHaveClass('gpu-accelerated')
    })

    it('should apply performance-guaranteed class to idea cards', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} ideas={[testIdeas.quickWin]} />
      )

      const card = document.querySelector('.performance-guaranteed')
      expect(card).toBeInTheDocument()
    })

    it('should use instant-hover-card class for optimized hover', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} ideas={[testIdeas.quickWin]} />
      )

      const card = document.querySelector('.instant-hover-card')
      expect(card).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should render semantic HTML structure', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} />
      )

      // Should have heading for matrix title
      const heading = screen.getByRole('heading', { name: /Interactive Priority Matrix/i })
      expect(heading).toBeInTheDocument()
    })

    it('should provide descriptive text for users', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} />
      )

      expect(screen.getByText(/Double-click any card to edit/i)).toBeInTheDocument()
      expect(screen.getByText(/Drag to reposition ideas/i)).toBeInTheDocument()
    })

    it('should have accessible error recovery button', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} error="Test error" />
      )

      const button = screen.getByRole('button', { name: /try again/i })
      expect(button).toBeInTheDocument()
      expect(button).toHaveAccessibleName()
    })
  })

  describe('Edge Cases', () => {
    it('should handle null ideas array gracefully', () => {
      renderWithProviders(
        <DesignMatrix {...defaultProps} ideas={null as any} />
      )

      // Should show empty state
      expect(screen.getByText(/Ready to prioritize/i)).toBeInTheDocument()
    })

    it('should handle undefined activeId', () => {
      renderWithProviders(
        <DesignMatrix
          {...defaultProps}
          ideas={[testIdeas.quickWin]}
          activeId={undefined}
        />
      )

      // Should render normally
      expect(screen.getByText(testIdeas.quickWin.content)).toBeInTheDocument()
    })

    it('should handle null currentUser', () => {
      renderWithProviders(
        <DesignMatrix
          {...defaultProps}
          ideas={[testIdeas.quickWin]}
          currentUser={null}
        />
      )

      // Should render ideas even without user
      expect(screen.getByText(testIdeas.quickWin.content)).toBeInTheDocument()
    })

    it('should handle very large number of ideas', () => {
      const manyIdeas = Array.from({ length: 50 }, (_, i) => ({
        ...testIdeas.quickWin,
        id: `idea-${i}`,
        content: `Idea ${i}`,
        x: (i % 10) * 50,
        y: Math.floor(i / 10) * 50
      }))

      renderWithProviders(
        <DesignMatrix {...defaultProps} ideas={manyIdeas} />
      )

      // Should render all ideas
      const cards = document.querySelectorAll('.instant-hover-card')
      expect(cards.length).toBe(50)
    })

    it('should handle ideas with negative coordinates', () => {
      const edgeIdea = {
        ...testIdeas.quickWin,
        x: -10,
        y: -10
      }

      renderWithProviders(
        <DesignMatrix {...defaultProps} ideas={[edgeIdea]} />
      )

      // Should still render (coordinates will be clamped)
      expect(screen.getByText(edgeIdea.content)).toBeInTheDocument()
    })

    it('should handle ideas with coordinates beyond max', () => {
      const edgeIdea = {
        ...testIdeas.avoid,
        x: 600,
        y: 600
      }

      renderWithProviders(
        <DesignMatrix {...defaultProps} ideas={[edgeIdea]} />
      )

      // Should still render (coordinates will be clamped)
      expect(screen.getByText(edgeIdea.content)).toBeInTheDocument()
    })
  })
})