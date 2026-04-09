/**
 * POST /api/email-link — email a link to the authenticated user.
 *
 * Used by the mobile "Best on desktop" hint so users can forward themselves
 * the current deep link to open on their laptop. Sends via Resend with a
 * minimal text/HTML template. Rate-limited to prevent abuse.
 */

import type { VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { Resend } from 'resend'
import {
  withUserRateLimit,
  withAuth,
  compose,
  type AuthenticatedRequest,
} from './_lib/middleware/index.js'

const BodySchema = z.object({
  url: z.string().url().max(2048),
  pageName: z.string().min(1).max(100),
})

const DEFAULT_FROM = 'onboarding@resend.dev'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff')

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
    })
  }

  const parsed = BodySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        message: 'Invalid request body',
        code: 'VALIDATION_ERROR',
        details: parsed.error.errors,
      },
    })
  }

  const email = req.user?.email
  if (!email) {
    return res.status(401).json({
      error: { message: 'Authenticated user has no email', code: 'NO_EMAIL' },
    })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email-link] RESEND_API_KEY not set — skipping real send')
    console.log('[email-link:noop]', { to: email, ...parsed.data })
    return res.status(200).json({ ok: true, delivered: false, reason: 'missing-key' })
  }

  const from = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM
  const { url, pageName } = parsed.data
  const subject = `Prioritas — ${pageName} link`
  const safeName = escapeHtml(pageName)
  const safeUrl = escapeHtml(url)
  const text = `Open ${pageName} on your desktop:\n\n${url}\n\n— Prioritas`
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;padding:24px;color:#111">
<h2 style="margin:0 0 12px">Open ${safeName} on your desktop</h2>
<p>You asked us to send this link to yourself from the mobile app.</p>
<p><a href="${safeUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none">Open ${safeName}</a></p>
<p style="color:#6b7280;font-size:12px;word-break:break-all">${safeUrl}</p>
</body></html>`

  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({ from, to: email, subject, html, text })
    return res.status(200).json({ ok: true, delivered: true, to: email })
  } catch (error) {
    console.error('[email-link] Resend send failed:', error)
    return res.status(502).json({
      error: { message: 'Failed to send email', code: 'SEND_FAILED' },
    })
  }
}

export default compose(
  withUserRateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: 30, // 30 self-emails per 15 minutes
  }),
  withAuth
)(handler)
