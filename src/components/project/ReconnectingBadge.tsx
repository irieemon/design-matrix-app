/**
 * ReconnectingBadge — Phase 05.4b Wave 1, Unit 1.6
 *
 * Shows a graphite pill after 1.5s in reconnecting or polling states (D-24).
 * Recovery toast fires ONLY on reconnecting→connected transition (D-24, T-054B-076/077).
 * Polling→connected dismisses silently — no toast.
 *
 * Reads connectionState and previousConnectionState from ProjectRealtimeContext.
 */

import React, { useContext, useEffect, useRef, useState } from 'react'
import { Loader2, WifiOff, CheckCircle } from 'lucide-react'
import { ProjectRealtimeContext } from '../../contexts/ProjectRealtimeContext'
import type { ConnectionState } from '../../lib/realtime/ScopedRealtimeManager'

export interface ReconnectingBadgeProps {
  className?: string
}

const SHOW_DELAY_MS = 1500
const TOAST_DURATION_MS = 3000

function isDisconnected(state: ConnectionState): boolean {
  return state === 'reconnecting' || state === 'polling'
}

export function ReconnectingBadge({ className }: ReconnectingBadgeProps): React.ReactElement | null {
  const ctx = useContext(ProjectRealtimeContext)
  const connectionState = ctx?.connectionState ?? 'connected'
  const previousConnectionState = ctx?.previousConnectionState ?? null

  // Whether the badge should currently be visible (delayed by 1.5s).
  const [showBadge, setShowBadge] = useState(false)
  // Whether the recovery toast should be visible.
  const [showToast, setShowToast] = useState(false)

  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // D-24: Show badge after 1.5s of being disconnected; hide immediately on recovery.
  useEffect(() => {
    if (isDisconnected(connectionState)) {
      if (delayTimerRef.current === null) {
        delayTimerRef.current = setTimeout(() => {
          setShowBadge(true)
          delayTimerRef.current = null
        }, SHOW_DELAY_MS)
      }
    } else {
      // Connected (or connecting) — cancel pending delay and hide badge.
      if (delayTimerRef.current !== null) {
        clearTimeout(delayTimerRef.current)
        delayTimerRef.current = null
      }
      setShowBadge(false)
    }

    return () => {
      if (delayTimerRef.current !== null) {
        clearTimeout(delayTimerRef.current)
        delayTimerRef.current = null
      }
    }
  }, [connectionState])

  // D-24: Show recovery toast ONLY when transitioning reconnecting → connected.
  useEffect(() => {
    if (
      connectionState === 'connected' &&
      previousConnectionState === 'reconnecting'
    ) {
      setShowToast(true)
      if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => {
        setShowToast(false)
        toastTimerRef.current = null
      }, TOAST_DURATION_MS)
    }

    return () => {
      if (toastTimerRef.current !== null) {
        clearTimeout(toastTimerRef.current)
        // NOTE: we do NOT null the ref here to avoid stale-ref on fast unmount;
        // the timer callback ignores the result if component is unmounted.
      }
    }
  }, [connectionState, previousConnectionState])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current)
      if (delayTimerRef.current !== null) clearTimeout(delayTimerRef.current)
    }
  }, [])

  const isReconnecting = connectionState === 'reconnecting'

  return (
    <>
      {/* Disconnection badge — visible after 1.5s delay */}
      {showBadge && (
        <div
          role="status"
          aria-label={isReconnecting ? 'Reconnecting…' : 'Working offline. Updates may be delayed.'}
          aria-live="polite"
          className={[
            'fixed top-[72px] left-1/2 -translate-x-1/2 z-[200]',
            'flex items-center gap-2 px-4 py-2 rounded-full',
            'bg-graphite-700 text-white text-sm font-medium shadow-lg',
            'animate-slide-down',
            className ?? '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {isReconnecting ? (
            <>
              <Loader2
                data-testid="reconnecting-spinner"
                className="w-4 h-4 animate-spin"
                aria-hidden="true"
              />
              <span>Reconnecting…</span>
            </>
          ) : (
            <>
              <WifiOff
                data-testid="polling-wifi-off"
                className="w-4 h-4"
                aria-hidden="true"
              />
              <span>Working offline. Updates may be delayed.</span>
            </>
          )}
        </div>
      )}

      {/* Recovery toast — reconnecting → connected only (D-24) */}
      {showToast && (
        <div
          role="status"
          aria-label="Back online. Synced."
          aria-live="assertive"
          className={[
            'fixed bottom-6 left-1/2 -translate-x-1/2 z-[200]',
            'flex items-center gap-2 px-4 py-2 rounded-full',
            'bg-emerald-600 text-white text-sm font-medium shadow-lg',
            'animate-slide-up',
          ].join(' ')}
        >
          <CheckCircle className="w-4 h-4" aria-hidden="true" />
          <span>Back online. Synced.</span>
        </div>
      )}
    </>
  )
}

export default ReconnectingBadge
