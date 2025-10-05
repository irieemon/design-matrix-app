#!/usr/bin/env node

/**
 * Database Migration Script using PostgreSQL direct connection
 * Applies the updated_at column migration to project_roadmaps table
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

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

// Extract project reference from Supabase URL
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)[1];

// Supabase connection string format for pooler (port 6543) with direct password
const connectionString = `postgresql://postgres.${projectRef}:${SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

console.log('🔧 Installing pg library...');
try {
  execSync('npm install --no-save pg', { stdio: 'pipe' });
  console.log('✅ pg library installed\n');
} catch (error) {
  console.error('❌ Failed to install pg library');
  console.error('Try running: npm install --no-save pg');
  process.exit(1);
}

// Import pg after installation
const pg = await import('pg');
const { Client } = pg.default;

async function applyMigration() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to Supabase PostgreSQL database...');
    console.log(`   Project: ${projectRef}`);
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Read migration SQL
    const migrationPath = join(__dirname, '..', 'migrations', 'add_updated_at_to_project_roadmaps.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📝 Applying migration: add_updated_at_to_project_roadmaps.sql');
    console.log('─'.repeat(60));

    // Execute migration
    await client.query(migrationSQL);

    console.log('✅ Migration applied successfully!\n');

    // Verify the column was added
    console.log('🔍 Verifying updated_at column...');
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'project_roadmaps'
        AND column_name = 'updated_at';
    `);

    if (verifyResult.rows.length > 0) {
      const col = verifyResult.rows[0];
      console.log('✅ Column exists:');
      console.log(`   Name: ${col.column_name}`);
      console.log(`   Type: ${col.data_type}`);
      console.log(`   Nullable: ${col.is_nullable}`);
      console.log(`   Default: ${col.column_default || 'none'}`);
      console.log('');
    } else {
      console.error('❌ Column not found after migration!');
      process.exit(1);
    }

    // Verify the trigger exists
    console.log('🔍 Verifying trigger...');
    const triggerResult = await client.query(`
      SELECT trigger_name, event_manipulation, action_timing, action_statement
      FROM information_schema.triggers
      WHERE event_object_schema = 'public'
        AND event_object_table = 'project_roadmaps'
        AND trigger_name = 'update_project_roadmaps_updated_at';
    `);

    if (triggerResult.rows.length > 0) {
      const trigger = triggerResult.rows[0];
      console.log('✅ Trigger exists:');
      console.log(`   Name: ${trigger.trigger_name}`);
      console.log(`   Event: ${trigger.event_manipulation}`);
      console.log(`   Timing: ${trigger.action_timing}`);
      console.log('');
    } else {
      console.log('ℹ️  Trigger not found (may be created separately)');
      console.log('');
    }

    // Show full table structure
    console.log('📊 Complete table structure for project_roadmaps:');
    const structureResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'project_roadmaps'
      ORDER BY ordinal_position;
    `);

    structureResult.rows.forEach(row => {
      const nullable = row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`   ${row.column_name.padEnd(20)} ${row.data_type.padEnd(25)} ${nullable}`);
    });

    console.log('\n' + '─'.repeat(60));
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('─'.repeat(60));
    console.log('\n📋 Next Steps:');
    console.log('   1. Test roadmap drag/drop functionality in the application');
    console.log('   2. Verify no "record \'new\' has no field \'updated_at\'" errors');
    console.log('   3. Confirm roadmap updates are working correctly');
    console.log('   4. Monitor application logs for any related issues\n');

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED!');
    console.error('─'.repeat(60));
    console.error('Error:', error.message);
    if (error.code) {
      console.error('Error Code:', error.code);
    }
    if (error.detail) {
      console.error('Detail:', error.detail);
    }
    console.error('\n💡 Troubleshooting:');
    console.error('   - Check database connection credentials');
    console.error('   - Verify service role key has sufficient permissions');
    console.error('   - Ensure migration SQL is valid PostgreSQL syntax');
    console.error('   - Check if column already exists (migration is idempotent)\n');
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the migration
applyMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
