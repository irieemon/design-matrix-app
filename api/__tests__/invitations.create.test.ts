/**
 * Tests for POST /api/invitations (create.ts) — COLLAB-03.
 * Implemented in plan 05-02 task 1.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Hoisted mock state shared between the supabase mock and tests.
const mockState: {
  user: { id: string } | null
  userError: unknown
  project: { id: string; user_id: string; name: string } | null
  projectError: unknown
  existing: { id: string; expires_at: string } | null
  insertError: unknown
  updateError: unknown
} = {
  user: null,
  userError: null,
  project: null,
  projectError: null,
  existing: null,
  insertError: null,
  updateError: null,
}

vi.mock('@supabase/supabase-js', () => {
  const buildProjectsQuery = () => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: mockState.project,
      error: mockState.projectError,
    }),
  })

  const buildInvitationsQuery = () => {
    const chain: any = {}
    chain.select = vi.fn().mockReturnValue(chain)
    chain.insert = vi.fn().mockResolvedValue({ error: mockState.insertError })
    chain.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: mockState.updateError }),
    })
    chain.eq = vi.fn().mockReturnValue(chain)
    chain.is = vi.fn().mockReturnValue(chain)
    chain.gt = vi.fn().mockReturnValue(chain)
    chain.maybeSingle = vi.fn().mockResolvedValue({
      data: mockState.existing,
      error: null,
    })
    return chain
  }

  return {
    createClient: vi.fn(() => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockState.user },
          error: mockState.userError,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'projects') return buildProjectsQuery()
        if (table === 'project_invitations') return buildInvitationsQuery()
        return buildInvitationsQuery()
      }),
    })),
  }
})

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  process.env.APP_URL = 'https://app.test'
  mockState.user = { id: 'user-1' }
  mockState.userError = null
  mockState.project = { id: 'proj-1', user_id: 'user-1', name: 'Test Project' }
  mockState.projectError = null
  mockState.existing = null
  mockState.insertError = null
  mockState.updateError = null
})

function makeReq(overrides: Partial<any> = {}) {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer test-jwt' },
    query: {},
    body: { projectId: 'proj-1', email: 'invitee@example.com', role: 'editor' },
    ...overrides,
  } as any
}

function makeRes() {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

describe('POST /api/invitations create (COLLAB-03)', () => {
  it('returns 200 with inviteUrl on valid body', async () => {
    const { default: handler } = await import('../invitations/create')
    const res = makeRes()
    await handler(makeReq(), res)
    expect(res.status).toHaveBeenCalledWith(200)
    const payload = res.json.mock.calls[0][0]
    expect(payload.inviteUrl).toMatch(/^https:\/\/app\.test\/invite#token=[\w-]+$/)
    expect(payload.expiresAt).toBeTruthy()
    expect(payload.projectName).toBe('Test Project')
  })

  it('returns 400 on invalid email', async () => {
    const { default: handler } = await import('../invitations/create')
    const res = makeRes()
    await handler(
      makeReq({ body: { projectId: 'proj-1', email: 'not-an-email', role: 'editor' } }),
      res
    )
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 400 on missing fields', async () => {
    const { default: handler } = await import('../invitations/create')
    const res = makeRes()
    await handler(makeReq({ body: { email: 'foo@example.com' } }), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 403 when caller is not the project owner', async () => {
    mockState.project = { id: 'proj-1', user_id: 'someone-else', name: 'Test Project' }
    const { default: handler } = await import('../invitations/create')
    const res = makeRes()
    await handler(makeReq(), res)
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('returns 401 when no auth token is present', async () => {
    mockState.user = null
    const { default: handler } = await import('../invitations/create')
    const res = makeRes()
    await handler(makeReq({ headers: {} }), res)
    expect(res.status).toHaveBeenCalledWith(401)
  })
})
