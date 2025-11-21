/**
 * MobileIdeaSubmitForm Component Tests
 * Phase Three Implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MobileIdeaSubmitForm from '../MobileIdeaSubmitForm'
import type { BrainstormSession, SessionParticipant } from '../../types/BrainstormSession'
import { BrainstormSessionService } from '../../lib/services/BrainstormSessionService'

// Mock BrainstormSessionService
vi.mock('../../lib/services/BrainstormSessionService', () => ({
  BrainstormSessionService: {
    submitIdea: vi.fn()
  }
}))

describe('MobileIdeaSubmitForm', () => {
  const mockSession: BrainstormSession = {
    id: 'session-1',
    project_id: 'project-1',
    name: 'Product Brainstorm 2024',
    description: 'Brainstorming new product features',
    status: 'active',
    created_by: 'user-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 3600000).toISOString()
  }

  const mockParticipant: SessionParticipant = {
    id: 'participant-1',
    session_id: 'session-1',
    participant_name: 'Alice Johnson',
    is_anonymous: false,
    is_approved: true,
    contribution_count: 3,
    joined_at: new Date().toISOString(),
    last_active_at: new Date().toISOString()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('renders session header with session name and participant info', () => {
    render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

    expect(screen.getByText('Product Brainstorm 2024')).toBeInTheDocument()
    expect(screen.getByText(/Welcome,/)).toBeInTheDocument()
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText(/3 ideas/i)).toBeInTheDocument()
  })

  it('auto-focuses content textarea on mount', () => {
    render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

    const contentTextarea = screen.getByPlaceholderText(
      /Enter your idea/i
    ) as HTMLTextAreaElement
    expect(document.activeElement).toBe(contentTextarea)
  })

  it('displays character count for content textarea', async () => {
    const user = userEvent.setup()
    render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

    const contentTextarea = screen.getByPlaceholderText(/Enter your idea/i)
    await user.type(contentTextarea, 'Test idea')

    expect(screen.getByText('9/200')).toBeInTheDocument()
  })

  it('shows amber warning when content is too short', async () => {
    const user = userEvent.setup()
    render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

    const contentTextarea = screen.getByPlaceholderText(/Enter your idea/i)
    await user.type(contentTextarea, 'Short')

    expect(screen.getByText('Minimum 10 characters required')).toBeInTheDocument()
  })

  it('shows red error when content exceeds 200 characters', async () => {
    const user = userEvent.setup()
    render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

    const contentTextarea = screen.getByPlaceholderText(/Enter your idea/i)
    const longText = 'a'.repeat(201)
    await user.type(contentTextarea, longText)

    expect(screen.getByText('Maximum 200 characters exceeded')).toBeInTheDocument()
  })

  it('displays character count for details textarea', async () => {
    const user = userEvent.setup()
    render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

    const detailsTextarea = screen.getByPlaceholderText(/Add more context/i)
    await user.type(detailsTextarea, 'Additional details here')

    expect(screen.getByText('22/500')).toBeInTheDocument()
  })

  it('shows error when details exceed 500 characters', async () => {
    const user = userEvent.setup()
    render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

    const detailsTextarea = screen.getByPlaceholderText(/Add more context/i)
    const longText = 'a'.repeat(501)
    await user.type(detailsTextarea, longText)

    // Character count should be red when exceeding limit
    const charCount = screen.getByText('500/500')
    expect(charCount).toHaveClass('text-red-600')
  })

  it('renders priority selector with three options', () => {
    render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

    expect(screen.getByRole('button', { name: 'Low' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Moderate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'High' })).toBeInTheDocument()
  })

  it('defaults priority to moderate', () => {
    render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

    const moderateButton = screen.getByRole('button', { name: 'Moderate' })
    expect(moderateButton).toHaveClass('border-blue-500', 'bg-blue-50')
  })

  it('allows changing priority', async () => {
    const user = userEvent.setup()
    render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

    const highButton = screen.getByRole('button', { name: 'High' })
    await user.click(highButton)

    expect(highButton).toHaveClass('border-blue-500', 'bg-blue-50')
  })

  it('disables submit button when content is too short', async () => {
    const user = userEvent.setup()
    render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

    const contentTextarea = screen.getByPlaceholderText(/Enter your idea/i)
    await user.type(contentTextarea, 'Short')

    const submitButton = screen.getByRole('button', { name: /Submit Idea/i })
    expect(submitButton).toBeDisabled()
  })

  it('enables submit button when content is valid', async () => {
    const user = userEvent.setup()
    render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

    const contentTextarea = screen.getByPlaceholderText(/Enter your idea/i)
    await user.type(contentTextarea, 'This is a valid idea with enough characters')

    const submitButton = screen.getByRole('button', { name: /Submit Idea/i })
    expect(submitButton).toBeEnabled()
  })

  it('submits idea successfully with valid input', async () => {
    const user = userEvent.setup()
    const mockSubmitIdea = vi.mocked(BrainstormSessionService.submitIdea)
    mockSubmitIdea.mockResolvedValueOnce({
      success: true,
      idea: {
        id: 'idea-1',
        content: 'Valid idea content',
        created_at: new Date().toISOString()
      }
    })

    render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

    const contentTextarea = screen.getByPlaceholderText(/Enter your idea/i)
    await user.type(contentTextarea, 'Valid idea content')

    const submitButton = screen.getByRole('button', { name: /Submit Idea/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockSubmitIdea).toHaveBeenCalledWith({
        sessionId: 'session-1',
        participantId: 'participant-1',
        content: 'Valid idea content',
        details: undefined,
        priority: 'moderate'
      })
    })
  })

  it('shows success toast after successful submission', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ delay: null })
    const mockSubmitIdea = vi.mocked(BrainstormSessionService.submitIdea)
    mockSubmitIdea.mockResolvedValueOnce({
      success: true,
      idea: {
        id: 'idea-1',
        content: 'Valid idea content',
        created_at: new Date().toISOString()
      }
    })

    render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

    const contentTextarea = screen.getByPlaceholderText(/Enter your idea/i)
    await user.type(contentTextarea, 'Valid idea content')

    const submitButton = screen.getByRole('button', { name: /Submit Idea/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Idea submitted successfully!')).toBeInTheDocument()
    })

    vi.runAllTimers()
    vi.useRealTimers()
  })

  it('resets form after successful submission', async () => {
    const user = userEvent.setup()
    const mockSubmitIdea = vi.mocked(BrainstormSessionService.submitIdea)
    mockSubmitIdea.mockResolvedValueOnce({
      success: true,
      idea: {
        id: 'idea-1',
        content: 'Valid idea content',
        created_at: new Date().toISOString()
      }
    })

    render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

    const contentTextarea = screen.getByPlaceholderText(
      /Enter your idea/i
    ) as HTMLTextAreaElement
    const detailsTextarea = screen.getByPlaceholderText(
      /Add more context/i
    ) as HTMLTextAreaElement

    await user.type(contentTextarea, 'Valid idea content')
    await user.type(detailsTextarea, 'Some details')

    const submitButton = screen.getByRole('button', { name: /Submit Idea/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(contentTextarea.value).toBe('')
      expect(detailsTextarea.value).toBe('')
    })
  })

  it('adds submitted idea to recent ideas list', async () => {
    const user = userEvent.setup()
    const mockSubmitIdea = vi.mocked(BrainstormSessionService.submitIdea)
    mockSubmitIdea.mockResolvedValueOnce({
      success: true,
      idea: {
        id: 'idea-1',
        content: 'My first idea',
        created_at: new Date().toISOString()
      }
    })

    render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

    const contentTextarea = screen.getByPlaceholderText(/Enter your idea/i)
    await user.type(contentTextarea, 'My first idea')

    const submitButton = screen.getByRole('button', { name: /Submit Idea/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Your Recent Ideas (1)')).toBeInTheDocument()
      expect(screen.getByText('My first idea')).toBeInTheDocument()
    })
  })

  it('limits recent ideas to last 5 submissions', async () => {
    const user = userEvent.setup()
    const mockSubmitIdea = vi.mocked(BrainstormSessionService.submitIdea)

    render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

    // Submit 6 ideas
    for (let i = 1; i <= 6; i++) {
      mockSubmitIdea.mockResolvedValueOnce({
        success: true,
        idea: {
          id: `idea-${i}`,
          content: `Idea number ${i}`,
          created_at: new Date().toISOString()
        }
      })

      const contentTextarea = screen.getByPlaceholderText(/Enter your idea/i)
      await user.clear(contentTextarea)
      await user.type(contentTextarea, `Idea number ${i}`)

      const submitButton = screen.getByRole('button', { name: /Submit Idea/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(`Idea number ${i}`)).toBeInTheDocument()
      })
    }

    // Should show only last 5 ideas
    await waitFor(() => {
      expect(screen.getByText('Your Recent Ideas (5)')).toBeInTheDocument()
      expect(screen.queryByText('Idea number 1')).not.toBeInTheDocument()
      expect(screen.getByText('Idea number 6')).toBeInTheDocument()
    })
  })

  it('displays rate limit error message', async () => {
    const user = userEvent.setup()
    const mockSubmitIdea = vi.mocked(BrainstormSessionService.submitIdea)
    mockSubmitIdea.mockResolvedValueOnce({
      success: false,
      code: 'RATE_LIMITED',
      error: 'Rate limit exceeded'
    })

    render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

    const contentTextarea = screen.getByPlaceholderText(/Enter your idea/i)
    await user.type(contentTextarea, 'Valid idea content')

    const submitButton = screen.getByRole('button', { name: /Submit Idea/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(
        screen.getByText('Please wait a moment before submitting another idea.')
      ).toBeInTheDocument()
    })
  })

  it('displays generic error message for failed submission', async () => {
    const user = userEvent.setup()
    const mockSubmitIdea = vi.mocked(BrainstormSessionService.submitIdea)
    mockSubmitIdea.mockResolvedValueOnce({
      success: false,
      error: 'Network error'
    })

    render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

    const contentTextarea = screen.getByPlaceholderText(/Enter your idea/i)
    await user.type(contentTextarea, 'Valid idea content')

    const submitButton = screen.getByRole('button', { name: /Submit Idea/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('shows loading state during submission', async () => {
    const user = userEvent.setup()
    const mockSubmitIdea = vi.mocked(BrainstormSessionService.submitIdea)
    mockSubmitIdea.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                success: true,
                idea: {
                  id: 'idea-1',
                  content: 'Valid idea content',
                  created_at: new Date().toISOString()
                }
              }),
            100
          )
        })
    )

    render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

    const contentTextarea = screen.getByPlaceholderText(/Enter your idea/i)
    await user.type(contentTextarea, 'Valid idea content')

    const submitButton = screen.getByRole('button', { name: /Submit Idea/i })
    await user.click(submitButton)

    expect(screen.getByText('Submitting...')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Submit Idea')).toBeInTheDocument()
    })
  })

  it('disables form when session is paused', () => {
    const pausedSession = { ...mockSession, status: 'paused' as const }
    render(<MobileIdeaSubmitForm session={pausedSession} participant={mockParticipant} />)

    const contentTextarea = screen.getByPlaceholderText(/Enter your idea/i)
    const detailsTextarea = screen.getByPlaceholderText(/Add more context/i)
    const submitButton = screen.getByRole('button', { name: /Submit Idea/i })

    expect(contentTextarea).toBeDisabled()
    expect(detailsTextarea).toBeDisabled()
    expect(submitButton).toBeDisabled()
    expect(
      screen.getByText('Session is currently paused. Idea submission is disabled.')
    ).toBeInTheDocument()
  })

  it('shows correct session status color for active session', () => {
    render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

    const statusLabel = screen.getByText('Active')
    expect(statusLabel).toHaveClass('text-green-600')
  })

  it('shows correct session status color for paused session', () => {
    const pausedSession = { ...mockSession, status: 'paused' as const }
    render(<MobileIdeaSubmitForm session={pausedSession} participant={mockParticipant} />)

    const statusLabel = screen.getByText('Paused')
    expect(statusLabel).toHaveClass('text-amber-600')
  })

  it('shows correct session status color for completed session', () => {
    const completedSession = { ...mockSession, status: 'completed' as const }
    render(<MobileIdeaSubmitForm session={completedSession} participant={mockParticipant} />)

    const statusLabel = screen.getByText('Completed')
    expect(statusLabel).toHaveClass('text-neutral-500')
  })

  it('re-focuses content textarea after successful submission', async () => {
    const user = userEvent.setup()
    const mockSubmitIdea = vi.mocked(BrainstormSessionService.submitIdea)
    mockSubmitIdea.mockResolvedValueOnce({
      success: true,
      idea: {
        id: 'idea-1',
        content: 'Valid idea content',
        created_at: new Date().toISOString()
      }
    })

    render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

    const contentTextarea = screen.getByPlaceholderText(
      /Enter your idea/i
    ) as HTMLTextAreaElement
    await user.type(contentTextarea, 'Valid idea content')

    const submitButton = screen.getByRole('button', { name: /Submit Idea/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(document.activeElement).toBe(contentTextarea)
    })
  })

  it('submits idea with details and custom priority', async () => {
    const user = userEvent.setup()
    const mockSubmitIdea = vi.mocked(BrainstormSessionService.submitIdea)
    mockSubmitIdea.mockResolvedValueOnce({
      success: true,
      idea: {
        id: 'idea-1',
        content: 'Valid idea content',
        created_at: new Date().toISOString()
      }
    })

    render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

    const contentTextarea = screen.getByPlaceholderText(/Enter your idea/i)
    const detailsTextarea = screen.getByPlaceholderText(/Add more context/i)
    const highButton = screen.getByRole('button', { name: 'High' })

    await user.type(contentTextarea, 'Valid idea content')
    await user.type(detailsTextarea, 'Additional context')
    await user.click(highButton)

    const submitButton = screen.getByRole('button', { name: /Submit Idea/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockSubmitIdea).toHaveBeenCalledWith({
        sessionId: 'session-1',
        participantId: 'participant-1',
        content: 'Valid idea content',
        details: 'Additional context',
        priority: 'high'
      })
    })
  })
})
