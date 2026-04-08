/**
 * POST /api/projects — Create a project (quota-enforced)
 * GET  /api/projects — List projects owned by caller
 *
 * Replaces the previous mock stub (api/projects.js). The POST path is wrapped
 * with withQuotaCheck('projects') so free-tier users hit a 402 once they reach
 * the project limit (BILL-01).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { withQuotaCheck, type QuotaRequest } from './_lib/middleware/withQuotaCheck'

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) throw new Error('Missing Supabase service-role configuration')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = (req.headers.origin as string) || 'http://localhost:3003'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-Requested-With, Content-Type, Authorization, Accept, Origin'
  )
}

function getAccessToken(req: VercelRequest): string | null {
  const cookieHeader = req.headers.cookie
  if (cookieHeader && typeof cookieHeader === 'string') {
    const match = cookieHeader.match(/(?:^|;\s*)sb-access-token=([^;]+)/)
    if (match) return decodeURIComponent(match[1])
  }
  const authHeader = req.headers.authorization || (req.headers as any).Authorization
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return null
}

async function handleCreateProject(req: QuotaRequest, res: VercelResponse) {
  const { name, description } = (req.body ?? {}) as { name?: string; description?: string }
  if (!name || typeof name !== 'string' || name.trim().length < 1) {
    return res
      .status(400)
      .json({ error: { code: 'INVALID_INPUT', message: 'name is required' } })
  }

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('projects')
    .insert({
      name: name.trim(),
      description: description?.trim() ?? null,
      owner_id: req.quota.userId,
    })
    .select('*')
    .single()

  if (error) {
    console.error('[api/projects POST] insert failed:', error)
    return res
      .status(500)
      .json({ error: { code: 'DB_ERROR', message: 'Failed to create project' } })
  }

  return res.status(201).json({ project: data })
}

const wrappedPost = withQuotaCheck('projects', handleCreateProject)

async function handleListProjects(req: VercelRequest, res: VercelResponse) {
  const token = getAccessToken(req)
  if (!token) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED' } })
  }
  const admin = getSupabaseAdmin()
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED' } })
  }
  const { data, error } = await admin
    .from('projects')
    .select('*')
    .eq('owner_id', userData.user.id)
    .order('created_at', { ascending: false })
  if (error) {
    return res.status(500).json({ error: { code: 'DB_ERROR' } })
  }
  return res.status(200).json({ projects: data ?? [], count: data?.length ?? 0 })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method === 'GET') return handleListProjects(req, res)
  if (req.method === 'POST') return wrappedPost(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}
