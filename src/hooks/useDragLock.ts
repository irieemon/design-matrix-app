/**
 * useDragLock — Phase 05.4b Wave 3, Unit 3.1
 *
 * Manages drag-lock state for collaborative matrix editing.
 * First-broadcast-wins (D-21b): if a card is already locally locked, remote
 * locks for that card are ignored.
 * Self-echo dedup (D-29): own userId broadcast echoes never overwrite local state.
 * Forged release guard (T-054B-220): drag_release from non-owner is ignored.
 * Auto-expire (T-054B-211): remote locks expire after 8s if no explicit release.
 * Timer leak prevention (T-054B-214): explicit release clears the auto-expire timer.
 * Stale closure guard (T-054B-215): useEffect re-registers handlers when currentUserId changes.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { ScopedRealtimeManager } from '../lib/realtime/ScopedRealtimeManager'

const LOCK_EXPIRE_MS = 8000

export interface LockEntry {
  userId: string
  displayName: string
  acquiredAt: number
}

export interface UseDragLockOptions {
  manager: ScopedRealtimeManager | null
  currentUserId: string
  currentUserDisplayName: string
}

export interface UseDragLockReturn {
  lockedCards: Map<string, LockEntry>
  acquire: (ideaId: string) => boolean
  release: (ideaId: string) => void
  isLockedByOther: (ideaId: string) => boolean
}

type DragLockPayload = { userId: string; ideaId: string; displayName: string }
type DragReleasePayload = { userId: string; ideaId: string }

export function useDragLock({
  manager,
  currentUserId,
  currentUserDisplayName,
}: UseDragLockOptions): UseDragLockReturn {
  const [lockedCards, setLockedCards] = useState<Map<string, LockEntry>>(
    () => new Map()
  )

  // Per-card auto-expire timers — keyed by ideaId.
  const expireTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  )

  // Stable refs so handler closures always see current values (T-054B-215).
  const currentUserIdRef = useRef(currentUserId)
  useEffect(() => { currentUserIdRef.current = currentUserId }, [currentUserId])

  const currentUserDisplayNameRef = useRef(currentUserDisplayName)
  useEffect(() => {
    currentUserDisplayNameRef.current = currentUserDisplayName
  }, [currentUserDisplayName])

  const managerRef = useRef(manager)
  useEffect(() => { managerRef.current = manager }, [manager])

  // ---------------------------------------------------------------------------
  // Timer helpers
  // ---------------------------------------------------------------------------

  const clearExpireTimer = useCallback((ideaId: string) => {
    const handle = expireTimers.current.get(ideaId)
    if (handle !== undefined) {
      clearTimeout(handle)
      expireTimers.current.delete(ideaId)
    }
  }, [])

  const scheduleExpire = useCallback(
    (ideaId: string) => {
      clearExpireTimer(ideaId)
      const handle = setTimeout(() => {
        expireTimers.current.delete(ideaId)
        setLockedCards((prev) => {
          const next = new Map(prev)
          next.delete(ideaId)
          return next
        })
      }, LOCK_EXPIRE_MS)
      expireTimers.current.set(ideaId, handle)
    },
    [clearExpireTimer]
  )

  // ---------------------------------------------------------------------------
  // Register broadcast handlers — re-run when currentUserId changes (T-054B-215)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!manager) return

    const unsubLock = manager.onBroadcast<DragLockPayload>(
      'drag_lock',
      (payload) => {
        const { userId, ideaId, displayName } = payload
        const uid = currentUserIdRef.current

        // D-29: Self-echo — own broadcast echoes back; do not overwrite local state.
        if (userId === uid) return

        let didUpdate = false
        setLockedCards((prev) => {
          // D-21b: First-broadcast-wins — if already locked (by self or another), ignore.
          if (prev.has(ideaId)) return prev
          const next = new Map(prev)
          next.set(ideaId, { userId, displayName, acquiredAt: Date.now() })
          didUpdate = true
          return next
        })

        // Only reset the 8s expiry timer when the entry was actually added.
        // Calling scheduleExpire on every re-broadcast would delay expiry indefinitely.
        if (didUpdate) scheduleExpire(ideaId)
      }
    )

    const unsubRelease = manager.onBroadcast<DragReleasePayload>(
      'drag_release',
      (payload) => {
        const { userId, ideaId } = payload

        setLockedCards((prev) => {
          // T-054B-220: Forged release guard — only the owner can release.
          const entry = prev.get(ideaId)
          if (!entry || entry.userId !== userId) return prev
          const next = new Map(prev)
          next.delete(ideaId)
          return next
        })

        // T-054B-214: Clear auto-expire timer on explicit release.
        clearExpireTimer(ideaId)
      }
    )

    return () => {
      unsubLock()
      unsubRelease()
    }
    // currentUserId in deps ensures re-registration when userId changes (T-054B-215).
  }, [manager, currentUserId, scheduleExpire, clearExpireTimer])

  // ---------------------------------------------------------------------------
  // Cleanup all timers on unmount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      for (const handle of expireTimers.current.values()) {
        clearTimeout(handle)
      }
      expireTimers.current.clear()
    }
  }, [])

  // We need synchronous reads of lockedCards in acquire() and isLockedByOther().
  // React state reads inside callbacks can be stale, so mirror state in a ref.
  const lockedCardsRef = useRef<Map<string, LockEntry>>(new Map())
  lockedCardsRef.current = lockedCards

  const acquireImpl = useCallback(
    (ideaId: string): boolean => {
      const uid = currentUserIdRef.current
      const displayName = currentUserDisplayNameRef.current
      const current = lockedCardsRef.current.get(ideaId)

      if (current) {
        // Already locked by other → reject
        if (current.userId !== uid) return false
        // Already locked by self (idempotent) → accept without re-broadcasting
        return true
      }

      // Set locally first for optimistic consistency
      setLockedCards((prev) => {
        // Double-check inside updater in case of concurrent calls
        if (prev.has(ideaId)) return prev
        const next = new Map(prev)
        next.set(ideaId, { userId: uid, displayName, acquiredAt: Date.now() })
        return next
      })

      managerRef.current?.sendBroadcast('drag_lock', {
        userId: uid,
        ideaId,
        displayName,
      })

      return true
    },
    []
  )

  // ---------------------------------------------------------------------------
  // release
  // ---------------------------------------------------------------------------

  const release = useCallback((ideaId: string): void => {
    const uid = currentUserIdRef.current

    setLockedCards((prev) => {
      const entry = prev.get(ideaId)
      // Only owner can release their own lock locally
      if (!entry || entry.userId !== uid) return prev
      const next = new Map(prev)
      next.delete(ideaId)
      return next
    })

    // T-054B-214: Clear auto-expire timer to prevent leak.
    clearExpireTimer(ideaId)

    managerRef.current?.sendBroadcast('drag_release', {
      userId: uid,
      ideaId,
    })
  }, [clearExpireTimer])

  // ---------------------------------------------------------------------------
  // isLockedByOther
  // ---------------------------------------------------------------------------

  const isLockedByOther = useCallback((ideaId: string): boolean => {
    const entry = lockedCardsRef.current.get(ideaId)
    if (!entry) return false
    return entry.userId !== currentUserIdRef.current
  }, [])

  return {
    lockedCards,
    acquire: acquireImpl,
    release,
    isLockedByOther,
  }
}
