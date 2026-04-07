/**
 * voteRepository unit tests
 *
 * Validates the dot-voting data layer:
 * - castVote success path
 * - castVote budget_exceeded mapping when RLS rejects (Postgres 42501)
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

import { castVote, countForUser, reconcileTallies } from '../voteRepository'
import { supabase } from '../../supabase'

const mockSupabase = supabase as unknown as { from: ReturnType<typeof vi.fn> }

function makeInsertChain(result: { error: unknown }) {
  const single = vi.fn().mockResolvedValue({ data: null, ...result })
  const select = vi.fn().mockReturnValue({ single })
  const insert = vi.fn().mockReturnValue({ select })
  return { from: vi.fn().mockReturnValue({ insert }), insert, select, single }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('voteRepository.castVote', () => {
  it('returns { ok: true } on successful insert', async () => {
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

  it('returns { ok: false, reason: "budget_exceeded" } when RLS rejects (42501)', async () => {
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

describe('voteRepository.reconcileTallies', () => {
  it('returns a Map keyed by idea_id with correct counts', async () => {
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
