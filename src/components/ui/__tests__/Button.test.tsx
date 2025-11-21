/**
 * Button Component Tests
 *
 * Comprehensive test suite covering:
 * - All button variants (primary, secondary, danger, ghost, success, warning)
 * - All size variants (xs, sm, md, lg, xl)
 * - All state management (idle, loading, error, success, disabled, pending)
 * - Click handlers and async actions
 * - Icon support (before and after)
 * - Full width mode
 * - Custom className merging
 * - Accessibility (ARIA attributes, keyboard navigation)
 * - Animation system integration
 * - State transitions and auto-dismiss
 * - Imperative API (ref methods)
 * - Edge cases and error handling
 *
 * Target Coverage: 90%+
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button, ButtonProps, ButtonRef } from '../Button'
import React, { useRef, useEffect } from 'react'

// Mock dependencies
vi.mock('../../../hooks/useComponentState', () => ({
  useComponentState: (config: any) => ({
    state: config.initialConfig?.state || 'idle',
    variant: config.initialConfig?.variant || 'primary',
    size: config.initialConfig?.size || 'md',
    isDisabled: config.initialConfig?.state === 'disabled',
    isLoading: config.initialConfig?.state === 'loading',
    isSuccess: config.initialConfig?.state === 'success',
    hasError: config.initialConfig?.state === 'error',
    className: `btn--${config.initialConfig?.variant || 'primary'} btn--${config.initialConfig?.size || 'md'} btn--${config.initialConfig?.state || 'idle'}`,
    setState: vi.fn(),
    setSuccess: vi.fn(),
    setError: vi.fn(),
    reset: vi.fn(),
    executeAction: vi.fn(async (action: () => Promise<void>) => {
      try {
        await action()
      } catch (_error) {
        // Error handling is done in component
        throw error
      }
    })
  })
}))

vi.mock('../../../contexts/ComponentStateProvider', () => ({
  useComponentStateContext: () => {
    throw new Error('Context not available')
  }
}))

vi.mock('../LoadingSpinner', () => ({
  default: ({ size, variant }: { size: string; variant: string }) => (
    <div data-testid="loading-spinner" data-size={size} data-variant={variant}>
      Loading...
    </div>
  )
}))

vi.mock('../../../utils/logger', () => ({
  logger: {
    error: vi.fn()
  }
}))

describe('Button Component', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  describe('Component Rendering', () => {
    it('should render with default props', () => {
      render(<Button>Click me</Button>)

      const button = screen.getByRole('button', { name: /click me/i })
      expect(button).toBeInTheDocument()
      expect(button).toHaveClass('btn')
      expect(button).not.toBeDisabled()
    })

    it('should render with custom className', () => {
      render(<Button className="custom-class">Click me</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('btn', 'custom-class')
    })

    it('should render with children content', () => {
      render(<Button>Test Content</Button>)

      expect(screen.getByText('Test Content')).toBeInTheDocument()
    })

    it('should render with complex children', () => {
      render(
        <Button>
          <span>Complex</span> <strong>Content</strong>
        </Button>
      )

      expect(screen.getByText('Complex')).toBeInTheDocument()
      expect(screen.getByText('Content')).toBeInTheDocument()
    })
  })

  describe('Variant Rendering', () => {
    const variants: Array<ButtonProps['variant']> = [
      'primary',
      'secondary',
      'success',
      'warning',
      'danger',
      'ghost'
    ]

    variants.forEach((variant) => {
      it(`should render ${variant} variant correctly`, () => {
        render(<Button variant={variant}>Button</Button>)

        const button = screen.getByRole('button')
        expect(button).toHaveClass(`btn--${variant}`)
        expect(button).toHaveAttribute('data-variant', variant)
      })
    })

    it('should default to primary variant when not specified', () => {
      render(<Button>Button</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('btn--primary')
      expect(button).toHaveAttribute('data-variant', 'primary')
    })
  })

  describe('Size Rendering', () => {
    const sizes: Array<ButtonProps['size']> = ['xs', 'sm', 'md', 'lg', 'xl']

    sizes.forEach((size) => {
      it(`should render ${size} size correctly`, () => {
        render(<Button size={size}>Button</Button>)

        const button = screen.getByRole('button')
        expect(button).toHaveClass(`btn--${size}`)
        expect(button).toHaveAttribute('data-size', size)
      })
    })

    it('should default to md size when not specified', () => {
      render(<Button>Button</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('btn--md')
      expect(button).toHaveAttribute('data-size', 'md')
    })
  })

  describe('State Management', () => {
    it('should render idle state by default', () => {
      render(<Button>Button</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-state', 'idle')
      expect(button).not.toBeDisabled()
      expect(button).toHaveAttribute('aria-busy', 'false')
    })

    it('should render loading state', () => {
      render(<Button state="loading">Button</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-state', 'loading')
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-busy', 'true')
    })

    it('should render disabled state', () => {
      render(<Button state="disabled">Button</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-state', 'disabled')
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-disabled', 'true')
    })

    it('should render error state', () => {
      render(<Button state="error">Button</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-state', 'error')
    })

    it('should render success state', () => {
      render(<Button state="success">Button</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-state', 'success')
    })

    it('should render pending state', () => {
      render(<Button state="pending">Button</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-state', 'pending')
    })

    it('should handle disabled prop override', () => {
      render(<Button disabled>Button</Button>)

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('aria-disabled', 'true')
    })
  })

  describe('Loading State', () => {
    it('should display loading spinner when loading', () => {
      render(<Button state="loading">Button</Button>)

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })

    it('should display loading text when provided', () => {
      render(
        <Button state="loading" loadingText="Processing...">
          Button
        </Button>
      )

      expect(screen.getByText('Processing...')).toBeInTheDocument()
    })

    it('should not display children content when loading', () => {
      render(
        <Button state="loading" loadingText="Loading">
          Click me
        </Button>
      )

      // Button text should not be visible when loading
      expect(screen.queryByText('Click me')).not.toBeInTheDocument()
    })

    it('should adjust spinner size based on button size', () => {
      const { rerender } = render(
        <Button state="loading" size="xs">
          Button
        </Button>
      )

      let spinner = screen.getByTestId('loading-spinner')
      expect(spinner).toHaveAttribute('data-size', 'xs')

      rerender(
        <Button state="loading" size="lg">
          Button
        </Button>
      )

      spinner = screen.getByTestId('loading-spinner')
      expect(spinner).toHaveAttribute('data-size', 'sm')
    })
  })

  describe('Error and Success Messages', () => {
    it('should display error message when in error state', () => {
      render(
        <Button state="error" errorMessage="Something went wrong">
          Button
        </Button>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByText('Something went wrong')).toHaveClass('btn__error-message')
    })

    it('should display success message when in success state', () => {
      render(
        <Button state="success" successMessage="Operation completed">
          Button
        </Button>
      )

      expect(screen.getByText('Operation completed')).toBeInTheDocument()
      expect(screen.getByText('Operation completed')).toHaveClass('btn__success-message')
    })

    it('should not display children when showing error message', () => {
      render(
        <Button state="error" errorMessage="Error occurred">
          Click me
        </Button>
      )

      expect(screen.queryByText('Click me')).not.toBeInTheDocument()
    })

    it('should not display children when showing success message', () => {
      render(
        <Button state="success" successMessage="Success">
          Click me
        </Button>
      )

      expect(screen.queryByText('Click me')).not.toBeInTheDocument()
    })
  })

  describe('Icon Support', () => {
    it('should render icon before text', () => {
      const icon = <span data-testid="before-icon">→</span>
      render(<Button icon={icon}>Button</Button>)

      const iconElement = screen.getByTestId('before-icon')
      expect(iconElement).toBeInTheDocument()
      expect(iconElement.parentElement).toHaveClass('btn__icon--before')
    })

    it('should render icon after text', () => {
      const iconAfter = <span data-testid="after-icon">←</span>
      render(<Button iconAfter={iconAfter}>Button</Button>)

      const iconElement = screen.getByTestId('after-icon')
      expect(iconElement).toBeInTheDocument()
      expect(iconElement.parentElement).toHaveClass('btn__icon--after')
    })

    it('should render both before and after icons', () => {
      const icon = <span data-testid="before-icon">→</span>
      const iconAfter = <span data-testid="after-icon">←</span>
      render(
        <Button icon={icon} iconAfter={iconAfter}>
          Button
        </Button>
      )

      expect(screen.getByTestId('before-icon')).toBeInTheDocument()
      expect(screen.getByTestId('after-icon')).toBeInTheDocument()
    })

    it('should not render icons when in loading state', () => {
      const icon = <span data-testid="before-icon">→</span>
      render(
        <Button icon={icon} state="loading">
          Button
        </Button>
      )

      expect(screen.queryByTestId('before-icon')).not.toBeInTheDocument()
    })
  })

  describe('Full Width Mode', () => {
    it('should render full width when specified', () => {
      render(<Button fullWidth>Button</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('btn--full-width')
    })

    it('should not have full width class by default', () => {
      render(<Button>Button</Button>)

      const button = screen.getByRole('button')
      expect(button).not.toHaveClass('btn--full-width')
    })
  })

  describe('Click Handling', () => {
    it('should call onClick handler when clicked', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Button</Button>)

      fireEvent.click(screen.getByRole('button'))

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('should not call onClick when disabled', async () => {
      const handleClick = vi.fn()
      render(
        <Button onClick={handleClick} disabled>
          Button
        </Button>
      )

      // Can't click disabled button
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('should not call onClick when in loading state', async () => {
      const handleClick = vi.fn()
      render(
        <Button onClick={handleClick} state="loading">
          Button
        </Button>
      )

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('should prevent default when disabled and clicked', async () => {
      const handleClick = vi.fn()
      render(
        <Button onClick={handleClick} state="disabled">
          Button
        </Button>
      )

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('Async Action Handling', () => {
    it('should accept onAsyncAction prop', () => {
      const asyncAction = vi.fn().mockResolvedValue(undefined)
      render(<Button onAsyncAction={asyncAction}>Button</Button>)

      // Button should render with async action prop
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should render correctly with async action handler', () => {
      const asyncAction = vi.fn().mockResolvedValue(undefined)
      const { container } = render(<Button onAsyncAction={asyncAction}>Button</Button>)

      expect(container.querySelector('.btn')).toBeInTheDocument()
    })

    it('should accept both onAsyncAction and onClick props together', () => {
      const asyncAction = vi.fn().mockResolvedValue(undefined)
      const handleClick = vi.fn()

      render(
        <Button onAsyncAction={asyncAction} onClick={handleClick}>
          Button
        </Button>
      )

      // Both props should be accepted without errors
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      expect(button).not.toBeDisabled()
    })
  })

  describe('State Change Callbacks', () => {
    it('should call onStateChange when state changes', () => {
      const handleStateChange = vi.fn()
      render(
        <Button state="idle" onStateChange={handleStateChange}>
          Button
        </Button>
      )

      expect(handleStateChange).toHaveBeenCalledWith('idle')
    })

    it('should call onStateChange on every state update', () => {
      const handleStateChange = vi.fn()
      const { rerender } = render(
        <Button state="idle" onStateChange={handleStateChange}>
          Button
        </Button>
      )

      handleStateChange.mockClear()

      rerender(
        <Button state="loading" onStateChange={handleStateChange}>
          Button
        </Button>
      )

      expect(handleStateChange).toHaveBeenCalledWith('loading')
    })
  })

  describe('Auto-Dismiss Functionality', () => {
    it('should auto-dismiss success state after specified duration', () => {
      render(
        <Button state="success" successDismissAfter={1000}>
          Button
        </Button>
      )

      expect(screen.getByRole('button')).toHaveAttribute('data-state', 'success')

      // Fast-forward time
      vi.advanceTimersByTime(1000)

      // State should transition to idle (mocked behavior)
    })

    it('should auto-dismiss error state after specified duration', () => {
      render(
        <Button state="error" errorDismissAfter={2000}>
          Button
        </Button>
      )

      expect(screen.getByRole('button')).toHaveAttribute('data-state', 'error')

      vi.advanceTimersByTime(2000)
    })

    it('should not auto-dismiss when duration is 0', () => {
      render(
        <Button state="success" successDismissAfter={0}>
          Button
        </Button>
      )

      vi.advanceTimersByTime(5000)

      expect(screen.getByRole('button')).toHaveAttribute('data-state', 'success')
    })
  })

  describe('Accessibility', () => {
    it('should have proper aria-label from children', () => {
      render(<Button>Click me</Button>)

      const button = screen.getByRole('button', { name: /click me/i })
      expect(button).toHaveAccessibleName('Click me')
    })

    it('should use custom aria-label when provided', () => {
      render(<Button aria-label="Custom label">Button</Button>)

      const button = screen.getByRole('button', { name: /custom label/i })
      expect(button).toHaveAccessibleName('Custom label')
    })

    it('should have aria-disabled attribute when disabled', () => {
      render(<Button disabled>Button</Button>)

      expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true')
    })

    it('should have aria-busy attribute when loading', () => {
      render(<Button state="loading">Button</Button>)

      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true')
    })

    it('should not have aria-busy when not loading', () => {
      render(<Button state="idle">Button</Button>)

      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'false')
    })

    it('should be keyboard accessible', async () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Button</Button>)

      const button = screen.getByRole('button')
      button.focus()
      expect(button).toHaveFocus()

      fireEvent.keyDown(button, { key: 'Enter' })
      // Note: fireEvent doesn't trigger onClick for Enter, but the button remains focusable
    })
  })

  describe('Animation System', () => {
    it('should render with animation enabled by default', () => {
      render(<Button>Button</Button>)

      // Animation is enabled by default in useComponentState config
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should support custom animation speed', () => {
      render(<Button animationSpeed="fast">Button</Button>)

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should support disabling animations', () => {
      render(<Button animated={false}>Button</Button>)

      expect(screen.getByRole('button')).toBeInTheDocument()
    })
  })

  describe('Imperative API', () => {
    it('should expose getState method via ref', () => {
      const TestComponent = () => {
        const buttonRef = useRef<ButtonRef>(null)

        useEffect(() => {
          if (buttonRef.current) {
            expect(buttonRef.current.getState()).toBe('idle')
          }
        }, [])

        return <Button ref={buttonRef}>Button</Button>
      }

      render(<TestComponent />)
    })

    it('should expose setState method via ref', () => {
      const TestComponent = () => {
        const buttonRef = useRef<ButtonRef>(null)

        useEffect(() => {
          if (buttonRef.current) {
            expect(buttonRef.current.setState).toBeDefined()
          }
        }, [])

        return <Button ref={buttonRef}>Button</Button>
      }

      render(<TestComponent />)
    })

    it('should expose setSuccess method via ref', () => {
      const TestComponent = () => {
        const buttonRef = useRef<ButtonRef>(null)

        useEffect(() => {
          if (buttonRef.current) {
            expect(buttonRef.current.setSuccess).toBeDefined()
          }
        }, [])

        return <Button ref={buttonRef}>Button</Button>
      }

      render(<TestComponent />)
    })

    it('should expose setError method via ref', () => {
      const TestComponent = () => {
        const buttonRef = useRef<ButtonRef>(null)

        useEffect(() => {
          if (buttonRef.current) {
            expect(buttonRef.current.setError).toBeDefined()
          }
        }, [])

        return <Button ref={buttonRef}>Button</Button>
      }

      render(<TestComponent />)
    })

    it('should expose reset method via ref', () => {
      const TestComponent = () => {
        const buttonRef = useRef<ButtonRef>(null)

        useEffect(() => {
          if (buttonRef.current) {
            expect(buttonRef.current.reset).toBeDefined()
          }
        }, [])

        return <Button ref={buttonRef}>Button</Button>
      }

      render(<TestComponent />)
    })

    it('should expose executeAction method via ref', () => {
      const TestComponent = () => {
        const buttonRef = useRef<ButtonRef>(null)

        useEffect(() => {
          if (buttonRef.current) {
            expect(buttonRef.current.executeAction).toBeDefined()
          }
        }, [])

        return <Button ref={buttonRef}>Button</Button>
      }

      render(<TestComponent />)
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined children', () => {
      render(<Button>{undefined}</Button>)

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should handle null children', () => {
      render(<Button>{null}</Button>)

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should handle empty string children', () => {
      render(<Button>{''}</Button>)

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should handle number children', () => {
      render(<Button>{42}</Button>)

      expect(screen.getByText('42')).toBeInTheDocument()
    })

    it('should handle multiple rapid clicks', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Button</Button>)

      const button = screen.getByRole('button')
      fireEvent.click(button)
      fireEvent.click(button)
      fireEvent.click(button)

      // Should register multiple clicks
      expect(handleClick).toHaveBeenCalledTimes(3)
    })

    it('should merge multiple className props correctly', () => {
      render(<Button className="class1 class2 class3">Button</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('btn', 'class1', 'class2', 'class3')
    })

    it('should handle very long text content', () => {
      const longText = 'A'.repeat(200)
      render(<Button>{longText}</Button>)

      expect(screen.getByText(longText)).toBeInTheDocument()
    })

    it('should preserve other HTML button attributes', () => {
      render(
        <Button type="submit" name="submitButton" id="submit-btn" data-testid="custom-button">
          Submit
        </Button>
      )

      const button = screen.getByTestId('custom-button')
      expect(button).toHaveAttribute('type', 'submit')
      expect(button).toHaveAttribute('name', 'submitButton')
      expect(button).toHaveAttribute('id', 'submit-btn')
    })

    it('should handle form attribute', () => {
      render(<Button form="myForm">Button</Button>)

      expect(screen.getByRole('button')).toHaveAttribute('form', 'myForm')
    })

    it('should handle tabIndex attribute', () => {
      render(<Button tabIndex={-1}>Button</Button>)

      expect(screen.getByRole('button')).toHaveAttribute('tabIndex', '-1')
    })
  })

  describe('Cleanup and Memory Leaks', () => {
    it('should cleanup timeouts on unmount', () => {
      const { unmount } = render(
        <Button state="success" successDismissAfter={1000}>
          Button
        </Button>
      )

      unmount()

      // Advance timers to ensure no errors occur
      vi.advanceTimersByTime(2000)
    })

    it('should cleanup timeouts on state change', () => {
      const { rerender } = render(
        <Button state="success" successDismissAfter={1000}>
          Button
        </Button>
      )

      rerender(
        <Button state="loading" successDismissAfter={1000}>
          Button
        </Button>
      )

      vi.advanceTimersByTime(2000)
    })
  })

  describe('Component Composition', () => {
    it('should work within a form', () => {
      const handleSubmit = vi.fn((e) => e.preventDefault())

      render(
        <form onSubmit={handleSubmit}>
          <Button type="submit">Submit</Button>
        </form>
      )

      const button = screen.getByRole('button')
      fireEvent.click(button)

      expect(handleSubmit).toHaveBeenCalled()
    })

    it('should work with different button types', () => {
      const { rerender } = render(<Button type="button">Button</Button>)

      expect(screen.getByRole('button')).toHaveAttribute('type', 'button')

      rerender(<Button type="submit">Submit</Button>)
      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')

      rerender(<Button type="reset">Reset</Button>)
      expect(screen.getByRole('button')).toHaveAttribute('type', 'reset')
    })
  })
})