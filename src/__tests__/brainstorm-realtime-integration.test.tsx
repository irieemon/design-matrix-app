/**
 * Brainstorm Real-Time Rendering Integration Tests
 * Phase Three Implementation
 *
 * Tests the integration between Phase Three UI components and Phase Two real-time hooks:
 * - Mobile submission → Desktop update flow
 * - Participant join/leave visual updates
 * - Presence indicator updates
 * - Optimistic UI updates → Server sync
 * - Real-time event propagation to UI
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react-dom/test-utils'
import type {
  BrainstormSession,
  SessionParticipant,
  BrainstormIdea
} from '../types/BrainstormSession'

// Mock components for integration testing
import ParticipantList from '../components/brainstorm/ParticipantList'
import PresenceIndicators from '../components/brainstorm/PresenceIndicators'
import MobileIdeaSubmitForm from '../components/MobileIdeaSubmitForm'

// Mock real-time hooks
import { useBrainstormRealtime } from '../hooks/useBrainstormRealtime'
import { useOptimisticIdeas } from '../hooks/useOptimisticIdeas'
import { BrainstormSessionService } from '../lib/services/BrainstormSessionService'

// Mock dependencies
vi.mock('../hooks/useBrainstormRealtime')
vi.mock('../hooks/useOptimisticIdeas')
vi.mock('../lib/services/BrainstormSessionService')

describe('Brainstorm Real-Time Rendering Integration', () => {
  const mockSession: BrainstormSession = {
    id: 'session-1',
    project_id: 'project-1',
    name: 'Product Brainstorm',
    description: 'Brainstorming session',
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
    contribution_count: 0,
    joined_at: new Date().toISOString(),
    last_active_at: new Date().toISOString()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Mobile Submission → Desktop Update Flow', () => {
    it('should update participant count when mobile user submits idea', async () => {
      const user = userEvent.setup()

      // Mock successful submission
      vi.mocked(BrainstormSessionService.submitIdea).mockResolvedValueOnce({
        success: true,
        idea: {
          id: 'idea-1',
          content: 'Mobile submitted idea',
          created_at: new Date().toISOString()
        }
      })

      // Initial participant with 0 contributions
      const participants = [mockParticipant]

      const { rerender } = render(<ParticipantList participants={participants} />)

      expect(screen.getByText(/0 ideas/i)).toBeInTheDocument()

      // Submit idea from mobile
      render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

      const contentTextarea = screen.getByPlaceholderText(/Enter your idea/i)
      await user.type(contentTextarea, 'Mobile submitted idea')

      const submitButton = screen.getByRole('button', { name: /Submit Idea/i })
      await user.click(submitButton)

      // Wait for submission
      await waitFor(() => {
        expect(BrainstormSessionService.submitIdea).toHaveBeenCalled()
      })

      // Simulate real-time update: participant count incremented
      const updatedParticipants = [
        {
          ...mockParticipant,
          contribution_count: 1,
          last_active_at: new Date().toISOString()
        }
      ]

      rerender(<ParticipantList participants={updatedParticipants} />)

      // Should show updated count
      await waitFor(() => {
        expect(screen.getByText(/1 ideas/i)).toBeInTheDocument()
      })
    })

    it('should add idea to recent ideas list immediately after submission', async () => {
      const user = userEvent.setup()

      vi.mocked(BrainstormSessionService.submitIdea).mockResolvedValueOnce({
        success: true,
        idea: {
          id: 'idea-1',
          content: 'First mobile idea',
          created_at: new Date().toISOString()
        }
      })

      render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

      // Submit first idea
      const contentTextarea = screen.getByPlaceholderText(/Enter your idea/i)
      await user.type(contentTextarea, 'First mobile idea')

      const submitButton = screen.getByRole('button', { name: /Submit Idea/i })
      await user.click(submitButton)

      // Should show in recent ideas list
      await waitFor(() => {
        expect(screen.getByText('First mobile idea')).toBeInTheDocument()
        expect(screen.getByText('Your Recent Ideas (1)')).toBeInTheDocument()
      })
    })

    it('should maintain recent ideas list across multiple submissions', async () => {
      const user = userEvent.setup()

      render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

      // Submit 3 ideas in sequence
      for (let i = 1; i <= 3; i++) {
        vi.mocked(BrainstormSessionService.submitIdea).mockResolvedValueOnce({
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

      // Should show all 3 in recent ideas
      await waitFor(() => {
        expect(screen.getByText('Your Recent Ideas (3)')).toBeInTheDocument()
      })
    })
  })

  describe('Participant Join/Leave Visual Updates', () => {
    it('should show new participant when they join', () => {
      const initialParticipants = [mockParticipant]

      const { rerender } = render(<ParticipantList participants={initialParticipants} />)

      expect(screen.getByText(/Participants \(1\)/i)).toBeInTheDocument()

      // Simulate participant join
      const newParticipant: SessionParticipant = {
        id: 'participant-2',
        session_id: 'session-1',
        participant_name: 'Bob Smith',
        is_anonymous: false,
        is_approved: true,
        contribution_count: 0,
        joined_at: new Date().toISOString(),
        last_active_at: new Date().toISOString()
      }

      const updatedParticipants = [...initialParticipants, newParticipant]
      rerender(<ParticipantList participants={updatedParticipants} />)

      expect(screen.getByText(/Participants \(2\)/i)).toBeInTheDocument()
      expect(screen.getByText('Bob Smith')).toBeInTheDocument()
    })

    it('should remove participant when they disconnect', () => {
      const participants: SessionParticipant[] = [
        mockParticipant,
        {
          id: 'participant-2',
          session_id: 'session-1',
          participant_name: 'Bob Smith',
          is_anonymous: false,
          is_approved: true,
          contribution_count: 2,
          joined_at: new Date().toISOString(),
          last_active_at: new Date().toISOString()
        }
      ]

      const { rerender } = render(<ParticipantList participants={participants} />)

      expect(screen.getByText(/Participants \(2\)/i)).toBeInTheDocument()
      expect(screen.getByText('Bob Smith')).toBeInTheDocument()

      // Simulate participant disconnect
      const disconnectedParticipants = participants.map((p) =>
        p.id === 'participant-2'
          ? { ...p, disconnected_at: new Date().toISOString() }
          : p
      )

      rerender(<ParticipantList participants={disconnectedParticipants} />)

      expect(screen.getByText(/Participants \(1\)/i)).toBeInTheDocument()
      expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument()
    })

    it('should update participant sorting when contribution count changes', () => {
      const participants: SessionParticipant[] = [
        {
          ...mockParticipant,
          participant_name: 'Alice',
          contribution_count: 2
        },
        {
          id: 'participant-2',
          session_id: 'session-1',
          participant_name: 'Bob',
          is_anonymous: false,
          is_approved: true,
          contribution_count: 5,
          joined_at: new Date().toISOString(),
          last_active_at: new Date().toISOString()
        }
      ]

      const { rerender } = render(<ParticipantList participants={participants} />)

      // Bob should be first (5 ideas), Alice second (2 ideas)
      const participantElements = screen.getAllByRole('generic', {
        name: (content, element) => {
          return element?.className?.includes('px-4 py-3') ?? false
        }
      })

      expect(participantElements[0].textContent).toContain('Bob')
      expect(participantElements[1].textContent).toContain('Alice')

      // Alice submits more ideas, now has 6
      const updatedParticipants = participants.map((p) =>
        p.participant_name === 'Alice'
          ? { ...p, contribution_count: 6, last_active_at: new Date().toISOString() }
          : p
      )

      rerender(<ParticipantList participants={updatedParticipants} />)

      const updatedElements = screen.getAllByRole('generic', {
        name: (content, element) => {
          return element?.className?.includes('px-4 py-3') ?? false
        }
      })

      // Alice should now be first (6 ideas), Bob second (5 ideas)
      expect(updatedElements[0].textContent).toContain('Alice')
      expect(updatedElements[1].textContent).toContain('Bob')
    })
  })

  describe('Presence Indicator Updates', () => {
    it('should show typing indicator when participant starts typing', () => {
      const presenceStates = [
        {
          participantId: 'participant-1',
          participantName: 'Alice',
          isTyping: false,
          lastActive: new Date()
        }
      ]

      const { rerender } = render(<PresenceIndicators presenceStates={presenceStates} />)

      // Should not show typing indicator initially
      expect(screen.queryByText(/is typing/i)).not.toBeInTheDocument()

      // Simulate typing state change
      const typingStates = [
        {
          ...presenceStates[0],
          isTyping: true
        }
      ]

      rerender(<PresenceIndicators presenceStates={typingStates} />)

      // Should show typing indicator
      expect(screen.getByText(/Alice/)).toBeInTheDocument()
      expect(screen.getByText(/is typing/i)).toBeInTheDocument()
    })

    it('should hide typing indicator when participant stops typing', () => {
      const typingStates = [
        {
          participantId: 'participant-1',
          participantName: 'Alice',
          isTyping: true,
          lastActive: new Date()
        }
      ]

      const { rerender } = render(<PresenceIndicators presenceStates={typingStates} />)

      expect(screen.getByText(/is typing/i)).toBeInTheDocument()

      // Simulate stop typing
      const notTypingStates = [
        {
          ...typingStates[0],
          isTyping: false
        }
      ]

      rerender(<PresenceIndicators presenceStates={notTypingStates} />)

      expect(screen.queryByText(/is typing/i)).not.toBeInTheDocument()
    })

    it('should update typing indicator text for multiple participants', () => {
      const states = [
        {
          participantId: 'p1',
          participantName: 'Alice',
          isTyping: true,
          lastActive: new Date()
        }
      ]

      const { rerender } = render(<PresenceIndicators presenceStates={states} />)

      expect(screen.getByText(/Alice.*is typing/i)).toBeInTheDocument()

      // Add second typing participant
      const twoTyping = [
        ...states,
        {
          participantId: 'p2',
          participantName: 'Bob',
          isTyping: true,
          lastActive: new Date()
        }
      ]

      rerender(<PresenceIndicators presenceStates={twoTyping} />)

      expect(screen.getByText(/Alice.*and.*Bob.*are typing/i)).toBeInTheDocument()

      // Add third typing participant
      const threeTyping = [
        ...twoTyping,
        {
          participantId: 'p3',
          participantName: 'Charlie',
          isTyping: true,
          lastActive: new Date()
        }
      ]

      rerender(<PresenceIndicators presenceStates={threeTyping} />)

      expect(screen.getByText(/3 participants.*are typing/i)).toBeInTheDocument()
    })
  })

  describe('Optimistic UI Updates → Server Sync', () => {
    it('should show idea immediately (optimistic) then confirm with server', async () => {
      const user = userEvent.setup()

      vi.mocked(BrainstormSessionService.submitIdea).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  success: true,
                  idea: {
                    id: 'server-idea-1',
                    content: 'Test idea',
                    created_at: new Date().toISOString()
                  }
                }),
              100
            )
          })
      )

      render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

      const contentTextarea = screen.getByPlaceholderText(/Enter your idea/i)
      await user.type(contentTextarea, 'Test idea')

      const submitButton = screen.getByRole('button', { name: /Submit Idea/i })
      await user.click(submitButton)

      // Should show success toast after server confirms
      await waitFor(
        () => {
          expect(screen.getByText('Idea submitted successfully!')).toBeInTheDocument()
        },
        { timeout: 200 }
      )

      // Should show in recent ideas
      expect(screen.getByText('Test idea')).toBeInTheDocument()
    })

    it('should handle optimistic update failure gracefully', async () => {
      const user = userEvent.setup()

      vi.mocked(BrainstormSessionService.submitIdea).mockResolvedValueOnce({
        success: false,
        error: 'Network error'
      })

      render(<MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />)

      const contentTextarea = screen.getByPlaceholderText(/Enter your idea/i)
      await user.type(contentTextarea, 'Failed idea')

      const submitButton = screen.getByRole('button', { name: /Submit Idea/i })
      await user.click(submitButton)

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })

      // Should NOT show in recent ideas
      expect(screen.queryByText('Your Recent Ideas')).not.toBeInTheDocument()
    })
  })

  describe('Real-Time Event Propagation to UI', () => {
    it('should update last active time when participant activity occurs', () => {
      const participants = [
        {
          ...mockParticipant,
          last_active_at: new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 min ago
        }
      ]

      const { rerender } = render(<ParticipantList participants={participants} />)

      expect(screen.getByText(/5m ago/i)).toBeInTheDocument()

      // Simulate activity update
      const updatedParticipants = [
        {
          ...participants[0],
          last_active_at: new Date(Date.now() - 30 * 1000).toISOString() // 30 sec ago
        }
      ]

      rerender(<ParticipantList participants={updatedParticipants} />)

      expect(screen.getByText(/just now/i)).toBeInTheDocument()
    })

    it('should reflect total idea count changes across all participants', () => {
      const participants: SessionParticipant[] = [
        { ...mockParticipant, contribution_count: 3 },
        {
          id: 'p2',
          session_id: 'session-1',
          participant_name: 'Bob',
          is_anonymous: false,
          is_approved: true,
          contribution_count: 5,
          joined_at: new Date().toISOString(),
          last_active_at: new Date().toISOString()
        }
      ]

      const { rerender } = render(<ParticipantList participants={participants} />)

      // Total: 3 + 5 = 8
      expect(screen.getByText(/Total Ideas: 8/i)).toBeInTheDocument()

      // Bob submits 2 more ideas
      const updatedParticipants = participants.map((p) =>
        p.id === 'p2' ? { ...p, contribution_count: 7 } : p
      )

      rerender(<ParticipantList participants={updatedParticipants} />)

      // Total: 3 + 7 = 10
      expect(screen.getByText(/Total Ideas: 10/i)).toBeInTheDocument()
    })
  })

  describe('Session Status Real-Time Updates', () => {
    it('should disable form when session changes to paused', () => {
      const { rerender } = render(
        <MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />
      )

      const contentTextarea = screen.getByPlaceholderText(/Enter your idea/i)
      expect(contentTextarea).not.toBeDisabled()

      // Simulate session pause
      const pausedSession = { ...mockSession, status: 'paused' as const }
      rerender(<MobileIdeaSubmitForm session={pausedSession} participant={mockParticipant} />)

      expect(contentTextarea).toBeDisabled()
      expect(
        screen.getByText('Session is currently paused. Idea submission is disabled.')
      ).toBeInTheDocument()
    })

    it('should update session status indicator in real-time', () => {
      const { rerender } = render(
        <MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />
      )

      const activeStatus = screen.getByText('Active')
      expect(activeStatus).toHaveClass('text-green-600')

      // Simulate session pause
      const pausedSession = { ...mockSession, status: 'paused' as const }
      rerender(<MobileIdeaSubmitForm session={pausedSession} participant={mockParticipant} />)

      const pausedStatus = screen.getByText('Paused')
      expect(pausedStatus).toHaveClass('text-amber-600')
    })
  })

  describe('Cross-Component Real-Time Coordination', () => {
    it('should coordinate participant list and presence indicators', () => {
      const participants: SessionParticipant[] = [
        mockParticipant,
        {
          id: 'p2',
          session_id: 'session-1',
          participant_name: 'Bob',
          is_anonymous: false,
          is_approved: true,
          contribution_count: 0,
          joined_at: new Date().toISOString(),
          last_active_at: new Date().toISOString()
        }
      ]

      const presenceStates = [
        {
          participantId: 'participant-1',
          participantName: 'Alice Johnson',
          isTyping: false,
          lastActive: new Date()
        },
        {
          participantId: 'p2',
          participantName: 'Bob',
          isTyping: true,
          lastActive: new Date()
        }
      ]

      const { container } = render(
        <div>
          <ParticipantList participants={participants} />
          <PresenceIndicators presenceStates={presenceStates} />
        </div>
      )

      // Both components should show consistent participant data
      expect(screen.getByText(/Participants \(2\)/i)).toBeInTheDocument()
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
      expect(screen.getByText(/Bob.*is typing/i)).toBeInTheDocument()
    })

    it('should maintain consistency between mobile form and participant list', async () => {
      const user = userEvent.setup()

      vi.mocked(BrainstormSessionService.submitIdea).mockResolvedValueOnce({
        success: true,
        idea: {
          id: 'idea-1',
          content: 'Coordinated idea',
          created_at: new Date().toISOString()
        }
      })

      const participants = [mockParticipant]

      const { rerender } = render(
        <div>
          <MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />
          <ParticipantList participants={participants} />
        </div>
      )

      // Initial state: 0 ideas
      expect(screen.getByText(/0 ideas/i)).toBeInTheDocument()

      // Submit idea
      const contentTextarea = screen.getByPlaceholderText(/Enter your idea/i)
      await user.type(contentTextarea, 'Coordinated idea')

      const submitButton = screen.getByRole('button', { name: /Submit Idea/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Coordinated idea')).toBeInTheDocument()
      })

      // Simulate real-time update to participant list
      const updatedParticipants = [
        {
          ...mockParticipant,
          contribution_count: 1
        }
      ]

      rerender(
        <div>
          <MobileIdeaSubmitForm session={mockSession} participant={mockParticipant} />
          <ParticipantList participants={updatedParticipants} />
        </div>
      )

      // Should show updated count
      await waitFor(() => {
        expect(screen.getByText(/1 ideas/i)).toBeInTheDocument()
      })
    })
  })
})
