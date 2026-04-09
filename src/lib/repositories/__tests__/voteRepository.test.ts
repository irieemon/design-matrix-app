/**
 * voteRepository unit tests
 *
 * Validates the dot-voting data layer:
 * - castVote success path
 * - castVote budget_exceeded mapping when RLS rejects (Postgres 42501)
 * - removeVote success path (returns void, no throw)
 * - removeVote throws VoteRepositoryError on Supabase error (D-07)
 * - removeVote throws VoteRepositoryError when unauthenticated (D-07)
 * - removeVote wraps unexpected exceptions in VoteRepositoryError (D-07)
 * - countForUser arithmetic
 * - reconcileTallies aggregation into Map<idea_id, count>
 *
 * The 5-dot budget itself is enforced by RLS in the migration; these tests
 * confirm the repository correctly surfaces RLS rejection to callers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
    },
  }
})

vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { castVote, removeVote, countForUser, reconcileTallies, VoteRepositoryError } from '../voteRepository'
import { supabase } from '../../supabase'

const mockSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>
  auth: { getUser: ReturnType<typeof vi.fn> }
}

function makeInsertChain(result: { error: unknown }) {
  const single = vi.fn().mockResolvedValue({ data: null, ...result })
  const select = vi.fn().mockReturnValue({ single })
  const insert = vi.fn().mockReturnValue({ select })
  return { from: vi.fn().mockReturnValue({ insert }), insert, select, single }
}

function makeDeleteChain(result: { error: unknown }) {
  const eq3 = vi.fn().mockResolvedValue(result)
  const eq2 = vi.fn().mockReturnValue({ eq: eq3 })
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 })
  const del = vi.fn().mockReturnValue({ eq: eq1 })
  return { from: vi.fn().mockReturnValue({ delete: del }), delete: del, eq1, eq2, eq3 }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  })
})

// T-054A-001
describe('voteRepository.removeVote', () => {
  it('T-054A-001: resolves on success without throwing', async () => {
    const chain = makeDeleteChain({ error: null })
    mockSupabase.from.mockImplementation(chain.from)

    await expect(removeVote('s1', 'i1')).resolves.toBeUndefined()
  })

  // T-054A-002
  it('T-054A-002: throws VoteRepositoryError on supabase error', async () => {
    const chain = makeDeleteChain({ error: { message: 'rls denied', code: '42501' } })
    mockSupabase.from.mockImplementation(chain.from)

    await expect(removeVote('s1', 'i1')).rejects.toThrow(VoteRepositoryError)

    let thrown: unknown
    try {
      await removeVote('s1', 'i1')
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(VoteRepositoryError)
    expect((thrown as VoteRepositoryError).message).toContain('rls denied')
  })

  // T-054A-003
  it('T-054A-003: throws VoteRepositoryError with auth message when no authenticated user', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    let thrown: unknown
    try {
      await removeVote('s1', 'i1')
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(VoteRepositoryError)
    expect((thrown as VoteRepositoryError).message).toBe('removeVote: no authenticated user')
  })

  // T-054A-004
  it('T-054A-004: wraps unexpected exceptions in VoteRepositoryError with cause', async () => {
    const networkError = new Error('network')
    mockSupabase.auth.getUser.mockRejectedValue(networkError)

    let thrown: unknown
    try {
      await removeVote('s1', 'i1')
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(VoteRepositoryError)
    expect((thrown as VoteRepositoryError).cause).toBe(networkError)
  })
})

// T-054A-005, T-054A-006 — castVote regression
describe('voteRepository.castVote', () => {
  it('T-054A-005: returns { ok: true } on successful insert', async () => {
    const chain = makeInsertChain({ error: null })
    mockSupabase.from.mockImplementation(chain.from)

    const result = await castVote('session-1', 'idea-1')
    expect(result).toEqual({ ok: true })
    expect(chain.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      idea_id: 'idea-1',
      session_id: 'session-1',
    })
  })

  it('T-054A-006: returns { ok: false, reason: "budget_exceeded" } when RLS rejects (42501)', async () => {
    const chain = makeInsertChain({
      error: { code: '42501', message: 'new row violates row-level security policy' },
    })
    mockSupabase.from.mockImplementation(chain.from)

    const result = await castVote('session-1', 'idea-1')
    expect(result).toEqual({ ok: false, reason: 'budget_exceeded' })
  })
})

describe('voteRepository.countForUser', () => {
  it('returns the count returned by Supabase', async () => {
    const eq2 = vi.fn().mockResolvedValue({ count: 3, error: null })
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 })
    const select = vi.fn().mockReturnValue({ eq: eq1 })
    mockSupabase.from.mockReturnValue({ select })

    const n = await countForUser('session-1', 'user-1')
    expect(n).toBe(3)
    expect(select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
  })
})

// T-054A-007
describe('voteRepository.reconcileTallies', () => {
  it('T-054A-007: returns a Map keyed by idea_id with correct counts', async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [
        { idea_id: 'a' },
        { idea_id: 'a' },
        { idea_id: 'b' },
        { idea_id: 'c' },
        { idea_id: 'a' },
      ],
      error: null,
    })
    const select = vi.fn().mockReturnValue({ eq })
    mockSupabase.from.mockReturnValue({ select })

    const tallies = await reconcileTallies('session-1')
    expect(tallies.get('a')).toBe(3)
    expect(tallies.get('b')).toBe(1)
    expect(tallies.get('c')).toBe(1)
    expect(tallies.size).toBe(3)
  })
})

describe('VoteRepositoryError', () => {
  it('has name === "VoteRepositoryError"', () => {
    const err = new VoteRepositoryError('test')
    expect(err.name).toBe('VoteRepositoryError')
    expect(err).toBeInstanceOf(Error)
  })

  it('accepts optional cause', () => {
    const cause = new Error('root')
    const err = new VoteRepositoryError('wrapped', { cause })
    expect(err.cause).toBe(cause)
  })
})
