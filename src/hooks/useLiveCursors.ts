/**
 * useLiveCursors — Phase 05.4b Wave 2, Unit 2.2
 *
 * Manages the live cursor state for all remote users on the project matrix.
 *
 * Responsibilities:
 *   - Register a `cursor_move` broadcast handler via manager.onBroadcast.
 *   - Filter self-cursor (payload.userId === currentUserId).
 *   - Maintain a cursors Map<userId, CursorState>.
 *   - Enforce 8-cursor cap by evicting the entry with the oldest lastSeenAt.
 *   - Per-cursor 5s inactivity timer — reset on each received broadcast for
 *     that user; when it fires, delete the cursor entry from state.
 *   - attachPointerTracking(el): attach pointermove → compute logical %
 *     coordinates → throttle → sendBroadcast. Returns a detach function.
 *   - pauseBroadcast / resumeBroadcast for drag integration (Wave 3).
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { ScopedRealtimeManager } from '../lib/realtime/ScopedRealtimeManager'
import { userIdToHsl } from '../utils/userColor'
import { throttleByFrameInterval } from '../utils/cursorThrottle'
import type { CursorState } from '../contexts/ProjectRealtimeContext'

const CURSOR_CAP = 8
const INACTIVITY_MS = 5000
const BROADCAST_THROTTLE_MS = 50

export interface UseLiveCursorsOptions {
  manager: ScopedRealtimeManager | null
  currentUserId: string
  currentUserDisplayName: string
}

export interface UseLiveCursorsReturn {
  cursors: Map<string, CursorState>
  /** Attach pointermove tracking to a matrix container element. Returns a detach fn. */
  attachPointerTracking: (el: HTMLElement | null) => () => void
  /** Pause cursor broadcasts (called during drag). */
  pauseBroadcast: () => void
  /** Resume cursor broadcasts (called after drag end). */
  resumeBroadcast: () => void
}

type CursorPayload = {
  userId: string
  x: number
  y: number
  displayName: string
}

export function useLiveCursors({
  manager,
  currentUserId,
  currentUserDisplayName,
}: UseLiveCursorsOptions): UseLiveCursorsReturn {
  const [cursors, setCursors] = useState<Map<string, CursorState>>(new Map())

  // Per-cursor inactivity timers — keyed by userId.
  const inactivityTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Pause flag — when true, outbound broadcasts are no-ops.
  const isPausedRef = useRef(false)

  // Stable ref to currentUserId so the broadcast handler closure stays fresh.
  const currentUserIdRef = useRef(currentUserId)
  useEffect(() => { currentUserIdRef.current = currentUserId })

  const currentUserDisplayNameRef = useRef(currentUserDisplayName)
  useEffect(() => { currentUserDisplayNameRef.current = currentUserDisplayName })

  // Manager ref for stable sendBroadcast access in the pointer handler.
  const managerRef = useRef(manager)
  useEffect(() => { managerRef.current = manager })

  // ---------------------------------------------------------------------------
  // Inactivity timer helpers
  // ---------------------------------------------------------------------------

  const clearInactivityTimer = useCallback((userId: string) => {
    const existing = inactivityTimers.current.get(userId)
    if (existing !== undefined) {
      clearTimeout(existing)
      inactivityTimers.current.delete(userId)
    }
  }, [])

  const resetInactivityTimer = useCallback((userId: string) => {
    clearInactivityTimer(userId)
    const timer = setTimeout(() => {
      inactivityTimers.current.delete(userId)
      setCursors((prev) => {
        const next = new Map(prev)
        next.delete(userId)
        return next
      })
    }, INACTIVITY_MS)
    inactivityTimers.current.set(userId, timer)
  }, [clearInactivityTimer])

  // ---------------------------------------------------------------------------
  // Register broadcast handler
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!manager) return

    const unsubscribe = manager.onBroadcast<CursorPayload>('cursor_move', (payload) => {
      const { userId, x, y, displayName } = payload

      // Filter self-cursor — self echoes arrive because ScopedRealtimeManager
      // sets broadcast: { self: true }. We must drop them here.
      if (userId === currentUserIdRef.current) return

      resetInactivityTimer(userId)

      setCursors((prev) => {
        const next = new Map(prev)
        next.set(userId, {
          x,
          y,
          displayName,
          color: userIdToHsl(userId),
          lastSeenAt: Date.now(),
        })

        // Enforce 8-cursor cap: evict the entry with the oldest lastSeenAt.
        if (next.size > CURSOR_CAP) {
          let oldestUserId = ''
          let oldestTime = Infinity
          for (const [uid, state] of next) {
            if (state.lastSeenAt < oldestTime) {
              oldestTime = state.lastSeenAt
              oldestUserId = uid
            }
          }
          if (oldestUserId) next.delete(oldestUserId)
        }

        return next
      })
    })

    return () => {
      unsubscribe()
      // Clear all inactivity timers on unmount.
      for (const timer of inactivityTimers.current.values()) {
        clearTimeout(timer)
      }
      inactivityTimers.current.clear()
    }
  }, [manager, resetInactivityTimer])

  // ---------------------------------------------------------------------------
  // attachPointerTracking
  // ---------------------------------------------------------------------------

  const attachPointerTracking = useCallback(
    (el: HTMLElement | null): (() => void) => {
      if (!el) return () => undefined

      const throttledBroadcast = throttleByFrameInterval(
        (payload: CursorPayload) => {
          if (!isPausedRef.current && managerRef.current) {
            managerRef.current.sendBroadcast('cursor_move', payload)
          }
        },
        BROADCAST_THROTTLE_MS
      )

      const handlePointerMove = (e: Event) => {
        const evt = e as PointerEvent
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return

        const x = ((evt.clientX - rect.left) / rect.width) * 100
        const y = ((evt.clientY - rect.top) / rect.height) * 100

        throttledBroadcast({
          userId: currentUserIdRef.current,
          x,
          y,
          displayName: currentUserDisplayNameRef.current,
        })
      }

      el.addEventListener('pointermove', handlePointerMove)

      return () => {
        el.removeEventListener('pointermove', handlePointerMove)
      }
    },
    []
  )

  // ---------------------------------------------------------------------------
  // Pause / resume
  // ---------------------------------------------------------------------------

  const pauseBroadcast = useCallback(() => {
    isPausedRef.current = true
  }, [])

  const resumeBroadcast = useCallback(() => {
    isPausedRef.current = false
  }, [])

  return { cursors, attachPointerTracking, pauseBroadcast, resumeBroadcast }
}
