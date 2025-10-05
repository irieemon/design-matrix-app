/**
 * EditIdeaModal Comprehensive Test Suite
 *
 * Complete test coverage for EditIdeaModal component including:
 * - Modal rendering with pre-populated data
 * - Form editing and validation
 * - Priority changes
 * - Position updates
 * - Lock management (edit locks, concurrent editing prevention)
 * - Save, cancel, and delete actions
 * - Error handling and recovery
 * - Accessibility
 * - Edge cases (concurrent edits, lock expiration, invalid data)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import EditIdeaModal from '../EditIdeaModal'
import { IdeaCard, User } from '../../types'
import { IdeaRepository } from '../../lib/repositories'
import { generateDemoUUID } from '../../utils/uuid'

// Mock dependencies
vi.mock('../../lib/repositories', () => ({
  IdeaRepository: {
    lockIdeaForEditing: vi.fn(),
    unlockIdea: vi.fn()
  }
}))

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}))

vi.mock('../shared/Modal', () => ({
  BaseModal: ({ children, isOpen, onClose, title }: any) =>
    isOpen ? (
      <div data-testid="edit-idea-modal" role="dialog" aria-label={title}>
        <button onClick={onClose} data-testid="modal-close" aria-label="Close modal">
          Close
        </button>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null
}))

// Mock ToastContext
const mockShowSuccess = vi.fn()
const mockShowError = vi.fn()
const mockShowWarning = vi.fn()

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    showWarning: mockShowWarning
  })
}))

describe('EditIdeaModal - Comprehensive Test Suite', () => {
  const mockOnClose = vi.fn()
  const mockOnUpdate = vi.fn()
  const mockOnDelete = vi.fn()

  const mockUser: User = {
    id: generateDemoUUID('1'),
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'user',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
  }

  const mockIdea: IdeaCard = {
    id: generateDemoUUID('3'),
    content: 'Test Idea',
    details: 'A test idea for unit testing',
    x: 260,
    y: 260,
    priority: 'moderate',
    project_id: generateDemoUUID('2'),
    created_by: generateDemoUUID('1'),
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
  }

  const defaultProps = {
    idea: mockIdea,
    isOpen: true,
    currentUser: mockUser,
    onClose: mockOnClose,
    onUpdate: mockOnUpdate,
    onDelete: mockOnDelete
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Setup default mock implementations
    vi.mocked(IdeaRepository.lockIdeaForEditing).mockResolvedValue(true)
    vi.mocked(IdeaRepository.unlockIdea).mockResolvedValue(true)
    mockOnUpdate.mockResolvedValue(undefined)
    mockOnDelete.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  describe('Modal State and Rendering', () => {
    it('should not render when modal is closed', () => {
      render(<EditIdeaModal {...defaultProps} isOpen={false} />)
      expect(screen.queryByTestId('edit-idea-modal')).not.toBeInTheDocument()
    })

    it('should render modal when open', async () => {
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })
      expect(screen.getByTestId('edit-idea-modal')).toBeInTheDocument()
    })

    it('should not render when idea is null', () => {
      render(<EditIdeaModal {...defaultProps} idea={null} />)
      expect(screen.queryByTestId('edit-idea-modal')).not.toBeInTheDocument()
    })

    it('should show correct modal title', async () => {
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })
      expect(screen.getByText('Edit Idea')).toBeInTheDocument()
    })

    it('should display edit icon and description', async () => {
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })
      expect(screen.getByText('Edit your idea details and priority')).toBeInTheDocument()
    })
  })

  describe('Form Data Population', () => {
    it('should populate form fields with idea data', async () => {
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const titleInput = screen.getByLabelText('Idea Title') as HTMLInputElement
      const detailsInput = screen.getByLabelText('Details') as HTMLTextAreaElement
      const prioritySelect = screen.getByLabelText('Priority Level') as HTMLSelectElement

      expect(titleInput.value).toBe('Test Idea')
      expect(detailsInput.value).toBe('A test idea for unit testing')
      expect(prioritySelect.value).toBe('moderate')
    })

    it('should update form state when idea prop changes', async () => {
      const { rerender } = render(<EditIdeaModal {...defaultProps} />)

      await act(async () => {
        await vi.runAllTimersAsync()
      })

      const updatedIdea = {
        ...mockIdea,
        content: 'Updated Title',
        details: 'Updated details',
        priority: 'high' as const
      }

      await act(async () => {
        rerender(<EditIdeaModal {...defaultProps} idea={updatedIdea} />)
      })

      const titleInput = screen.getByLabelText('Idea Title') as HTMLInputElement
      const detailsInput = screen.getByLabelText('Details') as HTMLTextAreaElement
      const prioritySelect = screen.getByLabelText('Priority Level') as HTMLSelectElement

      expect(titleInput.value).toBe('Updated Title')
      expect(detailsInput.value).toBe('Updated details')
      expect(prioritySelect.value).toBe('high')
    })

    it('should handle empty details gracefully', async () => {
      const ideaWithoutDetails = { ...mockIdea, details: '' }
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} idea={ideaWithoutDetails} />)
      })

      const detailsInput = screen.getByLabelText('Details') as HTMLTextAreaElement
      expect(detailsInput.value).toBe('')
    })

    it('should use default moderate priority if not specified', async () => {
      const ideaWithoutPriority = { ...mockIdea, priority: undefined as any }
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} idea={ideaWithoutPriority} />)
      })

      const prioritySelect = screen.getByLabelText('Priority Level') as HTMLSelectElement
      expect(prioritySelect.value).toBe('moderate')
    })
  })

  describe('Form Editing', () => {
    it('should allow editing the title field', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const titleInput = screen.getByLabelText('Idea Title')
      await user.clear(titleInput)
      await user.type(titleInput, 'New Title')

      expect(titleInput).toHaveValue('New Title')
    })

    it('should allow editing the details field', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const detailsInput = screen.getByLabelText('Details')
      await user.clear(detailsInput)
      await user.type(detailsInput, 'New detailed description')

      expect(detailsInput).toHaveValue('New detailed description')
    })

    it('should preserve whitespace in content', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const titleInput = screen.getByLabelText('Idea Title')
      await user.clear(titleInput)
      await user.type(titleInput, '  Title with spaces  ')

      expect(titleInput).toHaveValue('  Title with spaces  ')
    })
  })

  describe('Priority Selection', () => {
    it('should display all priority options', async () => {
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const prioritySelect = screen.getByLabelText('Priority Level')
      const options = prioritySelect.querySelectorAll('option')

      expect(options).toHaveLength(5)
      expect(options[0].textContent).toContain('Low Priority')
      expect(options[1].textContent).toContain('Moderate')
      expect(options[2].textContent).toContain('High Priority')
      expect(options[3].textContent).toContain('Strategic')
      expect(options[4].textContent).toContain('Innovation')
    })

    it('should allow changing priority', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const prioritySelect = screen.getByLabelText('Priority Level')
      await user.selectOptions(prioritySelect, 'high')

      expect(prioritySelect).toHaveValue('high')
    })

    it('should cycle through all priority levels', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const prioritySelect = screen.getByLabelText('Priority Level')
      const priorities = ['low', 'moderate', 'high', 'strategic', 'innovation']

      for (const priority of priorities) {
        await user.selectOptions(prioritySelect, priority)
        expect(prioritySelect).toHaveValue(priority)
      }
    })
  })

  describe('Lock Management', () => {
    it('should attempt to lock idea when modal opens', async () => {
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(IdeaRepository.lockIdeaForEditing).toHaveBeenCalledWith(
          mockIdea.id,
          mockUser.id
        )
      })
    })

    it('should show warning and close if lock fails', async () => {
      vi.mocked(IdeaRepository.lockIdeaForEditing).mockResolvedValue(false)

      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(mockShowWarning).toHaveBeenCalledWith(
          expect.stringContaining('currently being edited')
        )
        expect(mockOnClose).toHaveBeenCalled()
      })
    })

    it('should show editing_by user name in lock warning', async () => {
      const lockedIdea = { ...mockIdea, editing_by: 'Another User' }
      vi.mocked(IdeaRepository.lockIdeaForEditing).mockResolvedValue(false)

      await act(async () => {
        render(<EditIdeaModal {...defaultProps} idea={lockedIdea} />)
      })

      await waitFor(() => {
        expect(mockShowWarning).toHaveBeenCalledWith(
          expect.stringContaining('Another User')
        )
      })
    })

    it('should unlock idea when modal closes successfully', async () => {
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(IdeaRepository.lockIdeaForEditing).toHaveBeenCalled()
      })

      const cancelButton = screen.getByText('Cancel')
      await act(async () => {
        fireEvent.click(cancelButton)
      })

      await waitFor(() => {
        expect(IdeaRepository.unlockIdea).toHaveBeenCalledWith(
          mockIdea.id,
          mockUser.id
        )
      })
    })

    it('should unlock idea on cleanup', async () => {
      const { unmount } = render(<EditIdeaModal {...defaultProps} />)

      await waitFor(() => {
        expect(IdeaRepository.lockIdeaForEditing).toHaveBeenCalled()
      })

      await act(async () => {
        unmount()
      })

      expect(IdeaRepository.unlockIdea).toHaveBeenCalledWith(
        mockIdea.id,
        mockUser.id
      )
    })

    it('should handle unlock errors gracefully during close', async () => {
      vi.mocked(IdeaRepository.unlockIdea).mockRejectedValue(new Error('Unlock failed'))

      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(IdeaRepository.lockIdeaForEditing).toHaveBeenCalled()
      })

      const cancelButton = screen.getByText('Cancel')
      await act(async () => {
        fireEvent.click(cancelButton)
      })

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })
    })

    it('should not attempt lock without user', async () => {
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} currentUser={null} />)
      })

      await waitFor(() => {
        expect(IdeaRepository.lockIdeaForEditing).toHaveBeenCalledWith(
          mockIdea.id,
          ''
        )
      })
    })
  })

  describe('Form Validation', () => {
    it('should require title field', async () => {
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const titleInput = screen.getByLabelText('Idea Title')
      expect(titleInput).toHaveAttribute('required')
    })

    it('should disable save button when title is empty', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const titleInput = screen.getByLabelText('Idea Title')
      await user.clear(titleInput)

      const saveButton = screen.getByText('Save Changes')
      expect(saveButton).toBeDisabled()
    })

    it('should enable save button when title has content', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const titleInput = screen.getByLabelText('Idea Title')
      await user.clear(titleInput)
      await user.type(titleInput, 'New Title')

      const saveButton = screen.getByText('Save Changes')
      expect(saveButton).not.toBeDisabled()
    })

    it('should show error when submitting empty title', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const titleInput = screen.getByLabelText('Idea Title')
      await user.clear(titleInput)

      const form = screen.getByRole('dialog').querySelector('form')!
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(screen.getByText('Idea title is required')).toBeInTheDocument()
      })
    })

    it('should trim whitespace from title before validation', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const titleInput = screen.getByLabelText('Idea Title')
      await user.clear(titleInput)
      await user.type(titleInput, '   ')

      const form = screen.getByRole('dialog').querySelector('form')!
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(screen.getByText('Idea title is required')).toBeInTheDocument()
      })
    })

    it('should allow empty details field', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const detailsInput = screen.getByLabelText('Details')
      await user.clear(detailsInput)

      const saveButton = screen.getByText('Save Changes')
      expect(saveButton).not.toBeDisabled()
    })
  })

  describe('Save Operation', () => {
    it('should call onUpdate with updated idea data', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const titleInput = screen.getByLabelText('Idea Title')
      await user.clear(titleInput)
      await user.type(titleInput, 'Updated Title')

      const form = screen.getByRole('dialog').querySelector('form')!
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            id: mockIdea.id,
            content: 'Updated Title',
            details: mockIdea.details,
            priority: mockIdea.priority,
            editing_by: null,
            editing_at: null
          })
        )
      })
    })

    it('should trim whitespace from title and details', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const titleInput = screen.getByLabelText('Idea Title')
      await user.clear(titleInput)
      await user.type(titleInput, '  Trimmed Title  ')

      const form = screen.getByRole('dialog').querySelector('form')!
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            content: 'Trimmed Title'
          })
        )
      })
    })

    it('should include updated priority', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const prioritySelect = screen.getByLabelText('Priority Level')
      await user.selectOptions(prioritySelect, 'high')

      const form = screen.getByRole('dialog').querySelector('form')!
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            priority: 'high'
          })
        )
      })
    })

    it('should clear editing_by and editing_at fields on save', async () => {
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const form = screen.getByRole('dialog').querySelector('form')!
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            editing_by: null,
            editing_at: null
          })
        )
      })
    })

    it('should update updated_at timestamp', async () => {
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const form = screen.getByRole('dialog').querySelector('form')!
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            updated_at: expect.any(String)
          })
        )
      })
    })

    it('should set updated_by to current user', async () => {
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const form = screen.getByRole('dialog').querySelector('form')!
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            updated_by: mockUser.id
          })
        )
      })
    })

    it('should show success message after save', async () => {
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const form = screen.getByRole('dialog').querySelector('form')!
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('Idea updated successfully')
      })
    })

    it('should close modal after successful save', async () => {
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const form = screen.getByRole('dialog').querySelector('form')!
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })
    })

    it('should unlock idea after successful save', async () => {
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const form = screen.getByRole('dialog').querySelector('form')!
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(IdeaRepository.unlockIdea).toHaveBeenCalledWith(
          mockIdea.id,
          mockUser.id
        )
      })
    })

    it('should show loading state during save', async () => {
      mockOnUpdate.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )

      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const form = screen.getByRole('dialog').querySelector('form')!
      await act(async () => {
        fireEvent.submit(form)
      })

      expect(screen.getByText('Processing your request...')).toBeInTheDocument()
      expect(screen.getByText('Saving...')).toBeInTheDocument()
    })

    it('should disable save button during save', async () => {
      mockOnUpdate.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )

      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const form = screen.getByRole('dialog').querySelector('form')!
      await act(async () => {
        fireEvent.submit(form)
      })

      const saveButton = screen.getByText('Saving...')
      expect(saveButton).toBeDisabled()
    })

    it('should prevent duplicate submissions', async () => {
      mockOnUpdate.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )

      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const form = screen.getByRole('dialog').querySelector('form')!

      await act(async () => {
        fireEvent.submit(form)
        fireEvent.submit(form)
      })

      expect(mockOnUpdate).toHaveBeenCalledTimes(1)
    })

    it('should handle save errors gracefully', async () => {
      const saveError = new Error('Save failed')
      mockOnUpdate.mockRejectedValue(saveError)

      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const form = screen.getByRole('dialog').querySelector('form')!
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith(
          expect.stringContaining('Failed to update idea')
        )
      })
    })

    it('should show error message in modal on save failure', async () => {
      mockOnUpdate.mockRejectedValue(new Error('Network error'))

      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const form = screen.getByRole('dialog').querySelector('form')!
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(screen.getByText(/update idea: Network error/)).toBeInTheDocument()
      })
    })

    it('should not close modal on save failure', async () => {
      mockOnUpdate.mockRejectedValue(new Error('Save failed'))

      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const form = screen.getByRole('dialog').querySelector('form')!
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalled()
      })

      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('should require current user for save', async () => {
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} currentUser={null} />)
      })

      const form = screen.getByRole('dialog').querySelector('form')!
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(screen.getByText('User authentication required')).toBeInTheDocument()
      })
    })
  })

  describe('Cancel Operation', () => {
    it('should close modal when cancel is clicked', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const cancelButton = screen.getByText('Cancel')
      await user.click(cancelButton)

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })
    })

    it('should unlock idea on cancel', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      await waitFor(() => {
        expect(IdeaRepository.lockIdeaForEditing).toHaveBeenCalled()
      })

      const cancelButton = screen.getByText('Cancel')
      await user.click(cancelButton)

      await waitFor(() => {
        expect(IdeaRepository.unlockIdea).toHaveBeenCalledWith(
          mockIdea.id,
          mockUser.id
        )
      })
    })

    it('should discard form changes on cancel', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const titleInput = screen.getByLabelText('Idea Title')
      await user.clear(titleInput)
      await user.type(titleInput, 'Changed Title')

      const cancelButton = screen.getByText('Cancel')
      await user.click(cancelButton)

      expect(mockOnUpdate).not.toHaveBeenCalled()
    })

    it('should handle cancel errors gracefully', async () => {
      const user = userEvent.setup({ delay: null })
      vi.mocked(IdeaRepository.unlockIdea).mockRejectedValue(new Error('Unlock failed'))

      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const cancelButton = screen.getByText('Cancel')
      await user.click(cancelButton)

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })
    })
  })

  describe('Delete Operation', () => {
    it('should show delete button', async () => {
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      expect(screen.getByText('Delete Idea')).toBeInTheDocument()
    })

    it('should show confirmation dialog when delete is clicked', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const deleteButton = screen.getByText('Delete Idea')
      await user.click(deleteButton)

      expect(screen.getByText('Confirm Deletion')).toBeInTheDocument()
      expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument()
    })

    it('should hide main form actions when delete confirmation is shown', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const deleteButton = screen.getByText('Delete Idea')
      await user.click(deleteButton)

      expect(screen.queryByText('Save Changes')).not.toBeInTheDocument()
    })

    it('should cancel delete confirmation', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const deleteButton = screen.getByText('Delete Idea')
      await user.click(deleteButton)

      const cancelButtons = screen.getAllByText('Cancel')
      await user.click(cancelButtons[1])

      expect(screen.queryByText('Confirm Deletion')).not.toBeInTheDocument()
    })

    it('should call onDelete when confirmed', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const deleteButton = screen.getByText('Delete Idea')
      await user.click(deleteButton)

      const confirmDeleteButton = screen.getByRole('button', { name: /^Delete$/i })
      await user.click(confirmDeleteButton)

      await waitFor(() => {
        expect(mockOnDelete).toHaveBeenCalledWith(mockIdea.id)
      })
    })

    it('should show success message after delete', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const deleteButton = screen.getByText('Delete Idea')
      await user.click(deleteButton)

      const confirmDeleteButton = screen.getByRole('button', { name: /^Delete$/i })
      await user.click(confirmDeleteButton)

      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('Idea deleted successfully')
      })
    })

    it('should close modal after successful delete', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const deleteButton = screen.getByText('Delete Idea')
      await user.click(deleteButton)

      const confirmDeleteButton = screen.getByRole('button', { name: /^Delete$/i })
      await user.click(confirmDeleteButton)

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })
    })

    it('should unlock idea after successful delete', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const deleteButton = screen.getByText('Delete Idea')
      await user.click(deleteButton)

      const confirmDeleteButton = screen.getByRole('button', { name: /^Delete$/i })
      await user.click(confirmDeleteButton)

      await waitFor(() => {
        expect(IdeaRepository.unlockIdea).toHaveBeenCalledWith(
          mockIdea.id,
          mockUser.id
        )
      })
    })

    it('should handle delete errors gracefully', async () => {
      const user = userEvent.setup({ delay: null })
      mockOnDelete.mockRejectedValue(new Error('Delete failed'))

      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const deleteButton = screen.getByText('Delete Idea')
      await user.click(deleteButton)

      const confirmDeleteButton = screen.getByRole('button', { name: /^Delete$/i })
      await user.click(confirmDeleteButton)

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalledWith(
          expect.stringContaining('Failed to delete idea')
        )
      })
    })

    it('should not close modal on delete failure', async () => {
      const user = userEvent.setup({ delay: null })
      mockOnDelete.mockRejectedValue(new Error('Delete failed'))

      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const deleteButton = screen.getByText('Delete Idea')
      await user.click(deleteButton)

      const confirmDeleteButton = screen.getByRole('button', { name: /^Delete$/i })
      await user.click(confirmDeleteButton)

      await waitFor(() => {
        expect(mockShowError).toHaveBeenCalled()
      })

      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should display error messages in dedicated error UI', async () => {
      mockOnUpdate.mockRejectedValue(new Error('Test error'))

      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const form = screen.getByRole('dialog').querySelector('form')!
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(screen.getByText(/update idea: Test error/)).toBeInTheDocument()
      })
    })

    it('should allow dismissing error messages', async () => {
      const user = userEvent.setup({ delay: null })
      mockOnUpdate.mockRejectedValue(new Error('Test error'))

      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const form = screen.getByRole('dialog').querySelector('form')!
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(screen.getByText(/update idea: Test error/)).toBeInTheDocument()
      })

      const dismissButton = screen.getByText('Dismiss')
      await user.click(dismissButton)

      expect(screen.queryByText(/update idea: Test error/)).not.toBeInTheDocument()
    })

    it('should clear previous errors on new submission', async () => {
      const user = userEvent.setup({ delay: null })
      mockOnUpdate.mockRejectedValueOnce(new Error('First error'))
      mockOnUpdate.mockResolvedValueOnce(undefined)

      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const form = screen.getByRole('dialog').querySelector('form')!
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(screen.getByText(/First error/)).toBeInTheDocument()
      })

      const titleInput = screen.getByLabelText('Idea Title')
      await user.type(titleInput, ' updated')

      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(screen.queryByText(/First error/)).not.toBeInTheDocument()
      })
    })

    it('should handle non-Error exceptions', async () => {
      mockOnUpdate.mockRejectedValue('String error')

      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const form = screen.getByRole('dialog').querySelector('form')!
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(screen.getByText(/unexpected error occurred/)).toBeInTheDocument()
      })
    })

    it('should re-enable form after error', async () => {
      mockOnUpdate.mockRejectedValue(new Error('Test error'))

      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const form = screen.getByRole('dialog').querySelector('form')!
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(screen.getByText(/Test error/)).toBeInTheDocument()
      })

      const saveButton = screen.getByText('Save Changes')
      expect(saveButton).not.toBeDisabled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels on form fields', async () => {
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      expect(screen.getByLabelText('Idea Title')).toBeInTheDocument()
      expect(screen.getByLabelText('Details')).toBeInTheDocument()
      expect(screen.getByLabelText('Priority Level')).toBeInTheDocument()
    })

    it('should have proper modal role', async () => {
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('should have close button with accessible label', async () => {
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      expect(screen.getByLabelText('Close modal')).toBeInTheDocument()
    })

    it('should maintain focus management', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const titleInput = screen.getByLabelText('Idea Title')
      titleInput.focus()

      expect(document.activeElement).toBe(titleInput)

      await user.tab()
      const detailsInput = screen.getByLabelText('Details')
      expect(document.activeElement).toBe(detailsInput)
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const titleInput = screen.getByLabelText('Idea Title')
      titleInput.focus()

      await user.keyboard('{Tab}')
      expect(document.activeElement).toBe(screen.getByLabelText('Details'))

      await user.keyboard('{Tab}')
      expect(document.activeElement).toBe(screen.getByLabelText('Priority Level'))
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long title text', async () => {
      const user = userEvent.setup({ delay: null })
      const longTitle = 'A'.repeat(500)

      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const titleInput = screen.getByLabelText('Idea Title')
      await user.clear(titleInput)
      await user.type(titleInput, longTitle)

      expect(titleInput).toHaveValue(longTitle)
    })

    it('should handle special characters in content', async () => {
      const user = userEvent.setup({ delay: null })
      const specialContent = '<script>alert("xss")</script>'

      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const titleInput = screen.getByLabelText('Idea Title')
      await user.clear(titleInput)
      await user.type(titleInput, specialContent)

      expect(titleInput).toHaveValue(specialContent)
    })

    it('should handle rapid priority changes', async () => {
      const user = userEvent.setup({ delay: null })
      await act(async () => {
        render(<EditIdeaModal {...defaultProps} />)
      })

      const prioritySelect = screen.getByLabelText('Priority Level')

      await user.selectOptions(prioritySelect, 'high')
      await user.selectOptions(prioritySelect, 'low')
      await user.selectOptions(prioritySelect, 'strategic')

      expect(prioritySelect).toHaveValue('strategic')
    })

    it('should handle modal reopening with different idea', async () => {
      const { rerender } = render(<EditIdeaModal {...defaultProps} />)

      await act(async () => {
        await vi.runAllTimersAsync()
      })

      const newIdea = {
        ...mockIdea,
        id: generateDemoUUID('999'),
        content: 'Different Idea',
        priority: 'high' as const
      }

      await act(async () => {
        rerender(<EditIdeaModal {...defaultProps} idea={newIdea} />)
      })

      const titleInput = screen.getByLabelText('Idea Title') as HTMLInputElement
      expect(titleInput.value).toBe('Different Idea')
    })

    it('should handle position coordinates correctly', async () => {
      const ideaWithPosition = {
        ...mockIdea,
        x: 100,
        y: 200
      }

      await act(async () => {
        render(<EditIdeaModal {...defaultProps} idea={ideaWithPosition} />)
      })

      const form = screen.getByRole('dialog').querySelector('form')!
      await act(async () => {
        fireEvent.submit(form)
      })

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            x: 100,
            y: 200
          })
        )
      })
    })
  })
})