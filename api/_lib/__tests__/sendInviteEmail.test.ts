/**
 * Tests for sendInviteEmail — best-effort Resend send wrapper.
 *
 * Per Phase 05.2 D-04/D-12/D-13: this wrapper must NEVER throw. It returns
 * a discriminated SendResult so the invitation handler can log and move on.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { sendMock, ResendCtor } = vi.hoisted(() => {
  const sendMock = vi.fn()
  const ResendCtor = vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  }))
  return { sendMock, ResendCtor }
})

vi.mock('resend', () => ({
  Resend: ResendCtor,
}))

import { sendInviteEmail } from '../sendInviteEmail'

const baseInput = {
  to: 'invitee@example.com',
  projectName: 'Acme Roadmap',
  inviterName: 'Alice',
  inviterEmail: 'alice@example.com',
  role: 'editor' as const,
  inviteUrl: 'http://localhost:3003/invite#token=abc123',
}

describe('sendInviteEmail', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    sendMock.mockReset()
    ResendCtor.mockClear()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
    logSpy.mockRestore()
  })

  it('calls Resend emails.send with built template when API key is set', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key')
    vi.stubEnv('RESEND_FROM_EMAIL', 'noreply@prioritas.ai')
    sendMock.mockResolvedValueOnce({ id: 'msg_123' })

    const result = await sendInviteEmail(baseInput)

    expect(result).toEqual({ ok: true })
    expect(ResendCtor).toHaveBeenCalledWith('test-key')
    expect(sendMock).toHaveBeenCalledTimes(1)
    const arg = sendMock.mock.calls[0][0]
    expect(arg.from).toBe('noreply@prioritas.ai')
    expect(arg.to).toBe('invitee@example.com')
    expect(arg.subject).toBe("You've been invited to Acme Roadmap on Prioritas")
    expect(arg.html).toContain('Acme Roadmap')
    expect(arg.text).toContain('http://localhost:3003/invite#token=abc123')
  })

  it('returns missing-key without instantiating Resend when RESEND_API_KEY is unset', async () => {
    vi.stubEnv('RESEND_API_KEY', '')

    const result = await sendInviteEmail(baseInput)

    expect(result).toEqual({ ok: false, reason: 'missing-key' })
    expect(ResendCtor).not.toHaveBeenCalled()
    expect(sendMock).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalled()
  })

  it('returns send-failed and never throws when Resend rejects', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key')
    const err = new Error('network down')
    sendMock.mockRejectedValueOnce(err)

    const result = await sendInviteEmail(baseInput)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('send-failed')
      expect(result.error).toBe(err)
    }
    expect(errorSpy).toHaveBeenCalled()
  })

  it('falls back to onboarding@resend.dev when RESEND_FROM_EMAIL is unset', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key')
    vi.stubEnv('RESEND_FROM_EMAIL', '')
    sendMock.mockResolvedValueOnce({ id: 'msg_456' })

    await sendInviteEmail(baseInput)

    expect(sendMock.mock.calls[0][0].from).toBe('onboarding@resend.dev')
  })
})
