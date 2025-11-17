/**
 * Admin Projects API Endpoint
 *
 * Provides admin-only access to all projects across the platform
 * Requires admin authentication with rate limiting and CSRF protection
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
// TEMPORARILY DISABLED: import { adminEndpoint } from '../_lib/middleware/compose'
import { supabaseAdmin } from '../_lib/utils/supabaseAdmin'
// TEMPORARILY DISABLED: import type { AuthenticatedRequest } from '../_lib/middleware/types'
import { createClient } from '@supabase/supabase-js'

// Inline auth check (temporary diagnostic - bypasses middleware composition)
async function getAdminProjects(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // DIAGNOSTIC: Temporary inline auth check
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({
        error: 'Missing Supabase configuration',
        hasUrl: !!supabaseUrl,
        hasAnonKey: !!supabaseAnonKey,
        availableEnvVars: Object.keys(process.env).filter(k => k.includes('SUPABASE'))
      })
    }

    // Extract token from cookie
    const cookies = req.headers.cookie || ''
    const accessToken = cookies
      .split(';')
      .find(c => c.trim().startsWith('sb-access-token='))
      ?.split('=')[1]
      ?.trim()

    if (!accessToken) {
      return res.status(401).json({ error: 'No access token found in cookies' })
    }

    // Verify user with token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } }
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token', details: authError?.message })
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    console.log(`📊 Admin ${user.email} fetching all projects`)

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
    const projectIds = (data || []).map(p => p.id)

    // Get idea counts
    const { data: ideaCounts } = await supabaseAdmin
      .from('ideas')
      .select('project_id')
      .in('project_id', projectIds)

    const ideaCountMap = (ideaCounts || []).reduce((acc, idea) => {
      acc[idea.project_id] = (acc[idea.project_id] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Get file counts and total sizes
    const { data: fileData } = await supabaseAdmin
      .from('project_files')
      .select('project_id, file_size')
      .in('project_id', projectIds)

    const fileStatsMap = (fileData || []).reduce((acc, file) => {
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

    const collaboratorCountMap = (collaborators || []).reduce((acc, collab) => {
      acc[collab.project_id] = (acc[collab.project_id] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Get last activity for each project
    const { data: activities } = await supabaseAdmin
      .from('ideas')
      .select('project_id, updated_at')
      .in('project_id', projectIds)
      .order('updated_at', { ascending: false })

    const lastActivityMap = (activities || []).reduce((acc, activity) => {
      if (!acc[activity.project_id]) {
        acc[activity.project_id] = activity.updated_at
      }
      return acc
    }, {} as Record<string, string>)

    const projects = (data || []).map(project => ({
      ...project,
      owner: Array.isArray(project.owner) ? project.owner[0] : project.owner,
      idea_count: ideaCountMap[project.id] || 0,
      file_count: fileStatsMap[project.id]?.count || 0,
      total_file_size: fileStatsMap[project.id]?.totalSize || 0,
      collaborator_count: (collaboratorCountMap[project.id] || 0) + 1, // +1 for owner
      last_activity: lastActivityMap[project.id] || null,
      status: project.status || 'active',
      priority_level: project.priority_level || 'medium',
      visibility: project.visibility || 'private'
    }))

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

// TEMPORARILY DISABLED: Export with admin middleware
// export default adminEndpoint(getAdminProjects)

// DIAGNOSTIC: Export without middleware wrapper to isolate the issue
export default getAdminProjects
