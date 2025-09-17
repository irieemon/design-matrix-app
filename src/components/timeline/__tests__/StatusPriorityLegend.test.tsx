import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatusPriorityLegend from '../StatusPriorityLegend'

describe('StatusPriorityLegend', () => {
  it('should render all status indicators', () => {
    render(<StatusPriorityLegend />)

    expect(screen.getByText('STATUS:')).toBeInTheDocument()
    expect(screen.getByText('Planned')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('should render all priority indicators', () => {
    render(<StatusPriorityLegend />)

    expect(screen.getByText('PRIORITY:')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()
    expect(screen.getByText('Low')).toBeInTheDocument()
  })

  it('should render with default styling classes', () => {
    const { container } = render(<StatusPriorityLegend />)
    const legendElement = container.firstChild as HTMLElement

    expect(legendElement).toHaveClass('bg-slate-50')
    expect(legendElement).toHaveClass('px-6')
    expect(legendElement).toHaveClass('py-4')
    expect(legendElement).toHaveClass('border-t')
    expect(legendElement).toHaveClass('border-slate-200')
  })

  it('should accept custom className', () => {
    const customClassName = 'custom-legend-class'
    const { container } = render(<StatusPriorityLegend className={customClassName} />)
    const legendElement = container.firstChild as HTMLElement

    expect(legendElement).toHaveClass(customClassName)
  })

  it('should have correct color indicators for status', () => {
    const { container } = render(<StatusPriorityLegend />)

    // Find status indicators by their background colors
    const plannedIndicator = container.querySelector('.bg-slate-200.rounded')
    const inProgressIndicator = container.querySelector('.bg-blue-400.rounded')
    const completedIndicator = container.querySelector('.bg-slate-400.rounded')

    expect(plannedIndicator).toBeInTheDocument()
    expect(inProgressIndicator).toBeInTheDocument()
    expect(completedIndicator).toBeInTheDocument()

    // Check dimensions
    expect(plannedIndicator).toHaveClass('w-3', 'h-3')
    expect(inProgressIndicator).toHaveClass('w-3', 'h-3')
    expect(completedIndicator).toHaveClass('w-3', 'h-3')
  })

  it('should have correct color indicators for priority', () => {
    const { container } = render(<StatusPriorityLegend />)

    // Find priority indicators by their background colors
    const highIndicator = container.querySelector('.bg-red-400.rounded')
    const mediumIndicator = container.querySelector('.bg-yellow-400.rounded')
    const lowIndicator = container.querySelector('.bg-blue-400.rounded')

    expect(highIndicator).toBeInTheDocument()
    expect(mediumIndicator).toBeInTheDocument()
    expect(lowIndicator).toBeInTheDocument()

    // Check dimensions
    expect(highIndicator).toHaveClass('w-3', 'h-3')
    expect(mediumIndicator).toHaveClass('w-3', 'h-3')
    expect(lowIndicator).toHaveClass('w-3', 'h-3')
  })

  it('should have proper layout structure', () => {
    const { container } = render(<StatusPriorityLegend />)

    // Check main container structure
    const mainContainer = container.querySelector('.flex.items-center.justify-between.text-xs')
    expect(mainContainer).toBeInTheDocument()

    // Check status section
    const statusSection = mainContainer?.querySelector('.flex.items-center.space-x-6')
    expect(statusSection).toBeInTheDocument()

    // Check that STATUS and PRIORITY labels have correct styling
    const statusLabel = screen.getByText('STATUS:')
    const priorityLabel = screen.getByText('PRIORITY:')

    expect(statusLabel).toHaveClass('font-semibold', 'text-slate-700', 'tracking-wide')
    expect(priorityLabel).toHaveClass('font-semibold', 'text-slate-700', 'tracking-wide')
  })

  it('should maintain consistent spacing between elements', () => {
    const { container } = render(<StatusPriorityLegend />)

    // Check for space-x-6 class on status items container
    const statusContainer = container.querySelector('.flex.items-center.space-x-6')
    expect(statusContainer).toBeInTheDocument()

    // Check for space-x-1 class on individual status/priority items
    const statusItems = container.querySelectorAll('.flex.items-center.space-x-1')
    expect(statusItems.length).toBeGreaterThan(0)
  })
})