/**
 * Desktop Participant Panel Component
 * Phase Four Implementation
 *
 * Displays real-time participant list for facilitator desktop view
 * Features: Participant names, contribution counts, activity tracking, join/leave animations
 */

import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { isFeatureEnabled } from '../../lib/config'
import type { SessionParticipant } from '../../types/BrainstormSession'

interface DesktopParticipantPanelProps {
  participants: SessionParticipant[]
  sessionId: string
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

export default function DesktopParticipantPanel({
  participants,
  sessionId,
  className = ''
}: DesktopParticipantPanelProps) {
  const [visibleParticipants, setVisibleParticipants] = useState<SessionParticipant[]>([])

  // Phase Four feature flag check
  if (!isFeatureEnabled('MOBILE_BRAINSTORM_PHASE4')) {
    return null
  }

  // Filter active participants and sort
  const activeParticipants = participants.filter((p) => !p.disconnected_at)
  const sortedParticipants = [...activeParticipants].sort((a, b) => {
    // Sort by contribution count (descending), then by last active (descending)
    if (b.contribution_count !== a.contribution_count) {
      return b.contribution_count - a.contribution_count
    }
    return new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime()
  })

  // Handle participant joins/leaves with animation
  useEffect(() => {
    // Add new participants with animation
    const currentIds = new Set(visibleParticipants.map((p) => p.id))
    const newParticipants = sortedParticipants.filter((p) => !currentIds.has(p.id))

    if (newParticipants.length > 0) {
      // Stagger animations for multiple joins
      newParticipants.forEach((participant, index) => {
        setTimeout(() => {
          setVisibleParticipants((prev) => [...prev, participant])
        }, index * 150) // 150ms stagger
      })
    }

    // Remove participants that left
    const sortedIds = new Set(sortedParticipants.map((p) => p.id))
    setVisibleParticipants((prev) => prev.filter((p) => sortedIds.has(p.id)))
  }, [sortedParticipants.length])

  // Sync updates for existing participants
  useEffect(() => {
    setVisibleParticipants(sortedParticipants)
  }, [participants])

  return (
    <div
      className={`bg-white/95 backdrop-blur-md rounded-lg border border-white/20 shadow-lg ${className}`}
      style={{ width: '280px' }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-200/50 bg-white/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-neutral-600" />
            <h3 className="text-sm font-semibold text-neutral-800">Participants</h3>
          </div>
          <div className="px-2 py-0.5 bg-blue-100 rounded-full">
            <span className="text-xs font-semibold text-blue-700">
              {activeParticipants.length}
            </span>
          </div>
        </div>
      </div>

      {/* Participant List */}
      <div className="max-h-96 overflow-y-auto">
        {sortedParticipants.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Users className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm text-neutral-500">No participants yet</p>
            <p className="text-xs text-neutral-400 mt-1">
              Waiting for mobile users to join...
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {sortedParticipants.map((participant, index) => (
              <div
                key={participant.id}
                className="px-4 py-3 hover:bg-neutral-50 transition-all duration-200 animate-slide-in"
                style={{
                  animationDelay: `${index * 50}ms`
                }}
              >
                <div className="flex items-start justify-between">
                  {/* Participant Info */}
                  <div className="flex-1 min-w-0">
                    {/* Name and Status */}
                    <div className="flex items-center gap-2 mb-1">
                      {/* Active Indicator */}
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse-subtle"
                        style={{
                          backgroundColor: '#10B981',
                          boxShadow: '0 0 4px rgba(16, 185, 129, 0.5)'
                        }}
                        aria-label="Active participant"
                      />
                      {/* Name */}
                      <p className="text-sm font-medium text-neutral-800 truncate">
                        {participant.participant_name}
                      </p>
                      {/* Anonymous Badge */}
                      {participant.is_anonymous && (
                        <span className="text-xs px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded flex-shrink-0">
                          Guest
                        </span>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-3 text-xs text-neutral-500">
                      {/* Contribution Count */}
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
                        <span>
                          {participant.contribution_count}{' '}
                          {participant.contribution_count === 1 ? 'idea' : 'ideas'}
                        </span>
                      </span>

                      {/* Last Active */}
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

                  {/* Contribution Badge */}
                  {participant.contribution_count > 0 && (
                    <div
                      className="flex-shrink-0 ml-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                      style={{
                        backgroundColor:
                          participant.contribution_count >= 5
                            ? '#10B981' // Green for high contributors
                            : participant.contribution_count >= 3
                              ? '#3B82F6' // Blue for moderate
                              : '#D1D5DB', // Gray for low
                        color:
                          participant.contribution_count >= 3 ? 'white' : '#6B7280'
                      }}
                      aria-label={`${participant.contribution_count} contributions`}
                    >
                      {participant.contribution_count}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Summary */}
      {sortedParticipants.length > 0 && (
        <div className="px-4 py-2 bg-neutral-50 border-t border-neutral-200/50 rounded-b-lg">
          <div className="flex items-center justify-between text-xs text-neutral-600">
            <span>Total Ideas:</span>
            <span className="font-semibold">
              {sortedParticipants.reduce((sum, p) => sum + p.contribution_count, 0)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
