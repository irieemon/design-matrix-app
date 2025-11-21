/**
 * Participant List Component
 * Phase Three Implementation
 *
 * Displays active participants in a brainstorming session with real-time updates
 * Features: Participant names, contribution counts, last active time, join/leave animations
 */

import type { SessionParticipant } from '../../types/BrainstormSession'

interface ParticipantListProps {
  participants: SessionParticipant[]
  className?: string
}

function getTimeAgo(timestamp: string): string {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  return `${diffDay}d ago`
}

export default function ParticipantList({ participants, className = '' }: ParticipantListProps) {
  // Filter out disconnected participants
  const activeParticipants = participants.filter((p) => !p.disconnected_at)

  // Sort by contribution count (descending), then by last active (descending)
  const sortedParticipants = [...activeParticipants].sort((a, b) => {
    if (b.contribution_count !== a.contribution_count) {
      return b.contribution_count - a.contribution_count
    }
    return new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime()
  })

  return (
    <div className={`bg-white rounded-lg shadow-md ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-200">
        <h3 className="text-lg font-semibold text-neutral-800">
          Participants ({activeParticipants.length})
        </h3>
      </div>

      {/* Participant List */}
      <div className="divide-y divide-neutral-100">
        {sortedParticipants.length === 0 ? (
          <div className="px-4 py-8 text-center text-neutral-500">
            <p className="text-sm">No active participants yet</p>
          </div>
        ) : (
          sortedParticipants.map((participant) => (
            <div
              key={participant.id}
              className="px-4 py-3 hover:bg-neutral-50 transition-colors animate-fade-in"
            >
              <div className="flex items-center justify-between">
                {/* Participant Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {/* Status Indicator */}
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: '#10B981', // Green for active
                        boxShadow: '0 0 4px rgba(16, 185, 129, 0.5)'
                      }}
                      aria-label="Active"
                    />
                    {/* Name */}
                    <p className="text-sm font-medium text-neutral-800 truncate">
                      {participant.participant_name}
                    </p>
                    {/* Anonymous Badge */}
                    {participant.is_anonymous && (
                      <span className="text-xs px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded">
                        Guest
                      </span>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-3 text-xs text-neutral-500">
                    <span className="flex items-center gap-1">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                        />
                      </svg>
                      <span>{participant.contribution_count} ideas</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>{getTimeAgo(participant.last_active_at)}</span>
                    </span>
                  </div>
                </div>

                {/* Contribution Badge (if > 0) */}
                {participant.contribution_count > 0 && (
                  <div
                    className="flex-shrink-0 ml-3 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs"
                    style={{
                      background:
                        participant.contribution_count >= 5
                          ? '#10B981' // Green for high contributors
                          : participant.contribution_count >= 3
                            ? '#3B82F6' // Blue for moderate
                            : '#D1D5DB', // Gray for low
                      color: participant.contribution_count >= 3 ? 'white' : '#6B7280'
                    }}
                  >
                    {participant.contribution_count}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {sortedParticipants.length > 0 && (
        <div className="px-4 py-2 bg-neutral-50 border-t border-neutral-200 rounded-b-lg">
          <p className="text-xs text-neutral-500 text-center">
            Total Ideas: {sortedParticipants.reduce((sum, p) => sum + p.contribution_count, 0)}
          </p>
        </div>
      )}
    </div>
  )
}
