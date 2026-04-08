/**
 * sendInviteEmail — best-effort Resend send wrapper.
 *
 * Per Phase 05.2 decisions:
 * - D-04: If RESEND_API_KEY is missing, log a warning and console.log the
 *   email body so dev contributors can still see what would have been sent.
 * - D-06: Sender defaults to onboarding@resend.dev; override via
 *   RESEND_FROM_EMAIL once a verified domain is set up in Resend.
 * - D-12/D-13: This function MUST NEVER throw. All failure paths return a
 *   SendResult so the invitation handler can log and continue serving 200.
 */

import { Resend } from 'resend'
import { buildInviteEmail, type InviteEmailInput } from './inviteEmailTemplate'

export type SendResult =
  | { ok: true }
  | { ok: false; reason: 'missing-key' | 'send-failed'; error?: unknown }

const DEFAULT_FROM = 'onboarding@resend.dev'

export async function sendInviteEmail(
  input: InviteEmailInput & { to: string }
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM
  const { subject, html, text } = buildInviteEmail(input)

  if (!apiKey) {
    console.warn('[sendInviteEmail] RESEND_API_KEY not set — skipping real send')
    console.log('[sendInviteEmail:noop]', { to: input.to, subject, text })
    return { ok: false, reason: 'missing-key' }
  }

  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({ from, to: input.to, subject, html, text })
    return { ok: true }
  } catch (error) {
    console.error('[sendInviteEmail] Resend send failed:', error)
    return { ok: false, reason: 'send-failed', error }
  }
}
