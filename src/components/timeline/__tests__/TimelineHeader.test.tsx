import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TimelineHeader from '../TimelineHeader'

describe('TimelineHeader', () => {
  const defaultProps = {
    title: 'Test Project Roadmap',
    subtitle: 'Q4 2024 Planning',
    featuresCount: 5,
    onCreateFeature: vi.fn(),
    onLoadSampleData: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('basic rendering', () => {
    it('should render title and subtitle', () => {
      render(<TimelineHeader {...defaultProps} />)

      expect(screen.getByText('Test Project Roadmap')).toBeInTheDocument()
      expect(screen.getByText('Q4 2024 Planning')).toBeInTheDocument()
    })

    it('should render with default styling', () => {
      const { container } = render(<TimelineHeader {...defaultProps} />)
      const headerElement = container.firstChild as HTMLElement

      expect(headerElement).toHaveClass('bg-gradient-to-r')
      expect(headerElement).toHaveClass('from-slate-800')
      expect(headerElement).toHaveClass('to-slate-900')
      expect(headerElement).toHaveClass('text-white')
    })

    it('should accept custom className', () => {
      const customClassName = 'custom-header-class'
      const { container } = render(<TimelineHeader {...defaultProps} className={customClassName} />)
      const headerElement = container.firstChild as HTMLElement

      expect(headerElement).toHaveClass(customClassName)
    })

    it('should always render Add Feature button', () => {
      render(<TimelineHeader {...defaultProps} />)

      const addButton = screen.getByRole('button', { name: /add feature/i })
      expect(addButton).toBeInTheDocument()
      expect(addButton).toHaveClass('bg-green-600')
    })
  })

  describe('view mode toggle', () => {
    it('should not render view mode toggle when onViewModeChange is not provided', () => {
      render(<TimelineHeader {...defaultProps} />)

      expect(screen.queryByRole('button', { name: /timeline/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /detailed/i })).not.toBeInTheDocument()
    })

    it('should render view mode toggle when onViewModeChange is provided', () => {
      const onViewModeChange = vi.fn()
      render(
        <TimelineHeader
          {...defaultProps}
          viewMode="timeline"
          onViewModeChange={onViewModeChange}
        />
      )

      expect(screen.getByRole('button', { name: /timeline/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /detailed/i })).toBeInTheDocument()
    })

    it('should highlight active view mode', () => {
      const onViewModeChange = vi.fn()
      render(
        <TimelineHeader
          {...defaultProps}
          viewMode="timeline"
          onViewModeChange={onViewModeChange}
        />
      )

      const timelineButton = screen.getByRole('button', { name: /timeline/i })
      const detailedButton = screen.getByRole('button', { name: /detailed/i })

      expect(timelineButton).toHaveClass('bg-slate-600', 'text-white')
      expect(detailedButton).toHaveClass('text-slate-300')
    })

    it('should call onViewModeChange when timeline button is clicked', async () => {
      const user = userEvent.setup()
      const onViewModeChange = vi.fn()
      render(
        <TimelineHeader
          {...defaultProps}
          viewMode="detailed"
          onViewModeChange={onViewModeChange}
        />
      )

      await user.click(screen.getByRole('button', { name: /timeline/i }))
      expect(onViewModeChange).toHaveBeenCalledWith('timeline')
    })

    it('should call onViewModeChange when detailed button is clicked', async () => {
      const user = userEvent.setup()
      const onViewModeChange = vi.fn()
      render(
        <TimelineHeader
          {...defaultProps}
          viewMode="timeline"
          onViewModeChange={onViewModeChange}
        />
      )

      await user.click(screen.getByRole('button', { name: /detailed/i }))
      expect(onViewModeChange).toHaveBeenCalledWith('detailed')
    })
  })

  describe('sample data button', () => {
    it('should render Load Sample Data button when featuresCount is 0', () => {
      render(<TimelineHeader {...defaultProps} featuresCount={0} />)

      const sampleDataButton = screen.getByRole('button', { name: /load sample data/i })
      expect(sampleDataButton).toBeInTheDocument()
      expect(sampleDataButton).toHaveClass('bg-purple-600')
    })

    it('should not render Load Sample Data button when featuresCount > 0', () => {
      render(<TimelineHeader {...defaultProps} featuresCount={5} />)

      expect(screen.queryByRole('button', { name: /load sample data/i })).not.toBeInTheDocument()
    })

    it('should call onLoadSampleData when button is clicked', async () => {
      const user = userEvent.setup()
      render(<TimelineHeader {...defaultProps} featuresCount={0} />)

      await user.click(screen.getByRole('button', { name: /load sample data/i }))
      expect(defaultProps.onLoadSampleData).toHaveBeenCalledTimes(1)
    })
  })

  describe('add feature button', () => {
    it('should call onCreateFeature when Add Feature button is clicked', async () => {
      const user = userEvent.setup()
      render(<TimelineHeader {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /add feature/i }))
      expect(defaultProps.onCreateFeature).toHaveBeenCalledTimes(1)
    })

    it('should have proper styling and icons', () => {
      render(<TimelineHeader {...defaultProps} />)

      const addButton = screen.getByRole('button', { name: /add feature/i })
      expect(addButton).toHaveClass(
        'flex', 'items-center', 'space-x-2', 'px-4', 'py-2.5',
        'bg-green-600', 'hover:bg-green-700', 'rounded-xl'
      )
    })
  })

  describe('icons', () => {
    it('should render icons in buttons', () => {
      const onViewModeChange = vi.fn()
      render(
        <TimelineHeader
          {...defaultProps}
          featuresCount={0}
          viewMode="timeline"
          onViewModeChange={onViewModeChange}
        />
      )

      // Check for Lucide icons by class
      const icons = document.querySelectorAll('svg')
      expect(icons.length).toBeGreaterThan(0)

      // Icons should have correct sizes
      icons.forEach(icon => {
        expect(icon).toHaveClass('w-4', 'h-4')
      })
    })
  })

  describe('accessibility', () => {
    it('should have proper heading structure', () => {
      render(<TimelineHeader {...defaultProps} />)

      const heading = screen.getByRole('heading', { level: 2 })
      expect(heading).toHaveTextContent('Test Project Roadmap')
    })

    it('should have accessible buttons', () => {
      const onViewModeChange = vi.fn()
      render(
        <TimelineHeader
          {...defaultProps}
          featuresCount={0}
          viewMode="timeline"
          onViewModeChange={onViewModeChange}
        />
      )

      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBe(4) // Timeline, Detailed, Add Feature, Load Sample Data

      buttons.forEach(button => {
        expect(button).toBeVisible()
        expect(button.textContent).toBeTruthy()
      })
    })

    it('should support keyboard navigation', () => {
      render(<TimelineHeader {...defaultProps} />)

      const addButton = screen.getByRole('button', { name: /add feature/i })
      addButton.focus()
      expect(addButton).toHaveFocus()
    })
  })

  describe('layout and spacing', () => {
    it('should have proper flex layout', () => {
      const { container } = render(<TimelineHeader {...defaultProps} />)

      const flexContainer = container.querySelector('.flex.items-center.justify-between')
      expect(flexContainer).toBeInTheDocument()

      const buttonContainer = container.querySelector('.flex.items-center.space-x-3')
      expect(buttonContainer).toBeInTheDocument()
    })

    it('should maintain consistent spacing between buttons', () => {
      const onViewModeChange = vi.fn()
      render(
        <TimelineHeader
          {...defaultProps}
          featuresCount={0}
          viewMode="timeline"
          onViewModeChange={onViewModeChange}
        />
      )

      const buttonContainer = document.querySelector('.flex.items-center.space-x-3')
      expect(buttonContainer).toBeInTheDocument()
    })
  })
})