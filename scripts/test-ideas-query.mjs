#!/usr/bin/env node
/**
 * Test Ideas Query - Diagnostic Script
 *
 * Verifies that ideas can be loaded from the database using service role
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Read .env file manually
const envContent = readFileSync('.env', 'utf-8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    envVars[match[1].trim()] = match[2].trim()
  }
})

const SUPABASE_URL = envVars.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY
const TEST_PROJECT_ID = 'deade958-e26c-4c4b-99d6-8476c326427b'

console.log('\n=== Testing Ideas Query ===\n')

// Create admin client (service role - bypasses RLS)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

console.log('1. Testing with service role key (bypasses RLS)...')

const { data: ideas, error } = await supabaseAdmin
  .from('ideas')
  .select('*')
  .eq('project_id', TEST_PROJECT_ID)
  .order('created_at', { ascending: false })

if (error) {
  console.error('\n❌ Error:', error.message)
  console.error('Code:', error.code)
  process.exit(1)
}

console.log(`\n✅ Success! Found ${ideas.length} ideas\n`)

if (ideas.length > 0) {
  console.log('Sample idea:')
  console.log({
    id: ideas[0].id,
    content: ideas[0].content,
    details: ideas[0].details?.substring(0, 50) + '...',
    x: ideas[0].x,
    y: ideas[0].y,
    priority: ideas[0].priority,
    project_id: ideas[0].project_id
  })
  console.log(`\n... and ${ideas.length - 1} more ideas\n`)
} else {
  console.log('⚠️  No ideas found for this project')
}

console.log('=== Test Complete ===\n')

process.exit(0)
