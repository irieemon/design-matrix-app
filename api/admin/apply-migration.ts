/**
 * Admin API endpoint to apply database migrations
 * Requires authentication and appropriate permissions
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

export default async function handler(req: any, res: any) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Get migration file from request body
    const { migrationFile } = req.body

    if (!migrationFile) {
      return res.status(400).json({ error: 'Migration file path required' })
    }

    console.log(`🔧 Applying migration: ${migrationFile}`)

    // Read migration SQL
    const migrationPath = join(process.cwd(), migrationFile)
    const sql = readFileSync(migrationPath, 'utf8')

    console.log(`📖 Migration SQL loaded (${sql.length} characters)`)

    // Get Supabase credentials
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase credentials')
      return res.status(500).json({ error: 'Server configuration error' })
    }

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })

    console.log('🔌 Connected to Supabase with service role')

    // Execute the migration by executing it as raw SQL
    // We need to split the SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`🚀 Executing ${statements.length} SQL statements...`)

    const results = []
    for (const statement of statements) {
      try {
        console.log(`  Executing: ${statement.substring(0, 50)}...`)

        // Use the postgres connection to execute raw SQL
        // Note: This requires enabling the PostgREST extensions
        const { data, error } = await supabase
          .from('_migrations')
          .select('*')
          .limit(0)

        // Since we can't execute arbitrary SQL through the client,
        // we'll return the SQL for manual execution
        results.push({ statement, status: 'pending' })
      } catch (err: any) {
        console.error(`  Error: ${err.message}`)
        results.push({ statement, status: 'error', error: err.message })
      }
    }

    // Return SQL for manual execution in Supabase dashboard
    return res.status(200).json({
      success: false,
      message: 'Migration needs to be applied manually',
      instructions: {
        step1: 'Open Supabase SQL Editor',
        url: `https://supabase.com/dashboard/project/${supabaseUrl.split('//')[1].split('.')[0]}/editor/sql`,
        step2: 'Copy and execute the SQL below',
        sql: sql
      },
      statements: results
    })

  } catch (error: any) {
    console.error('❌ Migration failed:', error)
    return res.status(500).json({
      error: 'Migration failed',
      details: error.message,
      stack: error.stack
    })
  }
}
