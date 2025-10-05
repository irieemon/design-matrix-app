/**
 * Consolidated Admin API Routes
 *
 * Consolidates all admin routes into a single serverless function:
 * - POST /api/admin?action=apply-migration
 * - POST /api/admin?action=run-migration
 * - POST /api/admin?action=migrate-database
 * - POST /api/admin?action=enable-realtime
 * - POST /api/admin?action=enable-realtime-sql
 */

import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!

// ============================================================================
// APPLY MIGRATION HANDLER
// ============================================================================

async function handleApplyMigration(req: VercelRequest, res: VercelResponse) {
  try {
    const { migrationFile } = req.body

    if (!migrationFile) {
      return res.status(400).json({ error: 'Migration file path required' })
    }

    console.log(`🔧 Applying migration: ${migrationFile}`)

    const migrationPath = join(process.cwd(), migrationFile)
    const sql = readFileSync(migrationPath, 'utf8')

    console.log(`📖 Migration SQL loaded (${sql.length} characters)`)

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase credentials')
      return res.status(500).json({ error: 'Server configuration error' })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })

    console.log('🔌 Connected to Supabase with service role')

    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`🚀 Executing ${statements.length} SQL statements...`)

    const results = []
    for (const statement of statements) {
      try {
        console.log(`  Executing: ${statement.substring(0, 50)}...`)
        const { error: _error } = await supabase
          .from('_migrations')
          .select('*')
          .limit(0)

        results.push({ statement, status: 'pending' })
      } catch (err: any) {
        console.error(`  Error: ${err.message}`)
        results.push({ statement, status: 'error', error: err.message })
      }
    }

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

// ============================================================================
// RUN MIGRATION HANDLER (same as apply-migration)
// ============================================================================

async function handleRunMigration(req: VercelRequest, res: VercelResponse) {
  // Same implementation as apply-migration
  return handleApplyMigration(req, res)
}

// ============================================================================
// MIGRATE DATABASE HANDLER
// ============================================================================

async function handleMigrateDatabase(req: VercelRequest, res: VercelResponse) {
  try {
    const { action, confirm } = req.body

    if (action !== 'add_ai_analysis_columns') {
      return res.status(400).json({ error: 'Unknown migration action' })
    }

    if (!confirm) {
      return res.status(400).json({
        error: 'Migration requires confirmation',
        message: 'Send { "action": "add_ai_analysis_columns", "confirm": true } to proceed'
      })
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({
        error: 'Missing Supabase configuration',
        details: 'Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables'
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🔄 Running database migration: add_ai_analysis_columns')

    const migrationSQL = `
      ALTER TABLE project_files
      ADD COLUMN IF NOT EXISTS ai_analysis JSONB,
      ADD COLUMN IF NOT EXISTS analysis_status TEXT CHECK (analysis_status IN ('pending', 'analyzing', 'completed', 'failed', 'skipped'));

      CREATE INDEX IF NOT EXISTS idx_project_files_analysis_status ON project_files(analysis_status);
    `

    const { error: migrationError } = await supabase.rpc('exec_sql', { sql: migrationSQL })

    if (migrationError) {
      console.error('❌ Migration failed:', migrationError)
      return res.status(500).json({
        error: 'Migration failed',
        details: migrationError
      })
    }

    console.log('✅ Migration completed successfully')

    return res.status(200).json({
      success: true,
      message: 'Database migration completed successfully',
      migration: 'add_ai_analysis_columns',
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

// ============================================================================
// ENABLE REALTIME HANDLER
// ============================================================================

async function handleEnableRealtime(_req: VercelRequest, res: VercelResponse) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Supabase service configuration missing' })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🔧 Checking and enabling real-time for project_files table...')

    const results = {
      replicaIdentity: 'unknown' as string,
      realtimeEnabled: false,
      policies: [] as any[],
      errors: [] as string[]
    }

    try {
      console.log('📡 Attempting to enable real-time replication...')

      const testChannel = supabase
        .channel('realtime_test')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'project_files'
        }, (payload) => {
          console.log('✅ Test subscription working:', payload.eventType)
        })

      const subscribePromise = new Promise((resolve, reject) => {
        testChannel.subscribe((status, err) => {
          console.log('🔔 Test subscription status:', status, err)
          if (status === 'SUBSCRIBED') {
            results.realtimeEnabled = true
            resolve(true)
          } else if (status === 'CHANNEL_ERROR') {
            results.errors.push(`Subscription failed: ${err}`)
            reject(err)
          }
        })

        setTimeout(() => {
          testChannel.unsubscribe()
          resolve(false)
        }, 10000)
      })

      await subscribePromise

    } catch (error) {
      console.error('❌ Error testing subscription:', error)
      results.errors.push(`Subscription test failed: ${error}`)
    }

    try {
      const { data: tableInfo, error: tableError } = await supabase
        .from('project_files')
        .select('id, analysis_status')
        .limit(1)

      if (tableError) {
        results.errors.push(`Table access error: ${tableError.message}`)
      } else {
        console.log('✅ Table is accessible, sample record:', tableInfo?.[0])
      }
    } catch (error) {
      results.errors.push(`Table check failed: ${error}`)
    }

    const instructions = [
      '📋 Real-time Debugging Instructions:',
      '',
      '1. Go to your Supabase Dashboard',
      '2. Navigate to Database > Replication',
      '3. Find the "project_files" table',
      '4. Enable replication for this table',
      '5. If not there, go to Database > Settings and check if realtime is enabled',
      '',
      '🔧 Alternative fixes:',
      '• Check if RLS policies are blocking the subscription',
      '• Verify the table has a primary key (id column)',
      '• Ensure the user has proper permissions'
    ]

    console.log(instructions.join('\n'))

    return res.status(200).json({
      success: true,
      message: 'Real-time diagnostic completed',
      results,
      instructions,
      note: 'If realtime is not enabled, you need to enable it in the Supabase Dashboard under Database > Replication'
    })

  } catch (error) {
    console.error('❌ Error in real-time diagnostic:', error)
    return res.status(500).json({
      error: 'Failed to run diagnostic',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// ============================================================================
// ENABLE REALTIME SQL HANDLER
// ============================================================================

async function handleEnableRealtimeSql(_req: VercelRequest, res: VercelResponse) {
  // This would typically execute SQL to enable realtime
  // For now, redirecting to the main realtime handler
  return handleEnableRealtime(_req, res)
}

// ============================================================================
// MAIN ROUTER
// ============================================================================

export default async function adminRouter(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Extract action from query parameter
  const action = (req.query.action as string) || ''

  // Route based on action
  switch (action) {
    case 'apply-migration':
      return handleApplyMigration(req, res)

    case 'run-migration':
      return handleRunMigration(req, res)

    case 'migrate-database':
      return handleMigrateDatabase(req, res)

    case 'enable-realtime':
      return handleEnableRealtime(req, res)

    case 'enable-realtime-sql':
      return handleEnableRealtimeSql(req, res)

    default:
      return res.status(404).json({
        error: 'Invalid action',
        validActions: [
          'apply-migration',
          'run-migration',
          'migrate-database',
          'enable-realtime',
          'enable-realtime-sql'
        ]
      })
  }
}
