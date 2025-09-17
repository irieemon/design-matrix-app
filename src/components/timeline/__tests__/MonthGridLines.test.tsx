import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import MonthGridLines from '../MonthGridLines'

const mockMonths = [
  {
    index: 0,
    name: 'JAN',
    fullName: 'January 2024',
    isCurrentMonth: true
  },
  {
    index: 1,
    name: 'FEB',
    fullName: 'February 2024',
    isCurrentMonth: false
  },
  {
    index: 2,
    name: 'MAR',
    fullName: 'March 2024',
    isCurrentMonth: false
  }
]

describe('MonthGridLines', () => {
  describe('basic rendering', () => {
    it('should render grid lines for each month', () => {
      const { container } = render(<MonthGridLines months={mockMonths} />)

      const gridLines = container.querySelectorAll('.flex-1.border-r.border-slate-100')
      expect(gridLines).toHaveLength(3)
    })

    it('should render with default styling', () => {
      const { container } = render(<MonthGridLines months={mockMonths} />)
      const gridContainer = container.firstChild as HTMLElement

      expect(gridContainer).toHaveClass('absolute', 'inset-0', 'flex')
    })

    it('should accept custom className', () => {
      const customClassName = 'custom-grid-lines'
      const { container } = render(<MonthGridLines months={mockMonths} className={customClassName} />)
      const gridContainer = container.firstChild as HTMLElement

      expect(gridContainer).toHaveClass(customClassName)
    })
  })

  describe('grid line styling', () => {
    it('should have correct styling for each grid line', () => {
      const { container } = render(<MonthGridLines months={mockMonths} />)

      const gridLines = container.querySelectorAll('.flex-1.border-r.border-slate-100')

      gridLines.forEach(line => {
        expect(line).toHaveClass('flex-1')
        expect(line).toHaveClass('border-r')
        expect(line).toHaveClass('border-slate-100')
      })
    })

    it('should use proper key attributes', () => {
      const { container } = render(<MonthGridLines months={mockMonths} />)

      const gridLines = container.querySelectorAll('.flex-1.border-r.border-slate-100')
      expect(gridLines).toHaveLength(3)

      // Check that each line is rendered (implicit key handling by React)
      gridLines.forEach((line, index) => {
        expect(line).toBeInTheDocument()
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty months array', () => {
      const { container } = render(<MonthGridLines months={[]} />)
      const gridContainer = container.firstChild as HTMLElement

      expect(gridContainer).toBeInTheDocument()
      expect(gridContainer.children).toHaveLength(0)
    })

    it('should handle single month', () => {
      const singleMonth = [mockMonths[0]]
      const { container } = render(<MonthGridLines months={singleMonth} />)

      const gridLines = container.querySelectorAll('.flex-1.border-r.border-slate-100')
      expect(gridLines).toHaveLength(1)
    })

    it('should handle many months', () => {
      const manyMonths = Array.from({ length: 12 }, (_, i) => ({
        index: i,
        name: `M${i + 1}`,
        fullName: `Month ${i + 1} 2024`,
        isCurrentMonth: false
      }))

      const { container } = render(<MonthGridLines months={manyMonths} />)

      const gridLines = container.querySelectorAll('.flex-1.border-r.border-slate-100')
      expect(gridLines).toHaveLength(12)
    })

    it('should not depend on month properties other than index', () => {
      const monthsWithMissingProps = [
        { index: 0, name: '', fullName: '', isCurrentMonth: false },
        { index: 1, name: '', fullName: '', isCurrentMonth: false }
      ]

      const { container } = render(<MonthGridLines months={monthsWithMissingProps} />)

      const gridLines = container.querySelectorAll('.flex-1.border-r.border-slate-100')
      expect(gridLines).toHaveLength(2)
    })
  })

  describe('layout behavior', () => {
    it('should use flex layout for equal distribution', () => {
      const { container } = render(<MonthGridLines months={mockMonths} />)
      const gridContainer = container.firstChild as HTMLElement

      expect(gridContainer).toHaveClass('flex')

      const gridLines = container.querySelectorAll('.flex-1')
      gridLines.forEach(line => {
        expect(line).toHaveClass('flex-1')
      })
    })

    it('should fill container space with absolute positioning', () => {
      const { container } = render(<MonthGridLines months={mockMonths} />)
      const gridContainer = container.firstChild as HTMLElement

      expect(gridContainer).toHaveClass('absolute', 'inset-0')
    })

    it('should maintain consistent border styling', () => {
      const { container } = render(<MonthGridLines months={mockMonths} />)

      const gridLines = container.querySelectorAll('.flex-1.border-r.border-slate-100')
      gridLines.forEach(line => {
        expect(line).toHaveClass('border-r', 'border-slate-100')
      })
    })
  })
})