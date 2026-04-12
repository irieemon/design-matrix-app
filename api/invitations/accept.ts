/**
 * POST /api/invitations/accept
 *
 * Body: { token: string }
 *
 * Caller must be authenticated (the freshly-created invited user). The
 * handler creates an authenticated supabase client using the access token
 * pulled from cookie OR Authorization header — it never calls
 * `supabase.auth.getSession()` (deadlock risk per MEMORY.md).
 *
 * The only mutation path into project_collaborators is the
 * accept_invitation() SECURITY DEFINER RPC defined in plan 05-01.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { hashToken } from '../_lib/invitationTokens.js'

function getAdminClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function getAccessToken(req: VercelRequest): string | null {
  const cookieHeader = req.headers.cookie
  if (cookieHeader && typeof cookieHeader === 'string') {
    const match = cookieHeader.match(/(?:^|;\s*)sb-access-token=([^;]+)/)
    if (match) return decodeURIComponent(match[1])
  }
  const authHeader = req.headers.authorization || req.headers.Authorization
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return null
}

function getAuthenticatedClient(accessToken: string): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  if (!url || !anon) throw new Error('Missing Supabase configuration')
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' } })
  }

  const accessToken = getAccessToken(req)
  if (!accessToken) {
    return res
      .status(401)
      .json({ error: { message: 'Authentication required', code: 'UNAUTHORIZED' } })
  }

  const body = (req.body || {}) as { token?: unknown }
  const token = typeof body.token === 'string' ? body.token : ''
  if (!token) {
    return res
      .status(400)
      .json({ error: { message: 'Missing token', code: 'BAD_REQUEST' } })
  }

  let supabase: SupabaseClient
  try {
    supabase = getAuthenticatedClient(accessToken)
  } catch {
    return res.status(500).json({
      error: { message: 'Server configuration error', code: 'CONFIG_ERROR' },
    })
  }

  // Verify the bearer token resolves to a real user (cheap, no getSession()).
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken)
  if (userError || !userData?.user) {
    return res
      .status(401)
      .json({ error: { message: 'Invalid or expired token', code: 'UNAUTHORIZED' } })
  }

  const { data, error } = await supabase.rpc('accept_invitation', { p_token: token })

  // Idempotent recovery: if the RPC says invalid_or_expired, the user may
  // already be in project_collaborators from a prior request. Use the
  // service-role client to check (RLS hides project_invitations from non-owners).
  if (error || !data) {
    if (error) {
      console.error('[invitations/accept] rpc error:', error.message)
    }
    const admin = getAdminClient()
    if (admin) {
      const tokenHash = hashToken(token)
      const { data: invRow } = await admin
        .from('project_invitations')
        .select('project_id, role')
        .eq('token_hash', tokenHash)
        .maybeSingle()

      if (invRow?.project_id) {
        const { data: collabRow } = await admin
          .from('project_collaborators')
          .select('role')
          .eq('project_id', invRow.project_id)
          .eq('user_id', userData.user.id)
          .maybeSingle()
        if (collabRow) {
          return res.status(200).json({
            projectId: invRow.project_id,
            role: collabRow.role || invRow.role,
          })
        }
        // Self-heal: invitation row exists and the user is authenticated, but
        // there's no matching project_collaborators row. Can happen if the
        // collaborator row was manually deleted while the invitation stayed
        // marked accepted. Insert the missing membership under service role.
        const { error: insertErr } = await admin
          .from('project_collaborators')
          .insert({
            project_id: invRow.project_id,
            user_id: userData.user.id,
            role: invRow.role,
            joined_at: new Date().toISOString(),
          })
        if (!insertErr) {
          return res.status(200).json({
            projectId: invRow.project_id,
            role: invRow.role,
          })
        }
        console.error('[invitations/accept] self-heal insert failed:', insertErr.message)
      }
    }
    return res.status(400).json({ error: 'invalid_or_expired' })
  }

  // RPC returns rows: [{ project_id, role }]
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.project_id || !row?.role) {
    return res.status(400).json({ error: 'invalid_or_expired' })
  }

  return res.status(200).json({
    projectId: row.project_id,
    role: row.role,
  })
}
