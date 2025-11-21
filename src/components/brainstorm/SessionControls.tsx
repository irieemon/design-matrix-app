/**
 * Session Controls Component
 * Phase Four Implementation
 *
 * Facilitator controls for managing active brainstorm sessions
 * Features: Pause, Resume, End Session with real-time status reflection
 */

import { useState } from 'react'
import { Pause, Play, StopCircle } from 'lucide-react'
import { BrainstormSessionService } from '../../lib/services/BrainstormSessionService'
import { isFeatureEnabled } from '../../lib/config'
import type { BrainstormSession } from '../../types/BrainstormSession'
import { Button } from '../ui/Button'

interface SessionControlsProps {
  session: BrainstormSession
  onSessionUpdated?: (session: BrainstormSession) => void
  className?: string
}

export default function SessionControls({
  session,
  onSessionUpdated,
  className = ''
}: SessionControlsProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [sessionStatus, setSessionStatus] = useState(session.status)

  // Phase Four feature flag check
  if (!isFeatureEnabled('MOBILE_BRAINSTORM_PHASE4')) {
    return null
  }

  /**
   * Handle pause/resume toggle
   */
  const handleTogglePause = async () => {
    if (isProcessing || sessionStatus === 'completed') return

    setIsProcessing(true)

    try {
      const response = await BrainstormSessionService.toggleSessionPause({
        sessionId: session.id
      })

      if (response.success && response.session) {
        setSessionStatus(response.session.status)
        onSessionUpdated?.(response.session)
      }
    } catch (error) {
      console.error('Failed to toggle session pause:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  /**
   * Handle end session
   */
  const handleEndSession = async () => {
    if (isProcessing || sessionStatus === 'completed') return

    // Confirm before ending
    if (
      !window.confirm(
        'Are you sure you want to end this brainstorm session? This action cannot be undone.'
      )
    ) {
      return
    }

    setIsProcessing(true)

    try {
      const response = await BrainstormSessionService.endSession({
        sessionId: session.id
      })

      if (response.success) {
        setSessionStatus('completed')
        // Update parent component if callback provided
        if (onSessionUpdated) {
          onSessionUpdated({ ...session, status: 'completed' })
        }
      }
    } catch (error) {
      console.error('Failed to end session:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  // Don't render controls if session is completed
  if (sessionStatus === 'completed') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="px-3 py-1.5 bg-neutral-100 rounded-lg">
          <p className="text-sm text-neutral-600">Session Ended</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Session Status Indicator */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-neutral-200">
        <div
          className={`w-2 h-2 rounded-full ${
            sessionStatus === 'active'
              ? 'bg-green-500 animate-pulse-subtle'
              : 'bg-amber-500'
          }`}
          aria-label={sessionStatus === 'active' ? 'Session active' : 'Session paused'}
        />
        <span className="text-sm font-medium text-neutral-700">
          {sessionStatus === 'active' ? 'Active' : 'Paused'}
        </span>
      </div>

      {/* Pause/Resume Button */}
      <Button
        onClick={handleTogglePause}
        variant="secondary"
        size="sm"
        icon={
          sessionStatus === 'active' ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )
        }
        disabled={isProcessing}
      >
        {sessionStatus === 'active' ? 'Pause' : 'Resume'}
      </Button>

      {/* End Session Button */}
      <Button
        onClick={handleEndSession}
        variant="error"
        size="sm"
        icon={<StopCircle className="w-4 h-4" />}
        disabled={isProcessing}
      >
        End Session
      </Button>
    </div>
  )
}
