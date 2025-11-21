/**
 * PresenceIndicators Component Tests
 * Phase Three Implementation
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PresenceIndicators, {
  ConnectionStatus,
  ParticipantPresenceBadge
} from '../PresenceIndicators'

describe('PresenceIndicators', () => {
  const mockPresenceStates = [
    {
      participantId: '1',
      participantName: 'Alice Johnson',
      isTyping: true,
      lastActive: new Date()
    },
    {
      participantId: '2',
      participantName: 'Bob Smith',
      isTyping: false,
      lastActive: new Date()
    },
    {
      participantId: '3',
      participantName: 'Charlie Brown',
      isTyping: true,
      lastActive: new Date()
    }
  ]

  it('renders nothing when no one is typing', () => {
    const notTypingStates = mockPresenceStates.map((state) => ({
      ...state,
      isTyping: false
    }))

    const { container } = render(<PresenceIndicators presenceStates={notTypingStates} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows typing indicator when one participant is typing', () => {
    const oneTypingState = [
      {
        participantId: '1',
        participantName: 'Alice Johnson',
        isTyping: true,
        lastActive: new Date()
      }
    ]

    render(<PresenceIndicators presenceStates={oneTypingState} />)
    expect(screen.getByText(/Alice Johnson/)).toBeInTheDocument()
    expect(screen.getByText(/is typing.../)).toBeInTheDocument()
  })

  it('shows typing indicator when two participants are typing', () => {
    const twoTypingStates = [
      {
        participantId: '1',
        participantName: 'Alice Johnson',
        isTyping: true,
        lastActive: new Date()
      },
      {
        participantId: '2',
        participantName: 'Bob Smith',
        isTyping: true,
        lastActive: new Date()
      }
    ]

    render(<PresenceIndicators presenceStates={twoTypingStates} />)
    expect(screen.getByText(/Alice Johnson/)).toBeInTheDocument()
    expect(screen.getByText(/Bob Smith/)).toBeInTheDocument()
    expect(screen.getByText(/are typing.../)).toBeInTheDocument()
  })

  it('shows typing indicator when three or more participants are typing', () => {
    const threeTypingStates = [
      {
        participantId: '1',
        participantName: 'Alice Johnson',
        isTyping: true,
        lastActive: new Date()
      },
      {
        participantId: '2',
        participantName: 'Bob Smith',
        isTyping: true,
        lastActive: new Date()
      },
      {
        participantId: '3',
        participantName: 'Charlie Brown',
        isTyping: true,
        lastActive: new Date()
      }
    ]

    render(<PresenceIndicators presenceStates={threeTypingStates} />)
    expect(screen.getByText(/3 participants/)).toBeInTheDocument()
    expect(screen.getByText(/are typing.../)).toBeInTheDocument()
  })

  it('filters out non-typing participants', () => {
    render(<PresenceIndicators presenceStates={mockPresenceStates} />)

    // Only Alice and Charlie are typing (2 participants)
    expect(screen.getByText(/Alice Johnson/)).toBeInTheDocument()
    expect(screen.getByText(/Charlie Brown/)).toBeInTheDocument()
    expect(screen.queryByText(/Bob Smith/)).not.toBeInTheDocument()
    expect(screen.getByText(/are typing.../)).toBeInTheDocument()
  })

  it('renders with custom className', () => {
    const oneTypingState = [
      {
        participantId: '1',
        participantName: 'Alice',
        isTyping: true,
        lastActive: new Date()
      }
    ]

    const { container } = render(
      <PresenceIndicators presenceStates={oneTypingState} className="custom-class" />
    )
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('displays animated dots for typing indicator', () => {
    const oneTypingState = [
      {
        participantId: '1',
        participantName: 'Alice',
        isTyping: true,
        lastActive: new Date()
      }
    ]

    const { container } = render(<PresenceIndicators presenceStates={oneTypingState} />)
    const dots = container.querySelectorAll('.animate-bounce')
    expect(dots.length).toBe(3)
  })
})

describe('ConnectionStatus', () => {
  it('renders nothing when connected with no reconnect attempts', () => {
    const { container } = render(<ConnectionStatus isConnected={true} reconnectAttempts={0} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows connected status when reconnect attempts > 0', () => {
    render(<ConnectionStatus isConnected={true} reconnectAttempts={1} />)
    expect(screen.getByText('Connected')).toBeInTheDocument()
  })

  it('shows disconnected status when not connected', () => {
    render(<ConnectionStatus isConnected={false} reconnectAttempts={0} />)
    expect(screen.getByText('Disconnected')).toBeInTheDocument()
  })

  it('shows reconnecting status with attempt count', () => {
    render(<ConnectionStatus isConnected={false} reconnectAttempts={3} />)
    expect(screen.getByText('Reconnecting... (3)')).toBeInTheDocument()
  })

  it('applies green color for connected status', () => {
    render(<ConnectionStatus isConnected={true} reconnectAttempts={1} />)
    const statusText = screen.getByText('Connected')
    expect(statusText).toHaveClass('text-green-600')
  })

  it('applies amber color for disconnected/reconnecting status', () => {
    render(<ConnectionStatus isConnected={false} reconnectAttempts={1} />)
    const statusText = screen.getByText(/Reconnecting/)
    expect(statusText).toHaveClass('text-amber-600')
  })

  it('shows pulsing dot when disconnected', () => {
    const { container } = render(<ConnectionStatus isConnected={false} reconnectAttempts={0} />)
    const dot = container.querySelector('.animate-pulse')
    expect(dot).toBeInTheDocument()
  })

  it('shows static dot when connected', () => {
    const { container } = render(<ConnectionStatus isConnected={true} reconnectAttempts={1} />)
    const dot = container.querySelector('.bg-green-500')
    expect(dot).toBeInTheDocument()
    expect(dot).not.toHaveClass('animate-pulse')
  })

  it('renders with custom className', () => {
    const { container } = render(
      <ConnectionStatus
        isConnected={false}
        reconnectAttempts={1}
        className="custom-class"
      />
    )
    expect(container.firstChild).toHaveClass('custom-class')
  })
})

describe('ParticipantPresenceBadge', () => {
  it('renders active badge for active participant', () => {
    const { container } = render(<ParticipantPresenceBadge isActive={true} />)
    const badge = container.querySelector('[aria-label="Active"]')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveStyle({ background: '#10B981' }) // Green
  })

  it('renders inactive badge for inactive participant', () => {
    const { container } = render(<ParticipantPresenceBadge isActive={false} />)
    const badge = container.querySelector('[aria-label="Inactive"]')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveStyle({ background: '#9CA3AF' }) // Gray
  })

  it('considers participant active if lastActiveAt is within 5 minutes', () => {
    const fourMinutesAgo = new Date(Date.now() - 4 * 60 * 1000)
    const { container } = render(
      <ParticipantPresenceBadge isActive={false} lastActiveAt={fourMinutesAgo} />
    )

    const badge = container.querySelector('[aria-label="Active"]')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveStyle({ background: '#10B981' })
  })

  it('considers participant inactive if lastActiveAt is older than 5 minutes', () => {
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000)
    const { container } = render(
      <ParticipantPresenceBadge isActive={false} lastActiveAt={sixMinutesAgo} />
    )

    const badge = container.querySelector('[aria-label="Inactive"]')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveStyle({ background: '#9CA3AF' })
  })

  it('shows glow effect for active participants', () => {
    const { container } = render(<ParticipantPresenceBadge isActive={true} />)
    const badge = container.querySelector('[aria-label="Active"]')
    expect(badge).toHaveStyle({
      boxShadow: '0 0 4px rgba(16, 185, 129, 0.5)'
    })
  })

  it('shows no glow effect for inactive participants', () => {
    const { container } = render(<ParticipantPresenceBadge isActive={false} />)
    const badge = container.querySelector('[aria-label="Inactive"]')
    expect(badge).toHaveStyle({ boxShadow: 'none' })
  })

  it('renders with custom className', () => {
    const { container } = render(
      <ParticipantPresenceBadge isActive={true} className="custom-class" />
    )
    const badge = container.firstChild
    expect(badge).toHaveClass('custom-class')
  })

  it('has correct size (2x2 rounded-full)', () => {
    const { container } = render(<ParticipantPresenceBadge isActive={true} />)
    const badge = container.firstChild
    expect(badge).toHaveClass('w-2', 'h-2', 'rounded-full')
  })
})
