/**
 * API endpoint to fetch ideas for a project
 * GET /api/ideas?projectId=xxx
 *
 * SECURITY FIX (2025-11-25): Changed to use service role for querying ideas
 * while still validating user authentication. This fixes the issue where
 * brainstorm session ideas (inserted via service role) were not visible
 * to users due to RLS SELECT policy only checking owner_id.
 *
 * The RLS policy was: auth.uid() = project.owner_id OR is_admin()
 * This blocked ALL brainstorm ideas because:
 * 1. Brainstorm ideas have created_by = NULL (anonymous mobile submission)
 * 2. The SELECT policy doesn't account for session-based access
 * 3. Project collaborators couldn't see any ideas
 *
 * Solution: Use service role key for SELECT (like submit-idea does for INSERT)
 * with server-side project access validation.
 *
 * BACKWARDS COMPATIBILITY: Supports both httpOnly cookies (new) and Authorization header (old)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Extract access token from request cookies OR Authorization header
 * Supports both httpOnly cookie auth (new) and localStorage auth (old)
 */
function getAccessToken(req: VercelRequest): string | null {
  // NEW AUTH: Try httpOnly cookies first (preferred)
  if (req.cookies && req.cookies['sb-access-token']) {
    console.log('✅ Using httpOnly cookie authentication')
    return req.cookies['sb-access-token']
  }

  // Parse raw cookie header
  const cookieHeader = req.headers.cookie
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [name, ...rest] = cookie.split('=')
      if (name && rest.length > 0) {
        acc[name.trim()] = rest.join('=').trim()
      }
      return acc
    }, {} as Record<string, string>)

    if (cookies['sb-access-token']) {
      console.log('✅ Using httpOnly cookie authentication (from header)')
      return cookies['sb-access-token']
    }
  }

  // OLD AUTH: Fall back to Authorization header (localStorage-based auth)
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    console.log('⚠️ Using legacy Authorization header authentication')
    return authHeader.substring(7)
  }

  return null
}

/**
 * Create authenticated Supabase client from request (for user validation)
 */
function createAuthenticatedClient(req: VercelRequest) {
  const accessToken = getAccessToken(req)

  if (!accessToken) {
    throw new Error('No access token found - user not authenticated')
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing')
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
}

/**
 * Create service role Supabase client (bypasses RLS for reading)
 * Used to fetch ALL ideas for a project, including brainstorm session ideas
 */
function getServiceRoleClient(): SupabaseClient {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase service role configuration')
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Validate that the user has access to the project
 * Returns the user ID if valid, throws error otherwise
 */
async function validateProjectAccess(
  authClient: SupabaseClient,
  projectId: string
): Promise<string> {
  // Get the authenticated user
  const { data: { user }, error: userError } = await authClient.auth.getUser()

  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  // Check if user has access to this project (owner or collaborator)
  const serviceClient = getServiceRoleClient()

  const { data: project, error: projectError } = await serviceClient
    .from('projects')
    .select('id, owner_id')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    throw new Error('Project not found')
  }

  // Check if user is owner
  if (project.owner_id === user.id) {
    console.log(`✅ User ${user.id} is owner of project ${projectId}`)
    return user.id
  }

  // Check if user is collaborator
  const { data: collaboration } = await serviceClient
    .from('project_collaborators')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (collaboration) {
    console.log(`✅ User ${user.id} is collaborator on project ${projectId}`)
    return user.id
  }

  // Check if user is admin
  const { data: userProfile } = await serviceClient
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userProfile?.role === 'admin') {
    console.log(`✅ User ${user.id} is admin`)
    return user.id
  }

  throw new Error('Access denied - not owner, collaborator, or admin')
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { projectId } = req.query

  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Project ID required' })
  }

  try {
    // Step 1: Validate user authentication and project access
    const authClient = createAuthenticatedClient(req)
    const userId = await validateProjectAccess(authClient, projectId)
    console.log(`🔐 Access validated for user ${userId} on project ${projectId}`)

    // Step 2: Use service role client to fetch ALL ideas (bypasses restrictive RLS)
    // This is necessary because brainstorm session ideas have created_by = NULL
    // and the RLS SELECT policy only checks owner_id match
    const serviceClient = getServiceRoleClient()

    const { data, error } = await serviceClient
      .from('ideas')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching ideas:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return res.status(500).json({ error: error.message })
    }

    // Debug: Log how many ideas are from brainstorm sessions
    const brainstormIdeas = (data || []).filter((idea: any) => idea.session_id)
    const desktopIdeas = (data || []).filter((idea: any) => !idea.session_id)
    console.log(`✅ API: Fetched ${data?.length || 0} ideas for project ${projectId} (service role)`)
    console.log(`   - Brainstorm ideas: ${brainstormIdeas.length}`)
    console.log(`   - Desktop ideas: ${desktopIdeas.length}`)

    return res.status(200).json({ ideas: data || [] })

  } catch (error) {
    console.error('Exception fetching ideas:', error)

    // Handle authentication errors specifically
    if (error instanceof Error) {
      if (error.message.includes('not authenticated')) {
        return res.status(401).json({ error: 'Authentication required' })
      }
      if (error.message.includes('Access denied')) {
        return res.status(403).json({ error: error.message })
      }
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message })
      }
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
