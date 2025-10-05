#!/usr/bin/env node

/**
 * Database Migration using Session Pooler (port 5432)
 * Alternative connection method for Supabase
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment
const envPath = join(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing credentials');
  process.exit(1);
}

const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)[1];

// Ensure pg is available
console.log('📦 Checking pg library...');
try {
  execSync('npm install --no-save pg 2>&1', { stdio: 'pipe' });
  console.log('✅ Ready\n');
} catch (e) {}

const pg = await import('pg');
const { Client } = pg.default;

// Try session pooler on port 5432
const config = {
  host: `aws-0-us-east-1.pooler.supabase.com`,
  port: 5432,
  database: 'postgres',
  user: `postgres.${projectRef}`,
  password: SERVICE_ROLE_KEY,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
};

async function migrate() {
  const client = new Client(config);

  console.log('🔧 Migration Tool - Session Pooler');
  console.log('═'.repeat(60));
  console.log(`📍 Project: ${projectRef}`);
  console.log(`🔌 Port: ${config.port} (session pooler)\n`);

  try {
    console.log('Connecting...');
    await client.connect();
    console.log('✅ Connected!\n');

    const sql = readFileSync(
      join(__dirname, '..', 'migrations', 'add_updated_at_to_project_roadmaps.sql'),
      'utf-8'
    );

    console.log('⚡ Executing migration...');
    await client.query(sql);
    console.log('✅ Migration executed\n');

    // Verify
    const { rows } = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'project_roadmaps'
        AND column_name = 'updated_at';
    `);

    if (rows.length > 0) {
      console.log('✅ Column verified:');
      console.log(`   ${rows[0].column_name}: ${rows[0].data_type}\n`);
      console.log('═'.repeat(60));
      console.log('✅ SUCCESS! Migration completed');
      console.log('═'.repeat(60));
      console.log('\n📋 Next: Test roadmap drag/drop functionality\n');
    } else {
      throw new Error('Column not created');
    }

  } catch (error) {
    console.error('\n❌ Failed:', error.message);
    if (error.code) console.error('Code:', error.code);

    console.log('\n🔗 Manual execution required:');
    console.log(`   https://supabase.com/dashboard/project/${projectRef}/sql\n`);

    const sql = readFileSync(
      join(__dirname, '..', 'migrations', 'add_updated_at_to_project_roadmaps.sql'),
      'utf-8'
    );
    console.log('📝 SQL to execute:');
    console.log('─'.repeat(60));
    console.log(sql);
    console.log('─'.repeat(60));

    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
