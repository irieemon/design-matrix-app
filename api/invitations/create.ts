/**
 * POST /api/invitations
 *
 * Creates a project invitation. Caller must be authenticated and own the
 * project. Returns an invite URL containing the raw token in the URL
 * fragment (never query string — fragments aren't sent to servers, so they
 * don't appear in logs).
 *
 * Idempotent: re-inviting the same email for the same project returns the
 * existing pending invitation rather than creating a duplicate.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import validator from 'validator'
import { generateToken, hashToken } from '../_lib/invitationTokens'
import { sendInviteEmail } from '../_lib/sendInviteEmail'
import { withQuotaCheck, type QuotaRequest } from '../_lib/middleware/withQuotaCheck.js'

interface InviterUser {
  id: string
  email: string
  name?: string | null
}

const INVITE_TTL_DAYS = 7

interface CreateBody {
  projectId?: unknown
  email?: unknown
  role?: unknown
}

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) throw new Error('Missing Supabase service-role configuration')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function appBaseUrl(req: VercelRequest): string {
  // Explicit env var wins (set in Vercel for prod/preview).
  const fromEnv = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  // Fall back to the request's own origin so dev runs against localhost.
  const host = (req.headers['x-forwarded-host'] || req.headers.host) as string | undefined
  if (host) {
    const proto =
      (req.headers['x-forwarded-proto'] as string | undefined) ||
      (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')
    return `${proto}://${host}`
  }

  return 'https://www.prioritas.ai'
}

async function createInviteHandler(
  req: QuotaRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  let supabase: SupabaseClient
  try {
    supabase = getSupabaseAdmin()
  } catch (err) {
    return res.status(500).json({
      error: { message: 'Server configuration error', code: 'CONFIG_ERROR' },
    })
  }

  // Middleware already authenticated the user; resolve inviter profile for email send.
  const userId = req.quota.userId
  const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(userId)
  if (userErr || !userData.user) {
    return res
      .status(401)
      .json({ error: { message: 'Authentication required', code: 'UNAUTHORIZED' } })
  }
  const meta = (userData.user.user_metadata || {}) as Record<string, unknown>
  const inviter: InviterUser = {
    id: userId,
    email: userData.user.email || '',
    name:
      (typeof meta.full_name === 'string' && meta.full_name) ||
      (typeof meta.name === 'string' && meta.name) ||
      null,
  }

  // Body validation
  const body = (req.body || {}) as CreateBody
  const projectId = typeof body.projectId === 'string' ? body.projectId : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const role = body.role === 'viewer' || body.role === 'editor' ? body.role : null

  if (!projectId || !email || !role) {
    return res.status(400).json({
      error: { message: 'Missing required fields: projectId, email, role', code: 'BAD_REQUEST' },
    })
  }

  if (!validator.isEmail(email)) {
    return res.status(400).json({
      error: { message: 'Invalid email address', code: 'BAD_REQUEST' },
    })
  }

  // Project ownership check
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, owner_id, name')
    .eq('id', projectId)
    .single()

  if (projectError || !project || project.owner_id !== userId) {
    return res
      .status(403)
      .json({ error: { message: 'Not project owner', code: 'FORBIDDEN' } })
  }

  // Idempotency: existing pending invite for same (project, email)?
  const nowIso = new Date().toISOString()
  const { data: existing, error: existingError } = await supabase
    .from('project_invitations')
    .select('id, expires_at')
    .eq('project_id', projectId)
    .eq('email', email)
    .is('accepted_at', null)
    .gt('expires_at', nowIso)
    .maybeSingle()
  if (existingError) {
    console.error('[invitations/create] idempotency lookup failed:', existingError)
    return res.status(500).json({
      error: { message: 'Failed to check existing invitations', code: 'DB_ERROR' },
    })
  }

  if (existing) {
    // Don't leak the original token — issue a fresh one and update the row.
    const rawToken = generateToken()
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400 * 1000).toISOString()
    const { error: updateError } = await supabase
      .from('project_invitations')
      .update({ token_hash: tokenHash, expires_at: expiresAt, role })
      .eq('id', existing.id)
    if (updateError) {
      return res.status(500).json({
        error: { message: 'Failed to refresh invitation', code: 'DB_ERROR' },
      })
    }
    const inviteUrl = `${appBaseUrl(req)}/invite#token=${rawToken}`
    const sendResult = await sendInviteEmail({
      to: email,
      projectName: project.name,
      inviterName: inviter.name ?? null,
      inviterEmail: inviter.email,
      role,
      inviteUrl,
    })
    if (!sendResult.ok) {
      console.warn('[invitations/create] email send not delivered:', sendResult.reason)
    }
    return res.status(200).json({
      inviteUrl,
      expiresAt,
      projectName: project.name,
    })
  }

  // Fresh invite
  const rawToken = generateToken()
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400 * 1000).toISOString()

  const { error: insertError } = await supabase
    .from('project_invitations')
    .insert({
      project_id: projectId,
      email,
      role,
      token_hash: tokenHash,
      expires_at: expiresAt,
      invited_by: userId,
    })

  if (insertError) {
    console.error('[invitations/create] insert failed:', insertError)
    return res.status(500).json({
      error: { message: 'Failed to create invitation', code: 'DB_ERROR' },
    })
  }

  const inviteUrl = `${appBaseUrl(req)}/invite#token=${rawToken}`
  const sendResult = await sendInviteEmail({
    to: email,
    projectName: project.name,
    inviterName: inviter.name ?? null,
    inviterEmail: inviter.email,
    role,
    inviteUrl,
  })
  if (!sendResult.ok) {
    console.warn('[invitations/create] email send not delivered:', sendResult.reason)
  }

  return res.status(200).json({
    inviteUrl,
    expiresAt,
    projectName: project.name,
  })
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' } })
  }
  return withQuotaCheck('users', createInviteHandler)(req, res) as Promise<VercelResponse>
}
