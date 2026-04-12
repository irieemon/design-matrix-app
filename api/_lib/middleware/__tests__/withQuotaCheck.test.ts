/**
 * withQuotaCheck middleware tests — Phase 11.6 rewire
 *
 * Asserts:
 *  - 401 on missing token
 *  - 401 on invalid token
 *  - 402 quota_exceeded when checkLimit returns canUse:false (projects + users)
 *  - 402 when checkLimit returns fail-closed shape (current=0, limit=0)
 *  - 500 QUOTA_CHECK_FAILED when supabaseAdmin is null
 *  - handler invoked + req.quota attached when allowed (projects + users)
 *  - checkLimit called with correct (userId, resource) pair
 *
 * Mock strategy:
 *  - supabaseAdmin mocked via vi.mock('../../utils/supabaseAdmin') — avoids
 *    importing @supabase/supabase-js at test scope and matches how the rewritten
 *    middleware sources its admin client (direct import, not createClient call).
 *  - subscriptionService mocked via vi.mock('../../services/subscriptionService') —
 *    the rewritten middleware imports checkLimit from there directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../utils/supabaseAdmin', () => {
  const getUser = vi.fn()
  const admin = { auth: { getUser } }
  return {
    supabaseAdmin: admin,
    __admin: admin,
    __getUser: getUser,
  }
})

vi.mock('../../services/subscriptionService', () => {
  const checkLimit = vi.fn()
  return {
    checkLimit,
    __checkLimit: checkLimit,
  }
})

import * as adminLib from '../../utils/supabaseAdmin'
import * as svcLib from '../../services/subscriptionService'
import { withQuotaCheck } from '../withQuotaCheck'

const adminClient = (adminLib as any).__admin
const getUserMock = (adminLib as any).__getUser as ReturnType<typeof vi.fn>
const checkLimitMock = (svcLib as any).__checkLimit as ReturnType<typeof vi.fn>

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
  checkLimitMock.mockReset()
  getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  // env vars not strictly needed since supabaseAdmin is mocked, but kept for safety
  process.env.SUPABASE_URL = 'https://x.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
})

describe('withQuotaCheck', () => {
  it('returns 401 when no bearer token is present', async () => {
    const handler = vi.fn()
    const wrapped = withQuotaCheck('projects', handler)
    const res = makeRes()
    await wrapped(makeReq(), res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('returns 401 when adminClient.auth.getUser reports invalid token', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } })
    const handler = vi.fn()
    const wrapped = withQuotaCheck('projects', handler)
    const res = makeRes()
    await wrapped(makeReq({ token: 'bad' }), res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('returns 402 quota_exceeded when checkLimit.canUse is false for projects', async () => {
    checkLimitMock.mockResolvedValue({ canUse: false, current: 1, limit: 1, isUnlimited: false, percentageUsed: 100 })
    const handler = vi.fn()
    const wrapped = withQuotaCheck('projects', handler)
    const res = makeRes()
    await wrapped(makeReq({ token: 't' }), res)
    expect(res.status).toHaveBeenCalledWith(402)
    expect(res.body.error.code).toBe('quota_exceeded')
    expect(res.body.error.resource).toBe('projects')
    expect(res.body.error.limit).toBe(1)
    expect(res.body.error.used).toBe(1)
    expect(res.body.error.upgradeUrl).toBe('/pricing')
    expect(handler).not.toHaveBeenCalled()
  })

  it('returns 402 when checkLimit returns fail-closed shape (current=0, limit=0)', async () => {
    checkLimitMock.mockResolvedValue({ canUse: false, current: 0, limit: 0, percentageUsed: 100, isUnlimited: false })
    const handler = vi.fn()
    const wrapped = withQuotaCheck('projects', handler)
    const res = makeRes()
    await wrapped(makeReq({ token: 't' }), res)
    expect(res.status).toHaveBeenCalledWith(402)
    expect(res.body.error.used).toBe(0)
    expect(res.body.error.limit).toBe(0)
    expect(handler).not.toHaveBeenCalled()
  })

  it('invokes handler and attaches req.quota when allowed (projects)', async () => {
    checkLimitMock.mockResolvedValue({ canUse: true, current: 0, limit: 1, isUnlimited: false, percentageUsed: 0 })
    const handler = vi.fn(async (req: any, res: any) => {
      expect(req.quota).toEqual({ userId: 'u1', tier: 'unknown', limit: 1, used: 0, isUnlimited: false })
      return res.status(200).json({ ok: true })
    })
    const wrapped = withQuotaCheck('projects', handler)
    const res = makeRes()
    await wrapped(makeReq({ token: 't' }), res)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('returns 500 QUOTA_CHECK_FAILED when supabaseAdmin is null', async () => {
    // Temporarily override supabaseAdmin to null for this test
    const originalAdmin = (adminLib as any).supabaseAdmin
    ;(adminLib as any).supabaseAdmin = null
    try {
      const handler = vi.fn()
      const wrapped = withQuotaCheck('projects', handler)
      const res = makeRes()
      await wrapped(makeReq({ token: 't' }), res)
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.body.error.code).toBe('QUOTA_CHECK_FAILED')
      expect(handler).not.toHaveBeenCalled()
    } finally {
      ;(adminLib as any).supabaseAdmin = originalAdmin
    }
  })

  it('returns 402 quota_exceeded for users resource over-limit', async () => {
    checkLimitMock.mockResolvedValue({ canUse: false, current: 3, limit: 3, isUnlimited: false, percentageUsed: 100 })
    const handler = vi.fn()
    const wrapped = withQuotaCheck('users', handler)
    const res = makeRes()
    await wrapped(makeReq({ token: 't' }), res)
    expect(res.status).toHaveBeenCalledWith(402)
    expect(res.body.error.code).toBe('quota_exceeded')
    expect(res.body.error.resource).toBe('users')
    expect(handler).not.toHaveBeenCalled()
  })

  it('invokes handler for users when canUse true', async () => {
    checkLimitMock.mockResolvedValue({ canUse: true, current: 2, limit: 3, isUnlimited: false, percentageUsed: 66.67 })
    const handler = vi.fn(async (_req: any, res: any) => res.status(200).json({ ok: true }))
    const wrapped = withQuotaCheck('users', handler)
    const res = makeRes()
    await wrapped(makeReq({ token: 't' }), res)
    expect(handler).toHaveBeenCalledOnce()
    expect(res.statusCode).toBe(200)
  })

  it('calls checkLimit with (userId, "projects") for projects wrapper', async () => {
    checkLimitMock.mockResolvedValue({ canUse: true, current: 0, limit: 1, isUnlimited: false, percentageUsed: 0 })
    const handler = vi.fn(async (_req: any, res: any) => res.status(200).json({ ok: true }))
    const wrapped = withQuotaCheck('projects', handler)
    await wrapped(makeReq({ token: 't' }), makeRes())
    expect(checkLimitMock).toHaveBeenCalledWith('u1', 'projects')
  })

  it('calls checkLimit with (userId, "users") for users wrapper', async () => {
    checkLimitMock.mockResolvedValue({ canUse: true, current: 1, limit: 3, isUnlimited: false, percentageUsed: 33.33 })
    const handler = vi.fn(async (_req: any, res: any) => res.status(200).json({ ok: true }))
    const wrapped = withQuotaCheck('users', handler)
    await wrapped(makeReq({ token: 't' }), makeRes())
    expect(checkLimitMock).toHaveBeenCalledWith('u1', 'users')
  })
})
