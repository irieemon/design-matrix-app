/**
 * API endpoint to fetch ideas for a project
 * Bypasses frontend database.ts issues
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

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
    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { data, error } = await supabaseAdmin
      .from('ideas')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching ideas:', error)
      return res.status(500).json({ error: error.message })
    }

    console.log(`✅ Fetched ${data.length} ideas for project ${projectId}`)
    return res.status(200).json({ ideas: data })

  } catch (error) {
    console.error('Exception fetching ideas:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
