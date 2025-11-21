/**
 * ParticipantList Component Tests
 * Phase Three Implementation
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ParticipantList from '../ParticipantList'
import type { SessionParticipant } from '../../../types/BrainstormSession'

describe('ParticipantList', () => {
  const mockParticipants: SessionParticipant[] = [
    {
      id: '1',
      session_id: 'session-1',
      participant_name: 'Alice Johnson',
      is_anonymous: false,
      is_approved: true,
      contribution_count: 5,
      joined_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
      last_active_at: new Date(Date.now() - 2 * 60 * 1000).toISOString() // 2 min ago
    },
    {
      id: '2',
      session_id: 'session-1',
      participant_name: 'Bob Smith',
      is_anonymous: true,
      is_approved: true,
      contribution_count: 3,
      joined_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
      last_active_at: new Date(Date.now() - 1 * 60 * 1000).toISOString() // 1 min ago
    },
    {
      id: '3',
      session_id: 'session-1',
      participant_name: 'Charlie Brown',
      is_anonymous: false,
      is_approved: true,
      contribution_count: 8,
      joined_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 min ago
      last_active_at: new Date(Date.now() - 30 * 1000).toISOString() // 30 sec ago
    }
  ]

  it('renders participant list with correct count', () => {
    render(<ParticipantList participants={mockParticipants} />)

    expect(screen.getByText(/Participants \(3\)/i)).toBeInTheDocument()
  })

  it('displays all active participants', () => {
    render(<ParticipantList participants={mockParticipants} />)

    expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument()
  })

  it('shows anonymous badge for anonymous participants', () => {
    render(<ParticipantList participants={mockParticipants} />)

    const guestBadges = screen.getAllByText('Guest')
    expect(guestBadges).toHaveLength(1) // Only Bob is anonymous
  })

  it('displays contribution counts correctly', () => {
    render(<ParticipantList participants={mockParticipants} />)

    expect(screen.getByText('5 ideas')).toBeInTheDocument()
    expect(screen.getByText('3 ideas')).toBeInTheDocument()
    expect(screen.getByText('8 ideas')).toBeInTheDocument()
  })

  it('sorts participants by contribution count descending', () => {
    render(<ParticipantList participants={mockParticipants} />)

    const participantElements = screen.getAllByRole('generic', {
      name: (content, element) => {
        return element?.className?.includes('px-4 py-3') ?? false
      }
    })

    // Charlie (8 ideas) should be first, Alice (5) second, Bob (3) third
    const names = participantElements.map((el) => el.textContent)
    expect(names[0]).toContain('Charlie Brown')
    expect(names[1]).toContain('Alice Johnson')
    expect(names[2]).toContain('Bob Smith')
  })

  it('filters out disconnected participants', () => {
    const participantsWithDisconnected: SessionParticipant[] = [
      ...mockParticipants,
      {
        id: '4',
        session_id: 'session-1',
        participant_name: 'Disconnected User',
        is_anonymous: false,
        is_approved: true,
        contribution_count: 10,
        joined_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        last_active_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        disconnected_at: new Date().toISOString() // Disconnected
      }
    ]

    render(<ParticipantList participants={participantsWithDisconnected} />)

    expect(screen.queryByText('Disconnected User')).not.toBeInTheDocument()
    expect(screen.getByText(/Participants \(3\)/i)).toBeInTheDocument() // Still 3 active
  })

  it('shows total ideas count in footer', () => {
    render(<ParticipantList participants={mockParticipants} />)

    // Total: 5 + 3 + 8 = 16 ideas
    expect(screen.getByText(/Total Ideas: 16/i)).toBeInTheDocument()
  })

  it('displays empty state when no participants', () => {
    render(<ParticipantList participants={[]} />)

    expect(screen.getByText('No active participants yet')).toBeInTheDocument()
  })

  it('renders contribution badges with correct colors', () => {
    render(<ParticipantList participants={mockParticipants} />)

    const contributionBadges = screen.getAllByText(/[0-9]+/, {
      selector: 'div[class*="rounded-full"]'
    })

    expect(contributionBadges.length).toBeGreaterThan(0)
  })

  it('displays time ago correctly', () => {
    render(<ParticipantList participants={mockParticipants} />)

    expect(screen.getByText(/2m ago/i)).toBeInTheDocument() // Alice
    expect(screen.getByText(/1m ago/i)).toBeInTheDocument() // Bob
    expect(screen.getByText(/just now/i)).toBeInTheDocument() // Charlie (30s ago)
  })
})
