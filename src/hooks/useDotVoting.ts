/**
 * useDotVoting — Phase 05.4a Wave 2, Unit 3
 *
 * Session-scope dot voting hook. Manages optimistic state with rollback,
 * 5-dot budget enforcement, postgres_changes fanout via ScopedRealtimeManager,
 * and reconnect reconciliation.
 *
 * Hook contract (frozen per D-01):
 *   { votesUsed, votesRemaining, tallies, myVotes, castVote, removeVote, reconcile, loading, error }
 *
 * Poirot Finding 4 closure: removeVote wraps voteRepository.removeVote in
 * try/catch and interprets VoteRepositoryError as a rollback trigger.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  castVote as repoCastVote,
  removeVote as repoRemoveVote,
  listVotesForSession,
  reconcileTallies,
  VoteRepositoryError,
} from '../lib/repositories/voteRepository'
import { logger } from '../utils/logger'
import type { ScopedRealtimeManager } from '../lib/realtime/ScopedRealtimeManager'
import type { ConnectionState } from '../lib/realtime/ScopedRealtimeManager'

const MAX_VOTES = 5
const ERROR_DISMISS_MS = 4000
const POLLING_INTERVAL_MS = 5000

// Error copy (UX §4 verbatim)
const COPY_BUDGET_FULL = "You've used all 5 votes. Remove one to cast another."
const COPY_CAST_FAILED = "Couldn't save your vote. Check your connection and try again."
const COPY_REMOVE_FAILED = "Couldn't remove your vote. Try again."

export interface UseDotVotingReturn {
  votesUsed: number
  votesRemaining: number
  tallies: ReadonlyMap<string, number>
  myVotes: ReadonlySet<string>
  castVote: (ideaId: string) => Promise<void>
  removeVote: (ideaId: string) => Promise<void>
  reconcile: () => Promise<void>
  loading: boolean
  error: string | null
}

type VotePayload = {
  new: Record<string, unknown>
  old: Record<string, unknown> | null
}

export function useDotVoting(
  sessionId: string,
  currentUserId: string,
  manager: ScopedRealtimeManager | null
): UseDotVotingReturn {
  const [tallies, setTallies] = useState<Map<string, number>>(new Map())
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set())
  const [votesUsed, setVotesUsed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Ref-based access to current state for use inside callbacks without stale closures
  const talliesRef = useRef(tallies)
  const myVotesRef = useRef(myVotes)
  const votesUsedRef = useRef(votesUsed)
  talliesRef.current = tallies
  myVotesRef.current = myVotes
  votesUsedRef.current = votesUsed

  // Track previous connection state to detect reconnecting → connected transition
  const prevConnectionStateRef = useRef<ConnectionState | null>(null)

  // Error dismiss timer
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearErrorTimer = useCallback(() => {
    if (errorTimerRef.current !== null) {
      clearTimeout(errorTimerRef.current)
      errorTimerRef.current = null
    }
  }, [])

  const setErrorWithDismiss = useCallback((msg: string) => {
    clearErrorTimer()
    setError(msg)
    errorTimerRef.current = setTimeout(() => {
      setError(null)
      errorTimerRef.current = null
    }, ERROR_DISMISS_MS)
  }, [clearErrorTimer])

  // ---------------------------------------------------------------------------
  // Reconcile: authoritative re-fetch from repository
  // ---------------------------------------------------------------------------
  const reconcile = useCallback(async (): Promise<void> => {
    try {
      const [newTallies, allVotes] = await Promise.all([
        reconcileTallies(sessionId),
        listVotesForSession(sessionId),
      ])

      const ownVotes = new Set(
        allVotes
          .filter((v) => v.user_id === currentUserId)
          .map((v) => v.idea_id)
      )

      setTallies(newTallies)
      setMyVotes(ownVotes)
      setVotesUsed(ownVotes.size)
    } catch (err) {
      logger.error('useDotVoting: reconcile failed', err)
    }
  }, [sessionId, currentUserId])

  // ---------------------------------------------------------------------------
  // postgres_changes event handler
  // ---------------------------------------------------------------------------
  const handleVoteEvent = useCallback((payload: VotePayload) => {
    const isInsert = payload.new && Object.keys(payload.new).length > 0 && payload.old === null
    const isDelete = !isInsert

    if (isInsert) {
      const row = payload.new
      const ideaId = row.idea_id as string
      const userId = row.user_id as string

      // D-13: dedup — skip if this is the own-user round-trip already counted optimistically
      if (userId === currentUserId && myVotesRef.current.has(ideaId)) {
        return
      }

      setTallies((prev) => {
        const next = new Map(prev)
        next.set(ideaId, (next.get(ideaId) ?? 0) + 1)
        return next
      })

      if (userId === currentUserId) {
        setMyVotes((prev) => new Set(prev).add(ideaId))
        setVotesUsed((prev) => prev + 1)
      }
    } else if (isDelete) {
      const row = payload.old
      if (!row) return
      const ideaId = row.idea_id as string
      const userId = row.user_id as string

      setTallies((prev) => {
        const next = new Map(prev)
        const current = next.get(ideaId) ?? 0
        if (current <= 1) {
          next.delete(ideaId)
        } else {
          next.set(ideaId, current - 1)
        }
        return next
      })

      if (userId === currentUserId) {
        setMyVotes((prev) => {
          const next = new Set(prev)
          next.delete(ideaId)
          return next
        })
        setVotesUsed((prev) => Math.max(0, prev - 1))
      }
    }
  }, [currentUserId])

  // ---------------------------------------------------------------------------
  // Mount: register listeners, initial reconcile
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!manager) return

    manager.onPostgresChange(
      'idea_votes',
      { event: '*', filter: `session_id=eq.${sessionId}` },
      (payload: VotePayload) => handleVoteEvent(payload)
    )

    const unsubStateChange = manager.onConnectionStateChange((state) => {
      const prev = prevConnectionStateRef.current
      if (prev === 'reconnecting' && state === 'connected') {
        void reconcile()
      }
      prevConnectionStateRef.current = state
    })

    const unsubPollingTick = manager.onPollingTick(() => {
      void reconcile()
    }, POLLING_INTERVAL_MS)

    // Initial reconcile
    void reconcile().finally(() => setLoading(false))

    return () => {
      unsubStateChange()
      unsubPollingTick()
      clearErrorTimer()
    }
  }, [manager, sessionId, handleVoteEvent, reconcile, clearErrorTimer])

  // ---------------------------------------------------------------------------
  // castVote: synchronous optimistic update + repo call + rollback
  // ---------------------------------------------------------------------------
  const castVote = useCallback(async (ideaId: string): Promise<void> => {
    // Synchronous budget check — uses ref for stale-closure safety in concurrent calls
    if (votesUsedRef.current >= MAX_VOTES) {
      setErrorWithDismiss(COPY_BUDGET_FULL)
      return
    }

    // Optimistic update (synchronous)
    const prevVotesUsed = votesUsedRef.current
    const prevMyVotes = new Set(myVotesRef.current)
    const prevTallies = new Map(talliesRef.current)

    setVotesUsed((prev) => prev + 1)
    votesUsedRef.current = prevVotesUsed + 1  // update ref immediately for race protection

    setMyVotes((prev) => new Set(prev).add(ideaId))
    setTallies((prev) => {
      const next = new Map(prev)
      next.set(ideaId, (next.get(ideaId) ?? 0) + 1)
      return next
    })

    try {
      const result = await repoCastVote(sessionId, ideaId)
      if (!result.ok) {
        // Rollback
        setVotesUsed(prevVotesUsed)
        votesUsedRef.current = prevVotesUsed
        setMyVotes(prevMyVotes)
        setTallies(prevTallies)

        if (result.reason === 'budget_exceeded') {
          setErrorWithDismiss(COPY_BUDGET_FULL)
        } else {
          setErrorWithDismiss(COPY_CAST_FAILED)
        }
      } else {
        clearErrorTimer()
        setError(null)
      }
    } catch (err) {
      // Rollback on unexpected exception
      setVotesUsed(prevVotesUsed)
      votesUsedRef.current = prevVotesUsed
      setMyVotes(prevMyVotes)
      setTallies(prevTallies)
      logger.error('useDotVoting: castVote exception', err)
      setErrorWithDismiss(COPY_CAST_FAILED)
    }
  }, [sessionId, setErrorWithDismiss, clearErrorTimer])

  // ---------------------------------------------------------------------------
  // removeVote: optimistic decrement + try/catch → rollback on VoteRepositoryError
  // ---------------------------------------------------------------------------
  const removeVote = useCallback(async (ideaId: string): Promise<void> => {
    // Optimistic update (synchronous)
    const prevVotesUsed = votesUsedRef.current
    const prevMyVotes = new Set(myVotesRef.current)
    const prevTallies = new Map(talliesRef.current)

    setVotesUsed((prev) => Math.max(0, prev - 1))
    setMyVotes((prev) => {
      const next = new Set(prev)
      next.delete(ideaId)
      return next
    })
    setTallies((prev) => {
      const next = new Map(prev)
      const current = next.get(ideaId) ?? 0
      if (current <= 1) {
        next.delete(ideaId)
      } else {
        next.set(ideaId, current - 1)
      }
      return next
    })

    try {
      await repoRemoveVote(sessionId, ideaId)
      clearErrorTimer()
      setError(null)
    } catch (err) {
      // Poirot Finding 4 closure: VoteRepositoryError triggers rollback
      if (err instanceof VoteRepositoryError) {
        setVotesUsed(prevVotesUsed)
        setMyVotes(prevMyVotes)
        setTallies(prevTallies)
        setErrorWithDismiss(COPY_REMOVE_FAILED)
      } else {
        // Unexpected error — still rollback
        setVotesUsed(prevVotesUsed)
        setMyVotes(prevMyVotes)
        setTallies(prevTallies)
        logger.error('useDotVoting: removeVote unexpected exception', err)
        setErrorWithDismiss(COPY_REMOVE_FAILED)
      }
    }
  }, [sessionId, setErrorWithDismiss, clearErrorTimer])

  const votesRemaining = MAX_VOTES - votesUsed

  return {
    votesUsed,
    votesRemaining,
    tallies,
    myVotes,
    castVote,
    removeVote,
    reconcile,
    loading,
    error,
  }
}
