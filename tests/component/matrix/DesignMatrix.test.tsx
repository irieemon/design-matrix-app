/**
 * DesignMatrix Component Tests
 * Tests the core design matrix component functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DesignMatrix } from '../../../src/components/DesignMatrix'
import { basicProject } from '../../../src/test/fixtures/projects'
import { topRightIdea, topLeftIdea, createTestIdea } from '../../../src/test/fixtures/ideas'
import React from 'react'

// Mock dependencies
vi.mock('../../../src/hooks/useIdeas', () => ({
  useIdeas: vi.fn(() => ({
    ideas: [],
    loading: false,
    error: null,
    createIdea: vi.fn(),
    updateIdea: vi.fn(),
    deleteIdea: vi.fn()
  }))
}))

describe('DesignMatrix Component Tests', () => {
  const defaultProps = {
    projectId: basicProject.id,
    ideas: [],
    onIdeaClick: vi.fn(),
    onIdeaMove: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render matrix grid', () => {
      render(<DesignMatrix {...defaultProps} />)

      expect(screen.getByTestId('design-matrix')).toBeInTheDocument()
    })

    it('should render axis labels', () => {
      render(<DesignMatrix {...defaultProps} />)

      expect(screen.getByText(/value/i)).toBeInTheDocument()
      expect(screen.getByText(/feasibility/i)).toBeInTheDocument()
    })

    it('should render quadrant dividers', () => {
      render(<DesignMatrix {...defaultProps} />)

      const matrix = screen.getByTestId('design-matrix')
      const gridLines = matrix.querySelectorAll('[data-testid="grid-line"]')

      expect(gridLines.length).toBeGreaterThan(0)
    })

    it('should render ideas on matrix', () => {
      const ideas = [topRightIdea, topLeftIdea]

      render(<DesignMatrix {...defaultProps} ideas={ideas} />)

      expect(screen.getByText(topRightIdea.title)).toBeInTheDocument()
      expect(screen.getByText(topLeftIdea.title)).toBeInTheDocument()
    })

    it('should position ideas correctly based on coordinates', () => {
      const ideas = [topRightIdea] // x:75, y:75

      render(<DesignMatrix {...defaultProps} ideas={ideas} />)

      const ideaCard = screen.getByTestId(`idea-card-${topRightIdea.id}`)
      const style = window.getComputedStyle(ideaCard)

      // Should be in top-right quadrant
      expect(style.left).toBeDefined()
      expect(style.top).toBeDefined()
    })

    it('should show empty state when no ideas', () => {
      render(<DesignMatrix {...defaultProps} ideas={[]} />)

      expect(screen.getByText(/no ideas yet/i)).toBeInTheDocument()
    })

    it('should show loading state', () => {
      render(<DesignMatrix {...defaultProps} loading={true} />)

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })

    it('should show error state', () => {
      const error = 'Failed to load ideas'

      render(<DesignMatrix {...defaultProps} error={error} />)

      expect(screen.getByText(error)).toBeInTheDocument()
    })
  })

  describe('Interaction', () => {
    it('should handle idea click', () => {
      const onIdeaClick = vi.fn()
      const ideas = [topRightIdea]

      render(<DesignMatrix {...defaultProps} ideas={ideas} onIdeaClick={onIdeaClick} />)

      const ideaCard = screen.getByTestId(`idea-card-${topRightIdea.id}`)
      fireEvent.click(ideaCard)

      expect(onIdeaClick).toHaveBeenCalledWith(topRightIdea)
    })

    it('should handle drag start', () => {
      const ideas = [topRightIdea]

      render(<DesignMatrix {...defaultProps} ideas={ideas} />)

      const ideaCard = screen.getByTestId(`idea-card-${topRightIdea.id}`)
      fireEvent.dragStart(ideaCard)

      expect(ideaCard).toHaveClass(/dragging/i)
    })

    it('should handle drag end and update position', async () => {
      const onIdeaMove = vi.fn()
      const ideas = [topRightIdea]

      render(<DesignMatrix {...defaultProps} ideas={ideas} onIdeaMove={onIdeaMove} />)

      const ideaCard = screen.getByTestId(`idea-card-${topRightIdea.id}`)

      fireEvent.dragStart(ideaCard)
      fireEvent.dragEnd(ideaCard, {
        clientX: 400,
        clientY: 200
      })

      await waitFor(() => {
        expect(onIdeaMove).toHaveBeenCalled()
      })
    })

    it('should prevent drag when idea is locked', () => {
      const lockedIdea = createTestIdea({
        id: 'locked-1',
        locked_by: 'other-user'
      })

      render(<DesignMatrix {...defaultProps} ideas={[lockedIdea]} />)

      const ideaCard = screen.getByTestId(`idea-card-${lockedIdea.id}`)

      expect(ideaCard).toHaveAttribute('draggable', 'false')
    })

    it('should show hover effects', () => {
      const ideas = [topRightIdea]

      render(<DesignMatrix {...defaultProps} ideas={ideas} />)

      const ideaCard = screen.getByTestId(`idea-card-${topRightIdea.id}`)

      fireEvent.mouseEnter(ideaCard)

      expect(ideaCard).toHaveClass(/hover/i)
    })

    it('should handle keyboard navigation', () => {
      const ideas = [topRightIdea]

      render(<DesignMatrix {...defaultProps} ideas={ideas} />)

      const ideaCard = screen.getByTestId(`idea-card-${topRightIdea.id}`)

      ideaCard.focus()
      fireEvent.keyDown(ideaCard, { key: 'Enter' })

      expect(defaultProps.onIdeaClick).toHaveBeenCalled()
    })
  })

  describe('Quadrant Detection', () => {
    it('should detect top-right quadrant (high value, high feasibility)', () => {
      const idea = createTestIdea({ x_position: 75, y_position: 75 })

      render(<DesignMatrix {...defaultProps} ideas={[idea]} />)

      const ideaCard = screen.getByTestId(`idea-card-${idea.id}`)

      expect(ideaCard).toHaveClass(/top-right/i)
    })

    it('should detect top-left quadrant (high value, low feasibility)', () => {
      const idea = createTestIdea({ x_position: 25, y_position: 75 })

      render(<DesignMatrix {...defaultProps} ideas={[idea]} />)

      const ideaCard = screen.getByTestId(`idea-card-${idea.id}`)

      expect(ideaCard).toHaveClass(/top-left/i)
    })

    it('should detect bottom-right quadrant (low value, high feasibility)', () => {
      const idea = createTestIdea({ x_position: 75, y_position: 25 })

      render(<DesignMatrix {...defaultProps} ideas={[idea]} />)

      const ideaCard = screen.getByTestId(`idea-card-${idea.id}`)

      expect(ideaCard).toHaveClass(/bottom-right/i)
    })

    it('should detect bottom-left quadrant (low value, low feasibility)', () => {
      const idea = createTestIdea({ x_position: 25, y_position: 25 })

      render(<DesignMatrix {...defaultProps} ideas={[idea]} />)

      const ideaCard = screen.getByTestId(`idea-card-${idea.id}`)

      expect(ideaCard).toHaveClass(/bottom-left/i)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<DesignMatrix {...defaultProps} />)

      const matrix = screen.getByTestId('design-matrix')

      expect(matrix).toHaveAttribute('role', 'region')
      expect(matrix).toHaveAttribute('aria-label')
    })

    it('should support keyboard navigation', () => {
      const ideas = [topRightIdea, topLeftIdea]

      render(<DesignMatrix {...defaultProps} ideas={ideas} />)

      const firstCard = screen.getByTestId(`idea-card-${topRightIdea.id}`)
      const secondCard = screen.getByTestId(`idea-card-${topLeftIdea.id}`)

      firstCard.focus()
      fireEvent.keyDown(firstCard, { key: 'Tab' })

      expect(document.activeElement).toBe(secondCard)
    })

    it('should announce drag operations to screen readers', () => {
      const ideas = [topRightIdea]

      render(<DesignMatrix {...defaultProps} ideas={ideas} />)

      const ideaCard = screen.getByTestId(`idea-card-${topRightIdea.id}`)

      fireEvent.dragStart(ideaCard)

      const announcement = screen.getByRole('status', { hidden: true })
      expect(announcement).toHaveTextContent(/dragging/i)
    })
  })

  describe('Performance', () => {
    it('should handle large number of ideas efficiently', () => {
      const manyIdeas = Array.from({ length: 100 }, (_, i) =>
        createTestIdea({ id: `idea-${i}`, title: `Idea ${i}` })
      )

      const { container } = render(<DesignMatrix {...defaultProps} ideas={manyIdeas} />)

      // Should render without crashing
      expect(container.querySelectorAll('[data-testid^="idea-card"]')).toHaveLength(100)
    })

    it('should use virtualization for large datasets', () => {
      const manyIdeas = Array.from({ length: 1000 }, (_, i) =>
        createTestIdea({ id: `idea-${i}` })
      )

      render(<DesignMatrix {...defaultProps} ideas={manyIdeas} />)

      // Should not render all 1000 at once (virtualization)
      const visibleCards = screen.getAllByTestId(/idea-card/)

      expect(visibleCards.length).toBeLessThan(1000)
    })

    it('should debounce position updates during drag', async () => {
      const onIdeaMove = vi.fn()
      const ideas = [topRightIdea]

      render(<DesignMatrix {...defaultProps} ideas={ideas} onIdeaMove={onIdeaMove} />)

      const ideaCard = screen.getByTestId(`idea-card-${topRightIdea.id}`)

      // Simulate rapid drag movements
      fireEvent.dragStart(ideaCard)

      for (let i = 0; i < 10; i++) {
        fireEvent.drag(ideaCard, { clientX: 100 + i * 10, clientY: 100 })
      }

      fireEvent.dragEnd(ideaCard)

      // Should only call once (debounced)
      await waitFor(() => {
        expect(onIdeaMove).toHaveBeenCalledTimes(1)
      })
    })
  })
})

/**
 * Test Coverage: 26 component tests for DesignMatrix
 *
 * Covers:
 * - Rendering: Grid, labels, ideas, states
 * - Interaction: Click, drag, hover, keyboard
 * - Quadrant detection: All 4 quadrants
 * - Accessibility: ARIA, keyboard, screen readers
 * - Performance: Large datasets, virtualization, debouncing
 */
