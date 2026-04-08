/**
 * Tests for POST /api/invitations/create — Resend wiring (Phase 05.2 Plan 02).
 *
 * Verifies:
 *  - sendInviteEmail is invoked AFTER db insert succeeds (D-13)
 *  - Send failures never block the 200 response (D-12)
 *  - Both success paths (fresh insert + idempotent refresh) trigger send
 *  - Insert failure short-circuits the handler and skips send
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { sendInviteEmailMock, createClientMock, supabaseStub, callOrder } = vi.hoisted(() => {
  const callOrder: string[] = []
  const sendInviteEmailMock = vi.fn(async () => {
    callOrder.push('send')
    return { ok: true } as const
  })
  const supabaseStub: any = {}
  const createClientMock = vi.fn(() => supabaseStub)
  return { sendInviteEmailMock, createClientMock, supabaseStub, callOrder }
})

vi.mock('../../_lib/sendInviteEmail', () => ({
  sendInviteEmail: sendInviteEmailMock,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}))

vi.mock('validator', () => ({
  default: { isEmail: (s: string) => /@/.test(s) },
}))

import handler from '../create'

const PROJECT = { id: 'proj-1', owner_id: 'user-1', name: 'Acme Roadmap' }

function buildReq(): any {
  return {
    method: 'POST',
    headers: {
      authorization: 'Bearer fake-token',
      host: 'localhost:3003',
    },
    body: {
      projectId: 'proj-1',
      email: 'invitee@example.com',
      role: 'editor',
    },
  }
}

function buildRes(): any {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: any) {
      this.body = payload
      return this
    },
  }
  return res
}

interface StubOptions {
  existing?: { id: string; expires_at: string } | null
  insertError?: unknown
  updateError?: unknown
}

function installSupabaseStub(opts: StubOptions = {}) {
  callOrder.length = 0

  supabaseStub.auth = {
    getUser: vi.fn(async () => ({
      data: {
        user: {
          id: 'user-1',
          email: 'alice@example.com',
          user_metadata: { full_name: 'Alice' },
        },
      },
      error: null,
    })),
  }

  supabaseStub.from = vi.fn((table: string) => {
    if (table === 'projects') {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: PROJECT, error: null }),
          }),
        }),
      }
    }
    if (table === 'project_invitations') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              is: () => ({
                gt: () => ({
                  maybeSingle: async () => ({
                    data: opts.existing ?? null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
        insert: vi.fn(async () => {
          callOrder.push('insert')
          return { error: opts.insertError ?? null }
        }),
        update: () => ({
          eq: vi.fn(async () => {
            callOrder.push('update')
            return { error: opts.updateError ?? null }
          }),
        }),
      }
    }
    return {} as any
  })
}

describe('POST /api/invitations/create — Resend wiring', () => {
  beforeEach(() => {
    sendInviteEmailMock.mockClear()
    sendInviteEmailMock.mockImplementation(async () => {
      callOrder.push('send')
      return { ok: true } as const
    })
    process.env.SUPABASE_URL = 'http://localhost'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('calls sendInviteEmail once after fresh insert with correct payload', async () => {
    installSupabaseStub()
    const res = buildRes()
    await handler(buildReq(), res)

    expect(res.statusCode).toBe(200)
    expect(res.body.inviteUrl).toMatch(/^http:\/\/localhost:3003\/invite#token=/)
    expect(sendInviteEmailMock).toHaveBeenCalledTimes(1)
    const arg = sendInviteEmailMock.mock.calls[0][0]
    expect(arg.to).toBe('invitee@example.com')
    expect(arg.projectName).toBe('Acme Roadmap')
    expect(arg.role).toBe('editor')
    expect(arg.inviterName).toBe('Alice')
    expect(arg.inviterEmail).toBe('alice@example.com')
    expect(arg.inviteUrl).toBe(res.body.inviteUrl)
  })

  it('also sends email on idempotent refresh of existing pending invite', async () => {
    installSupabaseStub({
      existing: { id: 'inv-9', expires_at: new Date(Date.now() + 86400000).toISOString() },
    })
    const res = buildRes()
    await handler(buildReq(), res)

    expect(res.statusCode).toBe(200)
    expect(sendInviteEmailMock).toHaveBeenCalledTimes(1)
    expect(callOrder).toEqual(['update', 'send'])
  })

  it('still returns 200 with inviteUrl when sendInviteEmail reports failure', async () => {
    installSupabaseStub()
    sendInviteEmailMock.mockImplementationOnce(async () => {
      callOrder.push('send')
      return { ok: false, reason: 'send-failed', error: new Error('boom') } as const
    })
    const res = buildRes()
    await handler(buildReq(), res)

    expect(res.statusCode).toBe(200)
    expect(res.body.inviteUrl).toBeTruthy()
    expect(res.body.expiresAt).toBeTruthy()
  })

  it('invokes sendInviteEmail strictly AFTER the db insert (never before)', async () => {
    installSupabaseStub()
    const res = buildRes()
    await handler(buildReq(), res)

    expect(callOrder).toEqual(['insert', 'send'])
  })

  it('does NOT call sendInviteEmail when the supabase insert fails', async () => {
    installSupabaseStub({ insertError: { message: 'unique violation' } })
    const res = buildRes()
    await handler(buildReq(), res)

    expect(res.statusCode).toBe(500)
    expect(sendInviteEmailMock).not.toHaveBeenCalled()
  })
})
