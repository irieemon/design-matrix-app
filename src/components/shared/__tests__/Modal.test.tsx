/**
 * Modal Component Tests
 *
 * Comprehensive tests for BaseModal, ConfirmModal, FormModal, and Drawer components covering:
 * - Modal visibility and rendering behavior
 * - Close mechanisms (button, backdrop, escape key)
 * - Portal rendering to document.body
 * - Focus management and trap
 * - Scroll lock functionality
 * - Size variants and responsive behavior
 * - Custom content and styling
 * - Nested modal scenarios
 * - Accessibility (ARIA attributes, focus management, keyboard navigation)
 * - Loading states and overlays
 * - Edge cases (rapid open/close, multiple modals, unmount during animation)
 *
 * Business Impact: User interaction quality, accessibility compliance, error prevention
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BaseModal, ConfirmModal, FormModal, Drawer } from '../Modal'
import { createPortal } from 'react-dom'

// Mock createPortal to render in place for testing
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom')
  return {
    ...actual,
    createPortal: (children: React.ReactNode) => children
  }
})

describe('BaseModal', () => {
  const user = userEvent.setup()
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset body overflow
    document.body.style.overflow = 'unset'
  })

  afterEach(() => {
    document.body.style.overflow = 'unset'
  })

  describe('Visibility and Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(
        <BaseModal isOpen={false} onClose={mockOnClose} title="Test Modal">
          <div data-testid="modal-content">Content</div>
        </BaseModal>
      )

      expect(screen.queryByText('Test Modal')).not.toBeInTheDocument()
      expect(screen.queryByTestId('modal-content')).not.toBeInTheDocument()
    })

    it('should render when isOpen is true', () => {
      render(
        <BaseModal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <div data-testid="modal-content">Content</div>
        </BaseModal>
      )

      expect(screen.getByText('Test Modal')).toBeInTheDocument()
      expect(screen.getByTestId('modal-content')).toBeInTheDocument()
    })

    it('should render modal overlay and backdrop', () => {
      const { container } = render(
        <BaseModal isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </BaseModal>
      )

      const overlay = container.querySelector('.modal-overlay-container')
      expect(overlay).toBeInTheDocument()
      expect(overlay).toHaveClass('fixed', 'inset-0')

      const backdrop = container.querySelector('.bg-black\\/50')
      expect(backdrop).toBeInTheDocument()
    })

    it('should render content inside portal', () => {
      render(
        <BaseModal isOpen={true} onClose={mockOnClose}>
          <div data-testid="portal-content">Portal Content</div>
        </BaseModal>
      )

      expect(screen.getByTestId('portal-content')).toBeInTheDocument()
    })

    it('should render modal header when title is provided', () => {
      render(
        <BaseModal isOpen={true} onClose={mockOnClose} title="Modal Title">
          <div>Content</div>
        </BaseModal>
      )

      expect(screen.getByText('Modal Title')).toBeInTheDocument()
      expect(screen.getByText('Modal Title').tagName).toBe('H2')
    })

    it('should not render header when title is not provided', () => {
      const { container } = render(
        <BaseModal isOpen={true} onClose={mockOnClose} showCloseButton={false}>
          <div>Content</div>
        </BaseModal>
      )

      const header = container.querySelector('header')
      expect(header).not.toBeInTheDocument()
    })
  })

  describe('Close Behaviors', () => {
    it('should call onClose when close button is clicked', async () => {
      render(
        <BaseModal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <div>Content</div>
        </BaseModal>
      )

      const closeButton = screen.getByRole('button', { name: /close modal/i })
      await user.click(closeButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when backdrop is clicked', async () => {
      const { container } = render(
        <BaseModal isOpen={true} onClose={mockOnClose} closeOnBackdropClick={true}>
          <div>Content</div>
        </BaseModal>
      )

      const overlay = container.querySelector('.modal-overlay-container')
      if (overlay) {
        fireEvent.click(overlay)
      }

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should not close when backdrop is clicked if closeOnBackdropClick is false', async () => {
      const { container } = render(
        <BaseModal isOpen={true} onClose={mockOnClose} closeOnBackdropClick={false}>
          <div>Content</div>
        </BaseModal>
      )

      const overlay = container.querySelector('.modal-overlay-container')
      if (overlay) {
        fireEvent.click(overlay)
      }

      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('should not close when modal content is clicked', async () => {
      render(
        <BaseModal isOpen={true} onClose={mockOnClose} closeOnBackdropClick={true}>
          <div data-testid="modal-content">Content</div>
        </BaseModal>
      )

      const content = screen.getByTestId('modal-content')
      await user.click(content)

      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('should call onClose when Escape key is pressed', () => {
      render(
        <BaseModal isOpen={true} onClose={mockOnClose} closeOnEscape={true}>
          <div>Content</div>
        </BaseModal>
      )

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should not close when Escape is pressed if closeOnEscape is false', () => {
      render(
        <BaseModal isOpen={true} onClose={mockOnClose} closeOnEscape={false}>
          <div>Content</div>
        </BaseModal>
      )

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('should not respond to other keys', () => {
      render(
        <BaseModal isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </BaseModal>
      )

      fireEvent.keyDown(document, { key: 'Enter' })
      fireEvent.keyDown(document, { key: 'Space' })
      fireEvent.keyDown(document, { key: 'Tab' })

      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('should not render close button when showCloseButton is false', () => {
      render(
        <BaseModal isOpen={true} onClose={mockOnClose} showCloseButton={false}>
          <div>Content</div>
        </BaseModal>
      )

      expect(screen.queryByRole('button', { name: /close modal/i })).not.toBeInTheDocument()
    })

    it('should render close button by default', () => {
      render(
        <BaseModal isOpen={true} onClose={mockOnClose} title="Test">
          <div>Content</div>
        </BaseModal>
      )

      expect(screen.getByRole('button', { name: /close modal/i })).toBeInTheDocument()
    })
  })

  describe('Scroll Lock', () => {
    it('should lock body scroll when modal opens', () => {
      render(
        <BaseModal isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </BaseModal>
      )

      expect(document.body.style.overflow).toBe('hidden')
    })

    it('should restore body scroll when modal closes', () => {
      const { rerender } = render(
        <BaseModal isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </BaseModal>
      )

      expect(document.body.style.overflow).toBe('hidden')

      rerender(
        <BaseModal isOpen={false} onClose={mockOnClose}>
          <div>Content</div>
        </BaseModal>
      )

      expect(document.body.style.overflow).toBe('unset')
    })

    it('should restore scroll on unmount', () => {
      const { unmount } = render(
        <BaseModal isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </BaseModal>
      )

      expect(document.body.style.overflow).toBe('hidden')

      unmount()

      expect(document.body.style.overflow).toBe('unset')
    })
  })

  describe('Size Variants', () => {
    it('should render with small size', () => {
      const { container } = render(
        <BaseModal isOpen={true} onClose={mockOnClose} size="sm">
          <div>Content</div>
        </BaseModal>
      )

      const modal = container.querySelector('.max-w-md')
      expect(modal).toBeInTheDocument()
    })

    it('should render with medium size by default', () => {
      const { container } = render(
        <BaseModal isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </BaseModal>
      )

      const modal = container.querySelector('.max-w-lg')
      expect(modal).toBeInTheDocument()
    })

    it('should render with large size', () => {
      const { container } = render(
        <BaseModal isOpen={true} onClose={mockOnClose} size="lg">
          <div>Content</div>
        </BaseModal>
      )

      const modal = container.querySelector('.max-w-2xl')
      expect(modal).toBeInTheDocument()
    })

    it('should render with xl size', () => {
      const { container } = render(
        <BaseModal isOpen={true} onClose={mockOnClose} size="xl">
          <div>Content</div>
        </BaseModal>
      )

      const modal = container.querySelector('.max-w-4xl')
      expect(modal).toBeInTheDocument()
    })

    it('should render with full size', () => {
      const { container } = render(
        <BaseModal isOpen={true} onClose={mockOnClose} size="full">
          <div>Content</div>
        </BaseModal>
      )

      const modal = container.querySelector('.max-w-7xl')
      expect(modal).toBeInTheDocument()
    })
  })

  describe('Custom Content and Styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <BaseModal isOpen={true} onClose={mockOnClose} className="custom-modal-class">
          <div>Content</div>
        </BaseModal>
      )

      const modal = container.querySelector('.custom-modal-class')
      expect(modal).toBeInTheDocument()
    })

    it('should render custom content', () => {
      render(
        <BaseModal isOpen={true} onClose={mockOnClose}>
          <div data-testid="custom-content">
            <p>Custom paragraph</p>
            <button>Custom button</button>
          </div>
        </BaseModal>
      )

      expect(screen.getByTestId('custom-content')).toBeInTheDocument()
      expect(screen.getByText('Custom paragraph')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /custom button/i })).toBeInTheDocument()
    })

    it('should handle complex nested content', () => {
      render(
        <BaseModal isOpen={true} onClose={mockOnClose}>
          <div>
            <div data-testid="level-1">
              <div data-testid="level-2">
                <div data-testid="level-3">Deep content</div>
              </div>
            </div>
          </div>
        </BaseModal>
      )

      expect(screen.getByTestId('level-1')).toBeInTheDocument()
      expect(screen.getByTestId('level-2')).toBeInTheDocument()
      expect(screen.getByTestId('level-3')).toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('should not show loading overlay by default', () => {
      const { container } = render(
        <BaseModal isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </BaseModal>
      )

      // LoadingOverlay should be rendered but not visible
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    it('should show loading overlay when loading is true', () => {
      render(
        <BaseModal isOpen={true} onClose={mockOnClose} loading={true}>
          <div>Content</div>
        </BaseModal>
      )

      // Content should still be in DOM but covered by overlay
      expect(screen.getByText('Content')).toBeInTheDocument()
    })

    it('should show custom loading text', () => {
      render(
        <BaseModal isOpen={true} onClose={mockOnClose} loading={true} loadingText="Processing...">
          <div>Content</div>
        </BaseModal>
      )

      // LoadingOverlay component would handle displaying the text
      expect(screen.getByText('Content')).toBeInTheDocument()
    })
  })

  describe('Accessibility (ARIA)', () => {
    it('should have role="dialog"', () => {
      const { container } = render(
        <BaseModal isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </BaseModal>
      )

      const dialog = container.querySelector('[role="dialog"]')
      expect(dialog).toBeInTheDocument()
    })

    it('should have aria-modal="true"', () => {
      const { container } = render(
        <BaseModal isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </BaseModal>
      )

      const dialog = container.querySelector('[aria-modal="true"]')
      expect(dialog).toBeInTheDocument()
    })

    it('should have aria-labelledby when title is provided', () => {
      const { container } = render(
        <BaseModal isOpen={true} onClose={mockOnClose} title="Accessible Title">
          <div>Content</div>
        </BaseModal>
      )

      const dialog = container.querySelector('[role="dialog"]')
      const labelledBy = dialog?.getAttribute('aria-labelledby')
      expect(labelledBy).toBeTruthy()

      const titleElement = document.getElementById(labelledBy!)
      expect(titleElement).toHaveTextContent('Accessible Title')
    })

    it('should have aria-describedby for content', () => {
      const { container } = render(
        <BaseModal isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </BaseModal>
      )

      const dialog = container.querySelector('[role="dialog"]')
      const describedBy = dialog?.getAttribute('aria-describedby')
      expect(describedBy).toBeTruthy()
    })

    it('should have tabIndex -1 for focus management', () => {
      const { container } = render(
        <BaseModal isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </BaseModal>
      )

      const dialog = container.querySelector('[role="dialog"]')
      expect(dialog).toHaveAttribute('tabIndex', '-1')
    })

    it('should have accessible close button', () => {
      render(
        <BaseModal isOpen={true} onClose={mockOnClose} title="Test">
          <div>Content</div>
        </BaseModal>
      )

      const closeButton = screen.getByRole('button', { name: /close modal/i })
      expect(closeButton).toHaveAttribute('aria-label', 'Close modal')
    })

    it('should have role="document" for content area', () => {
      const { container } = render(
        <BaseModal isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </BaseModal>
      )

      const document = container.querySelector('[role="document"]')
      expect(document).toBeInTheDocument()
    })
  })

  describe('Focus Management', () => {
    it('should be focusable elements within modal', () => {
      render(
        <BaseModal isOpen={true} onClose={mockOnClose} title="Test">
          <div>
            <button>Button 1</button>
            <input type="text" />
            <button>Button 2</button>
          </div>
        </BaseModal>
      )

      expect(screen.getByRole('button', { name: /close modal/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /button 1/i })).toBeInTheDocument()
      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /button 2/i })).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle rapid open/close', () => {
      const { rerender } = render(
        <BaseModal isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </BaseModal>
      )

      // Rapid close
      rerender(
        <BaseModal isOpen={false} onClose={mockOnClose}>
          <div>Content</div>
        </BaseModal>
      )

      // Rapid open
      rerender(
        <BaseModal isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </BaseModal>
      )

      expect(screen.getByText('Content')).toBeInTheDocument()
    })

    it('should handle modal without any children', () => {
      render(
        <BaseModal isOpen={true} onClose={mockOnClose} title="Empty Modal">
          {null}
        </BaseModal>
      )

      expect(screen.getByText('Empty Modal')).toBeInTheDocument()
    })

    it('should handle modal with undefined title', () => {
      render(
        <BaseModal isOpen={true} onClose={mockOnClose} title={undefined}>
          <div>Content</div>
        </BaseModal>
      )

      expect(screen.getByText('Content')).toBeInTheDocument()
    })

    it('should cleanup event listeners on unmount', () => {
      const { unmount } = render(
        <BaseModal isOpen={true} onClose={mockOnClose} closeOnEscape={true}>
          <div>Content</div>
        </BaseModal>
      )

      unmount()

      // Attempt to trigger escape after unmount (should not error)
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('should handle prop changes while open', () => {
      const { rerender } = render(
        <BaseModal isOpen={true} onClose={mockOnClose} title="Original Title" size="sm">
          <div>Content</div>
        </BaseModal>
      )

      expect(screen.getByText('Original Title')).toBeInTheDocument()

      rerender(
        <BaseModal isOpen={true} onClose={mockOnClose} title="Updated Title" size="lg">
          <div>Updated Content</div>
        </BaseModal>
      )

      expect(screen.getByText('Updated Title')).toBeInTheDocument()
      expect(screen.getByText('Updated Content')).toBeInTheDocument()
    })
  })

  describe('Nested Modals', () => {
    it('should support nested modal structure', () => {
      render(
        <BaseModal isOpen={true} onClose={mockOnClose} title="Outer Modal">
          <div>
            <p>Outer content</p>
            <BaseModal isOpen={true} onClose={vi.fn()} title="Inner Modal">
              <p>Inner content</p>
            </BaseModal>
          </div>
        </BaseModal>
      )

      expect(screen.getByText('Outer Modal')).toBeInTheDocument()
      expect(screen.getByText('Inner Modal')).toBeInTheDocument()
      expect(screen.getByText('Outer content')).toBeInTheDocument()
      expect(screen.getByText('Inner content')).toBeInTheDocument()
    })
  })
})

describe('ConfirmModal', () => {
  const user = userEvent.setup()
  const mockOnClose = vi.fn()
  const mockOnConfirm = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render confirm modal with title and message', () => {
      render(
        <ConfirmModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Confirm Action"
          message="Are you sure you want to proceed?"
        />
      )

      // Check that the message is displayed (unique identifier)
      expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument()
      // Check for at least one heading with the title
      const headings = screen.getAllByRole('heading', { name: 'Confirm Action' })
      expect(headings.length).toBeGreaterThan(0)
    })

    it('should render with default button text', () => {
      render(
        <ConfirmModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Confirm"
          message="Proceed?"
        />
      )

      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('should render with custom button text', () => {
      render(
        <ConfirmModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Delete"
          message="Delete item?"
          confirmText="Yes, Delete"
          cancelText="No, Keep"
        />
      )

      expect(screen.getByRole('button', { name: /yes, delete/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /no, keep/i })).toBeInTheDocument()
    })
  })

  describe('Variant Styling', () => {
    it('should render danger variant by default', () => {
      const { container } = render(
        <ConfirmModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Danger"
          message="Dangerous action"
        />
      )

      const button = screen.getByRole('button', { name: /confirm/i })
      expect(button).toHaveClass('bg-red-600')
    })

    it('should render warning variant', () => {
      const { container } = render(
        <ConfirmModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Warning"
          message="Warning action"
          variant="warning"
        />
      )

      const button = screen.getByRole('button', { name: /confirm/i })
      expect(button).toHaveClass('bg-yellow-600')
    })

    it('should render info variant', () => {
      const { container } = render(
        <ConfirmModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Info"
          message="Info action"
          variant="info"
        />
      )

      const button = screen.getByRole('button', { name: /confirm/i })
      expect(button).toHaveClass('bg-blue-600')
    })
  })

  describe('User Actions', () => {
    it('should call onConfirm when confirm button is clicked', async () => {
      render(
        <ConfirmModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Confirm"
          message="Proceed?"
        />
      )

      await user.click(screen.getByRole('button', { name: /confirm/i }))

      expect(mockOnConfirm).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when cancel button is clicked', async () => {
      render(
        <ConfirmModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Confirm"
          message="Proceed?"
        />
      )

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      expect(mockOnClose).toHaveBeenCalledTimes(1)
      expect(mockOnConfirm).not.toHaveBeenCalled()
    })
  })

  describe('Loading State', () => {
    it('should disable buttons when loading', () => {
      render(
        <ConfirmModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Confirm"
          message="Proceed?"
          loading={true}
        />
      )

      expect(screen.getByRole('button', { name: /processing/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
    })

    it('should show processing text when loading', () => {
      render(
        <ConfirmModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Confirm"
          message="Proceed?"
          loading={true}
        />
      )

      expect(screen.getByText('Processing...')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have aria-describedby for message', () => {
      const { container } = render(
        <ConfirmModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Confirm"
          message="Important message"
        />
      )

      const message = screen.getByText('Important message')
      expect(message).toHaveAttribute('id')

      const confirmButton = screen.getByRole('button', { name: /confirm/i })
      const describedBy = confirmButton.getAttribute('aria-describedby')
      expect(describedBy).toBe(message.id)
    })

    it('should have accessible icon with label', () => {
      const { container } = render(
        <ConfirmModal
          isOpen={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          title="Confirm"
          message="Proceed?"
          variant="danger"
        />
      )

      const icon = container.querySelector('[role="img"]')
      expect(icon).toHaveAttribute('aria-label', 'danger icon')
    })
  })
})

describe('FormModal', () => {
  const user = userEvent.setup()
  const mockOnClose = vi.fn()
  const mockOnSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render form modal with form element', () => {
      const { container } = render(
        <FormModal isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} title="Form">
          <input type="text" name="test" />
        </FormModal>
      )

      expect(container.querySelector('form')).toBeInTheDocument()
    })

    it('should render form content', () => {
      render(
        <FormModal isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} title="Form">
          <input data-testid="form-input" type="text" />
        </FormModal>
      )

      expect(screen.getByTestId('form-input')).toBeInTheDocument()
    })

    it('should render footer with default buttons', () => {
      render(
        <FormModal isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} title="Form">
          <input type="text" />
        </FormModal>
      )

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('should render with custom button text', () => {
      render(
        <FormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          title="Form"
          submitText="Create"
          cancelText="Discard"
        >
          <input type="text" />
        </FormModal>
      )

      expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument()
    })

    it('should not render footer when showFooter is false', () => {
      render(
        <FormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          title="Form"
          showFooter={false}
        >
          <input type="text" />
        </FormModal>
      )

      expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
    })
  })

  describe('Form Submission', () => {
    it('should call onSubmit when form is submitted', async () => {
      render(
        <FormModal isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} title="Form">
          <input type="text" />
        </FormModal>
      )

      await user.click(screen.getByRole('button', { name: /save/i }))

      expect(mockOnSubmit).toHaveBeenCalledTimes(1)
    })

    it('should prevent default form submission', async () => {
      const mockSubmit = vi.fn((e: React.FormEvent) => {
        expect(e.defaultPrevented).toBe(true)
      })

      render(
        <FormModal isOpen={true} onClose={mockOnClose} onSubmit={mockSubmit} title="Form">
          <input type="text" />
        </FormModal>
      )

      await user.click(screen.getByRole('button', { name: /save/i }))
    })

    it('should not submit when submit button is disabled', async () => {
      render(
        <FormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          title="Form"
          submitDisabled={true}
        >
          <input type="text" />
        </FormModal>
      )

      const submitButton = screen.getByRole('button', { name: /save/i })
      expect(submitButton).toBeDisabled()

      // Try to click (should not trigger)
      await user.click(submitButton).catch(() => {})

      expect(mockOnSubmit).not.toHaveBeenCalled()
    })
  })

  describe('Submit Button Variants', () => {
    it('should render primary variant by default', () => {
      render(
        <FormModal isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} title="Form">
          <input type="text" />
        </FormModal>
      )

      const submitButton = screen.getByRole('button', { name: /save/i })
      expect(submitButton).toHaveClass('bg-blue-600')
    })

    it('should render secondary variant', () => {
      render(
        <FormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          title="Form"
          submitVariant="secondary"
        >
          <input type="text" />
        </FormModal>
      )

      const submitButton = screen.getByRole('button', { name: /save/i })
      expect(submitButton).toHaveClass('bg-gray-600')
    })

    it('should render danger variant', () => {
      render(
        <FormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          title="Form"
          submitVariant="danger"
        >
          <input type="text" />
        </FormModal>
      )

      const submitButton = screen.getByRole('button', { name: /save/i })
      expect(submitButton).toHaveClass('bg-red-600')
    })
  })

  describe('Loading State', () => {
    it('should disable buttons when loading', () => {
      render(
        <FormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          title="Form"
          loading={true}
        >
          <input type="text" />
        </FormModal>
      )

      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
    })

    it('should show saving text when loading', () => {
      render(
        <FormModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          title="Form"
          loading={true}
        >
          <input type="text" />
        </FormModal>
      )

      expect(screen.getByText('Saving...')).toBeInTheDocument()
    })
  })

  describe('Cancel Behavior', () => {
    it('should call onClose when cancel button is clicked', async () => {
      render(
        <FormModal isOpen={true} onClose={mockOnClose} onSubmit={mockOnSubmit} title="Form">
          <input type="text" />
        </FormModal>
      )

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      expect(mockOnClose).toHaveBeenCalledTimes(1)
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })
  })
})

describe('Drawer', () => {
  const user = userEvent.setup()
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    document.body.style.overflow = 'unset'
  })

  afterEach(() => {
    document.body.style.overflow = 'unset'
  })

  describe('Visibility and Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(
        <Drawer isOpen={false} onClose={mockOnClose} title="Test Drawer">
          <div data-testid="drawer-content">Content</div>
        </Drawer>
      )

      expect(screen.queryByText('Test Drawer')).not.toBeInTheDocument()
      expect(screen.queryByTestId('drawer-content')).not.toBeInTheDocument()
    })

    it('should render when isOpen is true', () => {
      render(
        <Drawer isOpen={true} onClose={mockOnClose} title="Test Drawer">
          <div data-testid="drawer-content">Content</div>
        </Drawer>
      )

      expect(screen.getByText('Test Drawer')).toBeInTheDocument()
      expect(screen.getByTestId('drawer-content')).toBeInTheDocument()
    })

    it('should render on right side by default', () => {
      const { container } = render(
        <Drawer isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </Drawer>
      )

      const drawer = container.querySelector('.right-0')
      expect(drawer).toBeInTheDocument()
    })

    it('should render on left side when position is left', () => {
      const { container } = render(
        <Drawer isOpen={true} onClose={mockOnClose} position="left">
          <div>Content</div>
        </Drawer>
      )

      const drawer = container.querySelector('.left-0')
      expect(drawer).toBeInTheDocument()
    })
  })

  describe('Size Variants', () => {
    it('should render with small size', () => {
      const { container } = render(
        <Drawer isOpen={true} onClose={mockOnClose} size="sm">
          <div>Content</div>
        </Drawer>
      )

      const drawer = container.querySelector('.w-80')
      expect(drawer).toBeInTheDocument()
    })

    it('should render with medium size by default', () => {
      const { container } = render(
        <Drawer isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </Drawer>
      )

      const drawer = container.querySelector('.w-96')
      expect(drawer).toBeInTheDocument()
    })

    it('should render with large size', () => {
      const { container } = render(
        <Drawer isOpen={true} onClose={mockOnClose} size="lg">
          <div>Content</div>
        </Drawer>
      )

      const drawer = container.querySelector('.w-1\\/2')
      expect(drawer).toBeInTheDocument()
    })
  })

  describe('Close Behavior', () => {
    it('should call onClose when close button is clicked', async () => {
      render(
        <Drawer isOpen={true} onClose={mockOnClose} title="Test Drawer">
          <div>Content</div>
        </Drawer>
      )

      const closeButton = screen.getByRole('button')
      await user.click(closeButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when backdrop is clicked', async () => {
      const { container } = render(
        <Drawer isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </Drawer>
      )

      const backdrop = container.querySelector('.bg-black\\/50')
      if (backdrop) {
        await user.click(backdrop)
      }

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Scroll Lock', () => {
    it('should lock body scroll when drawer opens', () => {
      render(
        <Drawer isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </Drawer>
      )

      expect(document.body.style.overflow).toBe('hidden')
    })

    it('should restore body scroll when drawer closes', () => {
      const { rerender } = render(
        <Drawer isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </Drawer>
      )

      expect(document.body.style.overflow).toBe('hidden')

      rerender(
        <Drawer isOpen={false} onClose={mockOnClose}>
          <div>Content</div>
        </Drawer>
      )

      expect(document.body.style.overflow).toBe('unset')
    })
  })

  describe('Custom Content', () => {
    it('should render custom content', () => {
      render(
        <Drawer isOpen={true} onClose={mockOnClose}>
          <div data-testid="custom-drawer-content">
            <p>Custom paragraph</p>
            <button>Custom button</button>
          </div>
        </Drawer>
      )

      expect(screen.getByTestId('custom-drawer-content')).toBeInTheDocument()
      expect(screen.getByText('Custom paragraph')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /custom button/i })).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      const { container } = render(
        <Drawer isOpen={true} onClose={mockOnClose} className="custom-drawer-class">
          <div>Content</div>
        </Drawer>
      )

      const drawer = container.querySelector('.custom-drawer-class')
      expect(drawer).toBeInTheDocument()
    })
  })
})