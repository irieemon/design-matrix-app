import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DndContext } from '@dnd-kit/core'
import DesignMatrix from '../DesignMatrix'
import { mockUser, mockIdeas, mockIdea } from '../../test/utils/test-utils'

// Mock the IdeaCardComponent
vi.mock('../IdeaCardComponent', () => ({
  default: ({ idea, onEdit, onDelete, onToggleCollapse }: any) => (
    <div
      data-testid={`idea-card-${idea.id}`}
      data-content={idea.content}
      style={{
        position: 'absolute',
        left: `${idea.x + 40}px`,
        top: `${idea.y + 40}px`
      }}
    >
      <span>{idea.content}</span>
      <button onClick={() => onEdit(idea)} data-testid={`edit-${idea.id}`}>
        Edit
      </button>
      <button onClick={() => onDelete(idea.id)} data-testid={`delete-${idea.id}`}>
        Delete
      </button>
      <button
        onClick={() => onToggleCollapse(idea.id)}
        data-testid={`toggle-${idea.id}`}
      >
        Toggle
      </button>
    </div>
  )
}))

// Mock @dnd-kit/core
const mockSetNodeRef = vi.fn()

vi.mock('@dnd-kit/core', () => ({
  useDroppable: vi.fn(() => ({
    setNodeRef: mockSetNodeRef
  })),
  DndContext: ({ children }: any) => <div data-testid="dnd-context">{children}</div>
}))

describe('DesignMatrix', () => {
  const mockOnEditIdea = vi.fn()
  const mockOnDeleteIdea = vi.fn()
  const mockOnToggleCollapse = vi.fn()

  const defaultProps = {
    ideas: mockIdeas,
    currentUser: mockUser,
    onEditIdea: mockOnEditIdea,
    onDeleteIdea: mockOnDeleteIdea,
    onToggleCollapse: mockOnToggleCollapse
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render the matrix container', () => {
      render(<DesignMatrix {...defaultProps} />)

      expect(screen.getByText('Interactive Priority Matrix')).toBeInTheDocument()
      expect(screen.getByText('Double-click any card to edit • Drag to reposition ideas across quadrants')).toBeInTheDocument()
    })

    it('should render quadrant labels', () => {
      render(<DesignMatrix {...defaultProps} />)

      expect(screen.getByText('Quick Wins')).toBeInTheDocument()
      expect(screen.getByText('Strategic')).toBeInTheDocument()
      expect(screen.getByText('Reconsider')).toBeInTheDocument()
      expect(screen.getByText('Avoid')).toBeInTheDocument()
    })

    it('should render axis labels', () => {
      render(<DesignMatrix {...defaultProps} />)

      expect(screen.getByText('Implementation Difficulty →')).toBeInTheDocument()
      expect(screen.getByText('← Business Value')).toBeInTheDocument()
    })

    it('should render grid background', () => {
      render(<DesignMatrix {...defaultProps} />)

      const matrixContainer = screen.getByRole('generic', { name: /matrix container/i })
      expect(matrixContainer).toHaveClass('matrix-grid-background')
    })

    it('should render center lines', () => {
      const { container } = render(<DesignMatrix {...defaultProps} />)

      const centerLines = container.querySelectorAll('.absolute')
      const verticalLine = Array.from(centerLines).find(el =>
        el.className.includes('left-1/2') && el.className.includes('w-px')
      )
      const horizontalLine = Array.from(centerLines).find(el =>
        el.className.includes('top-1/2') && el.className.includes('h-px')
      )

      expect(verticalLine).toBeInTheDocument()
      expect(horizontalLine).toBeInTheDocument()
    })
  })

  describe('idea cards', () => {
    it('should render all idea cards', () => {
      render(<DesignMatrix {...defaultProps} />)

      mockIdeas.forEach(idea => {
        expect(screen.getByTestId(`idea-card-${idea.id}`)).toBeInTheDocument()
        expect(screen.getByText(idea.content)).toBeInTheDocument()
      })
    })

    it('should position ideas correctly', () => {
      render(<DesignMatrix {...defaultProps} />)

      const firstIdeaCard = screen.getByTestId(`idea-card-${mockIdeas[0].id}`)
      expect(firstIdeaCard).toHaveStyle({
        left: `${mockIdeas[0].x + 40}px`,
        top: `${mockIdeas[0].y + 40}px`
      })
    })

    it('should handle empty ideas array', () => {
      render(<DesignMatrix {...defaultProps} ideas={[]} />)

      expect(screen.getByText('Interactive Priority Matrix')).toBeInTheDocument()
      expect(screen.queryByTestId(/idea-card-/)).not.toBeInTheDocument()
    })

    it('should apply opacity and visibility for active drag item', () => {
      const { container } = render(<DesignMatrix {...defaultProps} activeId={mockIdeas[0].id} />)

      const activeCard = screen.getByTestId(`idea-card-${mockIdeas[0].id}`)
      expect(activeCard).toHaveStyle({
        opacity: '0.3',
        visibility: 'hidden'
      })

      // Other cards should remain visible
      const otherCard = screen.getByTestId(`idea-card-${mockIdeas[1].id}`)
      expect(otherCard).toHaveStyle({
        opacity: '1',
        visibility: 'visible'
      })
    })
  })

  describe('user interactions', () => {
    it('should call onEditIdea when edit button is clicked', async () => {
      const user = userEvent.setup()
      render(<DesignMatrix {...defaultProps} />)

      const editButton = screen.getByTestId(`edit-${mockIdeas[0].id}`)
      await user.click(editButton)

      expect(mockOnEditIdea).toHaveBeenCalledWith(mockIdeas[0])
    })

    it('should call onDeleteIdea when delete button is clicked', async () => {
      const user = userEvent.setup()
      render(<DesignMatrix {...defaultProps} />)

      const deleteButton = screen.getByTestId(`delete-${mockIdeas[0].id}`)
      await user.click(deleteButton)

      expect(mockOnDeleteIdea).toHaveBeenCalledWith(mockIdeas[0].id)
    })

    it('should call onToggleCollapse when toggle button is clicked', async () => {
      const user = userEvent.setup()
      render(<DesignMatrix {...defaultProps} />)

      const toggleButton = screen.getByTestId(`toggle-${mockIdeas[0].id}`)
      await user.click(toggleButton)

      expect(mockOnToggleCollapse).toHaveBeenCalledWith(mockIdeas[0].id)
    })
  })

  describe('drag and drop', () => {
    it('should set up droppable area', () => {
      const { useDroppable } = require('@dnd-kit/core')

      render(<DesignMatrix {...defaultProps} />)

      expect(useDroppable).toHaveBeenCalledWith({
        id: 'matrix'
      })
      expect(mockSetNodeRef).toHaveBeenCalled()
    })

    it('should render within DndContext when provided', () => {
      const TestDndContext = ({ children }: any) => (
        <DndContext onDragEnd={() => {}}>{children}</DndContext>
      )

      render(
        <TestDndContext>
          <DesignMatrix {...defaultProps} />
        </TestDndContext>
      )

      expect(screen.getByTestId('dnd-context')).toBeInTheDocument()
    })
  })

  describe('responsive design', () => {
    it('should have responsive matrix container', () => {
      render(<DesignMatrix {...defaultProps} />)

      const matrixContainer = document.querySelector('.matrix-container')
      expect(matrixContainer).toHaveClass('w-full', 'h-[600px]')
    })

    it('should handle overflow properly', () => {
      render(<DesignMatrix {...defaultProps} />)

      const matrixContainer = document.querySelector('.matrix-container')
      expect(matrixContainer).toHaveClass('overflow-hidden')
    })
  })

  describe('quadrant styling', () => {
    it('should have correct styling for Quick Wins quadrant', () => {
      render(<DesignMatrix {...defaultProps} />)

      const quickWinsLabel = screen.getByText('Quick Wins').closest('div')
      expect(quickWinsLabel).toHaveClass('bg-emerald-50', 'text-emerald-800')
    })

    it('should have correct styling for Strategic quadrant', () => {
      render(<DesignMatrix {...defaultProps} />)

      const strategicLabel = screen.getByText('Strategic').closest('div')
      expect(strategicLabel).toHaveClass('bg-blue-50', 'text-blue-800')
    })

    it('should have correct styling for Reconsider quadrant', () => {
      render(<DesignMatrix {...defaultProps} />)

      const reconsiderLabel = screen.getByText('Reconsider').closest('div')
      expect(reconsiderLabel).toHaveClass('bg-amber-50', 'text-amber-800')
    })

    it('should have correct styling for Avoid quadrant', () => {
      render(<DesignMatrix {...defaultProps} />)

      const avoidLabel = screen.getByText('Avoid').closest('div')
      expect(avoidLabel).toHaveClass('bg-red-50', 'text-red-800')
    })
  })

  describe('accessibility', () => {
    it('should have proper matrix container structure', () => {
      const { container } = render(<DesignMatrix {...defaultProps} />)

      const matrixContainer = container.querySelector('.matrix-container')
      expect(matrixContainer).toBeInTheDocument()
      expect(matrixContainer).toHaveClass('relative')
    })

    it('should render quadrant descriptions', () => {
      render(<DesignMatrix {...defaultProps} />)

      expect(screen.getByText('High Value • Low Effort')).toBeInTheDocument()
      expect(screen.getByText('High Value • High Effort')).toBeInTheDocument()
      expect(screen.getByText('Low Value • Low Effort')).toBeInTheDocument()
      expect(screen.getByText('Low Value • High Effort')).toBeInTheDocument()
    })

    it('should have semantic HTML structure', () => {
      render(<DesignMatrix {...defaultProps} />)

      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Interactive Priority Matrix')
    })
  })

  describe('error boundaries', () => {
    it('should handle malformed idea data gracefully', () => {
      const malformedIdeas = [
        { ...mockIdea, x: undefined, y: undefined },
        { ...mockIdea, id: 'test-2', content: null }
      ] as any

      expect(() => {
        render(<DesignMatrix {...defaultProps} ideas={malformedIdeas} />)
      }).not.toThrow()
    })

    it('should handle missing currentUser gracefully', () => {
      expect(() => {
        render(<DesignMatrix {...defaultProps} currentUser={null} />)
      }).not.toThrow()
    })
  })

  describe('performance', () => {
    it('should render efficiently with many ideas', () => {
      const manyIdeas = Array.from({ length: 100 }, (_, index) => ({
        ...mockIdea,
        id: `idea-${index}`,
        content: `Idea ${index}`,
        x: Math.random() * 500,
        y: Math.random() * 500
      }))

      const { container } = render(<DesignMatrix {...defaultProps} ideas={manyIdeas} />)

      expect(container.querySelectorAll('[data-testid^="idea-card-"]')).toHaveLength(100)
    })

    it('should not re-render unnecessarily when activeId changes', () => {
      const { rerender } = render(<DesignMatrix {...defaultProps} activeId={null} />)

      const initialCardCount = screen.getAllByTestId(/idea-card-/).length

      rerender(<DesignMatrix {...defaultProps} activeId={mockIdeas[0].id} />)

      expect(screen.getAllByTestId(/idea-card-/)).toHaveLength(initialCardCount)
    })
  })
})