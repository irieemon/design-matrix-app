/**
 * Admin Model Profiles API Endpoint -- ADR-0013 Step 5
 *
 * Provides CRUD operations for AI model profiles:
 * - GET  /api/admin/model-profiles            — List all profiles
 * - PUT  /api/admin/model-profiles?id=<id>    — Update a profile's task_configs
 * - POST /api/admin/model-profiles?action=activate&id=<id> — Activate a profile
 *
 * Authentication: Requires admin or super_admin role
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { invalidateProfileCache, type TaskType, type TaskConfig, type ModelProfile } from '../_lib/ai/modelProfiles.js'

// Direct environment variable access (no shared module)
const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || ''

// ============================================================================
// INLINE AUTH UTILITIES (matches token-spend.ts pattern)
// ============================================================================

interface AuthResult {
  userId: string
  email: string
  role: string
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {}
  const cookies: Record<string, string> = {}
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=')
    const value = rest.join('=').trim()
    if (name && value) {
      try {
        cookies[name.trim()] = decodeURIComponent(value)
      } catch {
        // Invalid cookie value, skip
      }
    }
  })
  return cookies
}

function getCookie(req: { headers: { cookie?: string } }, name: string): string | undefined {
  const cookies = parseCookies(req.headers.cookie)
  return cookies[name]
}

async function authenticateRequest(req: VercelRequest): Promise<AuthResult | null> {
  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables')
    return null
  }

  let accessToken: string | undefined
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.substring(7)
  }

  if (!accessToken) {
    accessToken = getCookie(req, 'sb-access-token')
  }

  if (!accessToken) {
    return null
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })

  const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken)
  if (authError || !user) {
    console.error('Auth error:', authError)
    return null
  }

  const { data: profile } = await authClient
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return null
  }

  return {
    userId: user.id,
    email: user.email || '',
    role: profile.role,
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

const TASK_TYPES: TaskType[] = [
  'generate-ideas',
  'generate-insights',
  'generate-roadmap',
  'analyze-image',
  'analyze-video',
  'analyze-file',
  'transcribe-summary',
]

// NOTE: Mirrors the gateway model ID pattern from ADR-0013 Spec Challenge section.
const GATEWAY_MODEL_ID_RE = /^[a-z0-9-]+\/[a-z0-9._-]+$/i

function validateTaskConfigs(
  taskConfigs: unknown
): { valid: true; configs: Record<TaskType, TaskConfig> } | { valid: false; error: string } {
  if (!taskConfigs || typeof taskConfigs !== 'object' || Array.isArray(taskConfigs)) {
    return { valid: false, error: 'task_configs must be an object' }
  }

  const configs = taskConfigs as Record<string, unknown>

  for (const taskType of TASK_TYPES) {
    if (!(taskType in configs)) {
      return { valid: false, error: `Missing task type in task_configs: "${taskType}"` }
    }

    const entry = configs[taskType] as Record<string, unknown>

    if (!entry || typeof entry !== 'object') {
      return { valid: false, error: `task_configs["${taskType}"] must be an object` }
    }

    const { gatewayModelId, fallbackModels } = entry

    if (typeof gatewayModelId !== 'string' || !GATEWAY_MODEL_ID_RE.test(gatewayModelId)) {
      return {
        valid: false,
        error: `task_configs["${taskType}"].gatewayModelId must match "provider/model-id", got: "${gatewayModelId}"`,
      }
    }

    if (!Array.isArray(fallbackModels)) {
      return { valid: false, error: `task_configs["${taskType}"].fallbackModels must be an array` }
    }

    for (const fallback of fallbackModels) {
      if (typeof fallback !== 'string' || !GATEWAY_MODEL_ID_RE.test(fallback)) {
        return {
          valid: false,
          error: `task_configs["${taskType}"].fallbackModels contains invalid model ID: "${fallback}"`,
        }
      }
    }
  }

  return { valid: true, configs: configs as Record<TaskType, TaskConfig> }
}

// ============================================================================
// HANDLERS
// ============================================================================

async function handleGet(res: VercelResponse, adminClient: ReturnType<typeof createClient>) {
  const { data: profiles, error } = await adminClient
    .from('model_profiles')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch model profiles:', error)
    return res.status(500).json({ success: false, error: 'Failed to fetch model profiles' })
  }

  const active = (profiles as ModelProfile[]).find(p => p.is_active)

  return res.status(200).json({
    success: true,
    profiles: profiles as ModelProfile[],
    activeProfileName: active?.name ?? null,
  })
}

async function handlePut(
  req: VercelRequest,
  res: VercelResponse,
  adminClient: ReturnType<typeof createClient>
) {
  const profileId = String(req.query.id ?? '')
  if (!profileId) {
    return res.status(400).json({ success: false, error: 'Query param "id" is required' })
  }

  const body = req.body as Record<string, unknown> | undefined
  if (!body || !('task_configs' in body)) {
    return res.status(400).json({ success: false, error: 'Request body must include "task_configs"' })
  }

  const validation = validateTaskConfigs(body.task_configs)
  if (!validation.valid) {
    return res.status(400).json({ success: false, error: validation.error })
  }

  const { data: updated, error } = await adminClient
    .from('model_profiles')
    .update({ task_configs: validation.configs, updated_at: new Date().toISOString() })
    .eq('id', profileId)
    .select()
    .single()

  if (error || !updated) {
    console.error('Failed to update model profile:', error)
    return res.status(500).json({ success: false, error: 'Failed to update model profile' })
  }

  invalidateProfileCache()

  return res.status(200).json({ success: true, profile: updated as ModelProfile })
}

async function handleActivate(
  req: VercelRequest,
  res: VercelResponse,
  adminClient: ReturnType<typeof createClient>
) {
  const profileId = String(req.query.id ?? '')
  if (!profileId) {
    return res.status(400).json({ success: false, error: 'Query param "id" is required' })
  }

  // Deactivate all profiles first, then activate the target.
  const { error: deactivateError } = await adminClient
    .from('model_profiles')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .neq('id', profileId)

  if (deactivateError) {
    console.error('Failed to deactivate profiles:', deactivateError)
    return res.status(500).json({ success: false, error: 'Failed to deactivate existing profiles' })
  }

  const { data: activated, error: activateError } = await adminClient
    .from('model_profiles')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', profileId)
    .select()
    .single()

  if (activateError || !activated) {
    console.error('Failed to activate profile:', activateError)
    return res.status(500).json({ success: false, error: 'Failed to activate profile' })
  }

  invalidateProfileCache()

  return res.status(200).json({ success: true, activeProfile: activated as ModelProfile })
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

async function modelProfilesHandler(req: VercelRequest, res: VercelResponse) {
  const auth = await authenticateRequest(req)
  if (!auth) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    if (req.method === 'GET') {
      return await handleGet(res, adminClient)
    }

    if (req.method === 'PUT') {
      return await handlePut(req, res, adminClient)
    }

    if (req.method === 'POST') {
      const action = String(req.query.action ?? '')
      if (action === 'activate') {
        return await handleActivate(req, res, adminClient)
      }
      return res.status(400).json({ success: false, error: `Unknown action: "${action}"` })
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (error) {
    console.error('Model profiles handler error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}

export default modelProfilesHandler
