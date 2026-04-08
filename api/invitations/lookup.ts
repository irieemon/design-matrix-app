/**
 * GET /api/invitations/lookup?token=...
 *
 * Pre-signup preview endpoint. Returns the project name, role, and
 * inviter name for a valid (unexpired, unaccepted) invitation. No auth
 * required — the raw token is the bearer credential.
 *
 * Returns the same constant 404 shape for any invalid input to avoid
 * leaking which tokens exist.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hashToken } from '../_lib/invitationTokens'

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) throw new Error('Missing Supabase service-role configuration')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const NOT_FOUND = { error: 'invalid_or_expired' }

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' } })
  }

  const token = typeof req.query.token === 'string' ? req.query.token : ''
  if (!token) {
    return res.status(404).json(NOT_FOUND)
  }

  let supabase: SupabaseClient
  try {
    supabase = getSupabaseAdmin()
  } catch {
    return res.status(500).json({
      error: { message: 'Server configuration error', code: 'CONFIG_ERROR' },
    })
  }

  const tokenHash = hashToken(token)
  const nowIso = new Date().toISOString()

  // Look up by hash. We allow already-accepted rows through so the page
  // can hand them off to the idempotent accept endpoint, which will detect
  // existing membership and redirect into the project — important for
  // users who retry the same invite link.
  const { data: invite, error } = await supabase
    .from('project_invitations')
    .select('project_id, role, invited_by, expires_at, accepted_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error || !invite) {
    return res.status(404).json(NOT_FOUND)
  }

  // Still reject expired UNACCEPTED invitations (no idempotent recovery there).
  if (!invite.accepted_at && invite.expires_at < nowIso) {
    return res.status(404).json(NOT_FOUND)
  }

  // Best-effort enrichment — failures fall back to safe defaults.
  const { data: project } = await supabase
    .from('projects')
    .select('name')
    .eq('id', invite.project_id)
    .maybeSingle()

  const { data: inviter } = await supabase
    .from('user_profiles')
    .select('email, full_name')
    .eq('id', invite.invited_by)
    .maybeSingle()

  return res.status(200).json({
    projectId: invite.project_id,
    projectName: project?.name ?? 'a project',
    role: invite.role,
    inviterName:
      (inviter as any)?.full_name || (inviter as any)?.email || 'A teammate',
  })
}
