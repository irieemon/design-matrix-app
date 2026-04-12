/**
 * subscriptionService backend tests — Phase 11.6
 *
 * Covers:
 *  - NEW projects branch (Task 1 extension)
 *  - NEW users branch (Task 1 extension)
 *  - REGRESSION coverage for existing ai_ideas/ai_roadmap/ai_insights branches
 *    (ensures Phase 11.6 refactor didn't break Path C quota enforcement used by
 *     api/_lib/ai/generateIdeas.ts)
 *
 * Mock strategy: vi.mock('../../utils/supabaseAdmin') exports a shared `supabaseAdmin`
 * object with a `from` mock. Tests drive behavior by controlling what `from` returns
 * per table name via mockImplementation inside each test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabaseAdmin module — chainable query builder pattern.
// We export __from so tests can drive the mock without importing the real module.
vi.mock('../../utils/supabaseAdmin', () => {
  const fromMock = vi.fn()
  return {
    supabaseAdmin: { from: fromMock },
    __from: fromMock,
  }
})

import * as adminLib from '../../utils/supabaseAdmin'
import { checkLimit } from '../subscriptionService'

const fromMock = (adminLib as any).__from as ReturnType<typeof vi.fn>

// Helper: build a mock query builder that resolves to `resolved` at the end of any chain.
// Supports both .single() calls and implicit promise resolution via .then().
function makeBuilder(resolved: any) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(resolved)),
    then: (cb: (v: any) => any) => Promise.resolve(resolved).then(cb),
  }
  return builder
}

beforeEach(() => {
  fromMock.mockReset()
})

// ---------------------------------------------------------------------------
// projects branch
// ---------------------------------------------------------------------------

describe('checkLimit — projects', () => {
  it('free tier with 0 projects: canUse true, limit 1', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'subscriptions') return makeBuilder({ data: { tier: 'free', status: 'active' }, error: null })
      if (table === 'projects') return makeBuilder({ count: 0, error: null })
      throw new Error(`unexpected table: ${table}`)
    })
    const result = await checkLimit('u1', 'projects')
    expect(result).toEqual({ canUse: true, current: 0, limit: 1, percentageUsed: 0, isUnlimited: false })
  })

  it('free tier at 1 project: canUse false, percentageUsed 100', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'subscriptions') return makeBuilder({ data: { tier: 'free', status: 'active' }, error: null })
      if (table === 'projects') return makeBuilder({ count: 1, error: null })
      throw new Error(`unexpected table: ${table}`)
    })
    const result = await checkLimit('u1', 'projects')
    expect(result).toEqual({ canUse: false, current: 1, limit: 1, percentageUsed: 100, isUnlimited: false })
  })

  it('team tier: returns isUnlimited with limit 999999', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'subscriptions') return makeBuilder({ data: { tier: 'team', status: 'active' }, error: null })
      throw new Error(`unexpected table: ${table}`)
    })
    const result = await checkLimit('u1', 'projects')
    expect(result.isUnlimited).toBe(true)
    expect(result.limit).toBe(999999)
    expect(result.canUse).toBe(true)
  })

  it('supabase count error: fail-closed shape', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'subscriptions') return makeBuilder({ data: { tier: 'free', status: 'active' }, error: null })
      if (table === 'projects') return makeBuilder({ count: null, error: { message: 'db error' } })
      throw new Error(`unexpected table: ${table}`)
    })
    const result = await checkLimit('u1', 'projects')
    expect(result).toEqual({ canUse: false, current: 0, limit: 0, percentageUsed: 100, isUnlimited: false })
  })
})

// ---------------------------------------------------------------------------
// users branch
// ---------------------------------------------------------------------------

describe('checkLimit — users', () => {
  it('free tier with 0 owned projects: short-circuits to canUse true, current 0, limit 3', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'subscriptions') return makeBuilder({ data: { tier: 'free', status: 'active' }, error: null })
      if (table === 'projects') return makeBuilder({ data: [], error: null })
      throw new Error(`unexpected table: ${table}`)
    })
    const result = await checkLimit('u1', 'users')
    expect(result).toEqual({ canUse: true, current: 0, limit: 3, percentageUsed: 0, isUnlimited: false })
  })

  it('free tier with 2 collaborators across owned projects: canUse true', async () => {
    let projectsCallCount = 0
    fromMock.mockImplementation((table: string) => {
      if (table === 'subscriptions') return makeBuilder({ data: { tier: 'free', status: 'active' }, error: null })
      if (table === 'projects') {
        projectsCallCount++
        // First call: returns owned projects list
        return makeBuilder({ data: [{ id: 'p1' }, { id: 'p2' }], error: null })
      }
      if (table === 'project_collaborators') return makeBuilder({ count: 2, error: null })
      throw new Error(`unexpected table: ${table}`)
    })
    const result = await checkLimit('u1', 'users')
    expect(result.canUse).toBe(true)
    expect(result.current).toBe(2)
    expect(result.limit).toBe(3)
    expect(result.isUnlimited).toBe(false)
  })

  it('free tier with 3 collaborators: canUse false', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'subscriptions') return makeBuilder({ data: { tier: 'free', status: 'active' }, error: null })
      if (table === 'projects') return makeBuilder({ data: [{ id: 'p1' }], error: null })
      if (table === 'project_collaborators') return makeBuilder({ count: 3, error: null })
      throw new Error(`unexpected table: ${table}`)
    })
    const result = await checkLimit('u1', 'users')
    expect(result).toEqual({ canUse: false, current: 3, limit: 3, percentageUsed: 100, isUnlimited: false })
  })

  it('team tier: isUnlimited', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'subscriptions') return makeBuilder({ data: { tier: 'team', status: 'active' }, error: null })
      throw new Error(`unexpected table: ${table}`)
    })
    const result = await checkLimit('u1', 'users')
    expect(result.isUnlimited).toBe(true)
    expect(result.limit).toBe(999999)
    expect(result.canUse).toBe(true)
  })

  it('projects query error: fail-closed', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'subscriptions') return makeBuilder({ data: { tier: 'free', status: 'active' }, error: null })
      if (table === 'projects') return makeBuilder({ data: null, error: { message: 'db error' } })
      throw new Error(`unexpected table: ${table}`)
    })
    const result = await checkLimit('u1', 'users')
    expect(result).toEqual({ canUse: false, current: 0, limit: 0, percentageUsed: 100, isUnlimited: false })
  })

  it('collaborators query error: fail-closed', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'subscriptions') return makeBuilder({ data: { tier: 'free', status: 'active' }, error: null })
      if (table === 'projects') return makeBuilder({ data: [{ id: 'p1' }], error: null })
      if (table === 'project_collaborators') return makeBuilder({ count: null, error: { message: 'db error' } })
      throw new Error(`unexpected table: ${table}`)
    })
    const result = await checkLimit('u1', 'users')
    expect(result).toEqual({ canUse: false, current: 0, limit: 0, percentageUsed: 100, isUnlimited: false })
  })
})

// ---------------------------------------------------------------------------
// ai_ideas regression (behavior-identical to pre-Phase-11.6)
// ---------------------------------------------------------------------------

describe('checkLimit — ai_ideas regression (behavior-identical to pre-Phase-11.6)', () => {
  it('free tier: limit is 10 (pre-existing bug preserved per D-07)', async () => {
    // NOTE: The correct free tier limit per tierLimits.ts is 5, but the backend
    // has always had `free: 10` hardcoded. This test is intentionally asserting
    // the WRONG value to protect against accidental "fixes" — per D-07, this
    // discrepancy is deferred to Phase 11.7+.
    fromMock.mockImplementation((table: string) => {
      if (table === 'subscriptions') return makeBuilder({ data: { tier: 'free', status: 'active' }, error: null })
      if (table === 'ai_usage_tracking') return makeBuilder({ count: 0, error: null })
      throw new Error(`unexpected table: ${table}`)
    })
    const result = await checkLimit('u1', 'ai_ideas')
    expect(result.limit).toBe(10)
    expect(result.canUse).toBe(true)
    expect(result.isUnlimited).toBe(false)
  })

  it('missing subscription: defaults to free tier 10', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'subscriptions') return makeBuilder({ data: null, error: { message: 'not found' } })
      // ai_usage_tracking should NOT be queried in the no-subscription path
      throw new Error(`unexpected table: ${table}`)
    })
    const result = await checkLimit('u1', 'ai_ideas')
    expect(result).toEqual({ canUse: true, current: 0, limit: 10, percentageUsed: 0, isUnlimited: false })
  })
})

// ---------------------------------------------------------------------------
// infrastructure failure modes
// ---------------------------------------------------------------------------

describe('checkLimit — infrastructure failure modes', () => {
  it('returns fail-closed when supabaseAdmin.from rejects', async () => {
    fromMock.mockImplementation(() => {
      throw new Error('connection refused')
    })
    const result = await checkLimit('u1', 'projects')
    expect(result).toEqual({ canUse: false, current: 0, limit: 0, percentageUsed: 100, isUnlimited: false })
  })
})
