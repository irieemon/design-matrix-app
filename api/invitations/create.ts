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

function getAccessToken(req: VercelRequest): string | null {
  // httpOnly cookie first (new auth path)
  const cookieHeader = req.headers.cookie
  if (cookieHeader && typeof cookieHeader === 'string') {
    const match = cookieHeader.match(/(?:^|;\s*)sb-access-token=([^;]+)/)
    if (match) return decodeURIComponent(match[1])
  }
  // Authorization header fallback (legacy)
  const authHeader = req.headers.authorization || req.headers.Authorization
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return null
}

async function getAuthenticatedUser(
  req: VercelRequest,
  supabase: SupabaseClient
): Promise<InviterUser | null> {
  const token = getAccessToken(req)
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  const meta = (data.user.user_metadata || {}) as Record<string, unknown>
  const name =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    null
  return {
    id: data.user.id,
    email: data.user.email || '',
    name,
  }
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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' } })
  }

  let supabase: SupabaseClient
  try {
    supabase = getSupabaseAdmin()
  } catch (err) {
    return res.status(500).json({
      error: { message: 'Server configuration error', code: 'CONFIG_ERROR' },
    })
  }

  // Auth check
  const inviter = await getAuthenticatedUser(req, supabase)
  if (!inviter) {
    return res
      .status(401)
      .json({ error: { message: 'Authentication required', code: 'UNAUTHORIZED' } })
  }
  const userId = inviter.id

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
