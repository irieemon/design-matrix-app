/**
 * Tests for POST /api/invitations/accept — COLLAB-04.
 * Implemented in plan 05-02 task 1.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockState: {
  user: { id: string } | null
  userError: unknown
  rpcResult: any
  rpcError: unknown
} = {
  user: { id: 'user-2' },
  userError: null,
  rpcResult: [{ project_id: 'proj-1', role: 'editor' }],
  rpcError: null,
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: mockState.user },
        error: mockState.userError,
      }),
    },
    rpc: vi.fn().mockResolvedValue({
      data: mockState.rpcResult,
      error: mockState.rpcError,
    }),
  })),
}))

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_ANON_KEY = 'test-anon-key'
  mockState.user = { id: 'user-2' }
  mockState.userError = null
  mockState.rpcResult = [{ project_id: 'proj-1', role: 'editor' }]
  mockState.rpcError = null
})

function makeReq(overrides: Partial<any> = {}) {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer test-jwt' },
    body: { token: 'raw-token-abc' },
    ...overrides,
  } as any
}

function makeRes() {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

describe('POST /api/invitations/accept (COLLAB-04)', () => {
  it('returns 200 with projectId and role on success', async () => {
    const { default: handler } = await import('../invitations/accept')
    const res = makeRes()
    await handler(makeReq(), res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ projectId: 'proj-1', role: 'editor' })
  })

  it('returns 400 invalid_or_expired when RPC fails', async () => {
    mockState.rpcResult = null
    mockState.rpcError = { message: 'expired' }
    const { default: handler } = await import('../invitations/accept')
    const res = makeRes()
    await handler(makeReq(), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'invalid_or_expired' })
  })

  it('returns 401 when no auth token is present', async () => {
    const { default: handler } = await import('../invitations/accept')
    const res = makeRes()
    await handler(makeReq({ headers: {} }), res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('returns 400 when token is missing from body', async () => {
    const { default: handler } = await import('../invitations/accept')
    const res = makeRes()
    await handler(makeReq({ body: {} }), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })
})
