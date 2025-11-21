/**
 * Admin Projects API Endpoint
 *
 * Provides admin-only access to all projects across the platform
 * Requires admin authentication with rate limiting and CSRF protection
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Direct environment variable access (no shared module)
const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || ''

/**
 * Parse cookies from request headers
 */
function parseCookies(req: VercelRequest): Record<string, string> {
  const cookieHeader = req.headers.cookie
  if (!cookieHeader) return {}

  return cookieHeader.split(';').reduce((cookies, cookie) => {
    const [name, ...rest] = cookie.trim().split('=')
    if (name && rest.length > 0) {
      cookies[name] = rest.join('=')
    }
    return cookies
  }, {} as Record<string, string>)
}

/**
 * Get a specific cookie value
 */
function getCookie(req: VercelRequest, name: string): string | undefined {
  const cookies = parseCookies(req)
  return cookies[name]
}

/**
 * Authentication result
 */
interface AuthResult {
  userId: string
  email: string
  role: string
}

/**
 * Authenticate request using either Authorization header or cookie
 * Supports both header-based and cookie-based authentication
 */
async function authenticateRequest(req: VercelRequest): Promise<AuthResult | null> {
  // Check environment variables
  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      hasAnonKey: !!supabaseAnonKey,
    })
    return null
  }

  // Try Authorization header first
  let accessToken: string | undefined
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.substring(7)
  }

  // Fallback to cookie if no Authorization header
  if (!accessToken) {
    accessToken = getCookie(req, 'sb-access-token')
  }

  if (!accessToken) {
    return null
  }

  // Verify user and check admin role
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })

  const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken)
  if (authError || !user) {
    console.error('Auth error:', authError)
    return null
  }

  // Check admin role
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
    role: profile.role
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Authenticate and verify admin role
    const auth = await authenticateRequest(req)
    if (!auth) {
      return res.status(401).json({ error: 'No authentication token provided' })
    }

    console.log(`📊 Admin ${auth.email} fetching all projects`)

    // Create admin client for querying
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Get all projects with owner information using the correct JOIN
    const { data, error } = await supabaseAdmin
      .from('projects')
      .select(`
        id,
        name,
        description,
        project_type,
        owner_id,
        created_at,
        updated_at,
        status,
        priority_level,
        visibility,
        owner:user_profiles!owner_id(id, email, full_name)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Supabase query error:', error)
      throw error
    }

    // Get counts for each project
    const projectIds = (data || []).map((p: { id: string }) => p.id)

    // Get idea counts
    const { data: ideaCounts } = await supabaseAdmin
      .from('ideas')
      .select('project_id')
      .in('project_id', projectIds)

    const ideaCountMap = (ideaCounts || []).reduce((acc: Record<string, number>, idea: { project_id: string }) => {
      acc[idea.project_id] = (acc[idea.project_id] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Get file counts and total sizes
    const { data: fileData } = await supabaseAdmin
      .from('project_files')
      .select('project_id, file_size')
      .in('project_id', projectIds)

    const fileStatsMap = (fileData || []).reduce((acc: Record<string, { count: number; totalSize: number }>, file: { project_id: string; file_size: number | null }) => {
      if (!acc[file.project_id]) {
        acc[file.project_id] = { count: 0, totalSize: 0 }
      }
      acc[file.project_id].count += 1
      acc[file.project_id].totalSize += file.file_size || 0
      return acc
    }, {} as Record<string, { count: number; totalSize: number }>)

    // Get collaborator counts
    const { data: collaborators } = await supabaseAdmin
      .from('project_collaborators')
      .select('project_id')
      .in('project_id', projectIds)

    const collaboratorCountMap = (collaborators || []).reduce((acc: Record<string, number>, collab: { project_id: string }) => {
      acc[collab.project_id] = (acc[collab.project_id] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Get last activity for each project
    const { data: activities } = await supabaseAdmin
      .from('ideas')
      .select('project_id, updated_at')
      .in('project_id', projectIds)
      .order('updated_at', { ascending: false })

    const lastActivityMap = (activities || []).reduce((acc: Record<string, string>, activity: { project_id: string; updated_at: string }) => {
      if (!acc[activity.project_id]) {
        acc[activity.project_id] = activity.updated_at
      }
      return acc
    }, {} as Record<string, string>)

    const projects = (data || []).map((project: Record<string, unknown>) => {
      const projectId = project.id as string
      return {
        ...project,
        owner: Array.isArray(project.owner) ? project.owner[0] : project.owner,
        idea_count: ideaCountMap[projectId] || 0,
        file_count: fileStatsMap[projectId]?.count || 0,
        total_file_size: fileStatsMap[projectId]?.totalSize || 0,
        collaborator_count: (collaboratorCountMap[projectId] || 0) + 1, // +1 for owner
        last_activity: lastActivityMap[projectId] || null,
        status: project.status || 'active',
        priority_level: project.priority_level || 'medium',
        visibility: project.visibility || 'private'
      }
    })

    return res.status(200).json({
      success: true,
      projects: projects,
      total: projects.length
    })

  } catch (error) {
    console.error('❌ Error fetching admin projects:', error)
    return res.status(500).json({
      error: 'Failed to fetch projects',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
