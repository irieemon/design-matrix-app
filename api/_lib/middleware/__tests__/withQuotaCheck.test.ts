/**
 * withQuotaCheck middleware tests — Phase 06-02
 *
 * Asserts:
 *  - 401 on missing token
 *  - 402 quota_exceeded on over-limit
 *  - 500 QUOTA_CHECK_FAILED on any subscriptionService throw (fail-closed BILL-03)
 *  - handler invoked + req.quota attached when allowed
 *  - incrementAiUsage called AFTER successful ai_ideas mutation, NEVER before
 *  - increment skipped for non-ai_ideas resources
 *  - increment failure swallowed
 *  - admin client passed into every subscriptionService call
 *  - subscriptionService singleton path is never invoked during a middleware request
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@supabase/supabase-js', () => {
  const getUser = vi.fn()
  const admin = { auth: { getUser }, __isAdmin: true }
  return {
    createClient: vi.fn(() => admin),
    __admin: admin,
    __getUser: getUser,
  }
})

vi.mock('../../../../src/lib/services/subscriptionService', () => {
  class FakeSubscriptionCheckError extends Error {
    constructor(public reason: string) {
      super(reason)
      this.name = 'SubscriptionCheckError'
    }
  }
  const getSubscription = vi.fn()
  const checkLimit = vi.fn()
  const incrementAiUsage = vi.fn()
  return {
    subscriptionService: { getSubscription, checkLimit, incrementAiUsage },
    SubscriptionCheckError: FakeSubscriptionCheckError,
    __getSubscription: getSubscription,
    __checkLimit: checkLimit,
    __incrementAiUsage: incrementAiUsage,
  }
})

import * as supabaseLib from '@supabase/supabase-js'
import * as svcLib from '../../../../src/lib/services/subscriptionService'
import { withQuotaCheck } from '../withQuotaCheck'

const adminClient = (supabaseLib as any).__admin
const getUserMock = (supabaseLib as any).__getUser as ReturnType<typeof vi.fn>
const getSubscriptionMock = (svcLib as any).__getSubscription as ReturnType<typeof vi.fn>
const checkLimitMock = (svcLib as any).__checkLimit as ReturnType<typeof vi.fn>
const incrementAiUsageMock = (svcLib as any).__incrementAiUsage as ReturnType<typeof vi.fn>
const FakeSubscriptionCheckError = (svcLib as any).SubscriptionCheckError

function makeReq(opts: { token?: string | null } = {}) {
  const headers: Record<string, string> = {}
  if (opts.token) headers.authorization = `Bearer ${opts.token}`
  return { headers, method: 'POST', body: {} } as any
}

function makeRes() {
  const res: any = { statusCode: 200 }
  res.status = vi.fn((code: number) => {
    res.statusCode = code
    return res
  })
  res.json = vi.fn((body: any) => {
    res.body = body
    return res
  })
  return res
}

beforeEach(() => {
  getUserMock.mockReset()
  getSubscriptionMock.mockReset()
  checkLimitMock.mockReset()
  incrementAiUsageMock.mockReset()
  process.env.SUPABASE_URL = 'https://x.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  getSubscriptionMock.mockResolvedValue({ tier: 'free' })
  incrementAiUsageMock.mockResolvedValue(1)
})

describe('withQuotaCheck', () => {
  it('returns 401 when no bearer token is present', async () => {
    const handler = vi.fn()
    const wrapped = withQuotaCheck('ai_ideas', handler)
    const res = makeRes()
    await wrapped(makeReq(), res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('returns 402 quota_exceeded when checkLimit.canUse is false', async () => {
    checkLimitMock.mockResolvedValue({ canUse: false, current: 5, limit: 5, isUnlimited: false, percentageUsed: 100 })
    const handler = vi.fn()
    const wrapped = withQuotaCheck('ai_ideas', handler)
    const res = makeRes()
    await wrapped(makeReq({ token: 't' }), res)
    expect(res.status).toHaveBeenCalledWith(402)
    expect(res.body.error.code).toBe('quota_exceeded')
    expect(res.body.error.resource).toBe('ai_ideas')
    expect(res.body.error.limit).toBe(5)
    expect(res.body.error.used).toBe(5)
    expect(res.body.error.tier).toBe('free')
    expect(res.body.error.upgradeUrl).toBe('/pricing')
    expect(handler).not.toHaveBeenCalled()
    expect(incrementAiUsageMock).not.toHaveBeenCalled()
  })

  it('returns 500 QUOTA_CHECK_FAILED when checkLimit throws (fail-closed)', async () => {
    checkLimitMock.mockRejectedValue(new FakeSubscriptionCheckError('rpc_failed'))
    const handler = vi.fn()
    const wrapped = withQuotaCheck('ai_ideas', handler)
    const res = makeRes()
    await wrapped(makeReq({ token: 't' }), res)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.body.error.code).toBe('QUOTA_CHECK_FAILED')
    expect(handler).not.toHaveBeenCalled()
  })

  it('returns 500 when getSubscription throws (fail-closed)', async () => {
    getSubscriptionMock.mockRejectedValue(new FakeSubscriptionCheckError('boom'))
    const handler = vi.fn()
    const wrapped = withQuotaCheck('ai_ideas', handler)
    const res = makeRes()
    await wrapped(makeReq({ token: 't' }), res)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.body.error.code).toBe('QUOTA_CHECK_FAILED')
  })

  it('invokes handler and attaches req.quota when allowed', async () => {
    checkLimitMock.mockResolvedValue({ canUse: true, current: 1, limit: 5, isUnlimited: false, percentageUsed: 20 })
    const handler = vi.fn(async (req: any, res: any) => {
      expect(req.quota).toEqual({ userId: 'u1', tier: 'free', limit: 5, used: 1, isUnlimited: false })
      return res.status(200).json({ ok: true })
    })
    const wrapped = withQuotaCheck('ai_ideas', handler)
    const res = makeRes()
    await wrapped(makeReq({ token: 't' }), res)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('calls incrementAiUsage AFTER a successful ai_ideas mutation (D-12)', async () => {
    checkLimitMock.mockResolvedValue({ canUse: true, current: 1, limit: 5, isUnlimited: false, percentageUsed: 20 })
    const callOrder: string[] = []
    incrementAiUsageMock.mockImplementation(() => {
      callOrder.push('increment')
      return Promise.resolve(2)
    })
    const handler = vi.fn(async (_req: any, res: any) => {
      callOrder.push('handler')
      return res.status(200).json({ ok: true })
    })
    const wrapped = withQuotaCheck('ai_ideas', handler)
    await wrapped(makeReq({ token: 't' }), makeRes())
    // wait microtask for catch chain
    await new Promise((r) => setImmediate(r))
    expect(callOrder).toEqual(['handler', 'increment'])
    expect(incrementAiUsageMock).toHaveBeenCalledWith('u1', adminClient)
  })

  it('does NOT call incrementAiUsage for projects resource', async () => {
    checkLimitMock.mockResolvedValue({ canUse: true, current: 0, limit: 1, isUnlimited: false, percentageUsed: 0 })
    const handler = vi.fn(async (_req: any, res: any) => res.status(200).json({ ok: true }))
    const wrapped = withQuotaCheck('projects', handler)
    await wrapped(makeReq({ token: 't' }), makeRes())
    expect(incrementAiUsageMock).not.toHaveBeenCalled()
  })

  it('does NOT increment when handler returns >=400', async () => {
    checkLimitMock.mockResolvedValue({ canUse: true, current: 1, limit: 5, isUnlimited: false, percentageUsed: 20 })
    const handler = vi.fn(async (_req: any, res: any) => res.status(500).json({ error: 'oops' }))
    const wrapped = withQuotaCheck('ai_ideas', handler)
    await wrapped(makeReq({ token: 't' }), makeRes())
    expect(incrementAiUsageMock).not.toHaveBeenCalled()
  })

  it('swallows incrementAiUsage failures (best-effort)', async () => {
    checkLimitMock.mockResolvedValue({ canUse: true, current: 1, limit: 5, isUnlimited: false, percentageUsed: 20 })
    incrementAiUsageMock.mockRejectedValue(new Error('rpc down'))
    const handler = vi.fn(async (_req: any, res: any) => res.status(200).json({ ok: true }))
    const wrapped = withQuotaCheck('ai_ideas', handler)
    const res = makeRes()
    await expect(wrapped(makeReq({ token: 't' }), res)).resolves.not.toThrow()
    await new Promise((r) => setImmediate(r))
    expect(res.statusCode).toBe(200)
  })

  it('passes the admin client to every subscriptionService call', async () => {
    checkLimitMock.mockResolvedValue({ canUse: true, current: 1, limit: 5, isUnlimited: false, percentageUsed: 20 })
    const handler = vi.fn(async (_req: any, res: any) => res.status(200).json({ ok: true }))
    const wrapped = withQuotaCheck('ai_ideas', handler)
    await wrapped(makeReq({ token: 't' }), makeRes())
    await new Promise((r) => setImmediate(r))
    expect(getSubscriptionMock).toHaveBeenCalledWith('u1', adminClient)
    expect(checkLimitMock).toHaveBeenCalledWith('u1', 'ai_ideas', adminClient)
    expect(incrementAiUsageMock).toHaveBeenCalledWith('u1', adminClient)
  })

  it('returns 401 when adminClient.auth.getUser reports invalid token', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } })
    const handler = vi.fn()
    const wrapped = withQuotaCheck('ai_ideas', handler)
    const res = makeRes()
    await wrapped(makeReq({ token: 'bad' }), res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(handler).not.toHaveBeenCalled()
  })
})
