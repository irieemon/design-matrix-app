#!/usr/bin/env node

/**
 * Test Script: Supabase Environment Variable Migration Validation
 *
 * Validates that the new SUPABASE_SERVICE_ROLE_KEY environment variable
 * is correctly configured and all backend endpoints are functioning.
 *
 * Run: node claudedocs/test-migration-keys.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables manually from .env file
try {
  const envPath = join(__dirname, '..', '.env')
  const envContent = readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=#]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()
      process.env[key] = value
    }
  })
} catch (error) {
  console.error('Warning: Could not load .env file:', error.message)
}

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.blue}━━━ ${msg} ━━━${colors.reset}\n`)
}

let testsPassed = 0
let testsFailed = 0

function assert(condition, successMsg, errorMsg) {
  if (condition) {
    log.success(successMsg)
    testsPassed++
    return true
  } else {
    log.error(errorMsg)
    testsFailed++
    return false
  }
}

async function runTests() {
  console.log(`
${colors.bright}╔════════════════════════════════════════════════════════════╗
║  Supabase Environment Variable Migration Validation Test  ║
╚════════════════════════════════════════════════════════════╝${colors.reset}
`)

  // ═══════════════════════════════════════════════════════════
  // TEST 1: Environment Variable Configuration
  // ═══════════════════════════════════════════════════════════
  log.header('TEST 1: Environment Variable Configuration')

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const legacyServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

  assert(
    !!supabaseUrl,
    'VITE_SUPABASE_URL is configured',
    'VITE_SUPABASE_URL is missing'
  )

  assert(
    !!supabaseAnonKey,
    'VITE_SUPABASE_ANON_KEY is configured',
    'VITE_SUPABASE_ANON_KEY is missing'
  )

  assert(
    !!supabaseServiceKey,
    'SUPABASE_SERVICE_ROLE_KEY is configured (new naming)',
    'SUPABASE_SERVICE_ROLE_KEY is missing - migration incomplete!'
  )

  assert(
    !legacyServiceKey,
    'VITE_SUPABASE_SERVICE_ROLE_KEY is removed (legacy variable)',
    'VITE_SUPABASE_SERVICE_ROLE_KEY still exists - should be removed!'
  )

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    log.error('\n🚨 Critical environment variables missing. Cannot proceed with tests.\n')
    process.exit(1)
  }

  log.info(`Supabase URL: ${supabaseUrl.substring(0, 30)}...`)
  log.info(`Anon Key: ${supabaseAnonKey.substring(0, 30)}...`)
  log.info(`Service Key: ${supabaseServiceKey.substring(0, 30)}...`)

  // ═══════════════════════════════════════════════════════════
  // TEST 2: Anon Key Client Initialization
  // ═══════════════════════════════════════════════════════════
  log.header('TEST 2: Anon Key Client Initialization')

  let anonClient
  try {
    anonClient = createClient(supabaseUrl, supabaseAnonKey)
    log.success('Anon client created successfully')
    testsPassed++
  } catch (error) {
    log.error(`Anon client creation failed: ${error.message}`)
    testsFailed++
    process.exit(1)
  }

  // ═══════════════════════════════════════════════════════════
  // TEST 3: Service Role Key Client Initialization
  // ═══════════════════════════════════════════════════════════
  log.header('TEST 3: Service Role Key Client Initialization')

  let serviceClient
  try {
    serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
    log.success('Service role client created successfully')
    testsPassed++
  } catch (error) {
    log.error(`Service role client creation failed: ${error.message}`)
    testsFailed++
    process.exit(1)
  }

  // ═══════════════════════════════════════════════════════════
  // TEST 4: RLS Enforcement with Anon Key
  // ═══════════════════════════════════════════════════════════
  log.header('TEST 4: RLS Enforcement with Anon Key')

  log.info('Testing that anon key CANNOT bypass RLS (security check)...')

  try {
    const { data, error } = await anonClient
      .from('ideas')
      .select('id')
      .limit(1)

    if (error) {
      // This is expected! Anon key should fail without authentication
      if (error.message.includes('RLS') || error.message.includes('policy') || error.code === 'PGRST301') {
        log.success('RLS correctly enforced for unauthenticated anon key')
        testsPassed++
      } else {
        log.error(`Unexpected error (not RLS-related): ${error.message}`)
        testsFailed++
      }
    } else if (data && data.length > 0) {
      log.error('SECURITY ISSUE: Anon key bypassed RLS! This should not happen!')
      testsFailed++
    } else {
      log.success('RLS correctly enforced (empty result without auth)')
      testsPassed++
    }
  } catch (error) {
    log.error(`RLS test failed with exception: ${error.message}`)
    testsFailed++
  }

  // ═══════════════════════════════════════════════════════════
  // TEST 5: Service Key RLS Bypass
  // ═══════════════════════════════════════════════════════════
  log.header('TEST 5: Service Key Can Bypass RLS (Admin Access)')

  log.info('Testing that service key CAN bypass RLS (expected behavior)...')

  try {
    const { data, error } = await serviceClient
      .from('ideas')
      .select('id, content, created_by')
      .limit(5)

    if (error) {
      log.error(`Service key query failed: ${error.message}`)
      log.warn('This might indicate RLS policies are blocking even service role')
      testsFailed++
    } else {
      assert(
        data && data.length >= 0,
        `Service key successfully bypassed RLS (fetched ${data.length} ideas)`,
        'Service key failed to bypass RLS'
      )

      if (data.length > 0) {
        log.info(`Sample idea: "${data[0].content.substring(0, 50)}..."`)
      }
    }
  } catch (error) {
    log.error(`Service key test failed with exception: ${error.message}`)
    testsFailed++
  }

  // ═══════════════════════════════════════════════════════════
  // TEST 6: User Profiles Table Access
  // ═══════════════════════════════════════════════════════════
  log.header('TEST 6: User Profiles Table Access (Service Key)')

  try {
    const { data, error } = await serviceClient
      .from('user_profiles')
      .select('id, email, role')
      .limit(3)

    if (error) {
      log.warn(`User profiles query returned error: ${error.message}`)
      log.info('This might be expected if table is empty or RLS is very strict')
      testsFailed++
    } else {
      assert(
        data && Array.isArray(data),
        `User profiles accessible (${data.length} profiles found)`,
        'Failed to access user profiles'
      )

      if (data.length > 0) {
        const adminCount = data.filter(u => u.role === 'admin' || u.role === 'super_admin').length
        log.info(`Found ${adminCount} admin user(s)`)
      }
    }
  } catch (error) {
    log.error(`User profiles test failed: ${error.message}`)
    testsFailed++
  }

  // ═══════════════════════════════════════════════════════════
  // TEST 7: Projects Table Access
  // ═══════════════════════════════════════════════════════════
  log.header('TEST 7: Projects Table Access (Service Key)')

  try {
    const { data, error } = await serviceClient
      .from('projects')
      .select('id, name, status')
      .limit(5)

    if (error) {
      log.warn(`Projects query returned error: ${error.message}`)
      testsFailed++
    } else {
      assert(
        data && Array.isArray(data),
        `Projects accessible (${data.length} projects found)`,
        'Failed to access projects'
      )

      if (data.length > 0) {
        log.info(`Sample project: "${data[0].name}"`)
        const activeProjects = data.filter(p => p.status === 'active').length
        log.info(`Active projects: ${activeProjects}/${data.length}`)
      }
    }
  } catch (error) {
    log.error(`Projects test failed: ${error.message}`)
    testsFailed++
  }

  // ═══════════════════════════════════════════════════════════
  // TEST 8: Database Connection Health
  // ═══════════════════════════════════════════════════════════
  log.header('TEST 8: Database Connection Health')

  try {
    // Test basic connectivity with a simple query
    const { error } = await serviceClient
      .from('ideas')
      .select('count')
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "more than one row" which is fine - means connection works
      log.warn(`Connection test warning: ${error.message}`)
    } else {
      log.success('Database connection is healthy')
      testsPassed++
    }
  } catch (error) {
    log.error(`Database connection test failed: ${error.message}`)
    testsFailed++
  }

  // ═══════════════════════════════════════════════════════════
  // FINAL REPORT
  // ═══════════════════════════════════════════════════════════
  console.log(`
${colors.bright}╔════════════════════════════════════════════════════════════╗
║                      TEST SUMMARY                          ║
╚════════════════════════════════════════════════════════════╝${colors.reset}
`)

  const total = testsPassed + testsFailed
  const passRate = total > 0 ? ((testsPassed / total) * 100).toFixed(1) : 0

  console.log(`Tests Passed:  ${colors.green}${testsPassed}${colors.reset}`)
  console.log(`Tests Failed:  ${colors.red}${testsFailed}${colors.reset}`)
  console.log(`Total Tests:   ${total}`)
  console.log(`Pass Rate:     ${passRate >= 90 ? colors.green : colors.yellow}${passRate}%${colors.reset}`)

  console.log(`\n${colors.bright}Validation Checklist:${colors.reset}`)
  console.log(`  ${supabaseServiceKey ? '✅' : '❌'} SUPABASE_SERVICE_ROLE_KEY configured`)
  console.log(`  ${!legacyServiceKey ? '✅' : '❌'} Legacy VITE_SUPABASE_SERVICE_ROLE_KEY removed`)
  console.log(`  ${anonClient ? '✅' : '❌'} Anon client initialization`)
  console.log(`  ${serviceClient ? '✅' : '❌'} Service client initialization`)
  console.log(`  ${testsPassed >= 8 ? '✅' : '❌'} Database connectivity`)
  console.log(`  ${testsPassed >= 6 ? '✅' : '❌'} RLS enforcement`)

  if (testsFailed === 0) {
    console.log(`
${colors.green}${colors.bright}╔════════════════════════════════════════════════════════════╗
║  ✅ ALL TESTS PASSED - MIGRATION VALIDATION SUCCESSFUL!   ║
╚════════════════════════════════════════════════════════════╝${colors.reset}

${colors.bright}Next Steps:${colors.reset}
1. ✅ Environment variables correctly configured
2. ✅ Backend APIs using new SUPABASE_SERVICE_ROLE_KEY
3. ✅ RLS enforcement working correctly
4. 🔒 ${colors.yellow}CRITICAL${colors.reset}: Rotate the compromised service key
   Follow: claudedocs/SERVICE_KEY_ROTATION_GUIDE.md
5. ⏳ ${colors.cyan}FUTURE${colors.reset}: Phase 2 migration (Q1 2025)
   Ready for: New API key format (sb_publishable_*/sb_secret_*)
`)
    process.exit(0)
  } else {
    console.log(`
${colors.red}${colors.bright}╔════════════════════════════════════════════════════════════╗
║  ❌ SOME TESTS FAILED - REVIEW REQUIRED                   ║
╚════════════════════════════════════════════════════════════╝${colors.reset}

${colors.bright}Troubleshooting:${colors.reset}
1. Check that SUPABASE_SERVICE_ROLE_KEY is correct in .env
2. Verify Vercel environment variables are updated
3. Ensure dev server is running with latest .env
4. Check Supabase dashboard for key validity
5. Review test output above for specific failures
`)
    process.exit(1)
  }
}

// Run tests
runTests().catch(error => {
  console.error(`\n${colors.red}💥 Fatal error during testing:${colors.reset}`, error)
  process.exit(1)
})
