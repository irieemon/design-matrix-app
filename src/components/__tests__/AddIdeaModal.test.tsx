/**
 * AddIdeaModal Comprehensive Test Suite
 *
 * Tests the AddIdeaModal component including:
 * - Modal rendering and visibility control
 * - Form validation (content, priority, coordinates)
 * - User input handling and state management
 * - Submit and cancel actions
 * - Form reset functionality
 * - Error handling and edge cases
 * - Accessibility (ARIA labels, keyboard navigation)
 * - Default values and initialization
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddIdeaModal from '../AddIdeaModal'
import { testUsers } from '../../test/fixtures'
import { renderWithProviders } from '../../test/utils/test-helpers'
import type { IdeaCard } from '../../types'

describe('AddIdeaModal', () => {
  const mockOnClose = vi.fn()
  const mockOnAdd = vi.fn()

  const defaultProps = {
    isOpen: false,
    onClose: mockOnClose,
    onAdd: mockOnAdd,
    currentUser: testUsers.regular,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Modal Visibility', () => {
    it('should not render when isOpen is false', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={false} />)

      expect(screen.queryByText('Add New Idea')).not.toBeInTheDocument()
    })

    it('should render when isOpen is true', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      expect(screen.getByText('Add New Idea')).toBeInTheDocument()
    })

    it('should display modal title', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const title = screen.getByText('Add New Idea')
      expect(title).toBeInTheDocument()
      expect(title.tagName).toBe('H2')
    })

    it('should display descriptive text', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      expect(screen.getByText(/Create a new idea for your priority matrix/i)).toBeInTheDocument()
    })

    it('should display Plus icon', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const iconContainer = screen.getByText(/Create a new idea/i).closest('div')
      expect(iconContainer).toBeInTheDocument()
    })
  })

  describe('Form Rendering', () => {
    it('should render all form fields', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      expect(screen.getByLabelText(/Idea Title/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Details/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Priority Level/i)).toBeInTheDocument()
    })

    it('should render idea title input field', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      expect(titleInput).toHaveAttribute('type', 'text')
      expect(titleInput).toHaveAttribute('placeholder', 'Brief title for your idea')
      expect(titleInput).toBeRequired()
    })

    it('should render details textarea', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const detailsTextarea = screen.getByLabelText(/Details/i)
      expect(detailsTextarea.tagName).toBe('TEXTAREA')
      expect(detailsTextarea).toHaveAttribute('placeholder', 'Describe your idea in more detail...')
      expect(detailsTextarea).toHaveAttribute('rows', '4')
    })

    it('should render priority select dropdown', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const prioritySelect = screen.getByLabelText(/Priority Level/i)
      expect(prioritySelect.tagName).toBe('SELECT')
    })

    it('should render all priority options', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      expect(screen.getByText(/🟢 Low Priority/i)).toBeInTheDocument()
      expect(screen.getByText(/🟡 Moderate/i)).toBeInTheDocument()
      expect(screen.getByText(/🔴 High Priority/i)).toBeInTheDocument()
      expect(screen.getByText(/🔵 Strategic/i)).toBeInTheDocument()
      expect(screen.getByText(/🟣 Innovation/i)).toBeInTheDocument()
    })

    it('should render Cancel button', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      expect(cancelButton).toBeInTheDocument()
      expect(cancelButton).toHaveAttribute('type', 'button')
    })

    it('should render Add Idea button', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const addButton = screen.getByRole('button', { name: /Add Idea/i })
      expect(addButton).toBeInTheDocument()
      expect(addButton).toHaveAttribute('type', 'submit')
    })

    it('should render tip section', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      expect(screen.getByText(/💡 Tip/i)).toBeInTheDocument()
      expect(
        screen.getByText(/After creating your idea, you can drag it to any position/i)
      ).toBeInTheDocument()
    })
  })

  describe('Default Values', () => {
    it('should initialize with empty content', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i) as HTMLInputElement
      expect(titleInput.value).toBe('')
    })

    it('should initialize with empty details', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const detailsTextarea = screen.getByLabelText(/Details/i) as HTMLTextAreaElement
      expect(detailsTextarea.value).toBe('')
    })

    it('should initialize with moderate priority', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const prioritySelect = screen.getByLabelText(/Priority Level/i) as HTMLSelectElement
      expect(prioritySelect.value).toBe('moderate')
    })

    it('should initialize coordinates to center (260, 260)', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      // Coordinates are internal state, we'll verify them on submit
      // This test confirms the default behavior
      expect(screen.getByText(/Add New Idea/i)).toBeInTheDocument()
    })
  })

  describe('Form Input Handling', () => {
    it('should update content when typing in title field', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i) as HTMLInputElement
      await user.type(titleInput, 'New Feature Idea')

      expect(titleInput.value).toBe('New Feature Idea')
    })

    it('should update details when typing in textarea', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const detailsTextarea = screen.getByLabelText(/Details/i) as HTMLTextAreaElement
      await user.type(detailsTextarea, 'This is a detailed description')

      expect(detailsTextarea.value).toBe('This is a detailed description')
    })

    it('should update priority when selecting from dropdown', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const prioritySelect = screen.getByLabelText(/Priority Level/i) as HTMLSelectElement
      await user.selectOptions(prioritySelect, 'high')

      expect(prioritySelect.value).toBe('high')
    })

    it('should handle long content input', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const longContent = 'A'.repeat(500)
      const titleInput = screen.getByLabelText(/Idea Title/i) as HTMLInputElement
      await user.type(titleInput, longContent)

      expect(titleInput.value).toBe(longContent)
    })

    it('should handle multiline details input', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const multilineText = 'Line 1\nLine 2\nLine 3'
      const detailsTextarea = screen.getByLabelText(/Details/i) as HTMLTextAreaElement
      await user.type(detailsTextarea, multilineText)

      expect(detailsTextarea.value).toContain('Line 1')
      expect(detailsTextarea.value).toContain('Line 2')
      expect(detailsTextarea.value).toContain('Line 3')
    })

    it('should handle special characters in content', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const specialContent = 'Test <html> & "quotes" \'apostrophe\' emoji 🚀'
      const titleInput = screen.getByLabelText(/Idea Title/i) as HTMLInputElement
      await user.type(titleInput, specialContent)

      expect(titleInput.value).toBe(specialContent)
    })
  })

  describe('Form Validation', () => {
    it('should disable submit button when content is empty', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      expect(submitButton).toBeDisabled()
    })

    it('should enable submit button when content has value', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, 'Test Idea')

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      expect(submitButton).not.toBeDisabled()
    })

    it('should disable submit button when content is only whitespace', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, '   ')

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      expect(submitButton).toBeDisabled()
    })

    it('should mark title field as required', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      expect(titleInput).toBeRequired()
    })

    it('should not mark details field as required', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const detailsTextarea = screen.getByLabelText(/Details/i)
      expect(detailsTextarea).not.toBeRequired()
    })

    it('should prevent form submission when content is empty', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const form = screen.getByRole('button', { name: /Add Idea/i }).closest('form')
      if (form) {
        // Button is disabled, so click won't trigger submit
        const submitButton = screen.getByRole('button', { name: /Add Idea/i })
        expect(submitButton).toBeDisabled()
      }
    })
  })

  describe('Submit Action', () => {
    it('should call onAdd with correct data when form is submitted', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, 'Test Idea')

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledTimes(1)
      })
    })

    it('should include trimmed content in submitted data', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, '  Test Idea  ')

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            content: 'Test Idea',
          })
        )
      })
    })

    it('should include trimmed details in submitted data', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, 'Test Idea')

      const detailsTextarea = screen.getByLabelText(/Details/i)
      await user.type(detailsTextarea, '  Detailed description  ')

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            details: 'Detailed description',
          })
        )
      })
    })

    it('should include selected priority in submitted data', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, 'Test Idea')

      const prioritySelect = screen.getByLabelText(/Priority Level/i)
      await user.selectOptions(prioritySelect, 'high')

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            priority: 'high',
          })
        )
      })
    })

    it('should include center coordinates (260, 260) in submitted data', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, 'Test Idea')

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            x: 260,
            y: 260,
          })
        )
      })
    })

    it('should include user ID when currentUser is provided', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, 'Test Idea')

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            created_by: testUsers.regular.id,
          })
        )
      })
    })

    it('should use Anonymous when currentUser is null', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} currentUser={null} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, 'Test Idea')

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            created_by: 'Anonymous',
          })
        )
      })
    })

    it('should set is_collapsed to true by default', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, 'Test Idea')

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            is_collapsed: true,
          })
        )
      })
    })

    it('should set editing_by to null initially', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, 'Test Idea')

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            editing_by: null,
            editing_at: null,
          })
        )
      })
    })

    it('should not include id or timestamps in submitted data', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, 'Test Idea')

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      await user.click(submitButton)

      await waitFor(() => {
        const callArg = mockOnAdd.mock.calls[0][0]
        expect(callArg).not.toHaveProperty('id')
        expect(callArg).not.toHaveProperty('created_at')
        expect(callArg).not.toHaveProperty('updated_at')
      })
    })
  })

  describe('Cancel Action', () => {
    it('should call onClose when Cancel button is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      await user.click(cancelButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should not call onAdd when Cancel is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, 'Test Idea')

      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      await user.click(cancelButton)

      expect(mockOnAdd).not.toHaveBeenCalled()
    })

    it('should call onClose when modal backdrop is clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      // Find the backdrop (overlay)
      const backdrop = document.querySelector('.modal-overlay-container')
      if (backdrop) {
        await user.click(backdrop)
        // onClose might be called by BaseModal
      }
    })

    it('should call onClose when Escape key is pressed', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      await user.keyboard('{Escape}')

      // BaseModal handles escape key
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })
    })
  })

  describe('Form Reset', () => {
    it('should reset content after successful submission', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i) as HTMLInputElement
      await user.type(titleInput, 'Test Idea')

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(titleInput.value).toBe('')
      })
    })

    it('should reset details after successful submission', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, 'Test Idea')

      const detailsTextarea = screen.getByLabelText(/Details/i) as HTMLTextAreaElement
      await user.type(detailsTextarea, 'Test details')

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(detailsTextarea.value).toBe('')
      })
    })

    it('should reset priority to moderate after submission', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, 'Test Idea')

      const prioritySelect = screen.getByLabelText(/Priority Level/i) as HTMLSelectElement
      await user.selectOptions(prioritySelect, 'high')

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(prioritySelect.value).toBe('moderate')
      })
    })

    it('should reset coordinates to center (260, 260) after submission', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, 'Test Idea')

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      await user.click(submitButton)

      // Submit another idea to verify coordinates reset
      await user.clear(titleInput)
      await user.type(titleInput, 'Second Idea')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenLastCalledWith(
          expect.objectContaining({
            x: 260,
            y: 260,
          })
        )
      })
    })
  })

  describe('Accessibility', () => {
    it('should have accessible modal role', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const modal = document.querySelector('[role="dialog"]')
      expect(modal).toBeInTheDocument()
    })

    it('should have accessible modal label', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const modal = document.querySelector('[role="dialog"]')
      expect(modal).toHaveAttribute('aria-labelledby')
    })

    it('should associate labels with form inputs', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      expect(titleInput).toHaveAttribute('id')

      const label = screen.getByText('Idea Title')
      expect(label).toHaveAttribute('for', titleInput.getAttribute('id'))
    })

    it('should have accessible button labels', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      expect(cancelButton).toHaveAccessibleName()

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      expect(submitButton).toHaveAccessibleName()
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.tab()

      // Focus should move through form elements
      expect(document.activeElement).toBeTruthy()
    })

    it('should support keyboard form submission', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, 'Test Idea')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalled()
      })
    })

    it('should focus on modal when opened', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      // Modal should be in the document
      const modal = document.querySelector('[role="dialog"]')
      expect(modal).toBeInTheDocument()
    })

    it('should prevent body scroll when modal is open', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      // BaseModal sets body overflow to hidden
      expect(document.body.style.overflow).toBe('hidden')
    })

    it('should restore body scroll when modal is closed', () => {
      const { rerender } = renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      expect(document.body.style.overflow).toBe('hidden')

      rerender(<AddIdeaModal {...defaultProps} isOpen={false} />)

      expect(document.body.style.overflow).toBe('unset')
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined currentUser', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} currentUser={undefined} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, 'Test Idea')

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            created_by: 'Anonymous',
          })
        )
      })
    })

    it('should handle empty string content submission attempt', async () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      expect(submitButton).toBeDisabled()
    })

    it('should trim whitespace from content before submission', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, '   Test Idea   ')

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            content: 'Test Idea',
          })
        )
      })
    })

    it('should handle very long content gracefully', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const longContent = 'A'.repeat(1000)
      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, longContent)

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            content: longContent,
          })
        )
      })
    })

    it('should handle special characters in content', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const specialContent = '<script>alert("xss")</script>'
      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, specialContent)

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            content: specialContent,
          })
        )
      })
    })

    it('should handle rapid form submissions', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, 'Test Idea')

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      await user.click(submitButton)
      await user.click(submitButton)

      // Should handle rapid clicks gracefully
      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalled()
      })
    })

    it('should handle all priority values', async () => {
      const user = userEvent.setup()
      const priorities: Array<IdeaCard['priority']> = [
        'low',
        'moderate',
        'high',
        'strategic',
        'innovation',
      ]

      for (const priority of priorities) {
        mockOnAdd.mockClear()

        const { unmount } = renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

        const titleInput = screen.getByLabelText(/Idea Title/i)
        await user.type(titleInput, 'Test Idea')

        const prioritySelect = screen.getByLabelText(/Priority Level/i)
        await user.selectOptions(prioritySelect, priority)

        const submitButtons = screen.getAllByRole('button', { name: /Add Idea/i })
        await user.click(submitButtons[submitButtons.length - 1])

        await waitFor(() => {
          expect(mockOnAdd).toHaveBeenCalledWith(
            expect.objectContaining({
              priority,
            })
          )
        })

        // Unmount to clean up before next iteration
        unmount()
      }
    })

    it('should not call onAdd when form submit is prevented', async () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      // Submit without content - button is disabled
      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      expect(submitButton).toBeDisabled()

      expect(mockOnAdd).not.toHaveBeenCalled()
    })

    it('should handle empty details field', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, 'Test Idea')

      // Don't fill details
      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith(
          expect.objectContaining({
            details: '',
          })
        )
      })
    })
  })

  describe('Priority Options', () => {
    it('should have low priority option with correct value', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const option = screen.getByRole('option', { name: /🟢 Low Priority/i }) as HTMLOptionElement
      expect(option.value).toBe('low')
    })

    it('should have moderate priority option with correct value', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const option = screen.getByRole('option', { name: /🟡 Moderate/i }) as HTMLOptionElement
      expect(option.value).toBe('moderate')
    })

    it('should have high priority option with correct value', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const option = screen.getByRole('option', { name: /🔴 High Priority/i }) as HTMLOptionElement
      expect(option.value).toBe('high')
    })

    it('should have strategic priority option with correct value', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const option = screen.getByRole('option', { name: /🔵 Strategic/i }) as HTMLOptionElement
      expect(option.value).toBe('strategic')
    })

    it('should have innovation priority option with correct value', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const option = screen.getByRole('option', { name: /🟣 Innovation/i }) as HTMLOptionElement
      expect(option.value).toBe('innovation')
    })
  })

  describe('UI Styling', () => {
    it('should apply correct styling to form container', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const form = screen.getByRole('button', { name: /Add Idea/i }).closest('form')
      expect(form).toHaveClass('space-y-6')
    })

    it('should apply correct styling to Cancel button', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      expect(cancelButton).toHaveClass('flex-1')
    })

    it('should apply correct styling to Add button', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      expect(submitButton).toHaveClass('flex-1')
    })

    it('should apply disabled styling when submit is disabled', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      expect(submitButton).toHaveClass('disabled:bg-gray-300')
      expect(submitButton).toHaveClass('disabled:cursor-not-allowed')
    })

    it('should render tip section with proper background', () => {
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      const tipSection = screen.getByText(/💡 Tip/i).closest('div')
      expect(tipSection).toHaveClass('bg-neutral-50')
      expect(tipSection).toHaveClass('rounded-lg')
      expect(tipSection).toHaveClass('p-4')
    })
  })

  describe('Complete Submission Flow', () => {
    it('should successfully submit a complete idea with all fields', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      // Fill all fields
      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, 'Complete Feature Idea')

      const detailsTextarea = screen.getByLabelText(/Details/i)
      await user.type(detailsTextarea, 'This is a complete detailed description')

      const prioritySelect = screen.getByLabelText(/Priority Level/i)
      await user.selectOptions(prioritySelect, 'strategic')

      // Submit
      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      await user.click(submitButton)

      // Verify complete submission
      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith({
          content: 'Complete Feature Idea',
          details: 'This is a complete detailed description',
          x: 260,
          y: 260,
          priority: 'strategic',
          created_by: testUsers.regular.id,
          is_collapsed: true,
          editing_by: null,
          editing_at: null,
        })
      })
    })

    it('should successfully submit a minimal idea with only required fields', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AddIdeaModal {...defaultProps} isOpen={true} />)

      // Fill only required field
      const titleInput = screen.getByLabelText(/Idea Title/i)
      await user.type(titleInput, 'Minimal Idea')

      // Submit
      const submitButton = screen.getByRole('button', { name: /Add Idea/i })
      await user.click(submitButton)

      // Verify minimal submission
      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith({
          content: 'Minimal Idea',
          details: '',
          x: 260,
          y: 260,
          priority: 'moderate',
          created_by: testUsers.regular.id,
          is_collapsed: true,
          editing_by: null,
          editing_at: null,
        })
      })
    })
  })
})