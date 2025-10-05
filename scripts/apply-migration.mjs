#!/usr/bin/env node

/**
 * Migration application script
 * Applies a SQL migration file to the Supabase database
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials')
  console.error('Required environment variables:')
  console.error('  - VITE_SUPABASE_URL or SUPABASE_URL')
  console.error('  - SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Get migration file from command line argument
const migrationFile = process.argv[2]
if (!migrationFile) {
  console.error('❌ Error: No migration file specified')
  console.error('Usage: node scripts/apply-migration.mjs <migration-file>')
  console.error('Example: node scripts/apply-migration.mjs migrations/add_updated_at_to_project_roadmaps.sql')
  process.exit(1)
}

async function applyMigration() {
  try {
    console.log('🔧 Migration Application Script')
    console.log('================================')
    console.log(`📁 Migration file: ${migrationFile}`)
    console.log(`🌐 Supabase URL: ${supabaseUrl}`)
    console.log('')

    // Read migration file
    const migrationPath = join(projectRoot, migrationFile)
    console.log(`📖 Reading migration from: ${migrationPath}`)
    const sql = readFileSync(migrationPath, 'utf8')
    console.log(`✅ Migration SQL loaded (${sql.length} characters)`)
    console.log('')

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })

    console.log('🔌 Connected to Supabase with service role')
    console.log('')

    // Execute migration
    console.log('🚀 Executing migration...')
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      // If the RPC function doesn't exist, we need to use a different approach
      if (error.code === '42883') {
        console.log('⚠️  exec_sql RPC function not found')
        console.log('📝 Migration SQL that needs to be executed:')
        console.log('')
        console.log('================================================')
        console.log(sql)
        console.log('================================================')
        console.log('')
        console.log('👉 Please copy the SQL above and execute it in the Supabase SQL Editor:')
        console.log(`   ${supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/')}/editor/sql`)
        process.exit(0)
      }

      throw error
    }

    console.log('✅ Migration executed successfully!')
    if (data) {
      console.log('📊 Result:', data)
    }
    console.log('')
    console.log('🎉 Migration complete!')

  } catch (error) {
    console.error('')
    console.error('❌ Migration failed:')
    console.error(error)
    console.log('')
    console.log('📝 If the automatic execution failed, please apply the migration manually:')
    console.log(`   1. Open Supabase SQL Editor: ${supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/')}/editor/sql`)
    console.log(`   2. Copy the contents of: ${migrationFile}`)
    console.log(`   3. Paste and execute in the SQL Editor`)
    process.exit(1)
  }
}

applyMigration()
