#!/usr/bin/env node
/**
 * RLS Policy Validation Script
 *
 * Validates that Row-Level Security is properly configured on all user tables:
 * - Tests RLS enforcement with unauthenticated access attempts
 * - Documents findings for security audit
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { writeFile } from 'fs/promises'

// Load environment variables from .env
const envContent = readFileSync('.env', 'utf-8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    envVars[match[1]] = match[2]
  }
})

const supabaseUrl = envVars.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAnonKey = envVars.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   - VITE_SUPABASE_URL')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  console.error('   - VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

console.log('🔍 RLS Policy Validation Report')
console.log('='.repeat(80))
console.log('')

// Tables that should have RLS enabled
const USER_TABLES = [
  'ideas',
  'projects',
  'user_profiles',
  'project_collaborators',
  'project_files',
  'tags',
  'idea_tags'
]

/**
 * Test RLS enforcement by attempting unauthorized access
 */
async function testRLSEnforcement(tableName) {
  try {
    // Create anonymous client (no authentication)
    const anonClient = createClient(supabaseUrl, supabaseAnonKey)

    // Attempt to query table without authentication
    const { data, error } = await anonClient
      .from(tableName)
      .select('*')
      .limit(1)

    if (error) {
      // Good! RLS is blocking unauthenticated access
      return {
        tableName,
        rlsEnforced: true,
        result: 'Access denied (as expected)',
        error: error.message
      }
    }

    if (data && data.length === 0) {
      // Also good - query succeeded but returned no data (RLS filtered everything)
      return {
        tableName,
        rlsEnforced: true,
        result: 'Query succeeded but returned no data (RLS filtering)',
        data: []
      }
    }

    // Bad - unauthenticated access returned data
    return {
      tableName,
      rlsEnforced: false,
      result: '⚠️ WARNING: Unauthenticated access returned data!',
      dataCount: data?.length || 0
    }

  } catch (err) {
    return {
      tableName,
      rlsEnforced: 'error',
      error: err.message
    }
  }
}

/**
 * Main validation workflow
 */
async function main() {
  console.log('📋 Testing RLS Enforcement on User Tables...')
  console.log('')

  const results = []

  for (const tableName of USER_TABLES) {
    console.log(`🔍 Testing: ${tableName}`)

    // Test RLS enforcement
    const enforcement = await testRLSEnforcement(tableName)
    console.log(`   ${enforcement.rlsEnforced === true ? '✅' : '❌'} ${enforcement.result}`)
    if (enforcement.error && !enforcement.error.includes('JWT')) {
      console.log(`      Error: ${enforcement.error}`)
    }

    results.push({
      table: tableName,
      enforcement
    })

    console.log('')
  }

  // Summary Report
  console.log('='.repeat(80))
  console.log('📊 VALIDATION SUMMARY')
  console.log('='.repeat(80))
  console.log('')

  const enforced = results.filter(r => r.enforcement.rlsEnforced === true).length
  const notEnforced = results.filter(r => r.enforcement.rlsEnforced === false).length
  const enforcementErrors = results.filter(r => r.enforcement.rlsEnforced === 'error').length

  console.log(`🛡️  RLS Enforced: ${enforced}/${USER_TABLES.length} tables`)
  console.log(`⚠️  RLS Not Enforced: ${notEnforced}/${USER_TABLES.length} tables`)
  console.log(`❌ Test Errors: ${enforcementErrors}/${USER_TABLES.length} tables`)
  console.log('')

  // Recommendations
  console.log('='.repeat(80))
  console.log('💡 RECOMMENDATIONS')
  console.log('='.repeat(80))
  console.log('')

  console.log('📌 For Complete RLS Validation, Run in Supabase SQL Editor:')
  console.log('')
  console.log('   -- Check RLS status:')
  console.log('   SELECT schemaname, tablename, rowsecurity')
  console.log('   FROM pg_tables')
  console.log('   WHERE schemaname = \'public\';')
  console.log('')
  console.log('   -- View existing policies:')
  console.log('   SELECT schemaname, tablename, policyname, permissive, roles, cmd')
  console.log('   FROM pg_policies')
  console.log('   WHERE schemaname = \'public\'')
  console.log('   ORDER BY tablename, policyname;')
  console.log('')

  if (notEnforced > 0) {
    console.log('⚠️  Security Concerns:')
    results.forEach(r => {
      if (r.enforcement.rlsEnforced === false) {
        console.log(`   - ${r.table}: Add RLS policies or enable RLS`)
      }
    })
    console.log('')
  }

  if (enforced === USER_TABLES.length) {
    console.log('✅ All tables have RLS enforcement working!')
    console.log('   Unauthenticated access is properly blocked.')
    console.log('')
  }

  console.log('📄 Next Steps:')
  console.log('   1. Review the SQL queries above in Supabase Dashboard')
  console.log('   2. Document RLS policies in claudedocs/RLS_POLICY_REFERENCE.md')
  console.log('   3. Create automated RLS tests (Task 5)')
  console.log('')

  // Save results
  await writeFile(
    'claudedocs/rls-validation-results.json',
    JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        enforced,
        notEnforced,
        enforcementErrors
      },
      results
    }, null, 2)
  )
  console.log('💾 Results saved to claudedocs/rls-validation-results.json')
}

// Run validation
main().catch(err => {
  console.error('❌ Validation failed:', err)
  process.exit(1)
})
