/**
 * CSP Violation Report Endpoint — /api/csp-report
 *
 * Receives Content-Security-Policy violation reports dispatched by the browser
 * via the `report-uri` directive declared in vercel.json. Logs each report to
 * stdout for downstream aggregation (Vercel log drains). No auth, no CSRF:
 * reports are unsolicited browser POSTs and may arrive before any session is
 * established. Bodies are truncated to 8192 bytes to cap log volume from
 * noisy or hostile clients.
 *
 * Response: 204 No Content on success, 405 on non-POST.
 */

// Browsers POST CSP reports as application/csp-report or application/reports+json,
// neither of which Vercel auto-parses. Disable the body parser so we can read
// the raw stream and handle both MIME types correctly.
export const config = {
  api: {
    bodyParser: false,
  },
}

import type { VercelResponse } from '@vercel/node'
import { withRateLimit, type AuthenticatedRequest } from './_lib/middleware/index.js'

const MAX_REPORT_BYTES = 8192

function ipFromHeader(xff: string | string[] | undefined): string {
  if (!xff) return 'unknown'
  const value = Array.isArray(xff) ? xff[0] : xff
  return value.split(',')[0].trim() || 'unknown'
}

async function handler(
  req: AuthenticatedRequest,
  res: VercelResponse
): Promise<VercelResponse | void> {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      allowed: ['POST', 'OPTIONS'],
    })
  }

  // Browsers POST CSP reports as application/csp-report or application/reports+json,
  // neither of which Vercel auto-parses. Read raw body manually.
  let raw = ''
  let bytesRead = 0
  for await (const chunk of req) {
    bytesRead += chunk.length
    if (bytesRead > MAX_REPORT_BYTES) {
      raw += chunk.slice(0, Math.max(0, MAX_REPORT_BYTES - (bytesRead - chunk.length))).toString('utf8')
      raw += '…[truncated]'
      break
    }
    raw += chunk.toString('utf8')
  }
  const size = bytesRead

  console.warn('[CSP-VIOLATION]', {
    ts: new Date().toISOString(),
    ip: ipFromHeader(req.headers['x-forwarded-for']),
    ua: String(req.headers['user-agent'] ?? 'unknown'),
    contentType: String(req.headers['content-type'] ?? 'unknown'),
    size,
    report: raw,
  })

  return res.status(204).end()
}

export default withRateLimit({ windowMs: 60_000, maxRequests: 60 })(handler)
