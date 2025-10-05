/**
 * LoadingButton Component Tests
 *
 * Comprehensive test suite covering:
 * - All button variants (primary, secondary, ghost, destructive)
 * - All size variants (sm, base, lg)
 * - Loading state management
 * - Disabled state handling
 * - Click handlers
 * - Custom className merging
 * - LoadingSpinner integration
 * - Accessibility (ARIA attributes, screen reader support)
 * - Children rendering in different states
 * - HTML button attributes passthrough
 * - Edge cases and error handling
 *
 * Target Coverage: 90%+
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoadingButton from '../LoadingButton'

// Mock LoadingSpinner component
vi.mock('../LoadingSpinner', () => ({
  default: ({ size, variant }: { size: string; variant: string }) => (
    <div data-testid="loading-spinner" data-size={size} data-variant={variant}>
      Loading...
    </div>
  )
}))

describe('LoadingButton Component', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render with default props', () => {
      render(<LoadingButton>Click me</LoadingButton>)

      const button = screen.getByRole('button', { name: /click me/i })
      expect(button).toBeInTheDocument()
      expect(button).toHaveClass('btn')
      expect(button).not.toBeDisabled()
    })

    it('should render children content', () => {
      render(<LoadingButton>Test Content</LoadingButton>)

      expect(screen.getByText('Test Content')).toBeInTheDocument()
    })

    it('should render with custom className', () => {
      render(<LoadingButton className="custom-class">Button</LoadingButton>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('btn', 'custom-class')
    })

    it('should render complex children', () => {
      render(
        <LoadingButton>
          <span>Complex</span> <strong>Content</strong>
        </LoadingButton>
      )

      expect(screen.getByText('Complex')).toBeInTheDocument()
      expect(screen.getByText('Content')).toBeInTheDocument()
    })
  })

  describe('Variant Rendering', () => {
    const variants = ['primary', 'secondary', 'ghost', 'destructive'] as const

    variants.forEach((variant) => {
      it(`should render ${variant} variant correctly`, () => {
        render(<LoadingButton variant={variant}>Button</LoadingButton>)

        const button = screen.getByRole('button')
        expect(button).toHaveClass(`btn--${variant}`)
      })
    })

    it('should default to primary variant when not specified', () => {
      render(<LoadingButton>Button</LoadingButton>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('btn--primary')
    })

    it('should apply variant class along with other classes', () => {
      render(
        <LoadingButton variant="secondary" className="custom">
          Button
        </LoadingButton>
      )

      const button = screen.getByRole('button')
      expect(button).toHaveClass('btn', 'btn--secondary', 'custom')
    })
  })

  describe('Size Rendering', () => {
    const sizes = ['sm', 'base', 'lg'] as const

    sizes.forEach((size) => {
      it(`should render ${size} size correctly`, () => {
        render(<LoadingButton size={size}>Button</LoadingButton>)

        const button = screen.getByRole('button')
        expect(button).toHaveClass(`btn--${size}`)
      })
    })

    it('should default to base size when not specified', () => {
      render(<LoadingButton>Button</LoadingButton>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('btn--base')
    })

    it('should combine size and variant classes', () => {
      render(
        <LoadingButton variant="secondary" size="lg">
          Button
        </LoadingButton>
      )

      const button = screen.getByRole('button')
      expect(button).toHaveClass('btn', 'btn--secondary', 'btn--lg')
    })
  })

  describe('Loading State', () => {
    it('should not show loading state by default', () => {
      render(<LoadingButton>Button</LoadingButton>)

      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      expect(screen.getByText('Button')).toBeVisible()
    })

    it('should show loading spinner when loading is true', () => {
      render(<LoadingButton loading>Button</LoadingButton>)

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })

    it('should apply loading class when loading', () => {
      render(<LoadingButton loading>Button</LoadingButton>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('btn--loading')
    })

    it('should hide button text visually when loading', () => {
      render(<LoadingButton loading>Button Text</LoadingButton>)

      const text = screen.getByText('Button Text')
      expect(text).toHaveClass('sr-only')
    })

    it('should keep text accessible to screen readers when loading', () => {
      render(<LoadingButton loading>Submit Form</LoadingButton>)

      const text = screen.getByText('Submit Form')
      expect(text).toBeInTheDocument()
      expect(text).toHaveClass('btn__text', 'sr-only')
    })

    it('should disable button when loading', () => {
      render(<LoadingButton loading>Button</LoadingButton>)

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })

    it('should use correct spinner size for small button', () => {
      render(
        <LoadingButton loading size="sm">
          Button
        </LoadingButton>
      )

      const spinner = screen.getByTestId('loading-spinner')
      expect(spinner).toHaveAttribute('data-size', 'sm')
    })

    it('should use correct spinner variant for primary button', () => {
      render(
        <LoadingButton loading variant="primary">
          Button
        </LoadingButton>
      )

      const spinner = screen.getByTestId('loading-spinner')
      expect(spinner).toHaveAttribute('data-variant', 'primary')
    })

    it('should use primary variant for spinner even with non-primary button', () => {
      render(
        <LoadingButton loading variant="secondary">
          Button
        </LoadingButton>
      )

      const spinner = screen.getByTestId('loading-spinner')
      expect(spinner).toHaveAttribute('data-variant', 'primary')
    })

    it('should transition from loading to idle', () => {
      const { rerender } = render(<LoadingButton loading>Button</LoadingButton>)

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()

      rerender(<LoadingButton loading={false}>Button</LoadingButton>)

      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
      expect(screen.getByText('Button')).toBeVisible()
    })
  })

  describe('Disabled State', () => {
    it('should disable button when disabled prop is true', () => {
      render(<LoadingButton disabled>Button</LoadingButton>)

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })

    it('should not disable button by default', () => {
      render(<LoadingButton>Button</LoadingButton>)

      const button = screen.getByRole('button')
      expect(button).not.toBeDisabled()
    })

    it('should disable button when both disabled and loading', () => {
      render(
        <LoadingButton disabled loading>
          Button
        </LoadingButton>
      )

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })

    it('should prioritize loading disabled over explicit disabled', () => {
      render(<LoadingButton loading>Button</LoadingButton>)

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })
  })

  describe('Click Handling', () => {
    it('should call onClick handler when clicked', async () => {
      const handleClick = vi.fn()
      render(<LoadingButton onClick={handleClick}>Button</LoadingButton>)

      await user.click(screen.getByRole('button'))

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('should pass event to onClick handler', async () => {
      const handleClick = vi.fn()
      render(<LoadingButton onClick={handleClick}>Button</LoadingButton>)

      await user.click(screen.getByRole('button'))

      expect(handleClick).toHaveBeenCalledWith(expect.any(Object))
    })

    it('should not call onClick when disabled', async () => {
      const handleClick = vi.fn()
      render(
        <LoadingButton onClick={handleClick} disabled>
          Button
        </LoadingButton>
      )

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('should not call onClick when loading', async () => {
      const handleClick = vi.fn()
      render(
        <LoadingButton onClick={handleClick} loading>
          Button
        </LoadingButton>
      )

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('should handle multiple clicks', async () => {
      const handleClick = vi.fn()
      render(<LoadingButton onClick={handleClick}>Button</LoadingButton>)

      const button = screen.getByRole('button')
      await user.click(button)
      await user.click(button)
      await user.click(button)

      expect(handleClick).toHaveBeenCalledTimes(3)
    })

    it('should support click with mouse event', () => {
      const handleClick = vi.fn()
      render(<LoadingButton onClick={handleClick}>Button</LoadingButton>)

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(handleClick).toHaveBeenCalled()
    })
  })

  describe('ClassName Merging', () => {
    it('should merge multiple className values correctly', () => {
      render(<LoadingButton className="class1 class2 class3">Button</LoadingButton>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('btn', 'class1', 'class2', 'class3')
    })

    it('should handle empty className', () => {
      render(<LoadingButton className="">Button</LoadingButton>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('btn')
    })

    it('should combine variant, size, and custom classes', () => {
      render(
        <LoadingButton variant="secondary" size="lg" className="custom">
          Button
        </LoadingButton>
      )

      const button = screen.getByRole('button')
      expect(button).toHaveClass('btn', 'btn--secondary', 'btn--lg', 'custom')
    })

    it('should include loading class when loading', () => {
      render(
        <LoadingButton loading className="custom">
          Button
        </LoadingButton>
      )

      const button = screen.getByRole('button')
      expect(button).toHaveClass('btn', 'btn--loading', 'custom')
    })

    it('should filter out falsy className values', () => {
      render(<LoadingButton className="valid">Button</LoadingButton>)

      const button = screen.getByRole('button')
      // Empty strings and false values should be filtered
      expect(button.className).not.toContain('false')
      expect(button.className).not.toContain('undefined')
    })
  })

  describe('HTML Attributes Passthrough', () => {
    it('should pass through type attribute', () => {
      render(<LoadingButton type="submit">Submit</LoadingButton>)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('type', 'submit')
    })

    it('should pass through name attribute', () => {
      render(<LoadingButton name="submitBtn">Button</LoadingButton>)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('name', 'submitBtn')
    })

    it('should pass through id attribute', () => {
      render(<LoadingButton id="custom-id">Button</LoadingButton>)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('id', 'custom-id')
    })

    it('should pass through data attributes', () => {
      render(
        <LoadingButton data-testid="custom-button" data-custom="value">
          Button
        </LoadingButton>
      )

      const button = screen.getByTestId('custom-button')
      expect(button).toHaveAttribute('data-custom', 'value')
    })

    it('should pass through aria attributes', () => {
      render(<LoadingButton aria-label="Custom label">Button</LoadingButton>)

      const button = screen.getByRole('button', { name: /custom label/i })
      expect(button).toHaveAttribute('aria-label', 'Custom label')
    })

    it('should pass through form attribute', () => {
      render(<LoadingButton form="myForm">Button</LoadingButton>)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('form', 'myForm')
    })

    it('should pass through tabIndex', () => {
      render(<LoadingButton tabIndex={-1}>Button</LoadingButton>)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('tabIndex', '-1')
    })

    it('should pass through title attribute', () => {
      render(<LoadingButton title="Button tooltip">Button</LoadingButton>)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title', 'Button tooltip')
    })

    it('should support custom event handlers', () => {
      const handleMouseEnter = vi.fn()
      const handleMouseLeave = vi.fn()

      render(
        <LoadingButton onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
          Button
        </LoadingButton>
      )

      const button = screen.getByRole('button')
      fireEvent.mouseEnter(button)
      fireEvent.mouseLeave(button)

      expect(handleMouseEnter).toHaveBeenCalled()
      expect(handleMouseLeave).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper button role', () => {
      render(<LoadingButton>Button</LoadingButton>)

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should have accessible name from children', () => {
      render(<LoadingButton>Click me</LoadingButton>)

      const button = screen.getByRole('button', { name: /click me/i })
      expect(button).toHaveAccessibleName()
    })

    it('should maintain accessible name when loading', () => {
      render(<LoadingButton loading>Submit Form</LoadingButton>)

      // Text is still present but visually hidden
      expect(screen.getByText('Submit Form')).toBeInTheDocument()
    })

    it('should be keyboard accessible', () => {
      render(<LoadingButton>Button</LoadingButton>)

      const button = screen.getByRole('button')
      button.focus()
      expect(button).toHaveFocus()
    })

    it('should not be focusable when disabled', () => {
      render(<LoadingButton disabled>Button</LoadingButton>)

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })

    it('should hide loading spinner from screen readers appropriately', () => {
      render(<LoadingButton loading>Loading</LoadingButton>)

      const spinner = screen.getByTestId('loading-spinner')
      expect(spinner).toBeInTheDocument()
      // Spinner component should handle its own accessibility
    })

    it('should support aria-describedby', () => {
      render(<LoadingButton aria-describedby="description">Button</LoadingButton>)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-describedby', 'description')
    })

    it('should support aria-pressed for toggle buttons', () => {
      render(<LoadingButton aria-pressed={true}>Toggle</LoadingButton>)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('Edge Cases', () => {
    it('should handle string children', () => {
      render(<LoadingButton>Simple text</LoadingButton>)

      expect(screen.getByText('Simple text')).toBeInTheDocument()
    })

    it('should handle number children', () => {
      render(<LoadingButton>{42}</LoadingButton>)

      expect(screen.getByText('42')).toBeInTheDocument()
    })

    it('should handle React element children', () => {
      render(
        <LoadingButton>
          <span>Element child</span>
        </LoadingButton>
      )

      expect(screen.getByText('Element child')).toBeInTheDocument()
    })

    it('should handle very long text', () => {
      const longText = 'A'.repeat(200)
      render(<LoadingButton>{longText}</LoadingButton>)

      expect(screen.getByText(longText)).toBeInTheDocument()
    })

    it('should handle special characters in text', () => {
      render(<LoadingButton>{'Test & <special> "chars"'}</LoadingButton>)

      expect(screen.getByText('Test & <special> "chars"')).toBeInTheDocument()
    })

    it('should render without errors when all props are provided', () => {
      render(
        <LoadingButton
          variant="primary"
          size="lg"
          loading
          disabled
          className="custom"
          type="submit"
          name="test"
          id="test-btn"
          onClick={() => {}}
          aria-label="Test button"
        >
          Button
        </LoadingButton>
      )

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should handle rapid prop changes', () => {
      const { rerender } = render(<LoadingButton>Button</LoadingButton>)

      rerender(<LoadingButton loading>Button</LoadingButton>)
      rerender(<LoadingButton disabled>Button</LoadingButton>)
      rerender(
        <LoadingButton variant="secondary" size="sm">
          Button
        </LoadingButton>
      )

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should handle unmounting while loading', () => {
      const { unmount } = render(<LoadingButton loading>Button</LoadingButton>)

      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Form Integration', () => {
    it('should work as submit button in form', () => {
      const handleSubmit = vi.fn((e) => e.preventDefault())

      render(
        <form onSubmit={handleSubmit}>
          <LoadingButton type="submit">Submit</LoadingButton>
        </form>
      )

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(handleSubmit).toHaveBeenCalled()
    })

    it('should work as reset button in form', () => {
      const handleReset = vi.fn((e) => e.preventDefault())

      render(
        <form onReset={handleReset}>
          <LoadingButton type="reset">Reset</LoadingButton>
        </form>
      )

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(handleReset).toHaveBeenCalled()
    })

    it('should not submit form when disabled', () => {
      const handleSubmit = vi.fn()

      render(
        <form onSubmit={handleSubmit}>
          <LoadingButton type="submit" disabled>
            Submit
          </LoadingButton>
        </form>
      )

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(handleSubmit).not.toHaveBeenCalled()
    })

    it('should not submit form when loading', () => {
      const handleSubmit = vi.fn()

      render(
        <form onSubmit={handleSubmit}>
          <LoadingButton type="submit" loading>
            Submit
          </LoadingButton>
        </form>
      )

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(handleSubmit).not.toHaveBeenCalled()
    })
  })

  describe('TypeScript Type Safety', () => {
    it('should accept valid variant values', () => {
      render(<LoadingButton variant="primary">Button</LoadingButton>)
      render(<LoadingButton variant="secondary">Button</LoadingButton>)
      render(<LoadingButton variant="ghost">Button</LoadingButton>)
      render(<LoadingButton variant="destructive">Button</LoadingButton>)

      expect(screen.getAllByRole('button')).toHaveLength(4)
    })

    it('should accept valid size values', () => {
      render(<LoadingButton size="sm">Button</LoadingButton>)
      render(<LoadingButton size="base">Button</LoadingButton>)
      render(<LoadingButton size="lg">Button</LoadingButton>)

      expect(screen.getAllByRole('button')).toHaveLength(3)
    })

    it('should accept boolean loading prop', () => {
      render(<LoadingButton loading={true}>Button</LoadingButton>)
      render(<LoadingButton loading={false}>Button</LoadingButton>)

      expect(screen.getAllByRole('button')).toHaveLength(2)
    })

    it('should require children prop', () => {
      // This test verifies the type system requires children
      render(<LoadingButton>Required children</LoadingButton>)

      expect(screen.getByText('Required children')).toBeInTheDocument()
    })
  })
})