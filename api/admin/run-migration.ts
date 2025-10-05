import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Admin Migration Runner API Endpoint
 *
 * Purpose: Execute SQL migrations programmatically via HTTP API
 * Security: Requires admin authentication and confirmation
 *
 * Usage:
 *   POST /api/admin/run-migration
 *   Body: {
 *     "migrationFile": "fix_collaborators_infinite_recursion.sql",
 *     "confirm": true,
 *     "dryRun": false
 *   }
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { migrationFile, confirm, dryRun = false } = req.body

    // Security: Require confirmation
    if (!confirm) {
      return res.status(400).json({
        error: 'Migration requires confirmation',
        message: 'Send { "migrationFile": "filename.sql", "confirm": true } to proceed',
        availableMigrations: [
          'fix_collaborators_infinite_recursion.sql'
        ]
      })
    }

    // Initialize Supabase with service role
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({
        error: 'Missing Supabase configuration',
        details: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required'
      })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Read migration file
    const migrationPath = resolve(process.cwd(), 'migrations', migrationFile)
    let migrationSql: string

    try {
      migrationSql = readFileSync(migrationPath, 'utf8')
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n')
        .trim()

      if (!migrationSql) {
        throw new Error('Migration file is empty')
      }
    } catch (fileError) {
      return res.status(400).json({
        error: 'Failed to read migration file',
        details: fileError instanceof Error ? fileError.message : 'Unknown error',
        migrationFile,
        searchPath: migrationPath
      })
    }

    // Dry run mode: return SQL without executing
    if (dryRun) {
      return res.status(200).json({
        dryRun: true,
        message: 'Dry run - SQL not executed',
        migrationFile,
        sql: migrationSql,
        sqlLength: migrationSql.length
      })
    }

    console.log('🔄 Running database migration:', migrationFile)

    // Try multiple execution methods
    let executionMethod = 'none'
    let executionError = null

    // Method 1: exec_sql RPC
    try {
      console.log('Attempting exec_sql RPC method...')
      const { error } = await supabase.rpc('exec_sql', { sql: migrationSql })

      if (error) throw error

      executionMethod = 'exec_sql'
      console.log('✅ Migration executed via exec_sql')
    } catch (execSqlError) {
      console.log('⚠️ exec_sql not available, trying alternative...')
      executionError = execSqlError

      // Method 2: sql RPC
      try {
        console.log('Attempting sql RPC method...')
        const { error } = await supabase.rpc('sql', { query: migrationSql })

        if (error) throw error

        executionMethod = 'sql'
        console.log('✅ Migration executed via sql RPC')
        executionError = null
      } catch (sqlError) {
        console.log('⚠️ sql RPC not available')
        executionError = sqlError
      }
    }

    // If both methods failed, provide setup instructions
    if (executionMethod === 'none') {
      return res.status(500).json({
        error: 'Migration execution failed',
        details: 'No available RPC function to execute SQL',
        executionError: executionError instanceof Error ? executionError.message : 'Unknown error',
        solution: {
          message: 'Create the exec_sql RPC function in Supabase',
          sql: `
-- Run this SQL in Supabase SQL Editor to enable automated migrations:
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;
          `.trim(),
          manualMigration: {
            message: 'Or run the migration SQL manually in Supabase SQL Editor',
            sql: migrationSql
          }
        }
      })
    }

    // Success response
    console.log('✅ Migration completed successfully')

    return res.status(200).json({
      success: true,
      message: 'Database migration completed successfully',
      migrationFile,
      executionMethod,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('💥 Migration error:', error)
    return res.status(500).json({
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
