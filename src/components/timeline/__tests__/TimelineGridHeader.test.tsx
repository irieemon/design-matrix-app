import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TimelineGridHeader from '../TimelineGridHeader'

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
  },
  {
    index: 3,
    name: 'APR',
    fullName: 'April 2024',
    isCurrentMonth: false
  }
]

describe('TimelineGridHeader', () => {
  describe('basic rendering', () => {
    it('should render TEAMS label with icon', () => {
      render(<TimelineGridHeader months={mockMonths} />)

      expect(screen.getByText('TEAMS')).toBeInTheDocument()

      // Check for Users icon (svg element)
      const icon = document.querySelector('svg')
      expect(icon).toBeInTheDocument()
      expect(icon).toHaveClass('w-5', 'h-5', 'text-slate-600')
    })

    it('should render all month headers', () => {
      render(<TimelineGridHeader months={mockMonths} />)

      expect(screen.getByText('JAN')).toBeInTheDocument()
      expect(screen.getByText('FEB')).toBeInTheDocument()
      expect(screen.getByText('MAR')).toBeInTheDocument()
      expect(screen.getByText('APR')).toBeInTheDocument()
    })

    it('should render with default styling', () => {
      const { container } = render(<TimelineGridHeader months={mockMonths} />)
      const headerElement = container.firstChild as HTMLElement

      expect(headerElement).toHaveClass('bg-slate-50')
      expect(headerElement).toHaveClass('border-b')
      expect(headerElement).toHaveClass('border-slate-200')
    })

    it('should accept custom className', () => {
      const customClassName = 'custom-grid-header'
      const { container } = render(<TimelineGridHeader months={mockMonths} className={customClassName} />)
      const headerElement = container.firstChild as HTMLElement

      expect(headerElement).toHaveClass(customClassName)
    })
  })

  describe('teams column', () => {
    it('should have correct teams column styling', () => {
      const { container } = render(<TimelineGridHeader months={mockMonths} />)

      const teamsColumn = container.querySelector('.w-48.flex.items-center.justify-center')
      expect(teamsColumn).toBeInTheDocument()
      expect(teamsColumn).toHaveClass('py-4', 'bg-slate-100', 'border-r', 'border-slate-200')
    })

    it('should have correct teams label styling', () => {
      render(<TimelineGridHeader months={mockMonths} />)

      const teamsLabel = screen.getByText('TEAMS')
      expect(teamsLabel).toHaveClass('font-semibold', 'text-slate-800', 'text-sm', 'tracking-wide')
    })

    it('should maintain teams column width', () => {
      const { container } = render(<TimelineGridHeader months={mockMonths} />)

      const teamsColumn = container.querySelector('.w-48')
      expect(teamsColumn).toBeInTheDocument()
    })
  })

  describe('month headers', () => {
    it('should highlight current month', () => {
      render(<TimelineGridHeader months={mockMonths} />)

      const currentMonth = screen.getByText('JAN')
      const nonCurrentMonth = screen.getByText('FEB')

      expect(currentMonth).toHaveClass('bg-blue-600', 'text-white')
      expect(nonCurrentMonth).toHaveClass('bg-slate-50', 'text-slate-700')
    })

    it('should have proper month header styling', () => {
      render(<TimelineGridHeader months={mockMonths} />)

      const monthHeaders = screen.getAllByText(/JAN|FEB|MAR|APR/)

      monthHeaders.forEach(header => {
        expect(header).toHaveClass('flex-1', 'py-4', 'text-center', 'border-r', 'border-slate-200', 'font-semibold', 'text-sm')
      })
    })

    it('should include month full name as title attribute', () => {
      render(<TimelineGridHeader months={mockMonths} />)

      const janHeader = screen.getByText('JAN')
      const febHeader = screen.getByText('FEB')

      expect(janHeader).toHaveAttribute('title', 'January 2024')
      expect(febHeader).toHaveAttribute('title', 'February 2024')
    })

    it('should render months container with flex layout', () => {
      const { container } = render(<TimelineGridHeader months={mockMonths} />)

      const monthsContainer = container.querySelector('.flex-1.flex')
      expect(monthsContainer).toBeInTheDocument()
    })

    it('should handle different month names correctly', () => {
      const differentMonths = [
        { index: 0, name: 'SEP', fullName: 'September 2024', isCurrentMonth: false },
        { index: 1, name: 'OCT', fullName: 'October 2024', isCurrentMonth: true },
        { index: 2, name: 'NOV', fullName: 'November 2024', isCurrentMonth: false },
        { index: 3, name: 'DEC', fullName: 'December 2024', isCurrentMonth: false }
      ]

      render(<TimelineGridHeader months={differentMonths} />)

      expect(screen.getByText('SEP')).toBeInTheDocument()
      expect(screen.getByText('OCT')).toBeInTheDocument()
      expect(screen.getByText('NOV')).toBeInTheDocument()
      expect(screen.getByText('DEC')).toBeInTheDocument()

      // October should be highlighted as current month
      const octHeader = screen.getByText('OCT')
      expect(octHeader).toHaveClass('bg-blue-600', 'text-white')
    })
  })

  describe('layout structure', () => {
    it('should have proper flex container structure', () => {
      const { container } = render(<TimelineGridHeader months={mockMonths} />)

      const mainContainer = container.querySelector('.flex')
      expect(mainContainer).toBeInTheDocument()

      const teamsColumn = mainContainer?.querySelector('.w-48')
      const monthsContainer = mainContainer?.querySelector('.flex-1.flex')

      expect(teamsColumn).toBeInTheDocument()
      expect(monthsContainer).toBeInTheDocument()
    })

    it('should maintain equal width distribution for months', () => {
      render(<TimelineGridHeader months={mockMonths} />)

      const monthHeaders = screen.getAllByText(/JAN|FEB|MAR|APR/)

      monthHeaders.forEach(header => {
        expect(header).toHaveClass('flex-1')
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty months array', () => {
      const { container } = render(<TimelineGridHeader months={[]} />)

      expect(screen.getByText('TEAMS')).toBeInTheDocument()

      const monthsContainer = container.querySelector('.flex-1.flex')
      expect(monthsContainer).toBeInTheDocument()
      expect(monthsContainer?.children.length).toBe(0)
    })

    it('should handle single month', () => {
      const singleMonth = [mockMonths[0]]
      render(<TimelineGridHeader months={singleMonth} />)

      expect(screen.getByText('TEAMS')).toBeInTheDocument()
      expect(screen.getByText('JAN')).toBeInTheDocument()
      expect(screen.queryByText('FEB')).not.toBeInTheDocument()
    })

    it('should handle many months', () => {
      const manyMonths = Array.from({ length: 12 }, (_, i) => ({
        index: i,
        name: `M${i + 1}`,
        fullName: `Month ${i + 1} 2024`,
        isCurrentMonth: i === 5
      }))

      render(<TimelineGridHeader months={manyMonths} />)

      expect(screen.getByText('TEAMS')).toBeInTheDocument()
      expect(screen.getByText('M1')).toBeInTheDocument()
      expect(screen.getByText('M12')).toBeInTheDocument()

      // Month 6 should be highlighted
      const m6Header = screen.getByText('M6')
      expect(m6Header).toHaveClass('bg-blue-600', 'text-white')
    })

    it('should handle months with no current month', () => {
      const noCurrentMonths = mockMonths.map(month => ({
        ...month,
        isCurrentMonth: false
      }))

      render(<TimelineGridHeader months={noCurrentMonths} />)

      const monthHeaders = screen.getAllByText(/JAN|FEB|MAR|APR/)

      monthHeaders.forEach(header => {
        expect(header).toHaveClass('bg-slate-50', 'text-slate-700')
        expect(header).not.toHaveClass('bg-blue-600', 'text-white')
      })
    })

    it('should handle months with multiple current months', () => {
      const multipleCurrentMonths = mockMonths.map(month => ({
        ...month,
        isCurrentMonth: true
      }))

      render(<TimelineGridHeader months={multipleCurrentMonths} />)

      const monthHeaders = screen.getAllByText(/JAN|FEB|MAR|APR/)

      monthHeaders.forEach(header => {
        expect(header).toHaveClass('bg-blue-600', 'text-white')
      })
    })
  })
})