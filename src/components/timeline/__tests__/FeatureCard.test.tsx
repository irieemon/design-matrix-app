import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FeatureCard from '../FeatureCard'
import { RoadmapFeature } from '../../../hooks/timeline/useTimelineFeatures'

// Mock DataTransfer for drag functionality
Object.defineProperty(window, 'DataTransfer', {
  writable: true,
  value: class DataTransfer {
    effectAllowed = 'none'
    dropEffect = 'none'
    files = []
    items = []
    types = []
    getData() { return '' }
    setData() {}
    clearData() {}
    setDragImage() {}
  }
})

const mockFeature: RoadmapFeature = {
  id: 'feature-1',
  title: 'Test Feature',
  description: 'A test feature',
  startMonth: 2,
  duration: 3,
  team: 'platform',
  priority: 'high',
  status: 'in-progress'
}

const mockStyles = {
  bgColor: 'bg-red-200',
  textColor: 'text-red-800',
  borderColor: 'border-red-400'
}

const mockPosition = {
  left: '16.67%',
  width: '25%'
}

const defaultProps = {
  feature: mockFeature,
  styles: mockStyles,
  position: mockPosition,
  rowPosition: 0,
  isDragged: false,
  isResizing: false,
  onDragStart: vi.fn(),
  onFeatureClick: vi.fn(),
  onMouseDown: vi.fn()
}

describe('FeatureCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('basic rendering', () => {
    it('should render feature title', () => {
      render(<FeatureCard {...defaultProps} />)

      expect(screen.getByText('Test Feature')).toBeInTheDocument()
    })

    it('should apply provided styles', () => {
      const { container } = render(<FeatureCard {...defaultProps} />)
      const featureCard = container.firstChild as HTMLElement

      expect(featureCard).toHaveClass('bg-red-200')
      expect(featureCard).toHaveClass('text-red-800')
      expect(featureCard).toHaveClass('border-red-400')
    })

    it('should apply position styles', () => {
      const { container } = render(<FeatureCard {...defaultProps} />)
      const featureCard = container.firstChild as HTMLElement

      expect(featureCard).toHaveStyle({
        left: '16.67%',
        width: '25%',
        top: '16px' // rowPosition 0 * 36 + 16
      })
    })

    it('should have draggable attribute', () => {
      const { container } = render(<FeatureCard {...defaultProps} />)
      const featureCard = container.firstChild as HTMLElement

      expect(featureCard).toHaveAttribute('draggable', 'true')
    })

    it('should have proper title attribute', () => {
      const { container } = render(<FeatureCard {...defaultProps} />)
      const featureCard = container.firstChild as HTMLElement

      expect(featureCard).toHaveAttribute('title', 'Drag to move, resize handles on hover: Test Feature')
    })
  })

  describe('row positioning', () => {
    it('should calculate correct top position for different rows', () => {
      const { container, rerender } = render(<FeatureCard {...defaultProps} rowPosition={1} />)
      let featureCard = container.firstChild as HTMLElement

      expect(featureCard).toHaveStyle({ top: '52px' }) // 1 * 36 + 16

      rerender(<FeatureCard {...defaultProps} rowPosition={3} />)
      featureCard = container.firstChild as HTMLElement

      expect(featureCard).toHaveStyle({ top: '124px' }) // 3 * 36 + 16
    })
  })

  describe('state-based styling', () => {
    it('should apply opacity when dragged', () => {
      const { container } = render(<FeatureCard {...defaultProps} isDragged={true} />)
      const featureCard = container.firstChild as HTMLElement

      expect(featureCard).toHaveClass('opacity-50')
    })

    it('should not apply opacity when not dragged', () => {
      const { container } = render(<FeatureCard {...defaultProps} isDragged={false} />)
      const featureCard = container.firstChild as HTMLElement

      expect(featureCard).not.toHaveClass('opacity-50')
    })

    it('should apply resize styling when resizing', () => {
      const { container } = render(<FeatureCard {...defaultProps} isResizing={true} />)
      const featureCard = container.firstChild as HTMLElement

      expect(featureCard).toHaveClass('ring-2', 'ring-blue-400', 'scale-105')
    })

    it('should not apply resize styling when not resizing', () => {
      const { container } = render(<FeatureCard {...defaultProps} isResizing={false} />)
      const featureCard = container.firstChild as HTMLElement

      expect(featureCard).not.toHaveClass('ring-2', 'ring-blue-400')
    })
  })

  describe('drag functionality', () => {
    it('should call onDragStart when drag starts', () => {
      const { container } = render(<FeatureCard {...defaultProps} />)
      const featureCard = container.firstChild as HTMLElement

      const dragEvent = new Event('dragstart', { bubbles: true })
      Object.defineProperty(dragEvent, 'dataTransfer', {
        value: new DataTransfer()
      })

      fireEvent(featureCard, dragEvent)

      expect(defaultProps.onDragStart).toHaveBeenCalledWith(expect.any(Object), mockFeature)
    })

    it('should have cursor-move class', () => {
      const { container } = render(<FeatureCard {...defaultProps} />)
      const featureCard = container.firstChild as HTMLElement

      expect(featureCard).toHaveClass('cursor-move')
    })
  })

  describe('click functionality', () => {
    it('should call onFeatureClick when content is clicked', async () => {
      const user = userEvent.setup()
      render(<FeatureCard {...defaultProps} />)

      const featureContent = screen.getByText('Test Feature')
      await user.click(featureContent)

      expect(defaultProps.onFeatureClick).toHaveBeenCalledWith(mockFeature)
    })

    it('should stop propagation on content click', () => {
      render(<FeatureCard {...defaultProps} />)

      const featureContent = screen.getByText('Test Feature').closest('.flex-1') as HTMLElement
      const clickEvent = new MouseEvent('click', { bubbles: true })
      const stopPropagationSpy = vi.spyOn(clickEvent, 'stopPropagation')

      fireEvent(featureContent, clickEvent)

      expect(stopPropagationSpy).toHaveBeenCalled()
    })
  })

  describe('resize handles', () => {
    it('should render left resize handle', () => {
      const { container } = render(<FeatureCard {...defaultProps} />)

      const leftHandle = container.querySelector('.absolute.left-0.cursor-ew-resize')
      expect(leftHandle).toBeInTheDocument()
      expect(leftHandle).toHaveAttribute('title', 'Drag to resize start date')
    })

    it('should render right resize handle', () => {
      const { container } = render(<FeatureCard {...defaultProps} />)

      const rightHandle = container.querySelector('.absolute.right-0.cursor-ew-resize')
      expect(rightHandle).toBeInTheDocument()
      expect(rightHandle).toHaveAttribute('title', 'Drag to resize duration')
    })

    it('should call onMouseDown with left direction when left handle is clicked', () => {
      const { container } = render(<FeatureCard {...defaultProps} />)

      const leftHandle = container.querySelector('.absolute.left-0.cursor-ew-resize') as HTMLElement
      fireEvent.mouseDown(leftHandle)

      expect(defaultProps.onMouseDown).toHaveBeenCalledWith(
        expect.any(Object),
        'feature-1',
        'left'
      )
    })

    it('should call onMouseDown with right direction when right handle is clicked', () => {
      const { container } = render(<FeatureCard {...defaultProps} />)

      const rightHandle = container.querySelector('.absolute.right-0.cursor-ew-resize') as HTMLElement
      fireEvent.mouseDown(rightHandle)

      expect(defaultProps.onMouseDown).toHaveBeenCalledWith(
        expect.any(Object),
        'feature-1',
        'right'
      )
    })

    it('should have opacity-0 class for handles initially', () => {
      const { container } = render(<FeatureCard {...defaultProps} />)

      const leftHandle = container.querySelector('.absolute.left-0.cursor-ew-resize')
      const rightHandle = container.querySelector('.absolute.right-0.cursor-ew-resize')

      expect(leftHandle).toHaveClass('opacity-0', 'group-hover:opacity-100')
      expect(rightHandle).toHaveClass('opacity-0', 'group-hover:opacity-100')
    })

    it('should have proper dimensions for resize handles', () => {
      const { container } = render(<FeatureCard {...defaultProps} />)

      const leftHandle = container.querySelector('.absolute.left-0.cursor-ew-resize')
      const rightHandle = container.querySelector('.absolute.right-0.cursor-ew-resize')

      expect(leftHandle).toHaveClass('w-2', 'h-full')
      expect(rightHandle).toHaveClass('w-2', 'h-full')
    })
  })

  describe('feature content', () => {
    it('should have proper content styling', () => {
      render(<FeatureCard {...defaultProps} />)

      const content = screen.getByText('Test Feature').closest('.flex-1') as HTMLElement
      expect(content).toHaveClass('flex-1', 'px-3', 'py-1', 'truncate')
    })

    it('should have proper title text styling', () => {
      render(<FeatureCard {...defaultProps} />)

      const titleSpan = screen.getByText('Test Feature')
      expect(titleSpan).toHaveClass('text-xs', 'font-semibold')
    })

    it('should truncate long titles', () => {
      const longTitleFeature = {
        ...mockFeature,
        title: 'This is a very long feature title that should be truncated to avoid layout issues'
      }

      render(<FeatureCard {...defaultProps} feature={longTitleFeature} />)

      const content = screen.getByText(/This is a very long feature title/).closest('.flex-1') as HTMLElement
      expect(content).toHaveClass('truncate')
    })
  })

  describe('hover effects', () => {
    it('should have hover scale effect', () => {
      const { container } = render(<FeatureCard {...defaultProps} />)
      const featureCard = container.firstChild as HTMLElement

      expect(featureCard).toHaveClass('hover:scale-105')
    })

    it('should have hover shadow effect', () => {
      const { container } = render(<FeatureCard {...defaultProps} />)
      const featureCard = container.firstChild as HTMLElement

      expect(featureCard).toHaveClass('shadow-sm', 'hover:shadow-md')
    })

    it('should have hover z-index effect', () => {
      const { container } = render(<FeatureCard {...defaultProps} />)
      const featureCard = container.firstChild as HTMLElement

      expect(featureCard).toHaveClass('hover:z-10')
    })
  })

  describe('accessibility', () => {
    it('should have proper drag and drop attributes', () => {
      const { container } = render(<FeatureCard {...defaultProps} />)
      const featureCard = container.firstChild as HTMLElement

      expect(featureCard).toHaveAttribute('draggable', 'true')
      expect(featureCard).toHaveAttribute('title')
    })

    it('should have descriptive titles for resize handles', () => {
      const { container } = render(<FeatureCard {...defaultProps} />)

      const leftHandle = container.querySelector('.absolute.left-0.cursor-ew-resize')
      const rightHandle = container.querySelector('.absolute.right-0.cursor-ew-resize')

      expect(leftHandle).toHaveAttribute('title', 'Drag to resize start date')
      expect(rightHandle).toHaveAttribute('title', 'Drag to resize duration')
    })
  })

  describe('layout structure', () => {
    it('should have correct main container classes', () => {
      const { container } = render(<FeatureCard {...defaultProps} />)
      const featureCard = container.firstChild as HTMLElement

      expect(featureCard).toHaveClass(
        'group', 'absolute', 'h-8', 'rounded-lg', 'border-2',
        'flex', 'items-center', 'transition-all'
      )
    })

    it('should maintain proper height', () => {
      const { container } = render(<FeatureCard {...defaultProps} />)
      const featureCard = container.firstChild as HTMLElement

      expect(featureCard).toHaveClass('h-8')
    })

    it('should use absolute positioning', () => {
      const { container } = render(<FeatureCard {...defaultProps} />)
      const featureCard = container.firstChild as HTMLElement

      expect(featureCard).toHaveClass('absolute')
    })
  })

  describe('edge cases', () => {
    it('should handle empty feature title', () => {
      const emptyTitleFeature = { ...mockFeature, title: '' }
      render(<FeatureCard {...defaultProps} feature={emptyTitleFeature} />)

      const titleSpan = document.querySelector('.text-xs.font-semibold')
      expect(titleSpan).toBeInTheDocument()
      expect(titleSpan?.textContent).toBe('')
    })

    it('should handle zero row position', () => {
      const { container } = render(<FeatureCard {...defaultProps} rowPosition={0} />)
      const featureCard = container.firstChild as HTMLElement

      expect(featureCard).toHaveStyle({ top: '16px' })
    })

    it('should handle negative row position', () => {
      const { container } = render(<FeatureCard {...defaultProps} rowPosition={-1} />)
      const featureCard = container.firstChild as HTMLElement

      expect(featureCard).toHaveStyle({ top: '-20px' }) // -1 * 36 + 16
    })

    it('should handle both isDragged and isResizing being true', () => {
      const { container } = render(
        <FeatureCard {...defaultProps} isDragged={true} isResizing={true} />
      )
      const featureCard = container.firstChild as HTMLElement

      expect(featureCard).toHaveClass('opacity-50')
      expect(featureCard).toHaveClass('ring-2', 'ring-blue-400', 'scale-105')
    })
  })
})