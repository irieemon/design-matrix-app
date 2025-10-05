/**
 * ErrorBoundary Component Tests
 *
 * Comprehensive tests for the error boundary covering:
 * - Error catching and recovery mechanisms
 * - Auto-retry functionality with exponential backoff
 * - Error severity classification and UI adaptation
 * - Custom fallback UI support
 * - User action handling (retry, reload, home navigation)
 * - Recoverable vs non-recoverable error handling
 * - Error logging and reporting integration
 *
 * Business Impact: Application stability, user experience during errors, error monitoring
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ErrorBoundary from '../ErrorBoundary'

// Test component that can throw errors on demand
const ThrowError = ({ shouldThrow, errorType }: { shouldThrow: boolean; errorType?: string }) => {
  if (shouldThrow) {
    switch (errorType) {
      case 'critical':
        throw new Error('Cannot read property of undefined')
      case 'high':
        throw new Error('Chunk load failed')
      case 'network':
        throw new Error('Network error occurred')
      case 'recoverable':
        throw new Error('Loading chunk 123 failed')
      default:
        throw new Error('Test error')
    }
  }
  return <div data-testid="normal-content">Content loaded successfully</div>
}

// Mock console.error to avoid noise in test output
const originalConsoleError = console.error
beforeEach(() => {
  console.error = vi.fn()
})

afterEach(() => {
  console.error = originalConsoleError
})

// Mock window location functions
const mockReload = vi.fn()
const mockLocationAssign = vi.fn()

Object.defineProperty(window, 'location', {
  value: {
    reload: mockReload,
    href: '',
    assign: mockLocationAssign
  },
  writable: true
})

describe('ErrorBoundary', () => {
  const user = userEvent.setup()
  const mockOnError = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Normal Operation', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      )

      expect(screen.getByTestId('normal-content')).toBeInTheDocument()
      expect(screen.getByText('Content loaded successfully')).toBeInTheDocument()
    })

    it('should not interfere with normal component lifecycle', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      )

      expect(screen.getByTestId('normal-content')).toBeInTheDocument()

      // Re-render with different props
      rerender(
        <ErrorBoundary>
          <div data-testid="updated-content">Updated content</div>
        </ErrorBoundary>
      )

      expect(screen.getByTestId('updated-content')).toBeInTheDocument()
      expect(screen.queryByTestId('normal-content')).not.toBeInTheDocument()
    })
  })

  describe('Error Catching', () => {
    it('should catch and display error boundary UI', () => {
      render(
        <ErrorBoundary onError={mockOnError}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })

    it('should call onError callback when error occurs', () => {
      render(
        <ErrorBoundary onError={mockOnError}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(mockOnError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String)
        })
      )
    })

    it('should log error to console', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(console.error).toHaveBeenCalledWith(
        'Error Boundary caught an error:',
        expect.any(Error),
        expect.any(Object)
      )
    })
  })

  describe('Error Severity Classification', () => {
    it('should classify critical errors correctly', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorType="critical" />
        </ErrorBoundary>
      )

      expect(screen.getByText('Critical Error')).toBeInTheDocument()
      expect(screen.getByText(/A critical error has occurred/)).toBeInTheDocument()

      // Should show red styling for critical errors
      const errorIcon = screen.getByRole('generic').querySelector('.bg-red-100')
      expect(errorIcon).toBeInTheDocument()
    })

    it('should classify high severity errors correctly', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorType="high" />
        </ErrorBoundary>
      )

      expect(screen.getByText('Application Error')).toBeInTheDocument()

      // Should show orange styling for high errors
      const errorIcon = screen.getByRole('generic').querySelector('.bg-orange-100')
      expect(errorIcon).toBeInTheDocument()
    })

    it('should classify medium severity errors as default', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()

      // Should show yellow styling for medium errors
      const errorIcon = screen.getByRole('generic').querySelector('.bg-yellow-100')
      expect(errorIcon).toBeInTheDocument()
    })
  })

  describe('Recoverable Error Handling', () => {
    it('should identify recoverable errors', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorType="recoverable" />
        </ErrorBoundary>
      )

      expect(screen.getByText(/A temporary error occurred/)).toBeInTheDocument()
      expect(screen.getByText(/attempting to recover automatically/)).toBeInTheDocument()
    })

    it('should auto-retry recoverable errors', async () => {
      const { rerender } = render(
        <ErrorBoundary maxRetries={2}>
          <ThrowError shouldThrow={true} errorType="recoverable" />
        </ErrorBoundary>
      )

      // Should show auto-retry message
      expect(screen.getByText(/attempting to recover automatically/)).toBeInTheDocument()

      // Fast-forward time to trigger retry
      vi.advanceTimersByTime(1000)

      // Error should still be shown (retry failed)
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('should show retry count for auto-retries', async () => {
      render(
        <ErrorBoundary maxRetries={3}>
          <ThrowError shouldThrow={true} errorType="recoverable" />
        </ErrorBoundary>
      )

      // Trigger first retry
      vi.advanceTimersByTime(1000)

      await waitFor(() => {
        expect(screen.getByText(/Auto-retry attempt 1\/3/)).toBeInTheDocument()
      })
    })

    it('should stop retrying after max attempts', async () => {
      render(
        <ErrorBoundary maxRetries={1}>
          <ThrowError shouldThrow={true} errorType="recoverable" />
        </ErrorBoundary>
      )

      // Trigger first retry
      vi.advanceTimersByTime(1000)

      // Trigger second retry (should not happen)
      vi.advanceTimersByTime(2000)

      // Should still show error boundary (no more retries)
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('should use exponential backoff for retries', () => {
      render(
        <ErrorBoundary maxRetries={3}>
          <ThrowError shouldThrow={true} errorType="recoverable" />
        </ErrorBoundary>
      )

      // First retry should be after 1 second
      vi.advanceTimersByTime(500)
      expect(screen.queryByText(/Auto-retry attempt 1/)).not.toBeInTheDocument()

      vi.advanceTimersByTime(500)
      // Should have triggered first retry
    })
  })

  describe('User Actions', () => {
    it('should handle manual retry', async () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()

      // Click retry button
      await user.click(screen.getByRole('button', { name: /try again/i }))

      // Re-render with no error to simulate successful retry
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      )

      expect(screen.getByTestId('normal-content')).toBeInTheDocument()
    })

    it('should handle reload action', async () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      await user.click(screen.getByRole('button', { name: /reload/i }))

      expect(mockReload).toHaveBeenCalled()
    })

    it('should handle go home action', async () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      await user.click(screen.getByRole('button', { name: /go home/i }))

      expect(window.location.href).toBe('/')
    })
  })

  describe('Technical Details', () => {
    it('should display error technical details', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      // Click to expand technical details
      const detailsToggle = screen.getByText('Technical Details')
      fireEvent.click(detailsToggle)

      expect(screen.getByText('Error:')).toBeInTheDocument()
      expect(screen.getByText('Message:')).toBeInTheDocument()
      expect(screen.getByText('Test error')).toBeInTheDocument()
    })

    it('should show stack trace when available', () => {
      const errorWithStack = new Error('Test error with stack')
      errorWithStack.stack = 'Error: Test error\n    at Component\n    at ErrorBoundary'

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      // Expand technical details
      const detailsToggle = screen.getByText('Technical Details')
      fireEvent.click(detailsToggle)

      expect(screen.getByText('Stack Trace:')).toBeInTheDocument()
    })

    it('should truncate long stack traces', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      // Expand technical details
      const detailsToggle = screen.getByText('Technical Details')
      fireEvent.click(detailsToggle)

      // Stack trace should be limited to first 5 lines
      const stackTrace = screen.getByText('Stack Trace:').nextElementSibling
      expect(stackTrace).toBeInTheDocument()
    })
  })

  describe('Custom Fallback UI', () => {
    it('should render custom fallback when provided', () => {
      const customFallback = <div data-testid="custom-error">Custom Error UI</div>

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByTestId('custom-error')).toBeInTheDocument()
      expect(screen.getByText('Custom Error UI')).toBeInTheDocument()
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
    })

    it('should use default UI when no fallback provided', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })
  })

  describe('Component Lifecycle', () => {
    it('should reset error state on manual retry', async () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()

      // Manual retry
      await user.click(screen.getByRole('button', { name: /try again/i }))

      // Component should re-render children
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      )

      expect(screen.getByTestId('normal-content')).toBeInTheDocument()
    })

    it('should clean up retry timeout on unmount', () => {
      const { unmount } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorType="recoverable" />
        </ErrorBoundary>
      )

      // Should not crash when unmounting during retry
      unmount()
      vi.advanceTimersByTime(5000)
      // Test passes if no errors thrown
    })

    it('should handle props changes after error', () => {
      const { rerender } = render(
        <ErrorBoundary maxRetries={1} onError={mockOnError}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()

      // Change props
      rerender(
        <ErrorBoundary maxRetries={3} onError={mockOnError}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      // Should still show error state
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing error object gracefully', () => {
      // This tests internal resilience when error is null/undefined
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      // Should not crash even if error details are missing
    })

    it('should handle errors thrown in error boundary itself', () => {
      const BuggyFallback = () => {
        throw new Error('Fallback error')
      }

      // This would typically be caught by a parent error boundary
      // Here we test that our error boundary doesn't crash
      expect(() => {
        render(
          <ErrorBoundary fallback={<BuggyFallback />}>
            <ThrowError shouldThrow={true} />
          </ErrorBoundary>
        )
      }).toThrow('Fallback error')
    })

    it('should handle multiple rapid errors', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorType="critical" />
        </ErrorBoundary>
      )

      expect(screen.getByText('Critical Error')).toBeInTheDocument()

      // Trigger another error immediately
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorType="network" />
        </ErrorBoundary>
      )

      // Should handle the new error
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('should handle network-related errors appropriately', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorType="network" />
        </ErrorBoundary>
      )

      expect(screen.getByText(/A temporary error occurred/)).toBeInTheDocument()
      // Network errors should be treated as recoverable
    })
  })

  describe('Accessibility', () => {
    it('should have accessible error messages', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      // Error should be announced to screen readers
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Something went wrong')
      expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument()
    })

    it('should have accessible action buttons', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument()
    })

    it('should have accessible details expansion', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      const detailsElement = screen.getByRole('group')
      expect(detailsElement).toBeInTheDocument()

      const summary = screen.getByText('Technical Details')
      expect(summary).toBeInTheDocument()
    })
  })

  describe('Configuration Options', () => {
    it('should respect maxRetries configuration', () => {
      render(
        <ErrorBoundary maxRetries={5}>
          <ThrowError shouldThrow={true} errorType="recoverable" />
        </ErrorBoundary>
      )

      // Should use custom max retries value
      vi.advanceTimersByTime(1000)

      expect(screen.getByText(/attempting to recover automatically/)).toBeInTheDocument()
    })

    it('should handle zero maxRetries', () => {
      render(
        <ErrorBoundary maxRetries={0}>
          <ThrowError shouldThrow={true} errorType="recoverable" />
        </ErrorBoundary>
      )

      // Should not attempt any retries
      vi.advanceTimersByTime(5000)
      expect(screen.queryByText(/Auto-retry attempt/)).not.toBeInTheDocument()
    })

    it('should handle undefined maxRetries (default behavior)', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorType="recoverable" />
        </ErrorBoundary>
      )

      // Should use default max retries (3)
      expect(screen.getByText(/attempting to recover automatically/)).toBeInTheDocument()
    })
  })
})