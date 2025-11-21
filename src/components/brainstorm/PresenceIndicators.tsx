/**
 * Presence Indicators Component
 * Phase Three Implementation
 *
 * Shows real-time presence information for brainstorming participants
 * Features: Typing indicators, online/offline status, visual pulse effects
 */

interface PresenceState {
  participantId: string
  participantName: string
  isTyping: boolean
  lastActive: Date
  cursorPosition?: { x: number; y: number }
}

interface PresenceIndicatorsProps {
  presenceStates: PresenceState[]
  className?: string
}

export default function PresenceIndicators({
  presenceStates,
  className = ''
}: PresenceIndicatorsProps) {
  // Filter only participants who are typing
  const typingParticipants = presenceStates.filter((state) => state.isTyping)

  if (typingParticipants.length === 0) {
    return null // Don't render anything if no one is typing
  }

  return (
    <div className={`fixed bottom-4 left-4 z-50 ${className}`}>
      <div className="bg-white rounded-lg shadow-lg border border-neutral-200 px-4 py-2 animate-slide-up">
        <div className="flex items-center gap-2">
          {/* Typing Animation Indicator */}
          <div className="flex items-center gap-1">
            <div
              className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: '0ms' }}
            />
            <div
              className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: '150ms' }}
            />
            <div
              className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: '300ms' }}
            />
          </div>

          {/* Typing Participant Names */}
          <p className="text-sm text-neutral-700">
            {typingParticipants.length === 1 ? (
              <span>
                <strong>{typingParticipants[0].participantName}</strong> is typing...
              </span>
            ) : typingParticipants.length === 2 ? (
              <span>
                <strong>{typingParticipants[0].participantName}</strong> and{' '}
                <strong>{typingParticipants[1].participantName}</strong> are typing...
              </span>
            ) : (
              <span>
                <strong>{typingParticipants.length} participants</strong> are typing...
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Connection Status Badge Component
 * Shows connection health for the current session
 */
interface ConnectionStatusProps {
  isConnected: boolean
  reconnectAttempts?: number
  className?: string
}

export function ConnectionStatus({
  isConnected,
  reconnectAttempts = 0,
  className = ''
}: ConnectionStatusProps) {
  if (isConnected && reconnectAttempts === 0) {
    return null // Don't show anything when connected normally
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {isConnected ? (
        <>
          <div
            className="w-2 h-2 rounded-full bg-green-500"
            style={{
              boxShadow: '0 0 4px rgba(16, 185, 129, 0.5)'
            }}
          />
          <span className="text-xs text-green-600 font-medium">Connected</span>
        </>
      ) : (
        <>
          <div
            className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"
            style={{
              boxShadow: '0 0 4px rgba(245, 158, 11, 0.5)'
            }}
          />
          <span className="text-xs text-amber-600 font-medium">
            {reconnectAttempts > 0 ? `Reconnecting... (${reconnectAttempts})` : 'Disconnected'}
          </span>
        </>
      )}
    </div>
  )
}

/**
 * Participant Presence Badge Component
 * Shows online/offline status for a specific participant
 */
interface ParticipantPresenceBadgeProps {
  isActive: boolean
  lastActiveAt?: Date
  className?: string
}

export function ParticipantPresenceBadge({
  isActive,
  lastActiveAt,
  className = ''
}: ParticipantPresenceBadgeProps) {
  // Consider participant active if they were active in the last 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
  const isRecentlyActive = lastActiveAt ? lastActiveAt > fiveMinutesAgo : false

  return (
    <div
      className={`w-2 h-2 rounded-full ${className}`}
      style={{
        background: isActive || isRecentlyActive ? '#10B981' : '#9CA3AF',
        boxShadow:
          isActive || isRecentlyActive ? '0 0 4px rgba(16, 185, 129, 0.5)' : 'none'
      }}
      aria-label={isActive || isRecentlyActive ? 'Active' : 'Inactive'}
    />
  )
}
