/**
 * Tests for POST /api/invitations/accept — COLLAB-04.
 * Implemented in plan 05-02 task 1.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock state — shared across all createClient() instances in the handler.
// The handler calls createClient twice: once for the anon+JWT client and once
// for the admin (service-role) client. Both instances share this object.
// ---------------------------------------------------------------------------

const insertSpy = vi.fn().mockResolvedValue({ error: null })

const mockState: {
  user: { id: string; email: string } | null
  userError: unknown
  rpcResult: any
  rpcError: unknown
  adminInvitationRow: {
    project_id: string
    role: string
    email: string
    expires_at: string
    accepted_at: string | null
    invited_by: string | null
  } | null
  adminCollabRow: { role: string } | null
} = {
  user: { id: 'user-2', email: 'invitee@example.com' },
  userError: null,
  rpcResult: [{ project_id: 'proj-1', role: 'editor' }],
  rpcError: null,
  // admin lookup result — null means "no row found"
  adminInvitationRow: null,
  adminCollabRow: null,
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockImplementation(() =>
        Promise.resolve({
          data: { user: mockState.user },
          error: mockState.userError,
        })
      ),
    },
    rpc: vi.fn().mockImplementation(() =>
      Promise.resolve({
        data: mockState.rpcResult,
        error: mockState.rpcError,
      })
    ),
    from: vi.fn((table: string) => {
      if (table === 'project_invitations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: mockState.adminInvitationRow,
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }
      }
      if (table === 'project_collaborators') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: mockState.adminCollabRow,
                  error: null,
                }),
              }),
            }),
          }),
          insert: insertSpy,
        }
      }
      return {}
    }),
  })),
}))

vi.mock('../_lib/invitationTokens.js', () => ({
  hashToken: vi.fn((raw: string) => `hashed-${raw}`),
}))

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_ANON_KEY = 'test-anon-key'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  mockState.user = { id: 'user-2', email: 'invitee@example.com' }
  mockState.userError = null
  mockState.rpcResult = [{ project_id: 'proj-1', role: 'editor' }]
  mockState.rpcError = null
  mockState.adminInvitationRow = null
  mockState.adminCollabRow = null
  insertSpy.mockClear()
  insertSpy.mockResolvedValue({ error: null })
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

// ---------------------------------------------------------------------------
// Sentinel #5 — Self-heal bypass: service-role insert with mismatched email
//
// Sentinel finding: api/invitations/accept.ts lines 119-141 uses
// userData.user.id (the authenticated caller) as user_id in the self-heal
// insert, but never verifies that the invitation's email matches the
// caller's email. A user with a stolen/replayed token for a *different*
// user's invitation can insert themselves into project_collaborators.
//
// Correct behaviour: the self-heal path MUST compare the invitation's email
// against the authenticated user's email before calling insert. When they
// differ, the handler MUST return 400/403 and MUST NOT call insert.
// ---------------------------------------------------------------------------

describe('Sentinel #5: self-heal bypass — mismatched email must not insert', () => {
  it(
    'Sentinel #5: does NOT call project_collaborators insert when invitation.email ' +
      'does not match authenticated user email',
    async () => {
      // Arrange: RPC fails (simulates token-for-different-user scenario).
      mockState.rpcResult = null
      mockState.rpcError = { message: 'invalid_or_expired' }

      // Admin lookup finds the invitation — but it was addressed to a DIFFERENT
      // email than the currently authenticated user's email.
      mockState.adminInvitationRow = {
        project_id: 'proj-1',
        role: 'editor',
        // invitation was sent to alice, but the caller is user-2 / invitee@example.com
        email: 'alice@example.com',
      }

      // No existing collab row — so the code would fall through to insert.
      mockState.adminCollabRow = null

      // The authenticated user has a DIFFERENT email from the invitation.
      mockState.user = { id: 'user-2', email: 'invitee@example.com' }

      const { default: handler } = await import('../invitations/accept')
      const res = makeRes()
      await handler(makeReq(), res)

      // Assert: insert MUST NOT be called — email mismatch is a security boundary.
      expect(insertSpy).not.toHaveBeenCalled()

      // Assert: response must be 4xx — the caller should not gain membership.
      const statusCode: number = res.status.mock.calls[0]?.[0]
      expect(statusCode).toBeGreaterThanOrEqual(400)
      expect(statusCode).toBeLessThan(500)
    }
  )

  it(
    'Sentinel #5: returns 4xx status (not 200) when invitation.email ' +
      'does not match authenticated user email',
    async () => {
      // Arrange: same mismatch setup as above — two independent assertions
      // (one for insert suppression, one for status code) per testing guidelines.
      mockState.rpcResult = null
      mockState.rpcError = { message: 'invalid_or_expired' }
      mockState.adminInvitationRow = {
        project_id: 'proj-1',
        role: 'editor',
        email: 'alice@example.com',
      }
      mockState.adminCollabRow = null
      mockState.user = { id: 'user-2', email: 'invitee@example.com' }

      const { default: handler } = await import('../invitations/accept')
      const res = makeRes()
      await handler(makeReq(), res)

      const statusCode: number = res.status.mock.calls[0]?.[0]
      expect(statusCode).toBeGreaterThanOrEqual(400)
      expect(statusCode).toBeLessThan(500)
    }
  )
})
