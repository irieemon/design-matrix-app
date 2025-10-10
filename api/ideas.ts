/**
 * API endpoint to fetch ideas for a project
 * GET /api/ideas?projectId=xxx
 *
 * SECURITY: Uses authenticated Supabase client to enforce Row-Level Security (RLS)
 * Part of RLS restoration (Phase 3)
 *
 * BACKWARDS COMPATIBILITY: Supports both httpOnly cookies (new) and Authorization header (old)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

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
 * Create authenticated Supabase client from request
 * Supports both httpOnly cookie auth and Authorization header auth
 */
function createAuthenticatedClient(req: VercelRequest) {
  const accessToken = getAccessToken(req)

  if (!accessToken) {
    throw new Error('No access token found - user not authenticated')
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing')
  }

  // Create client with user's access token (enforces RLS)
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
    // SECURITY: Create authenticated client (enforces RLS)
    const supabase = createAuthenticatedClient(req)

    // Query ideas with RLS enforcement
    const { data, error } = await supabase
      .from('ideas')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching ideas:', error)
      return res.status(500).json({ error: error.message })
    }

    console.log(`✅ API: Fetched ${data.length} ideas for project ${projectId} (with RLS)`)
    return res.status(200).json({ ideas: data })

  } catch (error) {
    console.error('Exception fetching ideas:', error)

    // Handle authentication errors specifically
    if (error instanceof Error && error.message.includes('not authenticated')) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
