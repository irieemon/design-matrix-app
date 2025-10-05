#!/usr/bin/env node

/**
 * Database Migration Script using Supabase REST API
 * Applies the updated_at column migration to project_roadmaps table
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

async function executeSQLQuery(sql) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY
    },
    body: JSON.stringify({ query: sql })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  return response.json();
}

async function checkColumn() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_column_exists`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
      'Prefer': 'params=single-object'
    },
    body: JSON.stringify({
      p_table_name: 'project_roadmaps',
      p_column_name: 'updated_at'
    })
  });

  if (response.ok) {
    return response.json();
  }
  return null;
}

async function applyMigration() {
  try {
    console.log('🔧 Supabase Migration Script');
    console.log('═'.repeat(60));
    console.log(`🌐 URL: ${SUPABASE_URL}`);
    console.log('');

    // Read migration SQL
    const migrationPath = join(__dirname, '..', 'migrations', 'add_updated_at_to_project_roadmaps.sql');
    console.log(`📖 Reading migration: ${migrationPath}`);
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    console.log(`✅ Loaded ${migrationSQL.length} characters\n`);

    // Since Supabase REST API doesn't support arbitrary SQL execution,
    // we need to provide the SQL to execute manually
    console.log('📝 MIGRATION SQL TO EXECUTE:');
    console.log('─'.repeat(60));
    console.log(migrationSQL);
    console.log('─'.repeat(60));
    console.log('');

    console.log('🔗 Execute this SQL in Supabase SQL Editor:');
    const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)[1];
    const editorURL = `https://supabase.com/dashboard/project/${projectRef}/editor`;
    console.log(`   ${editorURL}`);
    console.log('');

    console.log('📋 Manual Steps:');
    console.log('   1. Open the SQL Editor link above');
    console.log('   2. Create a new query');
    console.log('   3. Copy the SQL shown above');
    console.log('   4. Paste and execute in the editor');
    console.log('   5. Verify the results show success\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

applyMigration();
