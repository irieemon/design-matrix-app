import { supabase } from '../supabase'
import { logger } from '../../utils/logger'

/**
 * Vote Repository
 *
 * Handles all database operations for `idea_votes` (Phase 5 dot voting).
 * The 5-dot per-session budget is enforced at the database via an RLS
 * `with check` policy — see migration 20260408_phase5_collab_schema.sql.
 * Repository callers cannot bypass it.
 */

/**
 * Thrown by `removeVote` on any failure (auth missing, Supabase error, or
 * unexpected exception). Callers use this to trigger optimistic rollback.
 * D-07: castVote returns a discriminated union (expected business outcomes);
 * removeVote only fails on infrastructure errors, so throw is cleaner.
 */
export class VoteRepositoryError extends Error {
  override readonly name = 'VoteRepositoryError'
  readonly cause: unknown

  constructor(message: string, options?: { cause?: unknown }) {
    super(message)
    this.cause = options?.cause
    // Restores correct prototype chain for instanceof checks after transpilation.
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export type CastVoteResult =
  | { ok: true }
  | { ok: false; reason: 'budget_exceeded' | 'unauthorized' | 'unknown' }

export interface VoteRow {
  user_id: string
  idea_id: string
}

/**
 * Cast a single dot vote for the current user against an idea in a session.
 * Returns `{ ok: true }` on success or a discriminated failure reason.
 *
 * Budget enforcement: the RLS policy returns Postgres error code `42501`
 * when the user has already cast 5 votes in this session. We map that to
 * `budget_exceeded` so callers can render budget UI without trusting the
 * client-side counter.
 */
export async function castVote(
  sessionId: string,
  ideaId: string
): Promise<CastVoteResult> {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      logger.warn('castVote: no authenticated user')
      return { ok: false, reason: 'unauthorized' }
    }

    const { error } = await supabase
      .from('idea_votes')
      .insert({
        user_id: userData.user.id,
        idea_id: ideaId,
        session_id: sessionId,
      })
      .select()
      .single()

    if (error) {
      const code = (error as { code?: string }).code
      const message = (error.message || '').toLowerCase()
      if (code === '42501' || message.includes('with check') || message.includes('row-level security')) {
        logger.debug('castVote: budget exceeded (RLS rejected)', { sessionId, ideaId })
        return { ok: false, reason: 'budget_exceeded' }
      }
      logger.error('castVote failed', error)
      return { ok: false, reason: 'unknown' }
    }

    return { ok: true }
  } catch (error) {
    logger.error('castVote exception', error)
    return { ok: false, reason: 'unknown' }
  }
}

/**
 * Remove the current user's vote from an idea in a session.
 * Throws `VoteRepositoryError` on any failure so callers can roll back
 * optimistic state (D-03, D-07).
 */
export async function removeVote(sessionId: string, ideaId: string): Promise<void> {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      throw new VoteRepositoryError('removeVote: no authenticated user')
    }
    const { error } = await supabase
      .from('idea_votes')
      .delete()
      .eq('user_id', userData.user.id)
      .eq('session_id', sessionId)
      .eq('idea_id', ideaId)
    if (error) {
      logger.error('removeVote failed', error)
      throw new VoteRepositoryError(error.message ?? 'removeVote failed')
    }
  } catch (err) {
    if (err instanceof VoteRepositoryError) {
      throw err
    }
    logger.error('removeVote exception', err)
    throw new VoteRepositoryError('removeVote: unexpected error', { cause: err })
  }
}

/**
 * List all votes in a session (subject to RLS — only session participants
 * may read). Used by the tally subscriber's initial fetch.
 */
export async function listVotesForSession(sessionId: string): Promise<VoteRow[]> {
  try {
    const { data, error } = await supabase
      .from('idea_votes')
      .select('user_id, idea_id')
      .eq('session_id', sessionId)
    if (error) {
      logger.error('listVotesForSession failed', error)
      return []
    }
    return (data ?? []) as VoteRow[]
  } catch (error) {
    logger.error('listVotesForSession exception', error)
    return []
  }
}

/**
 * Count how many dots a single user has spent in a session.
 */
export async function countForUser(sessionId: string, userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('idea_votes')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('user_id', userId)
    if (error) {
      logger.error('countForUser failed', error)
      return 0
    }
    return count ?? 0
  } catch (error) {
    logger.error('countForUser exception', error)
    return 0
  }
}

/**
 * Reconnect-time reconciliation: fetch the authoritative tally for every
 * idea in a session and return as `Map<idea_id, count>`. Matches D-16
 * (reconcile authoritative state on reconnect) and the
 * "Vote tally with initial fetch + realtime delta" pattern in 05-RESEARCH.md.
 */
export async function reconcileTallies(sessionId: string): Promise<Map<string, number>> {
  const tallies = new Map<string, number>()
  try {
    const { data, error } = await supabase
      .from('idea_votes')
      .select('idea_id')
      .eq('session_id', sessionId)
    if (error) {
      logger.error('reconcileTallies failed', error)
      return tallies
    }
    for (const row of data ?? []) {
      const ideaId = (row as { idea_id: string }).idea_id
      tallies.set(ideaId, (tallies.get(ideaId) ?? 0) + 1)
    }
    return tallies
  } catch (error) {
    logger.error('reconcileTallies exception', error)
    return tallies
  }
}
